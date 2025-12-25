# PRD: Multi-Language Support Phase 2 - Interactive UI i18n

## Overview

Phase 2 extends the i18n foundation established in Phase 1 to cover the interactive CLI experience. This includes all user-facing messages, prompts, status indicators, and error messages displayed during normal CLI operation.

## Background

### Phase 1 Completed
- Language selection as first step in setup wizard
- Localized setup wizard (all prompts, notes, messages)
- System prompt language injection for LLM responses
- 7 languages supported: English, Simplified Chinese, Traditional Chinese, Japanese, Korean, Thai, Vietnamese

### Phase 2 Goal
Extend localization to the interactive CLI session, ensuring users can interact with the tool entirely in their preferred language.

## Supported Languages

| Code | Language | Native Name |
|------|----------|-------------|
| `en` | English | English (Default) |
| `zh-CN` | Simplified Chinese | 简体中文 |
| `zh-TW` | Traditional Chinese | 繁體中文 |
| `ja` | Japanese | 日本語 |
| `ko` | Korean | 한국어 |
| `th` | Thai | ไทย |
| `vi` | Vietnamese | Tiếng Việt |

## Scope

### In Scope

#### 1. Interactive Session Messages
- Welcome/intro messages
- Session status indicators
- Token usage display
- Cost estimation display
- Exit/goodbye messages

#### 2. Tool Execution Feedback
- Tool start/progress/completion messages
- File operation confirmations
- Command execution status
- Error messages and recovery suggestions

#### 3. Slash Commands
- `/help` command output
- `/status` command output
- `/clear` confirmation
- `/model` selection prompts
- `/config` display
- `/mcp` management messages
- `/doctor` diagnostic output

#### 4. Permission System
- Permission request prompts
- Approval/denial confirmations
- Trust level explanations

#### 5. Error Handling
- Connection errors
- API errors
- Rate limit messages
- Validation errors
- Recovery suggestions

#### 6. Progress Indicators
- Spinner messages
- Progress bar labels
- Streaming indicators

### Out of Scope (Phase 3+)
- LLM-generated content translation
- Documentation files
- Log file messages (remain in English for debugging)
- Developer-facing error stack traces

## Technical Design

### File Structure

```
packages/core/src/i18n/
├── index.ts                    # Main export
├── types.ts                    # TypeScript interfaces
├── setup-translations.ts       # Phase 1 (existing)
├── ui-translations.ts          # Phase 2 (new)
├── command-translations.ts     # Phase 2 (new)
└── locales/                    # Optional: split by language
    ├── en.ts
    ├── zh-CN.ts
    ├── zh-TW.ts
    ├── ja.ts
    ├── ko.ts
    ├── th.ts
    └── vi.ts
```

### Translation Interface

```typescript
interface UITranslations {
  // Session
  session: {
    welcome: string;
    welcomeWithProject: string;
    ready: string;
    thinking: string;
    generating: string;
    tokensUsed: string;
    estimatedCost: string;
    goodbye: string;
    sessionEnded: string;
  };

  // Tools
  tools: {
    executing: string;
    completed: string;
    failed: string;
    fileCreated: string;
    fileModified: string;
    fileDeleted: string;
    commandRunning: string;
    commandCompleted: string;
    searchingFiles: string;
    readingFile: string;
  };

  // Permissions
  permissions: {
    requestTitle: string;
    allowOnce: string;
    allowSession: string;
    allowAlways: string;
    deny: string;
    trustExplanation: string;
  };

  // Errors
  errors: {
    connectionFailed: string;
    apiError: string;
    rateLimited: string;
    retryIn: string;
    invalidInput: string;
    fileNotFound: string;
    permissionDenied: string;
  };

  // Commands
  commands: {
    help: {
      title: string;
      description: string;
      usage: string;
      examples: string;
      availableCommands: string;
    };
    status: {
      title: string;
      model: string;
      provider: string;
      tokensUsed: string;
      sessionDuration: string;
    };
    // ... other commands
  };
}
```

### Translation Loading

```typescript
// Lazy loading with caching
const translationCache = new Map<string, UITranslations>();

export function getUITranslations(language: SupportedLanguage): UITranslations {
  if (translationCache.has(language)) {
    return translationCache.get(language)!;
  }

  const translations = loadTranslations(language);
  translationCache.set(language, translations);
  return translations;
}
```

### Integration Pattern

```typescript
// In UI components
import { getUITranslations } from '../i18n';
import { getLanguagePreference } from '../utils/settings-manager';

function renderToolStatus(tool: string, status: 'running' | 'done' | 'error') {
  const t = getUITranslations(getLanguagePreference());

  switch (status) {
    case 'running':
      return `${t.tools.executing} ${tool}...`;
    case 'done':
      return `${t.tools.completed} ${tool}`;
    case 'error':
      return `${t.tools.failed} ${tool}`;
  }
}
```

## Implementation Plan

### Phase 2.1: Core UI Messages (Week 1)
1. Create `ui-translations.ts` with all UI string interfaces
2. Implement English translations (baseline)
3. Integrate with session welcome/goodbye messages
4. Integrate with token/cost display

### Phase 2.2: Tool Feedback (Week 2)
1. Localize tool execution messages
2. Localize file operation confirmations
3. Localize progress indicators
4. Localize error messages

### Phase 2.3: Slash Commands (Week 3)
1. Create `command-translations.ts`
2. Localize `/help` output
3. Localize `/status` output
4. Localize other command outputs

### Phase 2.4: Permissions & Polish (Week 4)
1. Localize permission prompts
2. Localize trust level explanations
3. Add all non-English translations
4. Testing and refinement

## String Inventory

### Estimated String Count by Category

| Category | Estimated Strings |
|----------|-------------------|
| Session messages | ~15 |
| Tool feedback | ~25 |
| Permission system | ~12 |
| Error messages | ~30 |
| Slash commands | ~50 |
| Progress indicators | ~10 |
| **Total** | **~142** |

### Priority Strings (High Frequency)

1. "Thinking..." / "Generating..."
2. Token usage display
3. Tool execution status
4. Permission request prompts
5. Common error messages
6. `/help` command output

## Quality Requirements

### Translation Quality
- Native speaker review for each language
- Consistent terminology across the application
- Context-appropriate formality levels
- Technical terms may remain in English where appropriate

### Performance
- Translations loaded once per session
- No runtime translation lookups in hot paths
- Bundle size increase < 50KB

### Testing
- Unit tests for translation loading
- Snapshot tests for command outputs
- Manual testing for each language

## Success Metrics

1. **Coverage**: 100% of user-facing strings translated
2. **Quality**: < 5 translation issues reported per language in first month
3. **Performance**: No measurable impact on CLI responsiveness
4. **Adoption**: Track language preference distribution

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Translation quality issues | Medium | Native speaker review |
| String interpolation bugs | High | Comprehensive unit tests |
| Missing translations | Medium | Fallback to English |
| Bundle size bloat | Low | Lazy loading by language |

## Dependencies

- Phase 1 completion (Done)
- Language preference stored in user config (Done)
- Settings manager integration (Done)

## Open Questions

1. Should technical terms (API, MCP, etc.) be translated or kept in English?
   - **Recommendation**: Keep in English for consistency

2. Should number/date formatting be localized?
   - **Recommendation**: Phase 3 consideration

3. Should we support right-to-left languages in future?
   - **Recommendation**: Not in Phase 2, design for extensibility

## Appendix: Sample Translations

### Session Welcome

| Language | Translation |
|----------|-------------|
| en | Welcome to ax-glm! Type your message or /help for commands. |
| zh-CN | 欢迎使用 ax-glm！输入消息或 /help 查看命令。 |
| zh-TW | 歡迎使用 ax-glm！輸入訊息或 /help 查看指令。 |
| ja | ax-glm へようこそ！メッセージを入力するか /help でコマンドを確認してください。 |
| ko | ax-glm에 오신 것을 환영합니다! 메시지를 입력하거나 /help로 명령어를 확인하세요. |
| th | ยินดีต้อนรับสู่ ax-glm! พิมพ์ข้อความหรือ /help เพื่อดูคำสั่ง |
| vi | Chào mừng đến với ax-glm! Nhập tin nhắn hoặc /help để xem lệnh. |

### Token Usage

| Language | Translation |
|----------|-------------|
| en | Tokens: {input} in / {output} out |
| zh-CN | Token：{input} 输入 / {output} 输出 |
| zh-TW | Token：{input} 輸入 / {output} 輸出 |
| ja | トークン：{input} 入力 / {output} 出力 |
| ko | 토큰: {input} 입력 / {output} 출력 |
| th | โทเค็น: {input} เข้า / {output} ออก |
| vi | Token: {input} vào / {output} ra |
