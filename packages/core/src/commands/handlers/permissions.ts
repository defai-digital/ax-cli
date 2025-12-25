/**
 * Permissions Command Handler
 *
 * Handler for /permissions - tool permission management
 *
 * @packageDocumentation
 */

import type { CommandDefinition, CommandContext, CommandResult } from "../types.js";
import { getPermissionManager, PermissionTier } from "../../permissions/permission-manager.js";
import { extractErrorMessage } from "../../utils/error-handler.js";

/**
 * Tier emoji mapping
 */
const tierEmoji: Record<string, string> = {
  [PermissionTier.AutoApprove]: "✅",
  [PermissionTier.Notify]: "🔔",
  [PermissionTier.Confirm]: "⚠️",
  [PermissionTier.Block]: "🚫",
};

/**
 * Valid permission tiers
 */
const validTiers = ["auto_approve", "notify", "confirm", "block"];

/**
 * Handle /permissions show - display current permissions
 */
function handlePermissionsShow(_ctx: CommandContext): CommandResult {
  const permManager = getPermissionManager();
  const config = permManager.getConfig();

  const lines: string[] = [
    "**Permission Configuration**\n",
    `Default Tier: **${config.permissions.default_tier}**\n`,
    "\n**Tool Permissions:**\n",
  ];

  for (const [tool, toolConfig] of Object.entries(config.permissions.tools)) {
    const emoji = tierEmoji[toolConfig.tier] || "❓";
    lines.push(`- ${emoji} **${tool}**: ${toolConfig.tier}\n`);
  }

  lines.push("\n**Session Settings:**\n");
  lines.push(
    `- Allow all bash: ${config.permissions.session_approvals.allow_all_bash ? "Yes" : "No"}\n`
  );
  lines.push(
    `- Trust current directory: ${config.permissions.session_approvals.trust_current_directory ? "Yes" : "No"}\n`
  );
  lines.push("\n*Tip: Use `/permissions set <tool> <tier>` to change permissions*\n");
  lines.push("*Tiers: auto_approve, notify, confirm, block*");

  return {
    handled: true,
    entries: [
      {
        type: "assistant",
        content: lines.join(""),
        timestamp: new Date(),
      },
    ],
    clearInput: true,
  };
}

/**
 * Handle /permissions set <tool> <tier>
 */
function handlePermissionsSet(args: string, ctx: CommandContext): CommandResult {
  const setArgs = args.split(/\s+/);

  if (setArgs.length < 2) {
    return {
      handled: true,
      entries: [
        {
          type: "assistant",
          content:
            "Usage: `/permissions set <tool> <tier>`\n\nExample: `/permissions set bash confirm`",
          timestamp: new Date(),
        },
      ],
      clearInput: true,
    };
  }

  const [tool, tier] = setArgs;

  if (!validTiers.includes(tier)) {
    return {
      handled: true,
      entries: [
        {
          type: "assistant",
          content: `❌ Invalid tier: "${tier}"\n\nValid tiers are: ${validTiers.join(", ")}`,
          timestamp: new Date(),
        },
      ],
      clearInput: true,
    };
  }

  // Return with async action to update permissions
  return {
    handled: true,
    clearInput: true,
    asyncAction: async () => {
      const permManager = getPermissionManager();
      const config = permManager.getConfig();

      try {
        const newTools = { ...config.permissions.tools };
        newTools[tool] = { tier: tier as PermissionTier };

        await permManager.updateConfig({ tools: newTools });

        ctx.setChatHistory((prev) => [
          ...prev,
          {
            type: "assistant",
            content: `✅ Set **${tool}** permission to **${tier}**`,
            timestamp: new Date(),
          },
        ]);
      } catch (error) {
        ctx.setChatHistory((prev) => [
          ...prev,
          {
            type: "assistant",
            content: `❌ Failed to update permission: ${extractErrorMessage(error)}`,
            timestamp: new Date(),
          },
        ]);
      }
    },
  };
}

/**
 * Handle /permissions reset
 */
function handlePermissionsReset(_ctx: CommandContext): CommandResult {
  const permManager = getPermissionManager();
  permManager.clearSessionApprovals();

  return {
    handled: true,
    entries: [
      {
        type: "assistant",
        content: "✅ Session permissions cleared. Tool permissions reset to defaults.",
        timestamp: new Date(),
      },
    ],
    clearInput: true,
  };
}

/**
 * Handle /permissions help
 */
function handlePermissionsHelp(): CommandResult {
  const content = `**Permission Commands:**

- \`/permissions\` - Show current permissions
- \`/permissions set <tool> <tier>\` - Set tool permission tier
- \`/permissions reset\` - Reset session approvals

**Permission Tiers:**
- \`auto_approve\` - Automatically allow (safe operations)
- \`notify\` - Allow with notification
- \`confirm\` - Require user confirmation
- \`block\` - Always block`;

  return {
    handled: true,
    entries: [
      {
        type: "assistant",
        content,
        timestamp: new Date(),
      },
    ],
    clearInput: true,
  };
}

/**
 * /permissions command handler
 *
 * Usage:
 *   /permissions              - Show current permissions
 *   /permissions show         - Same as above
 *   /permissions set <t> <v>  - Set tool permission tier
 *   /permissions reset        - Reset session approvals
 */
export function handlePermissions(args: string, ctx: CommandContext): CommandResult {
  const trimmedArgs = args.trim().toLowerCase();

  if (!trimmedArgs || trimmedArgs === "show" || trimmedArgs === "list") {
    return handlePermissionsShow(ctx);
  }

  if (trimmedArgs.startsWith("set ")) {
    return handlePermissionsSet(trimmedArgs.replace("set ", "").trim(), ctx);
  }

  if (trimmedArgs === "reset") {
    return handlePermissionsReset(ctx);
  }

  return handlePermissionsHelp();
}

/**
 * Permissions command definition for registration
 */
export const permissionsCommands: CommandDefinition[] = [
  {
    name: "permissions",
    description: "View/manage tool permissions",
    category: "settings",
    handler: handlePermissions,
    examples: [
      "/permissions",
      "/permissions set bash confirm",
      "/permissions reset",
    ],
  },
];
