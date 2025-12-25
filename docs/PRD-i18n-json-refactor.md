# PRD: i18n JSON Locale Refactoring

## Executive Summary

Refactor the internationalization (i18n) system from TypeScript-based translations to JSON locale files, following industry best practices for separation of code and content.

---

## 1. Current State Analysis

### Current Architecture

```
packages/core/src/i18n/
├── command-translations.ts    # ~2100 lines, 7 languages embedded
├── ui-translations.ts         # ~2000 lines, 7 languages embedded
└── index.ts                   # Re-exports
```

### Problems with Current Approach

| Issue | Impact |
|-------|--------|
| Translations mixed with code | Hard for non-developers to contribute |
| Large monolithic files | Difficult to maintain (2000+ lines each) |
| No separation of concerns | Code changes required for translation updates |
| Cannot integrate with translation platforms | Crowdin/Lokalise require JSON/YAML |
| Compile required for translation changes | Slower iteration for translators |

### Current Supported Languages

| Code | Language | Status |
|------|----------|--------|
| `en` | English | Complete (default) |
| `zh-CN` | Simplified Chinese | Complete |
| `zh-TW` | Traditional Chinese | Complete |
| `ja` | Japanese | Complete |
| `ko` | Korean | Complete |
| `th` | Thai | Partial (falls back to English) |
| `vi` | Vietnamese | Partial (falls back to English) |

---

## 2. Target Architecture

### New Directory Structure

```
packages/core/src/i18n/
├── locales/
│   ├── en/
│   │   ├── commands.json      # Command outputs (/status, /usage, etc.)
│   │   └── ui.json            # UI components (welcome, toasts, etc.)
│   ├── zh-CN/
│   │   ├── commands.json
│   │   └── ui.json
│   ├── zh-TW/
│   │   ├── commands.json
│   │   └── ui.json
│   ├── ja/
│   │   ├── commands.json
│   │   └── ui.json
│   ├── ko/
│   │   ├── commands.json
│   │   └── ui.json
│   ├── th/
│   │   ├── commands.json
│   │   └── ui.json
│   └── vi/
│       ├── commands.json
│       └── ui.json
├── types.ts                   # TypeScript interfaces
├── loader.ts                  # JSON loader with caching
├── index.ts                   # Public API exports
└── validate.ts                # Build-time validation script
```

### JSON File Structure

```json
// locales/en/ui.json
{
  "$schema": "../schemas/ui.schema.json",
  "session": {
    "welcome": "Welcome! Type your message or /help for commands.",
    "askAnything": "Ask me anything...",
    "thinking": "Thinking...",
    "goodbye": "Goodbye!"
  },
  "welcome": {
    "essentialShortcuts": "Essential Shortcuts",
    "modes": "Modes",
    "quickStart": "Quick Start",
    "exploreExamples": [
      "What does this codebase do?",
      "Explain the architecture"
    ]
  },
  "toast": {
    "copiedToClipboard": "Copied to clipboard",
    "operationCancelled": "Operation cancelled"
  }
}
```

```json
// locales/en/commands.json
{
  "$schema": "../schemas/commands.schema.json",
  "common": {
    "error": "Error",
    "success": "Success",
    "loading": "Loading..."
  },
  "lang": {
    "title": "Language",
    "currentLanguage": "Current language",
    "availableLanguages": "Available languages",
    "languageChanged": "Language changed to",
    "unknownLanguage": "Unknown language"
  },
  "status": {
    "title": "Status",
    "statusReport": "Status Report"
  }
}
```

### Type Safety Approach

```typescript
// types.ts - Generated or manually maintained
export interface UITranslations {
  session: {
    welcome: string;
    askAnything: string;
    thinking: string;
    goodbye: string;
  };
  welcome: {
    essentialShortcuts: string;
    modes: string;
    quickStart: string;
    exploreExamples: string[];
  };
  // ...
}

export interface CommandTranslations {
  common: {
    error: string;
    success: string;
    loading: string;
  };
  lang: {
    title: string;
    currentLanguage: string;
    // ...
  };
  // ...
}
```

### Loader Implementation

```typescript
// loader.ts
import type { SupportedLanguage } from '../schemas/settings-schemas.js';
import type { UITranslations, CommandTranslations } from './types.js';

// Cache loaded translations
const cache = new Map<string, UITranslations | CommandTranslations>();

export function loadUITranslations(lang: SupportedLanguage): UITranslations {
  const cacheKey = `ui:${lang}`;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey) as UITranslations;
  }

  // Dynamic import with fallback to English
  let translations: UITranslations;
  try {
    // Use require for JSON (or fs.readFileSync for runtime)
    translations = require(`./locales/${lang}/ui.json`);
  } catch {
    translations = require('./locales/en/ui.json');
  }

  cache.set(cacheKey, translations);
  return translations;
}

export function loadCommandTranslations(lang: SupportedLanguage): CommandTranslations {
  // Similar implementation
}
```

---

## 3. Migration Strategy

### Approach: Incremental Migration

Instead of a big-bang rewrite, migrate incrementally:

1. Create JSON files alongside existing TS files
2. Update loader to prefer JSON when available
3. Migrate one language at a time
4. Remove TS translations after all JSON files verified

### Backward Compatibility

- Keep existing TS files during migration
- Loader falls back to TS if JSON not found
- No breaking changes to public API

---

## 4. Implementation Phases

### Phase 1: Foundation (Day 1)

**Goal:** Set up new architecture without breaking existing code

| Task | Description | Files |
|------|-------------|-------|
| 1.1 | Create `locales/` directory structure | New directories |
| 1.2 | Create TypeScript interfaces in `types.ts` | `types.ts` |
| 1.3 | Implement JSON loader with caching | `loader.ts` |
| 1.4 | Create English JSON files from existing TS | `locales/en/*.json` |
| 1.5 | Add JSON schema files for validation | `schemas/*.schema.json` |
| 1.6 | Update `index.ts` to use new loader | `index.ts` |
| 1.7 | Build and verify no regressions | - |

**Deliverables:**
- [ ] `locales/en/ui.json` - English UI translations
- [ ] `locales/en/commands.json` - English command translations
- [ ] `types.ts` - TypeScript interfaces
- [ ] `loader.ts` - JSON loader with fallback
- [ ] Build passes, tests pass

### Phase 2: Asian Languages (Day 2)

**Goal:** Migrate CJK languages to JSON

| Task | Description | Files |
|------|-------------|-------|
| 2.1 | Create `locales/zh-CN/*.json` | Simplified Chinese |
| 2.2 | Create `locales/zh-TW/*.json` | Traditional Chinese |
| 2.3 | Create `locales/ja/*.json` | Japanese |
| 2.4 | Create `locales/ko/*.json` | Korean |
| 2.5 | Verify all translations render correctly | - |

**Deliverables:**
- [ ] 4 language directories with JSON files
- [ ] Visual verification in CLI

### Phase 3: SEA Languages & Cleanup (Day 3)

**Goal:** Complete migration and remove legacy TS files

| Task | Description | Files |
|------|-------------|-------|
| 3.1 | Create `locales/th/*.json` | Thai |
| 3.2 | Create `locales/vi/*.json` | Vietnamese |
| 3.3 | Add build-time validation script | `validate.ts` |
| 3.4 | Remove `command-translations.ts` | Delete file |
| 3.5 | Remove `ui-translations.ts` | Delete file |
| 3.6 | Update imports across codebase | Multiple files |
| 3.7 | Final build and test | - |

**Deliverables:**
- [ ] All 7 languages in JSON format
- [ ] Legacy TS files removed
- [ ] Validation script in build pipeline

### Phase 4: Remaining i18n Work (Day 4-5)

**Goal:** Complete the original i18n phases using new JSON system

| Task | Description |
|------|-------------|
| 4.1 | Chat Input i18n (original Phase 3) |
| 4.2 | Chat Interface i18n (original Phase 4) |
| 4.3 | CLI Entry i18n (original Phase 5) |
| 4.4 | Setup Wizard i18n (original Phase 6) |
| 4.5 | Minor Components i18n (original Phase 7) |
| 4.6 | Full build and verification (original Phase 8) |

### Phase 5: Documentation & Tooling (Day 6)

**Goal:** Enable community contributions

| Task | Description |
|------|-------------|
| 5.1 | Create `CONTRIBUTING_TRANSLATIONS.md` |
| 5.2 | Add npm script for translation validation |
| 5.3 | Document JSON schema format |
| 5.4 | Add missing translation detection |

---

## 5. Technical Specifications

### JSON Loading Strategy

```typescript
// Option A: Bundled (current recommendation)
// JSON files are bundled at build time
import enUI from './locales/en/ui.json';

// Option B: Runtime loading (for future dynamic language packs)
const translations = JSON.parse(
  fs.readFileSync(path.join(__dirname, `locales/${lang}/ui.json`), 'utf-8')
);
```

**Recommendation:** Use Option A (bundled) for CLI, as it:
- Has zero runtime file I/O
- Works in all Node.js environments
- Supports tree-shaking

### Validation Script

```typescript
// validate.ts - Run at build time
import Ajv from 'ajv';
import { glob } from 'glob';

const ajv = new Ajv();

async function validateTranslations() {
  const files = await glob('src/i18n/locales/*/*.json');

  for (const file of files) {
    const content = JSON.parse(fs.readFileSync(file, 'utf-8'));
    const schemaPath = content.$schema;

    // Validate against schema
    const valid = ajv.validate(require(schemaPath), content);
    if (!valid) {
      console.error(`Invalid: ${file}`, ajv.errors);
      process.exit(1);
    }
  }

  // Check for missing keys compared to English
  checkMissingKeys('en', files);
}
```

### Hook Updates

```typescript
// use-translations.ts updates
import { loadUITranslations, loadCommandTranslations } from '../i18n/loader.js';

export function useTranslations() {
  const language = getCurrentLanguage();
  return {
    ui: loadUITranslations(language),
    cmd: loadCommandTranslations(language),
    language,
  };
}

// For non-React contexts
export function getTranslations() {
  const language = getCurrentLanguage();
  return {
    ui: loadUITranslations(language),
    cmd: loadCommandTranslations(language),
    language,
  };
}
```

---

## 6. Success Criteria

### Phase 1 Complete When:
- [ ] English JSON files created and loading correctly
- [ ] Build passes with no TypeScript errors
- [ ] Existing functionality unchanged (regression-free)

### Phase 2 Complete When:
- [ ] All CJK languages loading from JSON
- [ ] Visual verification: `/lang ja` shows Japanese UI

### Phase 3 Complete When:
- [ ] All 7 languages in JSON format
- [ ] Legacy TS translation files deleted
- [ ] Build-time validation catches missing keys

### Phase 4 Complete When:
- [ ] All UI components use translations
- [ ] No hardcoded English strings in components

### Phase 5 Complete When:
- [ ] Contributor documentation exists
- [ ] npm script for validation works
- [ ] CI fails on invalid translations

---

## 7. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Breaking changes during migration | Incremental approach with fallbacks |
| Missing translations | Build-time validation script |
| Performance regression | Caching layer in loader |
| Complex nested structures | Keep JSON flat where possible |

---

## 8. Future Enhancements

After this refactor, these become possible:

1. **Crowdin/Lokalise Integration** - Professional translation management
2. **Dynamic Language Packs** - Download languages on demand
3. **Community Contributions** - Non-developers can submit translations
4. **Pluralization Support** - Using ICU message format
5. **RTL Language Support** - Arabic, Hebrew, etc.

---

## 9. Timeline Summary

| Phase | Duration | Key Deliverable |
|-------|----------|-----------------|
| Phase 1 | 1 day | English JSON + loader |
| Phase 2 | 1 day | CJK languages migrated |
| Phase 3 | 1 day | All languages + cleanup |
| Phase 4 | 2 days | Complete UI i18n |
| Phase 5 | 1 day | Documentation + tooling |
| **Total** | **6 days** | Full i18n system refactor |

---

## 10. Decision Required

Before proceeding, confirm:

1. **JSON vs YAML** - Recommend JSON (no extra dependencies)
2. **Bundled vs Runtime** - Recommend bundled (better performance)
3. **Phase 1 Start** - Ready to begin implementation?
