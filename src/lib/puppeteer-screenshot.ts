import puppeteer, { Browser, Page, ScreenshotOptions } from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export interface ScreenshotConfig {
  viewport?: {
    width: number;
    height: number;
    deviceScaleFactor?: number;
    isMobile?: boolean;
  };
  fullPage?: boolean;
  quality?: number;
  type?: 'png' | 'jpeg' | 'webp';
  waitFor?: number | string;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
  actions?: Array<{
    type: 'click' | 'wait' | 'scroll' | 'type';
    selector?: string;
    value?: string | number;
    direction?: 'up' | 'down';
  }>;
}

export interface ScreenshotResult {
  success: boolean;
  screenshot?: string; // base64 encoded image
  localPath?: string; // local file path
  error?: string;
  metadata?: {
    url: string;
    timestamp: number;
    viewport: { width: number; height: number };
    fullPage: boolean;
  };
}

export interface ElementScreenshotConfig {
  selector?: string;
  bbox?: { x: number; y: number; width: number; height: number };
  padding?: number; // Extra padding around element
}

export interface ElementScreenshotResult {
  success: boolean;
  screenshot?: string; // base64 encoded image
  localPath?: string;
  selector?: string;
  bbox?: { x: number; y: number; width: number; height: number };
  error?: string;
}

export class PuppeteerScreenshot {
  private browser: Browser | null = null;
  private screenshotDir: string;
  private maxRetries: number;

  constructor(screenshotDir: string = './screenshots', maxRetries: number = 3) {
    this.screenshotDir = screenshotDir;
    this.maxRetries = maxRetries;
  }

  async initialize(): Promise<void> {
    // Always create a new browser instance to avoid connection issues
    if (this.browser) {
      try {
        await this.browser.close();
      } catch (e) {
        console.log('Failed to close existing browser:', e);
      }
    }
    
    this.browser = await puppeteer.launch({
      headless: 'new', // Use new headless mode
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-blink-features=AutomationControlled',  // Hide automation
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      ]
    });

    // Ensure screenshot directory exists
    await fs.mkdir(this.screenshotDir, { recursive: true });
  }

  async capture(url: string, config: ScreenshotConfig = {}): Promise<ScreenshotResult & { html?: string }> {
    let retries = 0;
    let lastError: Error | null = null;

    while (retries < this.maxRetries) {
      try {
        return await this.captureWithRetry(url, config);
      } catch (error) {
        lastError = error as Error;
        retries++;
        console.log(`Screenshot attempt ${retries} failed for ${url}: ${lastError.message}`);
        
        if (retries < this.maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * retries));
        }
      }
    }

    return {
      success: false,
      error: `Failed after ${this.maxRetries} attempts: ${lastError?.message}`
    };
  }

  private async captureWithRetry(url: string, config: ScreenshotConfig): Promise<ScreenshotResult> {
    // Always reinitialize browser for each capture to avoid connection issues
    await this.initialize();

    if (!this.browser) {
      throw new Error('Failed to initialize browser');
    }

    const page = await this.browser.newPage();
    
    // Cloudflare bypass: Remove webdriver property
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });
    });
    
    // Additional evasion techniques
    await page.evaluateOnNewDocument(() => {
      // Override the `plugins` property to use a custom getter
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });
      
      // Override the `languages` property to use a custom getter
      Object.defineProperty(navigator, 'languages', {
        get: () => ['ko-KR', 'ko', 'en-US', 'en'],
      });
      
      // Override the `permissions` property
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters: any) => (
        parameters.name === 'notifications'
          ? Promise.resolve({ state: Notification.permission } as PermissionStatus)
          : originalQuery(parameters)
      );
    });

    try {
      // Set viewport
      const viewport = config.viewport || {
        width: 1280,
        height: 800,
        deviceScaleFactor: 1,
        isMobile: false
      };
      await page.setViewport(viewport);

      // Set User-Agent to avoid detection
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      // Set additional headers to avoid detection
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
      });
      
      // Navigate to URL with increased timeout
      await page.goto(url, {
        waitUntil: config.waitUntil || 'networkidle2',
        timeout: 60000  // Increased from 30000 to 60000
      });

      // Wait if specified
      if (config.waitFor) {
        if (typeof config.waitFor === 'number') {
          await new Promise(resolve => setTimeout(resolve, config.waitFor as number));
        } else {
          await page.waitForSelector(config.waitFor, { timeout: 10000 });
        }
      }

      // Execute actions if provided
      if (config.actions) {
        await this.executeActions(page, config.actions);
      }

      // Wait for content to be fully loaded
      await page.waitForSelector('body', { timeout: 10000 });
      
      // Additional wait for dynamic content
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Capture full HTML after rendering
      const fullHTML = await page.content();
      
      // Take screenshot
      const screenshotOptions: ScreenshotOptions = {
        fullPage: config.fullPage !== false,
        type: config.type || 'png',
        quality: config.type === 'jpeg' || config.type === 'webp' ? (config.quality || 90) : undefined
      };

      const screenshotBuffer = await page.screenshot(screenshotOptions);
      
      // Generate unique filename
      const hash = crypto.createHash('md5').update(url + Date.now()).digest('hex');
      const filename = `${hash}.${config.type || 'png'}`;
      const localPath = path.join(this.screenshotDir, filename);

      // Save to local file
      await fs.writeFile(localPath, screenshotBuffer);

      // Convert to base64
      const base64 = screenshotBuffer.toString('base64');
      const mimeType = `image/${config.type || 'png'}`;
      const dataUri = `data:${mimeType};base64,${base64}`;

      return {
        success: true,
        screenshot: dataUri,
        localPath,
        html: fullHTML, // Include full rendered HTML
        metadata: {
          url,
          timestamp: Date.now(),
          viewport: { width: viewport.width, height: viewport.height },
          fullPage: config.fullPage !== false,
          htmlLength: fullHTML.length
        }
      };
    } catch (error) {
      throw error;
    } finally {
      await page.close();
    }
  }

  private async executeActions(page: Page, actions: ScreenshotConfig['actions']): Promise<void> {
    if (!actions) return;

    for (const action of actions) {
      switch (action.type) {
        case 'click':
          if (action.selector) {
            await page.click(action.selector);
          }
          break;
        
        case 'wait':
          if (typeof action.value === 'number') {
            await new Promise(resolve => setTimeout(resolve, action.value as number));
          } else if (action.selector) {
            await page.waitForSelector(action.selector);
          }
          break;
        
        case 'scroll':
          if (action.direction === 'down') {
            await page.evaluate(() => {
            (globalThis as any).scrollBy(0, (globalThis as any).innerHeight);
          });
          } else if (action.direction === 'up') {
            await page.evaluate(() => {
            (globalThis as any).scrollBy(0, -(globalThis as any).innerHeight);
          });
          } else if (typeof action.value === 'number') {
            await page.evaluate((pixels: number) => {
            (globalThis as any).scrollBy(0, pixels);
          }, action.value as number);
          }
          break;
        
        case 'type':
          if (action.selector && typeof action.value === 'string') {
            await page.type(action.selector, action.value);
          }
          break;
      }
    }
  }

  async captureMultiple(urls: string[], config: ScreenshotConfig = {}): Promise<ScreenshotResult[]> {
    const results: ScreenshotResult[] = [];
    
    for (const url of urls) {
      const result = await this.capture(url, config);
      results.push(result);
    }
    
    return results;
  }

  async capturePurchaseFlow(
    baseUrl: string,
    platform?: 'cafe24' | 'imweb' | 'unknown'
  ): Promise<{
    home?: ScreenshotResult;
    product?: ScreenshotResult;
    cart?: ScreenshotResult;
    checkout?: ScreenshotResult;
  }> {
    const flow: any = {};

    // Home page
    flow.home = await this.capture(baseUrl, {
      fullPage: true,
      waitFor: 2000
    });

    // Product page - platform specific selectors
    const productSelectors = {
      cafe24: "a[href*='/product/']",
      imweb: "a[href*='/store']",
      unknown: "a[href*='/product']"
    };

    const productConfig: ScreenshotConfig = {
      fullPage: true,
      waitFor: 2000,
      actions: [
        { type: 'click', selector: productSelectors[platform || 'unknown'] },
        { type: 'wait', value: 3000 }
      ]
    };

    flow.product = await this.capture(baseUrl, productConfig);

    // Cart page
    const cartSelectors = {
      cafe24: "a[href*='/order/basket.html']",
      imweb: "a[href*='/cart']",
      unknown: "a[href*='/cart']"
    };

    const cartConfig: ScreenshotConfig = {
      fullPage: true,
      waitFor: 2000,
      actions: [
        { type: 'click', selector: cartSelectors[platform || 'unknown'] },
        { type: 'wait', value: 3000 }
      ]
    };

    flow.cart = await this.capture(baseUrl, cartConfig);

    return flow;
  }

  async getScreenshotsList(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.screenshotDir);
      return files.filter(file => /\.(png|jpg|jpeg|webp)$/i.test(file));
    } catch (error) {
      console.error('Error reading screenshots directory:', error);
      return [];
    }
  }

  async getScreenshotPath(filename: string): Promise<string | null> {
    const filePath = path.join(this.screenshotDir, filename);
    try {
      await fs.access(filePath);
      return filePath;
    } catch {
      return null;
    }
  }

  async captureElement(url: string, elementConfig: ElementScreenshotConfig, pageConfig: ScreenshotConfig = {}): Promise<ElementScreenshotResult> {
    await this.initialize();

    if (!this.browser) {
      return {
        success: false,
        error: 'Failed to initialize browser'
      };
    }

    const page = await this.browser.newPage();

    try {
      // Set viewport
      const viewport = pageConfig.viewport || {
        width: 1280,
        height: 800,
        deviceScaleFactor: 2, // Higher quality for element screenshots
        isMobile: false
      };
      await page.setViewport(viewport);

      // Set User-Agent to avoid detection
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      // Navigate to URL with increased timeout
      await page.goto(url, {
        waitUntil: pageConfig.waitUntil || 'networkidle2',
        timeout: 60000  // Increased from 30000 to 60000
      });

      // Wait for content
      if (pageConfig.waitFor) {
        if (typeof pageConfig.waitFor === 'number') {
          await new Promise(resolve => setTimeout(resolve, pageConfig.waitFor as number));
        } else {
          await page.waitForSelector(pageConfig.waitFor, { timeout: 10000 });
        }
      }

      let screenshotBuffer: Buffer;
      let actualBbox: { x: number; y: number; width: number; height: number } | undefined;

      if (elementConfig.selector) {
        // Wait for selector and capture element
        await page.waitForSelector(elementConfig.selector, { timeout: 10000 });
        const element = await page.$(elementConfig.selector);
        
        if (!element) {
          throw new Error(`Element not found: ${elementConfig.selector}`);
        }

        // Get bounding box
        const box = await element.boundingBox();
        if (!box) {
          throw new Error(`Could not get bounding box for ${elementConfig.selector}`);
        }

        actualBbox = box;

        // Add padding if specified
        const padding = elementConfig.padding || 10;
        const clip = {
          x: Math.max(0, box.x - padding),
          y: Math.max(0, box.y - padding),
          width: box.width + (padding * 2),
          height: box.height + (padding * 2)
        };

        // Take screenshot with clip
        screenshotBuffer = await page.screenshot({
          clip,
          type: pageConfig.type || 'png'
        });

      } else if (elementConfig.bbox) {
        // Use provided bbox
        const padding = elementConfig.padding || 10;
        const clip = {
          x: Math.max(0, elementConfig.bbox.x - padding),
          y: Math.max(0, elementConfig.bbox.y - padding),
          width: elementConfig.bbox.width + (padding * 2),
          height: elementConfig.bbox.height + (padding * 2)
        };

        actualBbox = elementConfig.bbox;

        screenshotBuffer = await page.screenshot({
          clip,
          type: pageConfig.type || 'png'
        });
      } else {
        throw new Error('Either selector or bbox must be provided');
      }

      // Generate unique filename
      const hash = crypto.createHash('md5')
        .update(url + (elementConfig.selector || JSON.stringify(elementConfig.bbox)) + Date.now())
        .digest('hex');
      const filename = `element_${hash}.${pageConfig.type || 'png'}`;
      const localPath = path.join(this.screenshotDir, filename);

      // Save to local file
      await fs.writeFile(localPath, screenshotBuffer);

      // Convert to base64
      const base64 = screenshotBuffer.toString('base64');
      const mimeType = `image/${pageConfig.type || 'png'}`;
      const dataUri = `data:${mimeType};base64,${base64}`;

      return {
        success: true,
        screenshot: dataUri,
        localPath,
        selector: elementConfig.selector,
        bbox: actualBbox,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message
      };
    } finally {
      await page.close();
    }
  }

  async captureMultipleElements(
    url: string,
    elements: ElementScreenshotConfig[],
    pageConfig: ScreenshotConfig = {}
  ): Promise<ElementScreenshotResult[]> {
    await this.initialize();

    if (!this.browser) {
      return elements.map(() => ({
        success: false,
        error: 'Failed to initialize browser'
      }));
    }

    const page = await this.browser.newPage();
    const results: ElementScreenshotResult[] = [];
    
    // Cloudflare bypass: Remove webdriver property
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });
    });
    
    // Additional evasion techniques
    await page.evaluateOnNewDocument(() => {
      // Override the `plugins` property to use a custom getter
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });
      
      // Override the `languages` property to use a custom getter
      Object.defineProperty(navigator, 'languages', {
        get: () => ['ko-KR', 'ko', 'en-US', 'en'],
      });
    });

    try {
      // Set viewport
      const viewport = pageConfig.viewport || {
        width: 1280,
        height: 800,
        deviceScaleFactor: 2,
        isMobile: false
      };
      await page.setViewport(viewport);
      
      // Set User-Agent to avoid detection
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      // Set additional headers to avoid detection
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
      });

      // Navigate to URL once with increased timeout
      await page.goto(url, {
        waitUntil: pageConfig.waitUntil || 'networkidle2',
        timeout: 60000  // Increased from 30000 to 60000
      });

      // Wait for content
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Capture each element
      for (const elementConfig of elements) {
        try {
          let screenshotBuffer: Buffer;
          let actualBbox: { x: number; y: number; width: number; height: number } | undefined;

          if (elementConfig.selector) {
            const element = await page.$(elementConfig.selector);
            if (!element) {
              results.push({
                success: false,
                selector: elementConfig.selector,
                error: `Element not found: ${elementConfig.selector}`
              });
              continue;
            }

            const box = await element.boundingBox();
            if (!box) {
              results.push({
                success: false,
                selector: elementConfig.selector,
                error: `Could not get bounding box`
              });
              continue;
            }

            actualBbox = box;
            const padding = elementConfig.padding || 10;
            const clip = {
              x: Math.max(0, box.x - padding),
              y: Math.max(0, box.y - padding),
              width: box.width + (padding * 2),
              height: box.height + (padding * 2)
            };

            screenshotBuffer = await page.screenshot({
              clip,
              type: pageConfig.type || 'png'
            });

          } else if (elementConfig.bbox) {
            const padding = elementConfig.padding || 10;
            const clip = {
              x: Math.max(0, elementConfig.bbox.x - padding),
              y: Math.max(0, elementConfig.bbox.y - padding),
              width: elementConfig.bbox.width + (padding * 2),
              height: elementConfig.bbox.height + (padding * 2)
            };

            actualBbox = elementConfig.bbox;
            screenshotBuffer = await page.screenshot({
              clip,
              type: pageConfig.type || 'png'
            });
          } else {
            results.push({
              success: false,
              error: 'Neither selector nor bbox provided'
            });
            continue;
          }

          // Save screenshot
          const hash = crypto.createHash('md5')
            .update(url + (elementConfig.selector || JSON.stringify(elementConfig.bbox)) + Date.now())
            .digest('hex');
          const filename = `element_${hash}.${pageConfig.type || 'png'}`;
          const localPath = path.join(this.screenshotDir, filename);

          await fs.writeFile(localPath, screenshotBuffer);

          const base64 = screenshotBuffer.toString('base64');
          const mimeType = `image/${pageConfig.type || 'png'}`;
          const dataUri = `data:${mimeType};base64,${base64}`;

          results.push({
            success: true,
            screenshot: dataUri,
            localPath,
            selector: elementConfig.selector,
            bbox: actualBbox
          });
        } catch (error) {
          results.push({
            success: false,
            selector: elementConfig.selector,
            error: (error as Error).message
          });
        }
      }

      return results;
    } catch (error) {
      return elements.map(() => ({
        success: false,
        error: (error as Error).message
      }));
    } finally {
      await page.close();
    }
  }

  async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

// Return new instance each time to avoid connection issues
export function getPuppeteerScreenshot(screenshotDir?: string): PuppeteerScreenshot {
  return new PuppeteerScreenshot(screenshotDir);
}

// No singleton instance to clean up anymore