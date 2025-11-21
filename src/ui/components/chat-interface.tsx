import React, { useState, useEffect, useRef, useMemo } from "react";
import { Box, Text } from "ink";
import { LLMAgent, ChatEntry } from "../../agent/llm-agent.js";
import { useInputHandler } from "../../hooks/use-input-handler.js";
import { LoadingSpinner } from "./loading-spinner.js";
import { CommandSuggestions } from "./command-suggestions.js";
import { ChatHistory } from "./chat-history.js";
import { ChatInput } from "./chat-input.js";
import { MCPStatus } from "./mcp-status.js";
import ConfirmationDialog from "./confirmation-dialog.js";
import {
  ConfirmationService,
  ConfirmationOptions,
} from "../../utils/confirmation-service.js";
import ApiKeyInput from "./api-key-input.js";
import cfonts from "cfonts";
import { getVersion } from "../../utils/version.js";
import { getHistoryManager } from "../../utils/history-manager.js";
import path from "path";

interface ChatInterfaceProps {
  agent?: LLMAgent;
  initialMessage?: string;
  loadPreviousHistory?: boolean; // For --continue flag
}

// Get current project folder name
function getCurrentProjectName(): string {
  return path.basename(process.cwd());
}

// Main chat component that handles input when agent is available
function ChatInterfaceWithAgent({
  agent,
  initialMessage,
  loadPreviousHistory = false,
}: {
  agent: LLMAgent;
  initialMessage?: string;
  loadPreviousHistory?: boolean;
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
  const scrollRef = useRef<any>();
  const processingStartTime = useRef<number>(0);
  const lastPercentageRef = useRef<number>(0); // Store last percentage value
  const lastPercentageUpdateTime = useRef<number>(0); // Store last update timestamp

  const confirmationService = ConfirmationService.getInstance();

  const {
    input,
    cursorPosition,
    showCommandSuggestions,
    selectedCommandIndex,
    commandSuggestions,
    autoEditEnabled,
    verboseMode,
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
    isConfirmationActive: !!confirmationOptions,
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

    // Add top padding
    console.log("    ");

    // Generate logo with margin to match Ink paddingX={2}
    const logoOutput = cfonts.render("AX", {
      font: "3d",
      align: "left",
      colors: ["white"],
      space: true,
      maxLength: "0",
      gradient: false,
      independentGradient: false,
      transitionGradient: false,
      env: "node",
    });

    // Add horizontal margin (2 spaces) to match Ink paddingX={2}
    const logoLines = (logoOutput as any).string.split("\n");
    logoLines.forEach((line: string) => {
      if (line.trim()) {
        console.log(" " + line); // Add 2 spaces for horizontal margin
      } else {
        console.log(line); // Keep empty lines as-is
      }
    });

    console.log(" "); // Spacing after logo

    // Don't clear history on mount since we loaded it from disk
  }, []);

  // Process initial message if provided (streaming for faster feedback)
  useEffect(() => {
    if (!initialMessage || !agent) {
      return;
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

  useEffect(() => {
    if (!isProcessing && !isStreaming) {
      setProcessingTime(0);
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
    let autoPruneTimeoutId: NodeJS.Timeout | null = null;

    const immediateId = setImmediate(() => {
      const percentage = agent.getContextPercentage();

      // Detect auto-prune: if percentage increases by more than 10%, pruning happened
      // (With countdown from 100%, prune causes percentage to go UP as more space becomes available)
      if (lastPercentageRef.current > 0 &&
          percentage > lastPercentageRef.current + 10) {
        setShowAutoPrune(true);
        // Hide "auto-prune" after 3 seconds
        autoPruneTimeoutId = setTimeout(() => setShowAutoPrune(false), 3000);
      }

      lastPercentageRef.current = percentage; // Store percentage value
      lastPercentageUpdateTime.current = now; // Store timestamp
      setContextPercentage(percentage);
    });

    return () => {
      clearImmediate(immediateId);
      // Clean up auto-prune timeout to prevent memory leaks on unmount
      if (autoPruneTimeoutId) clearTimeout(autoPruneTimeoutId);
    };
  }, [agent, chatHistory.length, isStreaming]); // Only when length changes and not streaming

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

  return (
    <Box flexDirection="column" paddingX={2}>
      {/* Show tips only when no chat history and no confirmation dialog */}
      {chatHistory.length === 0 && !confirmationOptions && (
        <Box flexDirection="column" marginBottom={2}>
          <Text color="cyan" bold>
            Tips for getting started:
          </Text>
          <Box marginTop={1} flexDirection="column">
            <Text color="gray">
              1. Ask questions, edit files, or run commands.
            </Text>
            <Text color="gray">2. Be specific for the best results.</Text>
            <Text color="gray">
              3. use /init and CUSTOM.md to improve your ax-cli.
            </Text>
            <Text color="gray">
              4. Press Shift+Tab to toggle auto-edit mode.
            </Text>
            <Text color="gray">5. /help for more information.</Text>
          </Box>
        </Box>
      )}

      <Box flexDirection="column" marginBottom={1}>
        <Text color="gray">
          Type your request in natural language. Ctrl+C to clear, 'exit' to
          quit.
        </Text>
      </Box>

      <Box flexDirection="column" ref={scrollRef}>
        <ChatHistory
          entries={chatHistory}
          isConfirmationActive={!!confirmationOptions}
          verboseMode={verboseMode}
        />
      </Box>

      {/* Show confirmation dialog if one is pending */}
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

      {!confirmationOptions && (
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
          />

          <Box flexDirection="row" marginTop={1}>
            <Box marginRight={2}>
              <Text color="cyan">
                {autoEditEnabled ? "▶" : "⏸"} auto-edit:{" "}
                {autoEditEnabled ? "on" : "off"}
              </Text>
              <Text color="gray" dimColor>
                {" "}
                (shift + tab)
              </Text>
            </Box>
            <Box marginRight={2}>
              <Text color={verboseMode ? "yellow" : "gray"}>
                {verboseMode ? "📋" : "📄"} verbose:{" "}
                {verboseMode ? "on" : "off"}
              </Text>
              <Text color="gray" dimColor>
                {" "}
                (ctrl + o)
              </Text>
            </Box>
            <Box marginRight={2}>
              <Text color="gray" dimColor>project: </Text>
              <Text color="magenta">{getCurrentProjectName()}</Text>
              <Text color="gray" dimColor> | ax-cli: </Text>
              <Text color="cyan">v{getVersion()}</Text>
              <Text color="gray" dimColor> by DEFAI</Text>
              <Text color="gray" dimColor> | model: </Text>
              <Text color="yellow">{agent.getCurrentModel()}</Text>
              <Text color="gray" dimColor> | context: </Text>
              {showAutoPrune ? (
                <Text color="cyan">auto-prune</Text>
              ) : (
                <Text color={contextPercentage < 25 ? "red" : contextPercentage < 50 ? "yellow" : "green"}>
                  {contextPercentage.toFixed(1)}%
                </Text>
              )}
            </Box>
            <MCPStatus />
          </Box>

          <CommandSuggestions
            suggestions={commandSuggestions}
            input={input}
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
    />
  );
}
