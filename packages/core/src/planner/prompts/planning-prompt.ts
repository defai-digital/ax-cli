/**
 * Planning Prompts
 *
 * System prompts for LLM-based task decomposition.
 */

// ============================================================================
// Planning System Prompt
// ============================================================================

export const PLANNING_SYSTEM_PROMPT = `You are a task planning assistant for a CLI coding tool called AX-CLI.
Your job is to analyze user requests and create structured execution plans.

When given a complex coding task, you should:
1. Understand the user's goal
2. Break it down into 2-5 logical phases
3. Identify dependencies between phases
4. Assess risk levels for each phase
5. Determine which phases can run in parallel

Guidelines for creating good plans:

PHASE DECOMPOSITION:
- Each phase should be independently executable
- Phases should have clear, measurable objectives
- Keep phases focused (1-3 objectives max per phase)
- Order phases logically (analysis → design → implementation → testing → documentation)

DEPENDENCIES:
- Mark dependencies between phases (e.g., testing depends on implementation)
- Identify phases that can run in parallel (e.g., testing and documentation)
- Avoid circular dependencies

RISK ASSESSMENT:
- low: Read-only operations, non-destructive changes
- medium: File modifications, adding new code
- high: Deleting files, modifying critical configs, database changes

TOOL IDENTIFICATION:
Common tools: view_file, str_replace_editor, bash, search, test

OUTPUT FORMAT:
You must respond with valid JSON only. No explanations outside the JSON.`;

// ============================================================================
// Planning User Prompt Template
// ============================================================================

export function buildPlanningPrompt(
  userRequest: string,
  context?: {
    projectType?: string;
    files?: string[];
    recentHistory?: string[];
  }
): string {
  let prompt = `Create an execution plan for this request:

<request>
${userRequest}
</request>`;

  if (context?.projectType) {
    prompt += `\n\nProject type: ${context.projectType}`;
  }

  if (context?.files && context.files.length > 0) {
    prompt += `\n\nRelevant files:\n${context.files.slice(0, 10).join("\n")}`;
  }

  if (context?.recentHistory && context.recentHistory.length > 0) {
    prompt += `\n\nRecent context:\n${context.recentHistory.slice(-3).join("\n")}`;
  }

  prompt += `

Respond with a JSON object in this exact format:
{
  "reasoning": "Brief explanation of why this decomposition makes sense",
  "complexity": "simple|moderate|complex",
  "phases": [
    {
      "name": "Phase Name",
      "description": "What this phase accomplishes",
      "objectives": ["Specific goal 1", "Specific goal 2"],
      "toolsRequired": ["tool1", "tool2"],
      "dependencies": [],
      "canRunInParallel": false,
      "riskLevel": "low|medium|high",
      "requiresApproval": false
    }
  ]
}

Rules:
- Generate 1-5 phases depending on complexity
- Simple requests (single file change) = 1-2 phases
- Moderate requests (multi-file changes) = 2-3 phases
- Complex requests (new features, refactoring) = 3-5 phases
- First phase typically has no dependencies
- Testing and documentation can often run in parallel
- Set requiresApproval: true for high-risk phases`;

  return prompt;
}

// ============================================================================
// Phase Execution Prompt
// ============================================================================

export function buildPhaseExecutionPrompt(
  phase: {
    name: string;
    description: string;
    objectives: string[];
    toolsRequired: string[];
  },
  context?: {
    originalRequest?: string;
    previousPhases?: string[];
  }
): string {
  let prompt = `Execute this phase:

Phase: ${phase.name}
Description: ${phase.description}

Objectives:
${phase.objectives.map((o, i) => `${i + 1}. ${o}`).join("\n")}

Expected tools: ${phase.toolsRequired.join(", ") || "any"}`;

  if (context?.originalRequest) {
    prompt += `\n\nOriginal user request: ${context.originalRequest}`;
  }

  if (context?.previousPhases && context.previousPhases.length > 0) {
    prompt += `\n\nCompleted phases:\n${context.previousPhases.join("\n")}`;
  }

  prompt += `

Instructions:
- Focus only on the objectives listed above
- Complete all objectives before finishing
- Report any blockers or issues encountered
- Summarize what was accomplished when done`;

  return prompt;
}

// ============================================================================
// Plan Summary Prompt
// ============================================================================

export function buildPlanSummaryPrompt(
  results: Array<{
    phaseName: string;
    success: boolean;
    output?: string;
  }>
): string {
  const phaseResults = results
    .map(
      (r, i) =>
        `Phase ${i + 1}: ${r.phaseName}\nStatus: ${r.success ? "Success" : "Failed"}\n${r.output ? `Output: ${r.output}` : ""}`
    )
    .join("\n\n");

  return `Summarize the results of this multi-phase execution:

${phaseResults}

Provide:
1. A brief summary of what was accomplished
2. Any warnings or issues to note
3. Suggested next steps (if any)`;
}

// ============================================================================
// Complexity Detection
// ============================================================================

/**
 * Keywords that indicate tasks benefiting from thinking/reasoning mode
 * GLM-4.6 has a built-in thinking mode that provides extended reasoning
 */
export const THINKING_MODE_KEYWORDS = [
  // Deep analysis tasks
  "analyze",
  "debug",
  "investigate",
  "diagnose",
  "trace",
  "root cause",
  "why does",
  "why is",
  // Architecture and design
  "architect",
  "design",
  "plan",
  "strategy",
  "approach",
  "trade-off",
  "pros and cons",
  // Complex reasoning
  "complex",
  "complicated",
  "difficult",
  "tricky",
  "subtle",
  "edge case",
  // Code review and security
  "security audit",
  "vulnerability",
  "code review",
  "review for bugs",
  "find bugs",
  // PRD and documentation
  "prd",
  "product requirements",
  "specification",
  "design doc",
  "rfc",
  // Refactoring decisions
  "refactor strategy",
  "best way to",
  "how should",
  "recommend",
  // Performance analysis
  "performance issue",
  "bottleneck",
  "optimize",
  "memory leak",
  // Multi-step reasoning
  "step by step",
  "think through",
  "consider",
  "evaluate",
];

/**
 * Detect if a request would benefit from thinking/reasoning mode
 * GLM-4.6's thinking mode provides extended chain-of-thought reasoning
 *
 * @param request - User's request text
 * @returns true if thinking mode would improve response quality
 */
export function shouldUseThinkingMode(request: string): boolean {
  const lowerRequest = request.toLowerCase();

  // Check for thinking mode indicators
  const hasThinkingKeywords = THINKING_MODE_KEYWORDS.some((kw) =>
    lowerRequest.includes(kw)
  );

  // Question patterns that benefit from reasoning
  const hasReasoningQuestion =
    /\b(why|how|what if|should i|which|compare|difference|better)\b/i.test(lowerRequest);

  // Requests for explanation or understanding
  const wantsExplanation =
    lowerRequest.includes("explain") ||
    lowerRequest.includes("understand") ||
    lowerRequest.includes("help me understand") ||
    lowerRequest.includes("walk through");

  // Multiple options to consider
  const hasMultipleOptions =
    lowerRequest.includes("or") ||
    lowerRequest.includes("versus") ||
    lowerRequest.includes("vs") ||
    lowerRequest.includes("alternative");

  // Check for debugging patterns
  const isDebugging =
    lowerRequest.includes("not working") ||
    lowerRequest.includes("doesn't work") ||
    lowerRequest.includes("error") ||
    lowerRequest.includes("bug") ||
    lowerRequest.includes("broken");

  // Skip thinking mode for simple tasks
  const isSimpleTask =
    lowerRequest.length < 50 ||
    lowerRequest.includes("just") ||
    lowerRequest.includes("quick") ||
    lowerRequest.includes("simple") ||
    /^(show|list|get|read|view|print|cat)\s/i.test(lowerRequest.trim());

  if (isSimpleTask) {
    return false;
  }

  return hasThinkingKeywords || hasReasoningQuestion || wantsExplanation || hasMultipleOptions || isDebugging;
}

/**
 * Get complexity score for a request (0-100)
 * Higher scores indicate more complex tasks
 *
 * @param request - User's request text
 * @returns Complexity score 0-100
 */
export function getComplexityScore(request: string): number {
  const lowerRequest = request.toLowerCase();
  let score = 0;

  // Length-based scoring (longer requests often more complex)
  score += Math.min(20, Math.floor(request.length / 50));

  // Complex keywords
  const complexCount = COMPLEX_KEYWORDS.filter((kw) =>
    lowerRequest.includes(kw)
  ).length;
  score += Math.min(30, complexCount * 10);

  // Thinking mode keywords
  const thinkingCount = THINKING_MODE_KEYWORDS.filter((kw) =>
    lowerRequest.includes(kw)
  ).length;
  score += Math.min(20, thinkingCount * 5);

  // Multi-step indicators
  const stepIndicators = ["first", "then", "next", "after", "finally", "and then"];
  const stepCount = stepIndicators.filter((ind) =>
    lowerRequest.includes(ind)
  ).length;
  score += Math.min(15, stepCount * 5);

  // Multiple files/components
  if (lowerRequest.includes("all files") || lowerRequest.includes("codebase")) {
    score += 15;
  }

  return Math.min(100, score);
}

/**
 * Keywords that indicate a complex request
 */
export const COMPLEX_KEYWORDS = [
  // Major code changes
  "refactor",
  "rewrite",
  "migrate",
  "restructure",
  "reorganize",
  "overhaul",
  // Feature implementation
  "implement feature",
  "implement new",
  "add feature",
  "create feature",
  "build feature",
  "add authentication",
  "add authorization",
  "create api",
  "build api",
  // Architecture
  "design",
  "architect",
  "system design",
  // Testing
  "test coverage",
  "add tests",
  "write tests",
  "unit tests",
  "integration tests",
  // Documentation
  "documentation",
  "document all",
  "add docs",
  // DevOps
  "deploy",
  "ci/cd",
  "pipeline",
  "docker",
  "kubernetes",
  // Database
  "database",
  "schema",
  "migration",
  // Integration
  "integration",
  "integrate",
  "connect",
  // Multi-component work
  "frontend and backend",
  "client and server",
  "multiple components",
  "across modules",
  // Performance
  "optimize",
  "performance",
  "improve speed",
  // Complex multi-step
  "complete implementation",
  "full implementation",
  "end to end",
  "e2e",
];

/**
 * Keywords that indicate a simple request
 */
export const SIMPLE_KEYWORDS = [
  "fix bug",
  "typo",
  "rename",
  "update",
  "change",
  "modify",
  "add import",
  "remove",
  "delete",
  "comment",
];

/**
 * Detect if a request is likely complex
 */
export function isComplexRequest(request: string): boolean {
  const lowerRequest = request.toLowerCase();

  // Check for complex indicators
  const hasComplexKeywords = COMPLEX_KEYWORDS.some((kw) =>
    lowerRequest.includes(kw)
  );

  // Check for multiple file indicators
  // Limit input length for regex patterns to prevent any potential ReDoS
  const truncatedRequest = lowerRequest.slice(0, 500);
  const hasMultipleFiles =
    lowerRequest.includes("all files") ||
    lowerRequest.includes("entire") ||
    lowerRequest.includes("whole project") ||
    lowerRequest.includes("across") ||
    lowerRequest.includes("every file") ||
    lowerRequest.includes("codebase") ||
    /\d{1,6} files/.test(truncatedRequest);

  // Check for multi-step indicators
  const hasMultipleSteps =
    lowerRequest.includes("first") ||
    lowerRequest.includes("then") ||
    lowerRequest.includes("after that") ||
    lowerRequest.includes("finally") ||
    lowerRequest.includes("and also") ||
    lowerRequest.includes("step") ||
    lowerRequest.includes("next") ||
    // Multiple action verbs with "and" - use non-greedy match with length limit to prevent ReDoS
    /\b(create|add|implement|build|write)\b[^]*?\band\b[^]*?\b(create|add|implement|build|write|test|document)\b/i.test(lowerRequest.slice(0, 1000));

  // Check for request length - very long requests often need decomposition
  const isLongRequest = request.length > 300;

  // Check for multiple distinct tasks (comma-separated or numbered)
  const hasMultipleTasks =
    (lowerRequest.match(/\d\.\s/g) || []).length >= 2 || // numbered list
    (lowerRequest.match(/,\s*(add|create|implement|update|fix|remove)/g) || []).length >= 2;

  // Simple requests override
  const hasSimpleKeywords = SIMPLE_KEYWORDS.some((kw) =>
    lowerRequest.includes(kw)
  );

  // Only simple if no other complexity indicators
  if (hasSimpleKeywords && !hasMultipleFiles && !hasMultipleSteps && !hasMultipleTasks && !isLongRequest) {
    return false;
  }

  return hasComplexKeywords || hasMultipleFiles || hasMultipleSteps || hasMultipleTasks || (isLongRequest && hasComplexKeywords);
}

/**
 * Estimate minimum phases based on request analysis
 */
export function estimateMinPhases(request: string): number {
  const lowerRequest = request.toLowerCase();

  // Count distinct action verbs
  const actionVerbs = [
    "create",
    "add",
    "implement",
    "test",
    "document",
    "refactor",
    "fix",
    "update",
    "remove",
    "migrate",
    "deploy",
  ];

  let distinctActions = 0;
  for (const verb of actionVerbs) {
    if (lowerRequest.includes(verb)) {
      distinctActions++;
    }
  }

  // Count step indicators
  const stepIndicators = ["first", "then", "next", "after", "finally"];
  let stepCount = 0;
  for (const indicator of stepIndicators) {
    if (lowerRequest.includes(indicator)) {
      stepCount++;
    }
  }

  return Math.max(1, Math.min(5, distinctActions, stepCount + 1));
}
