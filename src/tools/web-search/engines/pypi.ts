/**
 * PyPI (Python Package Index) Search Engine
 * Free, unlimited search for Python packages
 * No API key required
 */

import axios from "axios";
import type {
  SearchEngine,
  WebSearchResult,
  SearchOptions,
} from "../types.js";

// Note: PyPI's search API is being rebuilt, so we use direct package lookup instead

export class PyPISearch implements SearchEngine {
  public readonly name = "pypi";
  private baseUrl = "https://pypi.org/pypi";
  private timeout = 10000; // 10 second timeout

  /**
   * Always available - no API key required
   */
  isAvailable(): boolean {
    return true;
  }

  async search(
    query: string,
    options?: SearchOptions
  ): Promise<WebSearchResult[]> {
    try {
      // PyPI's official search is being rebuilt, so we use direct package lookup
      // Try to fetch package info directly
      const packageResponse = await axios.get(
        `${this.baseUrl}/${encodeURIComponent(query)}/json`,
        {
          timeout: options?.timeout || this.timeout,
          validateStatus: (status) => status === 200 || status === 404,
        }
      );

      if (packageResponse.status === 404) {
        // Package not found, return empty results
        return [];
      }

      return this.formatResult(packageResponse.data);
    } catch (error: any) {
      // Return empty results on error rather than failing
      // PyPI search is a best-effort feature
      return [];
    }
  }

  private formatResult(data: any): WebSearchResult[] {
    if (!data.info) return [];

    const info = data.info;
    return [
      {
        title: info.name,
        url: `https://pypi.org/project/${info.name}/`,
        snippet: this.createSnippet(info),
        source: this.name,
        relevanceScore: 100, // Exact match
        publishedDate: info.release_date,
        metadata: {
          version: info.version,
          author: info.author,
          license: info.license,
          homepage: info.home_page || info.project_urls?.Homepage,
          requiresPython: info.requires_python,
        },
      },
    ];
  }

  private createSnippet(info: any): string {
    const parts: string[] = [];

    if (info.summary) {
      parts.push(info.summary);
    }

    parts.push(`v${info.version}`);

    if (info.author) {
      parts.push(`by ${info.author}`);
    }

    if (info.license) {
      parts.push(`License: ${info.license}`);
    }

    return parts.join(" • ");
  }
}
