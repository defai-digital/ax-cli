/**
 * Phase Progress Component
 *
 * Displays the progress of multi-phase plan execution.
 */

import React from "react";
import { Box, Text } from "ink";
import {
  TaskPlan,
  TaskPhase,
  PhaseStatus,
  RiskLevel,
} from "../../planner/types.js";
import { formatDuration } from "../utils/tool-grouper.js";

// ============================================================================
// Types
// ============================================================================

interface PhaseProgressProps {
  plan: TaskPlan;
  showDetails?: boolean;
  compact?: boolean;
}

interface PhaseItemProps {
  phase: TaskPhase;
  isCurrent: boolean;
  showDetails?: boolean;
}

// ============================================================================
// Lookup Tables (O(1) access)
// ============================================================================

/** Phase status styles - combined icon and color for efficiency */
const PHASE_STATUS_STYLES: Record<PhaseStatus, { icon: string; color: string }> = {
  [PhaseStatus.COMPLETED]: { icon: "✓", color: "green" },
  [PhaseStatus.EXECUTING]: { icon: "⏳", color: "yellow" },
  [PhaseStatus.FAILED]: { icon: "✕", color: "red" },
  [PhaseStatus.SKIPPED]: { icon: "⊘", color: "gray" },
  [PhaseStatus.APPROVED]: { icon: "◉", color: "cyan" },
  [PhaseStatus.QUEUED]: { icon: "◎", color: "blue" },
  [PhaseStatus.CANCELLED]: { icon: "⊗", color: "red" },
  [PhaseStatus.PENDING]: { icon: "○", color: "gray" },
};

const DEFAULT_PHASE_STYLE = { icon: "○", color: "gray" };

/** Risk level indicators */
const RISK_LEVEL_INDICATORS: Record<RiskLevel, { icon: string; color: string }> = {
  [RiskLevel.HIGH]: { icon: "⚠", color: "red" },
  [RiskLevel.MEDIUM]: { icon: "△", color: "yellow" },
  [RiskLevel.LOW]: { icon: "", color: "gray" },
};

const DEFAULT_RISK_INDICATOR = { icon: "", color: "gray" };

// ============================================================================
// Helper Functions
// ============================================================================

function getStatusIcon(status: PhaseStatus): string {
  return (PHASE_STATUS_STYLES[status] ?? DEFAULT_PHASE_STYLE).icon;
}

function getStatusColor(status: PhaseStatus): string {
  return (PHASE_STATUS_STYLES[status] ?? DEFAULT_PHASE_STYLE).color;
}

function getRiskIndicator(riskLevel: RiskLevel): { icon: string; color: string } {
  return RISK_LEVEL_INDICATORS[riskLevel] ?? DEFAULT_RISK_INDICATOR;
}


// ============================================================================
// Phase Item Component
// ============================================================================

function PhaseItem({ phase, isCurrent, showDetails = false }: PhaseItemProps) {
  const statusIcon = getStatusIcon(phase.status);
  const statusColor = getStatusColor(phase.status);
  const risk = getRiskIndicator(phase.riskLevel);

  return (
    <Box flexDirection="column">
      <Box>
        <Text color={statusColor} bold={isCurrent}>
          {statusIcon}
        </Text>
        <Text color={isCurrent ? "white" : "gray"} bold={isCurrent}>
          {" "}
          {phase.index + 1}. {phase.name}
        </Text>
        {risk.icon && (
          <Text color={risk.color}> {risk.icon}</Text>
        )}
        {phase.duration && (
          <Text color="gray" dimColor>
            {" "}
            ({formatDuration(phase.duration)})
          </Text>
        )}
      </Box>

      {showDetails && (
        <Box flexDirection="column" paddingLeft={3}>
          <Text color="gray" dimColor>
            {phase.description}
          </Text>
          {phase.objectives.length > 0 && (
            <Box flexDirection="column" marginTop={0}>
              {phase.objectives.slice(0, 3).map((obj, i) => (
                <Text key={i} color="gray" dimColor>
                  • {obj}
                </Text>
              ))}
              {phase.objectives.length > 3 && (
                <Text color="gray" dimColor>
                  ...and {phase.objectives.length - 3} more
                </Text>
              )}
            </Box>
          )}
          {phase.error && (
            <Text color="red">Error: {phase.error}</Text>
          )}
        </Box>
      )}
    </Box>
  );
}

// ============================================================================
// Compact Progress Bar
// ============================================================================

interface CompactProgressProps {
  plan: TaskPlan;
}

function CompactProgress({ plan }: CompactProgressProps) {
  const total = plan.phases.length;
  const completed = plan.phases.filter(
    (p) => p.status === PhaseStatus.COMPLETED
  ).length;
  const failed = plan.phases.filter(
    (p) => p.status === PhaseStatus.FAILED
  ).length;
  const currentIndex = plan.currentPhaseIndex;

  // Build progress string
  const progress = plan.phases.map((phase, i) => {
    const icon = getStatusIcon(phase.status);
    const color = getStatusColor(phase.status);
    return { icon, color, isCurrent: i === currentIndex };
  });

  return (
    <Box flexDirection="column">
      <Box>
        <Text color="cyan" bold>
          Phase {currentIndex + 1}/{total}
        </Text>
        {currentIndex >= 0 && currentIndex < plan.phases.length && plan.phases[currentIndex] && (
          <Text color="white">
            : {plan.phases[currentIndex].name}
          </Text>
        )}
      </Box>
      <Box marginTop={0}>
        {progress.map((p, i) => (
          <Text
            key={i}
            color={p.color}
            bold={p.isCurrent}
          >
            {p.icon}
            {i < progress.length - 1 ? " → " : ""}
          </Text>
        ))}
      </Box>
      <Box marginTop={0}>
        <Text color="gray" dimColor>
          {completed} completed
          {failed > 0 && <Text color="red">, {failed} failed</Text>}
        </Text>
      </Box>
    </Box>
  );
}

// ============================================================================
// Main Phase Progress Component
// ============================================================================

export function PhaseProgress({
  plan,
  showDetails = false,
  compact = false,
}: PhaseProgressProps) {
  if (compact) {
    return <CompactProgress plan={plan} />;
  }

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color="cyan" bold>
          📋 Execution Plan
        </Text>
        <Text color="gray">
          {" "}
          ({plan.phases.length} phases)
        </Text>
      </Box>

      <Box flexDirection="column">
        {plan.phases.map((phase) => (
          <PhaseItem
            key={phase.id}
            phase={phase}
            isCurrent={phase.index === plan.currentPhaseIndex}
            showDetails={showDetails}
          />
        ))}
      </Box>

      {plan.estimatedDuration > 0 && (
        <Box marginTop={1}>
          <Text color="gray" dimColor>
            Est. {formatDuration(plan.estimatedDuration)}
          </Text>
          {plan.actualDuration > 0 && (
            <Text color="gray" dimColor>
              {" "}
              • Actual: {formatDuration(plan.actualDuration)}
            </Text>
          )}
        </Box>
      )}
    </Box>
  );
}

// ============================================================================
// Plan Summary Component
// ============================================================================

interface PlanSummaryProps {
  plan: TaskPlan;
  onApprove?: () => void;
  onReject?: () => void;
  onModify?: () => void;
}

export function PlanSummary({ plan }: PlanSummaryProps) {
  const hasHighRisk = plan.phases.some(
    (p) => p.riskLevel === RiskLevel.HIGH
  );
  const parallelPhases = plan.phases.filter(
    (p) => p.canRunInParallel
  ).length;

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor="cyan"
      paddingX={2}
      paddingY={1}
    >
      <Box marginBottom={1}>
        <Text color="cyan" bold>
          📋 Execution Plan
        </Text>
      </Box>

      <Box marginBottom={1}>
        <Text color="gray">Request: </Text>
        <Text color="white">
          {plan.originalPrompt.slice(0, 60)}
          {plan.originalPrompt.length > 60 ? "..." : ""}
        </Text>
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text color="yellow" bold>
          Phases:
        </Text>
        {plan.phases.map((phase, i) => {
          const risk = getRiskIndicator(phase.riskLevel);
          return (
            <Box key={phase.id} paddingLeft={2}>
              <Text color="gray">
                {i + 1}.{" "}
              </Text>
              <Text color="white">{phase.name}</Text>
              {risk.icon && (
                <Text color={risk.color}> {risk.icon}</Text>
              )}
              {phase.requiresApproval && (
                <Text color="yellow"> (approval required)</Text>
              )}
            </Box>
          );
        })}
      </Box>

      <Box>
        <Text color="gray">
          Est: ~{formatDuration(plan.estimatedDuration)}
        </Text>
        <Text color="gray"> │ </Text>
        <Text color="gray">Phases: {plan.phases.length}</Text>
        {parallelPhases > 0 && (
          <>
            <Text color="gray"> │ </Text>
            <Text color="blue">Parallel: {parallelPhases}</Text>
          </>
        )}
        {hasHighRisk && (
          <>
            <Text color="gray"> │ </Text>
            <Text color="red">⚠ High Risk</Text>
          </>
        )}
      </Box>

      <Box marginTop={1} borderStyle="single" borderColor="gray" paddingX={1}>
        <Text color="gray" dimColor>
          [Enter] Execute │ [e] Edit │ [s] Skip phase │ [c] Cancel
        </Text>
      </Box>
    </Box>
  );
}

export default PhaseProgress;
