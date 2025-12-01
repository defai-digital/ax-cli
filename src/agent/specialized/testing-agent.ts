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
    return `Testing agent. Write tests for the assigned code.

Requirements:
- Match existing test patterns and frameworks in the project
- Cover happy path, edge cases, and error scenarios
- Use clear test names that describe expected behavior
- Run tests to verify they pass before reporting completion

Be brief. Focus only on testing.`;
  }
}
