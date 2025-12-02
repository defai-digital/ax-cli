import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  ImageProcessor,
  ImageProcessingError,
  SUPPORTED_IMAGE_FORMATS,
} from '../../src/utils/image-processor.js';

describe('ImageProcessor', () => {
  const testDir = path.join(process.cwd(), 'tests', 'fixtures', 'images');
  const testPngPath = path.join(testDir, 'test.png');
  const testJpgPath = path.join(testDir, 'test.jpg');

  // Create test fixtures before tests
  beforeAll(async () => {
    await fs.mkdir(testDir, { recursive: true });

    // Create minimal PNG (1x1 pixel transparent)
    const pngBytes = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
      0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, // IDAT chunk
      0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
      0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
      0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, // IEND chunk
      0x42, 0x60, 0x82,
    ]);
    await fs.writeFile(testPngPath, pngBytes);

    // Create minimal JPEG (1x1 pixel)
    const jpgBytes = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46,
      0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
      0x00, 0x01, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
      0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
      0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c,
      0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
      0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d,
      0x1a, 0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20,
      0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29,
      0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27,
      0x39, 0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34,
      0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
      0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4,
      0x00, 0x1f, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01,
      0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04,
      0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0xff,
      0xc4, 0x00, 0xb5, 0x10, 0x00, 0x02, 0x01, 0x03,
      0x03, 0x02, 0x04, 0x03, 0x05, 0x05, 0x04, 0x04,
      0x00, 0x00, 0x01, 0x7d, 0x01, 0x02, 0x03, 0x00,
      0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00,
      0x3f, 0x00, 0x7f, 0xff, 0xd9,
    ]);
    await fs.writeFile(testJpgPath, jpgBytes);
  });

  // Clean up test fixtures after tests
  afterAll(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('detectFormat', () => {
    it('detects PNG from magic bytes', () => {
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00]);
      expect(ImageProcessor.detectFormat(pngBuffer)).toBe('png');
    });

    it('detects JPEG from magic bytes', () => {
      const jpgBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
      expect(ImageProcessor.detectFormat(jpgBuffer)).toBe('jpg');
    });

    it('detects GIF from magic bytes', () => {
      const gifBuffer = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
      expect(ImageProcessor.detectFormat(gifBuffer)).toBe('gif');
    });

    it('detects WebP from magic bytes', () => {
      const webpBuffer = Buffer.from([
        0x52, 0x49, 0x46, 0x46, // RIFF
        0x00, 0x00, 0x00, 0x00, // file size
        0x57, 0x45, 0x42, 0x50, // WEBP
      ]);
      expect(ImageProcessor.detectFormat(webpBuffer)).toBe('webp');
    });

    it('returns null for unknown format', () => {
      const unknownBuffer = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
      expect(ImageProcessor.detectFormat(unknownBuffer)).toBeNull();
    });

    it('returns null for buffer too small', () => {
      const smallBuffer = Buffer.from([0x89, 0x50]);
      expect(ImageProcessor.detectFormat(smallBuffer)).toBeNull();
    });
  });

  describe('getMimeType', () => {
    it('returns correct MIME type for PNG', () => {
      expect(ImageProcessor.getMimeType('png')).toBe('image/png');
    });

    it('returns correct MIME type for JPEG', () => {
      expect(ImageProcessor.getMimeType('jpg')).toBe('image/jpeg');
      expect(ImageProcessor.getMimeType('jpeg')).toBe('image/jpeg');
    });

    it('returns correct MIME type for GIF', () => {
      expect(ImageProcessor.getMimeType('gif')).toBe('image/gif');
    });

    it('returns correct MIME type for WebP', () => {
      expect(ImageProcessor.getMimeType('webp')).toBe('image/webp');
    });
  });

  describe('isSupportedFormat', () => {
    it('returns true for supported formats', () => {
      for (const format of SUPPORTED_IMAGE_FORMATS) {
        expect(ImageProcessor.isSupportedFormat(format)).toBe(true);
      }
    });

    it('returns true with leading dot', () => {
      expect(ImageProcessor.isSupportedFormat('.png')).toBe(true);
      expect(ImageProcessor.isSupportedFormat('.jpg')).toBe(true);
    });

    it('returns false for unsupported formats', () => {
      expect(ImageProcessor.isSupportedFormat('txt')).toBe(false);
      expect(ImageProcessor.isSupportedFormat('pdf')).toBe(false);
      expect(ImageProcessor.isSupportedFormat('bmp')).toBe(false);
    });
  });

  describe('isImagePath', () => {
    it('returns true for image file paths', () => {
      expect(ImageProcessor.isImagePath('/path/to/image.png')).toBe(true);
      expect(ImageProcessor.isImagePath('./image.jpg')).toBe(true);
      expect(ImageProcessor.isImagePath('image.gif')).toBe(true);
      expect(ImageProcessor.isImagePath('image.webp')).toBe(true);
    });

    it('returns false for non-image paths', () => {
      expect(ImageProcessor.isImagePath('/path/to/file.txt')).toBe(false);
      expect(ImageProcessor.isImagePath('./document.pdf')).toBe(false);
    });

    it('handles uppercase extensions', () => {
      expect(ImageProcessor.isImagePath('image.PNG')).toBe(true);
      expect(ImageProcessor.isImagePath('image.JPG')).toBe(true);
    });
  });

  describe('processFromPath', () => {
    it('processes PNG file successfully', async () => {
      const result = await ImageProcessor.processFromPath(testPngPath);

      expect(result.format).toBe('png');
      expect(result.mimeType).toBe('image/png');
      expect(result.dataUri).toMatch(/^data:image\/png;base64,/);
      expect(result.originalPath).toBe(testPngPath);
      expect(result.sizeBytes).toBeGreaterThan(0);
    });

    it('processes JPEG file successfully', async () => {
      const result = await ImageProcessor.processFromPath(testJpgPath);

      expect(result.format).toBe('jpg');
      expect(result.mimeType).toBe('image/jpeg');
      expect(result.dataUri).toMatch(/^data:image\/jpeg;base64,/);
    });

    it('throws for non-existent file', async () => {
      await expect(
        ImageProcessor.processFromPath('/nonexistent/image.png')
      ).rejects.toThrow(ImageProcessingError);

      try {
        await ImageProcessor.processFromPath('/nonexistent/image.png');
      } catch (error) {
        expect(error).toBeInstanceOf(ImageProcessingError);
        expect((error as ImageProcessingError).code).toBe('FILE_NOT_FOUND');
      }
    });

    it('resolves relative paths correctly', async () => {
      const relativePath = path.relative(process.cwd(), testPngPath);
      const result = await ImageProcessor.processFromPath(relativePath);

      expect(result.originalPath).toBe(testPngPath);
    });

    it('rejects paths with null bytes (security)', async () => {
      await expect(
        ImageProcessor.processFromPath('image\0.png')
      ).rejects.toThrow('Invalid file path');
    });

    it('rejects path traversal attempts (security)', async () => {
      // Attempt to access file outside working directory
      await expect(
        ImageProcessor.processFromPath('../../../etc/passwd.png', testDir)
      ).rejects.toThrow();
    });
  });

  describe('formatBytes', () => {
    it('formats bytes correctly', () => {
      expect(ImageProcessor.formatBytes(0)).toBe('0 B');
      expect(ImageProcessor.formatBytes(100)).toBe('100 B');
      expect(ImageProcessor.formatBytes(1024)).toBe('1.0 KB');
      expect(ImageProcessor.formatBytes(1536)).toBe('1.5 KB');
      expect(ImageProcessor.formatBytes(1048576)).toBe('1.0 MB');
      expect(ImageProcessor.formatBytes(1572864)).toBe('1.5 MB');
    });
  });

  describe('getMaxSizeBytes', () => {
    it('returns 10MB', () => {
      expect(ImageProcessor.getMaxSizeBytes()).toBe(10 * 1024 * 1024);
    });
  });

  describe('getEstimatedTokens', () => {
    it('returns 1000 tokens per image', () => {
      expect(ImageProcessor.getEstimatedTokens()).toBe(1000);
    });
  });
});
