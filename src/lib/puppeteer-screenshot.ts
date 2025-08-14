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
        '--disable-renderer-backgrounding'
      ]
    });

    // Ensure screenshot directory exists
    await fs.mkdir(this.screenshotDir, { recursive: true });
  }

  async capture(url: string, config: ScreenshotConfig = {}): Promise<ScreenshotResult> {
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

    try {
      // Set viewport
      const viewport = config.viewport || {
        width: 1280,
        height: 800,
        deviceScaleFactor: 1,
        isMobile: false
      };
      await page.setViewport(viewport);

      // Navigate to URL
      await page.goto(url, {
        waitUntil: config.waitUntil || 'networkidle2',
        timeout: 30000
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
        metadata: {
          url,
          timestamp: Date.now(),
          viewport: { width: viewport.width, height: viewport.height },
          fullPage: config.fullPage !== false
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