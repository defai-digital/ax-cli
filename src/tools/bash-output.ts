import { ToolResult } from '../types/index.js';
import { getBackgroundTaskManager } from '../utils/background-task-manager.js';
import { TIMEOUT_CONFIG } from '../constants.js';

/**
 * BashOutputTool - Retrieve output from background tasks
 *
 * This tool allows the AI agent to check on and retrieve output
 * from commands that were run in the background.
 */
export class BashOutputTool {
  private backgroundTaskManager = getBackgroundTaskManager();

  /**
   * Get output from a background task
   * @param taskId The background task ID
   * @param wait Whether to wait for the task to complete (default: false)
   * @param timeoutMs Maximum time to wait in milliseconds
   */
  async execute(taskId: string, wait: boolean = false, timeoutMs: number = TIMEOUT_CONFIG.BASH_DEFAULT): Promise<ToolResult> {
    if (!taskId) {
      return {
        success: false,
        error: 'Task ID is required'
      };
    }

    try {
      let output;

      if (wait) {
        // Wait for task to complete
        output = await this.backgroundTaskManager.waitForTask(taskId, timeoutMs);
      } else {
        output = this.backgroundTaskManager.getOutput(taskId);
      }

      if (!output) {
        return {
          success: false,
          error: `Task not found: ${taskId}`
        };
      }

      // Format output
      const statusEmoji = {
        'running': '🔄',
        'completed': '✅',
        'failed': '❌',
        'killed': '🛑'
      }[output.status] || '❓';

      let result = `${statusEmoji} Task ${taskId}\n`;
      result += `Status: ${output.status}`;

      if (output.exitCode !== undefined && output.exitCode !== null) {
        result += ` (exit code: ${output.exitCode})`;
      }
      result += '\n';

      if (output.startTime) {
        const elapsed = output.endTime
          ? Math.round((output.endTime.getTime() - output.startTime.getTime()) / 1000)
          : Math.round((Date.now() - output.startTime.getTime()) / 1000);
        result += `Duration: ${elapsed}s\n`;
      }

      result += '\n';

      if (output.stdout) {
        result += '--- STDOUT ---\n';
        result += output.stdout;
        result += '\n';
      }

      if (output.stderr) {
        result += '--- STDERR ---\n';
        result += output.stderr;
        result += '\n';
      }

      if (!output.stdout && !output.stderr) {
        result += '(No output yet)\n';
      }

      return {
        success: true,
        output: result.trim()
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to get task output: ${error.message}`
      };
    }
  }

  /**
   * List all background tasks
   */
  listTasks(): ToolResult {
    const tasks = this.backgroundTaskManager.listTasks();

    if (tasks.length === 0) {
      return {
        success: true,
        output: 'No background tasks'
      };
    }

    let result = `📋 Background Tasks (${tasks.length})\n\n`;

    const statusEmoji = {
      'running': '🔄',
      'completed': '✅',
      'failed': '❌',
      'killed': '🛑'
    };

    for (const task of tasks) {
      const emoji = statusEmoji[task.status] || '❓';
      const elapsed = task.endTime
        ? Math.round((task.endTime.getTime() - task.startTime.getTime()) / 1000)
        : Math.round((Date.now() - task.startTime.getTime()) / 1000);

      result += `${emoji} ${task.id}\n`;
      result += `   Command: ${task.command.length > 50 ? task.command.slice(0, 50) + '...' : task.command}\n`;
      result += `   Status: ${task.status}`;
      if (task.exitCode !== undefined && task.exitCode !== null) {
        result += ` (exit: ${task.exitCode})`;
      }
      result += ` | Duration: ${elapsed}s\n`;
      result += '\n';
    }

    return {
      success: true,
      output: result.trim()
    };
  }

  /**
   * Kill a background task
   */
  killTask(taskId: string): ToolResult {
    if (!taskId) {
      return {
        success: false,
        error: 'Task ID is required'
      };
    }

    const killed = this.backgroundTaskManager.kill(taskId);

    if (killed) {
      return {
        success: true,
        output: `🛑 Task ${taskId} has been killed`
      };
    } else {
      return {
        success: false,
        error: `Could not kill task ${taskId}. It may not exist or is not running.`
      };
    }
  }
}
