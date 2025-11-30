# Testing the AX CLI VSCode Extension

## Quick Start Testing

### 1. Verify Installation

First, confirm the extension is installed:

```bash
# Check extension status
ax-cli vscode status

# Or check in VSCode
code --list-extensions | grep ax-cli
```

Expected output:
```
✓ VSCode installed (code)
✓ AX CLI extension installed (v0.1.0)
```

### 2. Reload VSCode

**IMPORTANT**: After installing the extension, reload VSCode:

**Method 1: Keyboard Shortcut**
- Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
- Type: "Developer: Reload Window"
- Press Enter

**Method 2: Restart VSCode**
- Close VSCode completely
- Reopen it

### 3. Open the AX CLI Chat

**Method 1: Keyboard Shortcut (Recommended)**
- Press `Cmd+Shift+A` (Mac) or `Ctrl+Shift+A` (Windows/Linux)

**Method 2: Activity Bar**
- Look for the AX icon in the left sidebar (Activity Bar)
- Click it

**Method 3: Command Palette**
- Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
- Type: "AX: Open Chat"
- Press Enter

### 4. Verify Chat Interface Loads

You should see:
- ✓ "AX CLI Assistant" header
- ✓ Input box at the bottom
- ✓ "Send" button
- ✓ "Clear history" button (top-right)

---

## Testing Features

### Test 1: Basic Chat ✅

**What to test**: Simple question/answer

**Steps**:
1. Open AX CLI chat (`Cmd+Shift+A`)
2. Type: "What is TypeScript?"
3. Press `Enter` or click "Send"

**Expected**:
- Loading indicator appears ("Thinking...")
- AI response appears with formatted text
- Response includes markdown formatting

**Troubleshooting**:
- If nothing happens: Check the Developer Console (Help → Toggle Developer Tools)
- If error appears: Check that `ax-cli setup` was run and API key is configured

### Test 2: Code Explanation 🔍

**What to test**: Explain selected code

**Steps**:
1. Open a TypeScript/JavaScript file in VSCode
2. Select some code (e.g., a function)
3. Press `Cmd+Shift+E` (Mac) or `Ctrl+Shift+E` (Windows/Linux)
4. Or right-click → "AX: Explain Selection"

**Expected**:
- AX chat opens automatically
- Message sent: "Explain this code in detail"
- Context includes your selected code
- AI explains the code

### Test 3: File Analysis 📄

**What to test**: Analyze current file

**Steps**:
1. Open a code file
2. Press `Cmd+Shift+P` and type "AX: Analyze Current File"
3. Or use Command Palette → "AX: Analyze File"

**Expected**:
- Chat opens with analysis request
- AI analyzes the entire file
- Suggests improvements

### Test 4: Generate Tests 🧪

**What to test**: Test generation

**Steps**:
1. Open a file with a function
2. Command Palette → "AX: Generate Tests"

**Expected**:
- Chat opens
- AI generates unit tests for the file
- Tests are formatted in code blocks

### Test 5: Code Changes with Diff Preview 🎯

**What to test**: Claude Code-like diff preview (KEY FEATURE!)

**Steps**:
1. Open AX chat
2. Type: "Create a new file called test.ts with a hello world function"
3. Press Enter
4. Wait for AI to process

**Expected**:
- AI thinks about the request
- **DIFF VIEWER APPEARS** showing the new file content
- You see:
  - Before (empty)
  - After (file with function)
  - **Accept** button
  - **Reject** button
  - **Show in Editor** button

**Test Accept**:
1. Click "Accept"
2. File `test.ts` should be created with the content

**Test Reject**:
1. Ask: "Add a goodbye function to test.ts"
2. When diff appears, click "Reject"
3. File should NOT be modified

**Test Show in Editor**:
1. Ask: "Add a goodbye function to test.ts"
2. Click "Show in Editor"
3. VSCode native diff viewer opens
4. Accept or Reject from the info message

### Test 6: String Replacement 🔄

**What to test**: File editing with diff preview

**Steps**:
1. Create a file with some content:
   ```typescript
   function hello() {
     return "Hello";
   }
   ```
2. In chat, ask: "Change the function name to greet"
3. Wait for diff preview

**Expected**:
- Diff shows before/after
- "hello" → "greet" highlighted
- Accept applies the change
- Reject keeps original

### Test 7: Multiple Changes 📝

**What to test**: Sequential changes with approval

**Steps**:
1. Ask: "Create a Calculator class with add and subtract methods"
2. Accept the first change (file creation)
3. Ask: "Add multiply and divide methods"
4. Accept the second change

**Expected**:
- Each change shows diff preview
- Each requires approval
- Changes apply sequentially

### Test 8: Code Blocks 📋

**What to test**: Copy and apply code

**Steps**:
1. Ask: "Show me a TypeScript interface for a User"
2. Wait for response
3. Look for code blocks in the response

**Expected**:
- Code blocks have syntax highlighting
- "Copy" button on each code block
- "Apply" button on each code block
- Copy → copies to clipboard
- Apply → opens in new editor tab

### Test 9: Context Awareness 🎯

**What to test**: File context inclusion

**Steps**:
1. Open a file (e.g., `extension.ts`)
2. Open AX chat
3. Ask: "What does this file do?"

**Expected**:
- AI has access to current file
- Response is specific to that file
- AI can reference functions/classes in the file

### Test 10: Git Diff Review 🔄

**What to test**: Review uncommitted changes

**Steps**:
1. Make some changes to a file (don't commit)
2. Command Palette → "AX: Review Git Changes"

**Expected**:
- Chat opens
- AI receives git diff
- AI reviews your changes
- Suggests improvements

---

## Troubleshooting

### Extension Not Showing

**Symptoms**: No AX icon in Activity Bar, keyboard shortcut doesn't work

**Solutions**:
1. Reload VSCode (Cmd+Shift+P → "Developer: Reload Window")
2. Check if installed: `code --list-extensions | grep ax-cli`
3. Reinstall: `ax-cli vscode install --force`

### Chat Opens But Nothing Happens

**Symptoms**: Chat interface loads but messages don't send

**Solutions**:
1. Check API key is configured:
   ```bash
   ax-cli setup
   ```
2. Check Developer Console (Help → Toggle Developer Tools) for errors
3. Look for error messages in the chat

### Diff Preview Not Appearing

**Symptoms**: AI responds but no diff preview shows

**Solutions**:
1. Check Developer Console for errors
2. Ensure `diff-container` element exists in DOM
3. Ensure `diff-viewer.js` is loaded
4. Try: Ask for a simple file creation to test

**Debug Check**:
1. Open Developer Tools (Help → Toggle Developer Tools)
2. Go to Console tab
3. Look for errors mentioning:
   - `DiffViewer`
   - `showDiff`
   - `tool:approval_required`

### API Errors

**Symptoms**: Error messages like "API key required" or "Failed to connect"

**Solutions**:
1. Run setup:
   ```bash
   ax-cli setup
   ```
2. Check config file:
   ```bash
   cat ~/.ax-cli/config.json
   ```
3. Verify API key is set and valid

### "Extension Host" Errors

**Symptoms**: Red notification about extension host

**Solutions**:
1. Open Developer Tools → Console
2. Look for specific error
3. Common causes:
   - Missing dependencies (reinstall extension)
   - Syntax errors (check console)
   - SDK not found (check `node_modules`)

---

## Advanced Testing

### Test SDK Integration

**Verify SDK is working**:

1. Open Developer Tools Console
2. Type:
   ```javascript
   console.log('Testing SDK...')
   ```
3. Look for logs like:
   - `[AX SDK] Initializing agent...`
   - `[AX SDK] Agent initialized successfully`

### Test Event Flow

**Monitor events**:

1. Open Developer Tools Console
2. Ask for a file change
3. Watch for:
   - `[AX SDK] Tool approval request`
   - `[Chat View] Showing diff preview`
   - `[Main.js] Showing diff for: <filename>`
   - `[Main.js] User accepted/rejected diff`

### Test Error Recovery

**Test error handling**:

1. Ask: "Create a file in a non-existent directory"
2. Verify error message appears
3. Verify chat remains functional

---

## Performance Testing

### Test Response Time

**Normal operation**:
- Message send to first response: < 2 seconds
- Diff preview appears: < 500ms after tool call
- File changes apply: < 100ms after Accept

### Test Memory

**After multiple interactions**:
1. Send 10-20 messages
2. Check Task Manager/Activity Monitor
3. VSCode extension host should be < 200MB

---

## Integration Testing

### Test with Real Workflow

**Scenario: Build a feature**

1. Ask: "Create a User model with name, email, and id fields"
2. Accept the file creation
3. Ask: "Add validation methods to check if email is valid"
4. Review diff, accept
5. Ask: "Generate unit tests for this model"
6. Review tests, accept
7. Ask: "Refactor to use TypeScript strict mode"
8. Review changes, accept

**Expected**:
- Each step shows diff preview
- All changes apply correctly
- Final code is working
- All approvals tracked

---

## Test Results Checklist

Use this checklist to verify all features work:

### Core Features
- [ ] Extension installs via `ax-cli vscode install`
- [ ] Extension appears in VSCode
- [ ] Chat opens with keyboard shortcut
- [ ] Chat opens from Activity Bar
- [ ] Messages send and receive responses

### Diff Preview (Key Feature)
- [ ] File creation shows diff
- [ ] File modification shows diff
- [ ] String replacement shows diff
- [ ] Accept button applies changes
- [ ] Reject button skips changes
- [ ] Show in Editor opens native diff

### Commands
- [ ] Explain Selection works
- [ ] Analyze File works
- [ ] Generate Tests works
- [ ] Refactor Selection works
- [ ] Document Code works
- [ ] Find Bugs works
- [ ] Review Git Changes works

### Context
- [ ] Current file included automatically
- [ ] Selection included when relevant
- [ ] Git diff included when requested
- [ ] Line numbers shown correctly

### UI/UX
- [ ] Code blocks have Copy/Apply buttons
- [ ] Markdown renders correctly
- [ ] Loading states show
- [ ] Error messages are clear
- [ ] History can be cleared

### Performance
- [ ] Responses are fast (< 2s)
- [ ] No memory leaks after many messages
- [ ] Diff preview is instant
- [ ] File changes apply immediately

---

## Reporting Issues

If you find bugs, report them with:

1. **Steps to reproduce**
2. **Expected behavior**
3. **Actual behavior**
4. **Developer Console output** (Help → Toggle Developer Tools)
5. **Extension version** (`ax-cli vscode status`)

Example:
```
Bug: Diff preview not showing for file edits

Steps:
1. Open chat
2. Ask: "Add a comment to extension.ts"
3. Wait for response

Expected: Diff preview appears
Actual: No diff, only text response

Console output:
  [ERROR] DiffViewer is not defined

Extension: v0.1.0
VSCode: 1.95.0
```

---

## Success Criteria

Extension is working if:

✅ Chat opens and responds
✅ Diff preview appears for file changes
✅ Accept/Reject buttons work
✅ File changes apply correctly
✅ Code blocks can be copied
✅ Context is included automatically
✅ All commands work
✅ No errors in console

---

## Next Steps After Testing

Once everything works:

1. **Use it for real work!**
   - Start a new project
   - Ask for help with actual code
   - Test with your workflow

2. **Report feedback**
   - What works well?
   - What could be better?
   - Any missing features?

3. **Share with team**
   - Install on other machines
   - Get feedback from colleagues
   - Report common issues

---

**Happy Testing!** 🚀

If you encounter issues, check the Developer Console first, then refer to the troubleshooting section above.
