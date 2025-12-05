/**
 * Design Tool
 *
 * Provides Figma design integration tools for the LLM agent.
 * Enables interactive mode to work with Figma files, tokens, and audits.
 *
 * @module tools/design-tool
 */

import type { ToolResult } from '../types/index.js';
import type { AuditRuleId } from '@ax-cli/schemas';
import {
  getFigmaClient,
  mapFigmaFile,
  formatMapResult,
  extractTokensFromVariables,
  formatTokens,
  auditDesign,
  formatAuditResult,
  resolveAlias,
  listAliases,
  findNodes,
  getNodePath,
  type TreeDisplayOptions,
  type MapOutputFormat,
} from '../design/index.js';
import { extractErrorMessage } from '../utils/error-handler.js';

/**
 * Design Tool for Figma integration
 */
export class DesignTool {
  /**
   * Validate and get Figma access token
   * Returns error result if token is not available
   */
  private validateFigmaToken(): ToolResult | null {
    if (!process.env.FIGMA_ACCESS_TOKEN) {
      return {
        success: false,
        error: `FIGMA_ACCESS_TOKEN environment variable not set.

To fix this:
1. Get a personal access token from https://www.figma.com/developers/api#access-tokens
2. Set it using one of these methods:
   - Run: export FIGMA_ACCESS_TOKEN="your_token"
   - Add to your shell profile (~/.zshrc or ~/.bashrc)
   - Use ax-cli mcp add figma --template --interactive`,
      };
    }
    return null;
  }

  /**
   * Format Figma API errors with helpful messages
   */
  private formatFigmaError(error: unknown, operation: string): string {
    const message = extractErrorMessage(error);

    // Check for common error patterns
    if (message.includes('401') || message.includes('Unauthorized')) {
      return `${operation}: Invalid or expired Figma access token. Please check your FIGMA_ACCESS_TOKEN.`;
    }
    if (message.includes('403') || message.includes('Forbidden')) {
      return `${operation}: Access denied. You may not have permission to access this Figma file.`;
    }
    if (message.includes('404') || message.includes('Not Found')) {
      return `${operation}: Figma file not found. Please check the file key is correct and you have access to the file.`;
    }
    if (message.includes('429') || message.includes('Rate limit')) {
      return `${operation}: Figma API rate limit exceeded. Please wait a moment and try again.`;
    }
    if (message.includes('timeout') || message.includes('Timeout')) {
      return `${operation}: Request timed out. The Figma file may be too large or the API is slow. Try again or use a smaller depth value.`;
    }
    if (message.includes('ENOTFOUND') || message.includes('network')) {
      return `${operation}: Network error. Please check your internet connection.`;
    }

    return `${operation}: ${message}`;
  }

  /**
   * Map a Figma file structure
   */
  async mapFile(
    fileKey: string,
    options: {
      depth?: number;
      format?: MapOutputFormat;
      showIds?: boolean;
      showTypes?: boolean;
      framesOnly?: boolean;
    } = {}
  ): Promise<ToolResult> {
    // Validate token first
    const tokenError = this.validateFigmaToken();
    if (tokenError) return tokenError;

    try {
      const client = getFigmaClient();
      const response = await client.getFile(fileKey, {
        depth: options.depth,
      });

      const treeOptions: TreeDisplayOptions = {
        maxDepth: options.depth,
        showIds: options.showIds,
        showTypes: options.showTypes,
        framesOnly: options.framesOnly,
      };

      const mapResult = mapFigmaFile(response, fileKey, treeOptions);
      const output = formatMapResult(
        mapResult,
        options.format ?? 'tree',
        treeOptions
      );

      return {
        success: true,
        output: `Figma file mapped successfully:\n\n${output}`,
      };
    } catch (error) {
      return {
        success: false,
        error: this.formatFigmaError(error, 'Failed to map Figma file'),
      };
    }
  }

  /**
   * Extract design tokens from a Figma file
   */
  async extractTokens(
    fileKey: string,
    options: {
      format?: 'json' | 'tailwind' | 'css' | 'scss';
      colorFormat?: 'hex' | 'rgb' | 'hsl';
      dimensionUnit?: 'px' | 'rem';
      remBase?: number;
    } = {}
  ): Promise<ToolResult> {
    // Validate token first
    const tokenError = this.validateFigmaToken();
    if (tokenError) return tokenError;

    try {
      const client = getFigmaClient();
      const response = await client.getLocalVariables(fileKey);

      const tokens = extractTokensFromVariables(response, {
        colorFormat: options.colorFormat ?? 'hex',
        dimensionUnit: options.dimensionUnit ?? 'px',
        remBase: options.remBase ?? 16,
      });

      const output = formatTokens(tokens, options.format ?? 'json');

      return {
        success: true,
        output: `Design tokens extracted:\n\n${output}`,
      };
    } catch (error) {
      return {
        success: false,
        error: this.formatFigmaError(error, 'Failed to extract tokens'),
      };
    }
  }

  /**
   * Run design audit on a Figma file
   */
  async auditFile(
    fileKey: string,
    options: {
      depth?: number;
      rules?: string[];
      excludeRules?: string[];
    } = {}
  ): Promise<ToolResult> {
    // Validate token first
    const tokenError = this.validateFigmaToken();
    if (tokenError) return tokenError;

    try {
      const client = getFigmaClient();
      const response = await client.getFile(fileKey, {
        depth: options.depth,
      });

      const mapResult = mapFigmaFile(response, fileKey);

      const auditConfig: {
        maxDepth?: number;
        rules?: AuditRuleId[];
        excludeRules?: AuditRuleId[];
      } = {
        maxDepth: options.depth,
      };

      if (options.rules) {
        auditConfig.rules = options.rules as AuditRuleId[];
      }
      if (options.excludeRules) {
        auditConfig.excludeRules = options.excludeRules as AuditRuleId[];
      }

      const result = auditDesign(mapResult, auditConfig);
      const output = formatAuditResult(result);

      const status = result.summary.issueCount.error > 0
        ? 'FAILED'
        : result.summary.issueCount.warning > 0
          ? 'WARNINGS'
          : 'PASSED';

      return {
        success: true,
        output: `Design Audit ${status}:\n\n${output}`,
      };
    } catch (error) {
      return {
        success: false,
        error: this.formatFigmaError(error, 'Failed to audit design'),
      };
    }
  }

  /**
   * Resolve a design alias to file key and node ID
   */
  async resolveAlias(aliasName: string): Promise<ToolResult> {
    try {
      const result = resolveAlias(aliasName);

      if ('error' in result) {
        let errorMsg = result.error;
        if (result.suggestions && result.suggestions.length > 0) {
          errorMsg += `\n\nDid you mean: ${result.suggestions.join(', ')}?`;
        }
        return {
          success: false,
          error: errorMsg,
        };
      }

      return {
        success: true,
        output: `Alias resolved:\n  File: ${result.fileKey}\n  Node: ${result.nodeId}\n  Source: ${result.source}`,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to resolve alias: ${extractErrorMessage(error)}`,
      };
    }
  }

  /**
   * List all design aliases
   */
  async listAliases(): Promise<ToolResult> {
    try {
      const response = listAliases();

      if (response.total === 0) {
        return {
          success: true,
          output: 'No design aliases defined.',
        };
      }

      let output = `Design Aliases (${response.total} total):\n`;

      if (response.defaultFile) {
        output += `\nDefault file: ${response.defaultFile}`;
      }
      if (response.dsFile) {
        output += `\nDesign system file: ${response.dsFile}`;
      }

      output += '\n\nAliases:\n';
      for (const entry of response.aliases) {
        output += `  ${entry.alias} → ${entry.fileKey}/${entry.nodeId}`;
        if (entry.description) {
          output += ` (${entry.description})`;
        }
        output += '\n';
      }

      return {
        success: true,
        output,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to list aliases: ${extractErrorMessage(error)}`,
      };
    }
  }

  /**
   * Search for nodes in a Figma file
   */
  async searchNodes(
    fileKey: string,
    options: {
      name?: string;
      type?: string;
      text?: string;
      limit?: number;
    }
  ): Promise<ToolResult> {
    // Validate token first
    const tokenError = this.validateFigmaToken();
    if (tokenError) return tokenError;

    if (!options.name && !options.type && !options.text) {
      return {
        success: false,
        error: 'At least one search option required: name, type, or text',
      };
    }

    try {
      const client = getFigmaClient();
      const response = await client.getFile(fileKey);
      const mapResult = mapFigmaFile(response, fileKey);

      const limit = options.limit ?? 10;

      // Pre-compute lowercase search terms once (avoid repeated toLowerCase in callback)
      const nameLower = options.name?.toLowerCase();
      const typeUpper = options.type?.toUpperCase();
      const textLower = options.text?.toLowerCase();

      const results = findNodes(mapResult.root, (node) => {
        if (nameLower && !node.name.toLowerCase().includes(nameLower)) {
          return false;
        }
        if (typeUpper && node.type !== typeUpper) {
          return false;
        }
        if (textLower && (!node.characters || !node.characters.toLowerCase().includes(textLower))) {
          return false;
        }
        return true;
      }, limit);

      if (results.length === 0) {
        return {
          success: true,
          output: 'No matching nodes found.',
        };
      }

      let output = `Found ${results.length} node(s):\n\n`;

      for (const node of results) {
        const path = getNodePath(mapResult.root, node.id);
        output += `${node.name} [${node.type}]\n`;
        output += `  ID: ${node.id}\n`;
        if (path) {
          output += `  Path: ${path.join(' > ')}\n`;
        }
        if (node.characters) {
          output += `  Text: "${node.characters}"\n`;
        }
        output += '\n';
      }

      return {
        success: true,
        output,
      };
    } catch (error) {
      return {
        success: false,
        error: this.formatFigmaError(error, 'Failed to search nodes'),
      };
    }
  }
}
