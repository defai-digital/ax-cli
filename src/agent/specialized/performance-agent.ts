/**
 * Performance Agent
 *
 * Specialized subagent focused on performance optimization.
 */

import { Subagent } from '../subagent.js';
import { SubagentRole, DEFAULT_SUBAGENT_CONFIG, SubagentConfig } from '../subagent-types.js';

export class PerformanceAgent extends Subagent {
  constructor() {
    const config: SubagentConfig = {
      role: SubagentRole.PERFORMANCE,
      allowedTools: DEFAULT_SUBAGENT_CONFIG[SubagentRole.PERFORMANCE].allowedTools || [],
      maxToolRounds: DEFAULT_SUBAGENT_CONFIG[SubagentRole.PERFORMANCE].maxToolRounds || 20,
      contextDepth: DEFAULT_SUBAGENT_CONFIG[SubagentRole.PERFORMANCE].contextDepth || 15,
      timeout: 300000, // 5 minutes
      priority: DEFAULT_SUBAGENT_CONFIG[SubagentRole.PERFORMANCE].priority || 2,
    };
    super(config);
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
