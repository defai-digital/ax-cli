/**
 * Console Messenger Utility
 * Centralized, consistent console messaging with YAML-based templates
 */

import chalk from 'chalk';
import { formatMessage, loadMessagesConfig } from './config-loader.js';

// Load messages once at module initialization
const messages = loadMessagesConfig();

/**
 * Get nested message value from messages config
 * Supports dot notation: "ui.api_key_input.title"
 */
function getMessage(key: string): string | undefined {
  const parts = key.split('.');
  let current: any = messages;

  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return undefined;
    }
  }

  return typeof current === 'string' ? current : undefined;
}

/**
 * Console messenger with styled output
 */
export const ConsoleMessenger = {
  /**
   * Print success message in green
   */
  success(key: string, vars?: Record<string, string | number>): void {
    const template = messages.success[key] || getMessage(key);
    if (!template) {
      console.warn(chalk.yellow(`Warning: Message key "${key}" not found`));
      return;
    }
    const msg = vars ? formatMessage(template, vars) : template;
    console.log(chalk.green(msg));
  },

  /**
   * Print error message in red
   */
  error(key: string, vars?: Record<string, string | number>): void {
    const template = messages.errors[key] || getMessage(key);
    if (!template) {
      console.warn(chalk.yellow(`Warning: Message key "${key}" not found`));
      return;
    }
    const msg = vars ? formatMessage(template, vars) : template;
    console.error(chalk.red(msg));
  },

  /**
   * Print warning message in yellow
   */
  warning(key: string, vars?: Record<string, string | number>): void {
    const template = messages.warnings[key] || getMessage(key);
    if (!template) {
      console.warn(chalk.yellow(`Warning: Message key "${key}" not found`));
      return;
    }
    const msg = vars ? formatMessage(template, vars) : template;
    console.log(chalk.yellow(msg));
  },

  /**
   * Print info message in blue
   */
  info(key: string, vars?: Record<string, string | number>): void {
    const template = messages.info[key] || getMessage(key);
    if (!template) {
      console.warn(chalk.yellow(`Warning: Message key "${key}" not found`));
      return;
    }
    const msg = vars ? formatMessage(template, vars) : template;
    console.log(chalk.blue(msg));
  },

  /**
   * Print plain message without styling
   */
  plain(key: string, vars?: Record<string, string | number>): void {
    const template = getMessage(key);
    if (!template) {
      console.warn(chalk.yellow(`Warning: Message key "${key}" not found`));
      return;
    }
    const msg = vars ? formatMessage(template, vars) : template;
    console.log(msg);
  },

  /**
   * Print bold message
   */
  bold(key: string, vars?: Record<string, string | number>): void {
    const template = getMessage(key);
    if (!template) {
      console.warn(chalk.yellow(`Warning: Message key "${key}" not found`));
      return;
    }
    const msg = vars ? formatMessage(template, vars) : template;
    console.log(chalk.bold(msg));
  },

  /**
   * Print dimmed message
   */
  dim(key: string, vars?: Record<string, string | number>): void {
    const template = getMessage(key);
    if (!template) {
      console.warn(chalk.yellow(`Warning: Message key "${key}" not found`));
      return;
    }
    const msg = vars ? formatMessage(template, vars) : template;
    console.log(chalk.dim(msg));
  },

  /**
   * Print custom message with direct template and variables
   * Use this when message is not in messages.yaml
   */
  custom(template: string, vars?: Record<string, string | number>, color?: 'green' | 'red' | 'yellow' | 'blue' | 'white'): void {
    const msg = vars ? formatMessage(template, vars) : template;

    switch (color) {
      case 'green':
        console.log(chalk.green(msg));
        break;
      case 'red':
        console.error(chalk.red(msg));
        break;
      case 'yellow':
        console.log(chalk.yellow(msg));
        break;
      case 'blue':
        console.log(chalk.blue(msg));
        break;
      default:
        console.log(msg);
    }
  },
};

/**
 * Shorthand aliases for common operations
 */
export const msg = ConsoleMessenger;
