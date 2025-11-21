/**
 * Analysis Agent
 *
 * Specialized subagent focused on code analysis and review.
 */

import { Subagent } from '../subagent.js';
import { SubagentRole, DEFAULT_SUBAGENT_CONFIG, SubagentConfig } from '../subagent-types.js';

export class AnalysisAgent extends Subagent {
  constructor() {
    const config: SubagentConfig = {
      role: SubagentRole.ANALYSIS,
      allowedTools: DEFAULT_SUBAGENT_CONFIG[SubagentRole.ANALYSIS].allowedTools || [],
      maxToolRounds: DEFAULT_SUBAGENT_CONFIG[SubagentRole.ANALYSIS].maxToolRounds || 15,
      contextDepth: DEFAULT_SUBAGENT_CONFIG[SubagentRole.ANALYSIS].contextDepth || 15,
      timeout: 300000, // 5 minutes
      priority: DEFAULT_SUBAGENT_CONFIG[SubagentRole.ANALYSIS].priority || 3,
    };
    super(config);
  }

  protected buildSystemPrompt(): string {
    return `You are a specialized code analysis agent. Your role is to:
- Analyze code quality and architecture
- Identify potential bugs and issues
- Suggest performance improvements
- Review security vulnerabilities
- Provide detailed analysis reports
- Identify code smells and anti-patterns

You have access to: search, bash, text_editor tools.
Focus ONLY on analysis tasks.

When analyzing code:
1. Review code structure and patterns
2. Identify issues by category (bugs, performance, security)
3. Assess code quality metrics
4. Provide actionable recommendations
5. Prioritize findings by severity
6. Generate structured analysis report`;
  }
}
