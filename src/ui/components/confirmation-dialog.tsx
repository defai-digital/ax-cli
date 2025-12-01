import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { DiffRenderer } from "./diff-renderer.js";

interface ConfirmationDialogProps {
  operation: string;
  filename: string;
  onConfirm: (dontAskAgain?: boolean) => void;
  onReject: (feedback?: string) => void;
  showVSCodeOpen?: boolean;
  content?: string; // Optional content to show (file content or command)
}

export default function ConfirmationDialog({
  operation,
  filename,
  onConfirm,
  onReject,
  showVSCodeOpen = false,
  content,
}: ConfirmationDialogProps) {
  const [selectedOption, setSelectedOption] = useState(0);

  // Simplified to 3 options - removed "No, with feedback" as it's rarely used
  const options = [
    "Yes",
    "Yes, and don't ask again this session",
    "No",
  ];

  useInput((input, key) => {
    // Quick number key selection (1-3)
    if (input >= "1" && input <= "3") {
      const optionIndex = parseInt(input, 10) - 1;
      if (optionIndex < options.length) {
        if (optionIndex === 0) {
          onConfirm(false);
        } else if (optionIndex === 1) {
          onConfirm(true);
        } else if (optionIndex === 2) {
          onReject("Operation cancelled by user");
        }
      }
      return;
    }

    // Y/N quick keys
    if (input.toLowerCase() === "y") {
      onConfirm(false);
      return;
    }
    if (input.toLowerCase() === "n") {
      onReject("Operation cancelled by user");
      return;
    }

    if (key.upArrow || (key.shift && key.tab)) {
      setSelectedOption((prev) => (prev > 0 ? prev - 1 : options.length - 1));
      return;
    }

    if (key.downArrow || key.tab) {
      setSelectedOption((prev) => (prev + 1) % options.length);
      return;
    }

    if (key.return) {
      if (selectedOption === 0) {
        onConfirm(false);
      } else if (selectedOption === 1) {
        onConfirm(true);
      } else if (selectedOption === 2) {
        onReject("Operation cancelled by user");
      }
      return;
    }

    if (key.escape) {
      onReject("Operation cancelled by user (pressed Escape)");
      return;
    }
  });

  return (
    <Box flexDirection="column">
      {/* Tool use header - styled like chat history */}
      <Box marginTop={1}>
        <Box>
          <Text color="magenta">⏺</Text>
          <Text color="white">
            {" "}
            {operation}({filename})
          </Text>
        </Box>
      </Box>

      <Box marginLeft={2} flexDirection="column">
        <Text color="gray">⎿ Requesting user confirmation</Text>

        {showVSCodeOpen && (
          <Box marginTop={1}>
            <Text color="gray">⎿ Opened changes in Visual Studio Code ⧉</Text>
          </Box>
        )}

        {/* Show content preview if provided (limited to 10 lines) */}
        {content && (
          <>
            <Text color="gray">⎿ {content.split('\n')[0]}</Text>
            <Box marginLeft={4} flexDirection="column">
              {(() => {
                const lines = content.split('\n');
                const MAX_PREVIEW_LINES = 10;
                const limitedContent = lines.length > MAX_PREVIEW_LINES
                  ? lines.slice(0, MAX_PREVIEW_LINES).join('\n') + `\n... (${lines.length - MAX_PREVIEW_LINES} more lines)`
                  : content;
                return (
                  <DiffRenderer
                    diffContent={limitedContent}
                    filename={filename}
                    terminalWidth={80}
                  />
                );
              })()}
            </Box>
          </>
        )}
      </Box>

      {/* Confirmation options */}
      <Box flexDirection="column" marginTop={1}>
        <Box marginBottom={1}>
          <Text>Do you want to proceed with this operation?</Text>
        </Box>

        <Box flexDirection="column">
          {options.map((option, index) => (
            <Box key={index} paddingLeft={1}>
              <Text
                color={selectedOption === index ? "black" : "white"}
                backgroundColor={selectedOption === index ? "cyan" : undefined}
              >
                {index + 1}. {option}
              </Text>
            </Box>
          ))}
        </Box>

        <Box marginTop={1}>
          <Text color="gray" dimColor>
            y/n to confirm • ↑↓ Enter to select • Esc cancel
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
