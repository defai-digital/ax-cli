# Translation Guide

This document explains how to contribute translations to AX CLI documentation.

## Available Languages

| Code | Language | Native Name | Status |
|------|----------|-------------|--------|
| en | English | English | Source |
| zh-CN | Simplified Chinese | 简体中文 | Active |
| zh-TW | Traditional Chinese | 繁體中文 | Active |
| ja | Japanese | 日本語 | Active |
| ko | Korean | 한국어 | Active |
| de | German | Deutsch | Active |
| es | Spanish | Español | Active |
| pt | Portuguese | Português | Active |
| fr | French | Français | Active |
| vi | Vietnamese | Tiếng Việt | Active |
| th | Thai | ไทย | Active |

## File Structure

```
/
├── README.md              # English (Source of Truth)
├── README.zh-CN.md        # Simplified Chinese
├── README.zh-TW.md        # Traditional Chinese
├── README.ja.md           # Japanese
├── README.ko.md           # Korean
├── README.de.md           # German
├── README.es.md           # Spanish
├── README.pt.md           # Portuguese
├── README.fr.md           # French
├── README.vi.md           # Vietnamese
└── README.th.md           # Thai
```

## How to Contribute

### Fixing Existing Translations

1. Find the localized README file (e.g., `README.ja.md`)
2. Make your corrections
3. Submit a Pull Request with:
   - Title: `docs(i18n): Fix [language] translation`
   - Description: What was incorrect and how you fixed it

### Updating Outdated Translations

When `README.md` (English) is updated, translations may become outdated.

1. Compare the English README with your target language
2. Update the translated content
3. Update the version sync indicator at the top of the file:
   ```markdown
   > 📖 This translation is based on [README.md @ v5.1.7](./README.md)
   ```
4. Submit a PR with title: `docs(i18n): Update [language] for v5.x.x`

## Translation Guidelines

### Do Translate

- Project description and introduction
- Installation instructions
- Usage examples (prose, not code)
- Feature descriptions
- FAQ and troubleshooting prose

### Do NOT Translate

- Command names (`ax-glm`, `ax-grok`, `/init`, `/help`)
- CLI flags (`--react`, `--verify`, `-p`)
- Code examples and syntax
- Technical terms when they're widely used in English
- File paths and configuration keys
- Package names (`@defai.digital/ax-glm`)

### Style Guidelines

1. **Keep CLI commands in English**
   ```bash
   # Good
   npm install -g @defai.digital/ax-glm
   ax-glm setup

   # The description around it should be translated
   ```

2. **Preserve markdown formatting**
   - Keep the same heading levels
   - Maintain table structure
   - Preserve links and image references

3. **Use formal/polite language**
   - Japanese: です/ます form
   - Korean: 합니다/습니다 form
   - Thai/Vietnamese: Polite register

4. **Technical term handling**
   - "CLI" → Keep as "CLI" (universal)
   - "API key" → Keep or use local equivalent if well-known
   - "token" → Keep as "token" in most contexts

### Language-Specific Notes

#### Chinese (zh-CN / zh-TW)
- Use appropriate character set (Simplified vs Traditional)
- Keep technical terms in English with Chinese explanation if needed

#### Japanese (ja)
- Use katakana for foreign technical terms when appropriate
- Example: "インストール" for "install"

#### Korean (ko)
- Mix of Hangul and English for technical terms is acceptable
- Example: "설치하기" for "installation"

#### Thai (th) / Vietnamese (vi)
- Terminal fonts may not render all characters well
- Consider adding a note about font requirements if relevant

## Quality Checklist

Before submitting a translation PR:

- [ ] All section headers are translated
- [ ] Navigation links work correctly
- [ ] Code examples are NOT translated
- [ ] CLI commands remain in English
- [ ] Version sync indicator is updated
- [ ] No broken markdown formatting
- [ ] Spelling and grammar checked

## Getting Help

- Open an issue with the `i18n` label
- Tag language-specific maintainers (see below)

## Language Maintainers

Want to become a maintainer? Open an issue or submit a few translation PRs.

| Language | Maintainers |
|----------|-------------|
| zh-CN | (seeking maintainers) |
| zh-TW | (seeking maintainers) |
| ja | (seeking maintainers) |
| ko | (seeking maintainers) |
| de | (seeking maintainers) |
| es | (seeking maintainers) |
| pt | (seeking maintainers) |
| fr | (seeking maintainers) |
| vi | (seeking maintainers) |
| th | (seeking maintainers) |

---

Thank you for helping make AX CLI accessible to more developers!
