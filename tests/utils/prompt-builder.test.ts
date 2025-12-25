/**
 * Tests for utils/prompt-builder module
 * Tests system prompt building with various configurations
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all dependencies
vi.mock('../../packages/core/src/utils/config-loader.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../packages/core/src/utils/config-loader.js')>();
  return {
    ...actual,
    loadPromptsConfig: vi.fn().mockReturnValue({
      system_prompt: {
        identity: 'You are an AI assistant.',
        closing: 'End of instructions.',
        thinking: { title: 'Thinking', content: 'Think step by step.' },
        tools: { title: 'Tools', content: 'Use tools wisely.' },
        professional_objectivity: { title: 'Objectivity', content: 'Be objective.' },
        core_principles: { title: 'Principles', rules: ['Rule 1', 'Rule 2'] },
        tools_header: 'Available Tools:',
        sections: {
          extra: { title: 'Extra', guidelines: ['Guideline 1'] },
        },
      },
      custom_instructions_prefix: '\n<custom>\n',
      custom_instructions_suffix: '\n</custom>\n',
    }),
  };
});

vi.mock('../../packages/core/src/utils/settings-manager.js', () => ({
  getSettingsManager: vi.fn().mockReturnValue({
    getLanguage: vi.fn().mockReturnValue('en'),
  }),
}));

vi.mock('../../packages/core/src/memory/index.js', () => ({
  getContextInjector: vi.fn().mockReturnValue({
    getContext: vi.fn().mockReturnValue(null),
  }),
}));

vi.mock('../../packages/core/src/llm/tools.js', () => ({
  getMCPManager: vi.fn().mockReturnValue({
    getTools: vi.fn().mockReturnValue([]),
  }),
  convertMCPToolToLLMTool: vi.fn((mcpTool: { name: string; description?: string }) => ({
    type: 'function',
    function: {
      name: mcpTool.name,
      description: mcpTool.description ?? 'External tool',
      parameters: { type: 'object', properties: {} },
    },
  })),
}));

vi.mock('../../packages/core/src/provider/config.js', () => ({
  getActiveProvider: vi.fn().mockReturnValue({
    displayName: 'Test Provider',
    features: { supportsSearch: false },
  }),
}));

vi.mock('../../packages/core/src/tools/priority-registry.js', () => ({
  getPriorityRegistry: vi.fn().mockReturnValue({
    getCapabilityGuidance: vi.fn().mockReturnValue([]),
  }),
}));

vi.mock('../../packages/core/src/utils/project-index-manager.js', () => ({
  getProjectIndexManager: vi.fn().mockReturnValue({
    getPromptContext: vi.fn().mockReturnValue(null),
  }),
}));

import { buildSystemPrompt } from '../../packages/core/src/utils/prompt-builder.js';
import { loadPromptsConfig } from '../../packages/core/src/utils/config-loader.js';
import { getContextInjector } from '../../packages/core/src/memory/index.js';
import { getMCPManager } from '../../packages/core/src/llm/tools.js';
import { getActiveProvider } from '../../packages/core/src/provider/config.js';
import { getPriorityRegistry } from '../../packages/core/src/tools/priority-registry.js';
import { getProjectIndexManager } from '../../packages/core/src/utils/project-index-manager.js';

describe('buildSystemPrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should build basic system prompt with identity and closing', () => {
    const prompt = buildSystemPrompt({});

    expect(prompt).toContain('You are an AI assistant.');
    expect(prompt).toContain('End of instructions.');
  });

  it('should include named sections from config', () => {
    const prompt = buildSystemPrompt({});

    expect(prompt).toContain('Thinking:');
    expect(prompt).toContain('Think step by step.');
    expect(prompt).toContain('Tools:');
    expect(prompt).toContain('Use tools wisely.');
  });

  it('should include professional objectivity section', () => {
    const prompt = buildSystemPrompt({});

    expect(prompt).toContain('Objectivity:');
    expect(prompt).toContain('Be objective.');
  });

  it('should include core principles with rules', () => {
    const prompt = buildSystemPrompt({});

    expect(prompt).toContain('Principles:');
    expect(prompt).toContain('- Rule 1');
    expect(prompt).toContain('- Rule 2');
  });

  it('should include custom instructions when provided', () => {
    const prompt = buildSystemPrompt({
      customInstructions: 'Do this specific thing.',
    });

    expect(prompt).toContain('<custom>');
    expect(prompt).toContain('Do this specific thing.');
    expect(prompt).toContain('</custom>');
  });

  it('should not include custom instructions section when not provided', () => {
    const prompt = buildSystemPrompt({});

    expect(prompt).not.toContain('<custom>');
  });

  it('should include memory context when available', () => {
    vi.mocked(getContextInjector).mockReturnValue({
      getContext: vi.fn().mockReturnValue('Memory context here'),
    });

    const prompt = buildSystemPrompt({ includeMemory: true });

    expect(prompt).toContain('Memory context here');
    expect(prompt).toContain('---');
  });

  it('should not include memory when disabled', () => {
    vi.mocked(getContextInjector).mockReturnValue({
      getContext: vi.fn().mockReturnValue('Memory context here'),
    });

    const prompt = buildSystemPrompt({ includeMemory: false });

    expect(prompt).not.toContain('Memory context here');
  });

  it('should include project index when available', () => {
    vi.mocked(getProjectIndexManager).mockReturnValue({
      getPromptContext: vi.fn().mockReturnValue('Project index context'),
    });

    const prompt = buildSystemPrompt({ includeProjectIndex: true });

    expect(prompt).toContain('Project index context');
  });

  it('should not include project index when disabled', () => {
    vi.mocked(getProjectIndexManager).mockReturnValue({
      getPromptContext: vi.fn().mockReturnValue('Project index context'),
    });

    const prompt = buildSystemPrompt({ includeProjectIndex: false });

    expect(prompt).not.toContain('Project index context');
  });

  it('should include MCP tools when available', () => {
    vi.mocked(getMCPManager).mockReturnValue({
      getTools: vi.fn().mockReturnValue([
        { name: 'mcp__server__tool1', description: 'Tool 1 description' },
        { name: 'mcp__server__tool2', description: 'Tool 2 description\nMore details' },
      ]),
    });

    const prompt = buildSystemPrompt({});

    expect(prompt).toContain('MCP Tools (External Capabilities):');
    expect(prompt).toContain('- tool1: Tool 1 description');
    expect(prompt).toContain('- tool2: Tool 2 description');
  });

  it('should handle MCP tools without descriptions', () => {
    vi.mocked(getMCPManager).mockReturnValue({
      getTools: vi.fn().mockReturnValue([
        { name: 'mcp__server__tool_no_desc' },
      ]),
    });

    const prompt = buildSystemPrompt({});

    expect(prompt).toContain('- tool_no_desc: External tool');
  });

  it('should show native search message when provider supports it', () => {
    vi.mocked(getMCPManager).mockReturnValue({
      getTools: vi.fn().mockReturnValue([{ name: 'mcp__s__t', description: 'd' }]),
    });
    vi.mocked(getActiveProvider).mockReturnValue({
      displayName: 'Grok',
      features: { supportsSearch: true },
    });

    const prompt = buildSystemPrompt({});

    // When provider has native search, MCP tools are for specific URL fetching
    expect(prompt).toContain('Use MCP tools for fetching specific URLs');
  });

  it('should show MCP search message when provider lacks native search', () => {
    vi.mocked(getMCPManager).mockReturnValue({
      getTools: vi.fn().mockReturnValue([{ name: 'mcp__s__t', description: 'd' }]),
    });
    vi.mocked(getActiveProvider).mockReturnValue({
      displayName: 'GLM',
      features: { supportsSearch: false },
    });

    const prompt = buildSystemPrompt({});

    expect(prompt).toContain('Use MCP tools for web search');
  });

  it('should include tool selection guidelines when available', () => {
    vi.mocked(getMCPManager).mockReturnValue({
      getTools: vi.fn().mockReturnValue([{ name: 'mcp__s__t', description: 'd' }]),
    });
    vi.mocked(getPriorityRegistry).mockReturnValue({
      getCapabilityGuidance: vi.fn().mockReturnValue([
        'Use tool A for task X',
        'Use tool B for task Y',
      ]),
    });

    const prompt = buildSystemPrompt({});

    expect(prompt).toContain('Tool Selection Guidelines:');
    expect(prompt).toContain('- Use tool A for task X');
    expect(prompt).toContain('- Use tool B for task Y');
  });

  it('should include extra sections from config', () => {
    const prompt = buildSystemPrompt({});

    expect(prompt).toContain('Extra:');
    expect(prompt).toContain('- Guideline 1');
  });

  it('should handle null MCP manager', () => {
    vi.mocked(getMCPManager).mockReturnValue(null);

    const prompt = buildSystemPrompt({});

    expect(prompt).toContain('You are an AI assistant.');
    expect(prompt).not.toContain('MCP Tools');
  });

  it('should format sections with steps correctly', () => {
    vi.mocked(loadPromptsConfig).mockReturnValue({
      system_prompt: {
        identity: 'AI',
        closing: 'End',
        thinking: { title: 'Steps', steps: ['First', 'Second', 'Third'] },
      },
      custom_instructions_prefix: '',
      custom_instructions_suffix: '',
    });

    const prompt = buildSystemPrompt({});

    expect(prompt).toContain('Steps:');
    expect(prompt).toContain('1. First');
    expect(prompt).toContain('2. Second');
    expect(prompt).toContain('3. Third');
  });

  it('should handle sections without title', () => {
    vi.mocked(loadPromptsConfig).mockReturnValue({
      system_prompt: {
        identity: 'AI',
        closing: 'End',
        thinking: { content: 'Just content, no title' },
      },
      custom_instructions_prefix: '',
      custom_instructions_suffix: '',
    });

    const prompt = buildSystemPrompt({});

    expect(prompt).toContain('Just content, no title');
    expect(prompt).not.toMatch(/\nThinking:/); // No title was set
  });

  it('should include tools header when sections.tools exists', () => {
    vi.mocked(loadPromptsConfig).mockReturnValue({
      system_prompt: {
        identity: 'AI',
        closing: 'End',
        tools_header: 'Built-in Tools:',
        sections: {
          tools: [{ name: 'tool1' }],
        },
      },
      custom_instructions_prefix: '',
      custom_instructions_suffix: '',
    });

    const prompt = buildSystemPrompt({});

    expect(prompt).toContain('Built-in Tools:');
  });
});
