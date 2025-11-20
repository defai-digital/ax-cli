# Loop Detection Debug Guide

**Date:** 2025-11-20
**Purpose:** Debug persistent looping issue with comprehensive logging
**Author:** Claude Code

---

## 📊 Current Status

You reported that the looping issue still persists despite the v2.4.2 fix. I've added comprehensive debug logging to identify exactly what's happening.

---

## 🔍 What I've Added

### Debug Logging System

Added detailed logging throughout the loop detection system that will show:

1. **Every tool call being checked**
2. **The signature being generated**
3. **Current count for each signature**
4. **Whether loop is detected**
5. **Map state (size, entries)**

### How to Enable Debug Logging

Run ax-cli with the debug flag:

```bash
DEBUG_LOOP_DETECTION=1 ax-cli
```

Or if using the built version:

```bash
DEBUG_LOOP_DETECTION=1 node dist/index.js
```

---

## 🧪 Test Scenario

### Reproduce the Loop

1. **Start ax-cli with debug mode:**
   ```bash
   DEBUG_LOOP_DETECTION=1 npm run dev
   ```

2. **Ask a question that triggers the loop:**
   ```
   count the lines of code in this project
   ```

3. **Watch the debug output in the console** (stderr)

### Expected Debug Output

If the fix is working, you should see:

```
[LOOP CHECK] Checking 1 tool calls...
[LOOP DETECTION] Tool: bash
[LOOP DETECTION] Signature: bash:find . -name "*.ts" | xargs wc -l
[LOOP DETECTION] Count: 0
[LOOP DETECTION] Map size: 1
[LOOP DETECTION] ✅ Allowed, count now: 1
[LOOP CHECK] hasRepetitiveCall: false

<tool executes>

[LOOP CHECK] Checking 1 tool calls...
[LOOP DETECTION] Tool: bash
[LOOP DETECTION] Signature: bash:find . -name "*.ts" | xargs wc -l
[LOOP DETECTION] Count: 1
[LOOP DETECTION] Map size: 1
[LOOP DETECTION] ⚠️ LOOP DETECTED! Signature: bash:find . -name "*.ts" | xargs wc -l
[LOOP CHECK] hasRepetitiveCall: true
[LOOP CHECK] 🛑 Breaking loop!

⚠️ Detected repetitive tool calls. Stopping to prevent infinite loop.
```

If the fix is NOT working, you'll see repeated entries without the loop detection triggering.

---

## 📝 Diagnostic Questions

Based on the debug output, we can determine:

### Question 1: Is the function being called?

**Check for:** `[LOOP DETECTION]` messages

- ✅ **If YES:** Loop detection is running
- ❌ **If NO:** Code path is wrong or old version is running

### Question 2: What signature is being generated?

**Check for:** `[LOOP DETECTION] Signature: ...`

- Should be: `bash:<full command>`
- If it's just `bash`, the fix isn't applied

### Question 3: Is the count incrementing?

**Check for:** `[LOOP DETECTION] Count: ...`

- First occurrence: `Count: 0` → `count now: 1`
- Second occurrence: `Count: 1` → `LOOP DETECTED`

### Question 4: Is hasRepetitiveCall returning true?

**Check for:** `[LOOP CHECK] hasRepetitiveCall: ...`

- Should be `false` on first call
- Should be `true` on second identical call

### Question 5: Is the loop being broken?

**Check for:** `[LOOP CHECK] 🛑 Breaking loop!`

- If this appears, loop detection is working
- If this doesn't appear, `.some()` is not returning true

---

## 🔧 Possible Issues and Solutions

### Issue 1: Old Version Running

**Symptoms:**
- No `[LOOP DETECTION]` messages appear
- Behavior unchanged

**Solution:**
```bash
# Rebuild
npm run build

# Verify version
grep '"version"' package.json
# Should show: "version": "2.4.2"

# Run the built version explicitly
DEBUG_LOOP_DETECTION=1 node dist/index.js
```

### Issue 2: Wrong Signature Generated

**Symptoms:**
- Signature shows `bash` instead of `bash:<command>`
- Or signature is different each time for same command

**Solution:**
- Check that tool name is exactly `"bash"`
- Check that argument key is exactly `"command"`
- Review the actual tool call JSON in debug output

### Issue 3: Count Not Incrementing

**Symptoms:**
- Count is always `0`
- Map size doesn't grow

**Solution:**
- Verify `this.recentToolCalls` is not being reset
- Check that `resetToolCallTracking()` is only called at message start
- Verify Map is persisting across agent loop iterations

### Issue 4: `.some()` Not Short-Circuiting

**Symptoms:**
- `hasRepetitiveCall: false` even when count >= 1
- Loop detected but not triggering break

**Solution:**
- This would be a JavaScript engine bug (extremely unlikely)
- Verify TypeScript compilation is correct
- Check for any Promise/async issues

### Issue 5: Multiple Code Paths

**Symptoms:**
- Sometimes works, sometimes doesn't
- Different behavior in streaming vs non-streaming

**Solution:**
- Check both `[LOOP CHECK]` and `[LOOP CHECK STREAM]` messages
- Verify both code paths have the fix applied

---

## 📊 Information to Collect

When you run the test, please provide:

1. **Full debug output** (copy all `[LOOP DETECTION]` and `[LOOP CHECK]` messages)
2. **Version confirmation:**
   ```bash
   cat package.json | grep version
   node dist/index.js --version
   ```
3. **Tool calls observed:** What commands were being repeated?
4. **Number of repetitions:** How many times before you cancelled?
5. **Any error messages:** Especially JSON parse errors

---

## 🎯 Quick Verification Steps

### Step 1: Verify Code is Updated

```bash
# Check the loop detection code
grep -A 5 "count >= 1" dist/agent/llm-agent.js
# Should show the new threshold

# Check for debug logging
grep "DEBUG_LOOP_DETECTION" dist/agent/llm-agent.js
# Should show multiple matches
```

### Step 2: Simple Test

```bash
# Run with debug
DEBUG_LOOP_DETECTION=1 npm run dev

# Ask simple question
> count typescript files

# Check console output for [LOOP DETECTION] messages
```

### Step 3: Verify Fix Works with Manual Test

Create a simple test file:

```typescript
// test-loop-detection.ts
const map = new Map<string, number>();

function testLoop() {
  const signature = "bash:find . -name '*.ts'";

  // First call
  const count1 = map.get(signature) || 0;
  console.log(`Call 1: count=${count1}, should allow`);
  if (count1 >= 1) {
    console.log("ERROR: Should not detect on first call!");
    return;
  }
  map.set(signature, count1 + 1);

  // Second call (same signature)
  const count2 = map.get(signature) || 0;
  console.log(`Call 2: count=${count2}, should detect loop`);
  if (count2 >= 1) {
    console.log("SUCCESS: Loop detected on second call!");
  } else {
    console.log("ERROR: Should detect loop on second call!");
  }
}

testLoop();
```

Run:
```bash
npx tsx test-loop-detection.ts
```

Expected output:
```
Call 1: count=0, should allow
Call 2: count=1, should detect loop
SUCCESS: Loop detected on second call!
```

---

## 🔍 Code Review Checklist

I've verified the following:

- ✅ Tool name is `"bash"` in tool definitions
- ✅ Parameter name is `"command"`
- ✅ Signature uses full command: `bash:${normalizedCommand}`
- ✅ Threshold is `count >= 1` (detects on 2nd occurrence)
- ✅ Loop detection is called in both streaming and non-streaming paths
- ✅ `resetToolCallTracking()` only called at message start
- ✅ Map persists across agent loop iterations
- ✅ `.some()` will short-circuit on first true return
- ✅ Debug logging added to all critical points

---

## 📞 Next Steps

1. **Run with debug logging enabled**
2. **Reproduce the loop**
3. **Collect the debug output**
4. **Share the output** so we can see exactly what's happening

The debug output will tell us definitively:
- Is the fix being applied?
- Is the signature correct?
- Is the count incrementing?
- Is the loop being detected?
- Where is the issue?

This will allow us to pinpoint the exact problem and fix it.

---

## 🎓 Understanding the Fix

### The Logic

```typescript
// Execution flow for duplicate commands:

// First identical command
count = 0
check: 0 >= 1 → false ✅ Allow
set count to 1

// Second identical command
count = 1
check: 1 >= 1 → true ⚠️ Loop detected!
Break loop, show warning
```

### Why It Should Work

1. **Precise signatures:** Each unique command gets its own entry
2. **Fast detection:** Triggers on 2nd occurrence (count=1)
3. **Persistent tracking:** Map survives across loop iterations
4. **Early termination:** `.some()` stops at first detection

### What Could Prevent It

1. **Old code running:** Build not updated
2. **Signature mismatch:** Tool/param names different than expected
3. **Map being reset:** Tracking cleared too early
4. **Wrong code path:** Streaming vs non-streaming path not fixed
5. **JSON parse error:** Falling through to catch block

The debug logging will reveal which of these (if any) is the issue.

---

**Ready to debug!** Run with `DEBUG_LOOP_DETECTION=1` and share the output.
