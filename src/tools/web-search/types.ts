/**
 * Web Search Types
 * Common interfaces and types for web search functionality
 */

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string; // Engine name (e.g., "npm", "pypi", "crates.io")
  relevanceScore?: number;
  publishedDate?: string;
  metadata?: Record<string, any>;
}

export interface SearchOptions {
  maxResults?: number;
  includeAnswer?: boolean;
  searchDepth?: "basic" | "advanced";
  freshness?: "day" | "week" | "month" | "year";
  includeDomains?: string[];
  excludeDomains?: string[];
  timeout?: number;
}

export interface SearchIntent {
  type: "general" | "technical" | "news" | "code";
  requiresTechnical: boolean;
  requiresCode: boolean;
  requiresNews: boolean;
  confidence: number; // 0-1
  language?: "javascript" | "python" | "rust"; // Detected programming language
}

export interface SearchEngine {
  name: string;
  search(query: string, options?: SearchOptions): Promise<WebSearchResult[]>;
  isAvailable(): boolean;
  getQuota?(): { remaining: number; limit: number };
}

export interface SearchEngineResponse {
  results: WebSearchResult[];
  answer?: string; // AI-generated summary (if available)
  totalResults?: number;
  query: string;
}
