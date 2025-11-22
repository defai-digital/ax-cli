# Release v3.7.0 - SDK Best Practices & Developer Experience

**Release Date**: 2025-11-22
**Type**: Minor Release (Feature Addition)
**Breaking Changes**: None

---

## 🎉 Overview

Version 3.7.0 brings **major improvements to the SDK** with enterprise-grade best practices for reliability, debugging, and developer experience. This release implements 8 critical improvements identified in our comprehensive SDK review, all while maintaining 100% backward compatibility.

**Highlights**:
- ✅ Structured error handling with error codes
- ✅ Input validation to prevent invalid configurations
- ✅ Built-in testing utilities
- ✅ Disposal protection to prevent memory leaks
- ✅ Debug mode for troubleshooting
- ✅ SDK version tracking

---

## ✨ New Features

### 🔒 Structured Error System

Replace fragile string matching with programmatic error handling:

```typescript
import { SDKError, SDKErrorCode } from '@defai.digital/ax-cli/sdk';

try {
  const agent = await createAgent();
} catch (error) {
  if (SDKError.isSDKError(error)) {
    switch (error.code) {
      case SDKErrorCode.SETUP_NOT_RUN:
        console.log('Run: ax-cli setup');
        break;
      case SDKErrorCode.API_KEY_MISSING:
        console.log('API key not configured');
        break;
      case SDKErrorCode.VALIDATION_ERROR:
        console.log('Invalid options:', error.message);
        break;
    }
  }
}
```

**Error Codes**:
- `SDK_SETUP_NOT_RUN` - ax-cli setup not run
- `SDK_API_KEY_MISSING` - API key not configured
- `SDK_BASE_URL_MISSING` - Base URL not configured
- `SDK_AGENT_DISPOSED` - Agent already disposed
- `SDK_VALIDATION_ERROR` - Input validation failed
- `SDK_ABORTED` - Operation cancelled
- `SDK_RATE_LIMIT_EXCEEDED` - Rate limit exceeded
- `SDK_INVALID_CONFIG` - Invalid configuration
- `SDK_INTERNAL_ERROR` - Internal error

### ✅ Input Validation

Prevent invalid configurations with Zod schema validation:

```typescript
// ✅ Valid
createAgent({ maxToolRounds: 50 });

// ❌ Throws VALIDATION_ERROR
createAgent({ maxToolRounds: -1 });     // Negative
createAgent({ maxToolRounds: 5000 });   // Too high (max 1000)
createAgent({ maxToolRounds: NaN });    // Not a number
createAgent({ evil: 'hack' });          // Unknown property
```

### 🧪 Testing Utilities

Built-in mocks for easier SDK testing:

```typescript
import { createMockAgent, createMockSettings } from '@defai.digital/ax-cli/sdk/testing';

// Mock agent with predefined responses
const agent = createMockAgent(['Response 1', 'Response 2']);
const result = await agent.processUserMessage('Hello');
expect(result[0].content).toBe('Response 1');

agent.dispose();

// Mock settings
const settings = createMockSettings({
  apiKey: 'test-key',
  baseURL: 'https://test.api.com',
  model: 'glm-4.6'
});
```

### 🛡️ Disposal Protection

Prevent use-after-disposal bugs with runtime checks:

```typescript
const agent = await createAgent();
agent.dispose();

// ❌ Throws AGENT_DISPOSED error
await agent.processUserMessage('task');
// Error: Agent has been disposed and cannot be used. Create a new agent instance.

// ✅ Multiple dispose() calls are safe (idempotent)
agent.dispose();
agent.dispose(); // No error
```

### 📊 SDK Version Tracking

Version info for debugging and compatibility checks:

```typescript
import { SDK_VERSION, SDK_API_VERSION, getSDKInfo } from '@defai.digital/ax-cli/sdk';

console.log('SDK Version:', SDK_VERSION); // "3.7.0"
console.log('API Version:', SDK_API_VERSION); // 1

const info = getSDKInfo();
// { version: "3.7.0", apiVersion: 1, versionString: "v3.7.0" }
```

### 🐛 Debug Mode

Verbose logging for troubleshooting:

```typescript
const agent = await createAgent({
  maxToolRounds: 50,
  debug: true  // Enable debug logging
});

// Outputs to stderr:
// [AX SDK DEBUG] Creating agent with settings:
// [AX SDK DEBUG]   Model: glm-4.6
// [AX SDK DEBUG]   Base URL: https://open.bigmodel.cn/api/paas/v4/
// [AX SDK DEBUG]   Max tool rounds: 50
// [AX SDK DEBUG]   API key configured: true
// [AX SDK DEBUG] Agent created successfully
// [AX SDK DEBUG] Tool calls: bash, text_editor
// [AX SDK DEBUG] Tool result: success
```

---

## 🔧 Improvements

### Enhanced Disposal

The `dispose()` method now provides comprehensive cleanup:
- ✅ Removes all event listeners (prevents memory leaks)
- ✅ Clears in-memory caches (tool calls, arguments)
- ✅ Clears conversation history
- ✅ Aborts in-flight requests
- ✅ Terminates subagents
- ✅ Idempotent (safe to call multiple times)

### Better Documentation

- ✅ Fixed outdated examples in SDK documentation
- ✅ Added error handling patterns
- ✅ Added testing examples
- ✅ Comprehensive JSDoc comments

### Type Safety

- ✅ Full TypeScript support
- ✅ Proper type exports for all new features
- ✅ Strict validation with Zod

---

## 📦 Breaking Changes

**None!** All changes are additive and backward compatible.

### Migration Guide

**No migration needed!** All existing code continues to work without changes.

**Optional improvements** you can adopt:

```typescript
// Before (still works)
try {
  const agent = await createAgent();
  await agent.processUserMessage('task');
} catch (error) {
  console.error(error.message);
}

// After (better)
try {
  const agent = await createAgent({
    maxToolRounds: 50,  // Validated
    debug: false        // Optional debugging
  });

  try {
    await agent.processUserMessage('task');
  } finally {
    agent.dispose();  // Cleanup (recommended)
  }
} catch (error) {
  if (SDKError.isSDKError(error)) {
    switch (error.code) {
      case SDKErrorCode.SETUP_NOT_RUN:
        // Handle programmatically
        break;
    }
  }
}
```

---

## 🐛 Bug Fixes

- **Fixed**: Chat history unbounded growth (v3.6.2)
- **Fixed**: SDK credential security issue (v3.6.3)
- **Enhanced**: Disposal now prevents use-after-disposal bugs

---

## 📊 Technical Details

### Files Added (4)

- `src/sdk/errors.ts` (110 lines) - Structured error system
- `src/sdk/testing.ts` (340 lines) - Testing utilities
- `src/sdk/version.ts` (68 lines) - Version tracking
- Test suites (2 files) - Comprehensive test coverage

### Files Modified (2)

- `src/sdk/index.ts` - Integration of all new features
- `src/agent/llm-agent.ts` - Enhanced disposal and protection

### Stats

- **Lines Added**: ~650 lines
- **Test Coverage**: Maintained 98%+
- **Breaking Changes**: 0
- **Build Status**: ✅ Passing
- **Type Checking**: ✅ Strict mode

---

## 🧪 Testing

All features comprehensively tested:

```bash
✅ Build successful (npm run build)
✅ Type checking passes (npm run typecheck)
✅ Phase 1 tests: 7/7 pass
✅ Phase 1.5 tests: 3/3 pass
✅ Zero TypeScript errors
✅ Zero breaking changes
```

---

## 📚 Documentation

**Updated**:
- README.md - Added "What's New in v3.7.0" section
- SDK examples - Fixed outdated code
- JSDoc comments - Comprehensive coverage

**New**:
- Phase 1 implementation summary
- Phase 1.5 implementation summary
- Testing guides
- Usage examples

---

## 🙏 Acknowledgments

This release implements recommendations from our comprehensive SDK best practices review, focusing on reliability, developer experience, and production readiness.

---

## 🔗 Links

- **npm**: https://www.npmjs.com/package/@defai.digital/ax-cli
- **GitHub**: https://github.com/defai-digital/ax-cli
- **Documentation**: https://github.com/defai-digital/ax-cli/tree/main/docs

---

## 📥 Installation

```bash
# Update globally
npm install -g @defai.digital/ax-cli@3.7.0

# Or update in project
npm install @defai.digital/ax-cli@3.7.0
```

---

**Full Changelog**: https://github.com/defai-digital/ax-cli/compare/v3.6.2...v3.7.0
