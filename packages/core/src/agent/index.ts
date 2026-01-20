import { TextEditorTool, BashTool } from '../tools/index.js';
import { ToolResult, AgentState } from '../types/index.js';

// ============================================================================
// Command Prefixes
// ============================================================================

const CMD_VIEW = 'view ';
const CMD_STR_REPLACE = 'str_replace ';
const CMD_CREATE = 'create ';
const CMD_INSERT = 'insert ';
const CMD_UNDO = 'undo_edit';
const CMD_BASH = 'bash ';
const CMD_BASH_SHORT = '$ ';
const CMD_PWD = 'pwd';
const CMD_HISTORY = 'history';
const CMD_HELP = 'help';

// ============================================================================
// Error Messages
// ============================================================================

const ERROR_VIEW_REQUIRES_PATH = 'View command requires a file path';
const ERROR_INVALID_STR_REPLACE = 'Invalid str_replace command format';
const ERROR_INVALID_CREATE = 'Invalid create command format';
const ERROR_INVALID_INSERT = 'Invalid insert command format';
const MSG_NO_EDIT_HISTORY = 'No edit history';

// ============================================================================
// Regex Patterns
// ============================================================================

const PATTERN_STR_REPLACE = /str_replace\s+(\S+)\s+"([^"]+)"\s+"([^"]*)"/;
const PATTERN_CREATE = /create\s+(\S+)\s+"([^"]*)"/;
const PATTERN_INSERT = /insert\s+(\S+)\s+(\d+)\s+"([^"]*)"/;

// ============================================================================
// Numeric Constants
// ============================================================================

/** Minimum number of tokens required for view command (command + path) */
const MIN_VIEW_TOKENS = 2;

/** Expected number of parts when splitting a range string (start-end) */
const RANGE_PARTS_COUNT = 2;

/** JSON indentation spaces for pretty printing */
const JSON_INDENT_SPACES = 2;

/** Minimum valid line number for file ranges (1-indexed) */
const MIN_LINE_NUMBER = 1;

/** Base for parsing integers */
const DECIMAL_RADIX = 10;

export class Agent {
  private readonly textEditorTool: TextEditorTool;
  private readonly bashTool: BashTool;
  private readonly agentState: AgentState;

  constructor() {
    this.textEditorTool = new TextEditorTool();
    this.bashTool = new BashTool();
    this.agentState = {
      currentDirectory: process.cwd(),
      editHistory: [],
      tools: []
    };
  }

  async processCommand(input: string): Promise<ToolResult> {
    const commandInput = input.trim();

    if (commandInput.startsWith(CMD_VIEW)) {
      const viewArgs = this.parseViewCommand(commandInput);
      if (!viewArgs) {
        return { success: false, error: ERROR_VIEW_REQUIRES_PATH };
      }
      return this.textEditorTool.view(viewArgs.path, viewArgs.range);
    }

    if (commandInput.startsWith(CMD_STR_REPLACE)) {
      const replaceArgs = this.parseStrReplaceCommand(commandInput);
      if (!replaceArgs) {
        return { success: false, error: ERROR_INVALID_STR_REPLACE };
      }
      return this.textEditorTool.strReplace(replaceArgs.path, replaceArgs.oldStr, replaceArgs.newStr);
    }

    if (commandInput.startsWith(CMD_CREATE)) {
      const createArgs = this.parseCreateCommand(commandInput);
      if (!createArgs) {
        return { success: false, error: ERROR_INVALID_CREATE };
      }
      return this.textEditorTool.create(createArgs.path, createArgs.content);
    }

    if (commandInput.startsWith(CMD_INSERT)) {
      const insertArgs = this.parseInsertCommand(commandInput);
      if (!insertArgs) {
        return { success: false, error: ERROR_INVALID_INSERT };
      }
      return this.textEditorTool.insert(insertArgs.path, insertArgs.line, insertArgs.content);
    }

    if (commandInput === CMD_UNDO) {
      return this.textEditorTool.undoEdit();
    }

    if (commandInput.startsWith(CMD_BASH) || commandInput.startsWith(CMD_BASH_SHORT)) {
      const shellCommand = commandInput.startsWith(CMD_BASH)
        ? commandInput.substring(CMD_BASH.length)
        : commandInput.substring(CMD_BASH_SHORT.length);
      return this.bashTool.execute(shellCommand);
    }

    if (commandInput === CMD_PWD) {
      return {
        success: true,
        output: this.bashTool.getCurrentDirectory()
      };
    }

    if (commandInput === CMD_HISTORY) {
      const editHistory = this.textEditorTool.getEditHistory();
      return {
        success: true,
        output: editHistory.length > 0
          ? JSON.stringify(editHistory, null, JSON_INDENT_SPACES)
          : MSG_NO_EDIT_HISTORY
      };
    }

    if (commandInput === CMD_HELP) {
      return this.getHelpText();
    }

    return this.bashTool.execute(commandInput);
  }

  private parseViewCommand(input: string): { path: string; range?: [number, number] } | null {
    const tokens = input.split(' ');
    if (tokens.length < MIN_VIEW_TOKENS) {
      return null;
    }

    const filePath = tokens[1];

    if (tokens.length > MIN_VIEW_TOKENS) {
      const rangeString = tokens[2];
      if (rangeString.includes('-')) {
        const rangeParts = rangeString.split('-').map(Number);
        if (rangeParts.length === RANGE_PARTS_COUNT) {
          const [startLine, endLine] = rangeParts;
          if (!isNaN(startLine) && !isNaN(endLine) && startLine >= MIN_LINE_NUMBER && endLine >= startLine) {
            return { path: filePath, range: [startLine, endLine] };
          }
        }
      }
    }

    return { path: filePath };
  }

  private parseStrReplaceCommand(input: string): { path: string; oldStr: string; newStr: string } | null {
    const parseResult = input.match(PATTERN_STR_REPLACE);
    if (!parseResult) return null;

    return {
      path: parseResult[1],
      oldStr: parseResult[2],
      newStr: parseResult[3]
    };
  }

  private parseCreateCommand(input: string): { path: string; content: string } | null {
    const parseResult = input.match(PATTERN_CREATE);
    if (!parseResult) return null;

    return {
      path: parseResult[1],
      content: parseResult[2]
    };
  }

  private parseInsertCommand(input: string): { path: string; line: number; content: string } | null {
    const parseResult = input.match(PATTERN_INSERT);
    if (!parseResult) return null;

    return {
      path: parseResult[1],
      line: parseInt(parseResult[2], DECIMAL_RADIX),
      content: parseResult[3]
    };
  }

  private getHelpText(): ToolResult {
    return {
      success: true,
      output: `Available commands:
  view <path> [start-end]     - View file contents or directory
  str_replace <path> "old" "new" - Replace text in file
  create <path> "content"     - Create new file with content
  insert <path> <line> "text" - Insert text at specific line
  undo_edit                   - Undo last edit operation
  bash <command>              - Execute bash command
  $ <command>                 - Execute bash command (shorthand)
  pwd                         - Show current directory
  history                     - Show edit history
  help                        - Show this help message`
    };
  }

  getCurrentState(): AgentState {
    return {
      ...this.agentState,
      currentDirectory: this.bashTool.getCurrentDirectory(),
      editHistory: this.textEditorTool.getEditHistory()
    };
  }
}