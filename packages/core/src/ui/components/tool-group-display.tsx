/**
 * Tool Group Display Component
 * Renders grouped tool operations in quiet mode
 *
 * Supports both:
 * - Resource-based groups: "Working on package.json (3 edits)"
 * - Semantic groups: "Exploring codebase (12 reads)"
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
 * For semantic groups, returns the action description instead
 */
function getResourceDisplayName(group: ToolGroup): string {
  // For semantic groups, use the action description
  if (group.isSemanticGroup && group.actionDescription) {
    return group.actionDescription;
  }

  switch (group.groupType) {
    case 'file':
      // Extract filename from path
      if (!group.resource) {
        return '(unknown file)';
      }
      const parts = group.resource.split('/');
      // BUG FIX: Handle trailing slashes by filtering empty parts and taking last non-empty
      // BUG FIX: Also trim whitespace from parts
      const nonEmptyParts = parts.filter(p => p.trim().length > 0);
      const filename = nonEmptyParts.length > 0 ? nonEmptyParts[nonEmptyParts.length - 1].trim() : '';
      return filename || group.resource.trim() || '(unknown file)';
    case 'bash':
      // Handle both bash commands and background task monitoring
      if (group.resource.startsWith('task:')) {
        // BUG FIX: Trim whitespace from taskId
        const taskId = group.resource.replace('task:', '').trim();
        return taskId ? `task ${taskId}` : '(unknown task)';
      }
      // BUG FIX: Trim whitespace from command
      const cmd = group.resource.replace('bash:', '').trim();
      // BUG FIX: Handle 'empty' command case from bash:empty resource
      if (!cmd || cmd === 'empty') {
        return '(empty command)';
      }
      return cmd;
    case 'search':
      const query = group.resource.replace('search:', '');
      // BUG FIX: Trim whitespace to avoid displaying blank query
      return query.trim() || '(unknown query)';
    case 'todo':
      return 'tasks';
    case 'analysis':
      if (group.resource.startsWith('analysis:')) {
        const analysisPath = group.resource.replace('analysis:', '');
        // BUG FIX: Trim whitespace
        return analysisPath.trim() || 'project';
      }
      if (group.resource.startsWith('validation:')) {
        const validationPath = group.resource.replace('validation:', '');
        // BUG FIX: Trim whitespace
        return validationPath.trim() || 'project';
      }
      return group.resource?.trim() || 'project';
    case 'mixed':
      // BUG FIX: Handle MCP tools and other mixed operations with clean display
      if (group.resource.startsWith('mcp:')) {
        // Format: mcp:servername:resource or mcp:servername
        const mcpParts = group.resource.split(':');
        // BUG FIX: Trim whitespace from serverName
        const serverName = mcpParts[1]?.trim() || 'mcp';
        const mcpResource = mcpParts.slice(2).join(':').trim();
        if (mcpResource) {
          // Extract filename from resource path if it looks like a path
          // BUG FIX: Trim whitespace from path parts
          const resourceParts = mcpResource.split('/').filter(p => p.trim().length > 0);
          const displayResource = resourceParts.length > 0 ? resourceParts[resourceParts.length - 1].trim() : mcpResource;
          // Use mcp: prefix format for consistency
          return `mcp:${serverName}/${displayResource}`;
        }
        return `mcp:${serverName}`;
      }
      // BUG FIX: Trim whitespace
      return group.resource?.trim() || '(unknown)';
    default:
      // BUG FIX: Trim whitespace
      return group.resource?.trim() || '(unknown)';
  }
}

/**
 * Format operation counts for display
 * For semantic groups, this is already included in actionDescription
 */
function formatOperationCounts(counts: ReturnType<typeof getOperationCounts>, groupType: string, isSemanticGroup?: boolean): string {
  // Semantic groups already have counts in actionDescription
  if (isSemanticGroup) {
    return '';
  }

  const parts: string[] = [];

  if (groupType === 'file') {
    // BUG FIX: Show counts only if > 0 to avoid "0 edits" display
    if (counts.updates > 0) {
      parts.push(`${counts.updates} edit${counts.updates > 1 ? 's' : ''}`);
    }
    if (counts.reads > 0) {
      parts.push(`${counts.reads} read${counts.reads > 1 ? 's' : ''}`);
    }
    if (counts.creates > 0) {
      parts.push(`${counts.creates} create${counts.creates > 1 ? 's' : ''}`);
    }
    // BUG FIX: If no file operations found, show total operations as fallback
    if (parts.length === 0) {
      // BUG FIX: Include all operation types in total
      const total = counts.updates + counts.reads + counts.creates + counts.bash + counts.searches + counts.todos + counts.analysis + counts.other;
      if (total > 0) {
        parts.push(`${total} operation${total > 1 ? 's' : ''}`);
      }
    }
  } else if (groupType === 'bash') {
    // BUG FIX: Only show if > 0
    if (counts.bash > 0) {
      parts.push(`${counts.bash} command${counts.bash > 1 ? 's' : ''}`);
    }
  } else if (groupType === 'search') {
    // BUG FIX: Only show if > 0
    if (counts.searches > 0) {
      parts.push(`${counts.searches} search${counts.searches > 1 ? 'es' : ''}`);
    }
  } else if (groupType === 'todo') {
    // BUG FIX: Only show if > 0
    if (counts.todos > 0) {
      parts.push(`${counts.todos} update${counts.todos > 1 ? 's' : ''}`);
    }
  } else if (groupType === 'analysis') {
    // BUG FIX: Correct pluralization - "analysis" vs "analyses", only show if > 0
    if (counts.analysis > 0) {
      parts.push(`${counts.analysis} ${counts.analysis > 1 ? 'analyses' : 'analysis'}`);
    }
  } else if (groupType === 'mixed') {
    // BUG FIX: Handle MCP and other mixed operations
    // BUG FIX: Include todos and analysis in total count
    const total = counts.reads + counts.updates + counts.creates + counts.bash + counts.searches + counts.todos + counts.analysis + counts.other;
    if (total > 0) {
      parts.push(`${total} operation${total > 1 ? 's' : ''}`);
    }
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
  const operationsText = formatOperationCounts(counts, group.groupType, group.isSemanticGroup);
  const changesSummary = summarizeChanges(group);

  // Add subtle alternating background for better scannability
  const isEven = index % 2 === 0;

  // BUG FIX: Determine proper status - only show success when complete and no errors
  const isComplete = group.isComplete !== false; // Default to true for backwards compatibility
  const statusColor = group.hasError ? "red" : (isComplete ? "green" : "cyan");
  const statusIcon = group.hasError ? "✗" : (isComplete ? "✓" : "...");

  // Determine if this is an MCP operation (for cyan color)
  const isMcpOperation = group.resource?.startsWith('mcp:') || resourceName.startsWith('mcp:');
  const labelColor = isMcpOperation ? "cyan" : "yellow";

  // For semantic groups, use a cleaner display format (Claude Code-style)
  if (group.isSemanticGroup && group.actionDescription) {
    return (
      <Box flexDirection="column" marginTop={0} paddingLeft={isEven ? 0 : 1}>
        {/* Semantic action line - cleaner format */}
        <Box>
          <Text color="magenta">⏺</Text>
          <Text color="white"> {resourceName}</Text>
          <Text color={statusColor}>
            {" "}{statusIcon}
          </Text>
          {/* BUG FIX: Use yellow for duration to match resource-based groups */}
          {isComplete && duration >= 100 && (
            <Text color="yellow"> {formatDuration(duration)}</Text>
          )}
        </Box>

        {/* Error summary (if there were errors) */}
        {group.hasError && (
          <Box marginLeft={2}>
            <Text color="red">└─ {group.errorSummary || 'encountered errors'} (^O for details)</Text>
          </Box>
        )}
      </Box>
    );
  }

  // Resource-based groups use original format with "Working on" (or "Using MCP" for MCP tools)
  return (
    <Box flexDirection="column" marginTop={0} paddingLeft={isEven ? 0 : 1}>
      {/* Main summary line */}
      <Box>
        <Text color="magenta">⏺</Text>
        <Text color={labelColor} bold>{isMcpOperation ? " Using" : " Working on"}</Text>
        <Text color="white"> {resourceName}</Text>
        {operationsText && (
          <Text color="cyan"> ({operationsText})</Text>
        )}
        <Text color={statusColor}>
          {" "}{statusIcon}
        </Text>
        {isComplete && duration >= 100 && (
          <Text color="yellow"> {formatDuration(duration)}</Text>
        )}
      </Box>

      {/* Change summary (if available) */}
      {changesSummary && !group.hasError && isComplete && (
        <Box marginLeft={2}>
          <Text color="gray">└─ {changesSummary}</Text>
        </Box>
      )}

      {/* Error summary (if there were errors) */}
      {group.hasError && (
        <Box marginLeft={2}>
          <Text color="red">└─ {group.errorSummary || 'encountered errors'} (^O for details)</Text>
        </Box>
      )}
    </Box>
  );
}

export default ToolGroupDisplay;
