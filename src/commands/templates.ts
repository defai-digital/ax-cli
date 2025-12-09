/**
 * Templates command for managing project templates
 */

import { Command } from 'commander';
import * as prompts from '@clack/prompts';
import { TemplateManager } from '../utils/template-manager.js';
import type { TemplateCreateOptions } from '../types/template.js';

export function createTemplatesCommand(): Command {
  const templatesCommand = new Command('templates')
    .description('Manage project templates')
    .alias('template');

  // List all templates
  templatesCommand
    .command('list')
    .description('List all available templates')
    .option('-v, --verbose', 'Show detailed template information', false)
    .action(async (options: { verbose?: boolean }) => {
      try {
        const templates = TemplateManager.listTemplates();

        if (templates.length === 0) {
          console.log('No templates found.');
          return;
        }

        prompts.intro('Available Templates');

        for (const template of templates) {
          const badge = template.isBuiltIn ? '[Built-in]' : '[Custom]';
          const tags = template.tags.join(', ');

          if (options.verbose) {
            prompts.note(
              `${template.description}\n\n` +
              `Type: ${template.projectType}\n` +
              `Tags: ${tags}\n` +
              `Source: ${template.isBuiltIn ? 'Built-in' : 'User'}`,
              `${badge} ${template.name}`
            );
          } else {
            console.log(`  ${badge} ${template.id.padEnd(15)} - ${template.name}`);
          }
        }

        if (!options.verbose) {
          console.log('\n💡 Use --verbose to see more details\n');
        }
      } catch (error) {
        console.error('❌ Error listing templates:', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });

  // Show template details
  templatesCommand
    .command('show <template-id>')
    .description('Show detailed information about a template')
    .action(async (templateId: string) => {
      try {
        const template = TemplateManager.getTemplate(templateId);

        if (!template) {
          console.error(`❌ Template '${templateId}' not found`);
          process.exit(1);
        }

        prompts.intro(`Template: ${template.name}`);

        prompts.note(
          `${template.description}\n\n` +
          `ID: ${template.id}\n` +
          `Version: ${template.version}\n` +
          `Type: ${template.projectType}\n` +
          `Tags: ${template.tags.join(', ')}\n` +
          `Source: ${template.isBuiltIn ? 'Built-in' : 'User'}\n` +
          (template.author ? `Author: ${template.author}\n` : '') +
          `Created: ${new Date(template.createdAt).toLocaleDateString()}`,
          'Details'
        );

        // Show preview of instructions
        const preview = template.instructions.split('\n').slice(0, 10).join('\n');
        prompts.note(
          `${preview}\n\n... (${template.instructions.length} characters total)`,
          'Instructions Preview'
        );

        console.log('\n💡 Use this template with: ax-cli init --template', templateId, '\n');
      } catch (error) {
        console.error('❌ Error showing template:', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });

  // Save current project as template
  templatesCommand
    .command('save <template-name>')
    .description('Save current project as a template')
    .option('-d, --directory <dir>', 'Project directory (default: current)', process.cwd())
    .option('-t, --type <type>', 'Project type')
    .option('--description <desc>', 'Template description')
    .option('--tags <tags>', 'Comma-separated tags')
    .option('--author <author>', 'Template author')
    .action(async (templateName: string, options: {
      directory?: string;
      type?: string;
      description?: string;
      tags?: string;
      author?: string;
    }) => {
      try {
        const projectRoot = options.directory || process.cwd();

        prompts.intro('Save Project as Template');

        // Interactive prompts for missing options
        const group = await prompts.group(
          {
            projectType: () => {
              if (options.type) return Promise.resolve(options.type);
              return prompts.select({
                message: 'Select project type:',
                options: [
                  { value: 'cli', label: 'CLI Application' },
                  { value: 'api', label: 'REST API' },
                  { value: 'web', label: 'Web Application' },
                  { value: 'library', label: 'Library/Package' },
                  { value: 'other', label: 'Other' },
                ],
              });
            },

            description: () => {
              if (options.description) return Promise.resolve(options.description);
              return prompts.text({
                message: 'Template description:',
                placeholder: 'A brief description of this template',
              });
            },

            tags: () => {
              if (options.tags) return Promise.resolve(options.tags);
              return prompts.text({
                message: 'Tags (comma-separated):',
                placeholder: 'typescript, react, vite',
                initialValue: '',
              });
            },

            author: () => {
              if (options.author) return Promise.resolve(options.author);
              return prompts.text({
                message: 'Author (optional):',
                placeholder: 'Your name',
                initialValue: '',
              });
            },
          },
          {
            onCancel: () => {
              prompts.cancel('Operation cancelled.');
              process.exit(0);
            },
          }
        );

        const createOptions: TemplateCreateOptions = {
          name: templateName,
          description: group.description as string,
          projectType: group.projectType as string,
          tags: group.tags ? (group.tags as string).split(',').map(t => t.trim()) : [],
          author: group.author as string | undefined,
        };

        const template = TemplateManager.createFromProject(projectRoot, createOptions);
        const success = TemplateManager.saveTemplate(template);

        if (success) {
          prompts.outro('Template saved successfully!');
          console.log(`\n✅ Template '${template.id}' saved`);
          console.log(`\n💡 Use with: ax-cli init --template ${template.id}\n`);
        } else {
          console.error('❌ Failed to save template');
          process.exit(1);
        }
      } catch (error) {
        console.error('❌ Error saving template:', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });

  // Delete a template
  templatesCommand
    .command('delete <template-id>')
    .description('Delete a user template')
    .option('-y, --yes', 'Skip confirmation', false)
    .action(async (templateId: string, options: { yes?: boolean }) => {
      try {
        const template = TemplateManager.getTemplate(templateId);

        if (!template) {
          console.error(`❌ Template '${templateId}' not found`);
          process.exit(1);
        }

        if (template.isBuiltIn) {
          console.error('❌ Cannot delete built-in templates');
          process.exit(1);
        }

        // Confirm deletion
        if (!options.yes) {
          const confirmed = await prompts.confirm({
            message: `Delete template '${template.name}'?`,
            initialValue: false,
          });

          if (prompts.isCancel(confirmed) || !confirmed) {
            prompts.cancel('Operation cancelled.');
            process.exit(0);
          }
        }

        const success = TemplateManager.deleteTemplate(templateId);

        if (success) {
          console.log(`✅ Template '${templateId}' deleted\n`);
        } else {
          console.error('❌ Failed to delete template');
          process.exit(1);
        }
      } catch (error) {
        console.error('❌ Error deleting template:', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });

  // Export a template
  templatesCommand
    .command('export <template-id> <output-file>')
    .description('Export a template to a file')
    .action(async (templateId: string, outputFile: string) => {
      try {
        const success = TemplateManager.exportTemplate(templateId, outputFile);

        if (success) {
          console.log(`✅ Template exported to: ${outputFile}\n`);
        } else {
          console.error('❌ Failed to export template');
          process.exit(1);
        }
      } catch (error) {
        console.error('❌ Error exporting template:', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });

  // Import a template
  templatesCommand
    .command('import <template-file>')
    .description('Import a template from a file')
    .action(async (templateFile: string) => {
      try {
        const success = TemplateManager.importTemplate(templateFile);

        if (success) {
          console.log(`✅ Template imported successfully\n`);
        } else {
          console.error('❌ Failed to import template');
          process.exit(1);
        }
      } catch (error) {
        console.error('❌ Error importing template:', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });

  return templatesCommand;
}
