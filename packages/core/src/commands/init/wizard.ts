/**
 * Interactive Setup Wizard for Init Command
 */

import * as prompts from '@clack/prompts';
import { OnboardingManager } from '../../utils/onboarding-manager.js';
import { TemplateManager } from '../../utils/template-manager.js';
import type { ProjectInfo } from '../../types/project-analysis.js';
import type { ProjectTemplate } from '../../schemas/index.js';
import { exitIfCancelled } from '../utils.js';

export interface WizardOptions {
  nonInteractive?: boolean;
  yes?: boolean;
  template?: string;
  preset?: string;
}

export interface UserPreferences {
  verbose: boolean;
  autoConfirm: boolean;
  editor?: string;
}

export interface WizardResult {
  preferences: UserPreferences;
  generateInstructions: boolean;
  skipWelcome: boolean;
  selectedTemplate?: ProjectTemplate;
}

export class InitWizard {
  private options: WizardOptions;
  private isFirstRun: boolean;

  constructor(options: WizardOptions = {}) {
    this.options = options;
    this.isFirstRun = OnboardingManager.detectFirstRun();
  }

  /**
   * Run the interactive wizard
   */
  async run(): Promise<WizardResult> {
    // Skip if non-interactive mode
    if (this.options.nonInteractive || this.options.yes) {
      return this.getDefaults();
    }

    // Show welcome screen for first-time users
    if (this.isFirstRun) {
      await this.showWelcome();
    }

    // Run wizard steps (no API configuration - that's handled by 'ax setup')
    const preferences = await this.stepPreferences();
    const selectedTemplate = await this.stepTemplateSelection();
    const generateInstructions = await this.stepInstructionGeneration(selectedTemplate);

    return {
      preferences,
      generateInstructions,
      skipWelcome: !this.isFirstRun,
      selectedTemplate,
    };
  }

  /**
   * Show welcome screen for first-time users
   */
  private async showWelcome(): Promise<void> {
    prompts.intro('Welcome to AX CLI Project Initialization!');

    await prompts.note(
      `This will set up your project for AX CLI.\n\n` +
      `Steps:\n\n` +
      `  ⏩ Step 1/2: Preferences\n` +
      `  ⏹ Step 2/2: Project Analysis\n\n` +
      `Note: API configuration is done via 'ax setup' command.`,
      'Project Setup'
    );
  }

  /**
   * Step 1: User Preferences
   */
  private async stepPreferences(): Promise<UserPreferences> {
    const group = await prompts.group(
      {
        verbose: () =>
          prompts.confirm({
            message: 'Enable verbose output?',
            initialValue: false,
          }),

        autoConfirm: () =>
          prompts.confirm({
            message: 'Auto-confirm safe operations?',
            initialValue: true,
          }),

        editor: () =>
          prompts.select({
            message: 'Preferred editor for CUSTOM.md:',
            options: [
              { value: 'code', label: 'VS Code', hint: 'code command' },
              { value: 'vim', label: 'Vim', hint: 'Terminal editor' },
              { value: 'nano', label: 'Nano', hint: 'Simple terminal editor' },
              { value: 'none', label: 'None', hint: 'Manual editing' },
            ],
            initialValue: 'code',
          }),
      },
      {
        onCancel: () => {
          prompts.cancel('Operation cancelled.');
          process.exit(0);
        },
      }
    );

    return {
      verbose: group.verbose,
      autoConfirm: group.autoConfirm,
      editor: group.editor === 'none' ? undefined : group.editor,
    };
  }

  /**
   * Step 2: Template Selection (optional)
   */
  private async stepTemplateSelection(): Promise<ProjectTemplate | undefined> {
    // If template is specified in options, use it
    if (this.options.template) {
      const template = TemplateManager.getTemplate(this.options.template);
      if (template) {
        return template;
      }
      console.warn(`⚠️  Template '${this.options.template}' not found, continuing without template`);
    }

    // Ask if user wants to use a template
    const useTemplate = await prompts.confirm({
      message: 'Use a project template?',
      initialValue: false,
    });
    exitIfCancelled(useTemplate);

    if (!useTemplate) {
      return undefined;
    }

    // List available templates
    const templates = TemplateManager.listTemplates();

    if (templates.length === 0) {
      await prompts.note(
        'No templates available. You can create templates with:\n' +
        '  ax-cli templates save <name>',
        'No Templates'
      );
      return undefined;
    }

    // Select template
    const templateId = await prompts.select({
      message: 'Select a template:',
      options: templates.map(t => ({
        value: t.id,
        label: t.name,
        hint: t.description,
      })),
    });
    exitIfCancelled(templateId);

    return TemplateManager.getTemplate(templateId) || undefined;
  }

  /**
   * Instruction Generation Confirmation
   */
  private async stepInstructionGeneration(selectedTemplate?: ProjectTemplate): Promise<boolean> {
    // If using a template, skip this step (template has instructions)
    if (selectedTemplate) {
      return false; // Don't generate, use template instructions
    }

    const result = await prompts.confirm({
      message: 'Generate custom instructions (CUSTOM.md)?',
      initialValue: true,
    });
    exitIfCancelled(result);

    return result;
  }

  /**
   * Show completion summary
   */
  async showCompletion(result: WizardResult, projectInfo?: ProjectInfo): Promise<void> {
    prompts.outro('Project initialization complete!');

    const summary = [
      '📦 Project Summary:',
      projectInfo ? `  • Project: ${projectInfo.name} (${projectInfo.projectType})` : '',
      `  • Verbose: ${result.preferences.verbose ? 'Enabled' : 'Disabled'}`,
      `  • Auto-confirm: ${result.preferences.autoConfirm ? 'Enabled' : 'Disabled'}`,
    ].filter(Boolean).join('\n');

    await prompts.note(summary, 'Summary');

    const nextSteps = [
      '🚀 Next Steps:',
      '  1. Review .ax-cli/CUSTOM.md and customize if needed',
      '  2. Start chatting with the AI',
    ].join('\n');

    await prompts.note(nextSteps, 'Get Started');

    // Mark onboarding as complete
    if (this.isFirstRun) {
      OnboardingManager.markCompleted();
    }
  }

  /**
   * Get default values for non-interactive mode
   */
  private getDefaults(): WizardResult {
    // Check if template was specified
    let selectedTemplate: ProjectTemplate | undefined;
    if (this.options.template) {
      selectedTemplate = TemplateManager.getTemplate(this.options.template) || undefined;
    }

    return {
      preferences: {
        verbose: false,
        autoConfirm: true,
        editor: undefined,
      },
      generateInstructions: !selectedTemplate, // Don't generate if using template
      skipWelcome: true,
      selectedTemplate,
    };
  }
}
