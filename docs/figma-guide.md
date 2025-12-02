# Figma Integration Guide

This guide explains how to use AX CLI with Figma to automate design-to-code workflows, extract design tokens, and audit design consistency.

---

## Table of Contents

- [Quick Start](#quick-start)
- [Authentication](#authentication)
- [Commands](#commands)
  - [design map](#design-map)
  - [design alias](#design-alias)
  - [design tokens](#design-tokens)
  - [design audit](#design-audit)
- [Workflows](#workflows)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)

---

## Quick Start

```bash
# 1. Authenticate with Figma
ax-cli design auth login

# 2. Map your Figma file to see its structure
ax-cli design map YOUR_FILE_KEY

# 3. Create an alias for quick access
ax-cli design alias add hero 123:456

# 4. Extract design tokens
ax-cli design tokens pull YOUR_FILE_KEY --format tailwind --output tailwind.config.js

# 5. Audit your design for consistency
ax-cli design audit hero --rules all
```

---

## Authentication

### Get Your Figma Access Token

1. Go to [Figma Account Settings](https://www.figma.com/settings)
2. Scroll to **Personal Access Tokens**
3. Click **Generate new token**
4. Copy the token (you won't see it again!)

### Login Methods

```bash
# Interactive login (recommended)
ax-cli design auth login

# Set token directly
ax-cli design auth token YOUR_PERSONAL_ACCESS_TOKEN

# Check auth status
ax-cli design auth status
```

### Environment Variable

For CI/CD, set the `FIGMA_ACCESS_TOKEN` environment variable:

```bash
export FIGMA_ACCESS_TOKEN=your_token_here
ax-cli design tokens pull FILE_KEY --format json
```

---

## Commands

### design map

Display the structure of a Figma file as a navigable tree.

```bash
# Basic usage
ax-cli design map YOUR_FILE_KEY

# Limit depth (default: 3)
ax-cli design map YOUR_FILE_KEY --depth 5

# Start from a specific node (using alias)
ax-cli design map YOUR_FILE_KEY --subtree landing.hero

# Output as JSON (for scripting)
ax-cli design map YOUR_FILE_KEY --json
```

**Getting Your File Key:**

The file key is in your Figma URL:
```
https://www.figma.com/file/ABC123xyz/My-Design
                           ^^^^^^^^^
                           This is your file key
```

**Example Output:**

```
Page: Landing Page
├── Frame: Hero Section (123:456)
│   ├── Text: Headline
│   ├── Text: Subheadline
│   └── Frame: CTA Button
├── Frame: Features (123:789)
│   ├── Component: Feature Card
│   └── Component: Feature Card
└── Frame: Footer (123:012)
```

---

### design alias

Create shortcuts to frequently used Figma nodes.

```bash
# Add an alias
ax-cli design alias add hero 123:456
ax-cli design alias add ds.colors 789:012 --file ds-file-key

# List all aliases
ax-cli design alias list

# Remove an alias
ax-cli design alias remove hero
```

**Why Use Aliases?**

- **Stability**: Node IDs don't change when you rename layers
- **Readability**: `hero` is easier to remember than `123:456`
- **Team sharing**: Aliases stored in `.ax-cli/design.json` can be committed

**Aliases File:**

```json
{
  "version": 1,
  "defaultFile": "ABC123xyz",
  "aliases": {
    "landing.hero": { "fileKey": "ABC123xyz", "nodeId": "123:456" },
    "landing.features": { "fileKey": "ABC123xyz", "nodeId": "123:789" },
    "ds.colors": { "fileKey": "DS456def", "nodeId": "789:012" }
  },
  "dsFile": "DS456def"
}
```

---

### design tokens

Extract design tokens from Figma and convert to code-ready formats.

```bash
# Pull tokens as JSON
ax-cli design tokens pull FILE_KEY --format json --output tokens.json

# Pull tokens as Tailwind config
ax-cli design tokens pull FILE_KEY --format tailwind --output tailwind.config.js

# Compare local tokens with Figma
ax-cli design tokens compare FILE_KEY ./tokens.json
```

**Supported Token Types:**

| Type | Figma Source | Output |
|------|--------------|--------|
| Colors | Fill colors, Effects | HEX, RGB, HSL |
| Typography | Text styles | Font family, size, weight, line-height |
| Spacing | Auto-layout gaps, padding | px, rem |
| Border radius | Corner radius | px |
| Shadows | Drop shadows, Inner shadows | CSS box-shadow |

**JSON Output Example:**

```json
{
  "colors": {
    "primary": { "value": "#0066FF", "type": "color" },
    "secondary": { "value": "#FF6600", "type": "color" }
  },
  "spacing": {
    "xs": { "value": "4px", "type": "dimension" },
    "sm": { "value": "8px", "type": "dimension" },
    "md": { "value": "16px", "type": "dimension" }
  },
  "typography": {
    "heading-1": {
      "fontFamily": "Inter",
      "fontSize": "48px",
      "fontWeight": 700,
      "lineHeight": "56px"
    }
  }
}
```

**Tailwind Output Example:**

```javascript
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: '#0066FF',
        secondary: '#FF6600'
      },
      spacing: {
        xs: '4px',
        sm: '8px',
        md: '16px'
      },
      fontSize: {
        'heading-1': ['48px', { lineHeight: '56px', fontWeight: '700' }]
      }
    }
  }
}
```

---

### design audit

Run design consistency checks against your Figma file.

```bash
# Audit a specific node
ax-cli design audit landing.hero

# Audit with specific rules
ax-cli design audit landing.hero --rules spacing-consistency,color-contrast

# Output as JSON (for CI/CD)
ax-cli design audit landing.hero --json
```

**Available Rules:**

| Rule | Description | Severity |
|------|-------------|----------|
| `spacing-consistency` | Spacing values match design system tokens | warning |
| `color-contrast` | WCAG AA/AAA compliance for text | error |
| `naming-convention` | Component/layer names follow pattern | info |
| `token-usage` | Colors and text styles match defined tokens | warning |
| `missing-autolayout` | Frames without auto-layout | info |

**Example Output:**

```
Design Audit Report: landing.hero

  ERRORS (1)
  color-contrast: Text "Subscribe" (#666666 on #FFFFFF) fails WCAG AA
                  Contrast ratio: 4.2:1 (minimum: 4.5:1)
                  Node: 123:789

  WARNINGS (2)
  spacing-consistency: Padding 17px doesn't match token (expected 16px)
                       Node: 123:456
  token-usage: Color #0065FF not in design system (closest: #0066FF)
               Node: 123:012

  INFO (1)
  missing-autolayout: Frame "Card" uses fixed positioning
                      Consider auto-layout for responsive design
                      Node: 123:345

Summary: 1 error, 2 warnings, 1 info
```

---

## Workflows

### Design Token Sync Workflow

Keep your codebase in sync with Figma design tokens:

```bash
# 1. Pull latest tokens from Figma
ax-cli design tokens pull FILE_KEY --format tailwind --output src/styles/tokens.js

# 2. Compare with existing tokens
ax-cli design tokens compare FILE_KEY src/styles/tokens.js

# 3. Run audit to check consistency
ax-cli design audit ds.colors --rules token-usage --json > audit-report.json
```

### CI/CD Integration

Add to your CI pipeline to catch design drift:

```yaml
# .github/workflows/design-audit.yml
name: Design Audit
on: [pull_request]

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
      - run: npm install -g @defai.digital/ax-cli
      - run: ax-cli design audit landing.hero --json > audit.json
        env:
          FIGMA_ACCESS_TOKEN: ${{ secrets.FIGMA_ACCESS_TOKEN }}
      - name: Check for errors
        run: |
          if jq -e '.errors | length > 0' audit.json; then
            echo "Design audit failed!"
            exit 1
          fi
```

### Component Documentation

Generate component documentation from Figma:

```bash
# Map your design system file
ax-cli design map DS_FILE_KEY --depth 4 --json > components.json

# Use with your documentation tool
ax-cli -p "Generate component documentation from this Figma structure" < components.json
```

---

## Configuration

### Project Configuration

Store Figma settings in `.ax-cli/design.json`:

```json
{
  "version": 1,
  "defaultFile": "YOUR_DEFAULT_FILE_KEY",
  "dsFile": "YOUR_DESIGN_SYSTEM_FILE_KEY",
  "aliases": {},
  "audit": {
    "rules": ["spacing-consistency", "color-contrast", "token-usage"],
    "ignorePatterns": ["**/deprecated/**"]
  },
  "tokens": {
    "format": "tailwind",
    "output": "src/styles/design-tokens.js"
  }
}
```

### Rate Limiting

Figma Professional plan allows 60 requests/minute. AX CLI automatically:
- Caches responses to minimize API calls
- Implements exponential backoff on rate limit errors
- Shows progress for long operations

---

## Troubleshooting

### Common Errors

**"Invalid token" or "403 Forbidden"**
```bash
# Re-authenticate
ax-cli design auth login

# Verify token has correct permissions
ax-cli design auth status
```

**"File not found"**
- Check your file key is correct (from the Figma URL)
- Ensure you have access to the file in Figma

**"Rate limit exceeded"**
- Wait 60 seconds and retry
- Use `--json` output and cache results locally
- Consider upgrading to Figma Organization plan for higher limits

**"Node not found"**
- Node IDs can change when duplicating frames
- Use aliases for stable references
- Re-run `design map` to find new node IDs

### Debug Mode

```bash
# Enable verbose logging
ax-cli --debug design map FILE_KEY
```

---

## Best Practices

1. **Use aliases for important nodes** - They're stable and readable
2. **Commit `.ax-cli/design.json`** - Share aliases with your team
3. **Set up CI audits** - Catch design drift before it ships
4. **Extract tokens regularly** - Keep code and design in sync
5. **Use JSON output for automation** - All commands support `--json`

---

## Related Documentation

- [MCP Integration](mcp.md) - Extend with Model Context Protocol
- [CLI Reference](cli-reference.md) - Complete command reference
- [Configuration](configuration.md) - All configuration options
- [ADR-004: Figma Integration](adr/004-figma-integration.md) - Architecture decisions

---

## Need Help?

- [GitHub Issues](https://github.com/defai-digital/ax-cli/issues)
- [Figma API Documentation](https://www.figma.com/developers/api)
