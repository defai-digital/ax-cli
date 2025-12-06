/**
 * Ask User Tool Definition - Claude Code Quality
 *
 * Ask the user questions to gather preferences, clarify requirements,
 * or get decisions on implementation choices.
 */

import type { ToolDefinition } from '../types.js';

export const askUserTool: ToolDefinition = {
  name: 'ask_user',
  displayName: 'Ask User',

  description: `Ask the user questions to gather preferences, clarify requirements, or get decisions on implementation choices.

Use this when you need user input before proceeding. Supports multiple choice questions with 2-4 options per question.

WHEN TO USE:
- Implementation choices with trade-offs (library A vs B)
- Ambiguous requirements need clarification
- User preference needed (styling, naming, etc.)
- Multiple valid approaches exist

WHEN NOT TO USE:
- You can make a reasonable assumption
- Documentation/code clearly indicates the approach
- It's a technical decision you're qualified to make
- The question is unnecessary or obvious

Users can always select "Other" to provide custom input beyond the given options.`,

  parameters: {
    type: 'object',
    properties: {
      questions: {
        type: 'array',
        description: 'Questions to ask (1-4 questions)',
        items: {
          type: 'object',
          properties: {
            question: {
              type: 'string',
              description:
                'The complete question to ask. Should be clear, specific, and end with ?',
            },
            header: {
              type: 'string',
              description:
                'Short label for the question (max 12 chars). E.g., "Auth method", "Library".',
            },
            options: {
              type: 'array',
              description:
                'Available choices (2-4 options). "Other" is added automatically.',
              items: {
                type: 'object',
                properties: {
                  label: {
                    type: 'string',
                    description: 'Display text for this option (1-5 words).',
                  },
                  description: {
                    type: 'string',
                    description: 'Explanation of what this option means.',
                  },
                },
                required: ['label', 'description'],
              },
            },
            multiSelect: {
              type: 'boolean',
              description: 'Allow multiple selections (default: false).',
            },
          },
          required: ['question', 'options'],
        },
      },
    },
    required: ['questions'],
  },

  usageNotes: [
    'Users can always select "Other" to provide custom input',
    'Make questions specific and actionable',
    'Provide clear descriptions for each option',
    'Explain trade-offs in option descriptions',
    'Limit to 1-4 questions to avoid overwhelming',
    'Use multiSelect: true when options are not mutually exclusive',
    'Include header for quick scanning (max 12 chars)',
    'Order options by recommendation (best first)',
  ],

  constraints: [
    'Do not ask unnecessary questions',
    'Do not ask when you can make reasonable assumptions',
    'Maximum 4 questions per invocation',
    'Each question must have 2-4 options',
    'Header must be max 12 characters',
  ],

  antiPatterns: [
    'Asking obvious questions',
    'Asking questions the code/docs already answer',
    'Too many options (more than 4)',
    'Vague option descriptions',
    'Multiple questions when one would suffice',
  ],

  examples: [
    {
      description: 'Ask about library choice',
      scenario: 'Need to choose between date libraries',
      input: {
        questions: [
          {
            question: 'Which date library should we use for date formatting?',
            header: 'Date lib',
            options: [
              { label: 'date-fns', description: 'Lightweight, tree-shakeable, ~10KB' },
              { label: 'dayjs', description: "Moment.js alternative, ~2KB" },
              { label: 'Intl API', description: 'Native browser API, zero dependencies' },
            ],
          },
        ],
      },
      expectedBehavior: 'Shows options to user and returns their choice',
    },
    {
      description: 'Ask about architecture approach',
      scenario: 'Need to decide on state management',
      input: {
        questions: [
          {
            question: 'How should we handle application state?',
            header: 'State mgmt',
            options: [
              {
                label: 'React Context',
                description: 'Built-in, simple, good for small apps',
              },
              {
                label: 'Redux Toolkit',
                description: 'Powerful, scalable, more boilerplate',
              },
              { label: 'Zustand', description: 'Minimal, hooks-based, lightweight' },
            ],
          },
        ],
      },
      expectedBehavior: 'Returns user preference for state management',
    },
    {
      description: 'Multi-select question',
      scenario: 'Ask which features to implement',
      input: {
        questions: [
          {
            question: 'Which authentication methods should we support?',
            header: 'Auth methods',
            options: [
              { label: 'Email/Password', description: 'Traditional login form' },
              { label: 'Google OAuth', description: 'Sign in with Google' },
              { label: 'GitHub OAuth', description: 'Sign in with GitHub' },
              { label: 'Magic Link', description: 'Passwordless email link' },
            ],
            multiSelect: true,
          },
        ],
      },
      expectedBehavior: 'Returns array of selected authentication methods',
    },
  ],

  tokenCost: 500,
  safetyLevel: 'safe',
  requiresConfirmation: false,

  categories: ['user-interaction'],
  alternatives: [],
  relatedTools: [],
};
