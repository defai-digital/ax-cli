/**
 * Tests for YAML schema validation
 */

import { describe, it, expect } from 'vitest';
import {
  ModelConfigSchema,
  ModelsYamlSchema,
  SettingsYamlSchema,
  MessagesYamlSchema,
  PromptSectionSchema,
  ToolDefinitionSchema,
  PromptsYamlSchema,
  validateModelsYaml,
  validateSettingsYaml,
  validateMessagesYaml,
  validatePromptsYaml,
} from '../../packages/core/src/schemas/yaml-schemas.js';

describe('ModelConfigSchema', () => {
  const validModelConfig = {
    name: 'test-model',
    context_window: 128000,
    max_output_tokens: 16000,
    default_max_tokens: 4096,
    supports_thinking: true,
    default_temperature: 0.7,
    temperature_range: { min: 0.0, max: 1.0 },
    token_efficiency: 1.2,
  };

  it('should accept valid model config', () => {
    const result = ModelConfigSchema.safeParse(validModelConfig);
    expect(result.success).toBe(true);
  });

  it('should reject empty name', () => {
    const result = ModelConfigSchema.safeParse({
      ...validModelConfig,
      name: '',
    });
    expect(result.success).toBe(false);
  });

  it('should reject negative context_window', () => {
    const result = ModelConfigSchema.safeParse({
      ...validModelConfig,
      context_window: -1000,
    });
    expect(result.success).toBe(false);
  });

  it('should reject non-integer max_output_tokens', () => {
    const result = ModelConfigSchema.safeParse({
      ...validModelConfig,
      max_output_tokens: 4096.5,
    });
    expect(result.success).toBe(false);
  });

  it('should reject temperature out of range', () => {
    const result = ModelConfigSchema.safeParse({
      ...validModelConfig,
      default_temperature: 3.0,
    });
    expect(result.success).toBe(false);
  });

  it('should reject temperature_range with min > max', () => {
    const result = ModelConfigSchema.safeParse({
      ...validModelConfig,
      temperature_range: { min: 1.0, max: 0.5 },
    });
    expect(result.success).toBe(false);
  });

  it('should reject negative token_efficiency', () => {
    const result = ModelConfigSchema.safeParse({
      ...validModelConfig,
      token_efficiency: -1,
    });
    expect(result.success).toBe(false);
  });
});

describe('ModelsYamlSchema', () => {
  const validModelsYaml = {
    default_model: 'test-model',
    models: {
      'test-model': {
        name: 'test-model',
        context_window: 128000,
        max_output_tokens: 16000,
        default_max_tokens: 4096,
        supports_thinking: true,
        default_temperature: 0.7,
        temperature_range: { min: 0.0, max: 1.0 },
        token_efficiency: 1.2,
      },
    },
  };

  it('should accept valid models yaml', () => {
    const result = ModelsYamlSchema.safeParse(validModelsYaml);
    expect(result.success).toBe(true);
  });

  it('should reject empty default_model', () => {
    const result = ModelsYamlSchema.safeParse({
      ...validModelsYaml,
      default_model: '',
    });
    expect(result.success).toBe(false);
  });

  it('should reject default_model not in models', () => {
    const result = ModelsYamlSchema.safeParse({
      ...validModelsYaml,
      default_model: 'non-existent-model',
    });
    expect(result.success).toBe(false);
  });

  it('should accept multiple models', () => {
    const result = ModelsYamlSchema.safeParse({
      default_model: 'model-a',
      models: {
        'model-a': {
          name: 'model-a',
          context_window: 64000,
          max_output_tokens: 8000,
          default_max_tokens: 2048,
          supports_thinking: false,
          default_temperature: 0.5,
          temperature_range: { min: 0.0, max: 1.0 },
          token_efficiency: 1.0,
        },
        'model-b': {
          name: 'model-b',
          context_window: 128000,
          max_output_tokens: 16000,
          default_max_tokens: 4096,
          supports_thinking: true,
          default_temperature: 0.7,
          temperature_range: { min: 0.6, max: 1.0 },
          token_efficiency: 1.5,
        },
      },
    });
    expect(result.success).toBe(true);
  });
});

describe('SettingsYamlSchema', () => {
  const validSettingsYaml = {
    agent: {
      max_tool_rounds: 50,
      default_timeout: 30000,
      default_max_tokens: 4096,
      max_recent_tool_calls: 10,
      loop_detection_threshold: 3,
      enable_loop_detection: true,
    },
    file: {
      max_file_size: 1048576,
      max_buffer_size: 2097152,
      diff_context_lines: 3,
    },
    history: {
      max_history_size: 100,
    },
    mcp: {
      client_name: 'ax-cli',
      client_version: '1.0.0',
      default_timeout: 30000,
      token_warning_threshold: 100000,
      token_hard_limit: 200000,
      truncation_enabled: true,
    },
    ui: {
      status_update_interval: 1000,
      processing_timer_interval: 100,
    },
    token: {
      tokens_per_message: 3,
      tokens_for_reply_priming: 3,
      default_model: 'cl100k_base',
      default_encoding: 'cl100k_base',
      cache_max_size: 1000,
      chars_per_token_estimate: 4,
    },
    cache: {
      default_max_size: 100,
      default_ttl: 300000,
    },
    performance: {
      debounce_delay: 100,
      throttle_limit: 10,
      slow_operation_threshold: 5000,
    },
    tool_names: {
      bash: 'bash',
      read_file: 'view_file',
    },
  };

  it('should accept valid settings yaml', () => {
    const result = SettingsYamlSchema.safeParse(validSettingsYaml);
    expect(result.success).toBe(true);
  });

  it('should reject non-integer max_tool_rounds', () => {
    const result = SettingsYamlSchema.safeParse({
      ...validSettingsYaml,
      agent: { ...validSettingsYaml.agent, max_tool_rounds: 50.5 },
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid semver client_version', () => {
    const result = SettingsYamlSchema.safeParse({
      ...validSettingsYaml,
      mcp: { ...validSettingsYaml.mcp, client_version: 'invalid' },
    });
    expect(result.success).toBe(false);
  });

  it('should accept optional max_messages', () => {
    const result = SettingsYamlSchema.safeParse({
      ...validSettingsYaml,
      agent: { ...validSettingsYaml.agent, max_messages: 100 },
    });
    expect(result.success).toBe(true);
  });

  it('should accept optional ui settings', () => {
    const result = SettingsYamlSchema.safeParse({
      ...validSettingsYaml,
      ui: {
        ...validSettingsYaml.ui,
        verbosity_level: 'verbose',
        group_tool_calls: true,
        max_group_size: 5,
        semantic_grouping: true,
        max_visible_tool_lines: 10,
      },
    });
    expect(result.success).toBe(true);
  });

  it('should reject negative debounce_delay', () => {
    const result = SettingsYamlSchema.safeParse({
      ...validSettingsYaml,
      performance: { ...validSettingsYaml.performance, debounce_delay: -1 },
    });
    expect(result.success).toBe(false);
  });
});

describe('MessagesYamlSchema', () => {
  const validMessagesYaml = {
    errors: {
      file_not_found: 'File not found: {path}',
      permission_denied: 'Permission denied',
    },
    warnings: {
      large_file: 'File is large',
    },
    success: {
      file_saved: 'File saved successfully',
    },
    info: {
      processing: 'Processing...',
    },
  };

  it('should accept valid messages yaml', () => {
    const result = MessagesYamlSchema.safeParse(validMessagesYaml);
    expect(result.success).toBe(true);
  });

  it('should accept optional ui section', () => {
    const result = MessagesYamlSchema.safeParse({
      ...validMessagesYaml,
      ui: {
        status: {
          loading: 'Loading...',
          done: 'Done!',
        },
      },
    });
    expect(result.success).toBe(true);
  });

  it('should accept optional mcp_commands section', () => {
    const result = MessagesYamlSchema.safeParse({
      ...validMessagesYaml,
      mcp_commands: {
        list: 'List all servers',
        connect: 'Connect to server',
      },
    });
    expect(result.success).toBe(true);
  });

  it('should accept optional migration section', () => {
    const result = MessagesYamlSchema.safeParse({
      ...validMessagesYaml,
      migration: {
        v1_to_v2: 'Migrating from v1 to v2',
      },
    });
    expect(result.success).toBe(true);
  });

  it('should reject missing required sections', () => {
    const result = MessagesYamlSchema.safeParse({
      errors: {},
      // missing warnings, success, info
    });
    expect(result.success).toBe(false);
  });
});

describe('PromptSectionSchema', () => {
  it('should accept empty object', () => {
    const result = PromptSectionSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should accept section with title and content', () => {
    const result = PromptSectionSchema.safeParse({
      title: 'Test Section',
      content: 'This is the content.',
    });
    expect(result.success).toBe(true);
  });

  it('should accept section with rules', () => {
    const result = PromptSectionSchema.safeParse({
      title: 'Rules',
      rules: ['Rule 1', 'Rule 2', 'Rule 3'],
    });
    expect(result.success).toBe(true);
  });

  it('should accept section with steps', () => {
    const result = PromptSectionSchema.safeParse({
      title: 'Steps',
      steps: ['Step 1', 'Step 2'],
    });
    expect(result.success).toBe(true);
  });

  it('should accept section with guidelines', () => {
    const result = PromptSectionSchema.safeParse({
      title: 'Guidelines',
      guidelines: ['Guideline 1', 'Guideline 2'],
    });
    expect(result.success).toBe(true);
  });
});

describe('ToolDefinitionSchema', () => {
  it('should accept valid tool definition', () => {
    const result = ToolDefinitionSchema.safeParse({
      name: 'bash',
      description: 'Execute shell commands',
    });
    expect(result.success).toBe(true);
  });

  it('should accept optional field', () => {
    const result = ToolDefinitionSchema.safeParse({
      name: 'bash',
      description: 'Execute shell commands',
      optional: true,
    });
    expect(result.success).toBe(true);
  });

  it('should reject empty name', () => {
    const result = ToolDefinitionSchema.safeParse({
      name: '',
      description: 'Execute shell commands',
    });
    expect(result.success).toBe(false);
  });

  it('should reject empty description', () => {
    const result = ToolDefinitionSchema.safeParse({
      name: 'bash',
      description: '',
    });
    expect(result.success).toBe(false);
  });
});

describe('PromptsYamlSchema', () => {
  const validPromptsYaml = {
    system_prompt: {
      identity: 'You are a helpful AI assistant.',
      closing: 'Follow these instructions carefully.',
    },
    custom_instructions_prefix: '# Custom Instructions',
    custom_instructions_suffix: '# End Custom Instructions',
  };

  it('should accept minimal valid prompts yaml', () => {
    const result = PromptsYamlSchema.safeParse(validPromptsYaml);
    expect(result.success).toBe(true);
  });

  it('should accept full prompts yaml with all sections', () => {
    const result = PromptsYamlSchema.safeParse({
      system_prompt: {
        identity: 'You are an AI assistant.',
        thinking: { title: 'Thinking', content: 'Think before acting.' },
        autonomy: { title: 'Autonomy', content: 'Work independently.' },
        context: { title: 'Context', content: 'Understand the context.' },
        tools: { title: 'Tools', content: 'Use tools wisely.' },
        verification: { title: 'Verification', content: 'Verify your work.' },
        safety: { title: 'Safety', content: 'Be safe.' },
        code_quality: { title: 'Code Quality', content: 'Write good code.' },
        scenarios: { title: 'Scenarios', content: 'Handle scenarios.' },
        communication: { title: 'Communication', content: 'Communicate clearly.' },
        agents: { title: 'Agents', content: 'Work with agents.' },
        uncertainty: { title: 'Uncertainty', content: 'Handle uncertainty.' },
        closing: 'Follow all instructions.',
      },
      custom_instructions_prefix: '# Custom',
      custom_instructions_suffix: '# End',
    });
    expect(result.success).toBe(true);
  });

  it('should accept legacy sections field', () => {
    const result = PromptsYamlSchema.safeParse({
      system_prompt: {
        identity: 'AI assistant',
        sections: {
          custom: { title: 'Custom', content: 'Custom content' },
        },
        closing: 'End.',
      },
      custom_instructions_prefix: '',
      custom_instructions_suffix: '',
    });
    expect(result.success).toBe(true);
  });

  it('should reject empty identity', () => {
    const result = PromptsYamlSchema.safeParse({
      system_prompt: {
        identity: '',
        closing: 'End.',
      },
      custom_instructions_prefix: '',
      custom_instructions_suffix: '',
    });
    expect(result.success).toBe(false);
  });

  it('should reject empty closing', () => {
    const result = PromptsYamlSchema.safeParse({
      system_prompt: {
        identity: 'AI assistant',
        closing: '',
      },
      custom_instructions_prefix: '',
      custom_instructions_suffix: '',
    });
    expect(result.success).toBe(false);
  });
});

describe('validateModelsYaml', () => {
  it('should return success for valid data', () => {
    const result = validateModelsYaml({
      default_model: 'test',
      models: {
        test: {
          name: 'test',
          context_window: 128000,
          max_output_tokens: 16000,
          default_max_tokens: 4096,
          supports_thinking: true,
          default_temperature: 0.7,
          temperature_range: { min: 0.0, max: 1.0 },
          token_efficiency: 1.0,
        },
      },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.default_model).toBe('test');
    }
  });

  it('should return error for invalid data', () => {
    const result = validateModelsYaml({
      default_model: 'missing',
      models: {},
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeDefined();
    }
  });
});

describe('validateSettingsYaml', () => {
  it('should return success for valid data', () => {
    const result = validateSettingsYaml({
      agent: {
        max_tool_rounds: 50,
        default_timeout: 30000,
        default_max_tokens: 4096,
        max_recent_tool_calls: 10,
        loop_detection_threshold: 3,
        enable_loop_detection: true,
      },
      file: {
        max_file_size: 1048576,
        max_buffer_size: 2097152,
        diff_context_lines: 3,
      },
      history: { max_history_size: 100 },
      mcp: {
        client_name: 'test',
        client_version: '1.0.0',
        default_timeout: 30000,
        token_warning_threshold: 100000,
        token_hard_limit: 200000,
        truncation_enabled: true,
      },
      ui: {
        status_update_interval: 1000,
        processing_timer_interval: 100,
      },
      token: {
        tokens_per_message: 3,
        tokens_for_reply_priming: 3,
        default_model: 'cl100k_base',
        default_encoding: 'cl100k_base',
        cache_max_size: 1000,
        chars_per_token_estimate: 4,
      },
      cache: { default_max_size: 100, default_ttl: 300000 },
      performance: {
        debounce_delay: 100,
        throttle_limit: 10,
        slow_operation_threshold: 5000,
      },
      tool_names: {},
    });

    expect(result.success).toBe(true);
  });

  it('should return error for invalid data', () => {
    const result = validateSettingsYaml({ invalid: true });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeDefined();
    }
  });
});

describe('validateMessagesYaml', () => {
  it('should return success for valid data', () => {
    const result = validateMessagesYaml({
      errors: { error1: 'Error 1' },
      warnings: { warn1: 'Warning 1' },
      success: { success1: 'Success 1' },
      info: { info1: 'Info 1' },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.errors.error1).toBe('Error 1');
    }
  });

  it('should return error for invalid data', () => {
    const result = validateMessagesYaml({});

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeDefined();
    }
  });
});

describe('validatePromptsYaml', () => {
  it('should return success for valid data', () => {
    const result = validatePromptsYaml({
      system_prompt: {
        identity: 'AI',
        closing: 'End.',
      },
      custom_instructions_prefix: '#',
      custom_instructions_suffix: '#',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.system_prompt.identity).toBe('AI');
    }
  });

  it('should return error for invalid data', () => {
    const result = validatePromptsYaml({
      system_prompt: {
        identity: '', // Invalid - empty
        closing: 'End.',
      },
      custom_instructions_prefix: '',
      custom_instructions_suffix: '',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeDefined();
    }
  });
});
