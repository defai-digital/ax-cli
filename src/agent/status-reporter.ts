/**
 * Status Reporter
 *
 * Generates context summaries and status reports for task execution
 */

import { LLMMessage } from '../llm/client.js';
import { ChatEntry } from './llm-agent.js';
import { TaskPlan } from '../planner/index.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { CONFIG_PATHS } from '../constants.js';

export interface ContextSummary {
  timestamp: Date;
  reason: 'context_overflow' | 'phase_completion' | 'plan_completion' | 'user_request';
  messageCount: number;
  tokenCount: number;
  shortSummary: string;
  keyActions: string[];
  filesModified: Array<{ path: string; type: 'created' | 'modified' | 'deleted' }>;
  currentTask: string;
  nextSteps: string[];
  path?: string;
}

export interface StatusReport extends ContextSummary {
  session: {
    duration: number;
    messageCount: number;
    tokenUsage: number;
  };
  plan?: {
    id: string;
    name: string;
    status: string;
    progress: {
      completed: number;
      failed: number;
      total: number;
      percentage: number;
    };
    phases: Array<{
      name: string;
      status: string;
      duration?: number;
      tokensUsed?: number;
      filesModified: string[];
    }>;
  };
}

/**
 * StatusReporter generates summaries and status reports
 */
export class StatusReporter {
  private outputDir: string;
  private sessionStartTime: Date;

  constructor(outputDir?: string) {
    this.outputDir = outputDir || CONFIG_PATHS.AUTOMATOSX_TMP;
    this.sessionStartTime = new Date();
  }

  /**
   * Generate a context summary from conversation history
   */
  async generateContextSummary(
    messages: LLMMessage[],
    chatHistory: ChatEntry[],
    reason: ContextSummary['reason'],
    tokenCount: number
  ): Promise<ContextSummary> {
    const summary: ContextSummary = {
      timestamp: new Date(),
      reason,
      messageCount: messages.length,
      tokenCount,
      shortSummary: this.extractShortSummary(chatHistory),
      keyActions: this.extractKeyActions(chatHistory),
      filesModified: this.extractFilesModified(chatHistory),
      currentTask: this.extractCurrentTask(chatHistory),
      nextSteps: this.extractNextSteps(chatHistory),
    };

    // Save to disk
    summary.path = await this.saveSummary(summary);

    return summary;
  }

  /**
   * Generate a full status report
   */
  async generateStatusReport(context: {
    messages: LLMMessage[];
    chatHistory: ChatEntry[];
    tokenCount: number;
    plan?: TaskPlan;
  }): Promise<StatusReport> {
    const baseSummary = await this.generateContextSummary(
      context.messages,
      context.chatHistory,
      context.plan ? 'plan_completion' : 'user_request',
      context.tokenCount
    );

    const report: StatusReport = {
      ...baseSummary,
      session: {
        duration: Date.now() - this.sessionStartTime.getTime(),
        messageCount: context.messages.length,
        tokenUsage: context.tokenCount,
      },
    };

    // Add plan info if available
    if (context.plan) {
      report.plan = {
        id: context.plan.id,
        name: context.plan.originalPrompt,
        status: context.plan.status,
        progress: {
          completed: context.plan.phasesCompleted,
          failed: context.plan.phasesFailed,
          total: context.plan.phases.length,
          percentage: (context.plan.phasesCompleted / context.plan.phases.length) * 100,
        },
        phases: context.plan.phases.map(phase => ({
          name: phase.name,
          status: phase.status,
          duration: phase.duration,
          tokensUsed: phase.tokensUsed,
          filesModified: phase.filesModified || [],
        })),
      };
    }

    // Save report
    const reportPath = await this.saveReport(report);
    report.path = reportPath;

    return report;
  }

  /**
   * Extract short summary from recent assistant messages
   */
  private extractShortSummary(chatHistory: ChatEntry[]): string {
    // Get last 5 assistant messages
    const recentAssistant = chatHistory
      .filter(e => e.type === 'assistant')
      .slice(-5)
      .map(e => e.content)
      .join(' ');

    // Extract first 200 chars as summary
    const summary = recentAssistant.slice(0, 200);
    return summary + (recentAssistant.length > 200 ? '...' : '');
  }

  /**
   * Extract key actions from tool results
   */
  private extractKeyActions(chatHistory: ChatEntry[]): string[] {
    const actions: string[] = [];

    for (const entry of chatHistory) {
      if (entry.type === 'tool_result' && entry.toolResult?.success && entry.toolCall) {
        const toolName = entry.toolCall.function.name;

        try {
          const args = JSON.parse(entry.toolCall.function.arguments || '{}');

          if (toolName === 'text_editor_20241022' || toolName === 'text_editor') {
            if (args.command === 'create') {
              actions.push(`Created ${args.path}`);
            } else if (args.command === 'str_replace') {
              actions.push(`Modified ${args.path}`);
            } else if (args.command === 'view') {
              // Don't log view operations (too noisy)
            }
          } else if (toolName === 'bash') {
            const cmd = args.command || '';
            // Only log meaningful commands
            if (!cmd.includes('cat') && !cmd.includes('ls') && cmd.length < 100) {
              actions.push(`Ran: ${cmd}`);
            }
          } else if (toolName === 'search') {
            // Don't log search operations (too noisy)
          }
        } catch {
          // Ignore parse errors
        }
      }
    }

    return actions.slice(-10); // Last 10 actions
  }

  /**
   * Extract modified files from tool results
   */
  private extractFilesModified(chatHistory: ChatEntry[]): Array<{ path: string; type: 'created' | 'modified' | 'deleted' }> {
    const files = new Map<string, 'created' | 'modified' | 'deleted'>();

    for (const entry of chatHistory) {
      if (entry.type === 'tool_result' && entry.toolResult?.success && entry.toolCall) {
        const toolName = entry.toolCall.function.name;

        try {
          const args = JSON.parse(entry.toolCall.function.arguments || '{}');

          if (toolName === 'text_editor_20241022' || toolName === 'text_editor') {
            const filePath = args.path;
            const command = args.command;

            if (command === 'create') {
              files.set(filePath, 'created');
            } else if (command === 'str_replace') {
              if (!files.has(filePath)) {
                files.set(filePath, 'modified');
              }
            }
          }
        } catch {
          // Ignore parse errors
        }
      }
    }

    return Array.from(files.entries()).map(([path, type]) => ({ path, type }));
  }

  /**
   * Extract current task from last user message
   */
  private extractCurrentTask(chatHistory: ChatEntry[]): string {
    // Get last user message
    const lastUser = chatHistory
      .filter(e => e.type === 'user')
      .slice(-1)[0];

    return lastUser?.content || 'Unknown';
  }

  /**
   * Extract next steps from recent assistant messages
   */
  private extractNextSteps(chatHistory: ChatEntry[]): string[] {
    // Get last 3 assistant messages
    const lastAssistant = chatHistory
      .filter(e => e.type === 'assistant')
      .slice(-3)
      .map(e => e.content)
      .join(' ');

    const steps: string[] = [];
    const sentences = lastAssistant.split(/[.!?]/).filter(s => s.trim());

    for (const sentence of sentences) {
      // Look for sentences mentioning future actions
      if (/\b(next|will|going to|then|after|now|should)\b/i.test(sentence)) {
        const cleaned = sentence.trim();
        if (cleaned.length > 10 && cleaned.length < 200) {
          steps.push(cleaned);
        }
      }
    }

    return steps.slice(0, 3); // Top 3 next steps
  }

  /**
   * Save summary to disk
   */
  private async saveSummary(summary: ContextSummary): Promise<string> {
    // Ensure output directory exists
    await fs.mkdir(this.outputDir, { recursive: true });

    const timestamp = summary.timestamp.toISOString().replace(/[:.]/g, '-');
    const filename = `summary-${timestamp}.md`;
    const filepath = path.join(this.outputDir, filename);

    const markdown = this.formatSummaryAsMarkdown(summary);
    await fs.writeFile(filepath, markdown, 'utf-8');

    return filepath;
  }

  /**
   * Save status report to disk
   */
  private async saveReport(report: StatusReport): Promise<string> {
    // Ensure output directory exists
    await fs.mkdir(this.outputDir, { recursive: true });

    const timestamp = report.timestamp.toISOString().replace(/[:.]/g, '-');
    const filename = `status-${timestamp}.md`;
    const filepath = path.join(this.outputDir, filename);

    const markdown = this.formatReportAsMarkdown(report);
    await fs.writeFile(filepath, markdown, 'utf-8');

    return filepath;
  }

  /**
   * Format summary as markdown
   */
  private formatSummaryAsMarkdown(summary: ContextSummary): string {
    let md = `# Context Summary\n\n`;
    md += `**Generated**: ${summary.timestamp.toISOString()}\n`;
    md += `**Reason**: ${summary.reason.replace(/_/g, ' ')}\n`;
    md += `**Messages**: ${summary.messageCount}\n`;
    md += `**Tokens**: ${summary.tokenCount.toLocaleString()}\n\n`;

    md += `## Short Summary\n\n${summary.shortSummary}\n\n`;

    if (summary.keyActions.length > 0) {
      md += `## Key Actions\n\n`;
      summary.keyActions.forEach(action => {
        md += `- ${action}\n`;
      });
      md += '\n';
    }

    if (summary.filesModified.length > 0) {
      md += `## Files Modified\n\n`;
      summary.filesModified.forEach(file => {
        md += `- ${file.path} (${file.type})\n`;
      });
      md += '\n';
    }

    md += `## Current Task\n\n${summary.currentTask}\n\n`;

    if (summary.nextSteps.length > 0) {
      md += `## Next Steps\n\n`;
      summary.nextSteps.forEach((step, i) => {
        md += `${i + 1}. ${step}\n`;
      });
    }

    return md;
  }

  /**
   * Format status report as markdown
   */
  private formatReportAsMarkdown(report: StatusReport): string {
    let md = `# Status Report\n\n`;
    md += `**Generated**: ${report.timestamp.toISOString()}\n`;
    md += `**Session Duration**: ${Math.ceil(report.session.duration / 60000)} minutes\n\n`;

    md += `## Session Info\n\n`;
    md += `- **Messages**: ${report.session.messageCount}\n`;
    md += `- **Token Usage**: ${report.session.tokenUsage.toLocaleString()} tokens\n`;
    md += `- **Files Modified**: ${report.filesModified.length} files\n\n`;

    if (report.plan) {
      md += `## Plan Progress\n\n`;
      md += `**Plan**: ${report.plan.name.slice(0, 100)}${report.plan.name.length > 100 ? '...' : ''}\n`;
      md += `**Status**: ${report.plan.status}\n`;
      md += `**Progress**: ${report.plan.progress.percentage.toFixed(0)}% (${report.plan.progress.completed}/${report.plan.progress.total} phases completed)\n\n`;

      md += `### Phases\n\n`;
      for (const phase of report.plan.phases) {
        const icon = this.getPhaseIcon(phase.status);
        md += `${icon} **${phase.name}**`;
        if (phase.duration) {
          md += ` (${(phase.duration / 1000).toFixed(1)}s)`;
        }
        md += '\n';
        if (phase.filesModified.length > 0) {
          md += `  - Files: ${phase.filesModified.join(', ')}\n`;
        }
      }
      md += '\n';
    }

    if (report.keyActions.length > 0) {
      md += `## Actions Taken\n\n`;
      report.keyActions.forEach(action => {
        md += `- ${action}\n`;
      });
      md += '\n';
    }

    if (report.filesModified.length > 0) {
      md += `## Files Modified\n\n`;
      report.filesModified.forEach(file => {
        md += `- ${file.path} (${file.type})\n`;
      });
      md += '\n';
    }

    md += `## Current Task\n\n${report.currentTask}\n\n`;

    if (report.nextSteps.length > 0) {
      md += `## Next Steps\n\n`;
      report.nextSteps.forEach((step, i) => {
        md += `${i + 1}. ${step}\n`;
      });
    }

    return md;
  }

  /**
   * Get phase status icon
   */
  private getPhaseIcon(status: string): string {
    const icons: Record<string, string> = {
      pending: '⏳',
      executing: '▶️',
      completed: '✅',
      failed: '❌',
      skipped: '⏭️',
    };
    return icons[status] || '❓';
  }
}

/**
 * Get or create singleton StatusReporter instance
 */
let reporterInstance: StatusReporter | null = null;

export function getStatusReporter(): StatusReporter {
  if (!reporterInstance) {
    reporterInstance = new StatusReporter();
  }
  return reporterInstance;
}

/**
 * Reset reporter instance (for testing)
 */
export function resetStatusReporter(): void {
  reporterInstance = null;
}
