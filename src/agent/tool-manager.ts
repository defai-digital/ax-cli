/**
 * Tool Manager
 * 
 * Manages all tool instances and their lifecycle.
 * Extracted from LLMAgent to reduce God Object anti-pattern.
 */

import {
  getAllGrokTools,
} from "../llm/tools.js";
import { LLMTool } from "../llm/client.js";

export class ToolManager {
  private tools: LLMTool[] = [];
  private initialized = false;

  /**
   * Initialize tools
   */
  private async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      this.tools = await getAllGrokTools();
      this.initialized = true;
    } catch (error: unknown) {
      console.warn('⚠️ Error initializing tools:', error);
      this.tools = [];
      this.initialized = true;
    }
  }

  /**
   * Get all available tools as LLMTool array
   */
  async getAllTools(): Promise<LLMTool[]> {
    await this.initialize();
    return [...this.tools];
  }

  /**
   * Get tool by name
   */
  async getToolByName(name: string): Promise<LLMTool | undefined> {
    const tools = await this.getAllTools();
    return tools.find(tool => tool.function.name === name);
  }

  /**
   * Load tools safely (for compatibility with existing code)
   */
  async loadToolsSafely(): Promise<LLMTool[]> {
    try {
      return await this.getAllTools();
    } catch (error: unknown) {
      console.warn('⚠️ Error loading tools:', error);
      return [];
    }
  }

  /**
   * Get tool count
   */
  async getToolCount(): Promise<number> {
    const tools = await this.getAllTools();
    return tools.length;
  }

  /**
   * Check if tools are available
   */
  async hasTools(): Promise<boolean> {
    const tools = await this.getAllTools();
    return tools.length > 0;
  }

  /**
   * Dispose all tools
   */
  dispose(): void {
    this.tools = [];
    this.initialized = false;
  }
}
