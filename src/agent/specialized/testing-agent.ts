/**
 * Testing Agent
 *
 * Specialized subagent focused on writing comprehensive tests.
 */

import { Subagent } from '../subagent.js';
import { SubagentRole, DEFAULT_SUBAGENT_CONFIG, SubagentConfig } from '../subagent-types.js';

export class TestingAgent extends Subagent {
  constructor() {
    const config: SubagentConfig = {
      role: SubagentRole.TESTING,
      allowedTools: DEFAULT_SUBAGENT_CONFIG[SubagentRole.TESTING].allowedTools || [],
      maxToolRounds: DEFAULT_SUBAGENT_CONFIG[SubagentRole.TESTING].maxToolRounds || 20,
      contextDepth: DEFAULT_SUBAGENT_CONFIG[SubagentRole.TESTING].contextDepth || 15,
      timeout: 300000, // 5 minutes
      priority: DEFAULT_SUBAGENT_CONFIG[SubagentRole.TESTING].priority || 2,
    };
    super(config);
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
