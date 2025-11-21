/**
 * Zod schemas for validating user and project settings
 * Ensures graceful degradation on corrupted config files
 */

import { z } from 'zod';
import { ModelIdSchema, MCPServerIdSchema } from '@ax-cli/schemas';

// Sampling Settings Schema (for deterministic/reproducible mode)
export const SamplingSettingsSchema = z.object({
  doSample: z.boolean().optional(),
  seed: z.number().int().nonnegative().optional(),
  topP: z.number().min(0).max(1).optional(),
}).optional();

// User Settings Schema
export const UserSettingsSchema: z.ZodType<any> = z.object({
  apiKey: z.string().optional(),
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
export type UserSettings = z.infer<typeof UserSettingsSchema>;
export type ProjectSettings = z.infer<typeof ProjectSettingsSchema>;
export type ModelOption = z.infer<typeof ModelOptionSchema>;
export type MCPServerConfig = z.infer<typeof MCPServerConfigSchema>;
export type MCPTransportConfig = z.infer<typeof MCPTransportConfigSchema>;
export type SamplingSettings = z.infer<typeof SamplingSettingsSchema>;
