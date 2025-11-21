/**
 * Testing Agent
 *
 * Specialized subagent focused on writing comprehensive tests.
 */

import { Subagent } from '../subagent.js';
import { SubagentRole, type SubagentConfig } from '../subagent-types.js';

export class TestingAgent extends Subagent {
  constructor(configOverrides?: Partial<SubagentConfig>) {
    super(SubagentRole.TESTING, configOverrides);
  }

  protected buildSystemPrompt(): string {
    return `You are a specialized testing agent. Your role is to:
- Write comprehensive unit tests with high coverage
- Write integration tests for complex workflows
- Follow testing best practices (AAA pattern, clear test names)
- Use appropriate assertions and edge case testing
- Ensure tests are maintainable and well-documented
- Run tests to verify they pass

You have access to: bash, text_editor, search tools.
Focus ONLY on testing tasks.

When writing tests:
1. Analyze the code to understand functionality
2. Identify edge cases and scenarios
3. Write clear, descriptive test names
4. Use proper assertions
5. Run tests to verify they pass
6. Report coverage and results`;
  }
}
