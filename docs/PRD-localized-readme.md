# PRD: Localized README Files

## Overview

Add localized README files to improve accessibility for users whose English proficiency is limited. This aligns with the existing i18n system that supports 7 languages.

## Problem Statement

Users with limited English ability may struggle to understand the main README.md, which reduces adoption and increases support burden. Since AX CLI already has i18n support for UI/commands, extending this to documentation is a natural next step.

## Goals

1. Provide README translations for all supported languages
2. Make language options immediately discoverable
3. Establish a maintainable translation workflow
4. Follow open-source best practices (Vue.js, Vite patterns)

## Non-Goals

- Full documentation translation (only README)
- Automatic browser-based language detection
- Real-time translation API integration

## Target Languages (Priority Order)

| Priority | Code | Language | Native Name |
|----------|------|----------|-------------|
| 1 | zh-CN | Simplified Chinese | 简体中文 |
| 2 | zh-TW | Traditional Chinese | 繁體中文 |
| 3 | ja | Japanese | 日本語 |
| 4 | ko | Korean | 한국어 |
| 5 | de | German | Deutsch |
| 6 | es | Spanish | Español |
| 7 | pt | Portuguese | Português |
| 8 | fr | French | Français |
| 9 | vi | Vietnamese | Tiếng Việt |
| 10 | th | Thai | ไทย |

## Technical Design

### File Structure

```
/
├── README.md              # English (Source of Truth)
├── README.zh-CN.md        # 简体中文
├── README.zh-TW.md        # 繁體中文
├── README.ja.md           # 日本語
├── README.ko.md           # 한국어
├── README.de.md           # Deutsch
├── README.es.md           # Español
├── README.pt.md           # Português
├── README.fr.md           # Français
├── README.vi.md           # Tiếng Việt
├── README.th.md           # ไทย
└── docs/
    └── TRANSLATING.md     # Translation contribution guide
```

**Rationale for root placement:**
- Immediate visibility in GitHub file browser
- Follows Vue.js, Vite, and other major projects
- Users see language options when landing on repo

### Navigation Header

Add to the top of README.md (after badges, before content):

```markdown
<p align="center">
  <a href="./README.md">English</a> |
  <a href="./README.zh-CN.md">简体中文</a> |
  <a href="./README.zh-TW.md">繁體中文</a> |
  <a href="./README.ja.md">日本語</a> |
  <a href="./README.ko.md">한국어</a> |
  <a href="./README.de.md">Deutsch</a> |
  <a href="./README.es.md">Español</a> |
  <a href="./README.pt.md">Português</a> |
  <a href="./README.fr.md">Français</a> |
  <a href="./README.vi.md">Tiếng Việt</a> |
  <a href="./README.th.md">ไทย</a>
</p>
```

**Design decisions:**
- Use native script names (users recognize their language faster)
- Pipe-separated for clean, scannable layout
- Centered for visual balance
- No flag emojis (politically sensitive for zh-CN/zh-TW)

### Version Sync Indicator

Each localized README includes at the top:

```markdown
> 📖 This translation is based on [README.md @ v5.1.7](./README.md)
```

This helps users know if the translation is current.

### Translation Scope

| Section | Translate | Rationale |
|---------|-----------|-----------|
| Project description | ✅ Yes | Core understanding |
| Quick Start | ✅ Yes | Critical for adoption |
| Installation | ✅ Yes | Critical for adoption |
| Why AX CLI (features table) | ✅ Yes | Value proposition |
| Basic Usage | ✅ Yes | Getting started |
| Configuration | ✅ Yes | Common need |
| Code examples | ❌ No | Universal syntax |
| Command syntax | ❌ No | Must match actual CLI |
| Changelog | ❌ No | Changes frequently |
| Contributing | ❌ No | English is lingua franca for PRs |

### Encoding & Formatting

- All files: UTF-8 encoding
- Line endings: LF (Unix style)
- Thai/Vietnamese: May include terminal font notes

## Implementation Plan

### Phase 1: Infrastructure (Current)
1. Create this PRD
2. Add navigation header to main README.md
3. Create `docs/TRANSLATING.md` guide

### Phase 2: Priority Languages
4. Create README.zh-CN.md
5. Create README.zh-TW.md
6. Create README.ja.md
7. Create README.ko.md

### Phase 3: European Languages
8. Create README.de.md
9. Create README.es.md
10. Create README.pt.md
11. Create README.fr.md

### Phase 4: Southeast Asian Languages
12. Create README.vi.md
13. Create README.th.md

## Maintenance Strategy

### Sync Detection
- GitHub Action to comment on PRs that modify README.md
- Reminder to update translations

### Community Contributions
- `docs/TRANSLATING.md` explains how to contribute
- List language maintainers when available
- Accept PRs for translation fixes

### AI-Assisted Drafts
- Use LLM to generate initial translation drafts
- Human review before merging (especially for technical terms)
- Keep CLI command names untranslated

## Success Metrics

1. All 10 language READMEs created and linked
2. Navigation header visible on main README
3. Translation contribution guide available
4. No broken links in navigation

## References

- [Vue.js localized READMEs](https://github.com/vuejs/vue)
- [Vite localized READMEs](https://github.com/vitejs/vite)
- [AX CLI i18n system](../packages/core/src/i18n/README.md)

---

Created: 2025-12-25
Status: Approved for implementation
