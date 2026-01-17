/**
 * Rules Parser
 *
 * Parses existing configuration files (.cursorrules, .editorconfig, etc.)
 * to extract coding standards and rules for the project.
 *
 * This allows /init to incorporate existing project conventions
 * instead of starting from scratch.
 */

import * as fs from 'fs';
import * as path from 'path';

/** Parsed rules from various config files */
export interface ParsedRules {
  /** Source file the rules were parsed from */
  source: string;
  /** Extracted rules as human-readable strings */
  rules: string[];
}

/** Combined result from all parsers */
export interface RulesParseResult {
  /** All parsed rules from various sources */
  sources: ParsedRules[];
  /** Flattened list of all rules */
  allRules: string[];
  /** Files that were successfully parsed */
  parsedFiles: string[];
}

/**
 * Parse all known config files in a project directory
 */
export function parseProjectRules(projectRoot: string): RulesParseResult {
  const sources: ParsedRules[] = [];
  const parsedFiles: string[] = [];

  // Try each known config file
  const parsers: Array<{ file: string; parser: (content: string) => string[] }> = [
    { file: '.cursorrules', parser: parseCursorRules },
    { file: '.editorconfig', parser: parseEditorConfig },
    { file: '.prettierrc', parser: parsePrettierRc },
    { file: '.prettierrc.json', parser: parsePrettierRc },
    { file: '.eslintrc.json', parser: parseEslintRc },
    { file: 'eslint.config.js', parser: () => ['ESLint flat config detected - see eslint.config.js'] },
    { file: 'biome.json', parser: parseBiomeConfig },
  ];

  for (const { file, parser } of parsers) {
    const filePath = path.join(projectRoot, file);
    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const rules = parser(content);
        if (rules.length > 0) {
          sources.push({ source: file, rules });
          parsedFiles.push(file);
        }
      } catch {
        // Skip files that can't be parsed
      }
    }
  }

  // Flatten all rules
  const allRules = sources.flatMap(s => s.rules);

  return { sources, allRules, parsedFiles };
}

/**
 * Parse .cursorrules file (plain text with rules/instructions)
 */
function parseCursorRules(content: string): string[] {
  const rules: string[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) {
      continue;
    }
    // Extract bullet points or numbered items
    if (trimmed.startsWith('-') || trimmed.startsWith('*') || /^\d+\./.test(trimmed)) {
      const rule = trimmed.replace(/^[-*]\s*/, '').replace(/^\d+\.\s*/, '');
      if (rule.length > 10 && rule.length < 200) {
        rules.push(rule);
      }
    }
  }

  // Limit to most important rules
  return rules.slice(0, 10);
}

/**
 * Parse .editorconfig file
 */
function parseEditorConfig(content: string): string[] {
  const rules: string[] = [];
  const lines = content.split('\n');
  const settings: Record<string, string> = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith(';')) {
      continue;
    }

    // Skip section headers (we parse all settings globally for simplicity)
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      continue;
    }

    // Key-value pair
    const match = trimmed.match(/^(\w+)\s*=\s*(.+)$/);
    if (match) {
      const [, key, value] = match;
      settings[key] = value;
    }
  }

  // Convert settings to human-readable rules
  if (settings.indent_style) {
    rules.push(`Indentation: ${settings.indent_style}${settings.indent_size ? ` (${settings.indent_size} spaces)` : ''}`);
  }
  if (settings.end_of_line) {
    rules.push(`Line endings: ${settings.end_of_line.toUpperCase()}`);
  }
  if (settings.charset) {
    rules.push(`File encoding: ${settings.charset}`);
  }
  if (settings.trim_trailing_whitespace === 'true') {
    rules.push('Trim trailing whitespace');
  }
  if (settings.insert_final_newline === 'true') {
    rules.push('Insert final newline');
  }
  if (settings.max_line_length) {
    rules.push(`Max line length: ${settings.max_line_length}`);
  }

  return rules;
}

/**
 * Parse .prettierrc or .prettierrc.json
 */
function parsePrettierRc(content: string): string[] {
  const rules: string[] = [];

  try {
    const config = JSON.parse(content);

    if (config.semi !== undefined) {
      rules.push(config.semi ? 'Use semicolons' : 'No semicolons');
    }
    if (config.singleQuote !== undefined) {
      rules.push(config.singleQuote ? 'Use single quotes' : 'Use double quotes');
    }
    if (config.tabWidth) {
      rules.push(`Tab width: ${config.tabWidth}`);
    }
    if (config.useTabs !== undefined) {
      rules.push(config.useTabs ? 'Use tabs for indentation' : 'Use spaces for indentation');
    }
    if (config.trailingComma) {
      rules.push(`Trailing commas: ${config.trailingComma}`);
    }
    if (config.printWidth) {
      rules.push(`Print width: ${config.printWidth}`);
    }
  } catch {
    // Not valid JSON, might be YAML or other format
    rules.push('Prettier config detected - see .prettierrc');
  }

  return rules;
}

/**
 * Parse .eslintrc.json
 */
function parseEslintRc(content: string): string[] {
  const rules: string[] = [];

  try {
    const config = JSON.parse(content);

    // Extract extends
    if (config.extends) {
      const extendsArr = Array.isArray(config.extends) ? config.extends : [config.extends];
      for (const ext of extendsArr.slice(0, 3)) {
        if (typeof ext === 'string') {
          rules.push(`ESLint extends: ${ext}`);
        }
      }
    }

    // Extract parser
    if (config.parser) {
      if (config.parser.includes('typescript')) {
        rules.push('ESLint: TypeScript parser enabled');
      }
    }

    // Note some key rules
    if (config.rules) {
      const ruleCount = Object.keys(config.rules).length;
      rules.push(`ESLint: ${ruleCount} custom rules configured`);
    }
  } catch {
    rules.push('ESLint config detected - see .eslintrc.json');
  }

  return rules;
}

/**
 * Parse biome.json
 */
function parseBiomeConfig(content: string): string[] {
  const rules: string[] = [];

  try {
    const config = JSON.parse(content);

    rules.push('Biome formatter/linter enabled');

    if (config.formatter?.indentStyle) {
      rules.push(`Biome indent: ${config.formatter.indentStyle}`);
    }
    if (config.formatter?.indentWidth) {
      rules.push(`Biome indent width: ${config.formatter.indentWidth}`);
    }
    if (config.linter?.enabled !== false) {
      rules.push('Biome linting enabled');
    }
  } catch {
    rules.push('Biome config detected - see biome.json');
  }

  return rules;
}

/**
 * Check if a project has any existing rules files
 */
export function hasExistingRules(projectRoot: string): boolean {
  const knownFiles = [
    '.cursorrules',
    '.editorconfig',
    '.prettierrc',
    '.prettierrc.json',
    '.eslintrc.json',
    '.eslintrc.js',
    'eslint.config.js',
    'biome.json',
  ];

  return knownFiles.some(file => fs.existsSync(path.join(projectRoot, file)));
}

/**
 * Get a summary of detected rule sources
 */
export function getRulesSummary(result: RulesParseResult): string {
  if (result.parsedFiles.length === 0) {
    return 'No existing config files detected';
  }

  return `Parsed ${result.parsedFiles.length} config file(s): ${result.parsedFiles.join(', ')}`;
}
