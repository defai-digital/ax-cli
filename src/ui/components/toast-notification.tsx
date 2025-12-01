/**
 * Toast Notification Component
 * Brief, auto-dismissing notifications for user feedback
 *
 * Used for mode toggles (Ctrl+B, Ctrl+O) and other transient feedback
 * that shouldn't pollute chat history.
 */

import React, { useState, useEffect, useCallback } from "react";
import { Box, Text } from "ink";

export interface ToastMessage {
  id: string;
  message: string;
  type: "success" | "info" | "warning" | "error";
  icon?: string;
  duration?: number; // ms, default 2000
}

interface ToastNotificationProps {
  toast: ToastMessage | null;
  onDismiss?: () => void;
}

/** Toast styles lookup table for O(1) access */
const TOAST_STYLES: Record<ToastMessage["type"], { icon: string; color: string; bgColor: string }> = {
  success: { icon: "✓", color: "green", bgColor: "greenBright" },
  warning: { icon: "⚠", color: "yellow", bgColor: "yellowBright" },
  error: { icon: "✕", color: "red", bgColor: "redBright" },
  info: { icon: "ℹ", color: "cyan", bgColor: "cyanBright" },
};

const DEFAULT_TOAST_STYLE = TOAST_STYLES.info;

function getToastStyle(type: ToastMessage["type"]) {
  return TOAST_STYLES[type] ?? DEFAULT_TOAST_STYLE;
}

/**
 * Single Toast Component
 */
export function ToastNotification({ toast, onDismiss }: ToastNotificationProps) {
  const [visible, setVisible] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    if (!toast) {
      setVisible(false);
      return;
    }

    // Show toast
    setVisible(true);
    setFadeOut(false);

    const duration = toast.duration || 2000;

    // Start fade out slightly before hiding
    // Ensure fade delay is positive (minimum 100ms before fade starts)
    const fadeDelay = Math.max(100, duration - 300);
    const fadeTimer = setTimeout(() => {
      setFadeOut(true);
    }, fadeDelay);

    // Hide and dismiss
    const hideTimer = setTimeout(() => {
      setVisible(false);
      try {
        onDismiss?.();
      } catch {
        // Prevent callback errors from crashing the component
      }
    }, duration);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, [toast]); // Intentionally exclude onDismiss to prevent timer reset on re-render

  if (!visible || !toast) return null;

  const style = getToastStyle(toast.type);
  const icon = toast.icon || style.icon;

  return (
    <Box
      marginBottom={1}
      paddingX={1}
    >
      <Box
        borderStyle="round"
        borderColor={fadeOut ? "gray" : style.color}
        paddingX={2}
        paddingY={0}
      >
        <Text color={fadeOut ? "gray" : style.color} bold>
          {icon}
        </Text>
        <Text color={fadeOut ? "gray" : "white"}>
          {" "}{toast.message}
        </Text>
      </Box>
    </Box>
  );
}

/**
 * Toast Container - manages multiple toasts with queue
 */
interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
  maxVisible?: number;
}

export function ToastContainer({
  toasts,
  onDismiss,
  maxVisible = 3
}: ToastContainerProps) {
  const visibleToasts = toasts.slice(0, maxVisible);

  if (visibleToasts.length === 0) return null;

  return (
    <Box flexDirection="column">
      {visibleToasts.map((toast) => (
        <ToastNotification
          key={toast.id}
          toast={toast}
          onDismiss={() => onDismiss(toast.id)}
        />
      ))}
    </Box>
  );
}

/**
 * Hook for managing toast state
 *
 * IMPORTANT: All returned functions are memoized with useCallback to prevent
 * infinite re-render loops when used in useEffect dependency arrays.
 */
export function useToasts() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Memoize addToast to prevent infinite loops when used in useEffect deps
  const addToast = useCallback((toast: Omit<ToastMessage, "id">) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
    return id;
  }, []);

  // Memoize removeToast for stable reference
  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Memoize clearToasts for stable reference
  const clearToasts = useCallback(() => {
    setToasts([]);
  }, []);

  // Convenience methods - memoized to prevent re-renders
  const success = useCallback((message: string, icon?: string, duration?: number) =>
    addToast({ message, type: "success", icon, duration }), [addToast]);

  const info = useCallback((message: string, icon?: string, duration?: number) =>
    addToast({ message, type: "info", icon, duration }), [addToast]);

  const warning = useCallback((message: string, icon?: string, duration?: number) =>
    addToast({ message, type: "warning", icon, duration }), [addToast]);

  const error = useCallback((message: string, icon?: string, duration?: number) =>
    addToast({ message, type: "error", icon, duration }), [addToast]);

  return {
    toasts,
    addToast,
    removeToast,
    clearToasts,
    success,
    info,
    warning,
    error,
  };
}

/**
 * Pre-defined toast messages for common actions
 */
export const TOAST_MESSAGES = {
  // Mode toggles
  verboseOn: { message: "Verbose mode ON - showing full details", type: "success" as const, icon: "📋" },
  verboseOff: { message: "Verbose mode OFF - concise output", type: "info" as const, icon: "📄" },
  backgroundOn: { message: "Background mode ON - commands run in background", type: "success" as const, icon: "🔄" },
  backgroundOff: { message: "Background mode OFF - foreground execution", type: "info" as const, icon: "▶️" },
  autoEditOn: { message: "Auto-Edit ON - changes applied automatically", type: "warning" as const, icon: "⚡" },
  autoEditOff: { message: "Auto-Edit OFF - requires confirmation", type: "info" as const, icon: "🛡️" },
  thinkingOn: { message: "Thinking mode ON - showing reasoning process", type: "success" as const, icon: "🧠" },
  thinkingOff: { message: "Thinking mode OFF - direct responses", type: "info" as const, icon: "⚡" },

  // Background task operations
  taskMoved: (taskId: string) => ({
    message: `Command moved to background (${taskId})`,
    type: "success" as const,
    icon: "📦"
  }),

  // Other common actions
  cleared: { message: "Chat history cleared", type: "info" as const, icon: "🗑️" },
  copied: { message: "Copied to clipboard", type: "success" as const, icon: "📋" },
  saved: { message: "Changes saved", type: "success" as const, icon: "💾" },
  interrupted: { message: "Operation cancelled", type: "warning" as const, icon: "⏹️" },
  contextLow: { message: "Context running low - consider /clear", type: "warning" as const, icon: "⚠️" },

  // External editor (P2.3)
  editorOpening: (editorName: string) => ({
    message: `Opening ${editorName}... (save and close to apply changes)`,
    type: "info" as const,
    icon: "✏️"
  }),
  editorSuccess: { message: "Changes applied from editor", type: "success" as const, icon: "✅" },
  editorCancelled: { message: "Editor cancelled - no changes", type: "info" as const, icon: "↩️" },
  editorError: (error: string) => ({
    message: `Editor error: ${error}`,
    type: "error" as const,
    icon: "❌"
  }),

  // Memory operations
  memoryWarmed: (tokens: number) => ({
    message: `Memory cached (${tokens.toLocaleString()} tokens)`,
    type: "success" as const,
    icon: "💾",
    duration: 3000,
  }),
  memoryRefreshed: { message: "Memory context refreshed", type: "success" as const, icon: "🔄" },
  memoryCacheHit: { message: "Using cached memory context", type: "info" as const, icon: "⚡", duration: 1500 },

  // Checkpoint operations
  checkpointCreated: { message: "Checkpoint saved", type: "success" as const, icon: "💾", duration: 2000 },
  checkpointRestored: { message: "Checkpoint restored", type: "success" as const, icon: "↩️", duration: 2000 },

  // Background task notifications
  taskCompleted: (_taskId: string, command: string) => ({
    message: `Task done: ${command.length > 30 ? command.slice(0, 30) + '...' : command}`,
    type: "success" as const,
    icon: "✅",
    duration: 3000,
  }),
  taskFailed: (_taskId: string, command: string) => ({
    message: `Task failed: ${command.length > 30 ? command.slice(0, 30) + '...' : command}`,
    type: "error" as const,
    icon: "❌",
    duration: 4000,
  }),

  // Phase 3: Large paste handling
  pasteTruncated: (originalLength: number, truncatedLength: number) => ({
    message: `Paste truncated: ${originalLength.toLocaleString()} → ${truncatedLength.toLocaleString()} chars. Use --file flag for full content.`,
    type: "error" as const,
    icon: "✂️",
    duration: 6000,
  }),

  pasteTruncationDisabled: (charCount: number) => ({
    message: `Large paste allowed (${charCount.toLocaleString()} chars). May be truncated by terminal!`,
    type: "warning" as const,
    icon: "⚠️",
    duration: 5000,
  }),
};

export default ToastNotification;
