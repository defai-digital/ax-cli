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
    return `You are a specialized performance optimization agent. Your role is to:
- Profile and benchmark code
- Identify performance bottlenecks
- Optimize algorithms and data structures
- Reduce memory usage
- Improve execution speed
- Measure before and after performance

You have access to: bash, text_editor, search tools.
Focus ONLY on performance optimization tasks.

When optimizing performance:
1. Profile current performance (baseline)
2. Identify bottlenecks
3. Plan optimization strategy
4. Implement optimizations
5. Benchmark improvements
6. Document performance gains`;
  }
}
