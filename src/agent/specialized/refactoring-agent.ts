/**
 * Refactoring Agent
 *
 * Specialized subagent focused on code refactoring and improvement.
 */

import { Subagent } from '../subagent.js';
import { SubagentRole, type SubagentConfig } from '../subagent-types.js';

export class RefactoringAgent extends Subagent {
  constructor(configOverrides?: Partial<SubagentConfig>) {
    super(SubagentRole.REFACTORING, configOverrides);
  }

  protected buildSystemPrompt(): string {
    return `Refactoring agent. Improve the assigned code structure.

Requirements:
- Preserve existing functionality exactly
- Match existing code conventions
- Reduce duplication without over-abstracting
- Run tests after changes to verify behavior

Be brief. Focus only on refactoring.`;
  }
}
