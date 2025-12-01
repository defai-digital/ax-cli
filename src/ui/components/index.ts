/**
 * UI Components exports
 */

export { ChatHistory } from './chat-history.js';
export { VirtualizedChatHistory } from './virtualized-chat-history.js';
export { ChatInput } from './chat-input.js';
export { LoadingSpinner } from './loading-spinner.js';
export { CommandSuggestions } from './command-suggestions.js';
export { MCPStatus } from './mcp-status.js';
export { ReasoningDisplay } from './reasoning-display.js';

// New UX-enhanced components
export { StatusBar } from './status-bar.js';
export { QuickActions } from './quick-actions.js';
export { WelcomePanel } from './welcome-panel.js';
export { KeyboardHints, KeyboardShortcutGuide, getKeyboardShortcutGuideText, ALL_SHORTCUTS } from './keyboard-hints.js';
export { CollapsibleToolResult, getToolActionName, getFilePath } from './collapsible-tool-result.js';
export { ToastNotification, ToastContainer, useToasts, TOAST_MESSAGES } from './toast-notification.js';
export type { ToastMessage } from './toast-notification.js';

// Multi-phase planning components
export { PhaseProgress, PlanSummary } from './phase-progress.js';
