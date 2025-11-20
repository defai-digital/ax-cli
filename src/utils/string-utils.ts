/**
 * Case-insensitive string comparison utilities
 */

/**
 * Check if a string equals another string (case-insensitive)
 */
export function equalsIgnoreCase(str1: string, str2: string): boolean {
  return str1.toLowerCase() === str2.toLowerCase();
}

/**
 * Check if a string contains another string (case-insensitive)
 */
export function containsIgnoreCase(text: string, searchString: string): boolean {
  return text.toLowerCase().includes(searchString.toLowerCase());
}

/**
 * Check if a string starts with a prefix (case-insensitive)
 */
export function startsWithIgnoreCase(text: string, prefix: string): boolean {
  return text.toLowerCase().startsWith(prefix.toLowerCase());
}

/**
 * Check if a string ends with a suffix (case-insensitive)
 */
export function endsWithIgnoreCase(text: string, suffix: string): boolean {
  return text.toLowerCase().endsWith(suffix.toLowerCase());
}
