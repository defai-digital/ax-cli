# PRD: Multi-Language Support (Phase 1)

**Document Version:** 1.0
**Date:** 2024-12-24
**Status:** Approved for Implementation
**Author:** AI Assistant

---

## 1. Overview

### 1.1 Problem Statement
Users in non-English speaking regions want ax-cli to respond in their native language. Current implementation is English-only with ~600-700 hardcoded UI strings.

### 1.2 Proposed Solution (Phase 1)
Implement **system prompt language injection** - a lightweight approach that:
- Adds language selection to setup wizard
- Stores language preference in user config
- Injects language instruction into system prompts
- LLM responds in selected language

This delivers 80% of user value with 10% of implementation effort.

### 1.3 Scope
| In Scope | Out of Scope (Future Phases) |
|----------|------------------------------|
| Language preference in setup wizard | UI string translation |
| Config storage for language | Terminal CJK width handling |
| System prompt language injection | i18n framework integration |
| 5 supported languages | Translated help commands |

---

## 2. Supported Languages

| Code | Language | Native Name |
|------|----------|-------------|
| `en` | English | English (Default) |
| `zh-CN` | Simplified Chinese | 简体中文 |
| `zh-TW` | Traditional Chinese | 繁體中文 |
| `ja` | Japanese | 日本語 |
| `ko` | Korean | 한국어 |
| `th` | Thai | ไทย |
| `vi` | Vietnamese | Tiếng Việt |

---

## 3. User Experience

### 3.1 Setup Wizard Flow

New step added after Quick Setup (Step 5/6 or 6/7):

```
Step 6 — Response Language

? Select your preferred response language:
  ○ English (Default)
  ○ 简体中文 (Simplified Chinese)
  ○ 繁體中文 (Traditional Chinese)
  ○ 日本語 (Japanese)
  ○ 한국어 (Korean)
  ○ ไทย (Thai)
  ○ Tiếng Việt (Vietnamese)
```

### 3.2 Runtime Behavior

When language is set to non-English:
1. System prompt includes: `IMPORTANT: Always respond in [Language]. Use [Language] for all explanations, comments, and communication.`
2. LLM generates responses in selected language
3. UI elements (prompts, spinners, help) remain in English (Phase 1)

### 3.3 Configuration

**User Config** (`~/.ax-glm/config.json` or `~/.ax-grok/config.json`):
```json
{
  "language": "zh-CN",
  ...
}
```

**Override via Environment Variable:**
```bash
AX_LANGUAGE=ja ax-glm
```

---

## 4. Technical Design

### 4.1 Schema Changes

**File:** `packages/core/src/schemas/settings-schemas.ts`

```typescript
// Add supported languages enum
export const SupportedLanguageSchema = z.enum([
  'en',      // English (default)
  'zh-CN',   // Simplified Chinese
  'zh-TW',   // Traditional Chinese
  'ja',      // Japanese
  'ko',      // Korean
]);

export type SupportedLanguage = z.infer<typeof SupportedLanguageSchema>;

// Add to UserSettingsSchema
export const UserSettingsSchema = z.object({
  // ... existing fields ...

  /** Preferred response language for AI responses */
  language: SupportedLanguageSchema.optional().default('en'),

  // ... rest of schema ...
});
```

### 4.2 Setup Wizard Changes

**File:** `packages/core/src/commands/setup.ts`

Add language selection step after Quick Setup confirmation:

```typescript
// Language options with native labels
const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English', hint: 'Default' },
  { value: 'zh-CN', label: '简体中文', hint: 'Simplified Chinese' },
  { value: 'zh-TW', label: '繁體中文', hint: 'Traditional Chinese' },
  { value: 'ja', label: '日本語', hint: 'Japanese' },
  { value: 'ko', label: '한국어', hint: 'Korean' },
];

// Add new step
prompts.log.step(chalk.bold('Step X/Y — Response Language'));

const languageChoice = await prompts.select({
  message: 'Select your preferred response language:',
  options: LANGUAGE_OPTIONS,
  initialValue: existingConfig?.language || 'en',
});
```

### 4.3 Prompt Builder Changes

**File:** `packages/core/src/utils/prompt-builder.ts`

Add language instruction injection:

```typescript
// Language instruction mapping
const LANGUAGE_INSTRUCTIONS: Record<SupportedLanguage, string> = {
  'en': '', // No instruction needed for English
  'zh-CN': 'IMPORTANT: Always respond in Simplified Chinese (简体中文). Use Chinese for all explanations, code comments you write, and communication with the user.',
  'zh-TW': 'IMPORTANT: Always respond in Traditional Chinese (繁體中文). Use Chinese for all explanations, code comments you write, and communication with the user.',
  'ja': 'IMPORTANT: Always respond in Japanese (日本語). Use Japanese for all explanations, code comments you write, and communication with the user.',
  'ko': 'IMPORTANT: Always respond in Korean (한국어). Use Korean for all explanations, code comments you write, and communication with the user.',
};

// Inject into buildSystemPrompt
export function buildSystemPrompt(options: {
  customInstructions?: string;
  includeMemory?: boolean;
  includeProjectIndex?: boolean;
  language?: SupportedLanguage;
}): string {
  // ... existing code ...

  // Add language instruction at the end (high priority)
  const languageInstruction = LANGUAGE_INSTRUCTIONS[options.language || 'en'];
  if (languageInstruction) {
    sections.push(`\n---\n[Response Language]\n${languageInstruction}`);
  }

  return sections.join('\n');
}
```

### 4.4 Config Loading Changes

**File:** `packages/core/src/utils/settings-manager.ts`

Ensure language is read from config and passed to prompt builder:

```typescript
// In getLanguagePreference()
export function getLanguagePreference(): SupportedLanguage {
  // 1. Check environment variable
  const envLang = process.env.AX_LANGUAGE;
  if (envLang && isValidLanguage(envLang)) {
    return envLang as SupportedLanguage;
  }

  // 2. Check user config
  const settings = loadUserSettings();
  return settings.language || 'en';
}
```

---

## 5. Implementation Plan

### 5.1 Files to Modify

| File | Change |
|------|--------|
| `packages/core/src/schemas/settings-schemas.ts` | Add `SupportedLanguageSchema` and `language` field |
| `packages/core/src/commands/setup.ts` | Add language selection step |
| `packages/core/src/utils/prompt-builder.ts` | Add language instruction injection |
| `packages/core/src/utils/settings-manager.ts` | Add `getLanguagePreference()` helper |
| `packages/core/src/agent/llm-agent.ts` | Pass language to prompt builder |

### 5.2 Task Breakdown

1. **Schema Update** (~10 min)
   - Add `SupportedLanguageSchema` enum
   - Add `language` field to `UserSettingsSchema`

2. **Setup Wizard** (~20 min)
   - Define `LANGUAGE_OPTIONS` constant
   - Add language selection step
   - Store in config

3. **Prompt Builder** (~15 min)
   - Define `LANGUAGE_INSTRUCTIONS` mapping
   - Add language parameter to `buildSystemPrompt`
   - Inject instruction into prompt

4. **Config Integration** (~15 min)
   - Add `getLanguagePreference()` helper
   - Pass language through call chain

5. **Testing** (~30 min)
   - Run setup wizard
   - Verify config storage
   - Test prompt generation
   - Verify LLM responses in selected language

---

## 6. Testing Strategy

### 6.1 Manual Testing

```bash
# Test 1: Run setup and select Chinese
ax-glm setup

# Test 2: Verify config
cat ~/.ax-glm/config.json | grep language

# Test 3: Test response language
ax-glm -p "Hello, introduce yourself"
# Expected: Response in Simplified Chinese

# Test 4: Test environment override
AX_LANGUAGE=ja ax-glm -p "Hello"
# Expected: Response in Japanese
```

### 6.2 Unit Tests

```typescript
// packages/core/src/__tests__/language-support.test.ts
describe('Language Support', () => {
  it('should add language instruction for Chinese', () => {
    const prompt = buildSystemPrompt({ language: 'zh-CN' });
    expect(prompt).toContain('respond in Simplified Chinese');
  });

  it('should not add instruction for English', () => {
    const prompt = buildSystemPrompt({ language: 'en' });
    expect(prompt).not.toContain('[Response Language]');
  });
});
```

---

## 7. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| LLM ignores language instruction | Low | Medium | Test with each language; adjust prompt wording |
| Setup wizard step ordering issues | Low | Low | Careful integration after Quick Setup |
| Config migration for existing users | Low | Low | Default to 'en' if not set |

---

## 8. Success Metrics

| Metric | Target |
|--------|--------|
| Setup completion with language selection | Works without errors |
| Config persistence | Language saved and loaded correctly |
| Prompt injection | Language instruction appears in system prompt |
| LLM response language | Matches selected language 95%+ of time |

---

## 9. Future Phases (Out of Scope)

### Phase 2: Setup Wizard i18n
- Translate ~80 setup wizard strings
- Display setup steps in selected language

### Phase 3: Full UI i18n
- Extract all 600+ strings
- Implement i18next framework
- Create translation files

---

## 10. Approval

**Technical Review:** Approved
**Product Review:** Approved
**Implementation:** Ready to proceed
