# PRD: CLI Commands & Internationalization

## 1. Command Inventory

### Registered Commands

| Command | Aliases | Category | Description |
|---------|---------|----------|-------------|
| `/help` | `/h`, `/?` | info | Show help information |
| `/shortcuts` | — | info | Show keyboard shortcuts guide |
| `/terminal-setup` | — | info | Configure Shift+Enter for multi-line input |
| `/commands` | — | info | List all custom commands |
| `/exit` | `/quit`, `/q` | session | Exit the application |
| `/clear` | — | session | Clear chat history |
| `/tasks` | — | tasks | List all background tasks |
| `/task` | — | tasks | View output of a background task |
| `/kill` | — | tasks | Kill a running background task |
| `/doctor` | — | info | Run health check diagnostics |
| `/theme` | — | settings | Switch color theme |
| `/model` | `/m` | settings | View/switch AI models |
| `/permissions` | `/perm`, `/perms` | settings | View/manage tool permissions |
| `/init` | — | project | Initialize project with smart analysis |
| `/memory` | — | memory | Show project memory status |
| `/mcp` | — | mcp | Open MCP server dashboard |
| `/usage` | — | info | Show API usage statistics |
| `/status` | — | info | Show status reports |
| `/cache` | — | system | Manage file analysis caches |
| `/update` | — | system | Check for updates |
| `/vscode` | — | system | Manage VSCode extension |
| `/setup` | — | settings | Configure API keys and settings |

### Streaming Commands (Special Handling)

| Command | Description |
|---------|-------------|
| `/continue` | Continue incomplete response |
| `/retry` | Re-send the last message |

### Unregistered Commands (In Help Text But Not Implemented)

| Command | Status | Notes |
|---------|--------|-------|
| `/plans` | Not in registry | Plan management |
| `/phases` | Not in registry | Phase management |
| `/pause` | Not in registry | Pause plan execution |
| `/resume` | Not in registry | Resume plan |
| `/skip` | Not in registry | Skip current phase |
| `/abandon` | Not in registry | Abandon plan |
| `/rewind` | Not in registry | Checkpoint rewind |
| `/checkpoints` | Not in registry | Checkpoint stats |

---

## 2. New Command: `/lang`

### Purpose
Allow users to switch the CLI language at runtime without editing config files.

### Specification

| Attribute | Value |
|-----------|-------|
| Command | `/lang` |
| Aliases | `/language` |
| Category | settings |
| Arguments | `[language-code]` (optional) |

### Behavior

1. **No arguments**: Show current language and available options
   ```
   /lang

   Current language: English (en)

   Available languages:
     en     English (default)
     zh-CN  简体中文
     zh-TW  繁體中文
     ja     日本語
     ko     한국어
     th     ไทย
     vi     Tiếng Việt

   Usage: /lang <code>
   Example: /lang ja
   ```

2. **With language code**: Switch to specified language
   ```
   /lang ja

   Language changed to: 日本語 (ja)
   ```

3. **Invalid code**: Show error with available options
   ```
   /lang xyz

   Unknown language: xyz
   Available: en, zh-CN, zh-TW, ja, ko, th, vi
   ```

### Implementation

**File:** `packages/core/src/commands/handlers/lang.ts`

```typescript
import { CommandDefinition } from '../types.js';
import { getSettingsManager } from '../../utils/settings-manager.js';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '../../schemas/settings-schemas.js';

const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  'en': 'English',
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
  'ja': '日本語',
  'ko': '한국어',
  'th': 'ไทย',
  'vi': 'Tiếng Việt',
};

export const langCommands: CommandDefinition[] = [
  {
    name: 'lang',
    aliases: ['language'],
    category: 'settings',
    description: 'View or change display language',
    usage: '/lang [code]',
    examples: ['/lang', '/lang ja', '/lang zh-CN'],
    handler: async (args, context) => {
      const manager = getSettingsManager();
      const currentLang = manager.get('language') || 'en';

      if (!args || args.trim() === '') {
        // Show current language and options
        context.log(`Current language: ${LANGUAGE_NAMES[currentLang]} (${currentLang})`);
        context.log('');
        context.log('Available languages:');
        for (const [code, name] of Object.entries(LANGUAGE_NAMES)) {
          const marker = code === currentLang ? ' (current)' : '';
          context.log(`  ${code.padEnd(6)} ${name}${marker}`);
        }
        return;
      }

      const newLang = args.trim() as SupportedLanguage;
      if (!SUPPORTED_LANGUAGES.includes(newLang)) {
        context.error(`Unknown language: ${newLang}`);
        context.log(`Available: ${SUPPORTED_LANGUAGES.join(', ')}`);
        return;
      }

      manager.set('language', newLang);
      context.success(`Language changed to: ${LANGUAGE_NAMES[newLang]} (${newLang})`);
    },
  },
];
```

### Translations Required

Add to `command-translations.ts`:

```typescript
lang: {
  title: string;           // "Language"
  currentLanguage: string; // "Current language"
  availableLanguages: string; // "Available languages"
  languageChanged: string; // "Language changed to"
  unknownLanguage: string; // "Unknown language"
  usage: string;           // "Usage: /lang <code>"
};
```

---

## 3. Remaining i18n Work

### Priority 1: Critical UI Components

| Component | File | Hardcoded Strings | Effort |
|-----------|------|-------------------|--------|
| Welcome Panel | `welcome-panel.tsx` | Categories, shortcuts, examples | 2-3 hrs |
| Chat Input | `chat-input.tsx` | Placeholder, paste hints | 1-2 hrs |
| Chat Interface | `chat-interface.tsx` | Toast messages, context labels | 2-3 hrs |

### Priority 2: CLI Entry & Setup

| Component | File | Hardcoded Strings | Effort |
|-----------|------|-------------------|--------|
| CLI Entry | `index.ts` | Shutdown, setup, session messages | 2-3 hrs |
| Setup Command | `setup.ts` | Wizard prompts | 2-3 hrs |

### Priority 3: Minor Components

| Component | File | Hardcoded Strings | Effort |
|-----------|------|-------------------|--------|
| Keyboard Help | `keyboard-help.tsx` | Shortcut descriptions | 1 hr |
| Quick Actions | `quick-actions.tsx` | Action descriptions | 1 hr |

### Translation Keys to Add

```typescript
// ui-translations.ts additions needed:

pasteBlock: {
  expanded: string;      // "Pasted #{id} ({count} lines)"
  pasting: string;       // "Pasting text..."
  expandHint: string;    // "Press Ctrl+P to expand"
};

clipboard: {
  copyFailed: string;    // "Failed to copy to clipboard"
  nothingToCopy: string; // "No response to copy"
};

welcome: {
  categoryExplore: string;
  categoryEdit: string;
  categoryCreate: string;
  categoryExecute: string;
  // + all example prompts
};

cli: {
  shutdown: string;      // "Gracefully shutting down..."
  apiKeySaved: string;
  configNotFound: string;
  continueConversation: string;
  newConversation: string;
};
```

---

## 4. Implementation Plan

### Phase 1: /lang Command (1 day)
- [ ] Create `handlers/lang.ts`
- [ ] Add translations for lang command
- [ ] Register in command registry
- [ ] Test language switching

### Phase 2: Welcome Panel i18n (1 day)
- [ ] Extract all hardcoded strings
- [ ] Add translation keys
- [ ] Implement useTranslations hook
- [ ] Test in all 7 languages

### Phase 3: Chat Components i18n (1 day)
- [ ] Update chat-input.tsx
- [ ] Update chat-interface.tsx
- [ ] Add missing translation keys
- [ ] Test

### Phase 4: CLI Entry & Setup (1 day)
- [ ] Update index.ts
- [ ] Update setup.ts
- [ ] Add missing translation keys
- [ ] Test

### Phase 5: Polish (1 day)
- [ ] Keyboard help descriptions
- [ ] Quick actions descriptions
- [ ] Final testing
- [ ] Documentation update

**Total: 5 days estimated**

---

## 5. Success Criteria

- [ ] `/lang` command works to switch languages
- [ ] Welcome screen displays in selected language
- [ ] All keyboard shortcuts display in selected language
- [ ] Chat interface (placeholder, toasts) in selected language
- [ ] Setup wizard in selected language
- [ ] All 7 languages tested and verified
