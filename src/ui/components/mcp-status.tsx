import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import { getMCPConnectionStatus } from "../../llm/tools.js";

interface MCPStatusProps {}

interface MCPConnectionStatus {
  connected: number;
  failed: number;
  connecting: number;
  total: number;
}

export function MCPStatus({}: MCPStatusProps) {
  const [status, setStatus] = useState<MCPConnectionStatus>({
    connected: 0,
    failed: 0,
    connecting: 0,
    total: 0,
  });

  useEffect(() => {
    const updateStatus = () => {
      const newStatus = getMCPConnectionStatus();
      setStatus(newStatus);
    };

    // Initial update with a small delay to allow MCP initialization
    const initialTimer = setTimeout(updateStatus, 2000);

    // Set up polling to check for status changes
    const interval = setInterval(updateStatus, 2000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, []);

  // Don't show if no servers configured
  if (status.total === 0) {
    return null;
  }

  // Determine color and symbol based on status
  let color: string;
  let symbol: string;

  if (status.failed > 0) {
    color = "red";
    symbol = "✗";
  } else if (status.connecting > 0) {
    color = "yellow";
    symbol = "◐";
  } else if (status.connected === status.total) {
    color = "green";
    symbol = "✓";
  } else {
    color = "yellow";
    symbol = "○";
  }

  return (
    <Box marginLeft={1}>
      <Text color={color}>⚒ mcp: {symbol} {status.connected}/{status.total} </Text>
    </Box>
  );
}
