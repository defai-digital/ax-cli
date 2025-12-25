# i18n - Internationalization System

The AX CLI internationalization system provides full translation support for 7 languages using JSON-based locale files.

## Supported Languages

| Code    | Language            | Status |
|---------|---------------------|--------|
| `en`    | English             | ✅ Complete (Reference) |
| `zh-CN` | Simplified Chinese  | ✅ Complete |
| `zh-TW` | Traditional Chinese | ✅ Complete |
| `ja`    | Japanese            | ✅ Complete |
| `ko`    | Korean              | ✅ Complete |
| `th`    | Thai                | ✅ Complete |
| `vi`    | Vietnamese          | ✅ Complete |

## Directory Structure

```
i18n/
├── index.ts           # Main exports
├── types.ts           # TypeScript interfaces
├── loader.ts          # JSON loader with caching
├── validate.ts        # Validation script
├── README.md          # This file
└── locales/
    ├── en/
    │   ├── ui.json       # UI strings (session, status, tools, etc.)
    │   └── commands.json # Command strings (/help, /status, etc.)
    ├── zh-CN/
    │   ├── ui.json
    │   └── commands.json
    ├── zh-TW/
    │   ├── ui.json
    │   └── commands.json
    ├── ja/
    │   ├── ui.json
    │   └── commands.json
    ├── ko/
    │   ├── ui.json
    │   └── commands.json
    ├── th/
    │   ├── ui.json
    │   └── commands.json
    └── vi/
        ├── ui.json
        └── commands.json
```

## Usage

### In React Components (with hooks)

```tsx
import { useTranslations } from '../ui/hooks/use-translations';

function MyComponent() {
  const { ui, cmd, language } = useTranslations();

  return (
    <div>
      <p>{ui.session.welcome}</p>
      <p>{cmd.help.title}</p>
    </div>
  );
}
```

### Outside React (event handlers, utilities)

```typescript
import { getTranslations } from '../ui/hooks/use-translations';

function handleEvent() {
  const { ui, cmd } = getTranslations();
  console.log(ui.toast.changesSaved);
}
```

### Direct Import (low-level)

```typescript
import { getUITranslations, getCommandTranslations } from '../i18n';

const ui = getUITranslations('ja');
const cmd = getCommandTranslations('ja');
```

## Translation Files

### ui.json Structure

```json
{
  "session": {
    "welcome": "Welcome! Type your message or /help for commands.",
    "thinking": "Thinking...",
    "goodbye": "Goodbye!"
  },
  "status": {
    "autoEdit": "Auto-edit",
    "on": "On",
    "off": "Off"
  },
  "tools": { ... },
  "usage": { ... },
  "toast": { ... },
  "confirm": { ... },
  "actions": { ... },
  "errors": { ... },
  "categories": { ... },
  "welcome": { ... },
  "shortcuts": { ... },
  "toolNames": { ... },
  "context": { ... },
  "hints": { ... },
  "input": { ... }
}
```

### commands.json Structure

```json
{
  "common": {
    "error": "Error",
    "success": "Success",
    "cancelled": "Cancelled"
  },
  "lang": {
    "title": "Language",
    "currentLanguage": "Current language"
  },
  "status": { ... },
  "usage": { ... },
  "doctor": { ... },
  "memory": { ... },
  "help": { ... },
  "cache": { ... },
  "update": { ... },
  "init": { ... },
  "mcp": { ... },
  "vscode": { ... }
}
```

## Adding a New Language

1. Create a new directory: `locales/{language-code}/`
2. Copy English files as templates:
   ```bash
   cp locales/en/ui.json locales/{code}/ui.json
   cp locales/en/commands.json locales/{code}/commands.json
   ```
3. Translate all strings in both files
4. Update `loader.ts`:
   - Add import statements for the new locale files
   - Add entries to `uiTranslations` and `commandTranslations` registries
5. Update `SupportedLanguage` type in `loader.ts`
6. Run validation: `npx tsx packages/core/src/i18n/validate.ts`

## Validation

Run the validation script to check translation completeness:

```bash
npx tsx packages/core/src/i18n/validate.ts
```

The validator checks:
- Missing keys (compared to English reference)
- Extra keys (not in English reference)
- Empty values

## Switching Languages

Users can switch languages with the `/lang` command:

```
/lang          # Show current language and available options
/lang ja       # Switch to Japanese
/lang zh-CN    # Switch to Simplified Chinese
```

Language preference is persisted in user settings.

## Best Practices

1. **Always use English as reference** - English files are the source of truth
2. **Keep translations in sync** - When adding new keys, add them to all locales
3. **Preserve placeholders** - Keep `{count}`, `{id}`, etc. in translations
4. **Run validation** - Check completeness before committing
5. **Use native terms** - Prefer local terminology when appropriate
