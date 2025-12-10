# User Guide: Multi-line Input Modes
Last reviewed: 2025-02-21  
Status: Historical reference for 3.8.x; current defaults follow v4.4.x behavior.

---

## Table of Contents

1. [Introduction](#introduction)
2. [Quick Start](#quick-start)
3. [Input Modes](#input-modes)
4. [Smart Detection](#smart-detection)
5. [Configuration](#configuration)
6. [Visual Feedback](#visual-feedback)
7. [Keyboard Shortcuts](#keyboard-shortcuts)
8. [Best Practices](#best-practices)
9. [Examples](#examples)
10. [Troubleshooting](#troubleshooting)

---

## Introduction

AX CLI provides three flexible input modes to match your workflow:

- **Newline Mode** (default): Industry-standard behavior for modern chat apps
- **Submit Mode** (legacy): Traditional CLI behavior for terminal power users
- **Smart Mode** (auto-detect): Context-aware Enter behavior for mixed content

Choose the mode that fits your use case, or customize the smart detection algorithm for fine-grained control.

---

## Quick Start

### Default Behavior (Newline Mode)

Out of the box, AX CLI uses **Newline Mode**:

- **Enter** → Inserts a newline
- **Shift+Enter** → Submits your message

**Example:**
```
You: ❯ Hello AI, please help me with     ← Press Enter
    │ a multi-line question about         ← Continues typing
    │ TypeScript types.                   ← Press Shift+Enter to submit
```

### Switching to Legacy Behavior (Submit Mode)

If you prefer the traditional CLI behavior:

1. Create or edit `.ax-cli/settings.json`:
   ```json
   {
     "input": {
       "enterBehavior": "submit"
     }
   }
   ```

2. Restart AX CLI:
   ```bash
   npm run dev
   ```

Now:
- **Enter** → Submits your message
- **Shift+Enter** → Inserts a newline

---

## Input Modes

### Newline Mode (Default)

**Best for:** Modern chat interface users, code input, prose writing

**Behavior:**
- Enter → Inserts newline
- Shift+Enter → Submits message

**When to use:**
- Writing multi-line code snippets
- Composing longer prose questions
- Familiar with ChatGPT, Slack, Discord

**Configuration:**
```json
{
  "input": {
    "enterBehavior": "newline"
  }
}
```

**Example workflow:**
```
You: ❯ I need help debugging this code:
    │ function add(a, b) {
    │   return a + b;
    │ }
    │                              ← Press Shift+Enter to submit
```

---

### Submit Mode (Legacy)

**Best for:** Traditional CLI users, single-line commands

**Behavior:**
- Enter → Submits message
- Shift+Enter → Inserts newline

**When to use:**
- Primarily single-line commands
- Familiar with bash, python REPL
- Want fastest submission

**Configuration:**
```json
{
  "input": {
    "enterBehavior": "submit"
  }
}
```

**Example workflow:**
```
You: ❯ What is the capital of France?    ← Press Enter (submits)

You: ❯ Tell me about TypeScript          ← Press Shift+Enter (newline)
    │ and its type system
    │ in detail                           ← Press Enter (submits)
```

---

### Smart Mode (Auto-detect)

**Best for:** Power users, mixed content (code + prose), context-aware input

**Behavior:**
- Shift+Enter → Always submits (explicit)
- Enter → Context-aware:
  - If input looks **incomplete** → Inserts newline
  - If input looks **complete** → Submits message

**When to use:**
- Working with both code and prose
- Want automatic incomplete input detection
- Prefer minimal key presses

**Configuration:**
```json
{
  "input": {
    "enterBehavior": "smart",
    "smartDetection": {
      "enabled": true,
      "checkBrackets": true,
      "checkOperators": true,
      "checkStatements": true
    }
  }
}
```

**Example workflow:**
```
You: ❯ if (foo ==                        ← Press Enter
    │                                     ← Newline (incomplete: unclosed paren + trailing operator)

You: ❯ const arr = [1, 2,                ← Press Enter
    │                                     ← Newline (incomplete: unclosed bracket)

You: ❯ What is TypeScript?               ← Press Enter
→ Submits (complete)

You: ❯ if (incomplete ==                 ← Press Shift+Enter
→ Submits (explicit override)
```

---

## Smart Detection

### How It Works

Smart mode uses a three-level detection algorithm:

#### 1. Bracket Detection

Counts opening and closing brackets to detect unclosed pairs.

**Detects:**
- Unclosed parentheses: `(`
- Unclosed square brackets: `[`
- Unclosed curly braces: `{`

**Examples:**
```javascript
if (foo ==           → Incomplete (unclosed parenthesis)
const arr = [1, 2,   → Incomplete (unclosed square bracket)
const obj = {        → Incomplete (unclosed curly brace)
Math.max(1, 2)       → Complete (balanced parentheses)
```

#### 2. Operator Detection

Checks if input ends with trailing operators.

**Detects:**
- Arithmetic: `+`, `-`, `*`, `/`, `%`
- Assignment: `=`, `==`, `===`
- Comparison: `!=`, `!==`, `<`, `>`, `<=`, `>=`
- Logical: `&&`, `||`
- Special: `=>`, `?`, `:`, `,`, `.`, `...`

**Examples:**
```javascript
const x = 1 +        → Incomplete (trailing +)
let y =              → Incomplete (trailing =)
const fn =>          → Incomplete (trailing arrow)
if (a ==             → Incomplete (trailing ==)
hello world          → Complete (no trailing operator)
```

#### 3. Statement Detection

Detects incomplete statement keywords.

**Detects:**
- Control flow: `if`, `else`, `for`, `while`, `do`, `switch`, `case`
- Declarations: `const`, `let`, `var`, `function`, `class`
- TypeScript: `interface`, `type`, `enum`
- Import/Export: `import`, `export`
- Exceptions: `try`, `catch`, `finally`
- Async: `async`, `await`

**Examples:**
```javascript
if                   → Incomplete (keyword alone)
if (condition)       → Incomplete (no opening brace or semicolon)
const                → Incomplete (keyword alone)
function             → Incomplete (keyword alone)
if (x) console.log(x); → Complete (has semicolon)
```

### Granular Control

You can enable/disable specific detection types:

**Brackets Only:**
```json
{
  "input": {
    "enterBehavior": "smart",
    "smartDetection": {
      "enabled": true,
      "checkBrackets": true,
      "checkOperators": false,
      "checkStatements": false
    }
  }
}
```

**Operators Only:**
```json
{
  "input": {
    "enterBehavior": "smart",
    "smartDetection": {
      "enabled": true,
      "checkBrackets": false,
      "checkOperators": true,
      "checkStatements": false
    }
  }
}
```

**All Enabled (Default):**
```json
{
  "input": {
    "enterBehavior": "smart",
    "smartDetection": {
      "enabled": true,
      "checkBrackets": true,
      "checkOperators": true,
      "checkStatements": true
    }
  }
}
```

---

## Configuration

### Full Configuration Schema

```json
{
  "input": {
    "enterBehavior": "newline",  // or "submit", "smart"
    "submitKeys": ["shift+enter"],
    "multilineIndicator": "│ ",
    "smartDetection": {
      "enabled": true,
      "checkBrackets": true,
      "checkOperators": true,
      "checkStatements": true
    }
  }
}
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enterBehavior` | `string` | `"newline"` | Input mode: `"newline"`, `"submit"`, or `"smart"` |
| `submitKeys` | `string[]` | `["shift+enter"]` | Keys that trigger submission |
| `multilineIndicator` | `string` | `"│ "` | Visual indicator for continuation lines |
| `smartDetection.enabled` | `boolean` | `true` | Enable smart detection (smart mode only) |
| `smartDetection.checkBrackets` | `boolean` | `true` | Detect unclosed brackets |
| `smartDetection.checkOperators` | `boolean` | `true` | Detect trailing operators |
| `smartDetection.checkStatements` | `boolean` | `true` | Detect incomplete statements |

### Where to Configure

**Project-level:** `.ax-cli/settings.json` (in your project directory)

```json
{
  "input": {
    "enterBehavior": "smart"
  }
}
```

**User-level:** `~/.ax-cli/config.json` (global default)

```json
{
  "input": {
    "enterBehavior": "newline",
    "multilineIndicator": "→ "
  }
}
```

**Priority:** Project settings override user settings.

---

## Visual Feedback

### Multi-line Indicator

When typing multi-line input, continuation lines show a visual indicator:

```
You: ❯ Line 1
    │ Line 2
    │ Line 3
```

**Customization:**
```json
{
  "input": {
    "multilineIndicator": "→ "
  }
}
```

**Result:**
```
You: ❯ Line 1
    → Line 2
    → Line 3
```

### Input Mode Hints

At the bottom of the input box, a hint shows the current mode:

**Newline Mode:**
```
[143/20000]
Enter for newline, Shift+Enter to submit
```

**Submit Mode:**
```
[143/20000]
Enter to submit, Shift+Enter for newline
```

**Smart Mode:**
```
[143/20000]
Smart mode: Enter adapts to context, Shift+Enter to submit
```

### Character Count

The character count displays in the bottom-right corner with color coding:

| Range | Color | Meaning |
|-------|-------|---------|
| 0-9,999 | Gray | Normal usage |
| 10,000-15,999 | Cyan | 50% threshold reached |
| 16,000-19,999 | Yellow | 80% warning |
| 20,000+ | Red | At/over limit |

**Example:**
```
[143/20000]      ← Gray (normal)
[12345/20000]    ← Cyan (50%)
[18500/20000]    ← Yellow (80%)
[20000/20000]    ← Red (limit)
```

---

## Keyboard Shortcuts

### Universal Shortcuts

| Key | Action |
|-----|--------|
| Shift+Enter | Submit message (all modes) |
| Ctrl+C | Cancel current input |
| Up/Down Arrow | Navigate input history |
| Ctrl+L | Clear screen |

### Mode-Specific Shortcuts

#### Newline Mode
| Key | Action |
|-----|--------|
| Enter | Insert newline |
| Shift+Enter | Submit message |

#### Submit Mode
| Key | Action |
|-----|--------|
| Enter | Submit message |
| Shift+Enter | Insert newline |

#### Smart Mode
| Key | Action |
|-----|--------|
| Enter | Context-aware (newline or submit) |
| Shift+Enter | Submit message (explicit) |

---

## Best Practices

### Choosing the Right Mode

**Use Newline Mode if:**
- You frequently write multi-line code snippets
- You compose longer prose questions
- You're familiar with ChatGPT, Slack, or Discord
- You want the industry-standard behavior

**Use Submit Mode if:**
- You primarily type single-line commands
- You're a terminal power user
- You prefer traditional CLI behavior
- You want the fastest possible submission

**Use Smart Mode if:**
- You work with both code and prose
- You want automatic incomplete input detection
- You prefer context-aware behavior
- You're comfortable with AI making submission decisions

### Writing Multi-line Input

**Newline Mode:**
```
1. Start typing your message
2. Press Enter to add new lines
3. Continue typing
4. Press Shift+Enter when done
```

**Submit Mode:**
```
1. Start typing your message
2. Press Shift+Enter to add new lines
3. Continue typing
4. Press Enter when done
```

**Smart Mode:**
```
1. Start typing your message
2. Press Enter (auto-detects if complete)
   - Incomplete → Newline inserted
   - Complete → Message submitted
3. Use Shift+Enter for explicit submission
```

### Working with Code

**Recommended mode:** Newline or Smart

**Example workflow (Newline Mode):**
```
You: ❯ I need help with this TypeScript function:    ← Enter
    │                                                 ← Enter (blank line)
    │ function calculateTotal(items: Item[]): number {  ← Enter
    │   return items.reduce((sum, item) => {          ← Enter
    │     return sum + item.price;                    ← Enter
    │   }, 0);                                        ← Enter
    │ }                                               ← Enter
    │                                                 ← Enter (blank line)
    │ It's not type-checking correctly.              ← Shift+Enter (submit)
```

**Example workflow (Smart Mode):**
```
You: ❯ function add(a, b) {                          ← Enter (incomplete: { )
    │   return a + b;                                ← Enter (incomplete: ; but inside block)
    │ }                                              ← Enter (complete)
→ Submits automatically
```

### Writing Prose

**Recommended mode:** Newline or Smart

**Example (Newline Mode):**
```
You: ❯ Please analyze the following scenario:        ← Enter
    │                                                 ← Enter
    │ A software company wants to migrate from       ← Enter
    │ a monolithic architecture to microservices.    ← Enter
    │ What are the key considerations?              ← Shift+Enter (submit)
```

### Working with JSON

**Recommended mode:** Smart (auto-detects unclosed braces)

**Example:**
```
You: ❯ {                                             ← Enter (incomplete: { )
    │   "name": "John",                              ← Enter (incomplete: , )
    │   "age": 30,                                   ← Enter (incomplete: , )
    │   "city": "New York"                           ← Enter (complete line but inside { )
    │ }                                              ← Enter (complete)
→ Submits automatically
```

---

## Examples

### Example 1: Simple Question (All Modes)

**Newline Mode:**
```
You: ❯ What is TypeScript?    ← Enter (newline)
    │                          ← Shift+Enter (submit)
```

**Submit Mode:**
```
You: ❯ What is TypeScript?    ← Enter (submits)
```

**Smart Mode:**
```
You: ❯ What is TypeScript?    ← Enter (submits - complete)
```

---

### Example 2: Multi-line Code (Newline vs. Smart)

**Newline Mode:**
```
You: ❯ function fibonacci(n: number): number {    ← Enter
    │   if (n <= 1) return n;                     ← Enter
    │   return fibonacci(n - 1) + fibonacci(n - 2);  ← Enter
    │ }                                           ← Shift+Enter (submit)
```

**Smart Mode:**
```
You: ❯ function fibonacci(n: number): number {    ← Enter (incomplete: { )
    │   if (n <= 1) return n;                     ← Enter (incomplete: ; inside block)
    │   return fibonacci(n - 1) + fibonacci(n - 2);  ← Enter (incomplete: ; inside block)
    │ }                                           ← Enter (complete - all brackets closed)
→ Submits automatically
```

---

### Example 3: Prose with Smart Detection

**Smart Mode:**
```
You: ❯ Explain the difference between            ← Enter (incomplete: between )
    │ synchronous and asynchronous programming   ← Enter (complete)
→ Submits automatically
```

Alternative:
```
You: ❯ Explain the difference between synchronous and asynchronous programming    ← Enter (complete)
→ Submits automatically
```

---

### Example 4: JSON Input (Smart Mode)

```
You: ❯ Please validate this JSON:                ← Enter (incomplete: : )
    │ {                                           ← Enter (incomplete: { )
    │   "users": [                                ← Enter (incomplete: [ )
    │     { "name": "Alice", "age": 30 },        ← Enter (incomplete: , )
    │     { "name": "Bob", "age": 25 }           ← Enter (complete line but inside [ )
    │   ],                                        ← Enter (incomplete: , )
    │   "count": 2                                ← Enter (complete line but inside { )
    │ }                                           ← Enter (complete - all brackets closed)
→ Submits automatically
```

---

### Example 5: Explicit Override (Smart Mode)

Sometimes smart mode might not submit when you want:

```
You: ❯ if (condition)                             ← Enter (incomplete: no { or ; )
    │                                              ← Type more...
```

Force submission with Shift+Enter:

```
You: ❯ if (condition)                             ← Shift+Enter (explicit submit)
→ Submits immediately
```

---

## Troubleshooting

### Issue: Shift+Enter Doesn't Work

**Symptoms:**
- Pressing Shift+Enter doesn't submit
- Inserts newline instead of submitting

**Solutions:**

1. **Check your terminal:**
   - iTerm2: ✅ Should work
   - Terminal.app: ✅ Works on macOS 10.15+
   - VS Code terminal: ✅ Should work
   - Windows Terminal: ✅ Should work

2. **Try a different terminal:**
   ```bash
   # Test in iTerm2 or VS Code
   npm run dev
   ```

3. **Fallback to submit mode:**
   ```json
   {
     "input": {
       "enterBehavior": "submit"
     }
   }
   ```

---

### Issue: Smart Mode Submits Too Early

**Symptoms:**
- Smart mode submits when you wanted to continue typing

**Solutions:**

1. **Press Enter again** (will insert newline on subsequent presses)

2. **Disable operator detection:**
   ```json
   {
     "input": {
       "enterBehavior": "smart",
       "smartDetection": {
         "checkBrackets": true,
         "checkOperators": false,  ← Disable
         "checkStatements": true
       }
     }
   }
   ```

3. **Use newline mode:**
   ```json
   {
     "input": {
       "enterBehavior": "newline"
     }
   }
   ```

---

### Issue: Smart Mode Doesn't Submit When Expected

**Symptoms:**
- Smart mode inserts newline when you wanted to submit

**Solutions:**

1. **Use Shift+Enter for explicit submission** (always works)

2. **Check for trailing whitespace:**
   - Trailing spaces might look complete but aren't trimmed

3. **Enable more detection types:**
   ```json
   {
     "input": {
       "enterBehavior": "smart",
       "smartDetection": {
         "checkBrackets": true,
         "checkOperators": true,    ← Enable
         "checkStatements": true    ← Enable
       }
     }
   }
   ```

---

### Issue: Character Count Seems Wrong

**Symptoms:**
- Character count doesn't match visual characters

**Explanation:**

The count represents UTF-16 code units, not visual characters.

**Example:**
- `hello` = 5 chars ✅
- `👍🏽` = 4 chars (2 code units per emoji) ⚠️

This is a limitation of JavaScript's string length calculation and doesn't affect functionality.

---

### Issue: Multi-line Indicator Not Showing

**Symptoms:**
- Continuation lines don't show `│ ` indicator

**Solutions:**

1. **Check your configuration:**
   ```json
   {
     "input": {
       "multilineIndicator": "│ "  ← Must be set
     }
   }
   ```

2. **Verify you're in multi-line mode:**
   - Type some text and press Enter to create a second line

3. **Check terminal rendering:**
   - Some terminals may not support special characters
   - Try a simpler indicator: `"> "`

---

## Additional Resources

- **Migration Guide:** `docs/migration-guides/phase1-multiline-input.md`
- **Configuration Reference:** `docs/api/configuration.md`
- **Keyboard Shortcuts:** `docs/user-guides/keyboard-shortcuts.md`
- **GitHub Issues:** https://github.com/defai-digital/ax-cli/issues

---

## Feedback

We're continuously improving the multi-line input experience. If you have suggestions or encounter issues:

1. **Open an issue:** https://github.com/defai-digital/ax-cli/issues
2. **Include:**
   - Your configuration
   - Terminal type and version
   - Steps to reproduce
   - Expected vs. actual behavior

---

**Happy coding! 🚀**
