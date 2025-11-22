/**
 * npm Registry Search Engine
 * Free, unlimited search for npm packages
 * No API key required
 */

import axios from "axios";
import type {
  SearchEngine,
  WebSearchResult,
  SearchOptions,
} from "../types.js";

interface NpmPackage {
  package: {
    name: string;
    version: string;
    description: string;
    links: {
      npm: string;
      homepage?: string;
      repository?: string;
    };
    author?: {
      name: string;
    };
    publisher: {
      username: string;
    };
    date: string;
  };
  score: {
    final: number;
    detail: {
      quality: number;
      popularity: number;
      maintenance: number;
    };
  };
  searchScore: number;
}

interface NpmResponse {
  objects: NpmPackage[];
  total: number;
}

export class NpmSearch implements SearchEngine {
  public readonly name = "npm";
  private baseUrl = "https://registry.npmjs.org/-/v1/search";
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
        text: query,
        size: Math.min(options?.maxResults || 5, 20).toString(),
      });

      const response = await axios.get<NpmResponse>(
        `${this.baseUrl}?${params.toString()}`,
        {
          timeout: options?.timeout || this.timeout,
          headers: {
            Accept: "application/json",
          },
        }
      );

      return this.formatResults(response.data);
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        if (error.code === "ECONNABORTED") {
          throw new Error("npm search timeout");
        }
        throw new Error(
          `npm registry error: ${error.response?.data?.error || error.message}`
        );
      }
      throw error;
    }
  }

  private formatResults(response: NpmResponse): WebSearchResult[]  {
    return response.objects.map((pkg) => ({
      title: pkg.package.name,
      url: pkg.package.links.npm || `https://www.npmjs.com/package/${pkg.package.name}`,
      snippet: this.createSnippet(pkg),
      source: this.name,
      relevanceScore: pkg.score.final * 100, // Convert 0-1 to 0-100
      publishedDate: pkg.package.date,
      metadata: {
        version: pkg.package.version,
        author: pkg.package.author?.name || pkg.package.publisher.username,
        quality: pkg.score.detail.quality,
        popularity: pkg.score.detail.popularity,
        maintenance: pkg.score.detail.maintenance,
        homepage: pkg.package.links.homepage,
        repository: pkg.package.links.repository,
      },
    }));
  }

  private createSnippet(pkg: NpmPackage): string {
    const parts: string[] = [];

    if (pkg.package.description) {
      parts.push(pkg.package.description);
    }

    parts.push(`v${pkg.package.version}`);

    if (pkg.package.author?.name) {
      parts.push(`by ${pkg.package.author.name}`);
    }

    // Add quality indicators
    const quality = pkg.score.detail.quality;
    const popularity = pkg.score.detail.popularity;
    const maintenance = pkg.score.detail.maintenance;

    const indicators: string[] = [];
    if (quality > 0.7) indicators.push("high quality");
    if (popularity > 0.7) indicators.push("popular");
    if (maintenance > 0.7) indicators.push("well-maintained");

    if (indicators.length > 0) {
      parts.push(`(${indicators.join(", ")})`);
    }

    return parts.join(" • ");
  }
}
