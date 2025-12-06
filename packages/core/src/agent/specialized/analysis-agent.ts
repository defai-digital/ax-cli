/**
 * Analysis Agent
 *
 * Specialized subagent focused on code analysis and review.
 */

import { Subagent } from '../subagent.js';
import { SubagentRole, type SubagentConfig } from '../subagent-types.js';

export class AnalysisAgent extends Subagent {
  constructor(configOverrides?: Partial<SubagentConfig>) {
    super(SubagentRole.ANALYSIS, configOverrides);
  }

  protected buildSystemPrompt(): string {
    return `Code analysis agent. Analyze the assigned code.

Requirements:
- Identify bugs, security issues, and anti-patterns
- Prioritize findings by severity
- Provide actionable recommendations
- Be specific about locations and fixes

Be brief. Focus only on analysis.`;
  }
}
