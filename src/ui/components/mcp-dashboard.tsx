/**
 * MCP Dashboard Component
 *
 * Interactive dashboard for managing MCP (Model Context Protocol) servers.
 * Shows server status, tools, and provides quick actions.
 */

import React, { useState, useCallback, useEffect, useRef } from "react";
import { Box, Text, useInput } from "ink";
import { getMCPManager, getMCPConnectionStatus } from "../../llm/tools.js";
import { loadMCPConfig, addMCPServer, generateConfigFromTemplate } from "../../mcp/config.js";
import type { MCPTool } from "../../mcp/client.js";
import { getTemplatesByCategory, type MCPServerTemplate } from "../../mcp/templates.js";
import { extractErrorMessage } from "../../utils/error-handler.js";

export interface MCPDashboardProps {
  isVisible: boolean;
  onClose: () => void;
  onAddServer?: () => void;
  onRefresh?: () => void;
}

interface ServerInfo {
  name: string;
  status: "connected" | "disconnected" | "connecting" | "failed";
  toolCount: number;
  transport?: string;
  tools?: MCPTool[];
}

type DashboardView = "list" | "detail" | "tools" | "add-category" | "add-template" | "add-installing";

// Template categories for the wizard
const WIZARD_CATEGORIES = [
  { key: "design", label: "🎨 Design", desc: "Figma, Storybook, design tools" },
  { key: "version-control", label: "📦 Version Control", desc: "GitHub, GitLab, Git tools" },
  { key: "deployment", label: "🚀 Deployment", desc: "Vercel, AWS, cloud platforms" },
  { key: "testing", label: "🧪 Testing", desc: "Puppeteer, Playwright, testing tools" },
  { key: "monitoring", label: "📊 Monitoring", desc: "Sentry, logging, observability" },
  { key: "backend", label: "🗄️ Backend", desc: "Databases, APIs, servers" },
] as const;

/**
 * Helper for wrap-around list navigation
 * Simplifies up/down arrow handlers across different views
 */
function navigateList(
  direction: "up" | "down",
  currentIndex: number,
  listLength: number
): number {
  if (listLength === 0) return currentIndex;
  if (direction === "up") {
    return currentIndex > 0 ? currentIndex - 1 : listLength - 1;
  }
  return (currentIndex + 1) % listLength;
}

/**
 * Server status styles lookup table for O(1) access
 */
const SERVER_STATUS_STYLES: Record<ServerInfo["status"], { icon: string; color: string }> = {
  connected: { icon: "✓", color: "green" },
  connecting: { icon: "◐", color: "yellow" },
  failed: { icon: "✗", color: "red" },
  disconnected: { icon: "✗", color: "red" },
};

/** Default style for unknown status */
const DEFAULT_SERVER_STATUS = { icon: "✗", color: "red" };

function getServerStatusIcon(status: ServerInfo["status"]): string {
  return (SERVER_STATUS_STYLES[status] ?? DEFAULT_SERVER_STATUS).icon;
}

function getServerStatusColor(status: ServerInfo["status"]): string {
  return (SERVER_STATUS_STYLES[status] ?? DEFAULT_SERVER_STATUS).color;
}

export function MCPDashboard({
  isVisible,
  onClose,
  onAddServer: _onAddServer,
  onRefresh,
}: MCPDashboardProps) {
  const [servers, setServers] = useState<ServerInfo[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [view, setView] = useState<DashboardView>("list");
  const [refreshKey, setRefreshKey] = useState(0);

  // Wizard state
  const [wizardCategoryIndex, setWizardCategoryIndex] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [availableTemplates, setAvailableTemplates] = useState<MCPServerTemplate[]>([]);
  const [wizardTemplateIndex, setWizardTemplateIndex] = useState(0);
  const [installStatus, setInstallStatus] = useState<string>("");
  const [installError, setInstallError] = useState<string | null>(null);

  // BUG FIX: Track install success timeout for cleanup on unmount
  const installSuccessTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // BUG FIX: Cleanup timeout on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (installSuccessTimeoutRef.current) {
        clearTimeout(installSuccessTimeoutRef.current);
        installSuccessTimeoutRef.current = null;
      }
    };
  }, []);

  // Load server data
  useEffect(() => {
    if (!isVisible) return;

    const loadServers = () => {
      try {
        const manager = getMCPManager();
        const config = loadMCPConfig();
        const connectedServers = manager.getServers();
        // Fetch all tools once (performance optimization - avoids repeated getTools() calls)
        const allTools = manager.getTools();

        const serverList: ServerInfo[] = config.servers.map((serverConfig) => {
          const isConnected = connectedServers.includes(serverConfig.name);
          const tools = isConnected
            ? allTools.filter((t) => t.serverName === serverConfig.name)
            : [];
          const transportType = isConnected
            ? manager.getTransportType(serverConfig.name)
            : serverConfig.transport?.type || "stdio";

          return {
            name: serverConfig.name,
            status: isConnected ? "connected" : "disconnected",
            toolCount: tools.length,
            transport: transportType,
            tools: tools,
          };
        });

        setServers(serverList);
      } catch {
        // No MCP servers configured
        setServers([]);
      }
    };

    loadServers();
  }, [isVisible, refreshKey]);

  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
    onRefresh?.();
  }, [onRefresh]);

  const handleRetryConnection = useCallback(async (serverName: string) => {
    try {
      const manager = getMCPManager();
      const config = loadMCPConfig();
      const serverConfig = config.servers.find((s) => s.name === serverName);

      if (serverConfig) {
        await manager.addServer(serverConfig);
        handleRefresh();
      }
    } catch {
      // Failed to reconnect - status will show as failed
      handleRefresh();
    }
  }, [handleRefresh]);

  // Start the add server wizard
  const handleStartWizard = useCallback(() => {
    // BUG FIX: Clear any pending install success timeout from previous installation
    // to prevent it from interfering with the new wizard flow
    if (installSuccessTimeoutRef.current) {
      clearTimeout(installSuccessTimeoutRef.current);
      installSuccessTimeoutRef.current = null;
    }
    setWizardCategoryIndex(0);
    setSelectedCategory(null);
    setAvailableTemplates([]);
    setWizardTemplateIndex(0);
    setInstallStatus("");
    setInstallError(null);
    setView("add-category");
  }, []);

  // Select a category and load templates
  const handleSelectCategory = useCallback((category: string) => {
    setSelectedCategory(category);
    const templates = getTemplatesByCategory(category as MCPServerTemplate['category']);
    setAvailableTemplates(templates);
    setWizardTemplateIndex(0);
    setView("add-template");
  }, []);

  // Install a template
  const handleInstallTemplate = useCallback(async (template: MCPServerTemplate) => {
    setView("add-installing");
    setInstallStatus("Checking environment variables...");
    setInstallError(null);

    try {
      // Check for required environment variables
      const missingEnvVars: string[] = [];
      const envVars: Record<string, string> = {};

      for (const envVar of template.requiredEnv) {
        const value = process.env[envVar.name];
        if (!value) {
          missingEnvVars.push(envVar.name);
        } else {
          envVars[envVar.name] = value;
        }
      }

      if (missingEnvVars.length > 0) {
        setInstallError(
          `Missing environment variables: ${missingEnvVars.join(", ")}\n\n` +
          `Set them in your shell:\n${missingEnvVars.map(v => `  export ${v}=<value>`).join("\n")}`
        );
        return;
      }

      setInstallStatus("Generating configuration...");
      const config = generateConfigFromTemplate(template.name, envVars);

      setInstallStatus("Connecting to server...");
      const manager = getMCPManager();
      await manager.addServer(config);

      // BUG FIX: Save config only after successful connection
      // Previously saved before connection, causing orphaned configs on failure
      setInstallStatus("Saving configuration...");
      addMCPServer(config);

      setInstallStatus(`✅ ${template.name} installed successfully!`);

      // BUG FIX: Track timeout for cleanup on unmount
      // Wait a moment to show success, then return to list
      installSuccessTimeoutRef.current = setTimeout(() => {
        installSuccessTimeoutRef.current = null;
        handleRefresh();
        setView("list");
      }, 1500);

    } catch (error) {
      setInstallError(`Installation failed: ${extractErrorMessage(error)}`);
    }
  }, [handleRefresh]);

  useInput(
    (input, key) => {
      if (!isVisible) return;

      // Handle wizard views
      if (view === "add-category") {
        if (key.escape || input === "q") {
          setView("list");
          return;
        }
        if (key.upArrow || key.downArrow) {
          const direction = key.upArrow ? "up" : "down";
          setWizardCategoryIndex((prev) => navigateList(direction, prev, WIZARD_CATEGORIES.length));
          return;
        }
        if (key.return) {
          handleSelectCategory(WIZARD_CATEGORIES[wizardCategoryIndex].key);
          return;
        }
        // Quick number selection for categories
        if (input >= "1" && input <= "6") {
          const idx = parseInt(input, 10) - 1;
          if (idx < WIZARD_CATEGORIES.length) {
            handleSelectCategory(WIZARD_CATEGORIES[idx].key);
          }
          return;
        }
        return;
      }

      if (view === "add-template") {
        if (key.escape || input === "q") {
          setView("add-category");
          return;
        }
        // Guard against empty templates
        if (availableTemplates.length === 0) {
          return;
        }
        if (key.upArrow || key.downArrow) {
          const direction = key.upArrow ? "up" : "down";
          setWizardTemplateIndex((prev) => navigateList(direction, prev, availableTemplates.length));
          return;
        }
        if (key.return && availableTemplates[wizardTemplateIndex]) {
          handleInstallTemplate(availableTemplates[wizardTemplateIndex]);
          return;
        }
        // Quick number selection for templates
        if (input >= "1" && input <= "9") {
          const idx = parseInt(input, 10) - 1;
          if (idx < availableTemplates.length) {
            handleInstallTemplate(availableTemplates[idx]);
          }
          return;
        }
        return;
      }

      if (view === "add-installing") {
        if ((key.escape || input === "q") && installError) {
          setView("add-template");
          return;
        }
        return;
      }

      // Close on escape or 'q'
      if (key.escape || input === "q") {
        if (view === "list") {
          onClose();
        } else {
          setView("list");
        }
        return;
      }

      // Navigation (uses navigateList helper which handles empty arrays)
      if (key.upArrow || key.downArrow) {
        if (servers.length === 0) return;
        const direction = key.upArrow ? "up" : "down";
        setSelectedIndex((prev) => navigateList(direction, prev, servers.length));
        return;
      }

      // Quick number selection
      if (input >= "1" && input <= "9") {
        const index = parseInt(input, 10) - 1;
        if (index < servers.length) {
          setSelectedIndex(index);
          setView("detail");
        }
        return;
      }

      // Actions
      if (input === "a") {
        handleStartWizard();
        return;
      }

      if (input === "r") {
        handleRefresh();
        return;
      }

      if (input === "t" && servers[selectedIndex]) {
        setView("tools");
        return;
      }

      if (input === "h") {
        // Health check - could navigate to health view
        return;
      }

      // Enter to view server details
      if (key.return && servers[selectedIndex]) {
        const server = servers[selectedIndex];
        if (server.status === "disconnected" || server.status === "failed") {
          handleRetryConnection(server.name);
        } else {
          setView("detail");
        }
        return;
      }
    },
    { isActive: isVisible }
  );

  if (!isVisible) return null;

  const connectionStatus = getMCPConnectionStatus();

  // Server List View
  if (view === "list") {
    return (
      <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
        <Box marginBottom={1}>
          <Text color="cyan" bold>
            ⚙ MCP Server Dashboard
          </Text>
          <Text color="gray">
            {" "}
            ({connectionStatus.connected}/{connectionStatus.total} connected)
          </Text>
        </Box>

        {servers.length === 0 ? (
          <Box flexDirection="column" paddingY={1}>
            <Text color="yellow">No MCP servers configured</Text>
            <Text color="gray">
              Run `ax-cli mcp add &lt;name&gt; --template` to add a server
            </Text>
          </Box>
        ) : (
          <Box flexDirection="column">
            {servers.map((server, index) => {
              const isSelected = index === selectedIndex;
              const statusIcon = getServerStatusIcon(server.status);
              const statusColor = getServerStatusColor(server.status);

              return (
                <Box key={server.name} paddingLeft={1}>
                  <Text
                    color={isSelected ? "black" : "white"}
                    backgroundColor={isSelected ? "cyan" : undefined}
                  >
                    <Text color={isSelected ? "black" : statusColor}>{statusIcon}</Text>
                    {" "}
                    <Text bold>{server.name}</Text>
                    {" "}
                    <Text color={isSelected ? "black" : "gray"}>
                      {server.status === "connected"
                        ? `${server.toolCount} tools`
                        : server.status}
                    </Text>
                    {" "}
                    <Text color={isSelected ? "black" : "gray"} dimColor>
                      [{index + 1}]
                    </Text>
                  </Text>
                </Box>
              );
            })}
          </Box>
        )}

        <Box marginTop={1} borderStyle="single" borderTop borderBottom={false} borderLeft={false} borderRight={false} borderColor="gray">
          <Text color="gray" dimColor>
            [↑↓] navigate • [Enter] {servers[selectedIndex]?.status === "connected" ? "view" : "retry"} • [t] tools • [a] add • [r] refresh • [q] close
          </Text>
        </Box>
      </Box>
    );
  }

  // Server Detail View
  if (view === "detail") {
    const server = servers[selectedIndex];
    if (!server) {
      setView("list");
      return null;
    }

    return (
      <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
        <Box marginBottom={1}>
          <Text color="cyan" bold>
            ⚙ {server.name}
          </Text>
          <Text color={getServerStatusColor(server.status)}>
            {" "}
            ({server.status})
          </Text>
        </Box>

        <Box flexDirection="column" paddingLeft={1}>
          <Text>
            <Text color="gray">Transport:</Text> {server.transport || "stdio"}
          </Text>
          <Text>
            <Text color="gray">Status:</Text>{" "}
            <Text color={getServerStatusColor(server.status)}>
              {server.status}
            </Text>
          </Text>
          <Text>
            <Text color="gray">Tools:</Text> {server.toolCount} available
          </Text>
        </Box>

        {server.status === "connected" && server.tools && server.tools.length > 0 && (
          <Box flexDirection="column" marginTop={1}>
            <Text color="yellow" bold>
              Available Tools:
            </Text>
            <Box flexDirection="column" paddingLeft={1}>
              {server.tools.slice(0, 5).map((tool) => (
                <Text key={tool.name} color="gray">
                  • {tool.name.replace(`mcp__${server.name}__`, "")}
                </Text>
              ))}
              {server.tools.length > 5 && (
                <Text color="gray" dimColor>
                  ... and {server.tools.length - 5} more (press [t] to see all)
                </Text>
              )}
            </Box>
          </Box>
        )}

        <Box marginTop={1} borderStyle="single" borderTop borderBottom={false} borderLeft={false} borderRight={false} borderColor="gray">
          <Text color="gray" dimColor>
            [t] view all tools • [r] refresh • [Esc] back • [q] close
          </Text>
        </Box>
      </Box>
    );
  }

  // Tools View
  if (view === "tools") {
    const server = servers[selectedIndex];
    if (!server || !server.tools) {
      setView("list");
      return null;
    }

    return (
      <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
        <Box marginBottom={1}>
          <Text color="cyan" bold>
            🔧 {server.name} Tools
          </Text>
          <Text color="gray"> ({server.tools.length} available)</Text>
        </Box>

        <Box flexDirection="column" paddingLeft={1}>
          {server.tools.map((tool, i) => {
            const displayName = tool.name.replace(`mcp__${server.name}__`, "");
            const isLast = i === (server.tools?.length ?? 0) - 1;
            const prefix = isLast ? "└─" : "├─";

            return (
              <Box key={tool.name} flexDirection="column">
                <Text>
                  <Text color="gray">{prefix}</Text> <Text bold>{displayName}</Text>
                </Text>
                {tool.description && (
                  <Text color="gray" dimColor>
                    {"   "}{tool.description.slice(0, 60)}
                    {tool.description.length > 60 ? "..." : ""}
                  </Text>
                )}
              </Box>
            );
          })}
        </Box>

        <Box marginTop={1} borderStyle="single" borderTop borderBottom={false} borderLeft={false} borderRight={false} borderColor="gray">
          <Text color="gray" dimColor>
            [Esc] back • [q] close
          </Text>
        </Box>
      </Box>
    );
  }

  // Wizard - Category Selection View
  if (view === "add-category") {
    return (
      <Box flexDirection="column" borderStyle="round" borderColor="green" paddingX={1}>
        <Box marginBottom={1}>
          <Text color="green" bold>
            ➕ Add MCP Server - Step 1/2
          </Text>
        </Box>

        <Box marginBottom={1}>
          <Text color="white" bold>
            What kind of tools do you need?
          </Text>
        </Box>

        <Box flexDirection="column">
          {WIZARD_CATEGORIES.map((cat, index) => {
            const isSelected = index === wizardCategoryIndex;
            return (
              <Box key={cat.key} paddingLeft={1}>
                <Text
                  color={isSelected ? "black" : "white"}
                  backgroundColor={isSelected ? "green" : undefined}
                >
                  {cat.label}
                  {" "}
                  <Text color={isSelected ? "black" : "gray"} dimColor={!isSelected}>
                    - {cat.desc}
                  </Text>
                  {" "}
                  <Text color={isSelected ? "black" : "gray"} dimColor>
                    [{index + 1}]
                  </Text>
                </Text>
              </Box>
            );
          })}
        </Box>

        <Box marginTop={1} borderStyle="single" borderTop borderBottom={false} borderLeft={false} borderRight={false} borderColor="gray">
          <Text color="gray" dimColor>
            [↑↓] navigate • [Enter] select • [Esc] cancel
          </Text>
        </Box>
      </Box>
    );
  }

  // Wizard - Template Selection View
  if (view === "add-template") {
    return (
      <Box flexDirection="column" borderStyle="round" borderColor="green" paddingX={1}>
        <Box marginBottom={1}>
          <Text color="green" bold>
            ➕ Add MCP Server - Step 2/2
          </Text>
          <Text color="gray"> ({selectedCategory})</Text>
        </Box>

        <Box marginBottom={1}>
          <Text color="white" bold>
            Select a server to install:
          </Text>
        </Box>

        {availableTemplates.length === 0 ? (
          <Box paddingY={1}>
            <Text color="yellow">No templates available for this category</Text>
          </Box>
        ) : (
          <Box flexDirection="column">
            {availableTemplates.map((template, index) => {
              const isSelected = index === wizardTemplateIndex;
              const officialBadge = template.officialServer ? "✓" : "";
              return (
                <Box key={template.name} paddingLeft={1} flexDirection="column">
                  <Text
                    color={isSelected ? "black" : "white"}
                    backgroundColor={isSelected ? "green" : undefined}
                  >
                    {officialBadge && <Text color={isSelected ? "black" : "green"}>{officialBadge} </Text>}
                    <Text bold>{template.name}</Text>
                    {" "}
                    <Text color={isSelected ? "black" : "gray"} dimColor>
                      [{index + 1}]
                    </Text>
                  </Text>
                  <Box paddingLeft={2}>
                    <Text color="gray" dimColor>
                      {"   "}{template.description.slice(0, 50)}
                      {template.description.length > 50 ? "..." : ""}
                    </Text>
                  </Box>
                  {template.requiredEnv.length > 0 && (
                    <Box paddingLeft={2}>
                      <Text color="yellow" dimColor>
                        {"   "}⚠ Requires: {template.requiredEnv.map(e => e.name).join(", ")}
                      </Text>
                    </Box>
                  )}
                </Box>
              );
            })}
          </Box>
        )}

        <Box marginTop={1} borderStyle="single" borderTop borderBottom={false} borderLeft={false} borderRight={false} borderColor="gray">
          <Text color="gray" dimColor>
            [↑↓] navigate • [Enter] install • [Esc] back
          </Text>
        </Box>
      </Box>
    );
  }

  // Wizard - Installing View
  if (view === "add-installing") {
    return (
      <Box flexDirection="column" borderStyle="round" borderColor="green" paddingX={1}>
        <Box marginBottom={1}>
          <Text color="green" bold>
            ➕ Installing MCP Server
          </Text>
        </Box>

        {installError ? (
          <Box flexDirection="column" paddingY={1}>
            <Text color="red" bold>❌ Installation Failed</Text>
            <Box marginTop={1}>
              <Text color="red">{installError}</Text>
            </Box>
          </Box>
        ) : (
          <Box flexDirection="column" paddingY={1}>
            <Text color="cyan">
              {installStatus.startsWith("✅") ? "" : "⏳ "}{installStatus}
            </Text>
          </Box>
        )}

        <Box marginTop={1} borderStyle="single" borderTop borderBottom={false} borderLeft={false} borderRight={false} borderColor="gray">
          <Text color="gray" dimColor>
            {installError ? "[Esc] back • [q] close" : "Please wait..."}
          </Text>
        </Box>
      </Box>
    );
  }

  return null;
}

export default MCPDashboard;
