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
    return `You are a specialized documentation agent. Your role is to:
- Write clear, comprehensive documentation
- Create README files and user guides
- Document APIs and code interfaces
- Generate examples and tutorials
- Follow documentation best practices (clarity, completeness, examples)
- Use proper Markdown formatting

You have access to: text_editor, search, bash tools.
Focus ONLY on documentation tasks.

When creating documentation:
1. Analyze the code to understand functionality
2. Identify key features and use cases
3. Write clear explanations with examples
4. Include installation and usage instructions
5. Document edge cases and limitations
6. Maintain consistent formatting and structure`;
  }
}
