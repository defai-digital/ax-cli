import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useInput } from "ink";
import { LLMAgent, ChatEntry } from "../../agent/llm-agent.js";
import { ConfirmationService } from "../../utils/confirmation-service.js";
import { useEnhancedInput, Key } from "./use-enhanced-input.js";
import { escapeShellArg } from "../../tools/bash.js";
import { VerbosityLevel } from "../../constants.js";

import { filterCommandSuggestions } from "../components/command-suggestions.js";
import { getSettingsManager } from "../../utils/settings-manager.js";
import { getActiveProvider, getActiveConfigPaths } from "../../provider/config.js";
import { handleRewindCommand, handleCheckpointsCommand, handleCheckpointCleanCommand } from "../../commands/rewind.js";
import {
  handlePlansCommand,
  handlePlanCommand,
  handlePhasesCommand,
  handlePauseCommand,
  handleResumeCommand,
  handleSkipPhaseCommand,
  handleAbandonCommand,
  handleResumableCommand,
} from "../../commands/plan.js";
import { openExternalEditor, getPreferredEditor, getEditorDisplayName } from "../../utils/external-editor.js";
import { extractErrorMessage } from "../../utils/error-handler.js";
import { getCustomCommandsManager, type CustomCommand } from "../../commands/custom-commands.js";
import { getHooksManager } from "../../hooks/index.js";
import { getMCPPrompts, getMCPManager, getMCPResources } from "../../llm/tools.js";
import { promptToSlashCommand, parsePromptCommand, formatPromptResult, getPromptDescription } from "../../mcp/prompts.js";
import type { MCPResource } from "../../mcp/resources.js";
import { parseFileMentions } from "../../utils/file-mentions.js";
import { parseImageInput, formatAttachmentForDisplay, buildMessageContent } from "../utils/image-handler.js";
import { routeToAgent } from "../../agent/agent-router.js";
import { executeAgent } from "../../agent/agent-executor.js";
import {
  initializeCommandRegistry,
  getAllCommandSuggestions,
} from "../../commands/handlers/index.js";
import { getCommandRegistry } from "../../commands/registry.js";
import type { CommandContext } from "../../commands/types.js";

interface UseInputHandlerProps {
  agent: LLMAgent;
  chatHistory: ChatEntry[];
  setChatHistory: React.Dispatch<React.SetStateAction<ChatEntry[]>>;
  setIsProcessing: (processing: boolean) => void;
  setIsStreaming: (streaming: boolean) => void;
  setTokenCount: (count: number) => void;
  setProcessingTime: (time: number) => void;
  processingStartTime: React.MutableRefObject<number>;
  isProcessing: boolean;
  isStreaming: boolean;
  isConfirmationActive?: boolean;
  onQuickActionsToggle?: () => void;
  // Callbacks for mode toggle events (for toast/flash UI feedback)
  onVerboseModeChange?: (enabled: boolean) => void;
  onBackgroundModeChange?: (enabled: boolean) => void;
  onAutoEditModeChange?: (enabled: boolean) => void;
  onTaskMovedToBackground?: (taskId: string) => void;
  onOperationInterrupted?: () => void;
  onChatCleared?: () => void;
  onCopyLastResponse?: () => void;
  // Callbacks for memory operations
  onMemoryWarmed?: (tokens: number) => void;
  onMemoryRefreshed?: () => void;
  // Callbacks for checkpoint operations
  onCheckpointCreated?: () => void;
  onCheckpointRestored?: () => void;
  onLargePaste?: (charCount: number) => void;
  onPasteTruncated?: (originalLength: number, truncatedLength: number) => void;
  onKeyboardHelp?: () => void;
  onMcpDashboardToggle?: () => void;
  onThinkingModeChange?: (enabled: boolean) => void;
  onEditorOpening?: (editorName: string) => void;
  onEditorSuccess?: () => void;
  onEditorCancelled?: () => void;
  onEditorError?: (error: string) => void;
  // Agent-First Mode props
  agentFirstDisabled?: boolean;
  forcedAgent?: string;
  onAgentSelected?: (agent: string | null) => void;
}

interface CommandSuggestion {
  command: string;
  description: string;
}

interface ModelOption {
  model: string;
}

export function useInputHandler({
  agent,
  chatHistory,
  setChatHistory,
  setIsProcessing,
  setIsStreaming,
  setTokenCount,
  setProcessingTime,
  processingStartTime,
  isProcessing,
  isStreaming,
  isConfirmationActive = false,
  onQuickActionsToggle,
  onVerboseModeChange,
  onBackgroundModeChange,
  onAutoEditModeChange,
  onTaskMovedToBackground,
  onOperationInterrupted,
  onChatCleared,
  onCopyLastResponse,
  onMemoryWarmed,
  onMemoryRefreshed,
  onCheckpointCreated: _onCheckpointCreated, // Reserved for future checkpoint UI
  onCheckpointRestored: _onCheckpointRestored, // Reserved for future checkpoint UI
  onLargePaste,
  onPasteTruncated,
  onKeyboardHelp,
  onMcpDashboardToggle,
  onThinkingModeChange,
  onEditorOpening,
  onEditorSuccess,
  onEditorCancelled,
  onEditorError,
  agentFirstDisabled = false,
  forcedAgent,
  onAgentSelected,
}: UseInputHandlerProps) {
  // Initialize command registry on first render
  const commandRegistryRef = useRef<ReturnType<typeof getCommandRegistry> | null>(null);
  if (!commandRegistryRef.current) {
    initializeCommandRegistry();
    commandRegistryRef.current = getCommandRegistry();
  }

  const [showCommandSuggestions, setShowCommandSuggestions] = useState(false);
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  const [resourceSuggestions, setResourceSuggestions] = useState<MCPResource[]>([]);
  const [suggestionMode, setSuggestionMode] = useState<"command" | "resource">("command");
  // BUG FIX: Track current MCP query to prevent race condition with stale async results
  const currentMcpQueryRef = useRef<string | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [autoEditEnabled, setAutoEditEnabled] = useState(() => {
    const confirmationService = ConfirmationService.getInstance();
    const sessionFlags = confirmationService.getSessionFlags();
    // Default to true (auto-edit enabled by default)
    return sessionFlags.allOperations !== undefined ? sessionFlags.allOperations : true;
  });
  const [verboseMode, setVerboseMode] = useState(false);  // Legacy boolean for backward compat
  const [verbosityLevel, setVerbosityLevel] = useState<VerbosityLevel>(VerbosityLevel.QUIET);
  const [backgroundMode, setBackgroundMode] = useState(false);
  const [thinkingModeEnabled, setThinkingModeEnabled] = useState(true);

  const toggleAutoEditMode = useCallback(() => {
    const newAutoEditState = !autoEditEnabled;
    setAutoEditEnabled(newAutoEditState);

    const confirmationService = ConfirmationService.getInstance();
    if (newAutoEditState) {
      // Enable auto-edit: set all operations to be accepted
      confirmationService.setSessionFlag("allOperations", true);
    } else {
      // Disable auto-edit: reset session flags
      confirmationService.resetSession();
    }
    // Notify parent for toast/flash feedback
    onAutoEditModeChange?.(newAutoEditState);
  }, [autoEditEnabled, onAutoEditModeChange]);

  const handleSpecialKey = (key: Key): boolean => {
    // Don't handle input if confirmation dialog is active
    if (isConfirmationActive) {
      return true; // Prevent default handling
    }

    // Handle shift+tab to toggle auto-edit mode
    if (key.shift && key.tab) {
      toggleAutoEditMode();
      return true; // Handled
    }

    // Handle escape key for closing menus
    if (key.escape) {
      if (showCommandSuggestions) {
        setShowCommandSuggestions(false);
        setSelectedCommandIndex(0);
        // Reset resource mode if active
        if (suggestionMode === "resource") {
          setResourceSuggestions([]);
          setSuggestionMode("command");
        }
        return true;
      }
      if (isProcessing || isStreaming) {
        agent.abortCurrentOperation();
        setIsProcessing(false);
        setIsStreaming(false);
        setTokenCount(0);
        setProcessingTime(0);
        processingStartTime.current = 0;
        // Notify parent for toast feedback
        onOperationInterrupted?.();
        return true;
      }
      return false; // Let default escape handling work
    }

    // Handle command/resource suggestions navigation
    if (showCommandSuggestions) {
      // Get appropriate suggestions based on mode
      const currentSuggestions = suggestionMode === "resource"
        ? resourceSuggestions.map((r) => ({ command: r.reference, description: r.description || r.name }))
        : filterCommandSuggestions(commandSuggestions, input);

      if (currentSuggestions.length === 0) {
        setShowCommandSuggestions(false);
        setSelectedCommandIndex(0);
        return false; // Continue processing
      } else {
        if (key.upArrow) {
          setSelectedCommandIndex((prev) =>
            prev === 0 ? currentSuggestions.length - 1 : prev - 1
          );
          return true;
        }
        if (key.downArrow) {
          setSelectedCommandIndex(
            (prev) => (prev + 1) % currentSuggestions.length
          );
          return true;
        }
        if (key.tab || key.return) {
          // Check if there are any suggestions available
          if (currentSuggestions.length === 0) {
            return true; // No suggestions, do nothing
          }

          const safeIndex = Math.min(
            selectedCommandIndex,
            currentSuggestions.length - 1
          );
          const selected = currentSuggestions[safeIndex];

          if (suggestionMode === "resource") {
            // Replace @mcp:partial with the full reference
            const mcpMatch = input.match(/@mcp:[^\s]*$/);
            if (mcpMatch) {
              const newInput = input.replace(/@mcp:[^\s]*$/, selected.command + " ");
              setInput(newInput);
              setCursorPosition(newInput.length);
            }
            // Reset resource mode
            setResourceSuggestions([]);
            setSuggestionMode("command");
          } else {
            // Command suggestion - replace entire input
            const newInput = selected.command + " ";
            setInput(newInput);
            setCursorPosition(newInput.length);
          }

          setShowCommandSuggestions(false);
          setSelectedCommandIndex(0);
          return true;
        }
      }
    }

    return false; // Let default handling proceed
  };

  const handleInputSubmit = async (userInput: string) => {
    if (userInput === "exit" || userInput === "quit") {
      process.exit(0);
      return;
    }

    if (userInput.trim()) {
      const directCommandResult = await handleDirectCommand(userInput);
      if (!directCommandResult) {
        // Check if this looks like an unrecognized slash command
        const trimmed = userInput.trim();
        // Match valid command pattern: /commandname (alphanumeric, dash, underscore)
        const cmdMatch = trimmed.match(/^\/([a-zA-Z][a-zA-Z0-9_-]*)/);

        if (cmdMatch && !trimmed.startsWith("//")) {
          // This looks like a slash command that wasn't handled
          const cmdName = cmdMatch[1];
          const errorEntry: ChatEntry = {
            type: "assistant",
            content: `❌ Unknown command: \`/${cmdName}\`\n\nType \`/help\` to see available commands.`,
            timestamp: new Date(),
          };
          setChatHistory((prev) => [...prev, errorEntry]);
          clearInput();
        } else {
          // Not a valid command pattern (e.g., just "/", "/123", "//comment")
          // Send to AI as regular message
          await processUserMessage(userInput);
        }
      }
    }
  };

  const handleInputChange = useCallback((newInput: string) => {
    // Check for @mcp: resource auto-complete
    const mcpMatch = newInput.match(/@mcp:([^\s]*)$/);
    if (mcpMatch) {
      const query = mcpMatch[1].toLowerCase();
      // BUG FIX: Track current query to prevent race condition
      // If user types faster than async completes, stale results are discarded
      currentMcpQueryRef.current = query;

      // Load resources asynchronously
      getMCPResources().then((resources) => {
        // BUG FIX: Only apply results if query hasn't changed (prevents stale suggestions)
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
    // BUG FIX: Also clear the query ref when leaving resource mode
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

  const handleVerboseToggle = useCallback(() => {
    // Cycle through verbosity levels: QUIET -> CONCISE -> VERBOSE -> QUIET
    setVerbosityLevel((prev) => {
      const nextLevel = (prev + 1) % 3;  // Cycle through 0, 1, 2

      // Update legacy verboseMode for backward compatibility
      setVerboseMode(nextLevel === VerbosityLevel.VERBOSE);

      // Notify parent for toast/flash feedback
      onVerboseModeChange?.(nextLevel === VerbosityLevel.VERBOSE);

      return nextLevel as VerbosityLevel;
    });
  }, [onVerboseModeChange]);

  const handleBackgroundModeToggle = useCallback(() => {
    // Check if a bash command is currently executing
    if (agent.isBashExecuting()) {
      const taskId = agent.moveBashToBackground();
      if (taskId) {
        // Notify parent for toast feedback
        onTaskMovedToBackground?.(taskId);
        return;
      }
    }
    // Otherwise toggle background mode preference
    setBackgroundMode((prev) => {
      const newState = !prev;
      // Notify parent for toast/flash feedback instead of polluting chat history
      onBackgroundModeChange?.(newState);
      return newState;
    });
  }, [agent, onBackgroundModeChange, onTaskMovedToBackground]);

  const handleThinkingModeToggle = useCallback(() => {
    setThinkingModeEnabled((prev) => {
      const newState = !prev;
      // Update agent thinking configuration
      if (newState) {
        agent.setThinkingConfig({ type: "enabled" });
      } else {
        agent.setThinkingConfig({ type: "disabled" });
      }
      // Notify parent for toast/flash feedback
      onThinkingModeChange?.(newState);
      return newState;
    });
  }, [agent, onThinkingModeChange]);

  const handleExternalEditor = useCallback(async (currentInput: string): Promise<string | null> => {
    try {
      // Get editor name for toast notification
      const editor = getPreferredEditor();
      const editorName = getEditorDisplayName(editor);

      // Notify user that editor is opening
      onEditorOpening?.(editorName);

      const result = await openExternalEditor({
        initialContent: currentInput,
        fileExtension: '.md', // Use markdown for syntax highlighting
      });

      if (result.success && result.content) {
        // Successfully edited - return new content
        onEditorSuccess?.();
        return result.content;
      } else if (result.cancelled) {
        // User cancelled - no changes
        onEditorCancelled?.();
        return null;
      } else {
        // Error occurred
        onEditorError?.(result.error || 'Unknown error');
        return null;
      }
    } catch (error: any) {
      onEditorError?.(error.message || 'Failed to open editor');
      return null;
    }
  }, [onEditorOpening, onEditorSuccess, onEditorCancelled, onEditorError]);

  const {
    input,
    cursorPosition,
    pastedBlocks,
    currentBlockAtCursor,
    isPasting,
    setInput,
    setCursorPosition,
    clearInput,
    resetHistory,
    handleInput,
    expandPlaceholdersForSubmit: _expandPlaceholdersForSubmit, // Part of hook interface, reserved for future use
  } = useEnhancedInput({
    onSubmit: handleInputSubmit,
    onSpecialKey: handleSpecialKey,
    onVerboseToggle: handleVerboseToggle,
    onQuickActions: onQuickActionsToggle,
    onBackgroundModeToggle: handleBackgroundModeToggle,
    onCopyLastResponse,
    onThinkingModeToggle: handleThinkingModeToggle,
    onExternalEditor: handleExternalEditor,
    onLargePaste,
    onPasteTruncated,
    onKeyboardHelp,
    disabled: isConfirmationActive,
    projectDir: process.cwd(),
  });
  void _expandPlaceholdersForSubmit; // Suppress unused warning - reserved for future use

  // Hook up the actual input handling
  useInput((inputChar: string, key: Key) => {
    handleInput(inputChar, key);
  });

  // Update command suggestions when input changes
  useEffect(() => {
    handleInputChange(input);
  }, [input, handleInputChange]);

  // Cleanup retry timeout on unmount
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null; // Clear ref to prevent dangling reference
      }
    };
  }, []);

  // Get custom commands manager
  const customCommandsManager = useMemo(() => getCustomCommandsManager(), []);

  // Build command suggestions including custom commands
  const commandSuggestions: CommandSuggestion[] = useMemo(() => {
    // Get commands from the registry
    const registryCommands = getAllCommandSuggestions();

    // Add streaming commands not in registry
    const streamingCommands: CommandSuggestion[] = [
      { command: "/continue", description: "Continue incomplete response" },
      { command: "/retry", description: "Re-send the last message" },
      { command: "/commit-and-push", description: "AI commit & push to remote" },
    ];

    // Add plan/rewind commands (handled separately)
    const planCommands: CommandSuggestion[] = [
      { command: "/rewind", description: "Rewind to previous checkpoint" },
      { command: "/checkpoints", description: "List checkpoint statistics" },
      { command: "/checkpoint-clean", description: "Clean old checkpoints" },
      { command: "/plans", description: "List all task plans" },
      { command: "/plan", description: "Show current plan details" },
      { command: "/phases", description: "Show phases of current plan" },
      { command: "/pause", description: "Pause current plan execution" },
      { command: "/resume", description: "Resume paused plan" },
      { command: "/skip", description: "Skip current phase" },
      { command: "/abandon", description: "Abandon current plan" },
    ];

    // Add custom commands
    const customCmds = customCommandsManager.getAllCommands();
    const customSuggestions = customCmds.map((cmd: CustomCommand) => ({
      command: `/${cmd.name}`,
      description: `${cmd.description} [${cmd.scope}]`,
    }));

    // Add MCP prompts as slash commands
    const mcpPrompts = getMCPPrompts();
    const mcpPromptSuggestions = mcpPrompts.map((prompt) => ({
      command: promptToSlashCommand(prompt as any),
      description: getPromptDescription(prompt as any),
    }));

    return [...registryCommands, ...streamingCommands, ...planCommands, ...customSuggestions, ...mcpPromptSuggestions];
  }, [customCommandsManager]);

  // Load models from configuration with fallback to defaults
  const availableModels: ModelOption[] = useMemo(() => {
    const settingsManager = getSettingsManager();
    const models = settingsManager.getAvailableModels();
    return models.map(m => ({ model: m }));
  }, []);

  const handleDirectCommand = async (input: string): Promise<boolean> => {
    const trimmedInput = input.trim();

    // ═══════════════════════════════════════════════════════════════════════════
    // Command Registry Dispatch
    // Try the registry first for non-streaming commands
    // ═══════════════════════════════════════════════════════════════════════════
    const registry = commandRegistryRef.current;
    if (registry && trimmedInput.startsWith("/")) {
      const parsed = registry.parse(trimmedInput);

      // Skip streaming commands - they need special handling below
      const streamingCommands = new Set(["continue", "retry", "commit-and-push"]);
      const isStreamingCommand = streamingCommands.has(parsed.command);

      if (parsed.isSlashCommand && registry.has(parsed.command) && !isStreamingCommand) {
        // Build command context
        const ctx: CommandContext = {
          agent,
          settings: getSettingsManager(),
          provider: getActiveProvider(),
          configPaths: getActiveConfigPaths(),
          input: trimmedInput,
          setChatHistory,
          setIsProcessing,
          setIsStreaming,
          clearInput,
          setInput,
          resetHistory,
          onMemoryWarmed,
          onMemoryRefreshed,
          onMcpDashboardToggle,
          onChatCleared,
          onOperationInterrupted,
          onEditorSuccess,
          processingStartTime,
          setTokenCount,
          setProcessingTime,
        };

        try {
          const result = await registry.execute(trimmedInput, ctx);

          if (result.handled) {
            // Add entries to chat history
            if (result.entries && result.entries.length > 0) {
              setChatHistory((prev) => [...prev, ...result.entries!]);
            }

            // Handle error result
            if (result.error) {
              setChatHistory((prev) => [
                ...prev,
                {
                  type: "assistant",
                  content: `❌ ${result.error}`,
                  timestamp: new Date(),
                },
              ]);
            }

            // Clear input if requested
            if (result.clearInput !== false) {
              clearInput();
            }

            // Set processing state BEFORE async action to avoid race condition
            // (asyncAction's finally block may call setIsProcessing(false) before
            // this line would otherwise execute if placed after asyncAction)
            if (result.setProcessing) {
              setIsProcessing(true);
            }

            // Execute async action if provided
            if (result.asyncAction) {
              // Fire and forget - the action manages its own state
              result.asyncAction().catch((error) => {
                const errorMessage = extractErrorMessage(error);
                setChatHistory((prev) => [
                  ...prev,
                  {
                    type: "assistant",
                    content: `❌ Command failed: ${errorMessage}`,
                    timestamp: new Date(),
                  },
                ]);
                // Reset processing state on error if it was set
                if (result.setProcessing) {
                  setIsProcessing(false);
                }
              });
            }

            return true;
          }
        } catch (error) {
          const errorMessage = extractErrorMessage(error);
          setChatHistory((prev) => [
            ...prev,
            {
              type: "assistant",
              content: `❌ Command error: ${errorMessage}`,
              timestamp: new Date(),
            },
          ]);
          clearInput();
          return true;
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Streaming Commands (handled inline due to complex state management)
    // ═══════════════════════════════════════════════════════════════════════════

    if (trimmedInput === "/continue") {
      // Send a shorter, more focused continuation prompt to avoid timeout
      // Using a brief prompt reduces token overhead for large contexts
      const continuePrompt = "Continue from where you left off.";

      // Add user continue command to history (showing the actual command for clarity)
      const userEntry: ChatEntry = {
        type: "user",
        content: "/continue",
        timestamp: new Date(),
      };
      setChatHistory((prev) => [...prev, userEntry]);

      // Process through agent
      setIsProcessing(true);
      setIsStreaming(true);
      processingStartTime.current = Date.now();

      // Fire async operation with proper error handling
      (async () => {
        try {
          let streamingEntry: ChatEntry | null = null;

          for await (const chunk of agent.processUserMessageStream(continuePrompt)) {
            switch (chunk.type) {
              case "reasoning":
                if (chunk.reasoningContent) {
                  if (!streamingEntry) {
                    const newStreamingEntry: ChatEntry = {
                      type: "assistant",
                      content: "",
                      timestamp: new Date(),
                      isStreaming: true,
                      reasoningContent: chunk.reasoningContent,
                      isReasoningStreaming: true,
                    };
                    setChatHistory((prev) => [...prev, newStreamingEntry]);
                    streamingEntry = newStreamingEntry;
                  } else {
                    setChatHistory((prev) =>
                      prev.map((entry, idx) =>
                        idx === prev.length - 1 && entry.isStreaming
                          ? {
                              ...entry,
                              reasoningContent:
                                (entry.reasoningContent || "") +
                                chunk.reasoningContent,
                              isReasoningStreaming: true,
                            }
                          : entry
                      )
                    );
                  }
                }
                break;

              case "content":
                if (chunk.content) {
                  if (!streamingEntry) {
                    const newStreamingEntry: ChatEntry = {
                      type: "assistant",
                      content: chunk.content,
                      timestamp: new Date(),
                      isStreaming: true,
                    };
                    setChatHistory((prev) => [...prev, newStreamingEntry]);
                    streamingEntry = newStreamingEntry;
                  } else {
                    setChatHistory((prev) =>
                      prev.map((entry, idx) =>
                        idx === prev.length - 1 && entry.isStreaming
                          ? {
                              ...entry,
                              content: entry.content + chunk.content,
                              isReasoningStreaming: false,
                            }
                          : entry
                      )
                    );
                  }
                }
                break;

              case "token_count":
                if (chunk.tokenCount !== undefined) {
                  setTokenCount(chunk.tokenCount);
                }
                break;

              case "tool_calls":
                if (chunk.toolCalls) {
                  setChatHistory((prev) =>
                    prev.map((entry) =>
                      entry.isStreaming
                        ? {
                            ...entry,
                            isStreaming: false,
                            toolCalls: chunk.toolCalls,
                          }
                        : entry
                    )
                  );
                  streamingEntry = null;

                  chunk.toolCalls.forEach((toolCall) => {
                    const toolCallEntry: ChatEntry = {
                      type: "tool_call",
                      content: "Executing...",
                      timestamp: new Date(),
                      toolCall: toolCall,
                    };
                    setChatHistory((prev) => [...prev, toolCallEntry]);
                  });
                }
                break;

              case "tool_result":
                if (chunk.toolCall && chunk.toolResult) {
                  setChatHistory((prev) =>
                    prev.map((entry) => {
                      if (entry.isStreaming) {
                        return { ...entry, isStreaming: false };
                      }
                      if (
                        entry.type === "tool_call" &&
                        entry.toolCall?.id === chunk.toolCall?.id
                      ) {
                        return {
                          ...entry,
                          type: "tool_result",
                          content: chunk.toolResult?.success
                            ? chunk.toolResult?.output || "Success"
                            : chunk.toolResult?.error || "Error occurred",
                          toolResult: chunk.toolResult,
                          executionDurationMs: chunk.executionDurationMs,
                        };
                      }
                      return entry;
                    })
                  );
                  streamingEntry = null;
                }
                break;

              case "done":
                if (streamingEntry) {
                  // Calculate response duration
                  const durationMs = processingStartTime.current > 0
                    ? Date.now() - processingStartTime.current
                    : undefined;

                  setChatHistory((prev) =>
                    prev.map((entry) =>
                      entry.isStreaming ? { ...entry, isStreaming: false, durationMs } : entry
                    )
                  );
                }
                setIsStreaming(false);
                break;
            }
          }
        } catch (error: unknown) {
          const errorObj = error instanceof Error ? error : new Error(String(error));
          let errorMessage = `Error: ${errorObj.message}`;

          // Provide helpful guidance for timeout errors during /continue
          if (errorObj.message?.includes('timeout')) {
            errorMessage += `\n\n💡 Tip: For very long conversations, try:\n`;
            errorMessage += `   • Use /clear to start fresh and ask a more focused question\n`;
            errorMessage += `   • Break down your request into smaller parts\n`;
            errorMessage += `   • Use --continue flag to start a new session with history`;
          }

          const errorEntry: ChatEntry = {
            type: "assistant",
            content: errorMessage,
            timestamp: new Date(),
          };
          setChatHistory((prev) => [...prev, errorEntry]);
          setIsStreaming(false);
        }

        setIsProcessing(false);
        processingStartTime.current = 0;
      })().catch((error: unknown) => {
        // Safety net: handle any uncaught errors from the async IIFE
        const errorObj = error instanceof Error ? error : new Error(String(error));
        const errorEntry: ChatEntry = {
          type: "assistant",
          content: `Unexpected error: ${errorObj.message}`,
          timestamp: new Date(),
        };
        setChatHistory((prev) => [...prev, errorEntry]);
        setIsStreaming(false);
        setIsProcessing(false);
        processingStartTime.current = 0;
      });

      clearInput();
      resetHistory();
      return true;
    }

    if (trimmedInput === "/retry") {
      // Find the last user message index and re-send it
      // Use findLastIndex instead of reverse().find() + lastIndexOf() to avoid object reference issues
      const lastUserIndex = chatHistory.findLastIndex((entry: { type: string }) => entry.type === "user");
      if (lastUserIndex >= 0 && chatHistory[lastUserIndex]?.content) {
        // Store the message content and history state before clearing
        const messageToRetry = chatHistory[lastUserIndex].content;
        const historyBackup = [...chatHistory];

        // Remove the last user message and any assistant responses after it
        setChatHistory(prev => prev.slice(0, lastUserIndex));
        clearInput();

        // Trigger submit after a brief delay to allow state update
        // Track timeout for cleanup on unmount
        retryTimeoutRef.current = setTimeout(() => {
          retryTimeoutRef.current = null;
          // BUG FIX: Properly handle async errors with explicit Promise chain
          // The catch must be attached immediately to prevent unhandled rejection
          void handleInputSubmit(messageToRetry).catch((error) => {
            // Log error for debugging, then restore history
            if (process.env.DEBUG || process.env.AX_DEBUG) {
              console.error('Retry failed:', error);
            }
            setChatHistory(historyBackup);
          });
        }, 50);
      } else {
        clearInput();
      }
      return true;
    }

    // Commands handled by the command registry:
    // /clear, /init, /help, /shortcuts, /terminal-setup, /usage, /doctor,
    // /mcp, /permissions, /exit, /memory, /theme, /model, /tasks, /task, /kill, /commands

    // MCP Prompt commands (format: /mcp__servername__promptname [args])
    if (trimmedInput.startsWith("/mcp__")) {
      const parts = trimmedInput.split(" ");
      const commandPart = parts[0];
      const argsPart = parts.slice(1).join(" ");

      const parsed = parsePromptCommand(commandPart);
      if (parsed) {
        const { serverName, promptName } = parsed;

        // Add user command to chat history
        const userEntry: ChatEntry = {
          type: "user",
          content: trimmedInput,
          timestamp: new Date(),
        };
        setChatHistory((prev) => [...prev, userEntry]);

        // Execute the prompt asynchronously
        (async () => {
          try {
            const manager = getMCPManager();
            const v2 = manager.getV2Instance();
            const { createServerName } = await import("../../mcp/client-v2.js");

            const serverNameBranded = createServerName(serverName);
            if (!serverNameBranded) {
              throw new Error(`Invalid server name: ${serverName}`);
            }

            // Parse arguments if provided (format: key=value key2=value2)
            const promptArgs: Record<string, string> = {};
            if (argsPart) {
              const argMatches = argsPart.match(/(\w+)=("[^"]+"|[^\s]+)/g);
              if (argMatches) {
                for (const match of argMatches) {
                  const [key, ...valueParts] = match.split("=");
                  let value = valueParts.join("=");
                  // Remove quotes if present
                  if (value.startsWith('"') && value.endsWith('"')) {
                    value = value.slice(1, -1);
                  }
                  promptArgs[key] = value;
                }
              }
            }

            const result = await v2.getPrompt(serverNameBranded, promptName, Object.keys(promptArgs).length > 0 ? promptArgs : undefined);

            if (!result.success) {
              throw result.error;
            }

            // Cast to GetPromptResult format for formatPromptResult
            const promptResult = result.value as { description?: string; messages: Array<{ role: string; content: string | { text: string } }> };
            const formattedContent = formatPromptResult(promptResult as any);

            // Add the prompt result as an assistant message
            const promptEntry: ChatEntry = {
              type: "assistant",
              content: `**MCP Prompt: ${serverName}/${promptName}**\n\n${formattedContent}`,
              timestamp: new Date(),
            };
            setChatHistory((prev) => [...prev, promptEntry]);

          } catch (error) {
            const errorMessage = extractErrorMessage(error);
            // Use assistant type with error content since "error" is not a valid ChatEntry type
            const errorEntry: ChatEntry = {
              type: "assistant",
              content: `❌ **Failed to execute MCP prompt:** ${errorMessage}`,
              timestamp: new Date(),
            };
            setChatHistory((prev) => [...prev, errorEntry]);
          }
        })();

        clearInput();
        return true;
      }
    }

    // /exit, /memory, /theme, /model, /tasks, /task, /kill are now handled by the command registry

    if (trimmedInput === "/rewind") {
      await handleRewindCommand(agent);
      clearInput();
      return true;
    }

    if (trimmedInput === "/checkpoints") {
      await handleCheckpointsCommand();
      clearInput();
      return true;
    }

    if (trimmedInput === "/checkpoint-clean") {
      await handleCheckpointCleanCommand();
      clearInput();
      return true;
    }

    // Plan commands
    if (trimmedInput === "/plans") {
      const result = await handlePlansCommand();
      const plansEntry: ChatEntry = {
        type: "assistant",
        content: result.output,
        timestamp: new Date(),
      };
      setChatHistory((prev) => [...prev, plansEntry]);
      clearInput();
      return true;
    }

    if (trimmedInput === "/plan" || trimmedInput.startsWith("/plan ")) {
      const planId = trimmedInput === "/plan" ? undefined : trimmedInput.substring(6).trim();
      const result = await handlePlanCommand(planId || undefined);
      const planEntry: ChatEntry = {
        type: "assistant",
        content: result.output,
        timestamp: new Date(),
      };
      setChatHistory((prev) => [...prev, planEntry]);
      clearInput();
      return true;
    }

    if (trimmedInput === "/phases") {
      const result = await handlePhasesCommand();
      const phasesEntry: ChatEntry = {
        type: "assistant",
        content: result.output,
        timestamp: new Date(),
      };
      setChatHistory((prev) => [...prev, phasesEntry]);
      clearInput();
      return true;
    }

    if (trimmedInput === "/pause") {
      const result = await handlePauseCommand();
      const pauseEntry: ChatEntry = {
        type: "assistant",
        content: result.output,
        timestamp: new Date(),
      };
      setChatHistory((prev) => [...prev, pauseEntry]);
      clearInput();
      return true;
    }

    if (trimmedInput === "/resume" || trimmedInput.startsWith("/resume ")) {
      const planId = trimmedInput === "/resume" ? undefined : trimmedInput.substring(8).trim();
      const result = await handleResumeCommand(planId || undefined);
      const resumeEntry: ChatEntry = {
        type: "assistant",
        content: result.output,
        timestamp: new Date(),
      };
      setChatHistory((prev) => [...prev, resumeEntry]);
      clearInput();
      return true;
    }

    if (trimmedInput === "/skip") {
      const result = await handleSkipPhaseCommand();
      const skipEntry: ChatEntry = {
        type: "assistant",
        content: result.output,
        timestamp: new Date(),
      };
      setChatHistory((prev) => [...prev, skipEntry]);
      clearInput();
      return true;
    }

    if (trimmedInput === "/abandon") {
      const result = await handleAbandonCommand();
      const abandonEntry: ChatEntry = {
        type: "assistant",
        content: result.output,
        timestamp: new Date(),
      };
      setChatHistory((prev) => [...prev, abandonEntry]);
      clearInput();
      return true;
    }

    if (trimmedInput === "/resumable") {
      const result = await handleResumableCommand();
      const resumableEntry: ChatEntry = {
        type: "assistant",
        content: result.output,
        timestamp: new Date(),
      };
      setChatHistory((prev) => [...prev, resumableEntry]);
      clearInput();
      return true;
    }

    if (trimmedInput === "/commit-and-push") {
      const userEntry: ChatEntry = {
        type: "user",
        content: "/commit-and-push",
        timestamp: new Date(),
      };
      setChatHistory((prev) => [...prev, userEntry]);

      setIsProcessing(true);
      setIsStreaming(true);

      try {
        // First check if there are any changes at all
        const initialStatusResult = await agent.executeBashCommand(
          "git status --porcelain"
        );

        if (
          !initialStatusResult.success ||
          !initialStatusResult.output?.trim()
        ) {
          const noChangesEntry: ChatEntry = {
            type: "assistant",
            content: "No changes to commit. Working directory is clean.",
            timestamp: new Date(),
          };
          setChatHistory((prev) => [...prev, noChangesEntry]);
          setIsProcessing(false);
          setIsStreaming(false);
          setInput("");
          return true;
        }

        // Add all changes
        const addResult = await agent.executeBashCommand("git add .");

        if (!addResult.success) {
          const addErrorEntry: ChatEntry = {
            type: "assistant",
            content: `Failed to stage changes: ${
              addResult.error || "Unknown error"
            }`,
            timestamp: new Date(),
          };
          setChatHistory((prev) => [...prev, addErrorEntry]);
          setIsProcessing(false);
          setIsStreaming(false);
          setInput("");
          return true;
        }

        // Show that changes were staged
        const addEntry: ChatEntry = {
          type: "tool_result",
          content: "Changes staged successfully",
          timestamp: new Date(),
          toolCall: {
            id: `git_add_${Date.now()}`,
            type: "function",
            function: {
              name: "bash",
              arguments: JSON.stringify({ command: "git add ." }),
            },
          },
          toolResult: addResult,
        };
        setChatHistory((prev) => [...prev, addEntry]);

        // Get staged changes for commit message generation
        const diffResult = await agent.executeBashCommand("git diff --cached");

        // Generate commit message using AI
        const commitPrompt = `Generate a concise, professional git commit message for these changes:

Git Status:
${initialStatusResult.output}

Git Diff (staged changes):
${diffResult.output || "No staged changes shown"}

Follow conventional commit format (feat:, fix:, docs:, etc.) and keep it under 72 characters.
Respond with ONLY the commit message, no additional text.`;

        let commitMessage = "";
        let streamingEntry: ChatEntry | null = null;

        for await (const chunk of agent.processUserMessageStream(
          commitPrompt
        )) {
          if (chunk.type === "content" && chunk.content) {
            if (!streamingEntry) {
              const newEntry = {
                type: "assistant" as const,
                content: `Generating commit message...\n\n${chunk.content}`,
                timestamp: new Date(),
                isStreaming: true,
              };
              setChatHistory((prev) => [...prev, newEntry]);
              streamingEntry = newEntry;
              commitMessage = chunk.content;
            } else {
              commitMessage += chunk.content;
              setChatHistory((prev) =>
                prev.map((entry, idx) =>
                  idx === prev.length - 1 && entry.isStreaming
                    ? {
                        ...entry,
                        content: `Generating commit message...\n\n${commitMessage}`,
                      }
                    : entry
                )
              );
            }
          } else if (chunk.type === "done") {
            if (streamingEntry) {
              setChatHistory((prev) =>
                prev.map((entry) =>
                  entry.isStreaming
                    ? {
                        ...entry,
                        content: `Generated commit message: "${commitMessage.trim()}"`,
                        isStreaming: false,
                      }
                    : entry
                )
              );
            }
            break;
          }
        }

        // Execute the commit with properly escaped message to prevent command injection
        const cleanCommitMessage = commitMessage.trim();
        const commitCommand = `git commit -m ${escapeShellArg(cleanCommitMessage)}`;
        const commitResult = await agent.executeBashCommand(commitCommand);

        const commitEntry: ChatEntry = {
          type: "tool_result",
          content: commitResult.success
            ? commitResult.output || "Commit successful"
            : commitResult.error || "Commit failed",
          timestamp: new Date(),
          toolCall: {
            id: `git_commit_${Date.now()}`,
            type: "function",
            function: {
              name: "bash",
              arguments: JSON.stringify({ command: commitCommand }),
            },
          },
          toolResult: commitResult,
        };
        setChatHistory((prev) => [...prev, commitEntry]);

        // If commit was successful, push to remote
        if (commitResult.success) {
          // First try regular push, if it fails try with upstream setup
          let pushResult = await agent.executeBashCommand("git push");
          let pushCommand = "git push";

          if (
            !pushResult.success &&
            pushResult.error?.includes("no upstream branch")
          ) {
            pushCommand = "git push -u origin HEAD";
            pushResult = await agent.executeBashCommand(pushCommand);
          }

          const pushEntry: ChatEntry = {
            type: "tool_result",
            content: pushResult.success
              ? pushResult.output || "Push successful"
              : pushResult.error || "Push failed",
            timestamp: new Date(),
            toolCall: {
              id: `git_push_${Date.now()}`,
              type: "function",
              function: {
                name: "bash",
                arguments: JSON.stringify({ command: pushCommand }),
              },
            },
            toolResult: pushResult,
          };
          setChatHistory((prev) => [...prev, pushEntry]);
        }
      } catch (error: unknown) {
        const errorMessage = extractErrorMessage(error);
        const errorEntry: ChatEntry = {
          type: "assistant",
          content: `Error during commit and push: ${errorMessage}`,
          timestamp: new Date(),
        };
        setChatHistory((prev) => [...prev, errorEntry]);
      }

      setIsProcessing(false);
      setIsStreaming(false);
      clearInput();
      return true;
    }

    // /commands is now handled by the command registry

    // Handle custom commands (starts with / but not a built-in command)
    if (trimmedInput.startsWith("/")) {
      const parts = trimmedInput.slice(1).split(/\s+/);
      const cmdName = parts[0];
      const cmdArgs = parts.slice(1).join(" ");

      if (customCommandsManager.hasCommand(cmdName)) {
        let expandedPrompt = customCommandsManager.expandCommand(cmdName, cmdArgs);
        if (expandedPrompt) {
          // Show what command was invoked
          const userEntry: ChatEntry = {
            type: "user",
            content: trimmedInput,
            timestamp: new Date(),
          };
          setChatHistory((prev) => [...prev, userEntry]);

          // Process the expanded prompt through the agent
          setIsProcessing(true);
          clearInput();

          try {
            // Apply hooks and file mentions to expanded prompt
            const hooksManager = getHooksManager();
            expandedPrompt = await hooksManager.processUserInput(expandedPrompt);

            const fileMentionResult = await parseFileMentions(expandedPrompt, {
              baseDir: process.cwd(),
              maxFileSize: 100 * 1024,
              maxMentions: 10,
              includeContents: true,
            });
            if (fileMentionResult.hasMentions) {
              expandedPrompt = fileMentionResult.expandedInput;
            }

            setIsStreaming(true);
            let streamingEntry: ChatEntry | null = null;

            for await (const chunk of agent.processUserMessageStream(expandedPrompt)) {
              switch (chunk.type) {
                case "content":
                  if (chunk.content) {
                    if (!streamingEntry) {
                      const newEntry: ChatEntry = {
                        type: "assistant",
                        content: chunk.content,
                        timestamp: new Date(),
                        isStreaming: true,
                      };
                      setChatHistory((prev) => [...prev, newEntry]);
                      streamingEntry = newEntry;
                    } else {
                      setChatHistory((prev) =>
                        prev.map((entry, idx) =>
                          idx === prev.length - 1 && entry.isStreaming
                            ? { ...entry, content: entry.content + chunk.content }
                            : entry
                        )
                      );
                    }
                  }
                  break;

                case "token_count":
                  if (chunk.tokenCount !== undefined) {
                    setTokenCount(chunk.tokenCount);
                  }
                  break;

                case "tool_calls":
                  if (chunk.toolCalls) {
                    setChatHistory((prev) =>
                      prev.map((entry) =>
                        entry.isStreaming
                          ? { ...entry, isStreaming: false, toolCalls: chunk.toolCalls }
                          : entry
                      )
                    );
                    streamingEntry = null;

                    chunk.toolCalls.forEach((toolCall) => {
                      const toolCallEntry: ChatEntry = {
                        type: "tool_call",
                        content: "Executing...",
                        timestamp: new Date(),
                        toolCall: toolCall,
                      };
                      setChatHistory((prev) => [...prev, toolCallEntry]);
                    });
                  }
                  break;

                case "tool_result":
                  if (chunk.toolCall && chunk.toolResult) {
                    setChatHistory((prev) =>
                      prev.map((entry) => {
                        if (entry.isStreaming) {
                          return { ...entry, isStreaming: false };
                        }
                        if (
                          entry.type === "tool_call" &&
                          entry.toolCall?.id === chunk.toolCall?.id
                        ) {
                          return {
                            ...entry,
                            type: "tool_result",
                            content: chunk.toolResult?.success
                              ? chunk.toolResult?.output || "Success"
                              : chunk.toolResult?.error || "Error occurred",
                            toolResult: chunk.toolResult,
                            executionDurationMs: chunk.executionDurationMs,
                          };
                        }
                        return entry;
                      })
                    );
                    streamingEntry = null;
                  }
                  break;

                case "done":
                  if (streamingEntry) {
                    setChatHistory((prev) =>
                      prev.map((entry) =>
                        entry.isStreaming ? { ...entry, isStreaming: false } : entry
                      )
                    );
                  }
                  setIsStreaming(false);
                  break;
              }
            }
          } catch (error: unknown) {
            const errorMessage = extractErrorMessage(error);
            const errorEntry: ChatEntry = {
              type: "assistant",
              content: `Error: ${errorMessage}`,
              timestamp: new Date(),
            };
            setChatHistory((prev) => [...prev, errorEntry]);
            setIsStreaming(false);
          }

          setIsProcessing(false);
          return true;
        }
      }
    }

    const directBashCommands = [
      "ls",
      "pwd",
      "cd",
      "cat",
      "mkdir",
      "touch",
      "echo",
      "grep",
      "find",
      "cp",
      "mv",
      "rm",
    ];
    // BUG FIX: Added fallback for empty input to prevent undefined access
    const firstWord = trimmedInput.split(" ")[0] || "";

    if (directBashCommands.includes(firstWord)) {
      const userEntry: ChatEntry = {
        type: "user",
        content: trimmedInput,
        timestamp: new Date(),
      };
      setChatHistory((prev) => [...prev, userEntry]);

      try {
        const result = await agent.executeBashCommand(trimmedInput);

        const commandEntry: ChatEntry = {
          type: "tool_result",
          content: result.success
            ? result.output || "Command completed"
            : result.error || "Command failed",
          timestamp: new Date(),
          toolCall: {
            id: `bash_${Date.now()}`,
            type: "function",
            function: {
              name: "bash",
              arguments: JSON.stringify({ command: trimmedInput }),
            },
          },
          toolResult: result,
        };
        setChatHistory((prev) => [...prev, commandEntry]);
      } catch (error: unknown) {
        const errorMessage = extractErrorMessage(error);
        const errorEntry: ChatEntry = {
          type: "assistant",
          content: `Error executing command: ${errorMessage}`,
          timestamp: new Date(),
        };
        setChatHistory((prev) => [...prev, errorEntry]);
      }

      clearInput();
      return true;
    }

    return false;
  };

  const processUserMessage = async (userInput: string) => {
    const userEntry: ChatEntry = {
      type: "user",
      content: userInput,
      timestamp: new Date(),
    };
    setChatHistory((prev) => [...prev, userEntry]);

    setIsProcessing(true);
    clearInput();

    try {
      // Process UserPromptSubmit hooks (may modify input)
      const hooksManager = getHooksManager();
      let processedInput = await hooksManager.processUserInput(userInput);

      // Check for image references (e.g., @image.png, /path/to/image.png)
      const imageResult = await parseImageInput(processedInput, process.cwd());

      // Show image processing errors if any
      if (imageResult.errors.length > 0) {
        const errorEntry: ChatEntry = {
          type: "assistant",
          content: `⚠️ Image processing warnings:\n${imageResult.errors.map(e => `  - ${e}`).join('\n')}`,
          timestamp: new Date(),
        };
        setChatHistory((prev) => [...prev, errorEntry]);
      }

      // If images found, show info about model switch
      if (imageResult.hasImages) {
        const imageInfo = imageResult.images.map((img, i) =>
          formatAttachmentForDisplay(img, i + 1)
        ).join('\n');

        const infoEntry: ChatEntry = {
          type: "assistant",
          content: `📷 Processing ${imageResult.images.length} image(s):\n${imageInfo}\n\n*Auto-switching to vision model for analysis*`,
          timestamp: new Date(),
        };
        setChatHistory((prev) => [...prev, infoEntry]);
      }

      // Parse and expand @file mentions (only if no images, to avoid conflicts)
      if (!imageResult.hasImages) {
        const fileMentionResult = await parseFileMentions(processedInput, {
          baseDir: process.cwd(),
          maxFileSize: 100 * 1024, // 100KB limit
          maxMentions: 10,
          includeContents: true,
        });

        // Use expanded input if file mentions were found
        processedInput = fileMentionResult.hasMentions
          ? fileMentionResult.expandedInput
          : processedInput;
      }

      // Agent-First Mode: Check if we should route to an AutomatosX agent
      // Skip for image inputs (not supported by agents) and when disabled
      if (!agentFirstDisabled && !imageResult.hasImages) {
        const settings = getSettingsManager();
        const agentFirstSettings = settings.getAgentFirstSettings();

        if (agentFirstSettings.enabled) {
          // Determine which agent to use
          const selectedAgent = forcedAgent || (() => {
            const routerConfig = {
              enabled: agentFirstSettings.enabled,
              defaultAgent: agentFirstSettings.defaultAgent,
              confidenceThreshold: agentFirstSettings.confidenceThreshold,
              excludedAgents: agentFirstSettings.excludedAgents,
            };
            const routingResult = routeToAgent(processedInput, routerConfig);
            return routingResult.agent;
          })();

          // If an agent is selected, execute via ax run
          if (selectedAgent) {
            onAgentSelected?.(selectedAgent);

            // Add routing info to chat
            const routingEntry: ChatEntry = {
              type: "assistant",
              content: `⚡ Routing to **${selectedAgent}** agent...`,
              timestamp: new Date(),
            };
            setChatHistory((prev) => [...prev, routingEntry]);

            setIsStreaming(true);
            let agentOutput = '';

            try {
              for await (const chunk of executeAgent({
                agent: selectedAgent,
                task: processedInput,
                streaming: true,
              })) {
                switch (chunk.type) {
                  case 'output':
                    if (chunk.content) {
                      agentOutput += chunk.content;
                      // Update the routing entry with accumulated output
                      setChatHistory((prev) =>
                        prev.map((entry, idx) =>
                          idx === prev.length - 1
                            ? { ...entry, content: `⚡ **${selectedAgent}** agent:\n\n${agentOutput}`, isStreaming: true }
                            : entry
                        )
                      );
                    }
                    break;
                  case 'error':
                    if (chunk.content) {
                      agentOutput += `\n⚠️ ${chunk.content}`;
                    }
                    break;
                  case 'done':
                    // Finalize the entry
                    setChatHistory((prev) =>
                      prev.map((entry, idx) =>
                        idx === prev.length - 1
                          ? { ...entry, content: `⚡ **${selectedAgent}** agent:\n\n${agentOutput}`, isStreaming: false }
                          : entry
                      )
                    );
                    break;
                }
              }
              // Agent execution succeeded
              setIsStreaming(false);
              setIsProcessing(false);
              // Keep agent name visible in status bar - don't reset to null
              return; // Agent handled the request
            } catch (agentError) {
              // Agent execution failed, show error and fall through to direct LLM
              const errorMessage = extractErrorMessage(agentError);
              setChatHistory((prev) =>
                prev.map((entry, idx) =>
                  idx === prev.length - 1
                    ? { ...entry, content: `⚡ **${selectedAgent}** agent failed:\n\n❌ ${errorMessage}\n\nFalling back to direct LLM...`, isStreaming: false }
                    : entry
                )
              );
              // Keep agent name visible even on failure (shows which agent was attempted)
              setIsStreaming(false);
              // Fall through to direct LLM processing below
            }
          }
        }
      }

      setIsStreaming(true);
      let streamingEntry: ChatEntry | null = null;

      // Build message content - multimodal if images, otherwise text
      const messageContent = imageResult.hasImages
        ? buildMessageContent(imageResult)
        : processedInput;

      for await (const chunk of agent.processUserMessageStream(messageContent)) {
        switch (chunk.type) {
          case "content":
            if (chunk.content !== undefined) {
              const shouldIgnore = shouldIgnoreContentChunk(chunk.content, !!streamingEntry);
              if (shouldIgnore) {
                break;
              }

              const contentChunk = chunk.content;

              if (!streamingEntry) {
                const newStreamingEntry = {
                  type: "assistant" as const,
                  content: contentChunk,
                  timestamp: new Date(),
                  isStreaming: true,
                };
                setChatHistory((prev) => [...prev, newStreamingEntry]);
                streamingEntry = newStreamingEntry;
              } else {
                setChatHistory((prev) =>
                  prev.map((entry, idx) =>
                    idx === prev.length - 1 && entry.isStreaming
                      ? { ...entry, content: entry.content + contentChunk }
                      : entry
                  )
                );
              }
            }
            break;

          case "token_count":
            if (chunk.tokenCount !== undefined) {
              setTokenCount(chunk.tokenCount);
            }
            break;

          case "tool_calls":
            if (chunk.toolCalls) {
              // Stop streaming for the current assistant message
              setChatHistory((prev) =>
                prev.map((entry) =>
                  entry.isStreaming
                    ? {
                        ...entry,
                        isStreaming: false,
                        toolCalls: chunk.toolCalls,
                      }
                    : entry
                )
              );
              streamingEntry = null;

              // Add individual tool call entries to show tools are being executed
              chunk.toolCalls.forEach((toolCall) => {
                const toolCallEntry: ChatEntry = {
                  type: "tool_call",
                  content: "Executing...",
                  timestamp: new Date(),
                  toolCall: toolCall,
                };
                setChatHistory((prev) => [...prev, toolCallEntry]);
              });
            }
            break;

          case "tool_result":
            if (chunk.toolCall && chunk.toolResult) {
              setChatHistory((prev) =>
                prev.map((entry) => {
                  if (entry.isStreaming) {
                    return { ...entry, isStreaming: false };
                  }
                  // Update the existing tool_call entry with the result
                  if (
                    entry.type === "tool_call" &&
                    entry.toolCall?.id === chunk.toolCall?.id
                  ) {
                    return {
                      ...entry,
                      type: "tool_result",
                      content: chunk.toolResult?.success
                        ? chunk.toolResult?.output || "Success"
                        : chunk.toolResult?.error || "Error occurred",
                      toolResult: chunk.toolResult,
                      executionDurationMs: chunk.executionDurationMs,
                    };
                  }
                  return entry;
                })
              );
              streamingEntry = null;
            }
            break;

          case "done":
            if (streamingEntry) {
              setChatHistory((prev) =>
                prev.map((entry) =>
                  entry.isStreaming ? { ...entry, isStreaming: false } : entry
                )
              );
            }
            setIsStreaming(false);
            break;
        }
      }
    } catch (error: unknown) {
      const errorMessage = extractErrorMessage(error);
      const errorEntry: ChatEntry = {
        type: "assistant",
        content: `Error: ${errorMessage}`,
        timestamp: new Date(),
      };
      setChatHistory((prev) => [...prev, errorEntry]);
      setIsStreaming(false);
    }

    setIsProcessing(false);
    processingStartTime.current = 0;
  };


  return {
    input,
    cursorPosition,
    showCommandSuggestions,
    selectedCommandIndex,
    commandSuggestions,
    resourceSuggestions,
    suggestionMode,
    availableModels,
    agent,
    autoEditEnabled,
    verboseMode,
    verbosityLevel,
    backgroundMode,
    thinkingModeEnabled,
    pastedBlocks,
    currentBlockAtCursor,
    isPasting,
    toggleVerbosity: handleVerboseToggle,
    toggleAutoEdit: toggleAutoEditMode,
    toggleThinkingMode: handleThinkingModeToggle,
    toggleBackgroundMode: handleBackgroundModeToggle,
  };
}

/**
 * Determine whether a streaming content chunk should be ignored.
 * We ignore whitespace-only chunks before any assistant content exists to avoid
 * creating empty assistant messages that break tool grouping.
 */
export function shouldIgnoreContentChunk(content: string | undefined, hasActiveStreamingEntry: boolean): boolean {
  if (hasActiveStreamingEntry) return false;
  return !content || content.trim() === "";
}
