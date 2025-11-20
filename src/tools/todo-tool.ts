import { ToolResult } from '../types/index.js';

interface TodoItem {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'high' | 'medium' | 'low';
}

const VALID_STATUSES = ['pending', 'in_progress', 'completed'] as const;
const VALID_PRIORITIES = ['high', 'medium', 'low'] as const;

// ANSI color codes for terminal output
const ANSI = {
  GREEN: '\x1b[32m',
  CYAN: '\x1b[36m',
  WHITE: '\x1b[37m',
  STRIKETHROUGH: '\x1b[9m',
  RESET: '\x1b[0m',
} as const;

/**
 * Validate todo status value
 */
function validateStatus(status: string): { valid: boolean; error?: string } {
  if (!VALID_STATUSES.includes(status as any)) {
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
function validatePriority(priority: string): { valid: boolean; error?: string } {
  if (!VALID_PRIORITIES.includes(priority as any)) {
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

    const getCheckbox = (status: string): string => {
      switch (status) {
        case 'completed':
          return '●';
        case 'in_progress':
          return '◐';
        case 'pending':
          return '○';
        default:
          return '○';
      }
    };

    const getStatusColor = (status: string): string => {
      switch (status) {
        case 'completed':
          return ANSI.GREEN;
        case 'in_progress':
          return ANSI.CYAN;
        case 'pending':
          return ANSI.WHITE;
        default:
          return ANSI.RESET;
      }
    };

    let output = '';

    this.todos.forEach((todo, index) => {
      const checkbox = getCheckbox(todo.status);
      const statusColor = getStatusColor(todo.status);
      const strikethrough = todo.status === 'completed' ? ANSI.STRIKETHROUGH : '';
      const indent = index === 0 ? '' : '  ';

      output += `${indent}${statusColor}${strikethrough}${checkbox} ${todo.content}${ANSI.RESET}\n`;
    });

    return output;
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
            error: statusValidation.error!
          };
        }

        const priorityValidation = validatePriority(todo.priority);
        if (!priorityValidation.valid) {
          return {
            success: false,
            error: priorityValidation.error!
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
        error: `Error creating todo list: ${error instanceof Error ? error.message : String(error)}`
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

      const updatedIds: string[] = [];

      for (const update of updates) {
        const todoIndex = this.todos.findIndex(t => t.id === update.id);
        
        if (todoIndex === -1) {
          return {
            success: false,
            error: `Todo with id ${update.id} not found`
          };
        }

        const todo = this.todos[todoIndex];

        if (update.status) {
          const statusValidation = validateStatus(update.status);
          if (!statusValidation.valid) {
            return {
              success: false,
              error: statusValidation.error!
            };
          }
        }

        if (update.priority) {
          const priorityValidation = validatePriority(update.priority);
          if (!priorityValidation.valid) {
            return {
              success: false,
              error: priorityValidation.error!
            };
          }
        }

        if (update.status) {
          todo.status = update.status as 'pending' | 'in_progress' | 'completed';
        }
        if (update.content) {
          todo.content = update.content;
        }
        if (update.priority) {
          todo.priority = update.priority as 'high' | 'medium' | 'low';
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
        error: `Error updating todo list: ${error instanceof Error ? error.message : String(error)}`
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