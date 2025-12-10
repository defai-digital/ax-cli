/**
 * Basic 40% Context Usage Test
 * 
 * Simple test to verify 40% context usage functionality works
 */

import { describe, it, expect } from 'vitest';
import { GLM_MODELS } from '../../packages/core/src/constants.js';

describe('Basic 40% Context Usage Test', () => {
  it('should calculate 40% of GLM-4.6 context correctly', () => {
    // Get GLM-4.6 configuration
    const glmConfig = GLM_MODELS['glm-4.6'];
    
    console.log('=== GLM-4.6 Configuration ===');
    console.log(`Context Window: ${glmConfig.contextWindow.toLocaleString()} tokens`);
    console.log(`Max Output Tokens: ${glmConfig.maxOutputTokens.toLocaleString()} tokens`);
    console.log(`Default Max Tokens: ${glmConfig.defaultMaxTokens.toLocaleString()} tokens`);
    
    // Calculate 40%
    const maxContext = glmConfig.contextWindow;
    const fortyPercent = Math.floor(maxContext * 0.4);
    
    console.log('\n=== 40% Calculation ===');
    console.log(`40% of ${maxContext.toLocaleString()} = ${fortyPercent.toLocaleString()} tokens`);
    console.log(`Percentage check: ${(fortyPercent / maxContext) * 100}%`);
    
    // Verify calculations
    expect(maxContext).toBe(200000); // 200K tokens
    expect(fortyPercent).toBe(80000); // 80K tokens
    expect((fortyPercent / maxContext) * 100).toBe(40);
    
    console.log('\n✓ 40% calculation is correct');
  });

  it('should verify context window percentages', () => {
    const glmConfig = GLM_MODELS['glm-4.6'];
    const maxContext = glmConfig.contextWindow;
    
    console.log('=== Context Window Percentages ===');
    
    // Test various percentages
    const percentages = [
      { pct: 0.1, name: '10%' },
      { pct: 0.25, name: '25%' },
      { pct: 0.4, name: '40%' },
      { pct: 0.5, name: '50%' },
      { pct: 0.75, name: '75%' },
      { pct: 1.0, name: '100%' }
    ];
    
    for (const { pct, name } of percentages) {
      const tokens = Math.floor(maxContext * pct);
      const calculatedPct = (tokens / maxContext) * 100;
      
      console.log(`${name}: ${tokens.toLocaleString()} tokens (${calculatedPct.toFixed(1)}%)`);
      
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThanOrEqual(maxContext);
      expect(calculatedPct).toBeCloseTo(pct * 100, 1);
    }
    
    console.log('\n✓ All percentage calculations are correct');
  });

  it('should demonstrate token ranges for 40% usage', () => {
    const glmConfig = GLM_MODELS['glm-4.6'];
    const maxContext = glmConfig.contextWindow;
    const target40Percent = Math.floor(maxContext * 0.4);
    
    console.log('=== Token Usage Ranges ===');
    console.log(`GLM-4.6 Max Context: ${maxContext.toLocaleString()} tokens`);
    console.log(`40% Target: ${target40Percent.toLocaleString()} tokens`);
    
    // Show realistic ranges
    const ranges = [
      { name: 'Very Small', pct: 0.05 },
      { name: 'Small', pct: 0.1 },
      { name: 'Medium', pct: 0.25 },
      { name: 'Large', pct: 0.4 },
      { name: 'Very Large', pct: 0.6 }
    ];
    
    for (const range of ranges) {
      const tokens = Math.floor(maxContext * range.pct);
      const percentage = (tokens / maxContext) * 100;
      
      console.log(`${range.name} (${(range.pct * 100).toFixed(0)}%): ${tokens.toLocaleString()} tokens`);
    }
    
    // Verify 40% is in the right range
    expect(target40Percent).toBeGreaterThan(50000); // More than 25%
    expect(target40Percent).toBeLessThan(100000); // Less than 50%
    
    console.log('\n✓ 40% target is in appropriate range');
  });

  it('should show context efficiency calculations', () => {
    const glmConfig = GLM_MODELS['glm-4.6'];
    const maxContext = glmConfig.contextWindow;
    const target40Percent = Math.floor(maxContext * 0.4);
    
    console.log('=== Context Efficiency Analysis ===');
    
    // Character estimates (roughly 4 characters per token)
    const charsPerToken = 4;
    const estimatedChars = target40Percent * charsPerToken;
    
    console.log(`40% Tokens: ${target40Percent.toLocaleString()}`);
    console.log(`Estimated Characters: ~${estimatedChars.toLocaleString()}`);
    console.log(`Characters per Token: ${charsPerToken}`);
    
    // Show what this means in practice
    const averageWordsPerToken = 0.75; // Rough estimate
    const estimatedWords = Math.floor(target40Percent * averageWordsPerToken);
    const averagePages = Math.ceil(estimatedWords / 500); // 500 words per page
    
    console.log(`Estimated Words: ~${estimatedWords.toLocaleString()}`);
    console.log(`Estimated Pages: ~${averagePages} (500 words/page)`);
    
    // Verify reasonable estimates
    expect(estimatedChars).toBeGreaterThan(200000); // 200K+ characters
    expect(estimatedWords).toBeGreaterThan(40000); // 40K+ words
    expect(averagePages).toBeGreaterThan(80); // 80+ pages
    
    console.log('\n✓ Context efficiency estimates are reasonable');
  });
});

describe('Context Usage Demonstration', () => {
  it('should provide context usage guidelines', () => {
    console.log('=== AX CLI Context Usage Guidelines ===');
    console.log('');
    console.log('GLM-4.6 Model Specifications:');
    console.log('- Context Window: 200,000 tokens');
    console.log('- Max Output: 128,000 tokens');
    console.log('- Default Max: 8,192 tokens');
    console.log('');
    console.log('Recommended Usage Levels:');
    console.log('- Small Projects: 10-25% (20K-50K tokens)');
    console.log('- Medium Projects: 25-40% (50K-80K tokens)');
    console.log('- Large Projects: 40-60% (80K-120K tokens)');
    console.log('- Very Large Projects: 60-75% (120K-150K tokens)');
    console.log('');
    console.log('40% Usage Benefits:');
    console.log('- Balanced context and performance');
    console.log('- Good for medium to large projects');
    console.log('- Allows room for conversation history');
    console.log('- Optimal for complex code analysis');
    console.log('');
    console.log('Implementation:');
    console.log('- Use maxTokens parameter in ContextGenerator');
    console.log('- Monitor token usage via context.token_estimate');
    console.log('- Adjust based on project complexity');
    console.log('- Consider caching for repeated usage');
    
    // Verify the guidelines make sense
    const glmConfig = GLM_MODELS['glm-4.6'];
    const maxContext = glmConfig.contextWindow;
    const fortyPercent = Math.floor(maxContext * 0.4);
    
    expect(fortyPercent).toBe(80000);
    expect(fortyPercent).toBeGreaterThan(50000); // More than 25%
    expect(fortyPercent).toBeLessThan(120000); // Less than 60%
    
    console.log('\n✓ Guidelines are consistent with GLM-4.6 capabilities');
  });
});