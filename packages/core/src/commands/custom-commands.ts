/**
 * Custom Commands System
 *
 * Allows users to create custom slash commands using markdown files.
 * Commands can be project-level (.ax-cli/commands/) or personal (~/.ax-cli/commands/).
 *
 * @packageDocumentation
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { extractErrorMessage } from "../utils/error-handler.js";

// Pre-compiled regex patterns for positional arguments (avoid creating RegExp in hot path)
const POSITIONAL_ARG_PATTERNS = Array.from({ length: 10 }, (_, i) => new RegExp(`\\$${i + 1}`, "g"));

/**
 * Custom command definition
 */
export interface CustomCommand {
  /** Command name (without leading slash) */
  name: string;
  /** Command description from frontmatter or first line */
  description: string;
  /** Full path to the command file */
  filePath: string;
  /** Whether this is a project-level or user-level command */
  scope: "project" | "user";
  /** The command content/prompt */
  content: string;
  /** Optional arguments configuration */
  arguments?: {
    /** Whether the command accepts arguments */
    required?: boolean;
    /** Description of expected arguments */
    description?: string;
  };
}

/**
 * Parsed frontmatter from a command file
 */
interface CommandFrontmatter {
  description?: string;
  arguments?: {
    required?: boolean;
    description?: string;
  };
}

/**
 * Parse YAML-like frontmatter from a markdown file
 */
function parseFrontmatter(content: string): { frontmatter: CommandFrontmatter; body: string } {
  // Normalize line endings to \n
  const normalized = content.replace(/\r\n/g, "\n");

  // Match frontmatter with optional trailing newline
  const frontmatterMatch = normalized.match(/^---\n([\s\S]*?)\n---(?:\n|$)([\s\S]*)$/);

  if (!frontmatterMatch) {
    return { frontmatter: {}, body: content };
  }

  const frontmatterStr = frontmatterMatch[1];
  const body = frontmatterMatch[2];

  // Simple YAML parsing (key: value format)
  const frontmatter: CommandFrontmatter = {};
  const lines = frontmatterStr.split("\n");

  let currentKey: string | null = null;
  let inNestedObject = false;
  let nestedObject: Record<string, unknown> = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    // Check for nested object end
    if (inNestedObject && !line.startsWith("  ")) {
      if (currentKey === "arguments") {
        frontmatter.arguments = nestedObject as CommandFrontmatter["arguments"];
      }
      inNestedObject = false;
      nestedObject = {};
      currentKey = null;
    }

    // Check for nested object start
    if (trimmed.endsWith(":") && !trimmed.includes(": ")) {
      currentKey = trimmed.slice(0, -1);
      inNestedObject = true;
      nestedObject = {};
      continue;
    }

    // Handle nested properties
    if (inNestedObject && line.startsWith("  ")) {
      const match = trimmed.match(/^(\w+):\s*(.*)$/);
      if (match) {
        const [, key, value] = match;
        if (value === "true") {
          nestedObject[key] = true;
        } else if (value === "false") {
          nestedObject[key] = false;
        } else {
          nestedObject[key] = value.replace(/^["']|["']$/g, "");
        }
      }
      continue;
    }

    // Handle top-level properties
    const match = trimmed.match(/^(\w+):\s*(.*)$/);
    if (match) {
      const [, key, value] = match;
      if (key === "description") {
        frontmatter.description = value.replace(/^["']|["']$/g, "");
      }
    }
  }

  // Handle case where nested object is at the end
  if (inNestedObject && currentKey === "arguments") {
    frontmatter.arguments = nestedObject as CommandFrontmatter["arguments"];
  }

  return { frontmatter, body };
}

/**
 * Get the first non-empty line as a description fallback
 */
function getFirstLineDescription(content: string): string {
  const lines = content.trim().split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      return trimmed.slice(0, 100); // Limit length
    }
  }
  return "Custom command";
}

/**
 * Load custom commands from a directory
 */
function loadCommandsFromDir(dir: string, scope: "project" | "user"): CustomCommand[] {
  const commands: CustomCommand[] = [];

  if (!fs.existsSync(dir)) {
    return commands;
  }

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(".md")) {
        const filePath = path.join(dir, entry.name);
        const name = entry.name.slice(0, -3); // Remove .md extension

        try {
          const content = fs.readFileSync(filePath, "utf-8");
          const { frontmatter, body } = parseFrontmatter(content);

          commands.push({
            name,
            description: frontmatter.description || getFirstLineDescription(body),
            filePath,
            scope,
            content: body.trim(),
            arguments: frontmatter.arguments,
          });
        } catch (error) {
          console.warn(`Failed to load command ${name}:`, extractErrorMessage(error));
        }
      } else if (entry.isDirectory()) {
        // Support nested commands (e.g., commands/project/review.md -> /project:review)
        const subDir = path.join(dir, entry.name);
        const subCommands = loadCommandsFromDir(subDir, scope);
        for (const cmd of subCommands) {
          cmd.name = `${entry.name}:${cmd.name}`;
          commands.push(cmd);
        }
      }
    }
  } catch (error) {
    console.warn(`Failed to read commands directory ${dir}:`, extractErrorMessage(error));
  }

  return commands;
}

/**
 * Custom Commands Manager
 */
export class CustomCommandsManager {
  private static instance: CustomCommandsManager | null = null;
  private commands: Map<string, CustomCommand> = new Map();
  private projectDir: string;
  private userDir: string;
  private initialized: boolean = false;

  private constructor() {
    this.projectDir = path.join(process.cwd(), ".ax-cli", "commands");
    this.userDir = path.join(os.homedir(), ".ax-cli", "commands");
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): CustomCommandsManager {
    if (!CustomCommandsManager.instance) {
      CustomCommandsManager.instance = new CustomCommandsManager();
    }
    return CustomCommandsManager.instance;
  }

  /**
   * Reset the singleton (for testing)
   */
  static reset(): void {
    CustomCommandsManager.instance = null;
  }

  /**
   * Initialize by loading commands from all sources
   */
  initialize(): void {
    if (this.initialized) return;

    this.commands.clear();

    // Load user-level commands first (lower priority)
    const userCommands = loadCommandsFromDir(this.userDir, "user");
    for (const cmd of userCommands) {
      this.commands.set(cmd.name, cmd);
    }

    // Load project-level commands (higher priority, overrides user)
    const projectCommands = loadCommandsFromDir(this.projectDir, "project");
    for (const cmd of projectCommands) {
      this.commands.set(cmd.name, cmd);
    }

    this.initialized = true;
  }

  /**
   * Get a command by name
   */
  getCommand(name: string): CustomCommand | undefined {
    if (!this.initialized) {
      this.initialize();
    }
    return this.commands.get(name);
  }

  /**
   * Get all available commands
   */
  getAllCommands(): CustomCommand[] {
    if (!this.initialized) {
      this.initialize();
    }
    return Array.from(this.commands.values());
  }

  /**
   * Check if a command exists
   */
  hasCommand(name: string): boolean {
    if (!this.initialized) {
      this.initialize();
    }
    return this.commands.has(name);
  }

  /**
   * Expand a command with arguments
   */
  expandCommand(name: string, args: string): string | null {
    const command = this.getCommand(name);
    if (!command) return null;

    let content = command.content;

    // Replace $ARGUMENTS with the full argument string
    content = content.replace(/\$ARGUMENTS/g, args);

    // Replace $1, $2, etc. with positional arguments (using pre-compiled patterns)
    const argParts = args.split(/\s+/).filter(Boolean);
    for (let i = 0; i < 10; i++) {
      const value = argParts[i] || "";
      content = content.replace(POSITIONAL_ARG_PATTERNS[i], value);
    }

    return content;
  }

  /**
   * Reload commands from disk
   */
  reload(): void {
    this.initialized = false;
    this.initialize();
  }
}

/**
 * Get the singleton custom commands manager instance
 */
export function getCustomCommandsManager(): CustomCommandsManager {
  return CustomCommandsManager.getInstance();
}
