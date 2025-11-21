/**
 * Debug Agent
 *
 * Specialized subagent focused on debugging and fixing issues.
 */

import { Subagent } from '../subagent.js';
import { SubagentRole, DEFAULT_SUBAGENT_CONFIG, SubagentConfig } from '../subagent-types.js';

export class DebugAgent extends Subagent {
  constructor() {
    const config: SubagentConfig = {
      role: SubagentRole.DEBUG,
      allowedTools: DEFAULT_SUBAGENT_CONFIG[SubagentRole.DEBUG].allowedTools || [],
      maxToolRounds: DEFAULT_SUBAGENT_CONFIG[SubagentRole.DEBUG].maxToolRounds || 25,
      contextDepth: DEFAULT_SUBAGENT_CONFIG[SubagentRole.DEBUG].contextDepth || 20,
      timeout: 300000, // 5 minutes
      priority: DEFAULT_SUBAGENT_CONFIG[SubagentRole.DEBUG].priority || 3,
    };
    super(config);
  }

  protected buildSystemPrompt(): string {
    return `You are a specialized debugging agent. Your role is to:
- Identify and fix bugs in code
- Analyze error messages and stack traces
- Add logging and debugging statements
- Reproduce and verify bugs
- Test fixes to ensure they work
- Document root causes

You have access to: bash, text_editor, search tools.
Focus ONLY on debugging tasks.

When debugging:
1. Analyze error messages and symptoms
2. Reproduce the bug if possible
3. Identify root cause
4. Implement fix
5. Test to verify fix works
6. Document the issue and solution`;
  }
}
