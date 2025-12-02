/**
 * Image Processing Utility for AX-CLI
 * Handles image reading, format detection, and base64 encoding for multimodal AI.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { TOKEN_CONFIG } from '../constants.js';

// Constants
export const SUPPORTED_IMAGE_FORMATS = ['png', 'jpg', 'jpeg', 'gif', 'webp'] as const;
export type SupportedImageFormat = (typeof SUPPORTED_IMAGE_FORMATS)[number];
export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
export const TOKENS_PER_IMAGE = TOKEN_CONFIG.TOKENS_PER_IMAGE;

/** Processed image data ready for API */
export interface ProcessedImage {
  format: SupportedImageFormat;
  mimeType: string;
  dataUri: string;
  originalPath: string;
  sizeBytes: number;
}

/** Image processing error with error code */
export class ImageProcessingError extends Error {
  constructor(
    message: string,
    public readonly code: 'FILE_NOT_FOUND' | 'FILE_TOO_LARGE' | 'UNSUPPORTED_FORMAT' | 'READ_ERROR'
  ) {
    super(message);
    this.name = 'ImageProcessingError';
  }
}

// Format detection data
const MAGIC_BYTES: Record<string, number[]> = {
  png: [0x89, 0x50, 0x4e, 0x47],
  jpg: [0xff, 0xd8, 0xff],
  gif: [0x47, 0x49, 0x46],
  webp: [0x52, 0x49, 0x46, 0x46],
};

const MIME_TYPES: Record<SupportedImageFormat, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
};

/** Detect image format from buffer magic bytes */
export function detectFormat(buffer: Buffer): SupportedImageFormat | null {
  if (buffer.length < 12) return null;

  for (const [format, bytes] of Object.entries(MAGIC_BYTES)) {
    if (bytes.every((byte, i) => buffer[i] === byte)) {
      if (format === 'webp' && buffer.slice(8, 12).toString('ascii') !== 'WEBP') continue;
      return format as SupportedImageFormat;
    }
  }
  return null;
}

/** Check if file path has an image extension */
export function isImagePath(filePath: string): boolean {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  return SUPPORTED_IMAGE_FORMATS.includes(ext as SupportedImageFormat);
}

/** Format bytes for display (e.g., "1.5 MB") */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Process image from file path */
export async function processImageFromPath(
  filePath: string,
  basePath: string = process.cwd()
): Promise<ProcessedImage> {
  if (filePath.includes('\0')) throw new ImageProcessingError('Invalid file path', 'FILE_NOT_FOUND');

  const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(basePath, filePath);

  let realPath: string;
  try {
    realPath = await fs.realpath(path.normalize(absolutePath));
  } catch {
    throw new ImageProcessingError(`Image not found: ${filePath}`, 'FILE_NOT_FOUND');
  }

  // Security: only check path traversal for relative paths
  // Absolute paths are explicitly provided by the user, so trust them
  if (!path.isAbsolute(filePath)) {
    let realBase: string;
    try {
      realBase = await fs.realpath(path.normalize(basePath));
    } catch {
      throw new ImageProcessingError('Access denied: invalid base directory', 'FILE_NOT_FOUND');
    }
    const baseWithSep = realBase.endsWith(path.sep) ? realBase : realBase + path.sep;
    if (!realPath.startsWith(baseWithSep) && realPath !== realBase) {
      throw new ImageProcessingError('Access denied: path outside working directory', 'FILE_NOT_FOUND');
    }
  }

  let buffer: Buffer;
  try {
    buffer = await fs.readFile(realPath);
  } catch {
    throw new ImageProcessingError(`Failed to read: ${filePath}`, 'READ_ERROR');
  }

  if (buffer.length === 0) {
    throw new ImageProcessingError('Image file is empty', 'READ_ERROR');
  }
  if (buffer.length > MAX_IMAGE_SIZE_BYTES) {
    throw new ImageProcessingError(
      `Image too large (${formatBytes(buffer.length)}). Max: ${formatBytes(MAX_IMAGE_SIZE_BYTES)}`,
      'FILE_TOO_LARGE'
    );
  }

  // Detect format: magic bytes first, then extension
  let format = detectFormat(buffer);
  if (!format) {
    const ext = path.extname(realPath).slice(1).toLowerCase() as SupportedImageFormat;
    if (!SUPPORTED_IMAGE_FORMATS.includes(ext)) {
      throw new ImageProcessingError(`Unsupported format. Use: ${SUPPORTED_IMAGE_FORMATS.join(', ')}`, 'UNSUPPORTED_FORMAT');
    }
    format = ext;
  }

  const mimeType = MIME_TYPES[format];
  return {
    format,
    mimeType,
    dataUri: `data:${mimeType};base64,${buffer.toString('base64')}`,
    originalPath: realPath,
    sizeBytes: buffer.length,
  };
}

// Legacy class wrapper
export class ImageProcessor {
  static detectFormat = detectFormat;
  static isImagePath = isImagePath;
  static formatBytes = formatBytes;
  static processFromPath = processImageFromPath;
  static getMimeType = (f: SupportedImageFormat) => MIME_TYPES[f];
  static isSupportedFormat = (ext: string) => SUPPORTED_IMAGE_FORMATS.includes(ext.replace(/^\./, '').toLowerCase() as SupportedImageFormat);
  static getMaxSizeBytes = () => MAX_IMAGE_SIZE_BYTES;
  static getEstimatedTokens = () => TOKENS_PER_IMAGE;
}
