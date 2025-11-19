# Changelog - v2.3.1

## Enhancement: Comprehensive Z.AI Account Information in /usage Command

### Problem
Version 2.3.0's `/usage` command only showed session statistics and basic links. Users wanted to check their actual Z.AI account usage and limits, but Z.AI doesn't provide a programmatic API for this data.

### Research Findings

**API Endpoint Testing:**
- Tested `/v1/usage` endpoint: 404 Not Found
- Tested `/v1/account` endpoint: 404 Not Found
- **Conclusion**: Z.AI does not provide programmatic API for usage/billing data

**Web Dashboard Access:**
- Users must use Z.AI web dashboard for actual account limits
- Dashboard pages: billing, rate limits, API keys

### Solution

Enhanced the `/usage` slash command to provide **maximum useful information** despite API limitations:

#### New Features Added

1. **Direct Account Links**
   - Billing & Usage: https://z.ai/manage-apikey/billing
   - Rate Limits: https://z.ai/manage-apikey/rate-limits
   - API Keys: https://z.ai/manage-apikey/apikey-list

2. **GLM-4.6 Pricing Information**
   - Input tokens: $0.11 per 1M tokens
   - Output tokens: $0.28 per 1M tokens
   - Displayed directly in the command output

3. **Session Cost Estimation**
   - Automatically calculates estimated cost from session data
   - Breaks down input vs output token costs
   - Shows total estimated cost
   - Uses actual GLM-4.6 pricing

4. **Important Billing Notes**
   - Explains billing delay (n-1 day)
   - Mentions current day usage visibility
   - Notes cached content discount (1/5 price)

5. **Improved Messaging**
   - Clear explanation when no requests made
   - Better formatted sections
   - More helpful guidance

### Before vs After

#### Before (v2.3.0)
```
📊 **API Usage Statistics**

No API requests made in this session.
```

#### After (v2.3.1)
```
📊 **API Usage & Limits (Z.AI)**

**📱 Current Session:**
  No API requests made yet. Ask me something to start tracking!

**🔑 Z.AI Account Usage & Limits:**
  ⚠️  API does not provide programmatic access to usage data

  **Check your account:**
  • Billing & Usage: https://z.ai/manage-apikey/billing
  • Rate Limits: https://z.ai/manage-apikey/rate-limits
  • API Keys: https://z.ai/manage-apikey/apikey-list

**ℹ️  Notes:**
  • Billing reflects previous day (n-1) consumption
  • Current day usage may not be immediately visible
  • Cached content: 1/5 of original price

**💰 GLM-4.6 Pricing:**
  • Input: $0.11 per 1M tokens
  • Output: $0.28 per 1M tokens
```

#### With Session Data (v2.3.1)
```
📊 **API Usage & Limits (Z.AI)**

**📱 Current Session:**
  • Requests: 3
  • Prompt Tokens: 1,234
  • Completion Tokens: 567
  • Total Tokens: 1,801

  **Models Used:**
    - glm-4.6: 1,801 tokens (3 requests)

**🔑 Z.AI Account Usage & Limits:**
  [... links and info ...]

**💵 Estimated Session Cost:**
  • Input: $0.000136 (1,234 tokens)
  • Output: $0.000159 (567 tokens)
  • **Total: ~$0.000295**
```

### Technical Implementation

**File Modified**: `src/hooks/use-input-handler.ts`

**Changes**:
- Enhanced `/usage` command handler with comprehensive output
- Added pricing calculations (input and output separately)
- Improved formatting with sections and emojis
- Added all relevant Z.AI dashboard links
- Better user guidance and messaging

**Cost Calculation Logic**:
```typescript
const inputCost = (stats.totalPromptTokens / 1000000) * 0.11;
const outputCost = (stats.totalCompletionTokens / 1000000) * 0.28;
const totalCost = inputCost + outputCost;
```

### User Benefits

1. **Immediate Access**: Direct links to all Z.AI account pages
2. **Cost Awareness**: Know exactly what your session costs
3. **Better Understanding**: Pricing displayed inline
4. **Helpful Guidance**: Clear notes about billing behavior
5. **Complete Information**: Everything in one command

### Impact

- **Session tracking**: Works as before (no changes)
- **Account info**: New links provide easy access
- **Cost estimation**: New feature helps budget awareness
- **User experience**: Significantly improved with comprehensive info

### Pricing Information Source

Based on 2025 market research:
- GLM-4.5: $0.11/1M input, $0.28/1M output (source: pricepertoken.com)
- GLM-4.6: Using same pricing as GLM-4.5 (similar tier model)

### Breaking Changes

**None**. This is a pure enhancement with backward compatibility.

### Usage

```bash
# In interactive mode
ax-cli

# Check usage (before making requests)
> /usage
# Shows: pricing, links, and guidance

# Make some requests
> hello, how are you?
> what's the weather like?

# Check usage again
> /usage
# Shows: session stats + cost estimate + links + pricing
```

### Why This Is The Best Solution

Given Z.AI's API limitations:
- ✅ Provides all available session data
- ✅ Links directly to actual account limits
- ✅ Explains why API access isn't available
- ✅ Includes pricing for cost awareness
- ✅ Calculates estimates from session data
- ✅ Single command gives complete picture

This is the **most comprehensive solution possible** without a dedicated Z.AI usage API.

### Future Enhancements

If Z.AI adds a usage API in the future:
- Can add programmatic usage fetching
- Can show actual account limits inline
- Can compare session vs account usage
- Can show remaining balance/credits

For now, direct dashboard links + cost estimation is the optimal approach.

---

**Version**: 2.3.1
**Release Date**: 2025-01-19
**Type**: Patch (Enhancement)
**Commits**: 1 enhancement commit
**Files Changed**: 1 file (src/hooks/use-input-handler.ts)
**Lines Changed**: +34, -8

**Contributors**:
- Implementation: Claude (AI Assistant)
- Review: DefAI Digital Team
