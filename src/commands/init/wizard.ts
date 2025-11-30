/**
 * Interactive Setup Wizard for Init Command
 */

import * as prompts from '@clack/prompts';
import { OnboardingManager } from '../../utils/onboarding-manager.js';
import { TemplateManager } from '../../utils/template-manager.js';
import type { ProjectInfo } from '../../types/project-analysis.js';
import type { ProjectTemplate } from '../../schemas/index.js';

export interface WizardOptions {
  nonInteractive?: boolean;
  yes?: boolean;
  template?: string;
  preset?: string;
}

export interface APIConfig {
  provider: 'glm' | 'openai' | 'anthropic' | 'ollama' | 'custom';
  apiKey?: string;
  baseUrl?: string;
  model: string;
}

export interface UserPreferences {
  verbose: boolean;
  autoConfirm: boolean;
  editor?: string;
}

export interface WizardResult {
  apiConfig?: APIConfig;
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

    // Run wizard steps
    const apiConfig = await this.stepAPIConfiguration();
    const preferences = await this.stepPreferences();
    const selectedTemplate = await this.stepTemplateSelection();
    const generateInstructions = await this.stepInstructionGeneration(selectedTemplate);

    return {
      apiConfig,
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
    prompts.intro('Welcome to AX CLI!');

    await prompts.note(
      `AX CLI is an enterprise-grade AI command line interface.\n\n` +
      `Let's get you set up in under 60 seconds:\n\n` +
      `  ⏩ Step 1/3: API Configuration\n` +
      `  ⏹ Step 2/3: Preferences\n` +
      `  ⏹ Step 3/3: Project Analysis`,
      'First-Time Setup'
    );
  }

  /**
   * Step 1: API Configuration
   */
  private async stepAPIConfiguration(): Promise<APIConfig | undefined> {
    const group = await prompts.group(
      {
        provider: () =>
          prompts.select({
            message: 'Which AI provider do you want to use?',
            options: [
              {
                value: 'glm' as const,
                label: 'GLM (Recommended)',
                hint: 'Fast, affordable, 200K context',
              },
              {
                value: 'openai' as const,
                label: 'OpenAI',
                hint: 'GPT-4, GPT-3.5',
              },
              {
                value: 'anthropic' as const,
                label: 'Anthropic',
                hint: 'Claude 3.5 Sonnet, Opus',
              },
              {
                value: 'ollama' as const,
                label: 'Ollama (Local)',
                hint: 'Run models locally, no API key needed',
              },
              {
                value: 'custom' as const,
                label: 'Custom',
                hint: 'Use any OpenAI-compatible API',
              },
            ],
            initialValue: 'glm' as const,
          }),

        apiKey: ({ results }: { results: { provider?: string } }) => {
          // Skip API key for Ollama (local)
          if (results.provider === 'ollama') {
            return Promise.resolve(undefined);
          }

          return prompts.password({
            message: `Enter your ${results.provider?.toUpperCase()} API key:`,
            validate: (value: string) => {
              if (!value || value.length === 0) {
                return 'API key is required (or use Ollama for local models)';
              }
              return;
            },
          });
        },

        baseUrl: ({ results }: { results: { provider?: string } }) => {
          if (results.provider === 'custom') {
            return prompts.text({
              message: 'Enter custom API base URL:',
              placeholder: 'https://api.example.com/v1',
              validate: (value: string) => {
                if (!value || !value.startsWith('http')) {
                  return 'Please enter a valid URL';
                }
                return;
              },
            });
          }
          return Promise.resolve(undefined);
        },

        model: ({ results }: { results: { provider?: string } }) => {
          const modelOptions: Record<string, Array<{ value: string; label: string; hint: string }>> = {
            glm: [
              { value: 'glm-4.6', label: 'glm-4.6 (Recommended)', hint: '200K context, reasoning mode' },
              { value: 'glm-4-flash', label: 'glm-4-flash', hint: 'Faster, 32K context' },
            ],
            openai: [
              { value: 'gpt-4-turbo', label: 'GPT-4 Turbo', hint: '128K context' },
              { value: 'gpt-4', label: 'GPT-4', hint: '8K context' },
              { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo', hint: '16K context, faster' },
            ],
            anthropic: [
              { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet', hint: '200K context' },
              { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus', hint: '200K context' },
            ],
            ollama: [
              { value: 'llama2', label: 'Llama 2', hint: 'Local model' },
              { value: 'codellama', label: 'Code Llama', hint: 'Code-focused local model' },
              { value: 'mistral', label: 'Mistral', hint: 'Fast local model' },
            ],
            custom: [],
          };

          const options = modelOptions[results.provider as string] || [];

          if (options.length === 0) {
            return prompts.text({
              message: 'Enter model name:',
              placeholder: 'model-name',
            }) as Promise<string>;
          }

          return prompts.select({
            message: 'Select your default model:',
            options,
            initialValue: options[0]?.value,
          }) as Promise<string>;
        },
      },
      {
        onCancel: () => {
          prompts.cancel('Operation cancelled.');
          process.exit(0);
        },
      }
    );

    return {
      provider: group.provider as 'glm' | 'openai' | 'anthropic' | 'ollama' | 'custom',
      apiKey: group.apiKey as string | undefined,
      baseUrl: group.baseUrl as string | undefined,
      model: group.model as string,
    };
  }

  /**
   * Step 2: User Preferences
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
   * Step 3: Template Selection
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

    if (prompts.isCancel(useTemplate)) {
      prompts.cancel('Operation cancelled.');
      process.exit(0);
    }

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

    if (prompts.isCancel(templateId)) {
      prompts.cancel('Operation cancelled.');
      process.exit(0);
    }

    return TemplateManager.getTemplate(templateId as string) || undefined;
  }

  /**
   * Step 4: Instruction Generation Confirmation
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

    if (prompts.isCancel(result)) {
      prompts.cancel('Operation cancelled.');
      process.exit(0);
    }

    return result;
  }

  /**
   * Show completion summary
   */
  async showCompletion(result: WizardResult, projectInfo?: ProjectInfo): Promise<void> {
    prompts.outro('Setup complete!');

    const summary = [
      '📦 Configuration Summary:',
      result.apiConfig ? `  • Provider: ${result.apiConfig.provider}` : '',
      result.apiConfig?.model ? `  • Model: ${result.apiConfig.model}` : '',
      projectInfo ? `  • Project: ${projectInfo.name} (${projectInfo.projectType})` : '',
      `  • Verbose: ${result.preferences.verbose ? 'Enabled' : 'Disabled'}`,
      `  • Auto-confirm: ${result.preferences.autoConfirm ? 'Enabled' : 'Disabled'}`,
    ].filter(Boolean).join('\n');

    await prompts.note(summary, 'Summary');

    const nextSteps = [
      '🚀 Next Steps:',
      '  1. Review .ax-cli/CUSTOM.md and customize if needed',
      '  2. Run: ax-cli (start interactive session)',
      '  3. Run: ax-cli --help (view all commands)',
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
