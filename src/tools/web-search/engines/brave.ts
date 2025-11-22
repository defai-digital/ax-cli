/**
 * Brave Search Engine
 * Privacy-focused independent search
 * https://brave.com/search/api/
 */

import axios from "axios";
import type {
  SearchEngine,
  WebSearchResult,
  SearchOptions,
} from "../types.js";

interface BraveWebResult {
  title: string;
  url: string;
  description: string;
  age?: string;
  page_age?: string;
  language?: string;
}

interface BraveResponse {
  query: {
    original: string;
    altered?: string;
  };
  web?: {
    results: BraveWebResult[];
  };
  news?: {
    results: BraveWebResult[];
  };
}

export class BraveSearch implements SearchEngine {
  public readonly name = "brave";
  private apiKey: string | undefined;
  private baseUrl = "https://api.search.brave.com/res/v1/web/search";
  private timeout = 10000; // 10 second timeout

  constructor() {
    this.apiKey = process.env.BRAVE_API_KEY;
  }

  isAvailable(): boolean {
    return !!this.apiKey;
  }

  async search(
    query: string,
    options?: SearchOptions
  ): Promise<WebSearchResult[]> {
    if (!this.isAvailable()) {
      throw new Error("Brave API key not configured");
    }

    try {
      const params = new URLSearchParams({
        q: query,
        count: Math.min(options?.maxResults || 10, 20).toString(),
        offset: "0",
        text_decorations: "false",
        spellcheck: "true",
      });

      // Add freshness filter if specified
      if (options?.freshness) {
        const freshnessMap = {
          day: "pd",
          week: "pw",
          month: "pm",
          year: "py",
        };
        params.append("freshness", freshnessMap[options.freshness]);
      }

      const response = await axios.get<BraveResponse>(
        `${this.baseUrl}?${params.toString()}`,
        {
          timeout: options?.timeout || this.timeout,
          headers: {
            Accept: "application/json",
            "Accept-Encoding": "gzip",
            "X-Subscription-Token": this.apiKey,
          },
        }
      );

      return this.formatResults(response.data);
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        if (error.code === "ECONNABORTED") {
          throw new Error("Brave search timeout");
        }
        if (error.response?.status === 401) {
          throw new Error("Invalid Brave API key");
        }
        if (error.response?.status === 429) {
          throw new Error("Brave rate limit exceeded");
        }
        throw new Error(
          `Brave API error: ${error.response?.data?.message || error.message}`
        );
      }
      throw error;
    }
  }

  private formatResults(response: BraveResponse): WebSearchResult[] {
    const results: WebSearchResult[] = [];

    // Add web results
    if (response.web?.results) {
      results.push(
        ...response.web.results.map((result, index) => ({
          title: result.title,
          url: result.url,
          snippet: result.description,
          source: this.name,
          relevanceScore: 100 - index * 5, // Simple scoring based on position
          publishedDate: result.age || result.page_age,
          metadata: {
            language: result.language,
          },
        }))
      );
    }

    // Add news results if available
    if (response.news?.results) {
      results.push(
        ...response.news.results.map((result, index) => ({
          title: result.title,
          url: result.url,
          snippet: result.description,
          source: `${this.name}-news`,
          relevanceScore: 95 - index * 5,
          publishedDate: result.age,
          metadata: {
            type: "news",
          },
        }))
      );
    }

    return results;
  }
}
