# i18n Implementation Action Plan

## Overview
Complete internationalization of ax-cli with /lang command and all UI components.

---

## Phase 1: /lang Command Implementation

### Tasks
- [ ] 1.1 Add lang translations to command-translations.ts
- [ ] 1.2 Create handlers/lang.ts
- [ ] 1.3 Register in command registry
- [ ] 1.4 Test command

### Files to Create/Modify
- `packages/core/src/i18n/command-translations.ts`
- `packages/core/src/commands/handlers/lang.ts` (new)
- `packages/core/src/commands/registry.ts`

---

## Phase 2: Welcome Panel i18n

### Tasks
- [ ] 2.1 Add welcome translations to ui-translations.ts
- [ ] 2.2 Update welcome-panel.tsx to use translations
- [ ] 2.3 Translate category headers (Explore, Edit, Create, Execute)
- [ ] 2.4 Translate shortcut descriptions
- [ ] 2.5 Translate example prompts

### Files to Modify
- `packages/core/src/i18n/ui-translations.ts`
- `packages/core/src/ui/components/welcome-panel.tsx`

---

## Phase 3: Chat Input i18n

### Tasks
- [ ] 3.1 Add pasteBlock translations to ui-translations.ts
- [ ] 3.2 Update chat-input.tsx placeholder
- [ ] 3.3 Translate paste block messages
- [ ] 3.4 Translate keyboard hints

### Files to Modify
- `packages/core/src/i18n/ui-translations.ts`
- `packages/core/src/ui/components/chat-input.tsx`

---

## Phase 4: Chat Interface i18n

### Tasks
- [ ] 4.1 Add clipboard/toast translations to ui-translations.ts
- [ ] 4.2 Translate context breakdown labels
- [ ] 4.3 Translate toast messages
- [ ] 4.4 Translate scroll hints

### Files to Modify
- `packages/core/src/i18n/ui-translations.ts`
- `packages/core/src/ui/components/chat-interface.tsx`

---

## Phase 5: CLI Entry i18n

### Tasks
- [ ] 5.1 Add CLI translations to command-translations.ts
- [ ] 5.2 Update index.ts shutdown messages
- [ ] 5.3 Translate setup prompts
- [ ] 5.4 Translate session messages

### Files to Modify
- `packages/core/src/i18n/command-translations.ts`
- `packages/core/src/index.ts`

---

## Phase 6: Setup Wizard i18n

### Tasks
- [ ] 6.1 Add setup wizard translations
- [ ] 6.2 Update setup.ts prompts
- [ ] 6.3 Translate provider selection
- [ ] 6.4 Translate confirmation messages

### Files to Modify
- `packages/core/src/i18n/command-translations.ts`
- `packages/core/src/commands/setup.ts`

---

## Phase 7: Minor Components i18n

### Tasks
- [ ] 7.1 Update keyboard-help.tsx descriptions
- [ ] 7.2 Update quick-actions.tsx descriptions

### Files to Modify
- `packages/core/src/ui/components/keyboard-help.tsx`
- `packages/core/src/ui/components/quick-actions.tsx`

---

## Phase 8: Build & Verify

### Tasks
- [ ] 8.1 Build all packages
- [ ] 8.2 Test /lang command
- [ ] 8.3 Verify all UI in different languages

---

## Execution Order

1. Phase 1 → /lang command (enables testing)
2. Phase 2 → Welcome panel (most visible)
3. Phase 3 → Chat input (constant use)
4. Phase 4 → Chat interface (toasts, context)
5. Phase 5 → CLI entry (startup/shutdown)
6. Phase 6 → Setup wizard
7. Phase 7 → Minor components
8. Phase 8 → Build & verify
