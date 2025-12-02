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

/** Shared image extension pattern */
const IMG_EXT = '(?:png|jpg|jpeg|gif|webp)';

/** Regex patterns (compiled once at module load) */
// @-prefixed: @path.png, @"path with spaces.png", @'path.png' (excludes URLs)
const AT_REF_PATTERN = new RegExp(
  `@((?!https?://|ftp://|file://|data:)[^\\s]+\\.${IMG_EXT}|"[^"]+\\.${IMG_EXT}"|'[^']+\\.${IMG_EXT}')`,
  'gi'
);
// Direct paths: /path.png, ./path.png, C:\path.png, \\server\path.png, "quoted.png"
const DIRECT_PATH_PATTERN = new RegExp(
  `^(/[^\\s]+\\.${IMG_EXT}|\\.\\.\?/[^\\s]+\\.${IMG_EXT}|[a-zA-Z]:[\\\\/][^\\s]+\\.${IMG_EXT}|\\\\\\\\[^\\s]+\\.${IMG_EXT}|"[^"]+\\.${IMG_EXT}"|'[^']+\\.${IMG_EXT}')$`,
  'i'
);
// Inline quoted: "path.png" or 'path.png' anywhere in text
const INLINE_QUOTED_PATH_PATTERN = new RegExp(
  `(?:^|(?<=\\s))("[^"]+\\.${IMG_EXT}"|'[^']+\\.${IMG_EXT}')`,
  'gi'
);

/** Strip surrounding quotes from a path */
function stripQuotes(p: string): string {
  if ((p.startsWith('"') && p.endsWith('"')) || (p.startsWith("'") && p.endsWith("'"))) {
    return p.slice(1, -1);
  }
  return p;
}

/** State for tracking processed images during parsing */
interface ParseState {
  images: ImageAttachment[];
  errors: string[];
  seenPaths: Set<string>;
  pathToIndex: Map<string, number>;
}

/**
 * Process a single image reference and update state
 * Returns the replacement text for the match, or null if error
 */
async function processImageRef(
  fullMatch: string,
  pathStr: string,
  workingDir: string,
  state: ParseState
): Promise<string> {
  const cleanPath = stripQuotes(pathStr);
  const name = path.basename(cleanPath);

  try {
    const image = await processImageFromPath(cleanPath, workingDir);
    const resolvedPath = image.originalPath;

    // Handle duplicate - reuse existing placeholder
    if (state.seenPaths.has(resolvedPath)) {
      const existingIndex = state.pathToIndex.get(resolvedPath)!;
      return `[Image #${existingIndex}: ${name}]`;
    }

    // New image - add to collection
    state.seenPaths.add(resolvedPath);
    state.images.push({ image, preview: `[Image: ${name}]`, originalReference: fullMatch });
    state.pathToIndex.set(resolvedPath, state.images.length);
    return `[Image #${state.images.length}: ${name}]`;
  } catch (error) {
    const msg = error instanceof ImageProcessingError ? error.message : 'Failed to process';
    state.errors.push(`${fullMatch}: ${msg}`);
    return fullMatch; // Keep original on error
  }
}

/** Parse user input for image references */
export async function parseImageInput(
  input: string,
  workingDir: string = process.cwd()
): Promise<ParsedImageInput> {
  const state: ParseState = {
    images: [],
    errors: [],
    seenPaths: new Set(),
    pathToIndex: new Map(),
  };
  let textContent = input;

  // Process @-prefixed image references
  for (const [fullMatch, relativePath] of input.matchAll(AT_REF_PATTERN)) {
    const replacement = await processImageRef(fullMatch, relativePath, workingDir, state);
    textContent = textContent.split(fullMatch).join(replacement);
  }

  // Process inline quoted paths (e.g., '/path/image.png' or "/path/image.png")
  for (const [fullMatch] of textContent.matchAll(INLINE_QUOTED_PATH_PATTERN)) {
    const replacement = await processImageRef(fullMatch, fullMatch.trim(), workingDir, state);
    textContent = textContent.split(fullMatch).join(replacement);
  }

  // Handle direct file path as entire input
  const trimmed = input.trim();
  if (!state.images.length && DIRECT_PATH_PATTERN.test(trimmed)) {
    const cleanPath = stripQuotes(trimmed);
    const name = path.basename(cleanPath);
    try {
      const image = await processImageFromPath(cleanPath, workingDir);
      state.images.push({ image, preview: `[Image: ${name}]`, originalReference: trimmed });
      textContent = `Please analyze this image: ${name}`;
    } catch (error) {
      const msg = error instanceof ImageProcessingError ? error.message : 'Failed to process image';
      state.errors.push(`${trimmed}: ${msg}`);
    }
  }

  return { text: textContent.trim(), images: state.images, errors: state.errors, hasImages: state.images.length > 0 };
}

/** Check if input contains image references (quick check using main patterns) */
export function hasImageReferences(input: string): boolean {
  // Reset lastIndex for global patterns before testing
  AT_REF_PATTERN.lastIndex = 0;
  INLINE_QUOTED_PATH_PATTERN.lastIndex = 0;
  return AT_REF_PATTERN.test(input) || DIRECT_PATH_PATTERN.test(input.trim()) || INLINE_QUOTED_PATH_PATTERN.test(input);
}

/** Build multimodal message content from parsed input */
export function buildMessageContent(parsed: ParsedImageInput): MessageContentPart[] {
  const text = parsed.text.trim();
  const parts: MessageContentPart[] = [];

  if (text) parts.push({ type: 'text', text });
  for (const a of parsed.images) {
    parts.push({ type: 'image_url', image_url: { url: a.image.dataUri } });
  }

  return parts.length ? parts : [{ type: 'text', text: 'Please analyze the provided content.' }];
}

/** Help text (static) */
const HELP_TEXT = `Image Input Methods:
  @path/to/image.png      - Reference image with @ prefix
  @"path with spaces.png" - Quoted path for names with spaces
  /absolute/path.png      - Direct absolute path
  "./path with spaces.png" - Quoted direct path

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

