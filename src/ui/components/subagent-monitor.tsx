/**
 * Subagent Monitor Component
 *
 * Displays active subagents and their execution status in the terminal UI.
 * Shows parallel execution progress with spinners and status indicators.
 */

import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { SubagentResult, SubagentStatus, SubagentState } from '../../agent/subagent-types.js';

interface SubagentMonitorProps {
  /** Currently active subagents */
  activeSubagents: SubagentStatus[];
  /** Completed subagent results */
  results: SubagentResult[];
  /** Show detailed progress information */
  verbose?: boolean;
}

/**
 * SubagentMonitor component for visualizing subagent execution
 */
export const SubagentMonitor: React.FC<SubagentMonitorProps> = ({
  activeSubagents,
  results,
  verbose = false,
}) => {
  if (activeSubagents.length === 0 && results.length === 0) {
    return null; // Don't render if nothing to show
  }

  const getStateIcon = (state: SubagentState): string => {
    switch (state) {
      case SubagentState.PENDING:
        return '⏸️';
      case SubagentState.RUNNING:
        return '▶️';
      case SubagentState.COMPLETED:
        return '✅';
      case SubagentState.FAILED:
        return '❌';
      case SubagentState.CANCELLED:
        return '🚫';
      default:
        return '❓';
    }
  };

  const formatDuration = (ms: number): string => {
    if (ms < 1000) {
      return `${ms}ms`;
    } else if (ms < 60000) {
      return `${(ms / 1000).toFixed(1)}s`;
    } else {
      return `${(ms / 60000).toFixed(1)}m`;
    }
  };

  const getProgressBar = (progress: number, width: number = 20): string => {
    const filled = Math.round((progress / 100) * width);
    const empty = width - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
  };

  return (
    <Box flexDirection="column" marginY={1} borderStyle="round" borderColor="cyan" paddingX={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          🤖 Subagent System
        </Text>
      </Box>

      {/* Active Subagents */}
      {activeSubagents.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold color="yellow">
            Active ({activeSubagents.length}):
          </Text>
          {activeSubagents.map((subagent, _index) => (
            <Box key={subagent.id} marginLeft={2} flexDirection="column">
              <Box>
                <Text color="cyan">
                  {subagent.state === SubagentState.RUNNING && <Spinner type="dots" />}
                  {' '}
                  {getStateIcon(subagent.state)} {subagent.role}
                  {verbose && ` (${subagent.id.slice(0, 8)})`}
                </Text>
              </Box>

              {verbose && subagent.currentAction && (
                <Box marginLeft={2}>
                  <Text dimColor>
                    → {subagent.currentAction}
                  </Text>
                </Box>
              )}

              {subagent.progress > 0 && (
                <Box marginLeft={2}>
                  <Text dimColor>
                    {getProgressBar(subagent.progress)} {subagent.progress}%
                  </Text>
                </Box>
              )}

              {verbose && subagent.toolsUsed && subagent.toolsUsed.length > 0 && (
                <Box marginLeft={2}>
                  <Text dimColor>
                    Tools: {subagent.toolsUsed.join(', ')}
                  </Text>
                </Box>
              )}

              {verbose && subagent.toolRoundsUsed !== undefined && (
                <Box marginLeft={2}>
                  <Text dimColor>
                    Rounds: {subagent.toolRoundsUsed}
                  </Text>
                </Box>
              )}
            </Box>
          ))}
        </Box>
      )}

      {/* Completed Results */}
      {results.length > 0 && (
        <Box flexDirection="column">
          <Text bold color="green">
            Completed ({results.length}):
          </Text>
          {results.map((result, _index) => (
            <Box key={result.id} marginLeft={2} flexDirection="column">
              <Box>
                <Text color={result.success ? 'green' : 'red'}>
                  {result.success ? '✅' : '❌'} {result.role}
                  {verbose && ` (${result.id.slice(0, 8)})`}
                </Text>
                <Text dimColor> - {formatDuration(result.executionTime)}</Text>
              </Box>

              {result.error && (
                <Box marginLeft={2}>
                  <Text color="red">
                    Error: {result.error}
                  </Text>
                </Box>
              )}

              {verbose && result.filesModified && result.filesModified.length > 0 && (
                <Box marginLeft={2}>
                  <Text dimColor>
                    Modified: {result.filesModified.length} file(s)
                  </Text>
                </Box>
              )}

              {verbose && result.filesCreated && result.filesCreated.length > 0 && (
                <Box marginLeft={2}>
                  <Text dimColor>
                    Created: {result.filesCreated.length} file(s)
                  </Text>
                </Box>
              )}

              {verbose && result.toolCalls && result.toolCalls.length > 0 && (
                <Box marginLeft={2}>
                  <Text dimColor>
                    Tool calls: {result.toolCalls.length}
                  </Text>
                </Box>
              )}
            </Box>
          ))}
        </Box>
      )}

      {/* Summary Statistics */}
      {results.length > 0 && (
        <Box marginTop={1} borderStyle="single" borderColor="gray" paddingX={1}>
          <Text dimColor>
            Success rate: {results.filter(r => r.success).length}/{results.length}
            {' | '}
            Total time: {formatDuration(results.reduce((sum, r) => sum + r.executionTime, 0))}
          </Text>
        </Box>
      )}
    </Box>
  );
};

/**
 * Compact version for status bar
 */
export const SubagentStatusBar: React.FC<{
  activeCount: number;
  completedCount: number;
  failedCount: number;
}> = ({ activeCount, completedCount, failedCount }) => {
  if (activeCount === 0 && completedCount === 0 && failedCount === 0) {
    return null;
  }

  return (
    <Box>
      <Text dimColor>
        Subagents:
      </Text>
      {activeCount > 0 && (
        <Text color="yellow"> {activeCount} active</Text>
      )}
      {completedCount > 0 && (
        <Text color="green"> {completedCount} done</Text>
      )}
      {failedCount > 0 && (
        <Text color="red"> {failedCount} failed</Text>
      )}
    </Box>
  );
};
