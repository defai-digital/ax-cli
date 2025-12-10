# Usage Tracking - Phase 2 Planning
Last reviewed: 2025-02-21  
Status: Legacy/archived — usage tracking beyond current providers is not supported in v4.4.x; keep for historical reference only.

## Overview

Phase 2 of usage tracking extends support beyond Z.AI to include other AI providers with their respective usage tracking capabilities.

## Phase 1 Completion ✅

Phase 1 implemented:
- Session-based usage tracking for all providers
- Automatic usage tracking from API responses
- Z.AI-specific guidance for historical data
- JSON export capability
- Per-model usage breakdown

## Phase 2 Goals

Add support for provider-specific usage tracking for:

1. **OpenAI**
2. **Anthropic (Claude)**
3. **xAI (Grok)**
4. **Local providers (Ollama)**

## Provider Research

### 1. OpenAI

**API Endpoint**: `GET /v1/usage`

**Documentation**: https://platform.openai.com/docs/api-reference/usage

**Capabilities**:
- Historical usage data by date range
- Breakdown by model and request type
- Token usage (prompt, completion, total)
- Cost information
- Organization-level aggregation

**Implementation Notes**:
- Requires API key authentication
- Supports filtering by date range
- Returns usage in JSON format with detailed breakdowns

**Example Response**:
```json
{
  "object": "list",
  "data": [
    {
      "aggregation_timestamp": 1714521600,
      "n_requests": 100,
      "operation": "completion",
      "snapshot_id": "abc123",
      "n_context_tokens_total": 50000,
      "n_generated_tokens_total": 25000
    }
  ]
}
```

### 2. Anthropic (Claude)

**API Endpoint**: Not publicly documented as of January 2025

**Capabilities**:
- Usage information available in API responses (`usage` field)
- Dashboard at https://console.anthropic.com/settings/usage

**Implementation Notes**:
- Session-based tracking (Phase 1) already works
- No known public API for historical usage retrieval
- May need to use dashboard scraping or wait for official API

**Phase 2 Approach**:
- Keep session-based tracking
- Add message directing users to dashboard for historical data
- Monitor for official usage API release

### 3. xAI (Grok)

**API Endpoint**: Not documented as of January 2025

**Capabilities**:
- Usage information in API responses
- Dashboard possibly available (needs verification)

**Implementation Notes**:
- Compatible with OpenAI API format
- Session-based tracking (Phase 1) works
- Historical data endpoint unknown

**Phase 2 Approach**:
- Research xAI documentation for usage endpoints
- Implement if available, otherwise use session-based tracking
- Add dashboard link if available

### 4. Local Providers (Ollama)

**Capabilities**:
- No usage tracking needed (local compute)
- May track request counts for statistics

**Implementation Notes**:
- Session-based tracking for request counts
- No cost or billing concerns
- Focus on performance metrics if needed

**Phase 2 Approach**:
- Display "Local provider - no usage limits" message
- Track requests and tokens for statistics only

## Implementation Plan

### Step 1: OpenAI Integration

1. Add OpenAI usage API client to `src/utils/usage-tracker.ts`
2. Implement `/v1/usage` endpoint integration
3. Add date range filtering options to `usage show` command
4. Display historical usage data from OpenAI
5. Add tests for OpenAI usage retrieval

**Command enhancements**:
```bash
# Show usage with date range (OpenAI)
ax-cli usage show --from 2025-01-01 --to 2025-01-31

# Show usage with cost information (OpenAI)
ax-cli usage show --detailed --cost
```

### Step 2: Provider Detection Enhancement

Update `detectProvider()` in `src/commands/usage.ts`:
- Improve provider detection logic
- Add provider-specific capabilities flags
- Return provider metadata (supports historical data, cost tracking, etc.)

### Step 3: Anthropic Enhancement

1. Monitor Anthropic API documentation for usage endpoints
2. If available, implement similar to OpenAI
3. If not available, enhance dashboard link messaging

### Step 4: xAI Enhancement

1. Research xAI usage API documentation
2. Implement if available
3. Fallback to session-based tracking with dashboard link

### Step 5: Documentation

1. Update README with Phase 2 capabilities
2. Add provider comparison table
3. Document provider-specific options
4. Update CLI reference

## Testing Strategy

### Unit Tests

- Provider detection logic
- Historical data retrieval (mocked APIs)
- Date range parsing and validation
- Error handling for API failures

### Integration Tests

- OpenAI usage API integration (requires API key)
- Response parsing and display
- Multi-provider scenarios

### Manual Testing

- Test with real API keys for each provider
- Verify dashboard links
- Test edge cases (no usage, large datasets)

## API Design

### UsageTracker Extensions

```typescript
interface HistoricalUsageOptions {
  provider: string;
  dateFrom?: Date;
  dateTo?: Date;
  includesCost?: boolean;
}

interface HistoricalUsageData {
  provider: string;
  dateRange: { from: Date; to: Date };
  totalRequests: number;
  totalTokens: number;
  totalCost?: number;
  byModel: Map<string, {
    requests: number;
    tokens: number;
    cost?: number;
  }>;
  byDate: Map<string, {
    requests: number;
    tokens: number;
    cost?: number;
  }>;
}

class UsageTracker {
  // Existing methods...

  /**
   * Fetch historical usage data from provider API
   */
  async fetchHistoricalUsage(options: HistoricalUsageOptions): Promise<HistoricalUsageData>;

  /**
   * Check if provider supports historical usage
   */
  supportsHistoricalUsage(provider: string): boolean;

  /**
   * Get provider dashboard URL
   */
  getProviderDashboardURL(provider: string): string | null;
}
```

### Command Options

```typescript
// Enhanced usage show command
usageCommand
  .command('show')
  .description('Show API usage statistics')
  .option('-d, --detailed', 'Show detailed breakdown by model')
  .option('-j, --json', 'Output in JSON format')
  .option('--from <date>', 'Start date (YYYY-MM-DD) for historical data')
  .option('--to <date>', 'End date (YYYY-MM-DD) for historical data')
  .option('--cost', 'Include cost information (if available)')
  .option('--historical', 'Fetch historical data from provider API')
```

## Provider Capabilities Matrix

| Provider | Session Tracking | Historical API | Cost Tracking | Dashboard |
|----------|-----------------|----------------|---------------|-----------|
| Z.AI | ✅ | ❌ | ❓ | ✅ |
| OpenAI | ✅ | ✅ | ✅ | ✅ |
| Anthropic | ✅ | ❓ | ❓ | ✅ |
| xAI | ✅ | ❓ | ❓ | ❓ |
| Ollama | ✅ | N/A | N/A | N/A |

Legend:
- ✅ Confirmed available
- ❌ Confirmed unavailable
- ❓ Unknown/needs research
- N/A Not applicable

## Timeline Estimate

- **Step 1 (OpenAI)**: 2-3 days
  - API client implementation: 1 day
  - Command enhancements: 0.5 day
  - Testing: 0.5-1 day
  - Documentation: 0.5 day

- **Step 2 (Provider Detection)**: 1 day
  - Detection logic: 0.5 day
  - Testing: 0.5 day

- **Step 3-4 (Anthropic/xAI)**: 1-2 days each (depending on API availability)
  - Research: 0.5 day
  - Implementation: 0.5-1 day
  - Testing: 0.5 day

- **Step 5 (Documentation)**: 1 day

**Total Estimate**: 6-9 days

## Success Criteria

Phase 2 is complete when:

1. ✅ OpenAI historical usage API is integrated and tested
2. ✅ All providers have appropriate messaging (API or dashboard)
3. ✅ Date range filtering works for providers that support it
4. ✅ Cost tracking displays for OpenAI (if available)
5. ✅ Tests achieve 90%+ coverage for usage tracking
6. ✅ Documentation is complete and accurate
7. ✅ Command-line interface is intuitive and consistent

## Future Enhancements (Phase 3+)

- **Usage Alerts**: Notify users when approaching limits
- **Cost Optimization**: Suggest cheaper models for similar tasks
- **Usage Analytics**: Visualize usage trends over time
- **Budget Tracking**: Set and monitor spending limits
- **Multi-Account**: Support multiple API keys and organizations
- **Export Formats**: CSV, PDF reports for usage data
- **Caching**: Cache historical data to reduce API calls

## Notes

- Phase 2 implementation should maintain backward compatibility with Phase 1
- All provider-specific code should be modular and testable
- Error handling should be graceful (fallback to session tracking)
- User experience should be consistent across providers
- Documentation should clearly explain provider differences
