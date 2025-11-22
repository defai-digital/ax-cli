/**
 * Zod schemas for validating user and project settings
 * Ensures graceful degradation on corrupted config files
 */

import { z } from 'zod';
import { ModelIdSchema, MCPServerIdSchema } from '@ax-cli/schemas';

// Encrypted Value Schema (for encrypted API keys)
export const EncryptedValueSchema = z.object({
  encrypted: z.string(),
  iv: z.string(),
  tag: z.string(),
  version: z.number().int().positive(),
});

// Sampling Settings Schema (for deterministic/reproducible mode)
export const SamplingSettingsSchema = z.object({
  doSample: z.boolean().optional(),
  seed: z.number().int().nonnegative().optional(),
  topP: z.number().min(0).max(1).optional(),
}).optional();

// Thinking Settings Schema (for GLM-4.6 reasoning mode)
export const ThinkingSettingsSchema = z.object({
  enabled: z.boolean().optional(),
}).optional();

// Dual-Model Settings Schema (for chat vs coding mode)
export const DualModelSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  chatModel: ModelIdSchema.optional(),
  codingModel: ModelIdSchema.optional(),
}).optional();

// User Settings Schema
export const UserSettingsSchema: z.ZodType<any> = z.object({
  // API key can be either string (plain-text, backwards compatible) or encrypted object
  apiKey: z.union([z.string(), EncryptedValueSchema]).optional(),
  baseURL: z.string().optional(), // Remove .url() to allow any string
  defaultModel: ModelIdSchema.optional(),
  currentModel: ModelIdSchema.optional(),
  maxTokens: z.number().int().positive().optional(),
  temperature: z.number().min(0).max(2).optional(),
  models: z.array(ModelIdSchema).optional(),
  confirmations: z.object({
    fileOperations: z.boolean().optional(),
    bashCommands: z.boolean().optional(),
  }).optional(),
  // Sampling settings for deterministic/reproducible mode
  sampling: SamplingSettingsSchema,
  // Thinking settings for GLM-4.6 reasoning mode
  thinking: ThinkingSettingsSchema,
  // Dual-model settings for chat vs coding mode
  dualModel: DualModelSettingsSchema,
}).passthrough(); // Allow additional properties for backward compatibility

// Project Settings Schema
export const ProjectSettingsSchema: z.ZodType<any> = z.object({
  name: z.string().optional(),
  model: ModelIdSchema.optional(), // Legacy field
  currentModel: ModelIdSchema.optional(),
  customInstructions: z.string().optional(),
  excludePatterns: z.array(z.string()).optional(),
  includePatterns: z.array(z.string()).optional(),
  mcpServers: z.record(z.any()).optional(), // MCP server configurations
  // Project-level sampling settings (overrides user settings)
  sampling: SamplingSettingsSchema,
  // Project-level thinking settings (overrides user settings)
  thinking: ThinkingSettingsSchema,
  // Project-level dual-model settings (overrides user settings)
  dualModel: DualModelSettingsSchema,
}).passthrough(); // Allow additional properties for backward compatibility

// Model Option Schema
export const ModelOptionSchema: z.ZodType<any> = z.object({
  model: ModelIdSchema,
  description: z.string().optional(),
  maxTokens: z.number().int().positive().optional(),
});

// MCP Server Config Schema
export const MCPTransportConfigSchema = z.object({
  type: z.enum(['stdio', 'http', 'sse', 'streamable_http']),
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
  url: z.string().url().optional(),
  headers: z.record(z.string()).optional(),
});

export const MCPServerConfigSchema: z.ZodType<any> = z.object({
  name: MCPServerIdSchema,
  transport: MCPTransportConfigSchema,
  command: z.string().optional(), // Legacy support
  args: z.array(z.string()).optional(), // Legacy support
  env: z.record(z.string()).optional(), // Legacy support
});

// Export types
export type EncryptedValue = z.infer<typeof EncryptedValueSchema>;
export type UserSettings = z.infer<typeof UserSettingsSchema>;
export type ProjectSettings = z.infer<typeof ProjectSettingsSchema>;
export type ModelOption = z.infer<typeof ModelOptionSchema>;
export type MCPServerConfig = z.infer<typeof MCPServerConfigSchema>;
export type MCPTransportConfig = z.infer<typeof MCPTransportConfigSchema>;
export type SamplingSettings = z.infer<typeof SamplingSettingsSchema>;
export type ThinkingSettings = z.infer<typeof ThinkingSettingsSchema>;
export type DualModelSettings = z.infer<typeof DualModelSettingsSchema>;
