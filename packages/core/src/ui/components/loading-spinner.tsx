import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import { formatTokenCount } from "../../utils/token-counter.js";

interface LoadingSpinnerProps {
  isActive: boolean;
  processingTime: number;
  tokenCount: number;
  currentAction?: "thinking" | "searching" | "editing" | "executing" | "reading" | "writing";
}

// Contextual loading messages based on current action
const loadingTextsByAction = {
  thinking: [
    "Thinking...",
    "Analyzing...",
    "Reasoning...",
    "Considering...",
    "Processing...",
  ],
  searching: [
    "Searching codebase...",
    "Scanning files...",
    "Finding matches...",
    "Looking for patterns...",
  ],
  editing: [
    "Editing file...",
    "Making changes...",
    "Updating code...",
    "Applying edits...",
  ],
  executing: [
    "Running command...",
    "Executing...",
    "Processing command...",
    "Working...",
  ],
  reading: [
    "Reading file...",
    "Loading content...",
    "Fetching data...",
  ],
  writing: [
    "Writing file...",
    "Saving changes...",
    "Creating file...",
  ],
};

// Default messages when no specific action
const defaultLoadingTexts = [
  "Thinking...",
  "Processing...",
  "Analyzing...",
  "Working...",
];

export function LoadingSpinner({
  isActive,
  processingTime,
  tokenCount,
  currentAction = "thinking",
}: LoadingSpinnerProps) {
  const [spinnerFrame, setSpinnerFrame] = useState(0);
  const [loadingTextIndex, setLoadingTextIndex] = useState(0);

  // Get the appropriate loading texts for current action
  const loadingTexts = loadingTextsByAction[currentAction] || defaultLoadingTexts;

  // Phase 3: Determine if this is a long-running operation
  const isLongRunning = processingTime > 10; // More than 10 seconds
  const isVeryLong = processingTime > 30; // More than 30 seconds

  useEffect(() => {
    if (!isActive) return;

    const spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
    // Smooth animation at 80ms intervals
    const interval = setInterval(() => {
      setSpinnerFrame((prev) => (prev + 1) % spinnerFrames.length);
    }, 80);

    return () => clearInterval(interval);
  }, [isActive]);

  useEffect(() => {
    if (!isActive) return;

    setLoadingTextIndex(Math.floor(Math.random() * loadingTexts.length));

    // Rotate messages every 3 seconds
    const interval = setInterval(() => {
      setLoadingTextIndex((prev) => (prev + 1) % loadingTexts.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [isActive, loadingTexts.length]);

  // Reset loading text index when action changes
  useEffect(() => {
    setLoadingTextIndex(0);
  }, [currentAction]);

  if (!isActive) return null;

  const spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

  // Format time display
  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <Box marginTop={1} flexDirection="column">
      <Box>
        <Text color="cyan" bold>
          {spinnerFrames[spinnerFrame]}
        </Text>
        <Text color="cyan"> {loadingTexts[loadingTextIndex % loadingTexts.length] || loadingTexts[0]} </Text>
        {/* Phase 3: Show warning for long-running operations */}
        {isVeryLong && (
          <Text color="yellow" bold> (taking longer than usual)</Text>
        )}
      </Box>
      <Box marginLeft={2}>
        <Text color={isLongRunning ? "yellow" : "gray"} dimColor={!isLongRunning}>
          {formatTime(processingTime)} elapsed
        </Text>
        {tokenCount > 0 && (
          <Text color="gray" dimColor>
            {" "}• {formatTokenCount(tokenCount)} tokens
          </Text>
        )}
        <Text color="gray" dimColor>
          {" "}• <Text color="yellow">esc</Text> to interrupt
        </Text>
      </Box>
      {/* Phase 3: Show helpful hint for very long operations */}
      {isVeryLong && (
        <Box marginLeft={2} marginTop={1}>
          <Text color="yellow">
            💡 Complex task - this may take a while. Press <Text bold>esc</Text> to interrupt (unsaved progress will be lost).
          </Text>
        </Box>
      )}
    </Box>
  );
}
