/**
 * Rewind Command
 *
 * Allows users to rewind to a previous checkpoint, restoring both
 * file state and conversation history.
 */

import { getCheckpointManager } from '../checkpoint/index.js';
import type { LLMAgent } from '../agent/llm-agent.js';
import * as readline from 'readline';

/**
 * Format timestamp as relative time (e.g., "5 minutes ago")
 */
function formatTimeAgo(date: Date): string {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) {
    return `${seconds} second${seconds !== 1 ? 's' : ''} ago`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  }

  const days = Math.floor(hours / 24);
  if (days < 30) {
    return `${days} day${days !== 1 ? 's' : ''} ago`;
  }

  const months = Math.floor(days / 30);
  return `${months} month${months !== 1 ? 's' : ''} ago`;
}

/**
 * Prompt user for input
 */
async function promptUser(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Display checkpoint diff preview
 */
async function previewCheckpoint(checkpointId: string): Promise<void> {
  const manager = getCheckpointManager();
  const checkpoint = await manager.getCheckpoint(checkpointId);

  if (!checkpoint) {
    console.log('❌ Checkpoint not found');
    return;
  }

  console.log('\n📄 Preview of changes:');
  console.log('─'.repeat(60));

  for (const file of checkpoint.files) {
    console.log(`\nFile: ${file.path}`);
    console.log(`Size: ${file.size} bytes`);
    console.log(`Hash: ${file.hash.substring(0, 12)}...`);

    // Show first/last few lines of content
    const lines = file.content.split('\n');
    const preview = lines.length > 10
      ? [...lines.slice(0, 5), '...', ...lines.slice(-5)]
      : lines;

    console.log('\nContent preview:');
    preview.forEach((line, i) => {
      if (line === '...') {
        console.log('    ...');
      } else {
        const lineNum = i < 5 ? i + 1 : lines.length - (preview.length - i) + 1;
        console.log(`    ${lineNum}: ${line.substring(0, 80)}`);
      }
    });
  }

  console.log('\n─'.repeat(60));
  console.log(`Conversation state: ${checkpoint.conversationState.length} messages`);
  console.log(`Metadata: model=${checkpoint.metadata.model}, triggeredBy=${checkpoint.metadata.triggeredBy}`);
  console.log('─'.repeat(60));
}

/**
 * Handle /rewind command
 */
export async function handleRewindCommand(agent: LLMAgent): Promise<void> {
  try {
    const manager = getCheckpointManager();
    const checkpoints = await manager.listCheckpoints({ limit: 20 });

    if (checkpoints.length === 0) {
      console.log('\n📋 No checkpoints available');
      console.log('\nCheckpoints are created automatically before file modifications.');
      console.log('Make some changes to your code and checkpoints will be created.');
      return;
    }

    // Display available checkpoints
    console.log('\n📋 Available Checkpoints (last 20):');
    console.log('─'.repeat(60));

    checkpoints.forEach((cp, i) => {
      const timeAgo = formatTimeAgo(cp.timestamp);
      const filesStr = cp.filesChanged.length === 1
        ? cp.filesChanged[0]
        : `${cp.filesChanged.length} files`;

      console.log(`${i + 1}. ${cp.description}`);
      console.log(`   Time: ${timeAgo}`);
      console.log(`   Files: ${filesStr}`);
      console.log(`   Size: ${(cp.size / 1024).toFixed(2)} KB${cp.compressed ? ' (compressed)' : ''}`);
      console.log('');
    });

    console.log('─'.repeat(60));

    // Get user selection
    const selection = await promptUser('\nSelect checkpoint number (or \'q\' to quit): ');

    if (selection.toLowerCase() === 'q' || selection === '') {
      console.log('Cancelled.');
      return;
    }

    const selectedIndex = parseInt(selection, 10) - 1;

    if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= checkpoints.length) {
      console.log('❌ Invalid selection');
      return;
    }

    const selectedCheckpoint = checkpoints[selectedIndex];

    // Show preview
    await previewCheckpoint(selectedCheckpoint.id);

    // Confirm
    const confirm = await promptUser('\n⚠️  This will restore files and rewind conversation. Continue? (y/N): ');

    if (confirm.toLowerCase() !== 'y' && confirm.toLowerCase() !== 'yes') {
      console.log('Cancelled.');
      return;
    }

    // Apply checkpoint
    console.log('\n🔄 Applying checkpoint...');

    const result = await manager.applyCheckpoint(selectedCheckpoint.id);

    if (result.success) {
      console.log(`\n✅ Successfully rewound to: ${selectedCheckpoint.description}`);
      console.log(`\n📁 Files restored (${result.filesRestored.length}):`);
      result.filesRestored.forEach(file => {
        console.log(`   ✓ ${file}`);
      });

      if (result.filesFailed.length > 0) {
        console.log(`\n⚠️  Files failed to restore (${result.filesFailed.length}):`);
        result.filesFailed.forEach(file => {
          console.log(`   ✗ ${file}`);
        });
      }

      // Rewind conversation
      const rewindResult = await agent.rewindConversation(selectedCheckpoint.id);
      if (rewindResult.success) {
        console.log(`\n💬 Conversation rewound successfully`);
      } else {
        console.log(`\n⚠️  Failed to rewind conversation: ${rewindResult.error}`);
      }

      console.log('\n✨ Rewind complete!');
    } else {
      console.log(`\n❌ Failed to apply checkpoint: ${result.error}`);
    }
  } catch (error) {
    console.error('\n❌ Error during rewind:', error);
  }
}

/**
 * List checkpoints (for /checkpoints command)
 */
export async function handleCheckpointsCommand(): Promise<void> {
  try {
    const manager = getCheckpointManager();
    const stats = await manager.getStats();

    console.log('\n📊 Checkpoint Statistics:');
    console.log('─'.repeat(60));
    console.log(`Total checkpoints: ${stats.totalCount}`);
    console.log(`Total storage: ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Compressed: ${stats.compressedCount}`);

    if (stats.oldestDate) {
      console.log(`Oldest: ${stats.oldestDate.toLocaleDateString()}`);
    }
    if (stats.newestDate) {
      console.log(`Newest: ${stats.newestDate.toLocaleDateString()}`);
    }

    const checkpoints = await manager.listCheckpoints({ limit: 10 });

    if (checkpoints.length > 0) {
      console.log('\n📋 Recent Checkpoints:');
      console.log('─'.repeat(60));

      checkpoints.forEach((cp, i) => {
        const timeAgo = formatTimeAgo(cp.timestamp);
        console.log(`${i + 1}. ${cp.description} (${timeAgo})`);
      });
    }

    console.log('─'.repeat(60));
    console.log('\nUse /rewind to restore a checkpoint');
  } catch (error) {
    console.error('❌ Error listing checkpoints:', error);
  }
}

/**
 * Clean old checkpoints (for /checkpoint-clean command)
 */
export async function handleCheckpointCleanCommand(): Promise<void> {
  try {
    const manager = getCheckpointManager();

    console.log('\n🧹 Cleaning old checkpoints...');

    // Compress old checkpoints
    const compressed = await manager.compressOldCheckpoints();
    console.log(`✓ Compressed ${compressed} old checkpoints`);

    // Prune very old checkpoints
    const pruned = await manager.pruneOldCheckpoints();
    console.log(`✓ Pruned ${pruned} very old checkpoints`);

    const stats = await manager.getStats();
    console.log(`\n📊 Storage after cleanup: ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB`);

    console.log('\n✨ Cleanup complete!');
  } catch (error) {
    console.error('❌ Error cleaning checkpoints:', error);
  }
}
