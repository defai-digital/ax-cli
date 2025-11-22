/**
 * Basic Agent Example
 *
 * Demonstrates simple SDK usage for creating and using an AI agent.
 */

import { createAgent } from '@defai.digital/ax-cli/sdk';

async function main() {
  console.log('Creating AI agent...');

  // Create agent with configuration
  const agent = await createAgent({
    model: 'glm-4.6',
    maxToolRounds: 50,
    customInstructions: 'You are a helpful coding assistant.'
  });

  // Listen to streaming responses
  agent.on('stream', (chunk) => {
    if (chunk.type === 'content' && chunk.content) {
      process.stdout.write(chunk.content);
    }
  });

  // Process user message
  console.log('\nSending message to agent...\n');
  const result = await agent.processUserMessage('List all TypeScript files in the src/ directory');

  console.log('\n\nAgent completed processing!');
  console.log(`Total messages in history: ${result.length}`);
}

main().catch(console.error);
