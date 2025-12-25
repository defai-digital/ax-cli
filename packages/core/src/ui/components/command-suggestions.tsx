import React, { useMemo } from "react";
import { Box, Text } from "ink";

interface CommandSuggestion {
  command: string;
  displayCommand?: string;  // Display text with aliases (falls back to command if not set)
  description: string;
}

// Simple in-memory command usage tracking (session-based)
const commandUsageCount = new Map<string, number>();

/**
 * Track command usage for ranking
 */
export function trackCommandUsage(command: string): void {
  const currentCount = commandUsageCount.get(command) || 0;
  commandUsageCount.set(command, currentCount + 1);
}

/**
 * Get usage count for a command (for testing)
 */
export function getCommandUsageCount(command: string): number {
  return commandUsageCount.get(command) || 0;
}

/**
 * Reset usage tracking (for testing)
 */
export function resetCommandUsageTracking(): void {
  commandUsageCount.clear();
}

interface CommandSuggestionsProps {
  suggestions: CommandSuggestion[];
  input: string;
  selectedIndex: number;
  isVisible: boolean;
}

export const MAX_SUGGESTIONS = 8;

/**
 * Fuzzy match scoring algorithm with usage-based ranking
 * Returns score (higher is better) and whether it matches
 */
function fuzzyMatch(str: string, pattern: string): { score: number; matches: boolean } {
  const strLower = str.toLowerCase();
  const patternLower = pattern.toLowerCase();

  // Get usage bonus (frequently used commands get boosted)
  const usageCount = commandUsageCount.get(str) || 0;
  const usageBonus = usageCount * 50; // 50 points per use

  // Exact prefix match gets highest score
  if (strLower.startsWith(patternLower)) {
    return { score: 1000 + (100 - pattern.length) + usageBonus, matches: true };
  }

  // Fuzzy matching: check if all pattern chars appear in order
  let patternIdx = 0;
  let score = 0;
  let consecutiveMatches = 0;

  for (let i = 0; i < strLower.length && patternIdx < patternLower.length; i++) {
    if (strLower[i] === patternLower[patternIdx]) {
      // Bonus for consecutive matches
      consecutiveMatches++;
      score += 10 + consecutiveMatches * 2;
      patternIdx++;
    } else {
      consecutiveMatches = 0;
    }
  }

  // All pattern characters must be found
  if (patternIdx === patternLower.length) {
    return { score: score + usageBonus, matches: true };
  }

  return { score: 0, matches: false };
}

export function filterCommandSuggestions<T extends { command: string }>(
  suggestions: T[],
  input: string
): T[] {
  if (!input) {
    return suggestions.slice(0, MAX_SUGGESTIONS);
  }

  // Score and filter all suggestions
  const scored = suggestions
    .map(s => {
      const result = fuzzyMatch(s.command, input);
      return { suggestion: s, score: result.score, matches: result.matches };
    })
    .filter(item => item.matches)
    .sort((a, b) => b.score - a.score) // Highest score first
    .slice(0, MAX_SUGGESTIONS);

  return scored.map(item => item.suggestion);
}

export function CommandSuggestions({
  suggestions,
  input,
  selectedIndex,
  isVisible,
}: CommandSuggestionsProps) {
  // useMemo must be called unconditionally (React hooks rule)
  const filteredSuggestions = useMemo(
    () => filterCommandSuggestions(suggestions, input),
    [suggestions, input]
  );

  if (!isVisible) return null;

  return (
    <Box marginTop={1} flexDirection="column">
      {filteredSuggestions.map((suggestion, index) => (
        <Box key={index} paddingLeft={1}>
          <Text
            color={index === selectedIndex ? "black" : "white"}
            backgroundColor={index === selectedIndex ? "cyan" : undefined}
          >
            {suggestion.displayCommand || suggestion.command}
          </Text>
          <Box marginLeft={1}>
            <Text color="gray">{suggestion.description}</Text>
          </Box>
        </Box>
      ))}
      <Box marginTop={1}>
        <Text color="gray" dimColor>
          ↑↓ navigate • Enter/Tab select • Esc cancel
        </Text>
      </Box>
    </Box>
  );
}