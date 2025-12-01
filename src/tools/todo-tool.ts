import { ToolResult } from '../types/index.js';
import { extractErrorMessage } from '../utils/error-handler.js';

interface TodoItem {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'high' | 'medium' | 'low';
}

const VALID_STATUSES = ['pending', 'in_progress', 'completed'] as const;
type TodoStatus = typeof VALID_STATUSES[number];
const VALID_PRIORITIES = ['high', 'medium', 'low'] as const;
type TodoPriority = typeof VALID_PRIORITIES[number];

// ANSI color codes for terminal output
const ANSI = {
  GREEN: '\x1b[32m',
  CYAN: '\x1b[36m',
  WHITE: '\x1b[37m',
  STRIKETHROUGH: '\x1b[9m',
  RESET: '\x1b[0m',
} as const;

/** Checkbox symbols by status (cached for performance) */
const STATUS_CHECKBOX: Record<TodoStatus, string> = {
  completed: '●',
  in_progress: '◐',
  pending: '○',
};

/** ANSI colors by status (cached for performance) */
const STATUS_COLOR: Record<TodoStatus, string> = {
  completed: ANSI.GREEN,
  in_progress: ANSI.CYAN,
  pending: ANSI.WHITE,
};

/**
 * Validate todo status value
 */
function validateStatus(status: unknown): { valid: boolean; error?: string } {
  if (typeof status !== 'string' || !VALID_STATUSES.includes(status as TodoStatus)) {
    return {
      valid: false,
      error: `Invalid status: ${status}. Must be pending, in_progress, or completed`
    };
  }
  return { valid: true };
}

/**
 * Validate todo priority value
 */
function validatePriority(priority: unknown): { valid: boolean; error?: string } {
  if (typeof priority !== 'string' || !VALID_PRIORITIES.includes(priority as TodoPriority)) {
    return {
      valid: false,
      error: `Invalid priority: ${priority}. Must be high, medium, or low`
    };
  }
  return { valid: true };
}

export class TodoTool {
  private todos: TodoItem[] = [];

  formatTodoList(): string {
    if (this.todos.length === 0) {
      return 'No todos created yet';
    }

    // Use cached maps for O(1) lookups instead of switch statements
    return this.todos.map((todo, index) => {
      const checkbox = STATUS_CHECKBOX[todo.status] || '○';
      const statusColor = STATUS_COLOR[todo.status] || ANSI.RESET;
      const strikethrough = todo.status === 'completed' ? ANSI.STRIKETHROUGH : '';
      const indent = index === 0 ? '' : '  ';
      return `${indent}${statusColor}${strikethrough}${checkbox} ${todo.content}${ANSI.RESET}`;
    }).join('\n') + '\n';
  }

  async createTodoList(todos: TodoItem[]): Promise<ToolResult> {
    try {
      // Validate todos is an array
      if (!Array.isArray(todos)) {
        return {
          success: false,
          error: 'todos must be an array'
        };
      }

      // Validate todos
      for (const todo of todos) {
        if (!todo.id || !todo.content || !todo.status || !todo.priority) {
          return {
            success: false,
            error: 'Each todo must have id, content, status, and priority fields'
          };
        }

        const statusValidation = validateStatus(todo.status);
        if (!statusValidation.valid) {
          return {
            success: false,
            error: statusValidation.error || 'Invalid status'
          };
        }

        const priorityValidation = validatePriority(todo.priority);
        if (!priorityValidation.valid) {
          return {
            success: false,
            error: priorityValidation.error || 'Invalid priority'
          };
        }
      }

      this.todos = todos;
      
      return {
        success: true,
        output: this.formatTodoList()
      };
    } catch (error) {
      return {
        success: false,
        error: `Error creating todo list: ${extractErrorMessage(error)}`
      };
    }
  }

  async updateTodoList(updates: { id: string; status?: string; content?: string; priority?: string }[]): Promise<ToolResult> {
    try {
      // Validate updates is an array
      if (!Array.isArray(updates)) {
        return {
          success: false,
          error: 'updates must be an array'
        };
      }

      // BUG FIX: Validate each update has required 'id' field before processing
      // LLM may send malformed tool calls with missing or undefined id
      for (let i = 0; i < updates.length; i++) {
        const update = updates[i];
        if (!update || typeof update.id !== 'string' || update.id.trim() === '') {
          return {
            success: false,
            error: `Update at index ${i} is missing required 'id' field. Each update must have a valid string id.`
          };
        }
      }

      const updatedIds: string[] = [];

      for (const update of updates) {
        const todoIndex = this.todos.findIndex(t => t.id === update.id);

        if (todoIndex === -1) {
          return {
            success: false,
            error: `Todo with id "${update.id}" not found. Available ids: ${this.todos.map(t => t.id).join(', ') || 'none (create todos first)'}`
          };
        }

        const todo = this.todos[todoIndex];

        if (update.status) {
          const statusValidation = validateStatus(update.status);
          if (!statusValidation.valid) {
            return {
              success: false,
              error: statusValidation.error || 'Invalid status'
            };
          }
        }

        if (update.priority) {
          const priorityValidation = validatePriority(update.priority);
          if (!priorityValidation.valid) {
            return {
              success: false,
              error: priorityValidation.error || 'Invalid priority'
            };
          }
        }

        if (update.status) {
          todo.status = update.status as TodoStatus;
        }
        if (update.content) {
          todo.content = update.content;
        }
        if (update.priority) {
          todo.priority = update.priority as TodoPriority;
        }

        updatedIds.push(update.id);
      }

      return {
        success: true,
        output: this.formatTodoList()
      };
    } catch (error) {
      return {
        success: false,
        error: `Error updating todo list: ${extractErrorMessage(error)}`
      };
    }
  }

  async viewTodoList(): Promise<ToolResult> {
    return {
      success: true,
      output: this.formatTodoList()
    };
  }
}
