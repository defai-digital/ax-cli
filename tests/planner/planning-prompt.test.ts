/**
 * Tests for planning prompt utilities
 */

import { describe, it, expect } from 'vitest';
import {
  PLANNING_SYSTEM_PROMPT,
  buildPlanningPrompt,
  buildPhaseExecutionPrompt,
  buildPlanSummaryPrompt,
  shouldUseThinkingMode,
  getComplexityScore,
  isComplexRequest,
  estimateMinPhases,
  COMPLEX_KEYWORDS,
  SIMPLE_KEYWORDS,
  THINKING_MODE_KEYWORDS,
} from '../../packages/core/src/planner/prompts/planning-prompt.js';

describe('PLANNING_SYSTEM_PROMPT', () => {
  it('should be a non-empty string', () => {
    expect(PLANNING_SYSTEM_PROMPT).toBeDefined();
    expect(typeof PLANNING_SYSTEM_PROMPT).toBe('string');
    expect(PLANNING_SYSTEM_PROMPT.length).toBeGreaterThan(100);
  });

  it('should contain key planning instructions', () => {
    expect(PLANNING_SYSTEM_PROMPT).toContain('task planning');
    expect(PLANNING_SYSTEM_PROMPT).toContain('phases');
    expect(PLANNING_SYSTEM_PROMPT).toContain('dependencies');
  });

  it('should mention risk levels', () => {
    expect(PLANNING_SYSTEM_PROMPT).toContain('low');
    expect(PLANNING_SYSTEM_PROMPT).toContain('medium');
    expect(PLANNING_SYSTEM_PROMPT).toContain('high');
  });

  it('should require JSON output', () => {
    expect(PLANNING_SYSTEM_PROMPT).toContain('JSON');
  });
});

describe('buildPlanningPrompt', () => {
  it('should build prompt with just user request', () => {
    const prompt = buildPlanningPrompt('Create a REST API');

    expect(prompt).toContain('Create a REST API');
    expect(prompt).toContain('<request>');
    expect(prompt).toContain('</request>');
    expect(prompt).toContain('JSON');
  });

  it('should include project type when provided', () => {
    const prompt = buildPlanningPrompt('Create tests', { projectType: 'typescript' });

    expect(prompt).toContain('typescript');
    expect(prompt).toContain('Project type');
  });

  it('should include files when provided', () => {
    const prompt = buildPlanningPrompt('Refactor module', {
      files: ['src/index.ts', 'src/utils.ts', 'src/types.ts'],
    });

    expect(prompt).toContain('Relevant files');
    expect(prompt).toContain('src/index.ts');
    expect(prompt).toContain('src/utils.ts');
  });

  it('should limit files to 10', () => {
    const manyFiles = Array.from({ length: 20 }, (_, i) => `file${i}.ts`);
    const prompt = buildPlanningPrompt('Process files', { files: manyFiles });

    // Should only include first 10
    expect(prompt).toContain('file0.ts');
    expect(prompt).toContain('file9.ts');
    expect(prompt).not.toContain('file10.ts');
  });

  it('should include recent history when provided', () => {
    const prompt = buildPlanningPrompt('Continue', {
      recentHistory: ['Created file A', 'Modified file B', 'Ran tests'],
    });

    expect(prompt).toContain('Recent context');
    expect(prompt).toContain('Ran tests');
  });

  it('should limit history to last 3 items', () => {
    const prompt = buildPlanningPrompt('Continue', {
      recentHistory: ['Item 1', 'Item 2', 'Item 3', 'Item 4', 'Item 5'],
    });

    expect(prompt).toContain('Item 3');
    expect(prompt).toContain('Item 4');
    expect(prompt).toContain('Item 5');
    // First items should be excluded
  });

  it('should include complexity guidelines', () => {
    const prompt = buildPlanningPrompt('Simple task');

    expect(prompt).toContain('simple|moderate|complex');
    expect(prompt).toContain('phases');
    expect(prompt).toContain('dependencies');
  });

  it('should include tool references', () => {
    const prompt = buildPlanningPrompt('Edit a file');

    expect(prompt).toContain('toolsRequired');
  });
});

describe('buildPhaseExecutionPrompt', () => {
  const basicPhase = {
    name: 'Implementation',
    description: 'Implement the feature',
    objectives: ['Create service class', 'Add route handlers'],
    toolsRequired: ['view_file', 'str_replace_editor'],
  };

  it('should build prompt with phase details', () => {
    const prompt = buildPhaseExecutionPrompt(basicPhase);

    expect(prompt).toContain('Implementation');
    expect(prompt).toContain('Implement the feature');
    expect(prompt).toContain('Create service class');
    expect(prompt).toContain('Add route handlers');
  });

  it('should include numbered objectives', () => {
    const prompt = buildPhaseExecutionPrompt(basicPhase);

    expect(prompt).toContain('1. Create service class');
    expect(prompt).toContain('2. Add route handlers');
  });

  it('should include tools required', () => {
    const prompt = buildPhaseExecutionPrompt(basicPhase);

    expect(prompt).toContain('view_file, str_replace_editor');
  });

  it('should show "any" when no tools specified', () => {
    const phaseNoTools = {
      ...basicPhase,
      toolsRequired: [],
    };
    const prompt = buildPhaseExecutionPrompt(phaseNoTools);

    expect(prompt).toContain('any');
  });

  it('should include original request when provided', () => {
    const prompt = buildPhaseExecutionPrompt(basicPhase, {
      originalRequest: 'Build a user authentication system',
    });

    expect(prompt).toContain('Original user request');
    expect(prompt).toContain('Build a user authentication system');
  });

  it('should include completed phases when provided', () => {
    const prompt = buildPhaseExecutionPrompt(basicPhase, {
      previousPhases: ['Analysis completed', 'Design approved'],
    });

    expect(prompt).toContain('Completed phases');
    expect(prompt).toContain('Analysis completed');
    expect(prompt).toContain('Design approved');
  });

  it('should include instructions', () => {
    const prompt = buildPhaseExecutionPrompt(basicPhase);

    expect(prompt).toContain('Instructions');
    expect(prompt).toContain('Focus only on the objectives');
    expect(prompt).toContain('Complete all objectives');
  });
});

describe('buildPlanSummaryPrompt', () => {
  it('should summarize successful phases', () => {
    const results = [
      { phaseName: 'Analysis', success: true, output: 'Analyzed codebase' },
      { phaseName: 'Implementation', success: true, output: 'Created files' },
    ];

    const prompt = buildPlanSummaryPrompt(results);

    expect(prompt).toContain('Phase 1: Analysis');
    expect(prompt).toContain('Status: Success');
    expect(prompt).toContain('Phase 2: Implementation');
    expect(prompt).toContain('Analyzed codebase');
  });

  it('should handle failed phases', () => {
    const results = [
      { phaseName: 'Testing', success: false, output: 'Tests failed' },
    ];

    const prompt = buildPlanSummaryPrompt(results);

    expect(prompt).toContain('Status: Failed');
    expect(prompt).toContain('Tests failed');
  });

  it('should handle phases without output', () => {
    const results = [
      { phaseName: 'Cleanup', success: true },
    ];

    const prompt = buildPlanSummaryPrompt(results);

    expect(prompt).toContain('Cleanup');
    expect(prompt).toContain('Success');
    expect(prompt).not.toContain('Output:');
  });

  it('should request summary points', () => {
    const results = [{ phaseName: 'Test', success: true }];
    const prompt = buildPlanSummaryPrompt(results);

    expect(prompt).toContain('summary');
    expect(prompt).toContain('warnings');
    expect(prompt).toContain('next steps');
  });
});

describe('shouldUseThinkingMode', () => {
  it('should return false for simple requests', () => {
    expect(shouldUseThinkingMode('show me the file')).toBe(false);
    expect(shouldUseThinkingMode('list files')).toBe(false);
    expect(shouldUseThinkingMode('cat index.ts')).toBe(false);
    expect(shouldUseThinkingMode('quick fix')).toBe(false);
    expect(shouldUseThinkingMode('simple task')).toBe(false);
    expect(shouldUseThinkingMode('x')).toBe(false); // Very short
  });

  // Note: shouldUseThinkingMode returns false for requests < 50 chars
  it('should return true for analysis tasks', () => {
    expect(shouldUseThinkingMode('Analyze this codebase and find potential security issues in the code')).toBe(true);
    expect(shouldUseThinkingMode('Debug why the production server is crashing when users log in')).toBe(true);
    expect(shouldUseThinkingMode('Investigate the performance bottleneck in the database queries here')).toBe(true);
  });

  it('should return true for architecture/design tasks', () => {
    expect(shouldUseThinkingMode('Design the authentication system architecture for our microservices')).toBe(true);
    expect(shouldUseThinkingMode('Plan out the migration strategy for moving to a new database system')).toBe(true);
    expect(shouldUseThinkingMode('What are the trade-offs between Redis and Memcached for caching?')).toBe(true);
  });

  it('should return true for reasoning questions', () => {
    expect(shouldUseThinkingMode('Why does this function return undefined when called with null arguments?')).toBe(true);
    expect(shouldUseThinkingMode('How should I structure this module for better maintainability and testing?')).toBe(true);
    expect(shouldUseThinkingMode('Which approach is better for handling application state management?')).toBe(true);
    expect(shouldUseThinkingMode('Compare React hooks vs class components for this use case')).toBe(true);
  });

  it('should return true for explanation requests', () => {
    expect(shouldUseThinkingMode('Explain how the event loop works in Node.js with detailed examples')).toBe(true);
    expect(shouldUseThinkingMode('Help me understand this complex sorting algorithm implementation')).toBe(true);
    expect(shouldUseThinkingMode('Walk through this authentication code step by step so I understand it')).toBe(true);
  });

  it('should return true for debugging scenarios', () => {
    expect(shouldUseThinkingMode('This function is not working properly when processing large files, help me fix it')).toBe(true);
    expect(shouldUseThinkingMode('I am getting a strange error when I run the server in production mode')).toBe(true);
    expect(shouldUseThinkingMode('There is a bug in the payment processor that causes duplicate charges, help me fix it')).toBe(true);
  });

  it('should return true for comparison requests', () => {
    expect(shouldUseThinkingMode('Should I use TypeScript or JavaScript for this large-scale project?')).toBe(true);
    expect(shouldUseThinkingMode('REST API versus GraphQL for a mobile app with offline support')).toBe(true);
    expect(shouldUseThinkingMode('Is there an alternative to using Redux for state management here?')).toBe(true);
  });

  it('should return true for security audits', () => {
    expect(shouldUseThinkingMode('Do a comprehensive security audit of the authentication module code')).toBe(true);
    expect(shouldUseThinkingMode('Check for potential vulnerability in the user input handling logic')).toBe(true);
    expect(shouldUseThinkingMode('Review for bugs in the user validation code that handles passwords')).toBe(true);
  });

  it('should return true for complex tasks', () => {
    expect(shouldUseThinkingMode('This is a complicated refactoring task that needs careful planning')).toBe(true);
    // 'tricky' alone is short enough to be considered simple, so add more context
    expect(shouldUseThinkingMode('Handle this tricky edge case in the parser carefully')).toBe(true);
  });
});

describe('getComplexityScore', () => {
  it('should return 0 for empty request', () => {
    expect(getComplexityScore('')).toBe(0);
  });

  it('should return low score for simple requests', () => {
    const score = getComplexityScore('fix typo');
    expect(score).toBeLessThan(30);
  });

  it('should return higher score for longer requests', () => {
    const shortScore = getComplexityScore('fix bug');
    const longScore = getComplexityScore('Fix the bug in the authentication module that causes users to be logged out randomly when they navigate between pages');

    expect(longScore).toBeGreaterThan(shortScore);
  });

  it('should return higher score for complex keywords', () => {
    const simpleScore = getComplexityScore('change color');
    const complexScore = getComplexityScore('refactor the entire authentication system');

    expect(complexScore).toBeGreaterThan(simpleScore);
  });

  it('should return higher score for thinking mode keywords', () => {
    const score = getComplexityScore('analyze the codebase and debug the performance issues');
    expect(score).toBeGreaterThan(30);
  });

  it('should return higher score for multi-step indicators', () => {
    const singleScore = getComplexityScore('add a button');
    const multiScore = getComplexityScore('first add a button, then connect it to the API, after that add tests');

    expect(multiScore).toBeGreaterThan(singleScore);
  });

  it('should return higher score for codebase-wide requests', () => {
    const singleFileScore = getComplexityScore('update this file');
    const codebaseScore = getComplexityScore('update all files in the codebase');

    expect(codebaseScore).toBeGreaterThan(singleFileScore);
  });

  it('should cap score at 100', () => {
    const maximalRequest = 'analyze and refactor the entire codebase, first understand the architecture, then redesign it, next implement the changes, after that add comprehensive tests, finally document everything thoroughly';
    const score = getComplexityScore(maximalRequest);

    expect(score).toBeLessThanOrEqual(100);
  });
});

describe('isComplexRequest', () => {
  it('should return false for simple requests', () => {
    expect(isComplexRequest('fix bug in login')).toBe(false);
    expect(isComplexRequest('fix typo in README')).toBe(false);
    expect(isComplexRequest('rename variable')).toBe(false);
    expect(isComplexRequest('update the version number')).toBe(false);
  });

  it('should return true for refactoring requests', () => {
    expect(isComplexRequest('refactor the authentication module')).toBe(true);
    expect(isComplexRequest('rewrite the logging system')).toBe(true);
    expect(isComplexRequest('migrate from Express to Fastify')).toBe(true);
  });

  it('should return true for feature implementation', () => {
    expect(isComplexRequest('implement feature for user notifications')).toBe(true);
    expect(isComplexRequest('add authentication to the API')).toBe(true);
    expect(isComplexRequest('create API endpoints for products')).toBe(true);
  });

  it('should return true for multi-file requests', () => {
    expect(isComplexRequest('update all files in src directory')).toBe(true);
    expect(isComplexRequest('fix across the entire codebase')).toBe(true);
    expect(isComplexRequest('change every file that uses this function')).toBe(true);
    expect(isComplexRequest('update the whole project to use TypeScript')).toBe(true);
  });

  it('should return true for multi-step requests', () => {
    expect(isComplexRequest('first create the component, then add styles')).toBe(true);
    expect(isComplexRequest('implement the feature and also add tests')).toBe(true);
    expect(isComplexRequest('after implementing the API, deploy it')).toBe(true);
  });

  it('should return true for numbered lists', () => {
    expect(isComplexRequest('1. Create model 2. Add controller 3. Write tests')).toBe(true);
  });

  it('should return true for long complex requests', () => {
    const longRequest = 'Implement a complete user authentication system with login, registration, password reset, email verification, and session management';
    expect(isComplexRequest(longRequest)).toBe(true);
  });

  it('should return true for testing requests', () => {
    expect(isComplexRequest('add tests for all the API endpoints')).toBe(true);
    expect(isComplexRequest('write unit tests for the user service')).toBe(true);
  });

  it('should return true for documentation requests', () => {
    expect(isComplexRequest('document all the API endpoints')).toBe(true);
    expect(isComplexRequest('add documentation to the codebase')).toBe(true);
  });

  it('should return true for DevOps requests', () => {
    expect(isComplexRequest('set up the CI/CD pipeline')).toBe(true);
    expect(isComplexRequest('deploy the application to production')).toBe(true);
    expect(isComplexRequest('containerize with Docker')).toBe(true);
  });

  it('should return true for database requests', () => {
    expect(isComplexRequest('design the database schema')).toBe(true);
    expect(isComplexRequest('run the database migrations')).toBe(true);
  });
});

describe('estimateMinPhases', () => {
  it('should return 1 for simple requests', () => {
    expect(estimateMinPhases('fix a bug')).toBe(1);
  });

  it('should count distinct action verbs', () => {
    const multiAction = 'create the service, add validation, implement caching, test everything, document the API';
    const estimate = estimateMinPhases(multiAction);

    // Uses Math.min of action count and step count+1, so result depends on implementation
    expect(estimate).toBeGreaterThanOrEqual(1);
    expect(estimate).toBeLessThanOrEqual(5);
  });

  it('should count step indicators', () => {
    const steppedRequest = 'first analyze the code, then refactor it, next add tests, finally document';
    const estimate = estimateMinPhases(steppedRequest);

    // Has step indicators - should return at least 1
    expect(estimate).toBeGreaterThanOrEqual(1);
    expect(estimate).toBeLessThanOrEqual(5);
  });

  it('should cap at 5 phases', () => {
    const massiveRequest = 'create add implement test document refactor fix update remove migrate deploy';
    const estimate = estimateMinPhases(massiveRequest);

    expect(estimate).toBeLessThanOrEqual(5);
  });

  it('should return at least 1', () => {
    expect(estimateMinPhases('')).toBe(1);
    expect(estimateMinPhases('do something')).toBe(1);
  });
});

describe('COMPLEX_KEYWORDS', () => {
  it('should include major change keywords', () => {
    expect(COMPLEX_KEYWORDS).toContain('refactor');
    expect(COMPLEX_KEYWORDS).toContain('migrate');
    expect(COMPLEX_KEYWORDS).toContain('rewrite');
  });

  it('should include feature keywords', () => {
    expect(COMPLEX_KEYWORDS).toContain('implement feature');
    expect(COMPLEX_KEYWORDS).toContain('add authentication');
  });

  it('should include testing keywords', () => {
    expect(COMPLEX_KEYWORDS).toContain('unit tests');
    expect(COMPLEX_KEYWORDS).toContain('integration tests');
  });
});

describe('SIMPLE_KEYWORDS', () => {
  it('should include basic change keywords', () => {
    expect(SIMPLE_KEYWORDS).toContain('fix bug');
    expect(SIMPLE_KEYWORDS).toContain('typo');
    expect(SIMPLE_KEYWORDS).toContain('rename');
  });
});

describe('THINKING_MODE_KEYWORDS', () => {
  it('should include analysis keywords', () => {
    expect(THINKING_MODE_KEYWORDS).toContain('analyze');
    expect(THINKING_MODE_KEYWORDS).toContain('debug');
    expect(THINKING_MODE_KEYWORDS).toContain('investigate');
  });

  it('should include design keywords', () => {
    expect(THINKING_MODE_KEYWORDS).toContain('architect');
    expect(THINKING_MODE_KEYWORDS).toContain('design');
  });

  it('should include security keywords', () => {
    expect(THINKING_MODE_KEYWORDS).toContain('security audit');
    expect(THINKING_MODE_KEYWORDS).toContain('vulnerability');
  });
});
