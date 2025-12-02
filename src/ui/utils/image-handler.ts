/**
 * Image Input Handler - Parses @path references for multimodal API requests.
 * Supports: @path/to/image.png, /absolute/path.png, ./relative/path.png
 */

import * as path from 'path';
import {
  processImageFromPath,
  formatBytes,
  ProcessedImage,
  ImageProcessingError,
  SUPPORTED_IMAGE_FORMATS,
  MAX_IMAGE_SIZE_BYTES,
  TOKENS_PER_IMAGE,
} from '../../utils/image-processor.js';
import type { MessageContentPart } from '../../llm/types.js';

/** Image attachment with metadata for UI display */
export interface ImageAttachment {
  image: ProcessedImage;
  preview: string;
  originalReference: string;
}

/** Result of parsing user input for images */
export interface ParsedImageInput {
  text: string;
  images: ImageAttachment[];
  errors: string[];
  hasImages: boolean;
}

/** Regex patterns (compiled once at module load) */
// Exclude URLs (http://, https://, file://, ftp://, data:) from @ references
const AT_REF_PATTERN = /@((?!https?:\/\/|ftp:\/\/|file:\/\/|data:)[^\s]+\.(png|jpg|jpeg|gif|webp))/gi;
// Supports Unix (/path), relative (./path, ../path), and Windows (C:\path, D:/path)
const DIRECT_PATH_PATTERN = /^(\/[^\s]+\.(png|jpg|jpeg|gif|webp)|\.\.?\/[^\s]+\.(png|jpg|jpeg|gif|webp)|[a-zA-Z]:[\\/][^\s]+\.(png|jpg|jpeg|gif|webp))$/i;

/** Parse user input for image references */
export async function parseImageInput(
  input: string,
  workingDir: string = process.cwd()
): Promise<ParsedImageInput> {
  const images: ImageAttachment[] = [];
  const errors: string[] = [];
  let textContent = input;
  const seenPaths = new Set<string>(); // Track by resolved path to avoid duplicates
  const pathToIndex = new Map<string, number>(); // Map resolved path to image index

  for (const [fullMatch, relativePath] of input.matchAll(AT_REF_PATTERN)) {
    try {
      const image = await processImageFromPath(relativePath, workingDir);
      const resolvedPath = image.originalPath;

      if (seenPaths.has(resolvedPath)) {
        // Same file referenced differently - reuse existing placeholder
        const existingIndex = pathToIndex.get(resolvedPath)!;
        const name = path.basename(relativePath);
        textContent = textContent.split(fullMatch).join(`[Image #${existingIndex}: ${name}]`);
        continue;
      }

      seenPaths.add(resolvedPath);
      const name = path.basename(relativePath);
      images.push({ image, preview: `[Image: ${name}]`, originalReference: fullMatch });
      pathToIndex.set(resolvedPath, images.length);
      textContent = textContent.split(fullMatch).join(`[Image #${images.length}: ${name}]`);
    } catch (error) {
      errors.push(`${fullMatch}: ${error instanceof ImageProcessingError ? error.message : 'Failed to process'}`);
    }
  }

  // Handle direct file path as entire input
  const trimmed = input.trim();
  if (!images.length && DIRECT_PATH_PATTERN.test(trimmed)) {
    try {
      const image = await processImageFromPath(trimmed, workingDir);
      const name = path.basename(trimmed);
      images.push({ image, preview: `[Image: ${name}]`, originalReference: trimmed });
      textContent = `Please analyze this image: ${name}`;
    } catch (error) {
      errors.push(error instanceof ImageProcessingError ? error.message : 'Failed to process image');
    }
  }

  return { text: textContent.trim(), images, errors, hasImages: images.length > 0 };
}

const AT_REF_CHECK = /@(?!https?:\/\/|ftp:\/\/|file:\/\/|data:)[^\s]+\.(png|jpg|jpeg|gif|webp)/i;

/** Check if input contains image references (quick check) */
export function hasImageReferences(input: string): boolean {
  return AT_REF_CHECK.test(input) || DIRECT_PATH_PATTERN.test(input.trim());
}

/** Build multimodal message content from parsed input */
export function buildMessageContent(parsed: ParsedImageInput): MessageContentPart[] {
  const text = parsed.text.trim();
  const textPart: MessageContentPart[] = text ? [{ type: 'text', text }] : [];
  const imageParts: MessageContentPart[] = parsed.images.map(a => ({
    type: 'image_url',
    image_url: { url: a.image.dataUri },
  }));

  const content = [...textPart, ...imageParts];
  return content.length ? content : [{ type: 'text', text: 'Please analyze the provided content.' }];
}

/** Help text (static) */
const HELP_TEXT = `Image Input Methods:
  @path/to/image.png  - Reference image with @ prefix
  /absolute/path.png  - Direct absolute path
  ./relative/path.png - Direct relative path

Supported formats: ${SUPPORTED_IMAGE_FORMATS.join(', ')}
Maximum size: ${formatBytes(MAX_IMAGE_SIZE_BYTES)}

Note: Images require glm-4.5v model (auto-switched)`;

/** Get help text for image input */
export function getImageHelpText(): string {
  return HELP_TEXT;
}

/** Format image attachment for display in chat */
export function formatAttachmentForDisplay(attachment: ImageAttachment, index: number): string {
  return `  ${index}. ${attachment.preview} (${formatBytes(attachment.image.sizeBytes)}, ~${TOKENS_PER_IMAGE} tokens)`;
}

// Legacy class wrapper for backward compatibility
export class ImageInputHandler {
  static parseInput = parseImageInput;
  static hasImageReferences = hasImageReferences;
  static buildMessageContent = buildMessageContent;
  static getHelpText = getImageHelpText;
  static formatAttachmentForDisplay = formatAttachmentForDisplay;
}
