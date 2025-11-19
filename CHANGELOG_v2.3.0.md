# Changelog - v2.3.0

## Feature: Usage Tracking and Slash Commands

### Overview
Version 2.3.0 introduces comprehensive API usage tracking and convenient slash commands for the interactive CLI.

### New Features

#### 1. Interactive Slash Commands

**`/usage` - Show API Usage Statistics**
- Display real-time usage statistics in interactive mode
- Shows prompt tokens, completion tokens, reasoning tokens
- Per-model breakdown when using multiple models
- Links to detailed CLI command and Z.AI dashboard

**Example Output**:
```
📊 **API Usage Statistics**

**Current Session:**
  • Total Requests: 1,234
  • Prompt Tokens: 45,678
  • Completion Tokens: 12,345
  • Total Tokens: 58,023
  • Reasoning Tokens: 2,345

**By Model:**
  • glm-4.6: 58,023 tokens (1,234 requests)

💡 Use `ax-cli usage show --detailed` for full breakdown
💡 Historical data: https://z.ai/manage-apikey/billing
```

**`/version` - Show AX CLI Version**
- Display current version within interactive session
- Shows helpful links and update information

**Example Output**:
```
🤖 **AX CLI Version 2.3.0**

Enterprise-Class AI Command Line Interface
Primary support for GLM (General Language Model)

💡 Check for updates: `ax-cli update`
💡 Documentation: https://github.com/defai-digital/ax-cli
```

#### 2. CLI Usage Command

**`ax-cli usage` - Comprehensive Usage Tracking**

**Subcommands**:
- `ax-cli usage show` - Display current session statistics
- `ax-cli usage show --detailed` - Show per-model breakdown
- `ax-cli usage show --json` - Export as JSON
- `ax-cli usage reset` - Reset session statistics

**Features**:
- Session-based tracking for all providers
- Automatic tracking from API responses (streaming and non-streaming)
- Tracks prompt, completion, total, and reasoning tokens
- Per-model statistics
- Provider detection and guidance

**JSON Export**:
```json
{
  "provider": "z.ai",
  "session": {
    "totalRequests": 1234,
    "totalPromptTokens": 45678,
    "totalCompletionTokens": 12345,
    "totalTokens": 58023,
    "totalReasoningTokens": 2345,
    "byModel": {
      "glm-4.6": {
        "requests": 1234,
        "promptTokens": 45678,
        "completionTokens": 12345,
        "totalTokens": 58023,
        "reasoningTokens": 2345
      }
    }
  },
  "supportsHistoricalData": false
}
```

### Provider Support (Phase 1)

**Z.AI (Primary)**:
- ✅ Session-based tracking
- ✅ Tracks all token types (prompt, completion, reasoning)
- ✅ Per-model breakdown
- ✅ Dashboard link: https://z.ai/manage-apikey/billing
- ℹ️ No programmatic historical API (use dashboard)

**Other Providers** (OpenAI, Anthropic, xAI, Ollama):
- ✅ Session-based tracking
- ⚠️ Shows "Information unavailable" for historical data
- ℹ️ Guidance to check provider dashboard

### Technical Implementation

**New Files**:
- `src/commands/usage.ts` - Usage CLI command
- `src/utils/usage-tracker.ts` - Usage tracking utility
- `tests/utils/usage-tracker.test.ts` - Test suite (17 tests)
- `docs/usage-tracking-summary.md` - Implementation docs
- `docs/usage-tracking-phase2.md` - Future planning
- `docs/slash-commands-implementation.md` - Slash command docs

**Modified Files**:
- `src/index.ts` - Register usage command
- `src/llm/client.ts` - Track non-streaming usage
- `src/agent/llm-agent.ts` - Track streaming usage
- `src/hooks/use-input-handler.ts` - Add slash commands
- `README.md` - Updated documentation

**Architecture**:
```
API Response (with usage field)
    ↓
LLMClient.chat() or LLMClient.chatStream()
    ↓
UsageTracker.trackUsage(model, usage)
    ↓
Session Statistics Updated
    ↓
Available via /usage or ax-cli usage show
```

### Testing

**Test Coverage**:
- 17 new tests for usage tracker
- 100% coverage for UsageTracker
- All 352 tests passing
- Edge cases covered (zero tokens, large numbers, multiple models)

**Test Categories**:
- Singleton pattern
- Basic usage tracking
- Reasoning tokens support
- Missing field handling
- Multi-request accumulation
- Per-model tracking
- Session reset

### User Benefits

1. **Real-time Feedback**: See usage as it accumulates
2. **Cost Awareness**: Monitor token consumption
3. **Multi-model Support**: Track usage across different models
4. **Easy Access**: Both CLI and interactive commands
5. **Export Capability**: JSON format for automation

### Updated Commands

**Interactive Mode Slash Commands** (updated):
```bash
/help              # Show help
/init              # Initialize project
/clear             # Clear chat history
/models            # Switch AI model
/usage             # Show API usage statistics ⭐ NEW
/version           # Show AX CLI version ⭐ NEW
/commit-and-push   # AI-powered git commit
/exit              # Exit application
```

### Phase 2 Planning

Future enhancements documented in `docs/usage-tracking-phase2.md`:
- **OpenAI**: Historical usage API (`/v1/usage`)
- **Anthropic**: Dashboard integration (when API available)
- **xAI**: To be researched
- **Date Ranges**: Filter historical data by date
- **Cost Tracking**: Show pricing information
- **Usage Alerts**: Notify when approaching limits

### Breaking Changes

**None**. This is a pure feature addition with no breaking changes.

### Migration Notes

**For Users**:
- No migration needed
- Usage tracking starts automatically
- Use `/usage` or `ax-cli usage show` to view

**For Developers**:
- Import `getUsageTracker()` to access usage data
- Usage tracked automatically in LLMClient
- Extend `src/commands/usage.ts` for new providers

### Upgrade Instructions

```bash
# Update to v2.3.0
npm install -g @defai.digital/ax-cli@2.3.0

# Or update existing installation
npm update -g @defai.digital/ax-cli

# Verify version
ax-cli --version
# Should show: 2.3.0

# Try new commands
ax-cli usage show
# Or in interactive mode:
ax-cli
> /usage
> /version
```

### Documentation

**README.md Updates**:
- Added `/usage` and `/version` to slash commands list
- Added usage tracking section with examples
- Updated quick start guide

**New Documentation**:
- `docs/usage-tracking-summary.md` - Complete implementation guide
- `docs/usage-tracking-phase2.md` - Future provider support
- `docs/slash-commands-implementation.md` - Slash command details

### Research Findings

**Z.AI Usage API**:
- ❌ No programmatic usage API available
- ✅ Usage data in API responses (`usage` field)
- ✅ Historical data via dashboard: https://z.ai/manage-apikey/billing
- ℹ️ Billing shows previous day (n-1) consumption
- ℹ️ Rate limits at: https://z.ai/manage-apikey/rate-limits

### Known Limitations (Phase 1)

1. **Session-Only**: Usage resets when CLI exits
2. **No Persistence**: Statistics not saved to disk
3. **No Historical API**: Must use provider dashboard
4. **Limited Providers**: Phase 1 focuses on Z.AI
5. **No Cost Tracking**: Token counts only

Phase 2 will address these limitations.

### Performance Impact

- **Minimal**: Usage tracking adds negligible overhead
- **Memory**: Lightweight singleton with Map-based storage
- **CPU**: Simple arithmetic operations per API call
- **No Network**: No additional API calls for tracking

### Security

- **No Credentials Stored**: Only counts and tokens
- **Session-Only**: Data cleared on exit
- **No External Calls**: Tracking is local

---

**Version**: 2.3.0
**Release Date**: 2025-01-19
**Type**: Minor (New Features)
**Commits**: 1 feature commit
**Files Changed**: 17 files, 2606 insertions
**Test Coverage**: 352 tests passing (17 new)
**Documentation**: 4 new documentation files

**Contributors**:
- Implementation: Claude (AI Assistant)
- Review: DefAI Digital Team

**Next Release**: v2.4.0 (Phase 2 multi-provider support)
