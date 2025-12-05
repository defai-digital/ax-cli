/**
 * AX Agent Tool Definition - Claude Code Quality
 *
 * Invoke AutomatosX AI agents for collaborative analysis and review.
 */

import type { ToolDefinition } from '../types.js';

export const axAgentTool: ToolDefinition = {
  name: 'ax_agent',
  displayName: 'AX Agent',

  description: `Invoke an AutomatosX AI agent for collaborative analysis, code review, architecture advice, or strategic guidance.

USE THIS when the user wants to WORK WITH a specific agent persona:
- Tony (CTO): Strategic technology decisions, team leadership
- Bob (Backend): Server-side development, APIs, databases
- Avery (Architect): System design, architecture patterns
- Stan (Standards): Code quality, best practices, style guides
- Steve (Security): Security analysis, vulnerability assessment
- Felix (Fullstack): Full-stack development, integration
- Frank (Frontend): UI/UX, React, CSS, client-side
- Queenie (QA): Testing strategies, quality assurance
- Wendy (Writer): Documentation, technical writing
- Oliver (DevOps): CI/CD, infrastructure, deployment
- Paris (Product): Product management, requirements
- Maya (Mobile): Mobile development, iOS/Android
- Dana (Data Science): ML, analytics, data modeling
- Daisy (Data Eng): Data pipelines, ETL, warehousing
- Debbee (Design): UI/UX design, design systems
- Eric (Exec): Executive perspective, business strategy
- Rodman (Research): Technical research, exploration
- Candy (Marketing): Marketing tech, analytics
- Quinn (Quantum): Quantum computing
- Astrid (Aerospace): Aerospace systems

IMPORTANT: When the user asks to work with MULTIPLE agents, invoke ALL agents IN PARALLEL by making multiple ax_agent calls in the same response - they will execute concurrently for faster results.

Returns the agent's AI-generated response analyzing the task or question.`,

  parameters: {
    type: 'object',
    properties: {
      agent: {
        type: 'string',
        enum: [
          'tony',
          'bob',
          'avery',
          'stan',
          'steve',
          'felix',
          'frank',
          'queenie',
          'wendy',
          'oliver',
          'paris',
          'maya',
          'dana',
          'daisy',
          'debbee',
          'eric',
          'rodman',
          'candy',
          'quinn',
          'astrid',
        ],
        description:
          'Agent to invoke. Each has a specialty: tony (CTO), bob (backend), avery (architect), stan (standards), steve (security), etc.',
      },
      task: {
        type: 'string',
        description:
          'Task or question for the agent. Be specific about what you want analyzed or reviewed.',
        examples: [
          'Review the authentication implementation for security issues',
          'Suggest improvements to the database schema',
          'Analyze the API design for REST best practices',
        ],
      },
      format: {
        type: 'string',
        enum: ['text', 'markdown'],
        description: 'Output format (default: markdown)',
        default: 'markdown',
      },
      save: {
        type: 'string',
        description:
          'Optional file path to save output (e.g., automatosx/tmp/review.md)',
        format: 'file-path',
      },
    },
    required: ['agent', 'task'],
  },

  usageNotes: [
    'Choose agent based on their specialty',
    'Be specific in the task description',
    'For multi-agent review, call agents IN PARALLEL (multiple tool calls)',
    'Use save parameter to persist important reviews',
    'Agents provide AI-generated analysis from their perspective',
    'Common combinations:',
    '  - steve + bob: Security review of backend code',
    '  - avery + stan: Architecture and code quality review',
    '  - frank + debbee: Frontend and design review',
    '  - queenie + bob: Testing strategy for backend',
  ],

  constraints: [
    'Agent must be one of the defined personas',
    'Task should be clear and actionable',
    'Parallel execution is preferred for multi-agent reviews',
  ],

  antiPatterns: [
    'Calling agents sequentially when parallel is possible',
    'Vague task descriptions',
    'Using wrong agent for the task domain',
  ],

  examples: [
    {
      description: 'Security review',
      scenario: 'Get security analysis of authentication code',
      input: {
        agent: 'steve',
        task: 'Review the JWT implementation in src/auth/ for security vulnerabilities',
        format: 'markdown',
      },
      expectedBehavior: 'Returns security-focused analysis from Steve',
    },
    {
      description: 'Architecture review',
      scenario: 'Get architecture feedback on a new feature',
      input: {
        agent: 'avery',
        task: 'Evaluate the proposed microservices architecture for the payment system',
        save: 'automatosx/tmp/arch-review.md',
      },
      expectedBehavior: 'Returns architecture analysis and saves to file',
    },
    {
      description: 'Multi-agent parallel review',
      scenario: 'Get both security and backend review',
      input: {
        agent: 'steve',
        task: 'Review the API endpoints for security best practices',
      },
      expectedBehavior:
        'Call this AND bob agent in parallel for comprehensive review',
      notes: 'Make both ax_agent calls in the same response for parallel execution',
    },
  ],

  tokenCost: 600,
  safetyLevel: 'safe',
  requiresConfirmation: false,

  categories: ['agent-delegation'],
  alternatives: ['ax_agents_parallel'],
  relatedTools: ['ax_agents_parallel'],
};

export const axAgentsParallelTool: ToolDefinition = {
  name: 'ax_agents_parallel',
  displayName: 'AX Agents Parallel',

  description: `Execute MULTIPLE AutomatosX AI agents in TRUE PARALLEL for collaborative analysis.

USE THIS when you need to invoke 2+ agents simultaneously:
- All agents execute concurrently (not sequentially)
- Significantly faster than calling ax_agent multiple times
- Results are aggregated with timing information

PREFERRED over multiple ax_agent calls when:
- User requests multi-perspective review (e.g., "ask Tony, Bob, and Steve")
- Need comprehensive analysis from multiple specialists
- Want to minimize total execution time

Available agents:
- tony (CTO), bob (backend), avery (architect), stan (standards)
- steve (security), felix (fullstack), frank (frontend), queenie (QA)
- wendy (writer), oliver (devops), paris (product), maya (mobile)
- dana (data science), daisy (data eng), debbee (design), eric (exec)
- rodman (research), candy (marketing), quinn (quantum), astrid (aerospace)

Returns aggregated results from all agents with execution timing.`,

  parameters: {
    type: 'object',
    properties: {
      agents: {
        type: 'array',
        description: 'Array of agent configurations to execute in parallel',
        items: {
          type: 'object',
          properties: {
            agent: {
              type: 'string',
              enum: [
                'tony', 'bob', 'avery', 'stan', 'steve', 'felix', 'frank',
                'queenie', 'wendy', 'oliver', 'paris', 'maya', 'dana',
                'daisy', 'debbee', 'eric', 'rodman', 'candy', 'quinn', 'astrid',
              ],
              description: 'Agent name to invoke',
            },
            task: {
              type: 'string',
              description: 'Task or question for this specific agent',
            },
            format: {
              type: 'string',
              enum: ['text', 'markdown'],
              description: 'Output format (default: markdown)',
            },
            save: {
              type: 'string',
              description: 'Optional file path to save this agent\'s output',
            },
          },
          required: ['agent', 'task'],
        },
      },
    },
    required: ['agents'],
  },

  usageNotes: [
    'Use for multi-agent reviews to maximize parallelism',
    'All agents start simultaneously - total time ≈ slowest agent',
    'Each agent can have a different task tailored to their expertise',
    'Results include per-agent timing for performance analysis',
    'Recommended combinations:',
    '  - [steve, bob, stan]: Comprehensive code review',
    '  - [avery, tony, eric]: Architecture & strategy review',
    '  - [frank, debbee, queenie]: Frontend quality review',
    '  - [dana, daisy, bob]: Data pipeline review',
  ],

  constraints: [
    'Maximum 10 agents per call to prevent resource exhaustion',
    'Each agent in the array must have valid agent name and task',
    'All agents execute concurrently - ensure tasks are independent',
  ],

  antiPatterns: [
    'Using for single agent (use ax_agent instead)',
    'Duplicate agents in the same call',
    'Tasks that depend on other agent outputs',
  ],

  examples: [
    {
      description: 'Multi-perspective code review',
      scenario: 'Get security, backend, and standards review simultaneously',
      input: {
        agents: [
          { agent: 'steve', task: 'Review for security vulnerabilities' },
          { agent: 'bob', task: 'Review for backend best practices' },
          { agent: 'stan', task: 'Review for code quality and SOLID principles' },
        ],
      },
      expectedBehavior: 'All three agents run in parallel, results aggregated',
    },
    {
      description: 'Architecture consultation',
      scenario: 'Get multiple perspectives on system design',
      input: {
        agents: [
          { agent: 'avery', task: 'Evaluate microservices architecture' },
          { agent: 'tony', task: 'Assess strategic technology decisions' },
          { agent: 'oliver', task: 'Review deployment and infrastructure needs' },
        ],
      },
      expectedBehavior: 'Parallel execution with architecture, strategy, and DevOps perspectives',
    },
    {
      description: 'Full-stack review',
      scenario: 'Comprehensive frontend and backend review',
      input: {
        agents: [
          { agent: 'frank', task: 'Review React components for best practices' },
          { agent: 'bob', task: 'Review API endpoints for REST compliance' },
          { agent: 'queenie', task: 'Suggest testing strategy for the feature' },
        ],
      },
      expectedBehavior: 'Three-way parallel review covering full stack',
    },
  ],

  tokenCost: 800,
  safetyLevel: 'safe',
  requiresConfirmation: false,

  categories: ['agent-delegation'],
  alternatives: ['ax_agent'],
  relatedTools: ['ax_agent'],
};
