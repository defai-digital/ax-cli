import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useInputModes, getVerbosityDisplayText } from '../../../packages/core/src/ui/hooks/use-input-modes.js';
import { useKeyboardShortcuts } from '../../../packages/core/src/ui/hooks/use-keyboard-shortcuts.js';
import { VerbosityLevel } from '../../../packages/core/src/constants.js';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.window = dom.window as unknown as Window & typeof globalThis;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', {
  value: dom.window.navigator,
  configurable: true,
});

const sessionFlags = { allOperations: false, fileOperations: false, bashCommands: false };
const confirmationInstance = {
  getSessionFlags: vi.fn(() => ({ ...sessionFlags })),
  setSessionFlag: vi.fn((key: string, value: boolean) => {
    (sessionFlags as any)[key] = value;
  }),
  resetSession: vi.fn(() => {
    sessionFlags.allOperations = false;
    sessionFlags.fileOperations = false;
    sessionFlags.bashCommands = false;
  }),
};

vi.mock('../../../packages/core/src/utils/confirmation-service.js', () => ({
  ConfirmationService: {
    getInstance: vi.fn(() => confirmationInstance),
  },
}));

const createAgent = () => ({
  isBashExecuting: vi.fn(() => false),
  moveBashToBackground: vi.fn(() => 'task-1'),
  setThinkingConfig: vi.fn(),
  abortCurrentOperation: vi.fn(),
});

describe('useInputModes', () => {
  beforeEach(() => {
    confirmationInstance.resetSession();
    vi.clearAllMocks();
  });

  it('toggles modes, updates session flags, and notifies callbacks', () => {
    const callbacks = {
      onAutoEditModeChange: vi.fn(),
      onVerboseModeChange: vi.fn(),
      onBackgroundModeChange: vi.fn(),
      onTaskMovedToBackground: vi.fn(),
      onThinkingModeChange: vi.fn(),
    };
    const agent = createAgent();

    const { result } = renderHook(() => useInputModes({ agent, callbacks }));

    act(() => result.current.toggleAutoEditMode());
    expect(confirmationInstance.setSessionFlag).toHaveBeenCalledWith('allOperations', true);
    expect(callbacks.onAutoEditModeChange).toHaveBeenCalledWith(true);

    act(() => result.current.handleVerboseToggle());
    expect(result.current.verbosityLevel).toBe(VerbosityLevel.CONCISE);
    act(() => result.current.handleVerboseToggle());
    expect(result.current.verboseMode).toBe(true);
    expect(getVerbosityDisplayText(result.current.verbosityLevel)).toBe('Verbose');

    agent.isBashExecuting.mockReturnValueOnce(true);
    act(() => result.current.handleBackgroundModeToggle());
    expect(agent.moveBashToBackground).toHaveBeenCalled();
    expect(callbacks.onTaskMovedToBackground).toHaveBeenCalledWith('task-1');

    act(() => result.current.handleThinkingModeToggle());
    expect(agent.setThinkingConfig).toHaveBeenCalledWith({ type: 'disabled' });
    expect(callbacks.onThinkingModeChange).toHaveBeenCalledWith(false);
  });
});

describe('useKeyboardShortcuts', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('handles command/resource suggestion selection and auto-edit toggle', () => {
    const agent = createAgent();
    let isProcessing = false;
    let isStreaming = false;
    let showCommandSuggestions = true;
    let suggestionMode: 'command' | 'resource' = 'resource';
    let resourceSuggestions: unknown[] = [];
    let selectedCommandIndex = 0;
    let input = '@mcp:partial';
    let cursorPosition = 0;

    const { result } = renderHook(() => useKeyboardShortcuts({
      agent,
      isProcessing,
      isStreaming,
      setIsProcessing: (v) => { isProcessing = v; },
      setIsStreaming: (v) => { isStreaming = v; },
      setTokenCount: vi.fn(),
      setProcessingTime: vi.fn(),
      processingStartTime: { current: 0 },
      onAutoEditModeChange: vi.fn(),
      onOperationInterrupted: vi.fn(),
    }));

    act(() => {
      const handled = result.current.handleSpecialKey(
        { tab: true } as any,
        {
          showCommandSuggestions,
          setShowCommandSuggestions: (v) => { showCommandSuggestions = v; },
          setSelectedCommandIndex: (v) => { selectedCommandIndex = typeof v === 'function' ? v(selectedCommandIndex) : v; },
          suggestionMode,
          setResourceSuggestions: (v) => { resourceSuggestions = v; },
          setSuggestionMode: (v) => { suggestionMode = v; },
          currentSuggestions: [{ command: '@mcp:full', description: 'ref' }],
          selectedCommandIndex,
          input,
          setInput: (v) => { input = v; },
          setCursorPosition: (v) => { cursorPosition = v; },
        }
      );
      expect(handled).toBe(true);
    });

    expect(showCommandSuggestions).toBe(false);
    expect(suggestionMode).toBe('command');
    expect(input).toBe('@mcp:full ');
    expect(cursorPosition).toBe(input.length);

    act(() => {
      const handled = result.current.handleSpecialKey(
        { shift: true, tab: true } as any,
        {
          showCommandSuggestions: false,
          setShowCommandSuggestions: vi.fn(),
          setSelectedCommandIndex: vi.fn(),
          suggestionMode: 'command',
          setResourceSuggestions: vi.fn(),
          setSuggestionMode: vi.fn(),
          currentSuggestions: [],
          selectedCommandIndex: 0,
          input: '',
          setInput: vi.fn(),
          setCursorPosition: vi.fn(),
        }
      );
      expect(handled).toBe(true);
    });
    expect(confirmationInstance.setSessionFlag).toHaveBeenCalledWith('allOperations', true);
  });

  it('aborts processing on escape when busy', () => {
    const agent = createAgent();
    let isProcessing = true;
    let isStreaming = true;
    let tokenCount = 5;
    let processingTime = 10;
    const processingStartTime = { current: 42 };

    const { result } = renderHook(() => useKeyboardShortcuts({
      agent,
      isProcessing,
      isStreaming,
      setIsProcessing: (v) => { isProcessing = v; },
      setIsStreaming: (v) => { isStreaming = v; },
      setTokenCount: (v) => { tokenCount = v; },
      setProcessingTime: (v) => { processingTime = v; },
      processingStartTime,
      onOperationInterrupted: vi.fn(),
    }));

    act(() => {
      const handled = result.current.handleSpecialKey(
        { escape: true } as any,
        {
          showCommandSuggestions: false,
          setShowCommandSuggestions: vi.fn(),
          setSelectedCommandIndex: vi.fn(),
          suggestionMode: 'command',
          setResourceSuggestions: vi.fn(),
          setSuggestionMode: vi.fn(),
          currentSuggestions: [],
          selectedCommandIndex: 0,
          input: '',
          setInput: vi.fn(),
          setCursorPosition: vi.fn(),
        }
      );
      expect(handled).toBe(true);
    });

    expect(agent.abortCurrentOperation).toHaveBeenCalled();
    expect(isProcessing).toBe(false);
    expect(isStreaming).toBe(false);
    expect(tokenCount).toBe(0);
    expect(processingTime).toBe(0);
    expect(processingStartTime.current).toBe(0);
  });
});
