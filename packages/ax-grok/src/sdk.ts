/**
 * AX-Grok SDK - Programmatic API for Grok-powered AI agents
 *
 * This SDK allows you to use ax-grok as a library for building AI-powered applications.
 * Perfect for integrations, VSCode extensions, and programmatic AI agent usage.
 *
 * ## Quick Start
 *
 * 1. Run `ax-grok setup` to configure credentials (one-time setup)
 * 2. Use the SDK in your code
 *
 * @example
 * ```typescript
 * import { createGrokAgent, SDKError, SDKErrorCode } from '@defai.digital/ax-grok/sdk';
 *
 * // Create Grok agent (credentials from ax-grok setup)
 * const agent = await createGrokAgent({
 *   maxToolRounds: 50,
 *   enableThinking: true  // Enable Grok reasoning_effort mode
 * });
 *
 * try {
 *   agent.on('stream', (chunk) => {
 *     if (chunk.type === 'content') {
 *       console.log(chunk.content);
 *     }
 *   });
 *
 *   const result = await agent.processUserMessage('Analyze this codebase');
 *   console.log('Done!', result.length, 'messages');
 * } catch (error) {
 *   if (SDKError.isSDKError(error)) {
 *     if (error.code === SDKErrorCode.SETUP_NOT_RUN) {
 *       console.error('Please run: ax-grok setup');
 *     }
 *   }
 * } finally {
 *   agent.dispose();
 * }
 * ```
 *
 * @packageDocumentation
 */

// Re-export everything from core SDK
export * from '@defai.digital/ax-core/sdk';

// Note: Grok-specific exports like createGrokAgent, GROK_PROVIDER are already
// included in the core SDK exports. No need to duplicate them here.
