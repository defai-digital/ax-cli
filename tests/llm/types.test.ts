import { describe, it, expect } from 'vitest';
import {
  validateTemperature,
  validateMaxTokens,
  validateThinking,
  getModelConfig,
  createDefaultChatOptions,
  GLM_MODELS,
  isGLM46Response,
  hasReasoningContent,
  type ThinkingConfig,
} from '../../packages/core/src/llm/types.js';

describe('GLM-4.6 Type Validation', () => {
  describe('validateTemperature', () => {
    it('should accept valid temperature for glm-4.6 (0.6-1.0)', () => {
      expect(() => validateTemperature(0.6, 'glm-4.6')).not.toThrow();
      expect(() => validateTemperature(0.7, 'glm-4.6')).not.toThrow();
      expect(() => validateTemperature(1.0, 'glm-4.6')).not.toThrow();
    });

    it('should reject temperature below range for glm-4.6', () => {
      expect(() => validateTemperature(0.5, 'glm-4.6')).toThrow(/out of range/);
      expect(() => validateTemperature(0.0, 'glm-4.6')).toThrow(/out of range/);
    });

    it('should reject temperature above range for glm-4.6', () => {
      expect(() => validateTemperature(1.1, 'glm-4.6')).toThrow(/out of range/);
      expect(() => validateTemperature(2.0, 'glm-4.6')).toThrow(/out of range/);
    });

    it('should use default model config for unknown model', () => {
      // Should use glm-4.6 defaults
      expect(() => validateTemperature(0.7, 'unknown-model')).not.toThrow();
      expect(() => validateTemperature(2.0, 'unknown-model')).toThrow(/out of range/);
    });
  });

  describe('validateMaxTokens', () => {
    it('should accept valid max tokens for glm-4.6', () => {
      expect(() => validateMaxTokens(1, 'glm-4.6')).not.toThrow();
      expect(() => validateMaxTokens(8192, 'glm-4.6')).not.toThrow();
      expect(() => validateMaxTokens(128000, 'glm-4.6')).not.toThrow();
    });

    it('should reject max tokens exceeding glm-4.6 limit', () => {
      expect(() => validateMaxTokens(128001, 'glm-4.6')).toThrow(/exceeds model limit/);
      expect(() => validateMaxTokens(200000, 'glm-4.6')).toThrow(/exceeds model limit/);
    });

    it('should reject zero or negative max tokens', () => {
      expect(() => validateMaxTokens(0, 'glm-4.6')).toThrow(/must be at least 1/);
      expect(() => validateMaxTokens(-1, 'glm-4.6')).toThrow(/must be at least 1/);
    });

  });

  describe('validateThinking', () => {
    it('should accept thinking enabled for glm-4.6', () => {
      const thinking: ThinkingConfig = { type: 'enabled' };
      expect(() => validateThinking(thinking, 'glm-4.6')).not.toThrow();
    });

    it('should accept thinking disabled for any model', () => {
      const thinking: ThinkingConfig = { type: 'disabled' };
      expect(() => validateThinking(thinking, 'glm-4.6')).not.toThrow();
    });

    it('should accept undefined thinking for any model', () => {
      expect(() => validateThinking(undefined, 'glm-4.6')).not.toThrow();
    });
  });

  describe('getModelConfig', () => {
    it('should return correct config for glm-4.6', () => {
      const config = getModelConfig('glm-4.6');
      expect(config.contextWindow).toBe(200000);
      expect(config.maxOutputTokens).toBe(128000);
      expect(config.supportsThinking).toBe(true);
      expect(config.temperatureRange).toEqual({ min: 0.6, max: 1.0 });
    });

    it('should return default config for unknown model', () => {
      const config = getModelConfig('unknown-model');
      expect(config).toEqual(GLM_MODELS['glm-4.6']);
    });
  });

  describe('createDefaultChatOptions', () => {
    it('should create default options for glm-4.6', () => {
      const options = createDefaultChatOptions('glm-4.6');
      expect(options.model).toBe('glm-4.6');
      expect(options.temperature).toBe(0.7);
      expect(options.maxTokens).toBe(8192);
      expect(options.stream).toBe(false);
    });

    it('should use glm-4.6 as default when no model specified', () => {
      const options = createDefaultChatOptions();
      expect(options.model).toBe('glm-4.6');
    });

    it('should cap max tokens at model limit', () => {
      const options = createDefaultChatOptions('glm-4.6v');
      expect(options.maxTokens).toBeLessThanOrEqual(GLM_MODELS['glm-4.6v'].maxOutputTokens);
    });
  });

  describe('isGLM46Response', () => {
    it('should return true for valid GLM-4.6 response', () => {
      const response = {
        choices: [{
          message: {
            role: 'assistant',
            content: 'Hello',
          },
          finish_reason: 'stop',
        }],
      };
      expect(isGLM46Response(response)).toBe(true);
    });

    it('should return true for response with reasoning_content', () => {
      const response = {
        choices: [{
          message: {
            role: 'assistant',
            content: 'Answer',
            reasoning_content: 'Thinking...',
          },
          finish_reason: 'stop',
        }],
      };
      expect(isGLM46Response(response)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isGLM46Response(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isGLM46Response(undefined)).toBe(false);
    });

    it('should return false for non-object', () => {
      expect(isGLM46Response('not an object')).toBe(false);
      expect(isGLM46Response(123)).toBe(false);
    });

    it('should return false for object without choices', () => {
      expect(isGLM46Response({})).toBe(false);
      expect(isGLM46Response({ data: 'value' })).toBe(false);
    });

    it('should return false for object with non-array choices', () => {
      expect(isGLM46Response({ choices: 'not-array' })).toBe(false);
    });
  });

  describe('hasReasoningContent', () => {
    it('should return true for chunk with reasoning_content', () => {
      const chunk = {
        id: 'test',
        object: 'chat.completion.chunk',
        created: Date.now(),
        model: 'glm-4.6',
        choices: [{
          index: 0,
          delta: {
            reasoning_content: 'Step 1: Analyze...',
          },
        }],
      };
      expect(hasReasoningContent(chunk)).toBe(true);
    });

    it('should return false for chunk without reasoning_content', () => {
      const chunk = {
        id: 'test',
        object: 'chat.completion.chunk',
        created: Date.now(),
        model: 'glm-4.6',
        choices: [{
          index: 0,
          delta: {
            content: 'Hello',
          },
        }],
      };
      expect(hasReasoningContent(chunk)).toBe(false);
    });

    it('should return false for chunk with empty reasoning_content', () => {
      const chunk = {
        id: 'test',
        object: 'chat.completion.chunk',
        created: Date.now(),
        model: 'glm-4.6',
        choices: [{
          index: 0,
          delta: {
            reasoning_content: '',
          },
        }],
      };
      expect(hasReasoningContent(chunk)).toBe(false);
    });

    it('should return false for chunk with no choices', () => {
      const chunk = {
        id: 'test',
        object: 'chat.completion.chunk',
        created: Date.now(),
        model: 'glm-4.6',
        choices: [],
      };
      expect(hasReasoningContent(chunk)).toBe(false);
    });
  });
});
