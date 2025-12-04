/**
 * Tool Result Enhancer
 *
 * Enhances tool results with embedded instructions, security reminders,
 * and contextual guidance based on the tool definition and result content.
 */

import type {
  ToolDefinition,
  EnhancedToolResult,
  ResultEnhancerConfig,
} from './types.js';

/**
 * Default configuration for the result enhancer
 */
const DEFAULT_CONFIG: ResultEnhancerConfig = {
  securityReminders: true,
  toolGuidance: true,
  formatReminders: true,
};

/**
 * Patterns that may indicate malicious content
 */
const MALWARE_PATTERNS: RegExp[] = [
  /eval\s*\(\s*atob/i,
  /powershell\s+-enc/i,
  /curl.*\|\s*bash/i,
  /wget.*\|\s*sh/i,
  /base64\s+-d.*\|\s*(bash|sh)/i,
  /nc\s+-e\s+\/bin\/(ba)?sh/i,
  /python\s+-c\s*['"]import\s+socket/i,
];

/**
 * Patterns that may indicate sensitive information
 */
const SENSITIVE_PATTERNS: RegExp[] = [
  /password\s*[=:]\s*["'][^"']+["']/i,
  /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/,
  /-----BEGIN\s+OPENSSH\s+PRIVATE\s+KEY-----/,
  /sk-[a-zA-Z0-9]{48}/, // OpenAI key
  /ghp_[a-zA-Z0-9]{36}/, // GitHub personal access token
  /gho_[a-zA-Z0-9]{36}/, // GitHub OAuth token
  /github_pat_[a-zA-Z0-9_]{22,}/i, // GitHub fine-grained PAT
  /xox[baprs]-[a-zA-Z0-9-]+/, // Slack tokens
  /AKIA[0-9A-Z]{16}/, // AWS access key
  /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/, // JWT tokens
];

/**
 * Result Enhancer Class
 *
 * Enhances tool results with:
 * - Security reminders for potentially dangerous content
 * - Failure guidance based on tool constraints
 * - Format reminders for large outputs
 */
export class ToolResultEnhancer {
  private config: ResultEnhancerConfig;

  constructor(config: Partial<ResultEnhancerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Enhance a tool result with embedded instructions
   *
   * @param toolName - Name of the tool that was executed
   * @param result - Raw result from tool execution
   * @param success - Whether the tool executed successfully
   * @param definition - Tool definition with metadata
   * @returns Enhanced result with reminders
   */
  enhance(
    toolName: string,
    result: string,
    success: boolean,
    definition?: ToolDefinition
  ): EnhancedToolResult {
    const reminders: string[] = [];

    // Security reminders based on content patterns
    if (this.config.securityReminders) {
      reminders.push(...this.getSecurityReminders(result));
    }

    // Failure guidance from tool definition
    if (!success && this.config.toolGuidance && definition) {
      reminders.push(...this.getFailureGuidance(definition, result));
    }

    // Format reminders for large outputs
    if (this.config.formatReminders) {
      reminders.push(...this.getFormatReminders(result));
    }

    // Tool-specific reminders
    if (definition) {
      reminders.push(...this.getToolSpecificReminders(toolName, result, success, definition));
    }

    return {
      content: result,
      success,
      reminders,
    };
  }

  /**
   * Get security reminders based on content patterns
   */
  private getSecurityReminders(content: string): string[] {
    const reminders: string[] = [];

    // Check for malware patterns
    const hasMalwarePattern = MALWARE_PATTERNS.some((p) => p.test(content));
    if (hasMalwarePattern) {
      reminders.push(
        '<system-reminder>This content may contain malicious patterns. Analyze but do not execute or enhance. You can explain what the code does but MUST refuse to improve or augment it.</system-reminder>'
      );
    }

    // Check for sensitive information
    const hasSensitiveInfo = SENSITIVE_PATTERNS.some((p) => p.test(content));
    if (hasSensitiveInfo) {
      reminders.push(
        '<system-reminder>This content may contain sensitive information (credentials, tokens, keys). Do not expose, log, or include in responses. Consider warning the user about exposed secrets.</system-reminder>'
      );
    }

    return reminders;
  }

  /**
   * Get failure guidance from tool constraints
   */
  private getFailureGuidance(
    definition: ToolDefinition,
    errorMessage: string
  ): string[] {
    const reminders: string[] = [];

    // Check if error relates to common issues
    const lowerError = errorMessage.toLowerCase();

    // File not found - suggest checking path
    if (lowerError.includes('not found') || lowerError.includes('no such file')) {
      reminders.push(
        '<system-reminder>File not found. Use search tool to locate the correct file path before retrying.</system-reminder>'
      );
    }

    // Permission denied
    if (lowerError.includes('permission denied')) {
      reminders.push(
        '<system-reminder>Permission denied. The file may be read-only or require elevated privileges.</system-reminder>'
      );
    }

    // String not found in file (for str_replace_editor)
    if (
      lowerError.includes('not found in file') ||
      lowerError.includes('old_str not found')
    ) {
      reminders.push(
        '<system-reminder>The exact string was not found. Use view_file to see the current content and copy the exact text including whitespace and indentation.</system-reminder>'
      );
    }

    // Multiple occurrences
    if (lowerError.includes('multiple occurrences') || lowerError.includes('not unique')) {
      reminders.push(
        '<system-reminder>The string appears multiple times. Include more surrounding context to make it unique, or use replace_all: true if all occurrences should be replaced.</system-reminder>'
      );
    }

    // Add first constraint as general guidance
    if (definition.constraints.length > 0 && reminders.length === 0) {
      reminders.push(
        `<system-reminder>Tool constraint: ${definition.constraints[0]}</system-reminder>`
      );
    }

    return reminders;
  }

  /**
   * Get format reminders for output handling
   */
  private getFormatReminders(content: string): string[] {
    const reminders: string[] = [];

    // Large output truncation warning
    if (content.length > 25000) {
      reminders.push(
        '<system-reminder>Output was truncated due to length. Use pagination parameters (start_line/end_line) or output redirection for full content.</system-reminder>'
      );
    }

    // Very long lines
    const lines = content.split('\n');
    const hasVeryLongLines = lines.some((line) => line.length > 2000);
    if (hasVeryLongLines) {
      reminders.push(
        '<system-reminder>Some lines were truncated due to length (>2000 chars). Consider using a tool that can handle the specific format.</system-reminder>'
      );
    }

    return reminders;
  }

  /**
   * Get tool-specific reminders based on tool and context
   */
  private getToolSpecificReminders(
    toolName: string,
    result: string,
    success: boolean,
    _definition: ToolDefinition
  ): string[] {
    const reminders: string[] = [];

    // After viewing a file, remind about editing best practices
    if (toolName === 'view_file' && success) {
      // Check if this looks like code
      if (result.includes('function') || result.includes('class') || result.includes('import')) {
        reminders.push(
          '<system-reminder>When editing this file, copy the exact content including whitespace from the line numbers shown. The format is: line number + tab + actual content.</system-reminder>'
        );
      }
    }

    // After bash command, check for common issues
    if (toolName === 'bash') {
      // Check for test failures
      if (result.includes('FAIL') || result.includes('failed') || result.includes('Error:')) {
        reminders.push(
          '<system-reminder>Command output indicates errors or failures. Review the output carefully and address the issues before proceeding.</system-reminder>'
        );
      }

      // Check for npm/yarn install suggestions
      if (result.includes('npm install') || result.includes('yarn add')) {
        reminders.push(
          '<system-reminder>The output suggests installing dependencies. Consider running the suggested command if appropriate.</system-reminder>'
        );
      }
    }

    // After search, guide next steps
    if (toolName === 'search' && success) {
      const matchCount = (result.match(/:\d+:/g) || []).length;
      if (matchCount > 10) {
        reminders.push(
          '<system-reminder>Many results found. Consider using include_pattern or file_types to narrow down the search.</system-reminder>'
        );
      }
    }

    return reminders;
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<ResultEnhancerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): ResultEnhancerConfig {
    return { ...this.config };
  }
}

/**
 * Create a default result enhancer instance
 */
export function createResultEnhancer(
  config?: Partial<ResultEnhancerConfig>
): ToolResultEnhancer {
  return new ToolResultEnhancer(config);
}

/**
 * Format reminders for inclusion in tool result message
 *
 * @param reminders - Array of reminder strings
 * @returns Formatted string to append to result
 */
export function formatReminders(reminders: string[]): string {
  if (reminders.length === 0) {
    return '';
  }
  return '\n\n' + reminders.join('\n');
}
