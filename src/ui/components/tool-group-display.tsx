/**
 * Tool Group Display Component
 * Renders grouped tool operations in quiet mode
 */

import React from 'react';
import { Box, Text } from 'ink';
import type { ToolGroup } from '../utils/tool-grouper.js';
import { getOperationCounts, getGroupDuration, formatDuration } from '../utils/tool-grouper.js';
import { summarizeChanges } from '../utils/change-summarizer.js';

interface ToolGroupDisplayProps {
  group: ToolGroup;
  index: number;
}

/**
 * Get display name for resource based on group type
 */
function getResourceDisplayName(group: ToolGroup): string {
  switch (group.groupType) {
    case 'file':
      // Extract filename from path
      const parts = group.resource.split('/');
      return parts[parts.length - 1] || group.resource;
    case 'bash':
      return group.resource.replace('bash:', '');
    case 'search':
      return group.resource.replace('search:', '');
    case 'todo':
      return 'tasks';
    default:
      return group.resource;
  }
}

/**
 * Format operation counts for display
 */
function formatOperationCounts(counts: ReturnType<typeof getOperationCounts>, groupType: string): string {
  const parts: string[] = [];

  if (groupType === 'file') {
    if (counts.updates > 0) {
      parts.push(`${counts.updates} edit${counts.updates > 1 ? 's' : ''}`);
    }
    if (counts.reads > 0) {
      parts.push(`${counts.reads} read${counts.reads > 1 ? 's' : ''}`);
    }
    if (counts.creates > 0) {
      parts.push(`${counts.creates} create${counts.creates > 1 ? 's' : ''}`);
    }
  } else if (groupType === 'bash') {
    parts.push(`${counts.bash} command${counts.bash > 1 ? 's' : ''}`);
  } else if (groupType === 'search') {
    parts.push(`${counts.searches} search${counts.searches > 1 ? 'es' : ''}`);
  } else if (groupType === 'todo') {
    parts.push(`${counts.todos} update${counts.todos > 1 ? 's' : ''}`);
  }

  return parts.join(', ');
}

/**
 * Render a tool group in quiet mode
 */
export function ToolGroupDisplay({ group, index }: ToolGroupDisplayProps) {
  const counts = getOperationCounts(group);
  const duration = getGroupDuration(group);
  const resourceName = getResourceDisplayName(group);
  const operationsText = formatOperationCounts(counts, group.groupType);
  const changesSummary = summarizeChanges(group);

  // Add subtle alternating background for better scannability
  const isEven = index % 2 === 0;

  return (
    <Box flexDirection="column" marginTop={0} paddingLeft={isEven ? 0 : 1}>
      {/* Main summary line */}
      <Box>
        <Text color="magenta">⏺</Text>
        <Text color="yellow" bold> Working on</Text>
        <Text color="white"> {resourceName}</Text>
        {operationsText && (
          <Text color="cyan"> ({operationsText})</Text>
        )}
        <Text color={group.hasError ? "red" : "green"}>
          {" "}{group.hasError ? "✗" : "✓"}
        </Text>
        {duration >= 100 && (
          <Text color="yellow"> {formatDuration(duration)}</Text>
        )}
      </Box>

      {/* Change summary (if available) */}
      {changesSummary && !group.hasError && (
        <Box marginLeft={2}>
          <Text color="gray">└─ {changesSummary}</Text>
        </Box>
      )}

      {/* Error summary (if there were errors) */}
      {group.hasError && (
        <Box marginLeft={2}>
          <Text color="red">└─ encountered errors (see details with ^O verbose mode)</Text>
        </Box>
      )}
    </Box>
  );
}

export default ToolGroupDisplay;
