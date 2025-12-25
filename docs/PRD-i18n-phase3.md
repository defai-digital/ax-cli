# PRD: Phase 3 - Complete i18n Implementation

## Overview

Complete the internationalization (i18n) implementation for ax-cli. Phase 1 (setup wizard) and Phase 2 (UI translation files + partial component integration) are complete. Phase 3 focuses on comprehensive coverage of all user-facing text.

## Current State

### Completed (Phase 1 & 2)
- `setup-translations.ts` - Setup wizard translations (7 languages)
- `ui-translations.ts` - UI component translations (7 languages)
- `command-translations.ts` - Command translations (7 languages)
- `useTranslations()` hook for React components
- `getTranslations()` function for non-React code
- Partial integration in: welcome-panel, toast-notification, confirmation-dialog, keyboard-help, quick-actions

### Remaining Work
- **1,039 console.log calls** across 55 files with hardcoded English text
- **22 command files** with hardcoded output messages
- **22 files using chalk** with hardcoded colored text
- Multiple UI components with hardcoded strings

## Scope

### 3.1 UI Components (High Priority)

| Component | File | Hardcoded Strings |
|-----------|------|-------------------|
| CollapsibleToolResult | `collapsible-tool-result.tsx` | Tool names (Read, Update, Create, Bash, Search, Todo), "Completed", "Executing..." |
| ContextBreakdown | `context-breakdown.tsx` | "High", "Moderate", "Good", context labels |
| KeyboardHints | `keyboard-hints.tsx` | All hint descriptions (send, new line, toggle, etc.) |
| ChatHistory | `chat-history.tsx` | Role labels, timestamps, status messages |
| ApiKeyInput | `api-key-input.tsx` | Error messages, prompts |
| StatusBar | `status-bar.tsx` | Remaining hardcoded labels |
| LoadingSpinner | `loading-spinner.tsx` | Remaining action messages |
| DiffRenderer | `diff-renderer.tsx` | Line labels, status indicators |

### 3.2 Commands (Medium Priority)

All 22 command files need translation:

| Command | File | Est. Strings |
|---------|------|--------------|
| /init | `init.ts` | ~20 |
| /setup | `setup.ts` | ~15 |
| /models | `models.ts` | ~30 |
| /memory | `memory.ts` | ~40 |
| /mcp | `mcp.ts` | ~80 |
| /status | `status.ts` | ~50 |
| /usage | `usage.ts` | ~20 |
| /doctor | `doctor.ts` | ~30 |
| /rewind | `rewind.ts` | ~25 |
| /cache | `cache.ts` | ~30 |
| /vscode | `vscode.ts` | ~40 |
| /update | `update.ts` | ~20 |
| /templates | `templates.ts` | ~15 |
| /design | `design.ts` | ~15 |
| /frontend | `frontend.ts` | ~50 |
| /mcp-migrate | `mcp-migrate.ts` | ~25 |
| /mcp handlers | `mcp/handlers.ts` | ~30 |
| /mcp zai-handlers | `mcp/zai-handlers.ts` | ~30 |

**Total: ~600 strings**

### 3.3 Agent & Tools (Medium Priority)

| Module | Files | Strings |
|--------|-------|---------|
| LLM Client | `llm/client.ts`, `llm/tools.ts` | ~20 |
| Agent Core | `agent/llm-agent.ts` | ~30 |
| Tool Executor | `agent/execution/tool-executor.ts` | ~20 |
| Context Handler | `agent/context/context-overflow-handler.ts` | ~15 |
| React Loop | `agent/react/index.ts` | ~10 |
| Self-Correction | `agent/correction/index.ts` | ~15 |

### 3.4 SDK & Utilities (Low Priority)

| Module | Files | Strings |
|--------|-------|---------|
| SDK Errors | `sdk/errors.ts` | ~20 |
| SDK Version | `sdk/version.ts` | ~10 |
| Console Messenger | `utils/console-messenger.ts` | ~30 |
| Config Migrator | `utils/config-migrator.ts` | ~25 |
| Project Migrator | `utils/project-migrator.ts` | ~25 |
| Retry Helper | `utils/retry-helper.ts` | ~10 |

### 3.5 MCP Module (Low Priority)

| File | Strings |
|------|---------|
| `mcp/config.ts` | ~15 |
| `mcp/progress.ts` | ~10 |
| `mcp/subscriptions.ts` | ~10 |

## Implementation Plan

### Phase 3.1: UI Components (Week 1)

1. **Create tool-translations.ts**
   - Tool display names
   - Tool status messages (Executing, Completed, Failed)
   - Tool result summaries

2. **Update remaining UI components**
   - collapsible-tool-result.tsx
   - context-breakdown.tsx
   - keyboard-hints.tsx
   - chat-history.tsx
   - api-key-input.tsx
   - diff-renderer.tsx

### Phase 3.2: Command Translations (Week 2-3)

1. **Extend command-translations.ts**
   - Add sections for each command
   - Group by command category

2. **Create getCommandMessages() helper**
   - Similar pattern to getToastMessages()
   - Lazy evaluation for performance

3. **Update command files**
   - Replace console.log with translated messages
   - Use chalk with translated strings

### Phase 3.3: Agent & Core (Week 4)

1. **Create agent-translations.ts**
   - Agent status messages
   - Error messages
   - Progress indicators

2. **Update agent modules**
   - Use translations for user-facing output
   - Keep internal debug messages in English

### Phase 3.4: Utilities & SDK (Week 5)

1. **Create utility-translations.ts**
   - Migration messages
   - Error messages
   - Progress indicators

2. **Update utility files**

## Translation Keys Structure

```typescript
// Proposed structure for command-translations.ts extension
interface CommandTranslations {
  // Existing...

  // New sections
  init: {
    analyzing: string;
    creatingCustomMd: string;
    projectAnalyzed: string;
    // ...
  };

  memory: {
    warming: string;
    cached: string;
    refreshing: string;
    // ...
  };

  mcp: {
    connecting: string;
    connected: string;
    serverList: string;
    // ...
  };

  // ... for each command
}
```

## Languages Supported

1. English (en) - Default
2. Simplified Chinese (zh-CN)
3. Traditional Chinese (zh-TW)
4. Japanese (ja)
5. Korean (ko)
6. Thai (th)
7. Vietnamese (vi)

## Technical Requirements

### Translation Pattern

```typescript
// For React components
import { useTranslations } from "../hooks/use-translations.js";

function Component() {
  const { ui, cmd } = useTranslations();
  return <Text>{ui.status.loading}</Text>;
}

// For non-React code
import { getTranslations } from "../hooks/use-translations.js";

function logMessage() {
  const { cmd } = getTranslations();
  console.log(chalk.green(cmd.init.success));
}
```

### String Interpolation

```typescript
// Use template functions for dynamic content
const messages = {
  fileCreated: (path: string) => `File created: ${path}`,
  tokensUsed: (count: number) => `${count.toLocaleString()} tokens used`,
};
```

## Success Criteria

1. **Coverage**: 95%+ of user-facing strings translated
2. **Build**: All packages build without errors
3. **Tests**: Existing tests pass
4. **Runtime**: No performance regression
5. **Languages**: All 7 languages have complete translations

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Large scope | Prioritize by user impact (UI > Commands > Utils) |
| Translation quality | Use consistent terminology, review by native speakers |
| Performance | Lazy loading, memoization |
| Breaking changes | Keep deprecated English fallbacks |

## Metrics

- Lines of code changed: ~3,000
- New translation keys: ~800
- Files modified: ~60
- Estimated effort: 5 weeks

## Dependencies

- Phase 1 & 2 complete (done)
- Translation review process
- Native speaker verification

## Out of Scope

- Runtime language switching (requires restart)
- RTL language support
- Pluralization rules (simple approach)
- Date/time localization (use system locale)
