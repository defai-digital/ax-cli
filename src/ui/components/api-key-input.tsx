import React, { useState } from "react";
import { Box, Text, useInput, useApp } from "ink";
import { GrokAgent } from "../../agent/grok-agent.js";
import { getSettingsManager } from "../../utils/settings-manager.js";
import { loadMessagesConfig, formatMessage } from "../../utils/config-loader.js";

// Load UI messages from YAML configuration
const messages = loadMessagesConfig();
const uiMessages = messages.ui?.api_key_input || {};

interface ApiKeyInputProps {
  onApiKeySet: (agent: GrokAgent) => void;
}

export default function ApiKeyInput({ onApiKeySet }: ApiKeyInputProps) {
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { exit } = useApp();

  useInput((inputChar, key) => {
    if (isSubmitting) return;

    if (key.ctrl && inputChar === "c") {
      exit();
      return;
    }

    if (key.return) {
      handleSubmit();
      return;
    }


    if (key.backspace || key.delete) {
      setInput((prev) => prev.slice(0, -1));
      setError("");
      return;
    }

    if (inputChar && !key.ctrl && !key.meta) {
      setInput((prev) => prev + inputChar);
      setError("");
    }
  });


  const handleSubmit = async () => {
    if (!input.trim()) {
      setError(uiMessages.error_empty || "API key cannot be empty");
      return;
    }

    setIsSubmitting(true);
    try {
      const apiKey = input.trim();
      const agent = new GrokAgent(apiKey);

      // Set environment variable for current process
      process.env.YOUR_API_KEY = apiKey;

      // Save to user settings
      try {
        const manager = getSettingsManager();
        const settingsPath = manager.getUserSettingsPath();
        manager.updateUserSetting('apiKey', apiKey);

        const successMsg = formatMessage(
          uiMessages.success_saved || "✅ API key saved to {path}",
          { path: settingsPath }
        );
        console.log(`\n${successMsg}`);
      } catch {
        console.log(`\n${uiMessages.warning_not_saved || "⚠️ Could not save API key to settings file"}`);
        console.log(uiMessages.session_only || "API key set for current session only");
      }

      onApiKeySet(agent);
    } catch {
      setError(uiMessages.error_invalid || "Invalid API key format");
      setIsSubmitting(false);
    }
  };

  const displayText = input.length > 0 ?
    (isSubmitting ? "*".repeat(input.length) : "*".repeat(input.length) + "█") :
    (isSubmitting ? " " : "█");

  // Get settings path for display
  const manager = getSettingsManager();
  const settingsPath = manager.getUserSettingsPath();
  const saveLocationMsg = formatMessage(
    uiMessages.save_location || "Note: API key will be saved to {path}",
    { path: settingsPath }
  );

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Text color="yellow">{uiMessages.title || "🔑 Grok API Key Required"}</Text>
      <Box marginBottom={1}>
        <Text color="gray">{uiMessages.prompt || "Please enter your Grok API key to continue:"}</Text>
      </Box>

      <Box borderStyle="round" borderColor="blue" paddingX={1} marginBottom={1}>
        <Text color="gray">❯ </Text>
        <Text>{displayText}</Text>
      </Box>

      {error ? (
        <Box marginBottom={1}>
          <Text color="red">❌ {error}</Text>
        </Box>
      ) : null}

      <Box flexDirection="column" marginTop={1}>
        <Text color="gray" dimColor>{uiMessages.help_submit || "• Press Enter to submit"}</Text>
        <Text color="gray" dimColor>{uiMessages.help_exit || "• Press Ctrl+C to exit"}</Text>
        <Text color="gray" dimColor>{saveLocationMsg}</Text>
      </Box>

      {isSubmitting ? (
        <Box marginTop={1}>
          <Text color="yellow">{uiMessages.validating || "🔄 Validating API key..."}</Text>
        </Box>
      ) : null}
    </Box>
  );
}