# Changelog - v2.2.1

## Improvement: Increased Max Tokens for GLM 4.6

### Problem
Version 2.2.0 used **8,192 max tokens** which was too conservative compared to industry standards for AI coding tools in 2025.

### Industry Comparison

| Tool | Max Output Tokens | Context |
|------|------------------|---------|
| **Claude Code CLI** | 16,384 - 32,000 | Default: 16k, Extended: 128k |
| **GitHub Copilot** | 64,000 | GPT-4o, 128k in VS Code Insiders |
| **Cursor AI** | 200,000 | With intelligent pruning |
| **AX CLI v2.2.0** | 8,192 | ❌ Too low |
| **AX CLI v2.2.1** | **32,768** | ✅ **Matches Claude Code** |

### Solution
Updated max tokens configuration to match industry standards:

**Z.AI (GLM 4.6)**:
- **Old**: 8,192 tokens (2x Z.AI docs recommendation)
- **New**: **32,768 tokens** (32k)
- **Reasoning**: Matches Claude Code's upper default
- **Maximum possible**: 128,000 tokens (still conservative)

**Other Providers** (OpenAI, Anthropic, xAI, Ollama):
- Remains at 8,192 tokens (appropriate for their models)

### Why 32k for GLM 4.6?

1. **Industry Standard**: Matches Claude Code CLI (16k-32k)
2. **Complex Code**: 4x more room for code generation tasks
3. **GLM 4.6 Capabilities**:
   - Context window: 200K tokens
   - Max output: 128K tokens
   - 32K is still conservative (25% of max)
4. **Token Efficiency**: GLM 4.6 is 30% more efficient, so 32k goes further

### Technical Implementation

**File Modified**: `src/commands/setup.ts`

```typescript
// Provider-specific max tokens
const maxTokens = selectedProvider.name === 'z.ai' ? 32768 : 8192;

const config = {
  ...
  maxTokens: maxTokens,  // 32k for Z.AI, 8k for others
  ...
};
```

### Impact
- **Z.AI users**: 4x more tokens (8k → 32k)
- **Other providers**: No change (remains 8k)
- **Cost**: Negligible - only affects max response length, not input
- **Performance**: Better handling of complex code generation

### Verification
Based on official documentation:
- **Z.AI Docs**: https://docs.z.ai/guides/llm/glm-4.6
  - Examples use 4,096 tokens
  - Max output: 128,000 tokens
  - Our 32k is 8x their example, 25% of max

- **Claude Code**: 16k-32k default
- **GitHub Copilot**: 64k with GPT-4o
- **Our 32k**: Competitive with industry leaders

### User Benefits
1. **Better Code Generation**: More complete code blocks
2. **Complex Refactoring**: Handle large file modifications
3. **Detailed Explanations**: More thorough responses
4. **Multi-File Context**: Process larger codebases

### Breaking Changes
None. This only affects new setups. Existing configs are unchanged.

### Upgrade Notes
New users automatically get 32k for Z.AI. Existing users can:
- Run `ax-cli setup --force` to regenerate config
- Manually edit `~/.ax-cli/config.json`: `"maxTokens": 32768`

---

**Version**: 2.2.1
**Release Date**: 2025-11-19
**Type**: Patch (Improvement)
