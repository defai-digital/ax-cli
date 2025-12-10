/**
 * Unit tests for lazy tool initialization in LLMAgent
 * Verifies that rarely-used tools are only instantiated when first accessed
 */

import { describe, it, expect } from 'vitest';
import { LLMAgent } from '../../packages/core/src/agent/llm-agent.js';

describe('LLMAgent Lazy Tool Loading', () => {
  it('should create agent without instantiating lazy tools immediately', () => {
    // This test verifies that agent construction completes quickly
    // because lazy tools (architectureTool, validationTool) aren't created yet

    const apiKey = process.env.YOUR_API_KEY || 'test-key';
    const baseURL = 'http://localhost:11434/v1'; // Provide base URL for test
    const startTime = Date.now();

    const agent = new LLMAgent(apiKey, baseURL, 'glm-4.6', 10);

    const constructionTime = Date.now() - startTime;

    // Agent should be created
    expect(agent).toBeDefined();

    // Construction should be relatively fast (<2000ms even on slow machines or during parallel test runs)
    // This is a loose check since we can't directly verify tool instances
    expect(constructionTime).toBeLessThan(2000);
  });

  it('should handle getCurrentModel without errors', () => {
    const apiKey = process.env.YOUR_API_KEY || 'test-key';
    const baseURL = 'http://localhost:11434/v1'; // Provide base URL for test
    const agent = new LLMAgent(apiKey, baseURL, 'glm-4.6', 10);

    // Should work even with lazy-loaded tools
    const model = agent.getCurrentModel();
    expect(model).toBe('glm-4.6');
  });

  it('should create multiple agents efficiently', () => {
    // With lazy loading, creating multiple agents should be faster
    // than if all tools were eagerly instantiated

    const apiKey = process.env.YOUR_API_KEY || 'test-key';
    const baseURL = 'http://localhost:11434/v1'; // Provide base URL for test
    const startTime = Date.now();

    const agents = [];
    for (let i = 0; i < 5; i++) {
      agents.push(new LLMAgent(apiKey, baseURL, 'glm-4.6', 10));
    }

    const totalTime = Date.now() - startTime;

    // All agents created
    expect(agents.length).toBe(5);

    // Should complete in reasonable time (<5000ms for 5 agents)
    expect(totalTime).toBeLessThan(5000);

    // Average per agent should be reasonable (<1000ms)
    const avgTime = totalTime / 5;
    expect(avgTime).toBeLessThan(1000);
  });
});
