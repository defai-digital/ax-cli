/**
 * Grok Model Pricing Utilities
 *
 * Centralized pricing data for Grok models to avoid duplication.
 * Source: https://docs.x.ai/docs/models
 */

/**
 * Pricing structure for a model (per 1M tokens)
 */
export interface ModelPricing {
  input: number;   // $ per 1M tokens
  output: number;  // $ per 1M tokens
  cached: number;  // $ per 1M tokens
}

/** Default model for pricing fallback */
const DEFAULT_PRICING_MODEL = 'grok-4.1';

/**
 * Grok model pricing (per 1M tokens)
 * Order: specific models first, then general versions
 */
export const GROK_PRICING: Record<string, ModelPricing> = {
  'grok-code-fast-1': { input: 0.20, output: 1.50, cached: 0.02 },
  'grok-4.1-fast-reasoning': { input: 0.20, output: 0.50, cached: 0.05 },
  'grok-4.1-fast-non-reasoning': { input: 0.20, output: 0.50, cached: 0.05 },
  'grok-4.1-mini': { input: 0.30, output: 0.50, cached: 0.075 },
  'grok-4.1': { input: 3.00, output: 15.00, cached: 0.75 },
  'grok-4': { input: 3.00, output: 15.00, cached: 0.75 },
  'grok-3-mini': { input: 0.30, output: 0.50, cached: 0.075 },
  'grok-3': { input: 3.00, output: 15.00, cached: 0.75 },
  'grok-2': { input: 2.00, output: 10.00, cached: 0.50 },
};

/**
 * Get pricing for a Grok model (per 1M tokens)
 * Checks exact matches first (O(1)), then substring matches
 */
export function getGrokPricing(model: string): ModelPricing {
  const m = model.toLowerCase();

  // Fast path: exact match in pricing table
  if (GROK_PRICING[m]) return GROK_PRICING[m];

  // Check aliases and substring matches (specific to general)
  // Note: 'grok-fast' alias resolves to 'grok-code-fast-1' per grok-models.yaml
  if (m.includes('grok-code') || m === 'grok-fast') return GROK_PRICING['grok-code-fast-1'];
  if (m.includes('grok-4.1-fast-reasoning') || m === 'grok-fast-reasoning') return GROK_PRICING['grok-4.1-fast-reasoning'];
  if (m.includes('grok-4.1-fast-non-reasoning') || m === 'grok-fast-nr') return GROK_PRICING['grok-4.1-fast-non-reasoning'];
  if (m.includes('grok-4.1-mini') || m === 'grok-mini') return GROK_PRICING['grok-4.1-mini'];
  if (m.includes('grok-4.1') || m === 'grok-latest') return GROK_PRICING['grok-4.1'];
  if (m.includes('grok-4')) return GROK_PRICING['grok-4'];
  if (m.includes('grok-3-mini')) return GROK_PRICING['grok-3-mini'];
  if (m.includes('grok-3')) return GROK_PRICING['grok-3'];
  if (m.includes('grok-2')) return GROK_PRICING['grok-2'];

  return GROK_PRICING[DEFAULT_PRICING_MODEL];
}

/**
 * Get pricing display name for a Grok model
 */
export function getGrokPricingName(model: string): string {
  const m = model.toLowerCase();

  if (m.includes('grok-code')) return 'Grok Code Fast';
  if (m.includes('grok-4.1-fast')) return 'Grok 4.1 Fast';
  if (m.includes('grok-4.1-mini')) return 'Grok 4.1 Mini';
  if (m.includes('grok-4.1')) return 'Grok 4.1';
  if (m.includes('grok-4')) return 'Grok 4';
  if (m.includes('grok-3')) return 'Grok 3';
  if (m.includes('grok-2')) return 'Grok 2';

  return 'Grok';
}

/**
 * Calculate estimated cost for a session
 */
export function calculateGrokCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): { input: number; output: number; total: number } {
  const pricing = getGrokPricing(model);
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  return { input: inputCost, output: outputCost, total: inputCost + outputCost };
}
