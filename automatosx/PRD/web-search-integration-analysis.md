# Web Search Integration - Ultrathink Analysis
**Date**: 2025-11-21
**Version**: 1.0
**Risk Level**: Low to Medium
**Value**: High

---

## Executive Summary

Users want AX CLI to have stronger web search capabilities to find real-time information, documentation, code examples, and current events. This analysis recommends a **phased approach** using routing and parallel search to maximize accuracy and speed while minimizing risk.

**Key Recommendation**: Start with Tavily AI + Brave Search (Phase 1), then expand to parallel multi-engine search (Phase 2).

---

## Current State Analysis

### What We Have
- **Local Search Only**: `src/tools/search.ts` uses ripgrep for local file/code search
- **No Internet Search**: Cannot query web, documentation sites, or real-time data
- **MCP Integration**: Could theoretically add web search via MCP servers, but no built-in capability

### What's Missing
1. **General web search** (Google, Bing, DuckDuckGo equivalents)
2. **Technical search** (Stack Overflow, GitHub, npm, documentation)
3. **Real-time data** (news, current events, API status)
4. **Domain-specific routing** (route queries to specialized engines)
5. **Result aggregation** (combine multiple sources for accuracy)

---

## Proposed Architecture

### High-Level Design

```
User Query
    ↓
Query Intent Detection (routing logic)
    ↓
    ├─→ General Query → Tavily/Brave (parallel)
    ├─→ Code/Tech → Stack Overflow + GitHub + npm
    ├─→ Documentation → Algolia DocSearch
    ├─→ News/Current → News APIs
    └─→ Fallback → Default engine
    ↓
Parallel Search Execution (Promise.all)
    ↓
Result Aggregation & Deduplication
    ↓
Ranked Results to LLM
```

### Core Components

```typescript
// 1. Search Router
class WebSearchRouter {
  detectIntent(query: string): SearchIntent
  selectEngines(intent: SearchIntent): SearchEngine[]
}

// 2. Parallel Search Executor
class ParallelSearchExecutor {
  async searchAll(query: string, engines: SearchEngine[]): Promise<SearchResult[]>
  aggregateResults(results: SearchResult[][]): SearchResult[]
  deduplicateResults(results: SearchResult[]): SearchResult[]
}

// 3. Individual Search Engines (abstraction)
interface SearchEngine {
  name: string;
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  isAvailable(): boolean; // Check API key, rate limits
}

// 4. Result Caching (prevent duplicate API calls)
class SearchCache {
  get(query: string): SearchResult[] | null
  set(query: string, results: SearchResult[], ttl?: number): void
}
```

---

## Phase 1: Foundation (Low Risk, High Value)

### Timeline: Week 1-2
### Risk: **LOW**
### Value: **HIGH**

### 1.1 Primary Search Engines

#### **Tavily AI** (Recommended #1)
- **npm**: `@tavily/core` or API client
- **Why**: Designed specifically for AI agents/LLMs
  - Returns clean, structured data optimized for LLM consumption
  - Includes source URLs, snippets, relevance scores
  - Better than generic search for AI use cases
- **Cost**:
  - Free tier: 1,000 searches/month
  - Pro: $120/month for 10,000 searches
- **Risk**: Low (free tier sufficient for testing)
- **Integration Effort**: 2-3 hours

```typescript
import { tavily } from "@tavily/core";

const client = tavily({ apiKey: process.env.TAVILY_API_KEY });

const results = await client.search(query, {
  searchDepth: "advanced", // or "basic"
  maxResults: 5,
  includeAnswer: true, // Get AI-generated summary
  includeDomains: [], // Optional whitelist
  excludeDomains: [], // Optional blacklist
});

// Returns: { answer: string, results: [...], query: string }
```

#### **Brave Search API** (Recommended #2)
- **npm**: `brave-search` or REST API client
- **Why**: Privacy-focused, no tracking, good general search
  - Independent search index (not Google)
  - Supports web, news, images
  - Good fallback/alternative to Tavily
- **Cost**:
  - Free tier: 2,000 queries/month
  - Pro: $3/1,000 queries (very affordable)
- **Risk**: Low (generous free tier)
- **Integration Effort**: 2-3 hours

```typescript
import BraveSearch from "brave-search";

const brave = new BraveSearch(process.env.BRAVE_API_KEY);

const results = await brave.webSearch(query, {
  count: 10,
  offset: 0,
  freshness: "pd", // past day, pw (week), pm (month), py (year)
  text_decorations: false,
  spellcheck: true,
});

// Returns: { web: { results: [...] }, query: { original: string } }
```

### 1.2 Simple Routing Logic

```typescript
class SimpleWebSearchRouter {
  detectIntent(query: string): "general" | "technical" | "news" {
    const lowerQuery = query.toLowerCase();

    // Technical queries
    if (
      lowerQuery.includes("error") ||
      lowerQuery.includes("code") ||
      lowerQuery.includes("function") ||
      lowerQuery.includes("api") ||
      lowerQuery.includes("npm") ||
      lowerQuery.includes("github")
    ) {
      return "technical";
    }

    // News/current events
    if (
      lowerQuery.includes("news") ||
      lowerQuery.includes("latest") ||
      lowerQuery.includes("today") ||
      lowerQuery.includes("2025") // Current year
    ) {
      return "news";
    }

    return "general";
  }

  selectEngines(intent: string): SearchEngine[] {
    switch (intent) {
      case "technical":
        return [new TavilySearch(), new BraveSearch()]; // Both good for tech
      case "news":
        return [new BraveSearch()]; // Has news API
      case "general":
      default:
        return [new TavilySearch()]; // Best for general AI queries
    }
  }
}
```

### 1.3 Basic Implementation

```typescript
// src/tools/web-search.ts
import { ToolResult } from "../types/index.js";

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string; // Engine name
  relevanceScore?: number;
}

export class WebSearchTool {
  private tavily: TavilySearch;
  private brave: BraveSearch;
  private router: SimpleWebSearchRouter;
  private cache: SearchCache;

  constructor() {
    this.tavily = new TavilySearch();
    this.brave = new BraveSearch();
    this.router = new SimpleWebSearchRouter();
    this.cache = new SearchCache();
  }

  async search(query: string, options?: {
    maxResults?: number;
    includeAnswer?: boolean;
    searchDepth?: "basic" | "advanced";
  }): Promise<ToolResult> {
    try {
      // Check cache first
      const cached = this.cache.get(query);
      if (cached) {
        return {
          success: true,
          output: this.formatResults(cached, query, true),
        };
      }

      // Detect intent and select engines
      const intent = this.router.detectIntent(query);
      const engines = this.router.selectEngines(intent);

      // Execute search (just primary engine for now)
      const primaryEngine = engines[0];
      if (!primaryEngine.isAvailable()) {
        return {
          success: false,
          error: "Search engine not available (check API key)",
        };
      }

      const results = await primaryEngine.search(query, options);

      // Cache results (5 min TTL)
      this.cache.set(query, results, 5 * 60 * 1000);

      return {
        success: true,
        output: this.formatResults(results, query, false),
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Web search error: ${error.message}`,
      };
    }
  }

  private formatResults(
    results: WebSearchResult[],
    query: string,
    fromCache: boolean
  ): string {
    let output = `Web search results for "${query}"${fromCache ? " (cached)" : ""}:\n\n`;

    results.slice(0, 5).forEach((result, index) => {
      output += `${index + 1}. ${result.title}\n`;
      output += `   ${result.url}\n`;
      output += `   ${result.snippet}\n\n`;
    });

    if (results.length > 5) {
      output += `... and ${results.length - 5} more results\n`;
    }

    return output;
  }
}
```

### 1.4 Tool Definition for LLM

```typescript
// Add to src/llm/tools.ts
export function getWebSearchToolDefinition(): LLMTool {
  return {
    type: "function",
    function: {
      name: "web_search",
      description: "Search the internet for current information, documentation, code examples, news, or answers to questions. Returns web search results with titles, URLs, and snippets.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query. Be specific and include relevant keywords.",
          },
          maxResults: {
            type: "number",
            description: "Maximum number of results to return (default: 5, max: 10)",
            default: 5,
          },
          includeAnswer: {
            type: "boolean",
            description: "Whether to include an AI-generated answer summary (default: true)",
            default: true,
          },
        },
        required: ["query"],
      },
    },
  };
}
```

### Phase 1 Deliverables
- ✅ Tavily integration
- ✅ Brave Search integration
- ✅ Simple intent detection
- ✅ Basic caching (in-memory)
- ✅ LLM tool definition
- ✅ Error handling & fallbacks

### Phase 1 npm Dependencies
```json
{
  "dependencies": {
    "@tavily/core": "^1.0.0",
    "brave-search": "^1.0.0",
    "node-cache": "^5.1.2"
  }
}
```

---

## Phase 2: Parallel Search & Aggregation (Medium Risk, High Value)

### Timeline: Week 3-4
### Risk: **MEDIUM**
### Value: **HIGH**

### 2.1 Add Specialized Search Engines

#### **Stack Overflow Search**
- **Why**: Best for technical Q&A, code snippets
- **API**: Free tier available (300 requests/day)
- **npm**: `stackexchange-api` or REST client
- **Risk**: Low (free tier sufficient)

```typescript
class StackOverflowSearch implements SearchEngine {
  async search(query: string): Promise<WebSearchResult[]> {
    const response = await fetch(
      `https://api.stackexchange.com/2.3/search/advanced?` +
      `order=desc&sort=relevance&q=${encodeURIComponent(query)}` +
      `&site=stackoverflow&key=${process.env.STACKOVERFLOW_KEY}`
    );

    const data = await response.json();
    return data.items.map(item => ({
      title: item.title,
      url: item.link,
      snippet: item.body_markdown?.slice(0, 200) || "",
      source: "stackoverflow",
      relevanceScore: item.score,
    }));
  }
}
```

#### **GitHub Code Search**
- **Why**: Find code examples, repositories, issues
- **API**: GitHub API (5,000 requests/hour)
- **npm**: `@octokit/rest`
- **Risk**: Low (generous free tier)

```typescript
import { Octokit } from "@octokit/rest";

class GitHubSearch implements SearchEngine {
  private octokit: Octokit;

  constructor() {
    this.octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN,
    });
  }

  async search(query: string): Promise<WebSearchResult[]> {
    const { data } = await this.octokit.search.code({
      q: query,
      per_page: 5,
      sort: "indexed",
    });

    return data.items.map(item => ({
      title: `${item.repository.full_name}/${item.path}`,
      url: item.html_url,
      snippet: item.text_matches?.[0]?.fragment || "",
      source: "github",
      relevanceScore: item.score,
    }));
  }
}
```

#### **npm Search**
- **Why**: Find packages, libraries, tools
- **API**: npm Registry API (free, unlimited)
- **npm**: Built-in `npm-registry-fetch` or REST
- **Risk**: Very Low (free, no limits)

```typescript
class NpmSearch implements SearchEngine {
  async search(query: string): Promise<WebSearchResult[]> {
    const response = await fetch(
      `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(query)}&size=5`
    );

    const data = await response.json();
    return data.objects.map(obj => ({
      title: obj.package.name,
      url: `https://www.npmjs.com/package/${obj.package.name}`,
      snippet: obj.package.description || "",
      source: "npm",
      relevanceScore: obj.score.final,
    }));
  }
}
```

### 2.2 Parallel Search Executor

```typescript
class ParallelSearchExecutor {
  private timeout = 5000; // 5 second timeout

  async searchAll(
    query: string,
    engines: SearchEngine[],
    options?: SearchOptions
  ): Promise<SearchResult[]> {
    // Execute all searches in parallel with timeout
    const searchPromises = engines.map(engine =>
      this.searchWithTimeout(engine, query, options)
    );

    // Wait for all to complete (or fail)
    const results = await Promise.allSettled(searchPromises);

    // Extract successful results
    const allResults: SearchResult[] = [];
    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        allResults.push(...result.value);
      } else {
        console.warn(`Search failed: ${engines[index].name}`, result.reason);
      }
    });

    // Aggregate and deduplicate
    return this.aggregateResults(allResults);
  }

  private async searchWithTimeout(
    engine: SearchEngine,
    query: string,
    options?: SearchOptions
  ): Promise<SearchResult[]> {
    return Promise.race([
      engine.search(query, options),
      new Promise<SearchResult[]>((_, reject) =>
        setTimeout(() => reject(new Error("Search timeout")), this.timeout)
      ),
    ]);
  }

  private aggregateResults(results: SearchResult[]): SearchResult[] {
    // Deduplicate by URL
    const seen = new Set<string>();
    const unique: SearchResult[] = [];

    for (const result of results) {
      if (!seen.has(result.url)) {
        seen.add(result.url);
        unique.push(result);
      }
    }

    // Sort by relevance score (descending)
    return unique.sort((a, b) =>
      (b.relevanceScore || 0) - (a.relevanceScore || 0)
    );
  }
}
```

### 2.3 Enhanced Routing Logic

```typescript
class EnhancedWebSearchRouter {
  detectIntent(query: string): SearchIntent {
    const keywords = this.extractKeywords(query);

    // Detect multiple intents
    const intents: SearchIntent = {
      type: "general",
      requiresTechnical: false,
      requiresCode: false,
      requiresPackages: false,
      requiresNews: false,
    };

    // Technical indicators
    if (keywords.some(kw => ["error", "exception", "bug", "fix"].includes(kw))) {
      intents.requiresTechnical = true;
      intents.type = "technical";
    }

    // Code indicators
    if (keywords.some(kw => ["code", "example", "implementation", "function"].includes(kw))) {
      intents.requiresCode = true;
      intents.type = "technical";
    }

    // Package indicators
    if (keywords.some(kw => ["package", "library", "npm", "module"].includes(kw))) {
      intents.requiresPackages = true;
    }

    // News indicators
    if (keywords.some(kw => ["news", "latest", "today", "recent"].includes(kw))) {
      intents.requiresNews = true;
      intents.type = "news";
    }

    return intents;
  }

  selectEngines(intent: SearchIntent): SearchEngine[] {
    const engines: SearchEngine[] = [];

    // Always include a general search engine
    engines.push(new TavilySearch());

    // Add specialized engines based on intent
    if (intent.requiresTechnical) {
      engines.push(new StackOverflowSearch());
    }

    if (intent.requiresCode) {
      engines.push(new GitHubSearch());
    }

    if (intent.requiresPackages) {
      engines.push(new NpmSearch());
    }

    if (intent.requiresNews) {
      engines.push(new BraveSearch()); // Has news API
    }

    return engines;
  }

  private extractKeywords(query: string): string[] {
    return query
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 3); // Filter short words
  }
}
```

### 2.4 Result Ranking & Merging

```typescript
class SearchResultRanker {
  rank(results: SearchResult[], query: string): SearchResult[] {
    return results.map(result => {
      let score = result.relevanceScore || 50;

      // Boost if query appears in title
      if (result.title.toLowerCase().includes(query.toLowerCase())) {
        score += 20;
      }

      // Boost trusted sources
      if (["stackoverflow", "github", "npm"].includes(result.source)) {
        score += 10;
      }

      // Penalize very old results (if timestamp available)
      // ...

      return { ...result, relevanceScore: score };
    }).sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
  }
}
```

### Phase 2 Deliverables
- ✅ Stack Overflow integration
- ✅ GitHub search integration
- ✅ npm search integration
- ✅ Parallel execution with timeout
- ✅ Result aggregation & deduplication
- ✅ Enhanced intent detection
- ✅ Result ranking system

### Phase 2 npm Dependencies
```json
{
  "dependencies": {
    "@octokit/rest": "^20.0.0",
    "stackexchange-api": "^0.3.4",
    "p-queue": "^8.0.1",
    "p-retry": "^6.0.0"
  }
}
```

---

## Phase 3: Advanced Features (Optional, Medium-High Risk)

### Timeline: Week 5-6
### Risk: **MEDIUM-HIGH**
### Value: **MEDIUM**

### 3.1 Persistent Caching (Redis)
- **Why**: Reduce API costs, faster responses
- **npm**: `ioredis`
- **Risk**: Medium (requires Redis setup)

### 3.2 Rate Limiting & Queue Management
- **Why**: Prevent API quota exhaustion
- **npm**: `p-queue`, `bottleneck`
- **Risk**: Low

### 3.3 LLM-Powered Result Summarization
- **Why**: Combine multiple sources into coherent answer
- **Implementation**: Use GLM-4.6 to summarize search results
- **Risk**: Medium (adds latency, token cost)

### 3.4 Search Analytics
- **Why**: Track popular queries, cache hit rates, API usage
- **Implementation**: Log to file or database
- **Risk**: Low

---

## Risk Assessment Matrix

| Feature | Value | Risk | Effort | Priority |
|---------|-------|------|--------|----------|
| Tavily AI | ⭐⭐⭐⭐⭐ | 🟢 Low | 2-3h | P0 |
| Brave Search | ⭐⭐⭐⭐ | 🟢 Low | 2-3h | P0 |
| Simple Routing | ⭐⭐⭐⭐ | 🟢 Low | 4-6h | P0 |
| Basic Caching | ⭐⭐⭐⭐ | 🟢 Low | 1-2h | P0 |
| Stack Overflow | ⭐⭐⭐⭐ | 🟢 Low | 2-3h | P1 |
| GitHub Search | ⭐⭐⭐⭐ | 🟢 Low | 2-3h | P1 |
| npm Search | ⭐⭐⭐ | 🟢 Low | 1-2h | P1 |
| Parallel Search | ⭐⭐⭐⭐⭐ | 🟡 Medium | 6-8h | P1 |
| Result Ranking | ⭐⭐⭐ | 🟡 Medium | 4-6h | P2 |
| Redis Caching | ⭐⭐⭐ | 🟡 Medium | 4-6h | P3 |
| LLM Summarization | ⭐⭐⭐ | 🟡 Medium | 6-8h | P3 |

---

## Cost Analysis

### Free Tier (Sufficient for Development & Testing)
- **Tavily**: 1,000 searches/month FREE
- **Brave**: 2,000 searches/month FREE
- **Stack Overflow**: 300 requests/day FREE
- **GitHub**: 5,000 requests/hour FREE
- **npm**: Unlimited FREE

**Total Free Allowance**: ~3,300 searches/month (110/day)

### Paid Tier (For Production)
- **Tavily Pro**: $120/month (10,000 searches)
- **Brave Pro**: $3/1,000 queries ($30/month for 10,000)
- **Total**: ~$150/month for 20,000 searches

**Cost per search**: $0.0075 (very affordable)

---

## Implementation Roadmap

### Week 1-2: Phase 1 Foundation
**Goal**: Basic web search capability

- [ ] Day 1-2: Set up Tavily integration
  - Create account, get API key
  - Implement `TavilySearch` class
  - Write tests

- [ ] Day 3-4: Set up Brave integration
  - Create account, get API key
  - Implement `BraveSearch` class
  - Write tests

- [ ] Day 5-7: Routing & Tool Integration
  - Implement `SimpleWebSearchRouter`
  - Create `WebSearchTool` class
  - Add LLM tool definition
  - Integrate with `LLMAgent`

- [ ] Day 8-10: Testing & Polish
  - Manual testing
  - Add caching
  - Error handling
  - Documentation

### Week 3-4: Phase 2 Parallel Search
**Goal**: Multi-engine parallel search

- [ ] Day 11-13: Specialized Engines
  - Stack Overflow integration
  - GitHub search integration
  - npm search integration

- [ ] Day 14-17: Parallel Executor
  - Implement `ParallelSearchExecutor`
  - Add timeout handling
  - Result aggregation
  - Deduplication logic

- [ ] Day 18-20: Enhanced Routing
  - Implement `EnhancedWebSearchRouter`
  - Multi-intent detection
  - Engine selection logic
  - Result ranking

### Week 5-6: Phase 3 Advanced (Optional)
**Goal**: Production-ready optimizations

- [ ] Redis caching
- [ ] Rate limiting
- [ ] LLM summarization
- [ ] Analytics & monitoring

---

## Technical Recommendations

### 1. Use TypeScript Interfaces for Extensibility
```typescript
// Easy to add new engines
interface SearchEngine {
  name: string;
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  isAvailable(): boolean;
  getRateLimit(): { remaining: number; reset: Date };
}

// Easy to add new result types
interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
  relevanceScore?: number;
  timestamp?: Date;
  metadata?: Record<string, any>;
}
```

### 2. Environment Variable Configuration
```bash
# .env
TAVILY_API_KEY=your_key_here
BRAVE_API_KEY=your_key_here
STACKOVERFLOW_KEY=your_key_here
GITHUB_TOKEN=your_token_here

# Optional
ENABLE_WEB_SEARCH=true
WEB_SEARCH_TIMEOUT=5000
WEB_SEARCH_CACHE_TTL=300
MAX_SEARCH_RESULTS=10
```

### 3. Graceful Degradation
```typescript
// Always have fallback
async search(query: string): Promise<ToolResult> {
  const engines = this.selectEngines(query);

  // Try engines in priority order
  for (const engine of engines) {
    if (!engine.isAvailable()) continue;

    try {
      const results = await engine.search(query);
      if (results.length > 0) {
        return { success: true, output: this.format(results) };
      }
    } catch (error) {
      console.warn(`${engine.name} failed, trying next...`);
      continue;
    }
  }

  // All engines failed
  return {
    success: false,
    error: "All search engines unavailable. Please check API keys.",
  };
}
```

### 4. Rate Limiting with p-queue
```typescript
import PQueue from "p-queue";

class RateLimitedSearch {
  private queue = new PQueue({
    concurrency: 3, // Max 3 parallel requests
    interval: 1000, // Per second
    intervalCap: 5, // Max 5 requests per second
  });

  async search(query: string): Promise<SearchResult[]> {
    return this.queue.add(() => this.executeSearch(query));
  }
}
```

### 5. Circuit Breaker Pattern
```typescript
class CircuitBreaker {
  private failures = 0;
  private threshold = 5;
  private state: "closed" | "open" | "half-open" = "closed";

  async execute(fn: () => Promise<any>): Promise<any> {
    if (this.state === "open") {
      throw new Error("Circuit breaker is open");
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failures = 0;
    this.state = "closed";
  }

  private onFailure() {
    this.failures++;
    if (this.failures >= this.threshold) {
      this.state = "open";
      setTimeout(() => { this.state = "half-open"; }, 60000); // 1 min
    }
  }
}
```

---

## Alternative Approaches (Considered & Rejected)

### ❌ Web Scraping (Beautiful Soup equivalent)
- **Why Rejected**:
  - High risk (legal issues, ToS violations)
  - Fragile (breaks when sites change)
  - Slow (need to parse HTML)
  - No structured data
  - Rate limiting issues
- **Verdict**: Use APIs instead

### ❌ Google Custom Search (as primary)
- **Why Rejected**:
  - More expensive ($5/1,000 queries)
  - Strict rate limits
  - Requires setup
- **Verdict**: Tavily/Brave are better for AI use cases

### ❌ Perplexity API (as primary)
- **Why Rejected**:
  - More expensive
  - Less control over sources
  - Newer, less stable
- **Verdict**: Consider for Phase 3 as alternative

### ❌ Building Custom Search Index
- **Why Rejected**:
  - Extremely high effort
  - High maintenance cost
  - Infrastructure complexity
  - Not core competency
- **Verdict**: Use existing APIs

---

## Success Metrics

### Phase 1 Success Criteria
- ✅ Web search tool returns results 95%+ of the time
- ✅ Average response time < 3 seconds
- ✅ API costs < $10/month in testing
- ✅ Zero critical bugs

### Phase 2 Success Criteria
- ✅ Parallel search is 2x faster than sequential
- ✅ Result accuracy improved by 30% (user feedback)
- ✅ Cache hit rate > 40%
- ✅ Supports 5+ search engines

### User Success Metrics
- Users successfully find current information
- Reduced "I don't know" responses from LLM
- Increased user satisfaction scores
- More complex queries successfully answered

---

## Security Considerations

### 1. API Key Protection
```typescript
// Never log API keys
if (process.env.NODE_ENV !== "production") {
  console.log("Using Tavily API key: ***REDACTED***");
}

// Validate keys on startup
if (!process.env.TAVILY_API_KEY) {
  console.warn("TAVILY_API_KEY not set, web search will be disabled");
}
```

### 2. Input Validation
```typescript
// Prevent injection attacks
function sanitizeQuery(query: string): string {
  // Remove special characters that could break APIs
  return query.replace(/[<>\"\']/g, "").slice(0, 500); // Max length
}
```

### 3. Rate Limit Monitoring
```typescript
class RateLimitMonitor {
  checkLimits(engine: string): boolean {
    const usage = this.getUsage(engine);

    if (usage.remaining < 10) {
      console.warn(`Low API quota for ${engine}: ${usage.remaining} remaining`);
      // Alert admin
    }

    return usage.remaining > 0;
  }
}
```

### 4. Error Information Leakage
```typescript
// Don't expose API errors to users
catch (error: any) {
  console.error("Search error:", error); // Log full error

  return {
    success: false,
    error: "Search temporarily unavailable", // Generic message
  };
}
```

---

## Testing Strategy

### Unit Tests
```typescript
describe("WebSearchTool", () => {
  it("should return results from Tavily", async () => {
    const tool = new WebSearchTool();
    const result = await tool.search("TypeScript best practices");

    expect(result.success).toBe(true);
    expect(result.output).toContain("http");
  });

  it("should cache results", async () => {
    const tool = new WebSearchTool();

    const result1 = await tool.search("Node.js async");
    const result2 = await tool.search("Node.js async");

    expect(result2.output).toContain("(cached)");
  });

  it("should handle API failures gracefully", async () => {
    const tool = new WebSearchTool();
    // Mock API to fail

    const result = await tool.search("test query");
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
```

### Integration Tests
```typescript
describe("Parallel Search", () => {
  it("should combine results from multiple engines", async () => {
    const executor = new ParallelSearchExecutor();
    const engines = [
      new TavilySearch(),
      new BraveSearch(),
      new StackOverflowSearch(),
    ];

    const results = await executor.searchAll("React hooks error", engines);

    expect(results.length).toBeGreaterThan(0);
    // Should have results from multiple sources
    const sources = new Set(results.map(r => r.source));
    expect(sources.size).toBeGreaterThan(1);
  });
});
```

### Manual Testing Checklist
- [ ] General web search works
- [ ] Technical queries route to correct engines
- [ ] Parallel search is faster
- [ ] Caching reduces API calls
- [ ] Error handling works (disconnect internet)
- [ ] Rate limits are respected
- [ ] Results are relevant and accurate

---

## Documentation Requirements

### User Documentation
- Add "Web Search" section to README
- Explain how to get API keys
- Show example queries
- Troubleshooting guide

### Developer Documentation
- Architecture diagram
- API integration guide
- How to add new search engines
- Testing guide

### Configuration Guide
```markdown
## Setting up Web Search

1. Get API keys:
   - Tavily: https://tavily.com/
   - Brave: https://brave.com/search/api/

2. Add to `.env`:
   ```
   TAVILY_API_KEY=your_key
   BRAVE_API_KEY=your_key
   ```

3. Test:
   ```bash
   ax-cli "search web for latest TypeScript features"
   ```
```

---

## Conclusion & Recommendation

### ✅ Recommended Approach: Phased Implementation

**Start with Phase 1** (Low Risk, High Value):
1. Integrate Tavily AI + Brave Search
2. Implement simple routing
3. Add basic caching
4. Deploy and gather user feedback

**Then Phase 2** (Medium Risk, High Value):
5. Add specialized engines (Stack Overflow, GitHub, npm)
6. Implement parallel search
7. Enhance routing logic
8. Improve result ranking

**Optionally Phase 3** (Medium Risk, Medium Value):
9. Redis caching for production
10. LLM-powered summarization
11. Advanced analytics

### Key Success Factors
- ✅ Start small with free tier APIs
- ✅ Use parallel search for speed
- ✅ Implement routing for accuracy
- ✅ Cache aggressively to reduce costs
- ✅ Graceful degradation when APIs fail
- ✅ Monitor usage and costs

### Estimated Total Effort
- Phase 1: 20-30 hours (1-2 weeks)
- Phase 2: 30-40 hours (2-3 weeks)
- Phase 3: 20-30 hours (1-2 weeks)

**Total**: 70-100 hours (6-8 weeks for complete implementation)

### Estimated Costs
- Development: FREE (using free tiers)
- Production (10K searches/month): $150/month
- **Per search**: $0.0075 (very affordable)

---

## Next Steps

1. **Get stakeholder approval** for Phase 1
2. **Create API accounts** (Tavily, Brave)
3. **Set up development environment**
4. **Implement basic Tavily integration** (2-3 hours)
5. **Test with real queries**
6. **Gather user feedback**
7. **Iterate based on feedback**
8. **Move to Phase 2 when ready**

---

**Status**: READY FOR IMPLEMENTATION
**Risk Level**: ✅ LOW (Phase 1), 🟡 MEDIUM (Phase 2-3)
**Recommendation**: ✅ PROCEED with Phase 1 immediately
