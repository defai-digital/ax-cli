/**
 * AX Agent Tool
 *
 * Invokes AutomatosX AI agents for collaborative tasks.
 * This tool bridges ax-cli to the AutomatosX agent ecosystem,
 * enabling users to work with specialized AI personas.
 *
 * @packageDocumentation
 */

import { spawn } from "child_process";
import type { ToolResult } from "../types/index.js";

/**
 * Available AutomatosX agents with their specializations
 */
export const AGENT_REGISTRY: Record<string, { persona: string; expertise: string }> = {
  tony: { persona: "Tony", expertise: "CTO/technology strategy, technical leadership, architecture oversight" },
  bob: { persona: "Bob", expertise: "Backend development, APIs, databases, microservices" },
  avery: { persona: "Avery", expertise: "System architecture, ADRs, architectural patterns" },
  stan: { persona: "Stan", expertise: "SOLID principles, design patterns, code review, best practices" },
  steve: { persona: "Steve", expertise: "Security audits, threat modeling, OWASP" },
  felix: { persona: "Felix", expertise: "Full-stack development, API integration, e2e testing" },
  frank: { persona: "Frank", expertise: "Frontend, React, UI/UX, accessibility" },
  queenie: { persona: "Queenie", expertise: "QA, testing strategies, test automation" },
  wendy: { persona: "Wendy", expertise: "Technical writing, documentation, API docs" },
  oliver: { persona: "Oliver", expertise: "DevOps, CI/CD, infrastructure, Kubernetes" },
  paris: { persona: "Paris", expertise: "Product strategy, user research, roadmaps" },
  maya: { persona: "Maya", expertise: "Mobile development, iOS, Android, cross-platform" },
  dana: { persona: "Dana", expertise: "Data science, ML, statistical modeling" },
  daisy: { persona: "Daisy", expertise: "Data engineering, ETL, data pipelines" },
  debbee: { persona: "Debbee", expertise: "UX design, design systems, wireframing" },
  eric: { persona: "Eric", expertise: "Business strategy, organizational leadership" },
  rodman: { persona: "Rodman", expertise: "Research, feasibility studies, analysis" },
  candy: { persona: "Candy", expertise: "GenAI prompting, marketing, content" },
  quinn: { persona: "Quinn", expertise: "Quantum computing, quantum algorithms" },
  astrid: { persona: "Astrid", expertise: "Aerospace, orbital mechanics, telemetry" },
};

/**
 * Options for ax_agent tool execution
 */
export interface AxAgentOptions {
  agent: string;
  task: string;
  format?: "text" | "markdown";
  save?: string;
}

/**
 * Execute an AutomatosX agent
 *
 * @param options Agent invocation options
 * @returns Tool result with agent response
 */
export async function executeAxAgent(options: AxAgentOptions): Promise<ToolResult> {
  const { agent, task, format = "markdown", save } = options;

  // Validate agent name
  const agentLower = agent.toLowerCase();
  if (!AGENT_REGISTRY[agentLower]) {
    const availableAgents = Object.keys(AGENT_REGISTRY).join(", ");
    return {
      success: false,
      error: `Unknown agent: ${agent}. Available agents: ${availableAgents}`,
    };
  }

  // Build the ax command
  const args = ["run", agentLower, task, "--format", format];
  if (save) {
    args.push("--save", save);
  }

  try {
    const result = await runAxCommand(args);

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Agent execution failed",
      };
    }

    const agentInfo = AGENT_REGISTRY[agentLower];
    const header = `## ${agentInfo.persona} (${agentInfo.expertise})\n\n`;

    return {
      success: true,
      output: header + (result.output || "Agent completed successfully"),
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to invoke agent: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Run the ax command with given arguments
 *
 * @param args Command arguments
 * @returns Promise resolving to command output
 */
async function runAxCommand(args: string[]): Promise<{ success: boolean; output?: string; error?: string }> {
  return new Promise((resolve) => {
    // Run ax command without shell to avoid DEP0190 deprecation warning
    const command = "ax";

    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: { ...process.env },
      // Note: shell: false (default) - args are passed directly to the command
    });

    let stdout = "";
    let stderr = "";
    let resolved = false;

    // Helper to resolve only once (prevents race condition with timeout)
    const resolveOnce = (result: { success: boolean; output?: string; error?: string }) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        resolve(result);
      }
    };

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("error", (error) => {
      // Clean up event listeners to prevent memory leaks
      child.removeAllListeners();
      // If 'ax' fails, the command might not be installed
      if (error.message.includes("ENOENT") || error.message.includes("not found")) {
        resolveOnce({
          success: false,
          error: "AutomatosX is not installed. Install with: npm install -g @defai.digital/automatosx",
        });
      } else {
        resolveOnce({
          success: false,
          error: `Command error: ${error.message}`,
        });
      }
    });

    child.on("close", (code) => {
      // Clean up event listeners to prevent memory leaks
      child.removeAllListeners();
      if (code === 0) {
        resolveOnce({
          success: true,
          output: stdout.trim(),
        });
      } else {
        // Check for specific error patterns
        const errorOutput = stderr.trim() || stdout.trim();

        if (errorOutput.includes("not found") || errorOutput.includes("command not found")) {
          resolveOnce({
            success: false,
            error: "AutomatosX is not installed. Install with: npm install -g @defai.digital/automatosx",
          });
        } else {
          resolveOnce({
            success: false,
            error: errorOutput || `Agent exited with code ${code}`,
          });
        }
      }
    });

    // Set a timeout for long-running agent tasks (5 minutes)
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      resolveOnce({
        success: false,
        error: "Agent execution timed out after 5 minutes",
      });
    }, 5 * 60 * 1000);
  });
}

/**
 * List available agents
 *
 * @returns Formatted list of agents
 */
export function listAgents(): string {
  const lines = ["Available AutomatosX Agents:", ""];

  for (const [name, info] of Object.entries(AGENT_REGISTRY)) {
    lines.push(`  ${name.padEnd(10)} - ${info.persona}: ${info.expertise}`);
  }

  return lines.join("\n");
}

/**
 * Options for parallel agent execution
 */
export interface AxAgentsParallelOptions {
  agents: Array<{
    agent: string;
    task: string;
    format?: "text" | "markdown";
    save?: string;
  }>;
}

/**
 * Result of a single agent in parallel execution
 */
export interface ParallelAgentResult {
  agent: string;
  task: string;
  success: boolean;
  output?: string;
  error?: string;
  executionTime: number;
}

/**
 * Execute multiple AutomatosX agents in parallel
 *
 * This function spawns all agents concurrently using Promise.allSettled,
 * enabling true parallel execution for improved performance.
 *
 * @param options Parallel agent invocation options
 * @returns Tool result with aggregated agent responses
 */
export async function executeAxAgentsParallel(
  options: AxAgentsParallelOptions
): Promise<ToolResult> {
  const { agents } = options;

  if (!agents || agents.length === 0) {
    return {
      success: false,
      error: "No agents specified. Provide an array of {agent, task} objects.",
    };
  }

  // Validate all agent names upfront
  const invalidAgents: string[] = [];
  for (const agentConfig of agents) {
    const agentLower = agentConfig.agent.toLowerCase();
    if (!AGENT_REGISTRY[agentLower]) {
      invalidAgents.push(agentConfig.agent);
    }
  }

  if (invalidAgents.length > 0) {
    const availableAgents = Object.keys(AGENT_REGISTRY).join(", ");
    return {
      success: false,
      error: `Unknown agent(s): ${invalidAgents.join(", ")}. Available agents: ${availableAgents}`,
    };
  }

  // Execute all agents in parallel
  const startTime = Date.now();
  const promises = agents.map(async (agentConfig): Promise<ParallelAgentResult> => {
    const agentStartTime = Date.now();
    const result = await executeAxAgent({
      agent: agentConfig.agent,
      task: agentConfig.task,
      format: agentConfig.format,
      save: agentConfig.save,
    });

    return {
      agent: agentConfig.agent,
      task: agentConfig.task,
      success: result.success,
      output: result.output,
      error: result.error,
      executionTime: Date.now() - agentStartTime,
    };
  });

  const settledResults = await Promise.allSettled(promises);
  const totalTime = Date.now() - startTime;

  // Process results
  const results: ParallelAgentResult[] = settledResults.map((settled, index) => {
    if (settled.status === "fulfilled") {
      return settled.value;
    } else {
      const agentConfig = agents[index];
      return {
        agent: agentConfig.agent,
        task: agentConfig.task,
        success: false,
        error: settled.reason?.message || "Unknown error",
        executionTime: 0,
      };
    }
  });

  // Count successes and failures
  const successCount = results.filter((r) => r.success).length;
  const failureCount = results.length - successCount;

  // Build aggregated output
  const outputParts: string[] = [
    `## Parallel Agent Execution Results`,
    ``,
    `**Summary:** ${successCount}/${results.length} agents completed successfully`,
    `**Total Time:** ${(totalTime / 1000).toFixed(2)}s (parallel execution)`,
    ``,
    `---`,
    ``,
  ];

  for (const result of results) {
    const agentInfo = AGENT_REGISTRY[result.agent.toLowerCase()];
    const status = result.success ? "✓" : "✗";
    const timeStr = `${(result.executionTime / 1000).toFixed(2)}s`;

    outputParts.push(`### ${status} ${agentInfo?.persona || result.agent} (${timeStr})`);
    outputParts.push(`**Task:** ${result.task}`);
    outputParts.push(``);

    if (result.success && result.output) {
      outputParts.push(result.output);
    } else if (result.error) {
      outputParts.push(`**Error:** ${result.error}`);
    }

    outputParts.push(``);
    outputParts.push(`---`);
    outputParts.push(``);
  }

  return {
    success: failureCount === 0,
    output: outputParts.join("\n"),
    error: failureCount > 0 ? `${failureCount} agent(s) failed` : undefined,
  };
}
