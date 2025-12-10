/**
 * Welcome Panel Component
 * Shows helpful tips and example prompts when chat is empty
 * Features provider-specific branding and animated ASCII robot avatar during startup
 */

import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import type { TextProps } from "ink";

/** Provider branding info for welcome panel */
export interface ProviderBranding {
  cliName: string;
  primaryColor: string;
  secondaryColor: string;
  asciiLogo: string;
  tagline: string;
}

/** Default branding (fallback) - Cool tones for AX-CLI */
const DEFAULT_BRANDING: ProviderBranding = {
  cliName: 'ax-cli',
  primaryColor: 'blue',
  secondaryColor: 'magenta',
  asciiLogo: `
   █████╗ ██╗  ██╗      ██████╗██╗     ██╗
  ██╔══██╗╚██╗██╔╝     ██╔════╝██║     ██║
  ███████║ ╚███╔╝█████╗██║     ██║     ██║
  ██╔══██║ ██╔██╗╚════╝██║     ██║     ██║
  ██║  ██║██╔╝ ██╗     ╚██████╗███████╗██║
  ╚═╝  ╚═╝╚═╝  ╚═╝      ╚═════╝╚══════╝╚═╝`,
  tagline: 'AI Coding Assistant',
};

interface ExamplePrompt {
  category: string;
  examples: string[];
}

/** Animation configuration */
const ANIMATION_CONFIG = {
  /** Total animation duration in milliseconds */
  DURATION_MS: 6000,
  /** Number of frames (derived from AVATAR_FRAMES.length) */
  get FRAME_DURATION_MS() {
    return this.DURATION_MS / AVATAR_FRAMES.length;
  },
} as const;

/**
 * Animated ASCII Robot Avatar Frames
 * - Frame duration: ANIMATION_CONFIG.DURATION_MS / frame count
 * - Last frame returns to idle for smooth loop
 */
const AVATAR_FRAMES = [
  `

  ┌───────┐
  │ ■   ■ │
  │   ◡   │
  └───────┘
    │ │ │
    └─┴─┘     `,

  // Frame 2: Waving/Greeting (1-2s)
  `

  ┌───────┐
  │ ●   ● │  ╲
  │   ⌣   │
  └───────┘
    │ │ │
    └─┴─┘     `,

  // Frame 3: Happy/Laughing (2-3s)
  `

  ┌───────┐
  │ ^   ^ │
  │   ⌣   │
  └───────┘
    │ │ │
    └─┴─┘     `,

  // Frame 4: Thinking/Processing (3-4s)
  `

  ┌───────┐
  │ ◉   ◉ │ ≈≈
  │   ~   │
  └───────┘
    │ │ │
    └─┴─┘     `,

  // Frame 5: Excited/Ready (4-5s)
  `

  ┌───────┐
  │ ★   ★ │
  │   ◠   │
  └───────┘
   ╲│ │ │╱
    └─┴─┘     `,

  // Frame 6: Back to Idle (5-6s, same as Frame 1)
  `

  ┌───────┐
  │ ■   ■ │
  │   ◡   │
  └───────┘
    │ │ │
    └─┴─┘     `,
];

const EXAMPLE_PROMPTS: ExamplePrompt[] = [
  {
    category: "Explore",
    examples: [
      "What does this codebase do?",
      "Find all TODO comments",
      "Show me the main entry point",
    ],
  },
  {
    category: "Edit",
    examples: [
      "Add error handling to the login function",
      "Refactor this component to use hooks",
      "Fix the TypeScript errors in utils.ts",
    ],
  },
  {
    category: "Create",
    examples: [
      "Create a new React component for user profile",
      "Add unit tests for the auth module",
      "Generate a README for this project",
    ],
  },
  {
    category: "Execute",
    examples: [
      "Run the test suite",
      "Install lodash as a dependency",
      "Show git status",
    ],
  },
];

interface WelcomePanelProps {
  projectName: string;
  branding?: ProviderBranding;
}

export function WelcomePanel({ projectName: _projectName, branding = DEFAULT_BRANDING }: WelcomePanelProps) {
  // Use branding colors
  const primaryColor = branding.primaryColor as TextProps['color'];
  // Animation state - cycle through frames during first 6 seconds
  const [currentFrame, setCurrentFrame] = useState(0);
  const [animationActive, setAnimationActive] = useState(true);

  useEffect(() => {
    const frameDuration = ANIMATION_CONFIG.FRAME_DURATION_MS;

    // Cycle through frames
    const frameInterval = setInterval(() => {
      setCurrentFrame((prev) => {
        const nextFrame = prev + 1;
        if (nextFrame >= AVATAR_FRAMES.length) {
          // Animation complete - stop and rest on last frame
          clearInterval(frameInterval);
          setAnimationActive(false);
          return AVATAR_FRAMES.length - 1;
        }
        return nextFrame;
      });
    }, frameDuration);

    // Cleanup on unmount
    return () => {
      clearInterval(frameInterval);
    };
  }, []);

  return (
    <Box flexDirection="column" marginBottom={2}>
      {/* Logo and Welcome Text in parallel */}
      <Box flexDirection="row" marginBottom={1}>
        {/* Robot Avatar Logo - Animated! */}
        <Box marginRight={2}>
          <Text color={animationActive ? primaryColor : (branding.secondaryColor as TextProps['color'])}>
            {AVATAR_FRAMES[currentFrame]}
          </Text>
        </Box>

        {/* Provider-specific ASCII Logo */}
        <Box flexDirection="column">
          <Text color={primaryColor}>
            {branding.asciiLogo}
          </Text>
          <Box marginTop={1}>
            <Text color={branding.secondaryColor as TextProps['color']} dimColor>
              {branding.tagline}
            </Text>
          </Box>
        </Box>
      </Box>

      {/* Keyboard shortcuts - prominent display */}
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={primaryColor}
        paddingX={2}
        paddingY={1}
        marginBottom={1}
      >
        <Box marginBottom={1}>
          <Text color={primaryColor} bold>
            Essential Shortcuts
          </Text>
        </Box>

        <Box flexDirection="row" flexWrap="wrap">
          {/* Column 1: Mode toggles */}
          <Box flexDirection="column" marginRight={4} minWidth={28}>
            <Text color="yellow" bold>Modes</Text>
            <Box>
              <Text color="yellow" bold>⇧⇥</Text>
              <Text color="gray"> Shift+Tab  </Text>
              <Text>auto-edit</Text>
            </Box>
            <Box>
              <Text color="yellow" bold>^O</Text>
              <Text color="gray"> Ctrl+O     </Text>
              <Text>verbose output</Text>
            </Box>
            <Box>
              <Text color="magenta" bold>^B</Text>
              <Text color="gray"> Ctrl+B     </Text>
              <Text>background mode</Text>
            </Box>
          </Box>

          {/* Column 2: Actions */}
          <Box flexDirection="column" minWidth={28}>
            <Text color="yellow" bold>Actions</Text>
            <Box>
              <Text color={primaryColor} bold>^K</Text>
              <Text color="gray"> Ctrl+K     </Text>
              <Text>quick actions</Text>
            </Box>
            <Box>
              <Text color="green" bold>^P</Text>
              <Text color="gray"> Ctrl+P     </Text>
              <Text>toggle paste</Text>
            </Box>
            <Box>
              <Text color="white" bold>?</Text>
              <Text color="gray">  or /help  </Text>
              <Text>all shortcuts</Text>
            </Box>
            <Box>
              <Text color="red" bold>Esc</Text>
              <Text color="gray">           </Text>
              <Text>interrupt/cancel</Text>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Quick start tips */}
      <Box
        flexDirection="column"
        paddingX={1}
        marginBottom={1}
      >
        <Box marginBottom={1}>
          <Text color="white" bold>
            Quick Start
          </Text>
        </Box>

        <Box flexDirection="column">
          <Box>
            <Text color="gray">• </Text>
            <Text>Type naturally to ask questions or request changes</Text>
          </Box>
          <Box>
            <Text color="gray">• </Text>
            <Text>Use </Text>
            <Text color={primaryColor}>/init</Text>
            <Text> to generate project context (CUSTOM.md)</Text>
          </Box>
          <Box>
            <Text color="gray">• </Text>
            <Text>Run </Text>
            <Text color={primaryColor}>/memory warmup</Text>
            <Text> to cache project context (faster AI responses)</Text>
          </Box>
          <Box>
            <Text color="gray">• </Text>
            <Text>Append </Text>
            <Text color={primaryColor}>&</Text>
            <Text> to bash commands for background execution</Text>
          </Box>
        </Box>
      </Box>

      {/* Example prompts */}
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text color="gray" dimColor>
            Try asking:
          </Text>
        </Box>

        <Box flexDirection="row" flexWrap="wrap">
          {EXAMPLE_PROMPTS.map((group) => (
            <Box
              key={group.category}
              flexDirection="column"
              marginRight={3}
              marginBottom={1}
              width="45%"
            >
              <Text color="magenta" dimColor>
                {group.category}
              </Text>
              {group.examples.slice(0, 2).map((example, i) => (
                <Box key={i} marginLeft={1}>
                  <Text color="gray" dimColor>
                    › {example}
                  </Text>
                </Box>
              ))}
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}

export default WelcomePanel;
