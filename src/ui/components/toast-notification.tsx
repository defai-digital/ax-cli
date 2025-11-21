/**
 * Toast Notification Component
 * Brief, auto-dismissing notifications for user feedback
 *
 * Used for mode toggles (Ctrl+B, Ctrl+O) and other transient feedback
 * that shouldn't pollute chat history.
 */

import React, { useState, useEffect } from "react";
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

/**
 * Get icon and color based on toast type
 */
function getToastStyle(type: ToastMessage["type"]) {
  switch (type) {
    case "success":
      return { icon: "✓", color: "green", bgColor: "greenBright" };
    case "warning":
      return { icon: "⚠", color: "yellow", bgColor: "yellowBright" };
    case "error":
      return { icon: "✕", color: "red", bgColor: "redBright" };
    case "info":
    default:
      return { icon: "ℹ", color: "cyan", bgColor: "cyanBright" };
  }
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
    const fadeTimer = setTimeout(() => {
      setFadeOut(true);
    }, duration - 300);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
 */
export function useToasts() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (toast: Omit<ToastMessage, "id">) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
    return id;
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const clearToasts = () => {
    setToasts([]);
  };

  // Convenience methods
  const success = (message: string, icon?: string, duration?: number) =>
    addToast({ message, type: "success", icon, duration });

  const info = (message: string, icon?: string, duration?: number) =>
    addToast({ message, type: "info", icon, duration });

  const warning = (message: string, icon?: string, duration?: number) =>
    addToast({ message, type: "warning", icon, duration });

  const error = (message: string, icon?: string, duration?: number) =>
    addToast({ message, type: "error", icon, duration });

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
  autoEditOn: { message: "Auto-edit ON - confirmations bypassed", type: "warning" as const, icon: "⚡" },
  autoEditOff: { message: "Auto-edit OFF - confirmations enabled", type: "info" as const, icon: "🛡️" },

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
};

export default ToastNotification;
