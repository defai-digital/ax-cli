import React, { useState, useEffect, useMemo } from "react";
import { Box, Text } from "ink";
import { formatTokenCount } from "../../utils/token-counter.js";
import { formatDuration } from "../utils/tool-grouper.js";
import { useTranslations } from "../hooks/use-translations.js";

interface LoadingSpinnerProps {
  isActive: boolean;
  processingTime: number;
  tokenCount: number;
  currentAction?: "thinking" | "searching" | "editing" | "executing" | "reading" | "writing";
}

/** Braille spinner animation frames */
const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"] as const;

/** Timing constants for spinner animation */
const SPINNER_CONFIG = {
  /** Spinner frame animation interval in milliseconds */
  FRAME_INTERVAL_MS: 80,
  /** Loading message rotation interval in milliseconds */
  MESSAGE_ROTATE_MS: 3000,
  /** Seconds before operation is considered "long running" (shows yellow) */
  LONG_RUNNING_SEC: 10,
  /** Seconds before operation is considered "very long" (shows hint) */
  VERY_LONG_SEC: 30,
} as const;

// BUG FIX #32/#34: Memoize LoadingSpinner to prevent unnecessary re-renders
// When isActive is false, this component returns null and should not cause re-renders
export const LoadingSpinner = React.memo(function LoadingSpinnerComponent({
  isActive,
  processingTime,
  tokenCount,
  currentAction = "thinking",
}: LoadingSpinnerProps) {
  const [spinnerFrame, setSpinnerFrame] = useState(0);
  const [loadingTextIndex, setLoadingTextIndex] = useState(0);
  const { ui } = useTranslations();

  // Build loading texts from translations
  const loadingTextsByAction = useMemo(() => ({
    thinking: [
      ui.session.thinking,
      ui.session.analyzing,
      ui.session.reasoning,
      ui.session.generating,
    ],
    searching: [
      ui.session.searchingCodebase,
      ui.tools.searchingFiles,
    ],
    editing: [
      ui.session.editingFile,
      ui.tools.fileModified,
    ],
    executing: [
      ui.session.runningCommand,
      ui.tools.commandRunning,
    ],
    reading: [
      ui.tools.readingFile,
    ],
    writing: [
      ui.tools.writingFile,
    ],
  }), [ui]);

  const defaultLoadingTexts = useMemo(() => [
    ui.session.thinking,
    ui.session.analyzing,
    ui.session.generating,
  ], [ui]);

  // Get the appropriate loading texts for current action
  const loadingTexts = loadingTextsByAction[currentAction] || defaultLoadingTexts;

  // Determine if this is a long-running operation
  const isLongRunning = processingTime > SPINNER_CONFIG.LONG_RUNNING_SEC;
  const isVeryLong = processingTime > SPINNER_CONFIG.VERY_LONG_SEC;

  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(() => {
      setSpinnerFrame((prev) => (prev + 1) % SPINNER_FRAMES.length);
    }, SPINNER_CONFIG.FRAME_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [isActive]);

  useEffect(() => {
    if (!isActive) return;

    setLoadingTextIndex(Math.floor(Math.random() * loadingTexts.length));

    const interval = setInterval(() => {
      setLoadingTextIndex((prev) => (prev + 1) % loadingTexts.length);
    }, SPINNER_CONFIG.MESSAGE_ROTATE_MS);

    return () => clearInterval(interval);
  }, [isActive, loadingTexts.length]);

  // Reset loading text index when action changes
  useEffect(() => {
    setLoadingTextIndex(0);
  }, [currentAction]);

  if (!isActive) return null;

  return (
    <Box marginTop={1} flexDirection="column">
      <Box>
        <Text color="cyan" bold>
          {SPINNER_FRAMES[spinnerFrame]}
        </Text>
        <Text color="cyan"> {loadingTexts[loadingTextIndex % loadingTexts.length] || loadingTexts[0]} </Text>
        {/* Phase 3: Show warning for long-running operations */}
        {isVeryLong && (
          <Text color="yellow" bold> {ui.session.takingLonger}</Text>
        )}
      </Box>
      <Box marginLeft={2}>
        <Text color={isLongRunning ? "yellow" : "gray"} dimColor={!isLongRunning}>
          {formatDuration(processingTime * 1000)} elapsed
        </Text>
        {tokenCount > 0 && (
          <Text color="gray" dimColor>
            {" "}• {formatTokenCount(tokenCount)} tokens
          </Text>
        )}
        <Text color="gray" dimColor>
          {" "}• <Text color="yellow">esc</Text> {ui.session.escToInterrupt.replace('esc ', '')}
        </Text>
      </Box>
      {/* Phase 3: Show helpful hint for very long operations */}
      {isVeryLong && (
        <Box marginLeft={2} marginTop={1}>
          <Text color="yellow">
            💡 Complex task - this may take a while. Press <Text bold>esc</Text> to interrupt.
          </Text>
        </Box>
      )}
    </Box>
  );
});
