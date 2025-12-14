/**
 * API Key Encryption Utilities
 *
 * Provides secure encryption/decryption for API keys stored in configuration
 * files (REQ-SEC-003).
 *
 * Uses Node.js crypto module with:
 * - AES-256-GCM for encryption (authenticated encryption)
 * - PBKDF2 for key derivation from machine-specific identifier
 * - Random IV for each encryption
 * - Authentication tag verification
 *
 * SECURITY NOTE:
 * This encryption protects against casual browsing and accidental exposure.
 * It is NOT designed to protect against determined attackers with machine access.
 * See README.md "Security & API Key Handling" section for full threat model and best practices.
 *
 * @module encryption
 */

import crypto from 'crypto';
import os from 'os';
import { extractErrorMessage } from './error-handler.js';

/**
 * Encrypted value format
 * SECURITY FIX: Salt now stored separately to maintain full entropy
 */
export interface EncryptedValue {
  encrypted: string; // Base64-encoded encrypted data
  iv: string; // Base64-encoded initialization vector
  salt: string; // Base64-encoded salt (stored separately for security)
  tag: string; // Base64-encoded authentication tag
  version: number; // Encryption version for future upgrades
}

/**
 * Encryption configuration
 */
const ENCRYPTION_CONFIG = {
  algorithm: 'aes-256-gcm' as const,
  keyLength: 32, // 256 bits
  ivLength: 16, // 128 bits
  saltLength: 32, // 256 bits
  tagLength: 16, // 128 bits
  pbkdf2Iterations: 600000, // OWASP 2024 recommendation (updated from 100000)
  version: 1,
};

/**
 * Legacy PBKDF2 iteration count for backward compatibility.
 * Used to decrypt API keys encrypted with older versions.
 */
const LEGACY_PBKDF2_ITERATIONS = 100000;

/**
 * Validate and decode a base64 string to Buffer.
 * Fails closed: returns null for invalid/malformed input.
 *
 * SECURITY FIX: Validates both format and expected length to prevent
 * crashes from tampered config files supplying malformed buffers.
 *
 * @param value - Base64-encoded string to validate
 * @param expectedLength - Expected decoded byte length
 * @param fieldName - Field name for error messages
 * @returns Decoded buffer or null if invalid
 */
function validateBase64Field(
  value: unknown,
  expectedLength: number,
  fieldName: string
): Buffer | null {
  // Check if value is a string
  if (typeof value !== 'string') {
    if (process.env.DEBUG || process.env.AX_DEBUG) {
      console.error(`[DEBUG] ${fieldName}: expected string, got ${typeof value}`);
    }
    return null;
  }

  // Check for valid base64 format (only base64 chars and valid padding)
  // Base64 alphabet: A-Z, a-z, 0-9, +, /
  // Valid padding: ends with 0-2 '=' characters
  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
  if (!base64Regex.test(value)) {
    if (process.env.DEBUG || process.env.AX_DEBUG) {
      console.error(`[DEBUG] ${fieldName}: invalid base64 format`);
    }
    return null;
  }

  // Check expected base64 length (base64 encodes 3 bytes as 4 chars)
  // expectedLength bytes = ceil(expectedLength * 4 / 3) chars (with padding)
  const expectedBase64Length = Math.ceil(expectedLength * 4 / 3);
  // Account for padding making it a multiple of 4
  const paddedLength = Math.ceil(expectedBase64Length / 4) * 4;

  if (value.length !== paddedLength) {
    if (process.env.DEBUG || process.env.AX_DEBUG) {
      console.error(`[DEBUG] ${fieldName}: expected ${paddedLength} chars, got ${value.length}`);
    }
    return null;
  }

  try {
    const buffer = Buffer.from(value, 'base64');

    // Verify decoded length matches expectation
    if (buffer.length !== expectedLength) {
      if (process.env.DEBUG || process.env.AX_DEBUG) {
        console.error(`[DEBUG] ${fieldName}: decoded to ${buffer.length} bytes, expected ${expectedLength}`);
      }
      return null;
    }

    return buffer;
  } catch {
    if (process.env.DEBUG || process.env.AX_DEBUG) {
      console.error(`[DEBUG] ${fieldName}: failed to decode base64`);
    }
    return null;
  }
}

/**
 * Get a machine-specific identifier for key derivation.
 * Uses hostname + platform + arch to create a unique-per-machine string.
 *
 * Note: This is not cryptographically strong protection (attacker with file
 * access can derive the key), but it prevents casual browsing of config files
 * and provides defense in depth.
 */
function getMachineIdentifier(): string {
  const hostname = os.hostname();
  const platform = os.platform();
  const arch = os.arch();

  // Combine machine-specific data
  return `${hostname}-${platform}-${arch}`;
}

/**
 * Derive an encryption key from machine identifier and salt using PBKDF2.
 *
 * @param salt - Salt for key derivation
 * @param iterations - Optional iteration count (defaults to current config)
 * @returns Derived encryption key
 */
function deriveKey(salt: Buffer, iterations?: number): Buffer {
  const machineId = getMachineIdentifier();

  return crypto.pbkdf2Sync(
    machineId,
    salt,
    iterations ?? ENCRYPTION_CONFIG.pbkdf2Iterations,
    ENCRYPTION_CONFIG.keyLength,
    'sha256'
  );
}

/**
 * Encrypt a string value (typically an API key).
 *
 * @param plaintext - The value to encrypt
 * @returns Encrypted value object with iv, tag, and encrypted data
 */
export function encrypt(plaintext: string): EncryptedValue {
  // Generate random salt and IV
  const salt = crypto.randomBytes(ENCRYPTION_CONFIG.saltLength);
  const iv = crypto.randomBytes(ENCRYPTION_CONFIG.ivLength);

  // Derive key from machine identifier
  const key = deriveKey(salt);

  // Create cipher
  const cipher = crypto.createCipheriv(
    ENCRYPTION_CONFIG.algorithm,
    key,
    iv
  );

  // Encrypt the plaintext
  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  // Get authentication tag
  const tag = cipher.getAuthTag();

  // SECURITY FIX: Store salt separately to maintain full entropy
  // Concatenating salt with IV reduces effective entropy and enables rainbow table attacks
  return {
    encrypted,
    iv: iv.toString('base64'),
    salt: salt.toString('base64'), // Store separately
    tag: tag.toString('base64'),
    version: ENCRYPTION_CONFIG.version,
  };
}

/**
 * Internal decryption helper that performs the actual decryption.
 * Separated to allow retrying with different PBKDF2 iteration counts.
 *
 * @param encryptedValue - The encrypted value object
 * @param iterations - PBKDF2 iteration count to use
 * @returns Decrypted plaintext
 * @throws Error if decryption fails
 */
function decryptWithIterations(encryptedValue: EncryptedValue, iterations: number): string {
  // Check version
  if (encryptedValue.version !== ENCRYPTION_CONFIG.version) {
    throw new Error(
      `Unsupported encryption version: ${encryptedValue.version}`
    );
  }

  // SECURITY FIX: Validate all base64 fields before processing
  // Prevents crashes from tampered config files with malformed buffers

  // Validate authentication tag first (fastest check)
  const tag = validateBase64Field(
    encryptedValue.tag,
    ENCRYPTION_CONFIG.tagLength,
    'tag'
  );
  if (!tag) {
    throw new Error('Invalid encrypted data: malformed tag');
  }

  // SECURITY FIX: Support both old format (salt+IV concatenated) and new format (separate fields)
  // This maintains backward compatibility while improving security
  let salt: Buffer;
  let iv: Buffer;

  if ('salt' in encryptedValue && encryptedValue.salt) {
    // New format: salt stored separately (more secure)
    const validatedSalt = validateBase64Field(
      encryptedValue.salt,
      ENCRYPTION_CONFIG.saltLength,
      'salt'
    );
    const validatedIv = validateBase64Field(
      encryptedValue.iv,
      ENCRYPTION_CONFIG.ivLength,
      'iv'
    );

    if (!validatedSalt || !validatedIv) {
      throw new Error('Invalid encrypted data: malformed salt or iv');
    }

    salt = validatedSalt;
    iv = validatedIv;
  } else {
    // Old format: salt and IV concatenated (legacy support)
    const saltAndIv = validateBase64Field(
      encryptedValue.iv,
      ENCRYPTION_CONFIG.saltLength + ENCRYPTION_CONFIG.ivLength,
      'salt+iv'
    );

    if (!saltAndIv) {
      throw new Error('Invalid encrypted data: malformed salt/iv');
    }

    salt = saltAndIv.subarray(0, ENCRYPTION_CONFIG.saltLength);
    iv = saltAndIv.subarray(ENCRYPTION_CONFIG.saltLength);
  }

  // Derive key from machine identifier with specified iteration count
  const key = deriveKey(salt, iterations);

  // Create decipher
  const decipher = crypto.createDecipheriv(
    ENCRYPTION_CONFIG.algorithm,
    key,
    iv
  );

  // Set authentication tag
  decipher.setAuthTag(tag);

  // Decrypt
  let decrypted = decipher.update(encryptedValue.encrypted, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Decrypt an encrypted value.
 *
 * Supports backward compatibility with API keys encrypted using older
 * PBKDF2 iteration counts (100000 → 600000 migration).
 *
 * @param encryptedValue - The encrypted value object
 * @returns Decrypted plaintext
 * @throws Error if decryption fails (wrong machine, corrupted data, etc.)
 */
export function decrypt(encryptedValue: EncryptedValue): string {
  // Try current iteration count first (600000)
  try {
    return decryptWithIterations(encryptedValue, ENCRYPTION_CONFIG.pbkdf2Iterations);
  } catch (currentError) {
    if (process.env.DEBUG || process.env.AX_DEBUG) {
      console.error('[DEBUG] Decryption with current iterations failed, trying legacy...');
    }

    // Try legacy iteration count (100000) for backward compatibility
    try {
      const decrypted = decryptWithIterations(encryptedValue, LEGACY_PBKDF2_ITERATIONS);

      if (process.env.DEBUG || process.env.AX_DEBUG) {
        console.error('[DEBUG] Decryption succeeded with legacy iterations');
      }

      return decrypted;
    } catch (legacyError) {
      // Both attempts failed - log detailed error only in debug mode
      if (process.env.DEBUG || process.env.AX_DEBUG) {
        console.error('[DEBUG] Decryption error (current):', currentError);
        console.error('[DEBUG] Decryption error (legacy):', legacyError);
      }

      // Generic error message without revealing encryption implementation details
      throw new Error(
        'Failed to decrypt API key. ' +
        'Please check your configuration or re-enter your API key.'
      );
    }
  }
}

/**
 * Check if a value is encrypted (has the expected structure).
 * SECURITY FIX: Use constant-time comparison to prevent timing attacks
 *
 * @param value - Value to check
 * @returns True if value appears to be encrypted
 */
export function isEncrypted(value: unknown): value is EncryptedValue {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as any;

  // SECURITY FIX: Perform all checks without short-circuiting to prevent timing attacks
  // Timing attacks could reveal which fields are encrypted by measuring execution time
  const hasEncrypted = typeof obj.encrypted === 'string';
  const hasIv = typeof obj.iv === 'string';
  const hasTag = typeof obj.tag === 'string';
  const hasVersion = typeof obj.version === 'number';

  // Use bitwise AND instead of logical AND to prevent short-circuit evaluation
  // This ensures constant-time execution regardless of which fields are present
  // Convert booleans to numbers (0 or 1) for bitwise operations
  return !!((hasEncrypted ? 1 : 0) & (hasIv ? 1 : 0) & (hasTag ? 1 : 0) & (hasVersion ? 1 : 0));
}

/**
 * Encrypt an object's sensitive fields.
 *
 * @param obj - Object containing sensitive fields
 * @param fieldsToEncrypt - Array of field names to encrypt
 * @returns New object with encrypted fields
 */
export function encryptFields<T extends Record<string, any>>(
  obj: T,
  fieldsToEncrypt: string[]
): T {
  const result: Record<string, any> = { ...obj };

  for (const field of fieldsToEncrypt) {
    if (field in result && typeof result[field] === 'string') {
      // Don't re-encrypt already encrypted values
      if (!isEncrypted(result[field])) {
        result[field] = encrypt(result[field]);
      }
    }
  }

  return result as T;
}

/**
 * Decrypt an object's encrypted fields.
 *
 * @param obj - Object containing encrypted fields
 * @param fieldsToDecrypt - Array of field names to decrypt
 * @returns New object with decrypted fields
 */
export function decryptFields<T extends Record<string, any>>(
  obj: T,
  fieldsToDecrypt: string[]
): T {
  const result: Record<string, any> = { ...obj };

  for (const field of fieldsToDecrypt) {
    if (field in result && isEncrypted(result[field])) {
      try {
        result[field] = decrypt(result[field]);
      } catch (error) {
        // If decryption fails, leave the field as-is and let caller handle it
        console.error(`Failed to decrypt field "${field}":`, extractErrorMessage(error));
      }
    }
  }

  return result as T;
}

/**
 * Test if encryption is working (for diagnostics).
 *
 * @returns True if encryption/decryption round-trip works
 */
export function testEncryption(): boolean {
  try {
    const testValue = 'test-api-key-12345';
    const encrypted = encrypt(testValue);
    const decrypted = decrypt(encrypted);
    return decrypted === testValue;
  } catch {
    return false;
  }
}

/**
 * Get encryption info for diagnostics.
 *
 * SECURITY FIX: machineId is no longer exposed to prevent key derivation attacks.
 * The machineId hash is provided instead for debugging purposes only.
 */
export function getEncryptionInfo(): {
  algorithm: string;
  keyLength: number;
  ivLength: number;
  pbkdf2Iterations: number;
  version: number;
  machineIdHash: string;
} {
  // SECURITY FIX: Hash the machine ID instead of exposing it directly
  // This prevents attackers from using exposed diagnostics to derive encryption keys
  const machineId = getMachineIdentifier();
  const hash = crypto.createHash('sha256').update(machineId).digest('hex').substring(0, 16);

  return {
    algorithm: ENCRYPTION_CONFIG.algorithm,
    keyLength: ENCRYPTION_CONFIG.keyLength,
    ivLength: ENCRYPTION_CONFIG.ivLength,
    pbkdf2Iterations: ENCRYPTION_CONFIG.pbkdf2Iterations,
    version: ENCRYPTION_CONFIG.version,
    machineIdHash: hash, // Only expose a truncated hash for debugging
  };
}
