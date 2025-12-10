/**
 * Test helpers for memory tests
 * Generates realistic test projects with substantial code
 */

import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Generate a large realistic codebase that produces ~80k tokens
 * This creates a project structure similar to a real application
 */
export async function createLargeTestProject(testDir: string): Promise<void> {
  // Create directory structure
  await fs.mkdir(path.join(testDir, 'src', 'components'), { recursive: true });
  await fs.mkdir(path.join(testDir, 'src', 'utils'), { recursive: true });
  await fs.mkdir(path.join(testDir, 'src', 'services'), { recursive: true });
  await fs.mkdir(path.join(testDir, 'src', 'hooks'), { recursive: true });
  await fs.mkdir(path.join(testDir, 'src', 'types'), { recursive: true });
  await fs.mkdir(path.join(testDir, 'src', 'contexts'), { recursive: true });
  await fs.mkdir(path.join(testDir, 'src', 'lib'), { recursive: true });
  await fs.mkdir(path.join(testDir, 'src', 'agent'), { recursive: true });
  await fs.mkdir(path.join(testDir, 'packages', 'schemas'), { recursive: true });
  await fs.mkdir(path.join(testDir, 'tests', 'unit'), { recursive: true });
  await fs.mkdir(path.join(testDir, 'tests', 'integration'), { recursive: true });
  await fs.mkdir(path.join(testDir, 'docs'), { recursive: true });

  // Create package.json
  await fs.writeFile(
    path.join(testDir, 'package.json'),
    JSON.stringify({
      name: 'test-project',
      version: '1.0.0',
      description: 'A comprehensive test project for context generation',
      main: 'dist/index.js',
      scripts: {
        build: 'tsc',
        test: 'vitest',
        lint: 'eslint src',
        format: 'prettier --write src'
      },
      dependencies: {
        react: '^18.0.0',
        typescript: '^5.0.0',
        zod: '^3.0.0',
        'react-dom': '^18.0.0',
        axios: '^1.0.0',
        '@types/react': '^18.0.0',
        '@types/node': '^20.0.0'
      },
      devDependencies: {
        vitest: '^1.0.0',
        eslint: '^8.0.0',
        prettier: '^3.0.0',
        '@typescript-eslint/eslint-plugin': '^6.0.0',
        '@typescript-eslint/parser': '^6.0.0'
      }
    }, null, 2)
  );

  // Create comprehensive README
  const readmeContent = `# Test Project

## Overview
This is a comprehensive test project designed to generate substantial context for testing.

## Architecture
- **Frontend**: React with TypeScript
- **State Management**: Context API with hooks
- **Validation**: Zod schemas
- **API Layer**: Axios-based service layer
- **Testing**: Vitest with React Testing Library

## Project Structure
\`\`\`
src/
├── components/     - React components
├── hooks/          - Custom React hooks
├── services/       - API service layer
├── utils/          - Utility functions
├── types/          - TypeScript type definitions
├── contexts/       - React contexts
├── lib/            - Third-party integrations
└── agent/          - AI agent implementation
\`\`\`

## Features
- User authentication and authorization
- Real-time data synchronization
- Form validation with Zod
- Error handling and logging
- Performance monitoring
- Accessibility compliance
- Internationalization support
- Dark mode theming

## Getting Started
1. Install dependencies: \`npm install\`
2. Run tests: \`npm test\`
3. Build: \`npm run build\`
4. Start dev server: \`npm run dev\`

## Testing
We use Vitest for unit and integration tests. Run \`npm test\` to execute all tests.

## Contributing
Please read CONTRIBUTING.md for details on our code of conduct and the process for submitting pull requests.

## License
MIT License - see LICENSE file for details
`;
  await fs.writeFile(path.join(testDir, 'README.md'), readmeContent);

  // Create tsconfig.json
  await fs.writeFile(
    path.join(testDir, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        module: 'ESNext',
        lib: ['ES2022', 'DOM', 'DOM.Iterable'],
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        declaration: true,
        declarationMap: true,
        sourceMap: true,
        resolveJsonModule: true,
        jsx: 'react-jsx',
        moduleResolution: 'Bundler',
        allowSyntheticDefaultImports: true,
        noImplicitAny: true,
        strictNullChecks: true,
        noImplicitThis: true,
        alwaysStrict: true,
        noUnusedLocals: true,
        noUnusedParameters: true,
        noImplicitReturns: true,
        noFallthroughCasesInSwitch: true,
        outDir: './dist',
        rootDir: './src',
        baseUrl: '.',
        paths: {
          '@/*': ['src/*']
        }
      },
      include: ['src/**/*'],
      exclude: ['node_modules', 'dist', 'tests']
    }, null, 2)
  );

  // Generate multiple large component files
  for (let i = 1; i <= 10; i++) {
    const componentContent = generateLargeComponent(i);
    await fs.writeFile(
      path.join(testDir, 'src', 'components', `Component${i}.tsx`),
      componentContent
    );
  }

  // Generate service files
  for (let i = 1; i <= 5; i++) {
    const serviceContent = generateServiceFile(i);
    await fs.writeFile(
      path.join(testDir, 'src', 'services', `service${i}.ts`),
      serviceContent
    );
  }

  // Generate utility files
  for (let i = 1; i <= 8; i++) {
    const utilContent = generateUtilityFile(i);
    await fs.writeFile(
      path.join(testDir, 'src', 'utils', `util${i}.ts`),
      utilContent
    );
  }

  // Generate hook files
  for (let i = 1; i <= 5; i++) {
    const hookContent = generateHookFile(i);
    await fs.writeFile(
      path.join(testDir, 'src', 'hooks', `useHook${i}.ts`),
      hookContent
    );
  }

  // Generate type definition files
  const typesContent = generateTypesFile();
  await fs.writeFile(path.join(testDir, 'src', 'types', 'index.ts'), typesContent);

  // Generate agent files
  const agentContent = generateAgentFile();
  await fs.writeFile(path.join(testDir, 'src', 'agent', 'llm-agent.ts'), agentContent);

  // Generate test files
  for (let i = 1; i <= 5; i++) {
    const testContent = generateTestFile(i);
    await fs.writeFile(
      path.join(testDir, 'tests', 'unit', `test${i}.test.ts`),
      testContent
    );
  }
}

function generateLargeComponent(index: number): string {
  return `import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { z } from 'zod';
import { useForm } from '../hooks/useForm';
import { apiService } from '../services/api';
import type { User, FormData, ValidationError } from '../types';

interface Component${index}Props {
  userId: string;
  onSuccess?: (data: FormData) => void;
  onError?: (error: Error) => void;
  initialData?: Partial<FormData>;
  mode?: 'create' | 'edit';
  disabled?: boolean;
}

const formSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().optional(),
  email: z.string().email(),
  age: z.number().min(18).max(100),
  tags: z.array(z.string()),
  preferences: z.object({
    theme: z.enum(['light', 'dark']),
    language: z.string(),
    notifications: z.boolean(),
  }),
});

type FormValues = z.infer<typeof formSchema>;

/**
 * Component${index} - A comprehensive form component with validation
 *
 * Features:
 * - Form validation using Zod
 * - Real-time field validation
 * - Error handling
 * - Loading states
 * - Optimistic updates
 * - Accessibility support
 *
 * @param props - Component props
 * @returns React component
 */
export const Component${index}: React.FC<Component${index}Props> = ({
  userId,
  onSuccess,
  onError,
  initialData,
  mode = 'create',
  disabled = false,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [successMessage, setSuccessMessage] = useState<string>('');

  const {
    values,
    handleChange,
    handleSubmit,
    reset,
    isValid,
  } = useForm<FormValues>({
    initialValues: initialData as FormValues,
    validationSchema: formSchema,
    onSubmit: async (data) => {
      setIsLoading(true);
      setErrors([]);

      try {
        const result = mode === 'create'
          ? await apiService.create(data)
          : await apiService.update(userId, data);

        setSuccessMessage('Operation completed successfully');
        onSuccess?.(result);

        if (mode === 'create') {
          reset();
        }
      } catch (error) {
        const err = error as Error;
        setErrors([{ field: 'general', message: err.message }]);
        onError?.(err);
      } finally {
        setIsLoading(false);
      }
    },
  });

  const handleReset = useCallback(() => {
    reset();
    setErrors([]);
    setSuccessMessage('');
  }, [reset]);

  const fieldErrors = useMemo(() => {
    return errors.reduce((acc, err) => {
      acc[err.field] = err.message;
      return acc;
    }, {} as Record<string, string>);
  }, [errors]);

  useEffect(() => {
    // Auto-clear success message after 5 seconds
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  return (
    <div className="component-${index}" data-testid="component-${index}">
      <h2>{mode === 'create' ? 'Create New Entry' : 'Edit Entry'}</h2>

      {successMessage && (
        <div className="alert alert-success" role="alert">
          {successMessage}
        </div>
      )}

      {fieldErrors.general && (
        <div className="alert alert-error" role="alert">
          {fieldErrors.general}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="title">Title</label>
          <input
            id="title"
            name="title"
            type="text"
            value={values.title || ''}
            onChange={handleChange}
            disabled={disabled || isLoading}
            aria-invalid={!!fieldErrors.title}
            aria-describedby={fieldErrors.title ? 'title-error' : undefined}
          />
          {fieldErrors.title && (
            <span id="title-error" className="error">{fieldErrors.title}</span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            name="description"
            value={values.description || ''}
            onChange={handleChange}
            disabled={disabled || isLoading}
            rows={4}
          />
        </div>

        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            value={values.email || ''}
            onChange={handleChange}
            disabled={disabled || isLoading}
            aria-invalid={!!fieldErrors.email}
            aria-describedby={fieldErrors.email ? 'email-error' : undefined}
          />
          {fieldErrors.email && (
            <span id="email-error" className="error">{fieldErrors.email}</span>
          )}
        </div>

        <div className="form-actions">
          <button
            type="submit"
            disabled={disabled || isLoading || !isValid}
            className="btn btn-primary"
          >
            {isLoading ? 'Saving...' : mode === 'create' ? 'Create' : 'Update'}
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={disabled || isLoading}
            className="btn btn-secondary"
          >
            Reset
          </button>
        </div>
      </form>
    </div>
  );
};

export default Component${index};
`;
}

function generateServiceFile(index: number): string {
  return `import axios, { AxiosInstance, AxiosError } from 'axios';
import type { ApiResponse, RequestConfig, ErrorResponse } from '../types';

/**
 * Service${index} - API service layer for handling HTTP requests
 *
 * Provides a clean interface for making API calls with:
 * - Automatic retry logic
 * - Error handling
 * - Request/response interceptors
 * - Type safety
 */
export class Service${index} {
  private client: AxiosInstance;
  private retryCount: number = 3;
  private retryDelay: number = 1000;

  constructor(baseURL: string, timeout: number = 30000) {
    this.client = axios.create({
      baseURL,
      timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('auth_token');
        if (token) {
          config.headers.Authorization = \`Bearer \${token}\`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError<ErrorResponse>) => {
        if (error.response?.status === 401) {
          // Handle unauthorized
          localStorage.removeItem('auth_token');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  async get<T>(url: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.get<T>(url, config);
      return {
        data: response.data,
        status: response.status,
        headers: response.headers,
      };
    } catch (error) {
      throw this.handleError(error as AxiosError);
    }
  }

  async post<T>(url: string, data?: any, config?: RequestConfig): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.post<T>(url, data, config);
      return {
        data: response.data,
        status: response.status,
        headers: response.headers,
      };
    } catch (error) {
      throw this.handleError(error as AxiosError);
    }
  }

  async put<T>(url: string, data?: any, config?: RequestConfig): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.put<T>(url, data, config);
      return {
        data: response.data,
        status: response.status,
        headers: response.headers,
      };
    } catch (error) {
      throw this.handleError(error as AxiosError);
    }
  }

  async delete<T>(url: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.delete<T>(url, config);
      return {
        data: response.data,
        status: response.status,
        headers: response.headers,
      };
    } catch (error) {
      throw this.handleError(error as AxiosError);
    }
  }

  private handleError(error: AxiosError<ErrorResponse>): Error {
    if (error.response) {
      const message = error.response.data?.message || 'An error occurred';
      return new Error(\`API Error: \${message}\`);
    } else if (error.request) {
      return new Error('Network error: No response received');
    } else {
      return new Error(\`Request error: \${error.message}\`);
    }
  }
}

export const service${index} = new Service${index}(
  process.env.API_URL || 'https://api.example.com',
  30000
);
`;
}

function generateUtilityFile(index: number): string {
  return `/**
 * Utility${index} - Collection of utility functions
 */

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export function isEqual(a: any, b: any): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export const util${index} = {
  formatDate,
  debounce,
  throttle,
  deepClone,
  isEqual,
};
`;
}

function generateHookFile(index: number): string {
  return `import { useState, useEffect, useCallback } from 'react';

/**
 * useHook${index} - Custom React hook
 */
export function useHook${index}<T>(initialValue: T) {
  const [value, setValue] = useState<T>(initialValue);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const update = useCallback((newValue: T) => {
    setLoading(true);
    try {
      setValue(newValue);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setValue(initialValue);
    setError(null);
  }, [initialValue]);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      setError(null);
    };
  }, []);

  return {
    value,
    loading,
    error,
    update,
    reset,
  };
}
`;
}

function generateTypesFile(): string {
  return `/**
 * Type definitions for the application
 */

export interface User {
  id: string;
  email: string;
  name: string;
  age: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface FormData {
  title: string;
  description?: string;
  email: string;
  age: number;
  tags: string[];
  preferences: Preferences;
}

export interface Preferences {
  theme: 'light' | 'dark';
  language: string;
  notifications: boolean;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface ApiResponse<T> {
  data: T;
  status: number;
  headers: Record<string, string>;
}

export interface RequestConfig {
  headers?: Record<string, string>;
  params?: Record<string, any>;
  timeout?: number;
}

export interface ErrorResponse {
  message: string;
  code: string;
  details?: any;
}
`;
}

function generateAgentFile(): string {
  return `/**
 * LLM Agent implementation
 */

import { EventEmitter } from 'events';

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AgentConfig {
  model: string;
  maxTokens: number;
  temperature: number;
}

export class LLMAgent extends EventEmitter {
  private config: AgentConfig;
  private messages: Message[] = [];

  constructor(config: AgentConfig) {
    super();
    this.config = config;
  }

  async chat(message: string): Promise<string> {
    this.messages.push({
      role: 'user',
      content: message,
    });

    const response = await this.generateResponse();

    this.messages.push({
      role: 'assistant',
      content: response,
    });

    return response;
  }

  private async generateResponse(): Promise<string> {
    // Simulate AI response
    return 'This is a simulated response';
  }

  getHistory(): Message[] {
    return [...this.messages];
  }

  clear(): void {
    this.messages = [];
  }

  /**
   * Clean up resources and remove all event listeners.
   */
  destroy(): void {
    this.removeAllListeners();
  }

  /**
   * Clean up resources and remove all event listeners.
   */
  destroy(): void {
    this.removeAllListeners();
  }

  /**
   * Clean up resources and remove all event listeners.
   */
  destroy(): void {
    this.removeAllListeners();
  }

  /**
   * Clean up resources and remove all event listeners.
   */
  destroy(): void {
    this.removeAllListeners();
  }
}
`;
}

function generateTestFile(index: number): string {
  return `import { describe, it, expect } from 'vitest';
import { Component${index} } from '../../packages/core/src/components/Component${index}';

describe('Component${index}', () => {
  it('should render correctly', () => {
    expect(Component${index}).toBeDefined();
  });

  it('should handle form submission', async () => {
    // Test implementation
  });

  it('should validate form fields', () => {
    // Test implementation
  });
});
`;
}

/**
 * Cleanup test project
 */
export async function cleanupTestProject(testDir: string): Promise<void> {
  const fs = await import('fs/promises');
  try {
    await fs.rm(testDir, { recursive: true, force: true });
  } catch (error) {
    // Ignore errors if directory doesn't exist
  }
}
