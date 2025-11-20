import type { ToolResult } from "../types/index.js";

/**
 * Execute a tool operation with standardized error handling
 *
 * @param operation - The async operation to execute
 * @param context - Context string for error messages (e.g., "View file", "Execute bash")
 * @returns ToolResult with success/failure status
 *
 * @example
 * ```typescript
 * return executeTool(async () => {
 *   const content = await fs.readFile(path, 'utf-8');
 *   return `File contents: ${content}`;
 * }, `View ${path}`);
 * ```
 */
export async function executeTool<T>(
  operation: () => Promise<T>,
  context: string
): Promise<ToolResult> {
  try {
    const result = await operation();
    let output: string;
    if (typeof result === 'string') {
      output = result;
    } else {
      try {
        output = JSON.stringify(result);
      } catch {
        // Fallback for circular references or non-serializable values
        output = String(result);
      }
    }
    return {
      success: true,
      output
    };
  } catch (error: any) {
    return {
      success: false,
      error: `${context}: ${error.message}`
    };
  }
}

/**
 * Execute a tool operation synchronously with standardized error handling
 *
 * @param operation - The sync operation to execute
 * @param context - Context string for error messages
 * @returns ToolResult with success/failure status
 */
export function executeToolSync<T>(
  operation: () => T,
  context: string
): ToolResult {
  try {
    const result = operation();
    let output: string;
    if (typeof result === 'string') {
      output = result;
    } else {
      try {
        output = JSON.stringify(result);
      } catch {
        // Fallback for circular references or non-serializable values
        output = String(result);
      }
    }
    return {
      success: true,
      output
    };
  } catch (error: any) {
    return {
      success: false,
      error: `${context}: ${error.message}`
    };
  }
}
