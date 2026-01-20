/**
 * Tool Handlers Registry
 *
 * Replaces the large switch statement with a registry pattern.
 * Each tool has its own handler function for better separation of concerns.
 *
 * @packageDocumentation
 */

import type { ToolResult } from "../../types/index.js";
import type {
  TextEditorTool,
  BashTool,
  TodoTool,
  SearchTool,
} from "../../tools/index.js";
import type { BashOutputTool } from "../../tools/bash-output.js";
import { getAskUserService, type Question } from "../../tools/ask-user.js";
import { executeAxAgent, executeAxAgentsParallel, type AxAgentOptions, type AxAgentsParallelOptions } from "../../tools/ax-agent.js";
import {
  getStringArg,
  getNumberArg,
  getBooleanArg,
  isString,
  isObject,
  isArray,
} from "../../utils/index.js";

/**
 * Context passed to tool handlers
 */
export interface ToolHandlerContext {
  args: Record<string, unknown>;
  textEditor: TextEditorTool;
  bash: BashTool;
  bashOutput: BashOutputTool;
  todoTool: TodoTool;
  search: SearchTool;
  abortSignal?: AbortSignal;
  onAxAgentStart?: (name: string) => void;
  onAxAgentEnd?: (name: string) => void;
}

/**
 * Tool handler function type
 */
export type ToolHandler = (ctx: ToolHandlerContext) => Promise<ToolResult>;

/**
 * Helper functions for argument extraction
 */
const createArgHelpers = (args: Record<string, unknown>) => ({
  getString: (key: string, required = true): string => {
    const value = getStringArg(args, key);
    if (required && !value) {
      throw new Error(`Tool argument '${key}' must be a string`);
    }
    return value;
  },
  getNumber: (key: string) => getNumberArg(args, key),
  getBoolean: (key: string) => getBooleanArg(args, key),
});

/**
 * View file handler
 */
const viewFileHandler: ToolHandler = async (ctx) => {
  const { getString, getNumber } = createArgHelpers(ctx.args);
  const startLine = getNumber('start_line');
  const endLine = getNumber('end_line');
  const range: [number, number] | undefined =
    startLine !== undefined && endLine !== undefined
      ? [startLine, endLine]
      : undefined;
  return ctx.textEditor.view(getString('path'), range);
};

/**
 * Create file handler
 */
const createFileHandler: ToolHandler = async (ctx) => {
  const { getString } = createArgHelpers(ctx.args);
  return ctx.textEditor.create(getString('path'), getString('content'));
};

/**
 * String replace editor handler
 */
const strReplaceHandler: ToolHandler = async (ctx) => {
  const { getString, getBoolean } = createArgHelpers(ctx.args);
  return ctx.textEditor.strReplace(
    getString('path'),
    getString('old_str'),
    getString('new_str'),
    getBoolean('replace_all') ?? false
  );
};

/**
 * Multi-edit handler
 */
const multiEditHandler: ToolHandler = async (ctx) => {
  const { getString } = createArgHelpers(ctx.args);
  const edits = isArray(ctx.args.edits)
    ? (ctx.args.edits as { old_str: string; new_str: string }[])
    : [];
  return ctx.textEditor.multiEdit(getString('path'), edits);
};

/**
 * Bash command handler
 */
const bashHandler: ToolHandler = async (ctx) => {
  const { getString, getBoolean, getNumber } = createArgHelpers(ctx.args);
  return ctx.bash.execute(getString('command'), {
    background: getBoolean('background'),
    timeout: getNumber('timeout'),
    signal: ctx.abortSignal,
    killOnAbort: true,
  });
};

/**
 * Bash output handler
 */
const bashOutputHandler: ToolHandler = async (ctx) => {
  const { getString, getBoolean, getNumber } = createArgHelpers(ctx.args);
  return ctx.bashOutput.execute(
    getString('task_id'),
    getBoolean('wait'),
    getNumber('timeout')
  );
};

/**
 * Todo item type (matches TodoTool requirements)
 */
interface TodoItem {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'high' | 'medium' | 'low';
}

/**
 * Todo update type
 */
interface TodoUpdate {
  id: string;
  status?: string;
  content?: string;
  priority?: string;
}

/**
 * Create todo list handler
 */
const createTodoHandler: ToolHandler = async (ctx) => {
  const todos = isArray(ctx.args.todos)
    ? (ctx.args.todos as TodoItem[])
    : [];
  return ctx.todoTool.createTodoList(todos);
};

/**
 * Update todo list handler
 */
const updateTodoHandler: ToolHandler = async (ctx) => {
  const updates = isArray(ctx.args.updates)
    ? (ctx.args.updates as TodoUpdate[])
    : [];
  return ctx.todoTool.updateTodoList(updates);
};

/**
 * Search handler
 */
const searchHandler: ToolHandler = async (ctx) => {
  const { getString, getBoolean, getNumber } = createArgHelpers(ctx.args);
  const { args } = ctx;

  const searchTypeValue = args.search_type;
  const validSearchType = (searchTypeValue === 'text' || searchTypeValue === 'files' || searchTypeValue === 'both')
    ? searchTypeValue
    : undefined;

  // Validate that file_types array contains only strings
  const fileTypes = isArray(args.file_types)
    ? (args.file_types as unknown[]).filter((ft): ft is string => isString(ft))
    : undefined;

  return ctx.search.search(getString('query'), {
    searchType: validSearchType,
    includePattern: isString(args.include_pattern) ? args.include_pattern : undefined,
    excludePattern: isString(args.exclude_pattern) ? args.exclude_pattern : undefined,
    caseSensitive: getBoolean('case_sensitive'),
    wholeWord: getBoolean('whole_word'),
    regex: getBoolean('regex'),
    maxResults: getNumber('max_results'),
    fileTypes: fileTypes && fileTypes.length > 0 ? fileTypes : undefined,
    includeHidden: getBoolean('include_hidden'),
  });
};

/**
 * Ask user handler
 */
const askUserHandler: ToolHandler = async (ctx) => {
  const validQuestions = validateAskUserQuestions(ctx.args.questions);
  if (!validQuestions) {
    return {
      success: false,
      error: "ask_user requires a 'questions' array with valid questions (each needs question string, 2+ options with labels)",
    };
  }

  const askUserService = getAskUserService();
  return askUserService.askQuestions(validQuestions);
};

/**
 * AX Agent handler
 */
const axAgentHandler: ToolHandler = async (ctx) => {
  const { getString } = createArgHelpers(ctx.args);
  const { args, onAxAgentStart, onAxAgentEnd } = ctx;

  const agent = getString('agent');
  const task = getString('task');
  const formatValue = args.format;
  const validFormat = (formatValue === 'text' || formatValue === 'markdown') ? formatValue : 'markdown';
  const save = isString(args.save) ? args.save : undefined;

  const options: AxAgentOptions = { agent, task, format: validFormat, save };

  onAxAgentStart?.(agent);
  try {
    return await executeAxAgent(options);
  } finally {
    onAxAgentEnd?.(agent);
  }
};

/**
 * AX Agents Parallel handler
 */
const axAgentsParallelHandler: ToolHandler = async (ctx) => {
  const { onAxAgentStart, onAxAgentEnd } = ctx;

  const validation = validateAgentsArray(ctx.args.agents);
  if ('error' in validation) {
    return { success: false, error: validation.error };
  }

  const { agents } = validation;
  const agentNames = agents.map(a => a.agent).join(', ');

  onAxAgentStart?.(`parallel: ${agentNames}`);
  try {
    return await executeAxAgentsParallel({ agents });
  } finally {
    onAxAgentEnd?.(`parallel: ${agentNames}`);
  }
};

/**
 * Validate ask_user questions array
 */
function validateAskUserQuestions(questions: unknown): Question[] | null {
  if (!isArray(questions)) return null;

  const validQuestions: Question[] = [];

  for (const q of questions) {
    if (!isObject(q)) continue;
    if (!isString(q.question) || !isArray(q.options)) continue;

    const validOptions = (q.options as unknown[])
      .filter((opt): opt is { label: string; description?: string } =>
        isObject(opt) && isString((opt as Record<string, unknown>).label)
      )
      .map(opt => ({
        label: opt.label,
        description: isString(opt.description) ? opt.description : undefined,
      }));

    if (validOptions.length < 2) continue;

    validQuestions.push({
      question: q.question as string,
      header: isString(q.header) ? q.header : undefined,
      options: validOptions,
      multiSelect: q.multiSelect === true,
    });
  }

  return validQuestions.length > 0 ? validQuestions : null;
}

/**
 * Validate agents array for parallel execution
 */
function validateAgentsArray(agentsArg: unknown): { agents: AxAgentsParallelOptions['agents'] } | { error: string } {
  if (!isArray(agentsArg) || agentsArg.length === 0) {
    return { error: "agents parameter must be a non-empty array of {agent, task} objects" };
  }

  const agents: AxAgentsParallelOptions['agents'] = [];

  for (const item of agentsArg) {
    if (!isObject(item)) {
      return { error: "Each agent entry must be an object with agent and task properties" };
    }

    if (!isString(item.agent) || !isString(item.task)) {
      return { error: "Each agent entry must have string 'agent' and 'task' properties" };
    }

    const formatValue = item.format;
    const validFormat = (formatValue === 'text' || formatValue === 'markdown') ? formatValue : undefined;

    agents.push({
      agent: item.agent,
      task: item.task,
      format: validFormat,
      save: isString(item.save) ? item.save : undefined,
    });
  }

  return { agents };
}

/**
 * Tool handler registry - maps tool names to their handlers
 */
export const TOOL_HANDLERS: ReadonlyMap<string, ToolHandler> = new Map([
  ['view_file', viewFileHandler],
  ['create_file', createFileHandler],
  ['str_replace_editor', strReplaceHandler],
  ['multi_edit', multiEditHandler],
  ['bash', bashHandler],
  ['bash_output', bashOutputHandler],
  ['create_todo_list', createTodoHandler],
  ['update_todo_list', updateTodoHandler],
  ['search', searchHandler],
  ['ask_user', askUserHandler],
  ['ax_agent', axAgentHandler],
  ['ax_agents_parallel', axAgentsParallelHandler],
]);

/**
 * Get a tool handler by name
 */
export function getToolHandler(toolName: string): ToolHandler | undefined {
  return TOOL_HANDLERS.get(toolName);
}

/**
 * Check if a tool has a registered handler
 */
export function hasToolHandler(toolName: string): boolean {
  return TOOL_HANDLERS.has(toolName);
}
