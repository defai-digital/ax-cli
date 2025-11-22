/**
 * Web Search Tool
 * Main tool for web search functionality in AX CLI
 */

import type { ToolResult } from "../../types/index.js";
import type { WebSearchResult, SearchOptions } from "./types.js";
import { WebSearchRouter } from "./router.js";
import { SearchCache } from "./cache.js";

export class WebSearchTool {
  private router: WebSearchRouter;
  private cache: SearchCache;
  private readonly DEFAULT_MAX_RESULTS = 5;
  private readonly MAX_RESULTS_LIMIT = 10;
  private readonly MAX_PARALLEL_ENGINES = 3; // Execute up to 3 engines in parallel

  constructor() {
    this.router = new WebSearchRouter();
    this.cache = new SearchCache();
  }

  /**
   * Search the web for information
   */
  async search(
    query: string,
    options?: SearchOptions
  ): Promise<ToolResult> {
    try {
      // Validate query
      if (!query || query.trim().length === 0) {
        return {
          success: false,
          error: "Search query cannot be empty",
        };
      }

      // Sanitize query
      const sanitizedQuery = this.sanitizeQuery(query);

      // Note: hasAvailableEngines() always returns true now because npm search
      // is available by default (no API key required). Optional: Configure
      // TAVILY_API_KEY or BRAVE_API_KEY for enhanced search capabilities.

      // Check cache first
      const cached = this.cache.get(sanitizedQuery);
      if (cached && cached.length > 0) {
        return {
          success: true,
          output: this.formatResults(cached, sanitizedQuery, true),
        };
      }

      // Detect intent and select engines
      const intent = this.router.detectIntent(sanitizedQuery);
      const engines = this.router.selectEngines(intent);

      if (engines.length === 0) {
        return {
          success: false,
          error: "No search engine available",
        };
      }

      // Prepare search options
      const searchOptions: SearchOptions = {
        maxResults: Math.min(
          options?.maxResults || this.DEFAULT_MAX_RESULTS,
          this.MAX_RESULTS_LIMIT
        ),
        includeAnswer: options?.includeAnswer ?? true,
        searchDepth: options?.searchDepth || "basic",
        freshness: options?.freshness,
        includeDomains: options?.includeDomains,
        excludeDomains: options?.excludeDomains,
      };

      // Execute searches in parallel across multiple engines
      const parallelCount = Math.min(
        engines.length,
        this.MAX_PARALLEL_ENGINES
      );
      const enginesToUse = engines.slice(0, parallelCount);

      // Execute all searches in parallel
      const searchPromises = enginesToUse.map((engine) =>
        engine
          .search(sanitizedQuery, searchOptions)
          .then((results) => ({ engine: engine.name, results, error: null }))
          .catch((error) => ({
            engine: engine.name,
            results: [],
            error: error.message,
          }))
      );

      const searchResults = await Promise.all(searchPromises);

      // Aggregate and deduplicate results
      const results = this.aggregateResults(searchResults, searchOptions.maxResults || this.DEFAULT_MAX_RESULTS);

      // Cache results (5 minute TTL)
      if (results.length > 0) {
        this.cache.set(sanitizedQuery, results, 300);
      }

      // Get list of engines that were used
      const enginesUsed = searchResults
        .filter((r) => r.results.length > 0)
        .map((r) => r.engine);

      // Format and return results
      return {
        success: true,
        output: this.formatResults(
          results,
          sanitizedQuery,
          false,
          intent.type,
          enginesUsed
        ),
      };
    } catch (error: any) {
      // Handle specific error cases
      if (error.message?.includes("timeout")) {
        return {
          success: false,
          error: "Search request timed out. Please try again.",
        };
      }

      if (error.message?.includes("rate limit")) {
        return {
          success: false,
          error: "Search rate limit exceeded. Please try again later.",
        };
      }

      if (error.message?.includes("API key")) {
        return {
          success: false,
          error: "Search API authentication failed. Please check your API keys.",
        };
      }

      // Generic error
      return {
        success: false,
        error: `Web search error: ${error.message}`,
      };
    }
  }

  /**
   * Sanitize search query to prevent injection attacks
   */
  private sanitizeQuery(query: string): string {
    return query
      .replace(/[<>\"\']/g, "") // Remove special characters
      .trim()
      .slice(0, 500); // Max length
  }

  /**
   * Aggregate and deduplicate results from multiple search engines
   */
  private aggregateResults(
    searchResults: Array<{
      engine: string;
      results: WebSearchResult[];
      error: string | null;
    }>,
    maxResults: number
  ): WebSearchResult[] {
    const urlMap = new Map<string, WebSearchResult>();
    const scores = new Map<string, number>();

    // Aggregate results from all engines
    for (const { engine, results } of searchResults) {
      results.forEach((result, index) => {
        const url = result.url;

        // Calculate score based on position and source
        // Earlier results and results from multiple engines get higher scores
        const positionScore = maxResults - index;
        const sourceBonus = this.getSourceBonus(engine);
        const score = positionScore + sourceBonus;

        if (!urlMap.has(url)) {
          // New result
          urlMap.set(url, result);
          scores.set(url, score);
        } else {
          // Duplicate - boost score (result appears in multiple engines)
          const existingScore = scores.get(url) || 0;
          scores.set(url, existingScore + score * 0.5); // 50% bonus for appearing in multiple sources

          // Merge metadata if the new result has additional info
          const existing = urlMap.get(url)!;
          if (result.metadata?.answer && !existing.metadata?.answer) {
            existing.metadata = {
              ...existing.metadata,
              answer: result.metadata.answer,
            };
          }
        }
      });
    }

    // Sort by score and return top results
    const aggregated = Array.from(urlMap.entries())
      .map(([url, result]) => ({
        result,
        score: scores.get(url) || 0,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults)
      .map(({ result }) => result);

    return aggregated;
  }

  /**
   * Get bonus score for specific search engines
   */
  private getSourceBonus(engine: string): number {
    // Prioritize certain engines based on reliability
    switch (engine) {
      case "tavily":
        return 3; // Tavily has AI-powered relevance
      case "npm":
      case "pypi":
      case "crates.io":
        return 2; // Package registries are authoritative for packages
      case "brave":
        return 1; // General search engine
      default:
        return 0;
    }
  }

  /**
   * Format search results for display
   */
  private formatResults(
    results: WebSearchResult[],
    query: string,
    fromCache: boolean,
    intentType?: string,
    enginesUsed?: string[]
  ): string {
    if (results.length === 0) {
      return `No web search results found for "${query}".`;
    }

    let output = `Web search results for "${query}"`;

    // Add cache indicator
    if (fromCache) {
      output += " (cached)";
    }

    // Add intent indicator if available
    if (intentType && intentType !== "general") {
      output += ` [${intentType}]`;
    }

    // Add engines used indicator (for parallel search)
    if (enginesUsed && enginesUsed.length > 1) {
      output += ` [sources: ${enginesUsed.join(", ")}]`;
    }

    output += ":\n\n";

    // Extract AI-generated answer if available (from Tavily)
    const answer = results[0]?.metadata?.answer;
    if (answer && typeof answer === "string") {
      output += `**Summary**: ${answer}\n\n`;
    }

    // Format each result
    results.forEach((result, index) => {
      output += `${index + 1}. **${result.title}**\n`;
      output += `   URL: ${result.url}\n`;
      output += `   ${result.snippet}\n`;

      // Add published date if available
      if (result.publishedDate) {
        output += `   Published: ${result.publishedDate}\n`;
      }

      // Add source indicator
      output += `   Source: ${result.source}\n`;

      output += "\n";
    });

    // Add result count
    if (results.length >= this.MAX_RESULTS_LIMIT) {
      output += `Showing ${results.length} results (maximum). Refine your query for more specific results.\n`;
    } else {
      output += `Found ${results.length} result${results.length === 1 ? "" : "s"}.\n`;
    }

    return output.trim();
  }

  /**
   * Get cache statistics (for debugging/monitoring)
   */
  getCacheStats(): {
    keys: number;
    hits: number;
    misses: number;
    hitRate: number;
  } {
    return this.cache.getStats();
  }

  /**
   * Clear search cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Check if web search is available
   */
  isAvailable(): boolean {
    return this.router.hasAvailableEngines();
  }
}
