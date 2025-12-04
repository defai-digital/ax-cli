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
    try {
      // Check for FIGMA_ACCESS_TOKEN
      if (!process.env.FIGMA_ACCESS_TOKEN) {
        return {
          success: false,
          error: 'FIGMA_ACCESS_TOKEN environment variable not set. Please set it with your Figma personal access token.',
        };
      }

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
        error: `Failed to map Figma file: ${extractErrorMessage(error)}`,
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
    try {
      if (!process.env.FIGMA_ACCESS_TOKEN) {
        return {
          success: false,
          error: 'FIGMA_ACCESS_TOKEN environment variable not set.',
        };
      }

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
        error: `Failed to extract tokens: ${extractErrorMessage(error)}`,
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
    try {
      if (!process.env.FIGMA_ACCESS_TOKEN) {
        return {
          success: false,
          error: 'FIGMA_ACCESS_TOKEN environment variable not set.',
        };
      }

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
        error: `Failed to audit design: ${extractErrorMessage(error)}`,
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
    try {
      if (!process.env.FIGMA_ACCESS_TOKEN) {
        return {
          success: false,
          error: 'FIGMA_ACCESS_TOKEN environment variable not set.',
        };
      }

      if (!options.name && !options.type && !options.text) {
        return {
          success: false,
          error: 'At least one search option required: name, type, or text',
        };
      }

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
        error: `Failed to search nodes: ${extractErrorMessage(error)}`,
      };
    }
  }
}
