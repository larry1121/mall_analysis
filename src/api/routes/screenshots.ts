import { FastifyPluginAsync } from 'fastify';
import { getPuppeteerScreenshot } from '../../lib/puppeteer-screenshot.js';
import fs from 'fs/promises';
import path from 'path';

interface ScreenshotListItem {
  filename: string;
  url: string;
  size: number;
  createdAt: string;
}

export const screenshotRoutes: FastifyPluginAsync = async (fastify) => {
  // Get list of screenshots
  fastify.get('/list', async (_, reply) => {
    try {
      const puppeteer = getPuppeteerScreenshot('./screenshots');
      const files = await puppeteer.getScreenshotsList();
      
      const screenshots: ScreenshotListItem[] = [];
      
      for (const filename of files) {
        const filePath = path.join('./screenshots', filename);
        try {
          const stats = await fs.stat(filePath);
          screenshots.push({
            filename,
            url: `/api/screenshots/${filename}`,
            size: stats.size,
            createdAt: stats.birthtime.toISOString()
          });
        } catch (error) {
          console.error(`Error reading file stats for ${filename}:`, error);
        }
      }
      
      // Sort by creation date (newest first)
      screenshots.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      
      return reply.send({
        success: true,
        count: screenshots.length,
        screenshots
      });
    } catch (error) {
      fastify.log.error(error as Error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to list screenshots'
      });
    }
  });

  // Delete a screenshot
  fastify.delete('/:filename', async (request, reply) => {
    const { filename } = request.params as { filename: string };
    
    // Validate filename (prevent directory traversal)
    if (filename.includes('..') || filename.includes('/')) {
      return reply.status(400).send({
        success: false,
        error: 'Invalid filename'
      });
    }
    
    try {
      const filePath = path.join('./screenshots', filename);
      await fs.unlink(filePath);
      
      return reply.send({
        success: true,
        message: `Screenshot ${filename} deleted`
      });
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return reply.status(404).send({
          success: false,
          error: 'Screenshot not found'
        });
      }
      
      fastify.log.error(error as Error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to delete screenshot'
      });
    }
  });

  // Get metadata for a specific screenshot
  fastify.get('/:filename/metadata', async (request, reply) => {
    const { filename } = request.params as { filename: string };
    
    // Validate filename
    if (filename.includes('..') || filename.includes('/')) {
      return reply.status(400).send({
        success: false,
        error: 'Invalid filename'
      });
    }
    
    try {
      const filePath = path.join('./screenshots', filename);
      const stats = await fs.stat(filePath);
      
      return reply.send({
        success: true,
        metadata: {
          filename,
          url: `/api/screenshots/${filename}`,
          size: stats.size,
          createdAt: stats.birthtime.toISOString(),
          modifiedAt: stats.mtime.toISOString()
        }
      });
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return reply.status(404).send({
          success: false,
          error: 'Screenshot not found'
        });
      }
      
      fastify.log.error(error as Error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get screenshot metadata'
      });
    }
  });

  // Capture a new screenshot
  fastify.post('/capture', async (request, reply) => {
    const { url, fullPage, viewport, waitFor } = request.body as {
      url: string;
      fullPage?: boolean;
      viewport?: { width: number; height: number; isMobile?: boolean };
      waitFor?: number;
    };
    
    if (!url) {
      return reply.status(400).send({
        success: false,
        error: 'URL is required'
      });
    }
    
    try {
      const puppeteer = getPuppeteerScreenshot('./screenshots');
      const result = await puppeteer.capture(url, {
        fullPage,
        viewport,
        waitFor
      });
      
      if (result.success) {
        return reply.send({
          success: true,
          screenshot: {
            url: `/api/screenshots/${path.basename(result.localPath!)}`,
            localPath: result.localPath,
            metadata: result.metadata
          }
        });
      } else {
        return reply.status(500).send({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      fastify.log.error(error as Error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to capture screenshot'
      });
    }
  });
};