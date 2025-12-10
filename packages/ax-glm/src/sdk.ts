/**
 * AX-GLM SDK - Programmatic API for GLM-powered AI agents
 *
 * This SDK allows you to use ax-glm as a library for building AI-powered applications.
 * Perfect for integrations, VSCode extensions, and programmatic AI agent usage.
 *
 * ## Quick Start
 *
 * 1. Run `ax-glm setup` to configure credentials (one-time setup)
 * 2. Use the SDK in your code
 *
 * @example
 * ```typescript
 * import { createGLMAgent, SDKError, SDKErrorCode } from '@defai.digital/ax-glm/sdk';
 *
 * // Create GLM agent (credentials from ax-glm setup)
 * const agent = await createGLMAgent({
 *   maxToolRounds: 50,
 *   enableThinking: true  // Enable GLM thinking mode
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
 *       console.error('Please run: ax-glm setup');
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

// Note: GLM-specific exports like createGLMAgent, GLM_PROVIDER, and Z.AI MCP integration
// are already included in the core SDK exports. No need to duplicate them here.
