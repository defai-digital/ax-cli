/**
 * Question Dialog Component
 *
 * Displays questions from the AI and collects user responses.
 * Supports single and multi-select options with custom input.
 */

import React, { useState, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import type { Question } from "../../tools/ask-user.js";

interface QuestionDialogProps {
  question: Question;
  questionNumber: number;
  totalQuestions: number;
  onSubmit: (answers: string[], customInput?: string) => void;
  onCancel: () => void;
}

export default function QuestionDialog({
  question,
  questionNumber,
  totalQuestions,
  onSubmit,
  onCancel,
}: QuestionDialogProps) {
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set([0]));
  const [cursorIndex, setCursorIndex] = useState(0);
  const [showOtherInput, setShowOtherInput] = useState(false);
  const [otherInput, setOtherInput] = useState("");

  // Options including "Other" for custom input
  const allOptions = [...question.options, { label: "Other (custom input)", description: "Enter your own response" }];
  const otherIndex = allOptions.length - 1;

  const handleToggleSelection = useCallback((index: number) => {
    if (question.multiSelect) {
      // Multi-select: toggle the selection
      setSelectedIndices((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(index)) {
          newSet.delete(index);
        } else {
          newSet.add(index);
        }
        return newSet;
      });
    } else {
      // Single-select: replace selection
      setSelectedIndices(new Set([index]));
    }

    // Show other input if "Other" is selected
    if (index === otherIndex) {
      setShowOtherInput(true);
    } else if (!question.multiSelect) {
      setShowOtherInput(false);
    }
  }, [question.multiSelect, otherIndex]);

  const handleSubmit = useCallback(() => {
    if (showOtherInput && selectedIndices.has(otherIndex)) {
      // Submit with custom input
      if (otherInput.trim()) {
        const regularAnswers = Array.from(selectedIndices)
          .filter((i) => i !== otherIndex)
          .map((i) => allOptions[i].label);
        onSubmit(regularAnswers, otherInput.trim());
      }
    } else {
      // Submit selected options
      const answers = Array.from(selectedIndices).map((i) => allOptions[i].label);
      if (answers.length > 0) {
        onSubmit(answers);
      }
    }
  }, [selectedIndices, showOtherInput, otherIndex, otherInput, allOptions, onSubmit]);

  useInput((input, key) => {
    // Handle "Other" input mode
    if (showOtherInput && selectedIndices.has(otherIndex)) {
      if (key.return) {
        handleSubmit();
        return;
      }
      if (key.escape) {
        setShowOtherInput(false);
        setSelectedIndices(new Set([0]));
        return;
      }
      if (key.backspace || key.delete) {
        setOtherInput((prev) => prev.slice(0, -1));
        return;
      }
      if (input && !key.ctrl && !key.meta) {
        setOtherInput((prev) => prev + input);
        return;
      }
      return;
    }

    // Quick number key selection (1-9)
    if (input >= "1" && input <= "9") {
      const optionIndex = parseInt(input, 10) - 1;
      if (optionIndex < allOptions.length) {
        handleToggleSelection(optionIndex);
        if (!question.multiSelect && optionIndex !== otherIndex) {
          // Auto-submit on single select (except for "Other")
          const answers = [allOptions[optionIndex].label];
          onSubmit(answers);
        }
      }
      return;
    }

    // Navigation
    if (key.upArrow || (key.shift && key.tab)) {
      setCursorIndex((prev) => (prev > 0 ? prev - 1 : allOptions.length - 1));
      return;
    }

    if (key.downArrow || key.tab) {
      setCursorIndex((prev) => (prev + 1) % allOptions.length);
      return;
    }

    // Space to toggle selection (for multi-select)
    if (input === " ") {
      handleToggleSelection(cursorIndex);
      return;
    }

    // Enter to select current and submit (for single-select) or submit all (for multi-select)
    if (key.return) {
      if (question.multiSelect) {
        handleSubmit();
      } else {
        handleToggleSelection(cursorIndex);
        if (cursorIndex === otherIndex) {
          // Show other input
          setShowOtherInput(true);
        } else {
          // Submit immediately for single-select
          const answers = [allOptions[cursorIndex].label];
          onSubmit(answers);
        }
      }
      return;
    }

    // Escape to cancel
    if (key.escape) {
      onCancel();
      return;
    }
  });

  return (
    <Box flexDirection="column">
      {/* Question header */}
      <Box marginTop={1}>
        <Box>
          <Text color="magenta">?</Text>
          <Text color="white" bold>
            {" "}
            {question.header || "Question"}
          </Text>
          {totalQuestions > 1 && (
            <Text color="gray">
              {" "}
              ({questionNumber}/{totalQuestions})
            </Text>
          )}
        </Box>
      </Box>

      {/* Question text */}
      <Box marginLeft={2} marginTop={1} marginBottom={1}>
        <Text>{question.question}</Text>
      </Box>

      {/* Options list */}
      <Box flexDirection="column" marginLeft={2}>
        {allOptions.map((option, index) => {
          const isSelected = selectedIndices.has(index);
          const isCursor = cursorIndex === index;

          return (
            <Box key={index} paddingLeft={1}>
              <Text
                color={isCursor ? "black" : isSelected ? "cyan" : "white"}
                backgroundColor={isCursor ? "cyan" : undefined}
              >
                {question.multiSelect ? (
                  <Text>{isSelected ? "[x]" : "[ ]"} </Text>
                ) : (
                  <Text>{isSelected ? "(*)" : "( )"} </Text>
                )}
                <Text>{index + 1}. {option.label}</Text>
              </Text>
              {option.description && (
                <Text color="gray" dimColor>
                  {" "}
                  - {option.description}
                </Text>
              )}
            </Box>
          );
        })}
      </Box>

      {/* Custom input field when "Other" is selected */}
      {showOtherInput && selectedIndices.has(otherIndex) && (
        <Box marginLeft={2} marginTop={1} flexDirection="column">
          <Text color="yellow">Enter your response:</Text>
          <Box marginTop={1}>
            <Text color="cyan">&gt; </Text>
            <Text>{otherInput}</Text>
            <Text color="cyan">|</Text>
          </Box>
        </Box>
      )}

      {/* Help text */}
      <Box marginTop={1} marginLeft={2}>
        <Text color="gray" dimColor>
          {question.multiSelect
            ? "Space add/remove | Enter submit | 1-9 quick toggle | Esc cancel"
            : "Enter/1-9 select | Esc cancel"}
        </Text>
      </Box>
    </Box>
  );
}
