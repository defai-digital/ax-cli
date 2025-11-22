/**
 * Tavily AI Search Engine
 * AI-optimized search designed for LLMs
 * https://tavily.com/
 */

import axios from "axios";
import type {
  SearchEngine,
  WebSearchResult,
  SearchOptions,
} from "../types.js";

interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
  published_date?: string;
}

interface TavilyResponse {
  query: string;
  answer?: string;
  results: TavilySearchResult[];
  response_time?: number;
}

export class TavilySearch implements SearchEngine {
  public readonly name = "tavily";
  private apiKey: string | undefined;
  private baseUrl = "https://api.tavily.com/search";
  private timeout = 10000; // 10 second timeout

  constructor() {
    this.apiKey = process.env.TAVILY_API_KEY;
  }

  isAvailable(): boolean {
    return !!this.apiKey;
  }

  async search(
    query: string,
    options?: SearchOptions
  ): Promise<WebSearchResult[]> {
    if (!this.isAvailable()) {
      throw new Error("Tavily API key not configured");
    }

    try {
      const response = await axios.post<TavilyResponse>(
        this.baseUrl,
        {
          api_key: this.apiKey,
          query: query,
          search_depth: options?.searchDepth || "basic",
          max_results: Math.min(options?.maxResults || 5, 10),
          include_answer: options?.includeAnswer ?? true,
          include_domains: options?.includeDomains || [],
          exclude_domains: options?.excludeDomains || [],
        },
        {
          timeout: options?.timeout || this.timeout,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      return this.formatResults(response.data);
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        if (error.code === "ECONNABORTED") {
          throw new Error("Tavily search timeout");
        }
        if (error.response?.status === 401) {
          throw new Error("Invalid Tavily API key");
        }
        if (error.response?.status === 429) {
          throw new Error("Tavily rate limit exceeded");
        }
        throw new Error(
          `Tavily API error: ${error.response?.data?.message || error.message}`
        );
      }
      throw error;
    }
  }

  private formatResults(response: TavilyResponse): WebSearchResult[] {
    return response.results.map((result) => ({
      title: result.title,
      url: result.url,
      snippet: result.content,
      source: this.name,
      relevanceScore: result.score * 100, // Convert 0-1 to 0-100
      publishedDate: result.published_date,
      metadata: {
        answer: response.answer,
        responseTime: response.response_time,
      },
    }));
  }

  getAnswer(results: WebSearchResult[]): string | undefined {
    return results[0]?.metadata?.answer;
  }
}
