import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Box } from "ink";
import { LLMAgent, ChatEntry } from "../../agent/llm-agent.js";
import { useInputHandler } from "../hooks/use-input-handler.js";
import { LoadingSpinner } from "./loading-spinner.js";
import { CommandSuggestions } from "./command-suggestions.js";
import { ChatHistory } from "./chat-history.js";
import { ChatInput } from "./chat-input.js";
import { StatusBar } from "./status-bar.js";
import { QuickActions } from "./quick-actions.js";
import { WelcomePanel } from "./welcome-panel.js";
import ConfirmationDialog from "./confirmation-dialog.js";
import QuestionDialog from "./question-dialog.js";
import { KeyboardHelp } from "./keyboard-help.js";
import { ContextBreakdown } from "./context-breakdown.js";
import { MCPDashboard } from "./mcp-dashboard.js";
import { ToastContainer, useToasts, TOAST_MESSAGES } from "./toast-notification.js";
import {
  ConfirmationService,
  ConfirmationOptions,
} from "../../utils/confirmation-service.js";
import {
  getAskUserService,
  type QuestionRequest,
} from "../../tools/ask-user.js";
import ApiKeyInput from "./api-key-input.js";
import { getVersion } from "../../utils/version.js";
import { getHistoryManager } from "../../utils/history-manager.js";
import { getMcpConnectionCount } from "../../llm/tools.js";
import { BackgroundTaskManager } from "../../utils/background-task-manager.js";
import { isAutomatosXAvailable } from "../../utils/automatosx-detector.js";
import { routeToAgent } from "../../agent/agent-router.js";
import { PhaseProgress } from "./phase-progress.js";
import { TaskPlan } from "../../planner/types.js";
import { GLM_MODELS } from "../../constants.js";
import { getSettingsManager } from "../../utils/settings-manager.js";
import clipboardy from "clipboardy";
import path from "path";

interface ChatInterfaceProps {
  agent?: LLMAgent;
  initialMessage?: string;
  loadPreviousHistory?: boolean; // For --continue flag
  agentFirstDisabled?: boolean; // --no-agent flag
  forcedAgent?: string; // --agent <name> flag
  cliName?: string; // CLI name for status bar (e.g., 'ax-glm', 'ax-grok')
}

// Get current project folder name
function getCurrentProjectName(): string {
  return path.basename(process.cwd());
}

function calculateContextBreakdown(
  totalTokens: number
): Array<{ label: string; tokens: number; percentage: number; color: string }> {
  // Guard against division by zero
  if (totalTokens <= 0) {
    return [
      { label: "System Instructions", tokens: 0, percentage: 0, color: "blue" },
      { label: "CLAUDE.md", tokens: 0, percentage: 0, color: "magenta" },
      { label: "Conversation History", tokens: 0, percentage: 0, color: "cyan" },
      { label: "Tool Definitions", tokens: 0, percentage: 0, color: "yellow" },
    ];
  }

  // Estimates based on typical usage patterns
  const systemInstructions = Math.floor(totalTokens * 0.15);
  const claudeMd = Math.floor(totalTokens * 0.05);
  const toolDefinitions = Math.floor(totalTokens * 0.05);
  const conversationHistory = totalTokens - systemInstructions - claudeMd - toolDefinitions;

  return [
    {
      label: "System Instructions",
      tokens: systemInstructions,
      percentage: (systemInstructions / totalTokens) * 100,
      color: "blue",
    },
    {
      label: "CLAUDE.md",
      tokens: claudeMd,
      percentage: (claudeMd / totalTokens) * 100,
      color: "magenta",
    },
    {
      label: "Conversation History",
      tokens: conversationHistory,
      percentage: (conversationHistory / totalTokens) * 100,
      color: "cyan",
    },
    {
      label: "Tool Definitions",
      tokens: toolDefinitions,
      percentage: (toolDefinitions / totalTokens) * 100,
      color: "yellow",
    },
  ];
}

// Main chat component that handles input when agent is available
function ChatInterfaceWithAgent({
  agent,
  initialMessage,
  loadPreviousHistory = false,
  agentFirstDisabled = false,
  forcedAgent,
  cliName = 'ax-cli',
}: {
  agent: LLMAgent;
  initialMessage?: string;
  loadPreviousHistory?: boolean;
  agentFirstDisabled?: boolean;
  forcedAgent?: string;
  cliName?: string;
}) {
  // Memoize history manager to avoid unnecessary function calls on every render
  const historyManager = useMemo(() => getHistoryManager(), []);
  const [chatHistory, setChatHistory] = useState<ChatEntry[]>(() => {
    // Load saved history on mount (for --continue flag)
    return loadPreviousHistory ? historyManager.loadHistory() : [];
  });
  // Command history (up/down arrows) is handled separately in use-input-history.ts
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingTime, setProcessingTime] = useState(0);
  const [tokenCount, setTokenCount] = useState(0);
  const [isStreaming, setIsStreaming] = useState(false);
  const [contextPercentage, setContextPercentage] = useState<number>(0);
  const [showAutoPrune, setShowAutoPrune] = useState(false);
  const [confirmationOptions, setConfirmationOptions] =
    useState<ConfirmationOptions | null>(null);
  const [questionRequest, setQuestionRequest] = useState<QuestionRequest | null>(null);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [showContextBreakdown, setShowContextBreakdown] = useState(false);
  const [showMcpDashboard, setShowMcpDashboard] = useState(false);
  // Flash states for mode toggle visual feedback
  const [flashAutoEdit, setFlashAutoEdit] = useState(false);
  const [flashVerbose, setFlashVerbose] = useState(false);
  const [flashBackground, setFlashBackground] = useState(false);
  const [flashThinkingMode, setFlashThinkingMode] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [axEnabled, setAxEnabled] = useState(false);
  const [activeAgent, setActiveAgent] = useState<string | null>(forcedAgent || null);
  const [activeAgents, setActiveAgents] = useState<string[]>([]);
  const [currentPlan, setCurrentPlan] = useState<TaskPlan | null>(null);
  // BUG FIX: Removed unused scrollRef - Ink Box doesn't support DOM scroll APIs
  const processingStartTime = useRef<number>(0);
  const lastPercentageRef = useRef<number>(0); // Store last percentage value
  const lastPercentageUpdateTime = useRef<number>(0); // Store last update timestamp
  const contextLowWarningShown = useRef<boolean>(false); // Track if low context warning was shown
  const flashTimersRef = useRef<NodeJS.Timeout[]>([]); // Track flash timers for cleanup
  const chatHistoryRef = useRef<ChatEntry[]>(chatHistory); // Track current chat history

  // Toast notification system
  const { toasts, removeToast, addToast } = useToasts();

  const confirmationService = ConfirmationService.getInstance();
  const projectName = getCurrentProjectName();
  const version = getVersion();

  // Check AutomatosX availability on mount
  useEffect(() => {
    const checkAx = async () => {
      const available = await isAutomatosXAvailable();
      setAxEnabled(available);
    };
    checkAx();
  }, []);


  // Flash effect helper - triggers a brief highlight then clears
  const triggerFlash = useCallback((setter: React.Dispatch<React.SetStateAction<boolean>>) => {
    setter(true);
    const timeoutId = setTimeout(() => {
      setter(false);
      // Remove completed timer from array to prevent unbounded growth
      const idx = flashTimersRef.current.indexOf(timeoutId);
      if (idx !== -1) flashTimersRef.current.splice(idx, 1);
    }, 300);
    flashTimersRef.current.push(timeoutId);
  }, []);

  // Cleanup flash timers on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      flashTimersRef.current.forEach(timer => clearTimeout(timer));
      flashTimersRef.current = [];
    };
  }, []);

  // NEW: Listen for plan events from agent for real-time phase progress tracking
  useEffect(() => {
    // BUG FIX: Track plan timeouts for cleanup to prevent setState on unmounted component
    const planTimers: NodeJS.Timeout[] = [];

    const handlePlanCreated = (data: { plan: TaskPlan }) => {
      setCurrentPlan(data.plan);
    };

    const handlePlanCompleted = () => {
      // Keep plan visible briefly after completion to show success
      // BUG FIX: Track timer for cleanup
      const timer = setTimeout(() => setCurrentPlan(null), 3000);
      planTimers.push(timer);
    };

    const handlePlanFailed = () => {
      // Keep plan visible longer to show failure state
      // BUG FIX: Track timer for cleanup
      const timer = setTimeout(() => setCurrentPlan(null), 5000);
      planTimers.push(timer);
    };

    const handlePhaseStarted = (data: { phase: any; planId: string }) => {
      // Update current phase index for visual progress
      setCurrentPlan((prevPlan) => {
        if (!prevPlan || prevPlan.id !== data.planId) return prevPlan;
        return {
          ...prevPlan,
          currentPhaseIndex: data.phase.index,
          phases: prevPlan.phases.map(p =>
            p.id === data.phase.id ? { ...p, status: data.phase.status } : p
          ),
        };
      });
    };

    const handlePhaseCompleted = (data: { phase: any; planId: string }) => {
      // Update phase status and duration
      setCurrentPlan((prevPlan) => {
        if (!prevPlan || prevPlan.id !== data.planId) return prevPlan;
        return {
          ...prevPlan,
          phasesCompleted: prevPlan.phasesCompleted + 1,
          phases: prevPlan.phases.map(p =>
            p.id === data.phase.id
              ? { ...p, status: data.phase.status, duration: data.phase.duration }
              : p
          ),
        };
      });
    };

    const handlePhaseFailed = (data: { phase: any; planId: string; error?: string }) => {
      // Update phase status with error
      setCurrentPlan((prevPlan) => {
        if (!prevPlan || prevPlan.id !== data.planId) return prevPlan;
        return {
          ...prevPlan,
          phasesFailed: prevPlan.phasesFailed + 1,
          phases: prevPlan.phases.map(p =>
            p.id === data.phase.id
              ? { ...p, status: data.phase.status, error: data.error }
              : p
          ),
        };
      });
    };

    // Subagent event handlers for tracking active agents
    const handleSubagentSpawn = (data: { id: string; role: string }) => {
      setActiveAgents((prev) => [...prev, data.role]);
    };

    const handleSubagentComplete = (data: { subagentId: string; role?: string }) => {
      if (!data.role) return;
      // Remove first occurrence of completed agent's role
      setActiveAgents((prev) => {
        const idx = prev.indexOf(data.role!);
        return idx === -1 ? prev : prev.toSpliced(idx, 1);
      });
    };

    const handleSubagentTerminate = () => {
      setActiveAgents([]);
    };

    // ax_agent tool event handlers for status bar display
    const handleAxAgentStart = (data: { agent: string }) => {
      setActiveAgents((prev) => [...prev, data.agent]);
    };

    const handleAxAgentEnd = (data: { agent: string }) => {
      setActiveAgents((prev) => {
        const idx = prev.indexOf(data.agent);
        return idx === -1 ? prev : prev.toSpliced(idx, 1);
      });
    };

    // Register event listeners
    agent.on('plan:created', handlePlanCreated);
    agent.on('plan:completed', handlePlanCompleted);
    agent.on('plan:failed', handlePlanFailed);
    agent.on('phase:started', handlePhaseStarted);
    agent.on('phase:completed', handlePhaseCompleted);
    agent.on('phase:failed', handlePhaseFailed);
    agent.on('subagent:spawn', handleSubagentSpawn);
    agent.on('subagent:complete', handleSubagentComplete);
    agent.on('subagent:terminate', handleSubagentTerminate);
    agent.on('ax_agent:start', handleAxAgentStart);
    agent.on('ax_agent:end', handleAxAgentEnd);

    // Cleanup on unmount
    return () => {
      // BUG FIX: Clear all plan timers to prevent setState on unmounted component
      planTimers.forEach(timer => clearTimeout(timer));

      // Remove event listeners
      agent.off('plan:created', handlePlanCreated);
      agent.off('plan:completed', handlePlanCompleted);
      agent.off('plan:failed', handlePlanFailed);
      agent.off('phase:started', handlePhaseStarted);
      agent.off('phase:completed', handlePhaseCompleted);
      agent.off('phase:failed', handlePhaseFailed);
      agent.off('subagent:spawn', handleSubagentSpawn);
      agent.off('subagent:complete', handleSubagentComplete);
      agent.off('subagent:terminate', handleSubagentTerminate);
      agent.off('ax_agent:start', handleAxAgentStart);
      agent.off('ax_agent:end', handleAxAgentEnd);
    };
  }, [agent]);

  // Mode toggle handlers with toast feedback
  const handleVerboseModeChange = useCallback((enabled: boolean) => {
    triggerFlash(setFlashVerbose);
    addToast(enabled ? TOAST_MESSAGES.verboseOn : TOAST_MESSAGES.verboseOff);
  }, [triggerFlash, addToast]);

  const handleBackgroundModeChange = useCallback((enabled: boolean) => {
    triggerFlash(setFlashBackground);
    addToast(enabled ? TOAST_MESSAGES.backgroundOn : TOAST_MESSAGES.backgroundOff);
  }, [triggerFlash, addToast]);

  const handleAutoEditModeChange = useCallback((enabled: boolean) => {
    triggerFlash(setFlashAutoEdit);
    addToast(enabled ? TOAST_MESSAGES.autoEditOn : TOAST_MESSAGES.autoEditOff);
  }, [triggerFlash, addToast]);

  // Thinking mode toggle handler
  const handleThinkingModeChange = useCallback((enabled: boolean) => {
    triggerFlash(setFlashThinkingMode);
    addToast(enabled ? TOAST_MESSAGES.thinkingOn : TOAST_MESSAGES.thinkingOff);
  }, [triggerFlash, addToast]);

  const handleEditorOpening = useCallback((editorName: string) => {
    addToast(TOAST_MESSAGES.editorOpening(editorName));
  }, [addToast]);

  const handleEditorSuccess = useCallback(() => {
    addToast(TOAST_MESSAGES.editorSuccess);
  }, [addToast]);

  const handleEditorCancelled = useCallback(() => {
    addToast(TOAST_MESSAGES.editorCancelled);
  }, [addToast]);

  const handleEditorError = useCallback((error: string) => {
    addToast(TOAST_MESSAGES.editorError(error));
  }, [addToast]);

  const handleTaskMovedToBackground = useCallback((taskId: string) => {
    addToast(TOAST_MESSAGES.taskMoved(taskId));
  }, [addToast]);

  const handleOperationInterrupted = useCallback(() => {
    addToast(TOAST_MESSAGES.interrupted);
  }, [addToast]);

  const handleChatCleared = useCallback(() => {
    addToast(TOAST_MESSAGES.cleared);
  }, [addToast]);

  const handleLargePaste = useCallback((charCount: number) => {
    // Only show warning toast if not truncating (allowLargePaste = true)
    // Otherwise the truncation toast will be more informative
    addToast(TOAST_MESSAGES.pasteTruncationDisabled(charCount));
  }, [addToast]);

  const handlePasteTruncated = useCallback((originalLength: number, truncatedLength: number) => {
    addToast(TOAST_MESSAGES.pasteTruncated(originalLength, truncatedLength));
  }, [addToast]);

  // Keep chatHistoryRef in sync
  useEffect(() => {
    chatHistoryRef.current = chatHistory;
  }, [chatHistory]);

  const handleCopyLastResponse = useCallback(() => {
    // Use ref to get current chatHistory without causing callback re-creation
    // This prevents unnecessary re-renders when chatHistory changes
    const lastAssistantEntry = [...chatHistoryRef.current].reverse().find(entry => entry.type === "assistant");
    if (lastAssistantEntry && lastAssistantEntry.content) {
      try {
        clipboardy.writeSync(lastAssistantEntry.content);
        addToast(TOAST_MESSAGES.copied);
      } catch {
        addToast({ message: "Failed to copy to clipboard", type: "error", icon: "❌" });
      }
    } else {
      addToast({ message: "No response to copy", type: "info", icon: "ℹ" });
    }
  }, [addToast]);

  const handleMemoryWarmed = useCallback((tokens: number) => {
    addToast(TOAST_MESSAGES.memoryWarmed(tokens));
  }, [addToast]);

  const handleMemoryRefreshed = useCallback(() => {
    addToast(TOAST_MESSAGES.memoryRefreshed);
  }, [addToast]);

  const handleCheckpointCreated = useCallback(() => {
    addToast(TOAST_MESSAGES.checkpointCreated);
  }, [addToast]);

  const handleCheckpointRestored = useCallback(() => {
    addToast(TOAST_MESSAGES.checkpointRestored);
  }, [addToast]);

  const {
    input,
    cursorPosition,
    showCommandSuggestions,
    selectedCommandIndex,
    commandSuggestions,
    resourceSuggestions,
    suggestionMode,
    autoEditEnabled,
    verboseMode,
    verbosityLevel,
    backgroundMode,
    thinkingModeEnabled,
    pastedBlocks,
    currentBlockAtCursor,
    isPasting,
    toggleVerbosity,
    toggleAutoEdit,
    toggleThinkingMode,
    toggleBackgroundMode,
  } = useInputHandler({
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
    isConfirmationActive: !!confirmationOptions || !!questionRequest || showMcpDashboard,
    onQuickActionsToggle: () => setShowQuickActions((prev) => !prev),
    onVerboseModeChange: handleVerboseModeChange,
    onBackgroundModeChange: handleBackgroundModeChange,
    onAutoEditModeChange: handleAutoEditModeChange,
    onThinkingModeChange: handleThinkingModeChange,
    onTaskMovedToBackground: handleTaskMovedToBackground,
    onOperationInterrupted: handleOperationInterrupted,
    onChatCleared: handleChatCleared,
    onCopyLastResponse: handleCopyLastResponse,
    onMemoryWarmed: handleMemoryWarmed,
    onMemoryRefreshed: handleMemoryRefreshed,
    onCheckpointCreated: handleCheckpointCreated,
    onCheckpointRestored: handleCheckpointRestored,
    onLargePaste: handleLargePaste,
    onPasteTruncated: handlePasteTruncated,
    onKeyboardHelp: () => setShowKeyboardHelp((prev) => !prev),
    onMcpDashboardToggle: () => setShowMcpDashboard((prev) => !prev),
    onEditorOpening: handleEditorOpening,
    onEditorSuccess: handleEditorSuccess,
    onEditorCancelled: handleEditorCancelled,
    onEditorError: handleEditorError,
    // Agent-First Mode props
    agentFirstDisabled,
    forcedAgent,
    onAgentSelected: setActiveAgent,
  });

  useEffect(() => {
    // Only clear console on non-Windows platforms or if not PowerShell
    // Windows PowerShell can have issues with console.clear() causing flickering
    const isWindows = process.platform === "win32";
    const isPowerShell =
      process.env.ComSpec?.toLowerCase().includes("powershell") ||
      process.env.PSModulePath !== undefined;

    if (!isWindows || !isPowerShell) {
      console.clear();
    }

    // Welcome text is now displayed in WelcomePanel component
    // Don't clear history on mount since we loaded it from disk
  }, []);

  // Process initial message if provided (streaming for faster feedback)
  useEffect(() => {
    if (!initialMessage || !agent) {
      return;
    }

    // Agent-First Mode: Set active agent for initial message
    // Note: The actual agent execution happens in useInputHandler for subsequent messages
    // For initial message, we just set the badge - execution goes through LLMAgent
    if (forcedAgent) {
      setActiveAgent(forcedAgent);
    } else if (!agentFirstDisabled) {
      const settings = getSettingsManager();
      const agentFirstSettings = settings.getAgentFirstSettings();

      if (agentFirstSettings.enabled) {
        const routerConfig = {
          enabled: agentFirstSettings.enabled,
          defaultAgent: agentFirstSettings.defaultAgent,
          confidenceThreshold: agentFirstSettings.confidenceThreshold,
          excludedAgents: agentFirstSettings.excludedAgents,
        };
        const routingResult = routeToAgent(initialMessage, routerConfig);
        if (routingResult.agent) {
          setActiveAgent(routingResult.agent);
        }
      }
    }

    const userEntry: ChatEntry = {
      type: "user",
      content: initialMessage,
      timestamp: new Date(),
    };
    setChatHistory([userEntry]);

    let cancelled = false;

    const processInitialMessage = async () => {
        setIsProcessing(true);
        setIsStreaming(true);

        try {
          let streamingEntry: ChatEntry | null = null;
          for await (const chunk of agent.processUserMessageStream(initialMessage)) {
            if (cancelled) break;
            switch (chunk.type) {
              case "reasoning":
                // Handle reasoning content from GLM-4.6 thinking mode
                if (chunk.reasoningContent) {
                  setIsThinking(true);
                  if (!streamingEntry) {
                    const newStreamingEntry = {
                      type: "assistant" as const,
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
                              reasoningContent: (entry.reasoningContent || "") + chunk.reasoningContent,
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
                          ? {
                              ...entry,
                              content: entry.content + chunk.content,
                              isReasoningStreaming: false, // Stop reasoning streaming when content starts
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
                setIsThinking(false);
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
          const errorMessage = error instanceof Error ? error.message : String(error);
          const errorEntry: ChatEntry = {
            type: "assistant",
            content: `Error: ${errorMessage}`,
            timestamp: new Date(),
          };
          setChatHistory((prev) => [...prev, errorEntry]);
          setIsStreaming(false);
          setIsThinking(false);
        }

        setIsProcessing(false);
        processingStartTime.current = 0;
      };

    processInitialMessage();

    return () => {
      cancelled = true;
    };
  }, [initialMessage, agent]);

  useEffect(() => {
    const handleConfirmationRequest = (options: ConfirmationOptions) => {
      setConfirmationOptions(options);
    };

    confirmationService.on("confirmation-requested", handleConfirmationRequest);

    return () => {
      confirmationService.off(
        "confirmation-requested",
        handleConfirmationRequest
      );
    };
  }, [confirmationService]);

  // Listen for question requests from AskUserService
  useEffect(() => {
    const askUserService = getAskUserService();

    const handleQuestionRequest = (request: QuestionRequest) => {
      setQuestionRequest(request);
    };

    askUserService.on("question-requested", handleQuestionRequest);

    return () => {
      askUserService.off("question-requested", handleQuestionRequest);
    };
  }, []);

  useEffect(() => {
    if (!isProcessing && !isStreaming) {
      setProcessingTime(0);
      processingStartTime.current = 0; // Reset baseline so next run starts from zero
      return;
    }

    if (processingStartTime.current === 0) {
      processingStartTime.current = Date.now();
    }

    const interval = setInterval(() => {
      setProcessingTime(
        Math.floor((Date.now() - processingStartTime.current) / 1000)
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [isProcessing, isStreaming]);

  // Update context percentage only when conversation state changes
  // Optimized context percentage calculation with throttling
  // Best practice: Calculate only when needed, throttle updates, use setImmediate for non-blocking
  useEffect(() => {
    // Skip during streaming - avoid mid-stream overhead
    if (isStreaming) return;

    // Throttle: Only update every 500ms to prevent excessive recalculations
    const now = Date.now();
    const timeSinceLastUpdate = now - lastPercentageUpdateTime.current;
    if (timeSinceLastUpdate < 500) {
      return; // Skip if updated less than 500ms ago
    }

    // Use setImmediate for non-blocking, async UI updates (Node.js equivalent of RAF)
    // Track setTimeout for proper cleanup to prevent memory leaks
    // Use object to allow mutation from inside setImmediate while accessible in cleanup
    const timeoutState = { autoPruneTimeoutId: null as NodeJS.Timeout | null, cancelled: false };

    const immediateId = setImmediate(() => {
      // Check if cleanup already ran (component unmounted)
      if (timeoutState.cancelled) return;

      const percentage = agent.getContextPercentage();

      // Detect auto-prune: if percentage increases by more than 10%, pruning happened
      // (With countdown from 100%, prune causes percentage to go UP as more space becomes available)
      if (lastPercentageRef.current > 0 &&
          percentage > lastPercentageRef.current + 10) {
        setShowAutoPrune(true);
        // Hide "auto-prune" after 3 seconds
        timeoutState.autoPruneTimeoutId = setTimeout(() => setShowAutoPrune(false), 3000);
        // Reset low warning flag after prune (context recovered)
        contextLowWarningShown.current = false;
      }

      // Show one-time warning when context drops below 20%
      if (percentage <= 20 && !contextLowWarningShown.current && lastPercentageRef.current > 20) {
        addToast(TOAST_MESSAGES.contextLow);
        contextLowWarningShown.current = true;
      }

      lastPercentageRef.current = percentage; // Store percentage value
      lastPercentageUpdateTime.current = now; // Store timestamp
      setContextPercentage(percentage);
    });

    return () => {
      timeoutState.cancelled = true;
      clearImmediate(immediateId);
      // Clean up auto-prune timeout to prevent memory leaks on unmount
      if (timeoutState.autoPruneTimeoutId) clearTimeout(timeoutState.autoPruneTimeoutId);
    };
  }, [agent, chatHistory.length, isStreaming, addToast]); // Only when length changes and not streaming

  // Save history whenever it changes (debounced)
  // Only save when NOT streaming to avoid constant disk I/O during active conversation
  useEffect(() => {
    // Skip saving while streaming - wait until conversation pauses
    if (isStreaming) return;

    const timeoutId = setTimeout(() => {
      historyManager.saveHistory(chatHistory);
    }, 3000); // Increased debounce to 3 seconds to reduce disk writes

    return () => clearTimeout(timeoutId);
  }, [chatHistory.length, isStreaming, historyManager]); // Only trigger on length change, not content updates

  const handleConfirmation = (dontAskAgain?: boolean) => {
    confirmationService.confirmOperation(true, dontAskAgain);
    setConfirmationOptions(null);
  };

  const handleRejection = (feedback?: string) => {
    confirmationService.rejectOperation(feedback);
    setConfirmationOptions(null);

    // Reset processing states when operation is cancelled
    setIsProcessing(false);
    setIsStreaming(false);
    setTokenCount(0);
    setProcessingTime(0);
    processingStartTime.current = 0;
  };

  // Question dialog handlers
  const handleQuestionSubmit = (answers: string[], customInput?: string) => {
    const askUserService = getAskUserService();
    askUserService.submitAnswer(answers, customInput);
    // The service will emit another question-requested event if there are more questions
    // or it will resolve the promise and close automatically
    // We clear the current question to prepare for the next one
    setQuestionRequest(null);
  };

  const handleQuestionCancel = () => {
    const askUserService = getAskUserService();
    askUserService.cancelQuestions("Questions cancelled by user");
    setQuestionRequest(null);

    // Reset processing states when operation is cancelled
    setIsProcessing(false);
    setIsStreaming(false);
    setTokenCount(0);
    setProcessingTime(0);
    processingStartTime.current = 0;
  };

  // Get MCP server count safely
  // MCP server count - only calculate once on mount
  // MCP servers are configured at startup and rarely change during session
  const mcpServerCount = useMemo(() => {
    try {
      return getMcpConnectionCount();
    } catch {
      return 0;
    }
  }, []); // Only calculate once

  // Get background task count (running tasks)
  const [backgroundTaskCount, setBackgroundTaskCount] = useState(0);

  // Listen for background task events
  // Memoize handlers to prevent event listener leaks
  const handleTaskComplete = useCallback(({ taskId, status }: { taskId: string; exitCode: number | null; status: string }) => {
    const manager = BackgroundTaskManager.getInstance();
    const taskInfo = manager.getTaskInfo(taskId);
    const command = taskInfo?.command || taskId;

    if (status === 'completed') {
      addToast(TOAST_MESSAGES.taskCompleted(taskId, command));
    } else {
      addToast(TOAST_MESSAGES.taskFailed(taskId, command));
    }

    // Update running count
    setBackgroundTaskCount(manager.listTasks().filter(t => t.status === 'running').length);
  }, [addToast]);

  const handleTaskStarted = useCallback(() => {
    const manager = BackgroundTaskManager.getInstance();
    setBackgroundTaskCount(manager.listTasks().filter(t => t.status === 'running').length);
  }, []);

  const handleTaskKilled = useCallback(() => {
    const manager = BackgroundTaskManager.getInstance();
    setBackgroundTaskCount(manager.listTasks().filter(t => t.status === 'running').length);
  }, []);

  useEffect(() => {
    const manager = BackgroundTaskManager.getInstance();

    // Initial count
    setBackgroundTaskCount(manager.listTasks().filter(t => t.status === 'running').length);

    manager.on('taskComplete', handleTaskComplete);
    manager.on('taskStarted', handleTaskStarted);
    manager.on('taskAdopted', handleTaskStarted);
    manager.on('taskKilled', handleTaskKilled);

    return () => {
      manager.off('taskComplete', handleTaskComplete);
      manager.off('taskStarted', handleTaskStarted);
      manager.off('taskAdopted', handleTaskStarted);
      manager.off('taskKilled', handleTaskKilled);
    };
  }, [handleTaskComplete, handleTaskStarted, handleTaskKilled]);

  // Handler for quick action selection
  const handleQuickActionSelect = (command: string) => {
    setShowQuickActions(false);
    // Process the command by simulating user input
    if (command === "exit") {
      process.exit(0);
    }
    if (command === "toggle:verbosity") {
      toggleVerbosity();
      return;
    }
    if (command === "toggle:autoedit") {
      toggleAutoEdit();
      return;
    }
    if (command === "toggle:thinking") {
      toggleThinkingMode();
      return;
    }
    if (command === "toggle:background") {
      toggleBackgroundMode();
      return;
    }
    if (command === "show:keyboard-shortcuts") {
      setShowKeyboardHelp(true);
      return;
    }
    if (command === "show:quick-actions") {
      setShowQuickActions(true);
      return;
    }
    if (command === "jump:latest") {
      // BUG FIX: Ink Box doesn't support scrollTo (DOM API), so this command is not functional.
      // Terminal scrolling is handled by the terminal emulator, not the app.
      // Show a toast instead of silently doing nothing.
      addToast({ message: "Use terminal scroll (Shift+PgUp/PgDn) to navigate", type: "info", icon: "ℹ" });
      return;
    }
    if (command === "/context") {
      setShowContextBreakdown(true);
      return;
    }
    // For slash commands, we'll need to trigger processing
    // This can be done by directly calling the input handler or agent
  };

  return (
    <Box flexDirection="column" paddingX={2}>
      {/* Show welcome panel when no chat history */}
      {chatHistory.length === 0 && !confirmationOptions && !questionRequest && !showQuickActions && !showKeyboardHelp && !showContextBreakdown && !showMcpDashboard && (
        <WelcomePanel projectName={projectName} />
      )}

      {/* Phase Progress Display */}
      {currentPlan && !confirmationOptions && (
        <Box marginBottom={1}>
          <PhaseProgress plan={currentPlan} compact={true} />
        </Box>
      )}

      {/* Chat history */}
      <Box flexDirection="column">
        <ChatHistory
          entries={chatHistory}
          isConfirmationActive={!!confirmationOptions}
          verboseMode={verboseMode}
          verbosityLevel={verbosityLevel}
        />
      </Box>

      {/* Quick Actions Menu (Ctrl+K) */}
      {showQuickActions && (
        <QuickActions
          isVisible={showQuickActions}
          onSelect={handleQuickActionSelect}
          onClose={() => setShowQuickActions(false)}
        />
      )}

      {/* Keyboard Shortcuts Help */}
      {showKeyboardHelp && (
        <KeyboardHelp
          onClose={() => setShowKeyboardHelp(false)}
          verbosityLevel={verbosityLevel}
          backgroundMode={backgroundMode}
          autoEditEnabled={autoEditEnabled}
        />
      )}

      {/* Context Breakdown */}
      {showContextBreakdown && (() => {
        // Calculate current and max tokens
        const settingsManager = getSettingsManager();
        const model = settingsManager.getCurrentModel();
        const modelConfig = GLM_MODELS[model as keyof typeof GLM_MODELS];
        const maxTokens = modelConfig?.contextWindow || 200000;
        const currentTokens = Math.floor(maxTokens * (1 - contextPercentage / 100));
        const categories = calculateContextBreakdown(currentTokens);

        return (
          <ContextBreakdown
            onClose={() => setShowContextBreakdown(false)}
            currentTokens={currentTokens}
            maxTokens={maxTokens}
            categories={categories}
          />
        );
      })()}

      {/* MCP Dashboard */}
      {showMcpDashboard && (
        <MCPDashboard
          isVisible={showMcpDashboard}
          onClose={() => setShowMcpDashboard(false)}
          onRefresh={() => addToast({ message: "MCP servers refreshed", type: "success", icon: "🔄" })}
        />
      )}

      {/* Confirmation dialog */}
      {confirmationOptions && (
        <ConfirmationDialog
          operation={confirmationOptions.operation}
          filename={confirmationOptions.filename}
          showVSCodeOpen={confirmationOptions.showVSCodeOpen}
          content={confirmationOptions.content}
          onConfirm={handleConfirmation}
          onReject={handleRejection}
        />
      )}

      {/* Question dialog for ask_user tool */}
      {questionRequest && questionRequest.questions[questionRequest.currentQuestionIndex] && (
        <QuestionDialog
          question={questionRequest.questions[questionRequest.currentQuestionIndex]}
          questionNumber={questionRequest.currentQuestionIndex + 1}
          totalQuestions={questionRequest.questions.length}
          onSubmit={handleQuestionSubmit}
          onCancel={handleQuestionCancel}
        />
      )}

      {/* Main interface when no dialogs are open */}
      {!confirmationOptions && !questionRequest && !showQuickActions && !showKeyboardHelp && !showContextBreakdown && !showMcpDashboard && (
        <>
          <LoadingSpinner
            isActive={isProcessing || isStreaming}
            processingTime={processingTime}
            tokenCount={tokenCount}
          />

          <ChatInput
            input={input}
            cursorPosition={cursorPosition}
            isProcessing={isProcessing}
            isStreaming={isStreaming}
            pastedBlocks={pastedBlocks}
            currentBlockAtCursor={currentBlockAtCursor}
            isPasting={isPasting}
          />

          {/* Toast notifications for mode toggles */}
          {toasts.length > 0 && (
            <ToastContainer
              toasts={toasts}
              onDismiss={removeToast}
              maxVisible={2}
            />
          )}

          {/* New StatusBar component */}
          <StatusBar
            projectName={projectName}
            version={version}
            model={agent.getCurrentModel()}
            cliName={cliName}
            contextPercentage={contextPercentage}
            showAutoPrune={showAutoPrune}
            autoEditEnabled={autoEditEnabled}
            verboseMode={verboseMode}
            verbosityLevel={verbosityLevel}
            backgroundMode={backgroundMode}
            mcpServerCount={mcpServerCount}
            backgroundTaskCount={backgroundTaskCount}
            isProcessing={isProcessing || isStreaming}
            processingTime={processingTime}
            tokenCount={tokenCount}
            flashAutoEdit={flashAutoEdit}
            flashVerbose={flashVerbose}
            flashBackground={flashBackground}
            axEnabled={axEnabled}
            activeAgent={activeAgent}
            activeAgents={activeAgents}
            thinkingModeEnabled={thinkingModeEnabled}
            flashThinkingMode={flashThinkingMode}
            isThinking={isThinking}
          />

          <CommandSuggestions
            suggestions={
              suggestionMode === "resource"
                ? resourceSuggestions.map((r) => ({ command: r.reference, description: r.description || r.name }))
                : commandSuggestions
            }
            input={suggestionMode === "resource" ? input.match(/@mcp:[^\s]*$/)?.[0] || "" : input}
            selectedIndex={selectedCommandIndex}
            isVisible={showCommandSuggestions}
          />
        </>
      )}
    </Box>
  );
}

// Main component that handles API key input or chat interface
export default function ChatInterface({
  agent,
  initialMessage,
  loadPreviousHistory = false,
  agentFirstDisabled = false,
  forcedAgent,
  cliName = 'ax-cli',
}: ChatInterfaceProps) {
  const [currentAgent, setCurrentAgent] = useState<LLMAgent | null>(
    agent || null
  );

  const handleApiKeySet = (newAgent: LLMAgent) => {
    setCurrentAgent(newAgent);
  };

  if (!currentAgent) {
    return <ApiKeyInput onApiKeySet={handleApiKeySet} />;
  }

  return (
    <ChatInterfaceWithAgent
      agent={currentAgent}
      initialMessage={initialMessage}
      loadPreviousHistory={loadPreviousHistory}
      agentFirstDisabled={agentFirstDisabled}
      forcedAgent={forcedAgent}
      cliName={cliName}
    />
  );
}
