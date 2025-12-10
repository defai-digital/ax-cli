/**
 * Tests for AskUserService
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  AskUserService,
  getAskUserService,
  AskUserTool,
  getAskUserTool,
  type Question,
  type QuestionRequest,
} from '../../packages/core/src/tools/ask-user.js';

describe('AskUserService', () => {
  let service: AskUserService;

  beforeEach(() => {
    // Reset singleton for each test
    // @ts-expect-error - accessing private static for testing
    AskUserService.instance = undefined;
    service = getAskUserService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('askQuestions', () => {
    it('should return error for empty questions array', async () => {
      const result = await service.askQuestions([]);
      expect(result.success).toBe(false);
      expect(result.error).toBe('No questions provided');
    });

    it('should return error for questions without question text', async () => {
      const questions = [
        {
          question: '',
          options: [{ label: 'A' }, { label: 'B' }],
        },
      ] as Question[];

      const result = await service.askQuestions(questions);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Each question must have a 'question' string");
    });

    it('should return error for questions with less than 2 options', async () => {
      const questions: Question[] = [
        {
          question: 'Test question?',
          options: [{ label: 'Only one' }],
        },
      ];

      const result = await service.askQuestions(questions);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Each question must have at least 2 options');
    });

    it('should fallback to defaults in non-TTY mode', async () => {
      // Mock process.stdin.isTTY as false
      const originalIsTTY = process.stdin.isTTY;
      Object.defineProperty(process.stdin, 'isTTY', { value: false, writable: true });

      const questions: Question[] = [
        {
          question: 'Which framework?',
          options: [{ label: 'React' }, { label: 'Vue' }, { label: 'Angular' }],
        },
      ];

      const result = await service.askQuestions(questions);
      expect(result.success).toBe(true);
      expect(result.output).toContain('Non-interactive mode detected');
      expect(result.output).toContain('React');

      // Restore original value
      Object.defineProperty(process.stdin, 'isTTY', { value: originalIsTTY, writable: true });
    });

    it('should emit question-requested event when TTY is available', async () => {
      // Mock process.stdin.isTTY as true
      const originalIsTTY = process.stdin.isTTY;
      Object.defineProperty(process.stdin, 'isTTY', { value: true, writable: true });

      const questions: Question[] = [
        {
          question: 'Which framework?',
          header: 'Framework',
          options: [{ label: 'React' }, { label: 'Vue' }],
        },
      ];

      let emittedRequest: QuestionRequest | null = null;
      service.on('question-requested', (request: QuestionRequest) => {
        emittedRequest = request;
      });

      // Start asking questions (this will hang waiting for user input)
      const promise = service.askQuestions(questions);

      // Wait for event to be emitted
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(emittedRequest).not.toBeNull();
      expect(emittedRequest?.questions).toEqual(questions);
      expect(emittedRequest?.currentQuestionIndex).toBe(0);

      // Submit an answer to resolve the promise
      service.submitAnswer(['React']);

      const result = await promise;
      expect(result.success).toBe(true);
      expect(result.output).toContain('React');

      // Restore original value
      Object.defineProperty(process.stdin, 'isTTY', { value: originalIsTTY, writable: true });
    });

    it('should handle multi-question flow', async () => {
      // Mock process.stdin.isTTY as true
      const originalIsTTY = process.stdin.isTTY;
      Object.defineProperty(process.stdin, 'isTTY', { value: true, writable: true });

      const questions: Question[] = [
        {
          question: 'Which framework?',
          options: [{ label: 'React' }, { label: 'Vue' }],
        },
        {
          question: 'Which database?',
          options: [{ label: 'PostgreSQL' }, { label: 'MySQL' }],
        },
      ];

      let questionCount = 0;
      service.on('question-requested', () => {
        questionCount++;
        // Submit answers for each question
        if (questionCount === 1) {
          setTimeout(() => service.submitAnswer(['React']), 10);
        } else if (questionCount === 2) {
          setTimeout(() => service.submitAnswer(['PostgreSQL']), 10);
        }
      });

      const result = await service.askQuestions(questions);

      expect(result.success).toBe(true);
      expect(result.output).toContain('React');
      expect(result.output).toContain('PostgreSQL');
      expect(questionCount).toBe(2);

      // Restore original value
      Object.defineProperty(process.stdin, 'isTTY', { value: originalIsTTY, writable: true });
    });

    it('should handle cancellation', async () => {
      // Mock process.stdin.isTTY as true
      const originalIsTTY = process.stdin.isTTY;
      Object.defineProperty(process.stdin, 'isTTY', { value: true, writable: true });

      const questions: Question[] = [
        {
          question: 'Which framework?',
          options: [{ label: 'React' }, { label: 'Vue' }],
        },
      ];

      service.on('question-requested', () => {
        setTimeout(() => service.cancelQuestions('User cancelled'), 10);
      });

      const result = await service.askQuestions(questions);

      expect(result.success).toBe(false);
      expect(result.error).toContain('User cancelled');

      // Restore original value
      Object.defineProperty(process.stdin, 'isTTY', { value: originalIsTTY, writable: true });
    });

    it('should handle custom input', async () => {
      // Mock process.stdin.isTTY as true
      const originalIsTTY = process.stdin.isTTY;
      Object.defineProperty(process.stdin, 'isTTY', { value: true, writable: true });

      const questions: Question[] = [
        {
          question: 'Which framework?',
          options: [{ label: 'React' }, { label: 'Vue' }],
        },
      ];

      service.on('question-requested', () => {
        setTimeout(() => service.submitAnswer([], 'Custom Framework'), 10);
      });

      const result = await service.askQuestions(questions);

      expect(result.success).toBe(true);
      expect(result.output).toContain('Custom Framework');

      // Restore original value
      Object.defineProperty(process.stdin, 'isTTY', { value: originalIsTTY, writable: true });
    });

    it('should prevent concurrent question dialogs', async () => {
      // Mock process.stdin.isTTY as true
      const originalIsTTY = process.stdin.isTTY;
      Object.defineProperty(process.stdin, 'isTTY', { value: true, writable: true });

      const questions: Question[] = [
        {
          question: 'Which framework?',
          options: [{ label: 'React' }, { label: 'Vue' }],
        },
      ];

      // Start first question (don't await)
      const firstPromise = service.askQuestions(questions);

      // Wait for event to be emitted
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Try to start second question (should fail)
      const result2 = await service.askQuestions(questions);
      expect(result2.success).toBe(false);
      expect(result2.error).toContain('pending');

      // Clean up first promise
      service.cancelQuestions('Cleanup');
      await firstPromise;

      // Restore original value
      Object.defineProperty(process.stdin, 'isTTY', { value: originalIsTTY, writable: true });
    });
  });

  describe('getProgress', () => {
    it('should return correct progress', async () => {
      // Mock process.stdin.isTTY as true
      const originalIsTTY = process.stdin.isTTY;
      Object.defineProperty(process.stdin, 'isTTY', { value: true, writable: true });

      const questions: Question[] = [
        { question: 'Q1?', options: [{ label: 'A' }, { label: 'B' }] },
        { question: 'Q2?', options: [{ label: 'C' }, { label: 'D' }] },
        { question: 'Q3?', options: [{ label: 'E' }, { label: 'F' }] },
      ];

      let progressChecked = false;
      service.on('question-requested', () => {
        if (!progressChecked) {
          const progress = service.getProgress();
          expect(progress.current).toBe(1);
          expect(progress.total).toBe(3);
          progressChecked = true;
        }
        setTimeout(() => service.submitAnswer(['A']), 5);
      });

      await service.askQuestions(questions);

      // Restore original value
      Object.defineProperty(process.stdin, 'isTTY', { value: originalIsTTY, writable: true });
    });
  });

  describe('isPending', () => {
    it('should return true when questions are pending', async () => {
      // Mock process.stdin.isTTY as true
      const originalIsTTY = process.stdin.isTTY;
      Object.defineProperty(process.stdin, 'isTTY', { value: true, writable: true });

      const questions: Question[] = [
        { question: 'Q1?', options: [{ label: 'A' }, { label: 'B' }] },
      ];

      expect(service.isPending()).toBe(false);

      const promise = service.askQuestions(questions);

      // Wait for event to be emitted
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(service.isPending()).toBe(true);

      service.submitAnswer(['A']);
      await promise;

      expect(service.isPending()).toBe(false);

      // Restore original value
      Object.defineProperty(process.stdin, 'isTTY', { value: originalIsTTY, writable: true });
    });
  });
});

describe('AskUserTool (legacy API)', () => {
  it('should execute through the service', async () => {
    // Mock process.stdin.isTTY as false for deterministic test
    const originalIsTTY = process.stdin.isTTY;
    Object.defineProperty(process.stdin, 'isTTY', { value: false, writable: true });

    const tool = getAskUserTool();
    const questions: Question[] = [
      {
        question: 'Which framework?',
        options: [{ label: 'React' }, { label: 'Vue' }],
      },
    ];

    const result = await tool.execute(questions);
    expect(result.success).toBe(true);
    expect(result.output).toContain('React');

    // Restore original value
    Object.defineProperty(process.stdin, 'isTTY', { value: originalIsTTY, writable: true });
  });

  it('should warn when setAskCallback is called', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const tool = new AskUserTool();

    tool.setAskCallback(async () => []);

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('deprecated'));
    warnSpy.mockRestore();
  });
});
