/**
 * Web Search Module
 * Exports all web search functionality
 */

export { WebSearchTool } from "./web-search-tool.js";
export { WebSearchRouter } from "./router.js";
export { SearchCache } from "./cache.js";
export { TavilySearch } from "./engines/tavily.js";
export { BraveSearch } from "./engines/brave.js";
export { NpmSearch } from "./engines/npm.js";
export { PyPISearch } from "./engines/pypi.js";
export { CratesSearch } from "./engines/crates.js";

export type {
  WebSearchResult,
  SearchOptions,
  SearchIntent,
  SearchEngine,
  SearchEngineResponse,
} from "./types.js";
