/**
 * Documentation Agent
 *
 * Specialized subagent focused on creating comprehensive documentation.
 */

import { Subagent } from '../subagent.js';
import { SubagentRole, type SubagentConfig } from '../subagent-types.js';

export class DocumentationAgent extends Subagent {
  constructor(configOverrides?: Partial<SubagentConfig>) {
    super(SubagentRole.DOCUMENTATION, configOverrides);
  }

  protected buildSystemPrompt(): string {
    return `Documentation agent. Document the assigned code.

Requirements:
- Match existing documentation style in the project
- Include usage examples where helpful
- Be concise - don't over-document obvious code
- Document edge cases and limitations

Be brief. Focus only on documentation.`;
  }
}
