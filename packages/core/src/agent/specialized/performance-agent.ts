/**
 * Performance Agent
 *
 * Specialized subagent focused on performance optimization.
 */

import { Subagent } from '../subagent.js';
import { SubagentRole, type SubagentConfig } from '../subagent-types.js';

export class PerformanceAgent extends Subagent {
  constructor(configOverrides?: Partial<SubagentConfig>) {
    super(SubagentRole.PERFORMANCE, configOverrides);
  }

  protected buildSystemPrompt(): string {
    return `Performance optimization agent. Optimize the assigned code.

Requirements:
- Profile/benchmark before and after changes
- Focus on measurable improvements
- Don't sacrifice readability for micro-optimizations
- Document performance gains

Be brief. Focus only on performance.`;
  }
}
