/**
 * Subagent Monitor Component
 *
 * Displays active subagents and their execution status in the terminal UI.
 * Shows parallel execution progress with spinners and status indicators.
 */

import React from 'react';
import { Box, Text } from 'ink';
import { SubagentResult, SubagentStatus, SubagentState } from '../../agent/subagent-types.js';
import { formatDuration } from '../utils/tool-grouper.js';
import { getToolActionName } from './collapsible-tool-result.js';

interface ToolCallInfo {
  name: string;
  id: string;
  status: 'running' | 'completed' | 'failed';
  output?: string;
}

interface SubagentMonitorProps {
  /** Currently active subagents */
  activeSubagents: SubagentStatus[];
  /** Completed subagent results */
  results: SubagentResult[];
  /** Show detailed progress information */
  verbose?: boolean;
  /** Tool calls by subagent ID for real-time updates */
  toolCallsBySubagent?: Map<string, ToolCallInfo[]>;
}

/**
 * SubagentMonitor component for visualizing subagent execution
 */
export const SubagentMonitor: React.FC<SubagentMonitorProps> = ({
  activeSubagents,
  results,
  verbose = false,
  toolCallsBySubagent = new Map(),
}) => {
  if (activeSubagents.length === 0 && results.length === 0) {
    return null; // Don't render if nothing to show
  }

  return (
    <Box flexDirection="column" marginY={1} borderStyle="round" borderColor="cyan" paddingX={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          🤖 Subagent System
        </Text>
      </Box>

      {/* Active Subagents - Claude Code Style */}
      {activeSubagents.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          {activeSubagents.map((subagent) => {
            const toolCalls = toolCallsBySubagent.get(subagent.id) || [];
            const visibleTools = toolCalls.slice(0, 3);
            const hiddenCount = Math.max(0, toolCalls.length - 3);

            return (
              <Box key={subagent.id} flexDirection="column" marginBottom={1}>
                {/* Main task line */}
                <Box>
                  <Text color="white">
                    {subagent.state === SubagentState.RUNNING && '● '}
                    {subagent.state === SubagentState.COMPLETED && '○ '}
                    {subagent.role}
                  </Text>
                  {subagent.currentAction && (
                    <Text color="gray">({subagent.currentAction})</Text>
                  )}
                </Box>

                {/* Tool calls - Claude Code style with indentation */}
                {visibleTools.map((tool: ToolCallInfo, idx: number) => (
                  <Box key={`${tool.id}-${idx}`} marginLeft={2}>
                    <Text color="gray">└ </Text>
                    <Text color={tool.status === 'completed' ? 'green' : tool.status === 'failed' ? 'red' : 'cyan'}>
                      {getToolActionName(tool.name)}
                    </Text>
                    {tool.output && (
                      <Text color="gray" dimColor> {tool.output}</Text>
                    )}
                  </Box>
                ))}

                {/* Show collapsed count like Claude Code */}
                {hiddenCount > 0 && (
                  <Box marginLeft={2}>
                    <Text color="gray" dimColor>
                      +{hiddenCount} more tool uses (ctrl+o to expand)
                    </Text>
                  </Box>
                )}
              </Box>
            );
          })}
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
  /** Optional: Most recent error message for failed subagents */
  lastError?: string;
  /** Optional: Show error details (truncated) */
  showErrorDetails?: boolean;
}> = ({ activeCount, completedCount, failedCount, lastError, showErrorDetails = false }) => {
  if (activeCount === 0 && completedCount === 0 && failedCount === 0) {
    return null;
  }

  // Truncate error message for compact display
  const truncatedError = lastError && lastError.length > 50
    ? lastError.slice(0, 47) + '...'
    : lastError;

  return (
    <Box flexDirection="column">
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
      {/* Show error details if enabled and there's a recent error */}
      {showErrorDetails && failedCount > 0 && truncatedError && (
        <Box marginLeft={2}>
          <Text color="red" dimColor>
            └─ {truncatedError}
          </Text>
        </Box>
      )}
    </Box>
  );
};
