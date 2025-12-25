/**
 * Command Suggestions Hook
 *
 * Handles slash command and MCP resource suggestions for the chat interface.
 * Extracted from use-input-handler.ts for better testability.
 *
 * @packageDocumentation
 */

import { useState, useCallback, useRef, useMemo } from "react";
import { getMCPResources, getMCPPrompts } from "../../llm/tools.js";
import { filterCommandSuggestions } from "../components/command-suggestions.js";
import { getActiveProvider } from "../../provider/config.js";
import { getCustomCommandsManager, type CustomCommand } from "../../commands/custom-commands.js";
import { promptToSlashCommand, getPromptDescription } from "../../mcp/prompts.js";
import type { MCPResource } from "../../mcp/resources.js";

/**
 * Command suggestion item
 */
export interface CommandSuggestion {
  command: string;
  displayCommand?: string;  // Display text with aliases (falls back to command if not set)
  description: string;
}

/**
 * Model option for model selection
 */
export interface ModelOption {
  model: string;
}

/**
 * Result from useCommandSuggestions hook
 */
export interface UseCommandSuggestionsResult {
  /** Whether command suggestions are visible */
  showCommandSuggestions: boolean;
  /** Set command suggestions visibility */
  setShowCommandSuggestions: (show: boolean) => void;
  /** Currently selected command index */
  selectedCommandIndex: number;
  /** Set selected command index */
  setSelectedCommandIndex: (index: number | ((prev: number) => number)) => void;
  /** MCP resource suggestions */
  resourceSuggestions: MCPResource[];
  /** Set resource suggestions */
  setResourceSuggestions: (resources: MCPResource[]) => void;
  /** Current suggestion mode */
  suggestionMode: "command" | "resource";
  /** Set suggestion mode */
  setSuggestionMode: (mode: "command" | "resource") => void;
  /** Handle input change for suggestions */
  handleInputChange: (newInput: string) => void;
  /** All command suggestions */
  commandSuggestions: CommandSuggestion[];
  /** Available model options */
  availableModels: ModelOption[];
  /** Get current suggestions based on mode and input */
  getCurrentSuggestions: (input: string) => CommandSuggestion[];
  /** Clear current MCP query reference */
  clearMcpQuery: () => void;
}

/**
 * Hook for managing command and resource suggestions
 *
 * @returns Command suggestion handlers and state
 *
 * @example
 * ```tsx
 * const {
 *   showCommandSuggestions,
 *   commandSuggestions,
 *   handleInputChange,
 *   getCurrentSuggestions,
 * } = useCommandSuggestions();
 * ```
 */
export function useCommandSuggestions(): UseCommandSuggestionsResult {
  // Suggestion visibility state
  const [showCommandSuggestions, setShowCommandSuggestions] = useState(false);
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  const [resourceSuggestions, setResourceSuggestions] = useState<MCPResource[]>([]);
  const [suggestionMode, setSuggestionMode] = useState<"command" | "resource">("command");

  // BUG FIX: Track current MCP query to prevent race condition with stale async results
  const currentMcpQueryRef = useRef<string | null>(null);

  // Get custom commands manager
  const customCommandsManager = useMemo(() => getCustomCommandsManager(), []);

  // Build command suggestions list
  const commandSuggestions: CommandSuggestion[] = useMemo(() => {
    const activeProvider = getActiveProvider();

    // Core slash commands
    const coreSuggestions: CommandSuggestion[] = [
      { command: "/help", description: "Show help and available commands" },
      { command: "/shortcuts", description: "Show keyboard shortcuts" },
      { command: "/exit", description: "Exit the application" },
      { command: "/clear", description: "Clear chat history" },
      { command: "/retry", description: "Retry the last message" },
      { command: "/continue", description: "Continue the previous response" },
      { command: "/tasks", description: "Show background tasks" },
      { command: "/task", description: "Show specific task output" },
      { command: "/kill", description: "Kill a background task" },
      { command: "/memory", description: "Show context memory status" },
      { command: "/init", description: "Generate project context index" },
      { command: "/doctor", description: "Diagnose configuration issues" },
      { command: "/checkpoints", description: "List available checkpoints" },
      { command: "/rewind", description: "Rewind to a checkpoint" },
      { command: "/checkpoint-clean", description: "Clean old checkpoints" },
      { command: "/plans", description: "List active plans" },
      { command: "/plan", description: "Show plan details" },
      { command: "/phases", description: "Show plan phases" },
      { command: "/pause", description: "Pause current plan" },
      { command: "/resume", description: "Resume paused plan" },
      { command: "/skip", description: "Skip current phase" },
      { command: "/abandon", description: "Abandon current plan" },
      { command: "/mcp", description: "Show MCP server status" },
      { command: "/theme", description: "Change UI theme" },
      { command: "/usage", description: "Show API usage statistics" },
    ];

    // Add provider-specific model commands
    if (activeProvider && activeProvider.models) {
      coreSuggestions.push(
        { command: "/model", description: `Switch ${activeProvider.displayName} model` }
      );
    }

    // Add custom project commands
    const customCommands = customCommandsManager.getAllCommands();
    const customSuggestions = customCommands.map((cmd: CustomCommand) => ({
      command: `/${cmd.name}`,
      description: cmd.description || `Custom command: ${cmd.name}`,
    }));

    // Add MCP prompt commands
    const mcpPrompts = getMCPPrompts();
    const mcpPromptSuggestions = mcpPrompts.map((prompt) => ({
      command: promptToSlashCommand(prompt),
      description: getPromptDescription(prompt),
    }));

    return [...coreSuggestions, ...customSuggestions, ...mcpPromptSuggestions];
  }, [customCommandsManager]);

  // Get available models for the active provider
  const availableModels: ModelOption[] = useMemo(() => {
    const activeProvider = getActiveProvider();
    if (!activeProvider || !activeProvider.models) {
      return [];
    }
    return Object.keys(activeProvider.models).map((model) => ({ model }));
  }, []);

  /**
   * Get current suggestions based on mode and input
   */
  const getCurrentSuggestions = useCallback((input: string): CommandSuggestion[] => {
    if (suggestionMode === "resource") {
      return resourceSuggestions.map((r) => ({
        command: r.reference,
        description: r.description || r.name,
      }));
    }
    return filterCommandSuggestions(commandSuggestions, input);
  }, [suggestionMode, resourceSuggestions, commandSuggestions]);

  /**
   * Clear current MCP query reference
   */
  const clearMcpQuery = useCallback(() => {
    currentMcpQueryRef.current = null;
  }, []);

  /**
   * Handle input change for suggestions
   */
  const handleInputChange = useCallback((newInput: string) => {
    // Check for @mcp: resource auto-complete
    const mcpMatch = newInput.match(/@mcp:([^\s]*)$/);
    if (mcpMatch) {
      const query = mcpMatch[1].toLowerCase();
      // BUG FIX: Track current query to prevent race condition
      currentMcpQueryRef.current = query;

      // Load resources asynchronously
      getMCPResources().then((resources) => {
        // BUG FIX: Only apply results if query hasn't changed
        if (currentMcpQueryRef.current !== query) {
          return; // Query changed, discard stale results
        }

        const filtered = resources.filter((r) =>
          r.reference.toLowerCase().includes(query) ||
          r.name.toLowerCase().includes(query) ||
          (r.description && r.description.toLowerCase().includes(query))
        );
        setResourceSuggestions(filtered);
        setSuggestionMode("resource");
        setShowCommandSuggestions(true);
        setSelectedCommandIndex(0);
      }).catch(() => {
        // Only clear if this is still the current query
        if (currentMcpQueryRef.current === query) {
          setResourceSuggestions([]);
        }
      });
      return;
    }

    // Reset resource mode if it was active but no longer matches
    if (suggestionMode === "resource") {
      currentMcpQueryRef.current = null;
      setResourceSuggestions([]);
      setSuggestionMode("command");
    }

    // Update command suggestions based on input
    if (newInput.startsWith("/")) {
      setShowCommandSuggestions(true);
      setSelectedCommandIndex(0);
    } else {
      setShowCommandSuggestions(false);
      setSelectedCommandIndex(0);
    }
  }, [suggestionMode]);

  return {
    showCommandSuggestions,
    setShowCommandSuggestions,
    selectedCommandIndex,
    setSelectedCommandIndex,
    resourceSuggestions,
    setResourceSuggestions,
    suggestionMode,
    setSuggestionMode,
    handleInputChange,
    commandSuggestions,
    availableModels,
    getCurrentSuggestions,
    clearMcpQuery,
  };
}
