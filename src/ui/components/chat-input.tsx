import React from "react";
import { Box, Text } from "ink";
import type { PastedBlock } from "../../utils/paste-utils.js";

interface ChatInputProps {
  input: string;
  cursorPosition: number;
  isProcessing: boolean;
  isStreaming: boolean;
  pastedBlocks?: PastedBlock[];
  currentBlockAtCursor?: PastedBlock | null;
  isPasting?: boolean; // v3.8.0: Show "Pasting..." indicator
}

export function ChatInput({
  input,
  cursorPosition,
  isProcessing,
  isStreaming,
  pastedBlocks: _pastedBlocks = [],
  currentBlockAtCursor = null,
  isPasting = false, // v3.8.0
}: ChatInputProps) {
  const beforeCursor = input.slice(0, cursorPosition);

  // Handle multiline input display
  const lines = input.split("\n");
  const isMultiline = lines.length > 1;

  // Calculate cursor position across lines
  let currentLineIndex = 0;
  let currentCharIndex = 0;
  let totalChars = 0;

  for (let i = 0; i < lines.length; i++) {
    if (totalChars + lines[i].length >= cursorPosition) {
      currentLineIndex = i;
      currentCharIndex = cursorPosition - totalChars;
      break;
    }
    totalChars += lines[i].length + 1; // +1 for newline
  }

  const showCursor = !isProcessing && !isStreaming;
  const borderColor = isProcessing || isStreaming ? "yellow" : "blue";
  const promptColor = "cyan";

  // Display placeholder when input is empty
  const placeholderText = "Ask me anything...";
  const isPlaceholder = !input;

  // Always show character count with color coding for length warnings
  const maxChars = 20000;
  const charCount = input.length;
  const getCharCountColor = () => {
    if (charCount >= maxChars) return "red";           // At/over limit
    if (charCount >= maxChars * 0.8) return "yellow";  // 80% warning (16000+)
    if (charCount >= maxChars * 0.5) return "cyan";    // 50% (10000+)
    return "gray";                                      // Normal (0-9999)
  };

  // Detect if this line is part of an expanded paste block
  const getPasteBlockInfo = (lineIndex: number): { isInPaste: boolean; isStart: boolean; isEnd: boolean; block?: PastedBlock } => {
    if (!_pastedBlocks || _pastedBlocks.length === 0) {
      return { isInPaste: false, isStart: false, isEnd: false };
    }

    // Check if any expanded paste block exists in the input
    const expandedBlocks = _pastedBlocks.filter(block => !block.collapsed);
    if (expandedBlocks.length === 0) {
      return { isInPaste: false, isStart: false, isEnd: false };
    }

    // Check if this line is part of the pasted content
    for (const block of expandedBlocks) {
      const blockLines = block.content.split('\n');
      // Prefer the remembered insertion point to disambiguate duplicates, but fall back to a full search
      const searchStart = Math.min(Math.max(block.startPosition - 1, 0), input.length);
      let startIndex = input.indexOf(block.content, searchStart);
      if (startIndex === -1 && searchStart !== 0) {
        startIndex = input.indexOf(block.content);
      }
      // If the block content no longer exists (edited or removed), don't render markers for it
      if (startIndex === -1) continue;

      const blockStartLine = input.substring(0, startIndex).split('\n').length - 1;
      const blockEndLine = blockStartLine + blockLines.length - 1;

      if (lineIndex > blockStartLine && lineIndex <= blockEndLine) {
        return {
          isInPaste: true,
          isStart: lineIndex === blockStartLine + 1,
          isEnd: lineIndex === blockEndLine,
          block
        };
      }
    }

    return { isInPaste: false, isStart: false, isEnd: false };
  };

  if (isMultiline) {
    return (
      <Box flexDirection="column">
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor={borderColor}
          paddingY={0}
          marginTop={1}
        >
          {lines.map((line, index) => {
            const isCurrentLine = index === currentLineIndex;
            const pasteInfo = getPasteBlockInfo(index);
            const { isInPaste, isStart, isEnd, block } = pasteInfo;

            // Use different prompt for pasted content lines
            let promptChar = index === 0 ? "❯" : "│";
            if (isInPaste) {
              promptChar = "┊"; // Different character for pasted lines
            }

            // Render paste block start marker
            if (isStart && block) {
              return (
                <React.Fragment key={`paste-${index}`}>
                  <Box>
                    {/* BUG FIX: Use 1-based ID to match collapsed placeholder display */}
                    <Text color="yellow" dimColor>│ ─── Pasted #{block.id + 1} ({block.lineCount} lines) ───</Text>
                  </Box>
                  <Box>
                    {/* BUG FIX: Simplified redundant ternary (both branches returned yellow) */}
                    <Text color={isInPaste ? "yellow" : promptColor}>
                      {promptChar}{" "}
                    </Text>
                    <Text color="gray">
                      {isCurrentLine ? (
                        <>
                          {line.slice(0, currentCharIndex)}
                          {showCursor && (
                            <Text backgroundColor="white" color="black">
                              {line.slice(currentCharIndex, currentCharIndex + 1) || " "}
                            </Text>
                          )}
                          {!showCursor && line.slice(currentCharIndex, currentCharIndex + 1) !== " " && line.slice(currentCharIndex, currentCharIndex + 1)}
                          {line.slice(currentCharIndex + 1)}
                        </>
                      ) : (
                        line
                      )}
                    </Text>
                  </Box>
                </React.Fragment>
              );
            }

            // Render paste block end marker
            if (isEnd && block) {
              return (
                <React.Fragment key={`paste-end-${index}`}>
                  <Box>
                    <Text color={isInPaste ? "yellow" : promptColor}>{promptChar} </Text>
                    <Text color="gray">
                      {isCurrentLine ? (
                        <>
                          {line.slice(0, currentCharIndex)}
                          {showCursor && (
                            <Text backgroundColor="white" color="black">
                              {line.slice(currentCharIndex, currentCharIndex + 1) || " "}
                            </Text>
                          )}
                          {!showCursor && line.slice(currentCharIndex, currentCharIndex + 1) !== " " && line.slice(currentCharIndex, currentCharIndex + 1)}
                          {line.slice(currentCharIndex + 1)}
                        </>
                      ) : (
                        line
                      )}
                    </Text>
                  </Box>
                  <Box>
                    <Text color="yellow" dimColor>│ ────────────────────────────────</Text>
                  </Box>
                </React.Fragment>
              );
            }

            // Regular line rendering
            if (isCurrentLine) {
              const beforeCursorInLine = line.slice(0, currentCharIndex);
              const cursorChar =
                line.slice(currentCharIndex, currentCharIndex + 1) || " ";
              const afterCursorInLine = line.slice(currentCharIndex + 1);

              return (
                <Box key={index}>
                  <Text color={isInPaste ? "yellow" : promptColor}>{promptChar} </Text>
                  <Text color={isInPaste ? "gray" : undefined}>
                    {beforeCursorInLine}
                    {showCursor && (
                      <Text backgroundColor="white" color="black">
                        {cursorChar}
                      </Text>
                    )}
                    {!showCursor && cursorChar !== " " && cursorChar}
                    {afterCursorInLine}
                  </Text>
                </Box>
              );
            } else {
              return (
                <Box key={index}>
                  <Text color={isInPaste ? "yellow" : promptColor}>{promptChar} </Text>
                  <Text color={isInPaste ? "gray" : undefined}>{line}</Text>
                </Box>
              );
            }
          })}
        </Box>
        {/* Character count indicator - show in multiline mode too */}
        {!isProcessing && !isStreaming && (
          <Box marginLeft={2} marginTop={0}>
            <Text color={getCharCountColor()} dimColor={charCount === 0}>
              [{charCount}/{maxChars}]
            </Text>
          </Box>
        )}

      </Box>
    );
  }

  // Single line input box
  const cursorChar = input.slice(cursorPosition, cursorPosition + 1) || " ";
  const afterCursorText = input.slice(cursorPosition + 1);

  return (
    <Box flexDirection="column">
      <Box
        borderStyle="round"
        borderColor={borderColor}
        paddingX={1}
        paddingY={0}
        marginTop={1}
        justifyContent="space-between"
      >
        <Box flexGrow={1}>
          <Text color={promptColor}>❯ </Text>
          {isPlaceholder ? (
            <>
              <Text color="gray" dimColor>
                {placeholderText}
              </Text>
              {showCursor && (
                <Text backgroundColor="white" color="black">
                  {" "}
                </Text>
              )}
            </>
          ) : (
            <Text>
              {beforeCursor}
              {showCursor && (
                <Text backgroundColor="white" color="black">
                  {cursorChar}
                </Text>
              )}
              {!showCursor && cursorChar !== " " && cursorChar}
              {afterCursorText}
            </Text>
          )}
        </Box>
        {/* Character count indicator - always visible with color coding */}
        {!isProcessing && !isStreaming && (
          <Box marginLeft={1}>
            <Text color={getCharCountColor()} dimColor={charCount === 0}>
              [{charCount}/{maxChars}]
            </Text>
          </Box>
        )}
      </Box>

      {/* Hint text when cursor is on a collapsed/expanded paste block */}
      {currentBlockAtCursor && !isProcessing && !isStreaming && (
        <Box marginTop={0} marginLeft={2}>
          <Text color="yellow" dimColor>
            {currentBlockAtCursor.collapsed
              ? `💡 Press Ctrl+P to expand ${currentBlockAtCursor.lineCount} lines`
              : `💡 Press Ctrl+P to collapse`}
          </Text>
        </Box>
      )}

      {/* v3.8.0: Pasting indicator - show when accumulating paste via bracketed paste mode */}
      {isPasting && (
        <Box marginTop={0} marginLeft={2}>
          <Text color="cyan">
            📋 Pasting text...
          </Text>
        </Box>
      )}

      {/* Phase 1: Input mode hint - show when input is not empty */}
    </Box>
  );
}
