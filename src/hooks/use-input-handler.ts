import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useInput } from "ink";
import { LLMAgent, ChatEntry } from "../agent/llm-agent.js";
import { ConfirmationService } from "../utils/confirmation-service.js";
import { useEnhancedInput, Key } from "./use-enhanced-input.js";

import { filterCommandSuggestions } from "../ui/components/command-suggestions.js";
import { getSettingsManager } from "../utils/settings-manager.js";
import { ProjectAnalyzer } from "../utils/project-analyzer.js";
import { InstructionGenerator } from "../utils/instruction-generator.js";
import { getUsageTracker } from "../utils/usage-tracker.js";
import { getHistoryManager } from "../utils/history-manager.js";
import { handleRewindCommand, handleCheckpointsCommand, handleCheckpointCleanCommand } from "../commands/rewind.js";
import {
  handlePlansCommand,
  handlePlanCommand,
  handlePhasesCommand,
  handlePauseCommand,
  handleResumeCommand,
  handleSkipPhaseCommand,
  handleAbandonCommand,
  handleResumableCommand,
} from "../commands/plan.js";
import { BashOutputTool } from "../tools/bash-output.js";
import { getKeyboardShortcutGuideText } from "../ui/components/keyboard-hints.js";
import {
  getContextStore,
  ContextGenerator,
  getStatsCollector,
} from "../memory/index.js";
import * as fs from "fs";
import * as path from "path";

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
}: UseInputHandlerProps) {
  const [showCommandSuggestions, setShowCommandSuggestions] = useState(false);
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [autoEditEnabled, setAutoEditEnabled] = useState(() => {
    const confirmationService = ConfirmationService.getInstance();
    const sessionFlags = confirmationService.getSessionFlags();
    return sessionFlags.allOperations;
  });
  const [verboseMode, setVerboseMode] = useState(false);
  const [backgroundMode, setBackgroundMode] = useState(false);

  const handleSpecialKey = (key: Key): boolean => {
    // Don't handle input if confirmation dialog is active
    if (isConfirmationActive) {
      return true; // Prevent default handling
    }

    // Handle shift+tab to toggle auto-edit mode
    if (key.shift && key.tab) {
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
      return true; // Handled
    }

    // Handle escape key for closing menus
    if (key.escape) {
      if (showCommandSuggestions) {
        setShowCommandSuggestions(false);
        setSelectedCommandIndex(0);
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

    // Handle command suggestions navigation
    if (showCommandSuggestions) {
      const filteredSuggestions = filterCommandSuggestions(
        commandSuggestions,
        input
      );

      if (filteredSuggestions.length === 0) {
        setShowCommandSuggestions(false);
        setSelectedCommandIndex(0);
        return false; // Continue processing
      } else {
        if (key.upArrow) {
          setSelectedCommandIndex((prev) =>
            prev === 0 ? filteredSuggestions.length - 1 : prev - 1
          );
          return true;
        }
        if (key.downArrow) {
          setSelectedCommandIndex(
            (prev) => (prev + 1) % filteredSuggestions.length
          );
          return true;
        }
        if (key.tab || key.return) {
          // Check if there are any suggestions available
          if (filteredSuggestions.length === 0) {
            return true; // No suggestions, do nothing
          }

          const safeIndex = Math.min(
            selectedCommandIndex,
            filteredSuggestions.length - 1
          );
          const selectedCommand = filteredSuggestions[safeIndex];
          const newInput = selectedCommand.command + " ";
          setInput(newInput);
          setCursorPosition(newInput.length);
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
        await processUserMessage(userInput);
      }
    }
  };

  const handleInputChange = useCallback((newInput: string) => {
    // Update command suggestions based on input
    if (newInput.startsWith("/")) {
      setShowCommandSuggestions(true);
      setSelectedCommandIndex(0);
    } else {
      setShowCommandSuggestions(false);
      setSelectedCommandIndex(0);
    }
  }, []);

  const handleVerboseToggle = useCallback(() => {
    setVerboseMode((prev) => {
      const newState = !prev;
      // Notify parent for toast/flash feedback instead of polluting chat history
      onVerboseModeChange?.(newState);
      return newState;
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

  const {
    input,
    cursorPosition,
    setInput,
    setCursorPosition,
    clearInput,
    resetHistory,
    handleInput,
  } = useEnhancedInput({
    onSubmit: handleInputSubmit,
    onSpecialKey: handleSpecialKey,
    onVerboseToggle: handleVerboseToggle,
    onQuickActions: onQuickActionsToggle,
    onBackgroundModeToggle: handleBackgroundModeToggle,
    onCopyLastResponse,
    disabled: isConfirmationActive,
  });

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
      }
    };
  }, []);

  const commandSuggestions: CommandSuggestion[] = [
    { command: "/help", description: "Show help information" },
    { command: "/shortcuts", description: "Show keyboard shortcuts guide" },
    { command: "/continue", description: "Continue incomplete response" },
    { command: "/retry", description: "Re-send the last message" },
    { command: "/clear", description: "Clear chat history" },
    { command: "/init", description: "Initialize project with smart analysis" },
    { command: "/usage", description: "Show API usage statistics" },
    { command: "/tasks", description: "List background tasks" },
    { command: "/task", description: "View output of a background task" },
    { command: "/kill", description: "Kill a background task" },
    { command: "/rewind", description: "Rewind to previous checkpoint" },
    { command: "/checkpoints", description: "List checkpoint statistics" },
    { command: "/checkpoint-clean", description: "Clean old checkpoints" },
    { command: "/commit-and-push", description: "AI commit & push to remote" },
    { command: "/plans", description: "List all task plans" },
    { command: "/plan", description: "Show current plan details" },
    { command: "/phases", description: "Show phases of current plan" },
    { command: "/pause", description: "Pause current plan execution" },
    { command: "/resume", description: "Resume paused plan" },
    { command: "/skip", description: "Skip current phase" },
    { command: "/abandon", description: "Abandon current plan" },
    { command: "/memory", description: "Show project memory status" },
    { command: "/memory warmup", description: "Generate project memory" },
    { command: "/memory refresh", description: "Update project memory" },
    { command: "/exit", description: "Exit the application" },
  ];

  // Load models from configuration with fallback to defaults
  const availableModels: ModelOption[] = useMemo(() => {
    const settingsManager = getSettingsManager();
    const models = settingsManager.getAvailableModels();
    return models.map(m => ({ model: m }));
  }, []);

  const handleDirectCommand = async (input: string): Promise<boolean> => {
    const trimmedInput = input.trim();

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
        } catch (error: any) {
          let errorMessage = `Error: ${error.message}`;

          // Provide helpful guidance for timeout errors during /continue
          if (error.message && error.message.includes('timeout')) {
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
      })();

      clearInput();
      resetHistory();
      return true;
    }

    if (trimmedInput === "/retry") {
      // Find the last user message index and re-send it
      // Use findLastIndex instead of reverse().find() + lastIndexOf() to avoid object reference issues
      const lastUserIndex = chatHistory.findLastIndex(entry => entry.type === "user");
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
          try {
            handleInputSubmit(messageToRetry);
          } catch {
            // Restore history if retry fails
            setChatHistory(historyBackup);
          }
        }, 50);
      } else {
        clearInput();
      }
      return true;
    }

    if (trimmedInput === "/clear") {
      // Reset chat history
      setChatHistory([]);

      // Clear saved history from disk
      const historyManager = getHistoryManager();
      historyManager.clearHistory();

      // Reset processing states
      setIsProcessing(false);
      setIsStreaming(false);
      setTokenCount(0);
      setProcessingTime(0);
      processingStartTime.current = 0;

      // Reset confirmation service session flags
      const confirmationService = ConfirmationService.getInstance();
      confirmationService.resetSession();

      // Notify parent for toast feedback
      onChatCleared?.();

      clearInput();
      resetHistory();
      return true;
    }

    if (trimmedInput === "/init") {
      const userEntry: ChatEntry = {
        type: "user",
        content: "/init",
        timestamp: new Date(),
      };
      setChatHistory((prev) => [...prev, userEntry]);

      setIsProcessing(true);

      try {
        const projectRoot = process.cwd();

        // Add analysis message
        const analyzingEntry: ChatEntry = {
          type: "assistant",
          content: "🔍 Analyzing project...\n",
          timestamp: new Date(),
        };
        setChatHistory((prev) => [...prev, analyzingEntry]);

        // Check if already initialized
        const axCliDir = path.join(projectRoot, ".ax-cli");
        const customMdPath = path.join(axCliDir, "CUSTOM.md");
        const indexPath = path.join(axCliDir, "index.json");

        if (fs.existsSync(customMdPath)) {
          const alreadyInitEntry: ChatEntry = {
            type: "assistant",
            content: `✅ Project already initialized!\n📝 Custom instructions: ${customMdPath}\n📊 Project index: ${indexPath}\n\n💡 Run 'ax-cli init --force' from terminal to regenerate`,
            timestamp: new Date(),
          };
          setChatHistory((prev) => [...prev, alreadyInitEntry]);
          setIsProcessing(false);
          clearInput();
          return true;
        }

        // Analyze project
        const analyzer = new ProjectAnalyzer(projectRoot);
        const result = await analyzer.analyze();

        if (!result.success || !result.projectInfo) {
          const errorEntry: ChatEntry = {
            type: "assistant",
            content: `❌ Failed to analyze project: ${result.error || "Unknown error"}`,
            timestamp: new Date(),
          };
          setChatHistory((prev) => [...prev, errorEntry]);
          setIsProcessing(false);
          clearInput();
          return true;
        }

        const projectInfo = result.projectInfo;

        // Generate instructions
        const generator = new InstructionGenerator();
        const instructions = generator.generateInstructions(projectInfo);
        const index = generator.generateIndex(projectInfo);

        // Create .ax-cli directory
        if (!fs.existsSync(axCliDir)) {
          fs.mkdirSync(axCliDir, { recursive: true });
        }

        // Write custom instructions
        fs.writeFileSync(customMdPath, instructions, "utf-8");

        // Write project index
        fs.writeFileSync(indexPath, index, "utf-8");

        // Display success
        let successMessage = `🎉 Project initialized successfully!\n\n`;
        successMessage += `📋 Analysis Results:\n`;
        successMessage += `   Name: ${projectInfo.name}\n`;
        successMessage += `   Type: ${projectInfo.projectType}\n`;
        successMessage += `   Language: ${projectInfo.primaryLanguage}\n`;
        if (projectInfo.techStack.length > 0) {
          successMessage += `   Stack: ${projectInfo.techStack.join(", ")}\n`;
        }
        successMessage += `\n✅ Generated custom instructions: ${customMdPath}\n`;
        successMessage += `✅ Generated project index: ${indexPath}\n\n`;
        successMessage += `💡 Next steps:\n`;
        successMessage += `   1. Review and customize the instructions if needed\n`;
        successMessage += `   2. Run AX CLI - it will automatically use these instructions\n`;
        successMessage += `   3. Use 'ax-cli init --force' to regenerate after project changes`;

        const successEntry: ChatEntry = {
          type: "assistant",
          content: successMessage,
          timestamp: new Date(),
        };
        setChatHistory((prev) => [...prev, successEntry]);
      } catch (error) {
        const errorEntry: ChatEntry = {
          type: "assistant",
          content: `❌ Error during initialization: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
          timestamp: new Date(),
        };
        setChatHistory((prev) => [...prev, errorEntry]);
      }

      setIsProcessing(false);
      clearInput();
      return true;
    }

    if (trimmedInput === "/help") {
      const helpEntry: ChatEntry = {
        type: "assistant",
        content: `AX CLI Help:

Built-in Commands:
  /continue   - Continue incomplete response from where it left off
  /clear      - Clear chat history
  /init       - Initialize project with smart analysis
  /help       - Show this help
  /shortcuts  - Show keyboard shortcuts guide
  /usage      - Show API usage statistics
  /exit       - Exit application
  exit, quit  - Exit application

Background Task Commands:
  /tasks             - List all background tasks
  /task <id>         - View output of a background task
  /kill <id>         - Kill a running background task

  Tip: Append ' &' to any bash command to run it in background
       Example: npm run dev &

Checkpoint Commands:
  /rewind            - Rewind to a previous checkpoint (interactive)
  /checkpoints       - Show checkpoint statistics
  /checkpoint-clean  - Clean old checkpoints (compress and prune)

Plan Commands (Multi-Phase Task Planning):
  /plans             - List all task plans
  /plan [id]         - Show current or specific plan details
  /phases            - Show phases of current plan
  /pause             - Pause current plan execution
  /resume [id]       - Resume current or specific plan
  /skip              - Skip current phase
  /abandon           - Abandon current plan

Git Commands:
  /commit-and-push - AI-generated commit + push to remote

Memory Commands (z.ai GLM-4.6 caching):
  /memory          - Show project memory status
  /memory warmup   - Generate project memory context
  /memory refresh  - Update memory after changes

Enhanced Input Features:
  ↑/↓ Arrow   - Navigate command history
  Ctrl+C      - Clear input (press twice to exit)
  Ctrl+X      - Clear entire input line
  Ctrl+←/→    - Move by word
  Ctrl+A/E    - Move to line start/end
  Ctrl+W      - Delete word before cursor
  Ctrl+K      - Delete to end of line
  Ctrl+U      - Delete to start of line
  Ctrl+O      - Toggle verbose mode (show full output, default: concise)
  Ctrl+B      - Toggle background mode (run all commands in background)
  Shift+Tab   - Toggle auto-edit mode (bypass confirmations)
  1-4 keys    - Quick select in confirmation dialogs

Direct Commands (executed immediately):
  ls [path]   - List directory contents
  pwd         - Show current directory
  cd <path>   - Change directory
  cat <file>  - View file contents
  mkdir <dir> - Create directory
  touch <file>- Create empty file

Model Configuration:
  Edit ~/.ax-cli/config.json to configure default model and settings

For complex operations, just describe what you want in natural language.
Examples:
  "edit package.json and add a new script"
  "create a new React component called Header"
  "show me all TypeScript files in this project"`,
        timestamp: new Date(),
      };
      setChatHistory((prev) => [...prev, helpEntry]);
      clearInput();
      return true;
    }

    if (trimmedInput === "/shortcuts") {
      const shortcutsEntry: ChatEntry = {
        type: "assistant",
        content: getKeyboardShortcutGuideText(),
        timestamp: new Date(),
      };
      setChatHistory((prev) => [...prev, shortcutsEntry]);
      clearInput();
      return true;
    }

    if (trimmedInput === "/usage") {
      const tracker = getUsageTracker();
      const stats = tracker.getSessionStats();

      let usageContent = "📊 **API Usage & Limits (Z.AI)**\n\n";

      // Session statistics
      usageContent += "**📱 Current Session:**\n";
      if (stats.totalRequests === 0) {
        usageContent += "  No API requests made yet. Ask me something to start tracking!\n";
      } else {
        usageContent += `  • Requests: ${stats.totalRequests.toLocaleString()}\n`;
        usageContent += `  • Prompt Tokens: ${stats.totalPromptTokens.toLocaleString()}\n`;
        usageContent += `  • Completion Tokens: ${stats.totalCompletionTokens.toLocaleString()}\n`;
        usageContent += `  • Total Tokens: ${stats.totalTokens.toLocaleString()}\n`;

        if (stats.totalReasoningTokens > 0) {
          usageContent += `  • Reasoning Tokens: ${stats.totalReasoningTokens.toLocaleString()}\n`;
        }

        if (stats.byModel.size > 0) {
          usageContent += `\n  **Models Used:**\n`;
          for (const [model, modelStats] of stats.byModel.entries()) {
            usageContent += `    - ${model}: ${modelStats.totalTokens.toLocaleString()} tokens (${modelStats.requests} requests)\n`;
          }
        }
      }

      // Z.AI account information
      usageContent += `\n**🔑 Z.AI Account Usage & Limits:**\n`;
      usageContent += `  ⚠️  API does not provide programmatic access to usage data\n`;
      usageContent += `\n  **Check your account:**\n`;
      usageContent += `  • Billing & Usage: https://z.ai/manage-apikey/billing\n`;
      usageContent += `  • Rate Limits: https://z.ai/manage-apikey/rate-limits\n`;
      usageContent += `  • API Keys: https://z.ai/manage-apikey/apikey-list\n`;

      usageContent += `\n**ℹ️  Notes:**\n`;
      usageContent += `  • Billing reflects previous day (n-1) consumption\n`;
      usageContent += `  • Current day usage may not be immediately visible\n`;
      usageContent += `  • Cached content: 1/5 of original price\n`;

      usageContent += `\n**💰 GLM-4.6 Pricing:**\n`;
      usageContent += `  • Input: $0.11 per 1M tokens\n`;
      usageContent += `  • Output: $0.28 per 1M tokens\n`;

      if (stats.totalRequests > 0) {
        // Calculate estimated cost for this session
        const inputCost = (stats.totalPromptTokens / 1000000) * 0.11;
        const outputCost = (stats.totalCompletionTokens / 1000000) * 0.28;
        const totalCost = inputCost + outputCost;
        usageContent += `\n**💵 Estimated Session Cost:**\n`;
        usageContent += `  • Input: $${inputCost.toFixed(6)} (${stats.totalPromptTokens.toLocaleString()} tokens)\n`;
        usageContent += `  • Output: $${outputCost.toFixed(6)} (${stats.totalCompletionTokens.toLocaleString()} tokens)\n`;
        usageContent += `  • **Total: ~$${totalCost.toFixed(6)}**\n`;
      }

      const usageEntry: ChatEntry = {
        type: "assistant",
        content: usageContent,
        timestamp: new Date(),
      };
      setChatHistory((prev) => [...prev, usageEntry]);
      clearInput();
      return true;
    }

    if (trimmedInput === "/exit") {
      process.exit(0);
      return true;
    }

    // Memory commands
    if (trimmedInput === "/memory" || trimmedInput === "/memory status") {
      const store = getContextStore();
      const metadata = store.getMetadata();

      let memoryContent = "🧠 **Project Memory Status**\n\n";

      if (!metadata.exists) {
        memoryContent += "❌ No project memory found.\n\n";
        memoryContent += "Run `/memory warmup` to generate project memory for z.ai caching.\n";
      } else {
        memoryContent += `✅ Memory initialized\n\n`;
        memoryContent += `**Token Estimate:** ${metadata.tokenEstimate?.toLocaleString() || 'N/A'} tokens\n`;
        memoryContent += `**Last Updated:** ${metadata.updatedAt ? new Date(metadata.updatedAt).toLocaleString() : 'N/A'}\n`;
        memoryContent += `**Usage Count:** ${metadata.usageCount || 0}\n`;

        // Try to get section breakdown
        const loadResult = store.load();
        if (loadResult.success) {
          const sections = loadResult.data.context.sections;
          memoryContent += `\n**📊 Token Distribution:**\n`;
          const total = Object.values(sections).reduce((a, b) => a + b, 0);
          for (const [name, tokens] of Object.entries(sections)) {
            const pct = total > 0 ? Math.round((tokens / total) * 100) : 0;
            const bar = '█'.repeat(Math.round(pct / 5)) + '░'.repeat(20 - Math.round(pct / 5));
            memoryContent += `   ${bar}  ${name.charAt(0).toUpperCase() + name.slice(1)}  (${pct}%)\n`;
          }
        }

        // Show cache stats if available
        const statsCollector = getStatsCollector();
        const formattedStats = statsCollector.getFormattedStats();
        if (formattedStats && formattedStats.usageCount > 0) {
          memoryContent += `\n**💾 Cache Statistics:**\n`;
          memoryContent += `   • Usage Count: ${formattedStats.usageCount}\n`;
          memoryContent += `   • Tokens Saved: ${formattedStats.tokensSaved.toLocaleString()}\n`;
          memoryContent += `   • Cache Rate: ${formattedStats.cacheRate}%\n`;
          memoryContent += `   • Est. Savings: $${formattedStats.estimatedSavings.toFixed(4)}\n`;
        }
      }

      const memoryEntry: ChatEntry = {
        type: "assistant",
        content: memoryContent,
        timestamp: new Date(),
      };
      setChatHistory((prev) => [...prev, memoryEntry]);
      clearInput();
      return true;
    }

    if (trimmedInput === "/memory warmup") {
      setIsProcessing(true);

      const warmupEntry: ChatEntry = {
        type: "assistant",
        content: "🔄 Generating project memory...",
        timestamp: new Date(),
      };
      setChatHistory((prev) => [...prev, warmupEntry]);

      try {
        const generator = new ContextGenerator();
        const result = await generator.generate();

        if (result.success) {
          const store = getContextStore();
          const saveResult = store.save(result.memory!);

          if (saveResult.success) {
            const sections = result.memory!.context.sections;
            let resultContent = `✅ Project memory generated (${result.memory!.context.token_estimate.toLocaleString()} tokens)\n\n`;
            resultContent += `**📊 Context breakdown:**\n`;
            for (const [name, tokens] of Object.entries(sections)) {
              const tokenCount = tokens as number;
              const pct = Math.round((tokenCount / result.memory!.context.token_estimate) * 100);
              resultContent += `   ${name.charAt(0).toUpperCase() + name.slice(1)}: ${tokenCount.toLocaleString()} tokens (${pct}%)\n`;
            }
            resultContent += `\n💾 Saved to .ax-cli/memory.json`;

            setChatHistory((prev) => {
              const updated = [...prev];
              updated[updated.length - 1] = {
                type: "assistant",
                content: resultContent,
                timestamp: new Date(),
              };
              return updated;
            });
          } else {
            throw new Error(saveResult.error);
          }
        } else {
          throw new Error(result.error);
        }
      } catch (error: any) {
        setChatHistory((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            type: "assistant",
            content: `❌ Failed to generate memory: ${error.message}`,
            timestamp: new Date(),
          };
          return updated;
        });
      }

      setIsProcessing(false);
      clearInput();
      return true;
    }

    if (trimmedInput === "/memory refresh") {
      setIsProcessing(true);

      const refreshEntry: ChatEntry = {
        type: "assistant",
        content: "🔄 Refreshing project memory...",
        timestamp: new Date(),
      };
      setChatHistory((prev) => [...prev, refreshEntry]);

      try {
        const store = getContextStore();
        const existing = store.load();
        const generator = new ContextGenerator();
        const result = await generator.generate();

        if (result.success) {
          const hasChanges = !existing.success ||
            existing.data.content_hash !== result.memory!.content_hash;

          if (hasChanges) {
            const saveResult = store.save(result.memory!);
            if (saveResult.success) {
              setChatHistory((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  type: "assistant",
                  content: `✅ Memory updated (${result.memory!.context.token_estimate.toLocaleString()} tokens)`,
                  timestamp: new Date(),
                };
                return updated;
              });
            } else {
              throw new Error(saveResult.error);
            }
          } else {
            setChatHistory((prev) => {
              const updated = [...prev];
              updated[updated.length - 1] = {
                type: "assistant",
                content: `✅ No changes detected - memory is up to date`,
                timestamp: new Date(),
              };
              return updated;
            });
          }
        } else {
          throw new Error(result.error);
        }
      } catch (error: any) {
        setChatHistory((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            type: "assistant",
            content: `❌ Failed to refresh memory: ${error.message}`,
            timestamp: new Date(),
          };
          return updated;
        });
      }

      setIsProcessing(false);
      clearInput();
      return true;
    }

    // Background task commands
    if (trimmedInput === "/tasks") {
      const bashOutputTool = new BashOutputTool();
      const result = bashOutputTool.listTasks();
      const tasksEntry: ChatEntry = {
        type: "assistant",
        content: result.output || "No background tasks",
        timestamp: new Date(),
      };
      setChatHistory((prev) => [...prev, tasksEntry]);
      clearInput();
      return true;
    }

    if (trimmedInput.startsWith("/task ")) {
      const taskId = trimmedInput.substring(6).trim();
      if (!taskId) {
        const errorEntry: ChatEntry = {
          type: "assistant",
          content: "Usage: /task <task_id>",
          timestamp: new Date(),
        };
        setChatHistory((prev) => [...prev, errorEntry]);
        clearInput();
        return true;
      }

      const bashOutputTool = new BashOutputTool();
      const result = await bashOutputTool.execute(taskId);
      const taskEntry: ChatEntry = {
        type: "assistant",
        content: result.success ? result.output || "No output" : result.error || "Task not found",
        timestamp: new Date(),
      };
      setChatHistory((prev) => [...prev, taskEntry]);
      clearInput();
      return true;
    }

    if (trimmedInput.startsWith("/kill ")) {
      const taskId = trimmedInput.substring(6).trim();
      if (!taskId) {
        const errorEntry: ChatEntry = {
          type: "assistant",
          content: "Usage: /kill <task_id>",
          timestamp: new Date(),
        };
        setChatHistory((prev) => [...prev, errorEntry]);
        clearInput();
        return true;
      }

      const bashOutputTool = new BashOutputTool();
      const result = bashOutputTool.killTask(taskId);
      const killEntry: ChatEntry = {
        type: "assistant",
        content: result.success ? result.output || "Task killed" : result.error || "Failed to kill task",
        timestamp: new Date(),
      };
      setChatHistory((prev) => [...prev, killEntry]);
      clearInput();
      return true;
    }

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

        // Execute the commit
        const cleanCommitMessage = commitMessage
          .trim()
          .replace(/^["']|["']$/g, "");
        const commitCommand = `git commit -m "${cleanCommitMessage}"`;
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
      } catch (error: any) {
        const errorEntry: ChatEntry = {
          type: "assistant",
          content: `Error during commit and push: ${error.message}`,
          timestamp: new Date(),
        };
        setChatHistory((prev) => [...prev, errorEntry]);
      }

      setIsProcessing(false);
      setIsStreaming(false);
      clearInput();
      return true;
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
    const firstWord = trimmedInput.split(" ")[0];

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
      } catch (error: any) {
        const errorEntry: ChatEntry = {
          type: "assistant",
          content: `Error executing command: ${error.message}`,
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
      setIsStreaming(true);
      let streamingEntry: ChatEntry | null = null;

      for await (const chunk of agent.processUserMessageStream(userInput)) {
        switch (chunk.type) {
          case "content":
            if (chunk.content) {
              if (!streamingEntry) {
                const newStreamingEntry = {
                  type: "assistant" as const,
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
    } catch (error: any) {
      const errorEntry: ChatEntry = {
        type: "assistant",
        content: `Error: ${error.message}`,
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
    availableModels,
    agent,
    autoEditEnabled,
    verboseMode,
    backgroundMode,
  };
}
