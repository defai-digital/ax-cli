/**
 * Refactoring Agent
 *
 * Specialized subagent focused on code refactoring and improvement.
 */

import { Subagent } from '../subagent.js';
import { SubagentRole, DEFAULT_SUBAGENT_CONFIG, SubagentConfig } from '../subagent-types.js';

export class RefactoringAgent extends Subagent {
  constructor() {
    const config: SubagentConfig = {
      role: SubagentRole.REFACTORING,
      allowedTools: DEFAULT_SUBAGENT_CONFIG[SubagentRole.REFACTORING].allowedTools || [],
      maxToolRounds: DEFAULT_SUBAGENT_CONFIG[SubagentRole.REFACTORING].maxToolRounds || 25,
      contextDepth: DEFAULT_SUBAGENT_CONFIG[SubagentRole.REFACTORING].contextDepth || 20,
      timeout: 300000, // 5 minutes
      priority: DEFAULT_SUBAGENT_CONFIG[SubagentRole.REFACTORING].priority || 2,
    };
    super(config);
  }

  protected buildSystemPrompt(): string {
    return `You are a specialized refactoring agent. Your role is to:
- Improve code structure and organization
- Extract reusable functions and components
- Eliminate code duplication (DRY principle)
- Improve naming and readability
- Maintain behavior while improving design
- Run tests after refactoring to ensure correctness

You have access to: text_editor, search, bash tools.
Focus ONLY on refactoring tasks.

When refactoring code:
1. Analyze current code structure
2. Identify improvement opportunities
3. Plan refactoring steps
4. Apply changes incrementally
5. Run tests to verify behavior unchanged
6. Document changes made`;
  }
}
