import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  parseImageInput,
  hasImageReferences,
  buildMessageContent,
  getImageHelpText,
  formatAttachmentForDisplay,
} from '../../../packages/core/src/ui/utils/image-handler.js';

describe('ImageInputHandler', () => {
  // Use unique directory to avoid conflicts with parallel test runs
  const testDir = path.join(process.cwd(), 'tests', 'fixtures', 'images-handler');
  const testPngPath = path.join(testDir, 'test.png');

  // Create test fixtures before tests
  beforeAll(async () => {
    await fs.mkdir(testDir, { recursive: true });

    // Create minimal PNG (1x1 pixel transparent)
    const pngBytes = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
      0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41,
      0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
      0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
      0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
      0x42, 0x60, 0x82,
    ]);
    await fs.writeFile(testPngPath, pngBytes);
  });

  // Clean up test fixtures after tests
  afterAll(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('parseImageInput', () => {
    it('parses @-prefixed image path', async () => {
      const input = `Analyze this image @${path.relative(process.cwd(), testPngPath)}`;
      const result = await parseImageInput(input, process.cwd());

      expect(result.hasImages).toBe(true);
      expect(result.images).toHaveLength(1);
      expect(result.images[0].image.format).toBe('png');
      expect(result.text).toContain('[Image #1:');
      expect(result.errors).toHaveLength(0);
    });

    it('parses multiple @-prefixed image paths (deduplicates same path)', async () => {
      const relativePath = path.relative(process.cwd(), testPngPath);
      const input = `Compare @${relativePath} with @${relativePath}`;
      const result = await parseImageInput(input, process.cwd());

      expect(result.hasImages).toBe(true);
      expect(result.images).toHaveLength(1);
      expect(result.text).toContain('[Image #1:');
      expect(result.text.match(/\[Image #1:/g)?.length).toBe(2);
    });

    it('handles direct file path as entire input', async () => {
      const result = await parseImageInput(testPngPath, process.cwd());

      expect(result.hasImages).toBe(true);
      expect(result.images).toHaveLength(1);
      expect(result.text).toContain('Please analyze this image');
    });

    it('handles relative path starting with ./', async () => {
      const relativePath = './' + path.relative(process.cwd(), testPngPath);
      const result = await parseImageInput(relativePath, process.cwd());

      expect(result.hasImages).toBe(true);
      expect(result.images).toHaveLength(1);
    });

    it('returns errors for non-existent images', async () => {
      const input = 'Analyze @nonexistent.png';
      const result = await parseImageInput(input, process.cwd());

      expect(result.hasImages).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('nonexistent.png');
    });

    it('handles input with no images', async () => {
      const input = 'Hello, how are you?';
      const result = await parseImageInput(input, process.cwd());

      expect(result.hasImages).toBe(false);
      expect(result.images).toHaveLength(0);
      expect(result.text).toBe(input);
      expect(result.errors).toHaveLength(0);
    });

    it('handles mixed text and image references', async () => {
      const relativePath = path.relative(process.cwd(), testPngPath);
      const input = `Here is some text before @${relativePath} and after`;
      const result = await parseImageInput(input, process.cwd());

      expect(result.hasImages).toBe(true);
      expect(result.text).toContain('Here is some text before');
      expect(result.text).toContain('and after');
      expect(result.text).toContain('[Image #1:');
    });

    it('handles inline quoted paths without @ prefix', async () => {
      const input = `'${testPngPath}' please analyze this image`;
      const result = await parseImageInput(input, process.cwd());

      expect(result.hasImages).toBe(true);
      expect(result.images).toHaveLength(1);
      expect(result.text).toContain('please analyze this image');
      expect(result.text).toContain('[Image #1:');
    });

    it('handles inline double-quoted paths without @ prefix', async () => {
      const input = `"${testPngPath}" what do you see?`;
      const result = await parseImageInput(input, process.cwd());

      expect(result.hasImages).toBe(true);
      expect(result.images).toHaveLength(1);
      expect(result.text).toContain('what do you see?');
    });

    it('handles inline quoted path with text before and after', async () => {
      const input = `Please analyze "${testPngPath}" and describe it`;
      const result = await parseImageInput(input, process.cwd());

      expect(result.hasImages).toBe(true);
      expect(result.text).toContain('Please analyze');
      expect(result.text).toContain('and describe it');
    });
  });

  describe('hasImageReferences', () => {
    it('returns true for @-prefixed image paths', () => {
      expect(hasImageReferences('Analyze @image.png')).toBe(true);
      expect(hasImageReferences('@screenshot.jpg')).toBe(true);
      expect(hasImageReferences('Text @path/to/image.gif more text')).toBe(true);
    });

    it('returns true for direct file paths', () => {
      expect(hasImageReferences('/path/to/image.png')).toBe(true);
      expect(hasImageReferences('./image.jpg')).toBe(true);
      expect(hasImageReferences('../images/photo.webp')).toBe(true);
    });

    it('returns true for Windows-style paths', () => {
      expect(hasImageReferences('C:\\Users\\image.png')).toBe(true);
      expect(hasImageReferences('D:/path/to/image.jpg')).toBe(true);
      expect(hasImageReferences('\\\\server\\share\\image.gif')).toBe(true);
    });

    it('returns true for quoted paths with spaces', () => {
      expect(hasImageReferences('"/path/with spaces/image.png"')).toBe(true);
      expect(hasImageReferences("'/path/with spaces/image.jpg'")).toBe(true);
      expect(hasImageReferences('@"/path/with spaces/file.png"')).toBe(true);
      expect(hasImageReferences("@'/path/with spaces/file.gif'")).toBe(true);
    });

    it('returns true for inline quoted paths without @ prefix', () => {
      expect(hasImageReferences("'/path/to/image.png' analyze this")).toBe(true);
      expect(hasImageReferences('"/path/to/image.jpg" what is this')).toBe(true);
      expect(hasImageReferences('Please check "/path/image.png" now')).toBe(true);
    });

    it('returns false for non-image content', () => {
      expect(hasImageReferences('Hello world')).toBe(false);
      expect(hasImageReferences('@user mention')).toBe(false);
      expect(hasImageReferences('/path/to/file.txt')).toBe(false);
    });
  });

  describe('buildMessageContent', () => {
    it('builds multimodal message content', async () => {
      const relativePath = path.relative(process.cwd(), testPngPath);
      const input = `Analyze @${relativePath}`;
      const parsed = await parseImageInput(input, process.cwd());
      const content = buildMessageContent(parsed);

      expect(content).toHaveLength(2);
      expect(content[0]).toEqual({ type: 'text', text: expect.any(String) });
      expect(content[1]).toEqual({
        type: 'image_url',
        image_url: { url: expect.stringMatching(/^data:image\/png;base64,/) },
      });
    });

    it('builds text-only content when no images', async () => {
      const parsed = await parseImageInput('Hello world', process.cwd());
      const content = buildMessageContent(parsed);

      expect(content).toHaveLength(1);
      expect(content[0]).toEqual({ type: 'text', text: 'Hello world' });
    });
  });

  describe('getImageHelpText', () => {
    it('returns help text with usage information', () => {
      const help = getImageHelpText();

      expect(help).toContain('Image Input Methods');
      expect(help).toContain('@path/to/image.png');
      expect(help).toContain('Supported formats');
      expect(help).toContain('glm-4.6v');
    });
  });

  describe('formatAttachmentForDisplay', () => {
    it('formats attachment for display', () => {
      const mockAttachment = {
        image: {
          format: 'png' as const,
          mimeType: 'image/png',
          dataUri: 'data:image/png;base64,mockdata',
          originalPath: '/path/to/image.png',
          sizeBytes: 1024,
        },
        preview: '[Image: image.png]',
        originalReference: '@image.png',
      };

      const formatted = formatAttachmentForDisplay(mockAttachment, 1);

      expect(formatted).toContain('1.');
      expect(formatted).toContain('[Image:');
      expect(formatted).toContain('1.0 KB');
      expect(formatted).toContain('1000 tokens');
    });
  });
});
