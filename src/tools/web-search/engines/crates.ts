/**
 * crates.io (Rust Crates) Search Engine
 * Free, unlimited search for Rust crates
 * No API key required
 */

import axios from "axios";
import type {
  SearchEngine,
  WebSearchResult,
  SearchOptions,
} from "../types.js";

interface Crate {
  id: string;
  name: string;
  newest_version: string;
  description: string;
  downloads: number;
  recent_downloads: number;
  documentation: string | null;
  homepage: string | null;
  repository: string | null;
}

interface CratesResponse {
  crates: Crate[];
  meta: {
    total: number;
  };
}

export class CratesSearch implements SearchEngine {
  public readonly name = "crates.io";
  private baseUrl = "https://crates.io/api/v1/crates";
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
      const params = new URLSearchParams({
        q: query,
        per_page: Math.min(options?.maxResults || 5, 20).toString(),
      });

      const response = await axios.get<CratesResponse>(
        `${this.baseUrl}?${params.toString()}`,
        {
          timeout: options?.timeout || this.timeout,
          headers: {
            "User-Agent": "ax-cli",
            Accept: "application/json",
          },
        }
      );

      return this.formatResults(response.data);
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        if (error.code === "ECONNABORTED") {
          throw new Error("crates.io search timeout");
        }
        throw new Error(
          `crates.io error: ${error.response?.data?.errors?.[0]?.detail || error.message}`
        );
      }
      throw error;
    }
  }

  private formatResults(response: CratesResponse): WebSearchResult[] {
    return response.crates.map((crate) => ({
      title: crate.name,
      url: `https://crates.io/crates/${crate.name}`,
      snippet: this.createSnippet(crate),
      source: this.name,
      relevanceScore: this.calculateScore(crate),
      metadata: {
        version: crate.newest_version,
        downloads: crate.downloads,
        recentDownloads: crate.recent_downloads,
        documentation: crate.documentation,
        homepage: crate.homepage,
        repository: crate.repository,
      },
    }));
  }

  private createSnippet(crate: Crate): string {
    const parts: string[] = [];

    if (crate.description) {
      parts.push(crate.description);
    }

    parts.push(`v${crate.newest_version}`);

    if (crate.downloads > 1000000) {
      parts.push(`${(crate.downloads / 1000000).toFixed(1)}M downloads`);
    } else if (crate.downloads > 1000) {
      parts.push(`${(crate.downloads / 1000).toFixed(1)}K downloads`);
    }

    const indicators: string[] = [];
    if (crate.downloads > 1000000) indicators.push("very popular");
    else if (crate.downloads > 100000) indicators.push("popular");

    if (indicators.length > 0) {
      parts.push(`(${indicators.join(", ")})`);
    }

    return parts.join(" • ");
  }

  private calculateScore(crate: Crate): number {
    // Score based on downloads (logarithmic scale)
    const downloadScore = Math.min(Math.log10(crate.downloads + 1) * 10, 100);
    return downloadScore;
  }
}
