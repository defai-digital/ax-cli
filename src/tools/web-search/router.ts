/**
 * Search Router
 * Detects query intent and routes to appropriate search engines
 */

import type { SearchEngine, SearchIntent } from "./types.js";
import { NpmSearch } from "./engines/npm.js";
import { PyPISearch } from "./engines/pypi.js";
import { CratesSearch } from "./engines/crates.js";

export class WebSearchRouter {
  private npmEngine: NpmSearch;
  private pypiEngine: PyPISearch;
  private cratesEngine: CratesSearch;

  // Keywords for intent detection
  private readonly technicalKeywords = [
    "error",
    "exception",
    "bug",
    "fix",
    "debug",
    "troubleshoot",
    "code",
    "function",
    "method",
    "class",
    "api",
    "library",
    "framework",
    "npm",
    "package",
    "install",
    "configure",
    "implementation",
    "syntax",
    "typescript",
    "javascript",
    "python",
    "java",
    "rust",
    "go",
  ];

  private readonly codeKeywords = [
    "code",
    "example",
    "implementation",
    "snippet",
    "sample",
    "github",
    "repository",
    "source",
    "function",
    "class",
    "how to",
    "tutorial",
  ];

  private readonly packageKeywords = [
    "package",
    "npm",
    "library",
    "module",
    "install",
    "dependency",
    "dependencies",
    "node_modules",
    "yarn",
    "pnpm",
  ];

  private readonly pythonKeywords = [
    "python",
    "pip",
    "pypi",
    "django",
    "flask",
    "fastapi",
    "pandas",
    "numpy",
    "pytest",
    "virtualenv",
    "conda",
    "poetry",
  ];

  private readonly rustKeywords = [
    "rust",
    "cargo",
    "crate",
    "crates.io",
    "rustc",
    "tokio",
    "serde",
    "actix",
    "wasm",
  ];

  private readonly newsKeywords = [
    "news",
    "latest",
    "today",
    "yesterday",
    "recent",
    "update",
    "announcement",
    "release",
    "2025",
    "2024",
    "current",
    "breaking",
    "trending",
  ];

  constructor() {
    this.npmEngine = new NpmSearch(); // Always available (no API key)
    this.pypiEngine = new PyPISearch(); // Always available (no API key)
    this.cratesEngine = new CratesSearch(); // Always available (no API key)
  }

  /**
   * Detect the intent of a search query
   */
  detectIntent(query: string): SearchIntent {
    const lowerQuery = query.toLowerCase();
    const words = lowerQuery.split(/\s+/);

    let technicalScore = 0;
    let codeScore = 0;
    let newsScore = 0;
    let packageScore = 0;
    let pythonScore = 0;
    let rustScore = 0;

    // Count keyword matches
    for (const word of words) {
      if (this.technicalKeywords.some((kw) => word.includes(kw))) {
        technicalScore++;
      }
      if (this.codeKeywords.some((kw) => word.includes(kw))) {
        codeScore++;
      }
      if (this.newsKeywords.some((kw) => word.includes(kw))) {
        newsScore++;
      }
      if (this.packageKeywords.some((kw) => word.includes(kw))) {
        packageScore++;
      }
      if (this.pythonKeywords.some((kw) => word.includes(kw))) {
        pythonScore++;
      }
      if (this.rustKeywords.some((kw) => word.includes(kw))) {
        rustScore++;
      }
    }

    // Determine primary intent
    let type: SearchIntent["type"] = "general";
    let confidence = 0.5; // Default confidence
    let language: SearchIntent["language"] = undefined;

    // Detect language first
    if (pythonScore > 0 && pythonScore >= rustScore) {
      language = "python";
    } else if (rustScore > 0 && rustScore > pythonScore) {
      language = "rust";
    } else if (packageScore > 0) {
      language = "javascript"; // npm implies JavaScript
    }

    // Package search takes priority if npm keywords detected
    if (packageScore > 0 || pythonScore > 0 || rustScore > 0) {
      type = "technical"; // Packages are technical
      confidence = Math.min(
        (packageScore + pythonScore + rustScore) / words.length + 0.6,
        1.0
      );
    } else if (newsScore > 0) {
      type = "news";
      confidence = Math.min(newsScore / words.length + 0.5, 1.0);
    } else if (codeScore > technicalScore) {
      type = "code";
      confidence = Math.min(codeScore / words.length + 0.5, 1.0);
    } else if (technicalScore > 0) {
      type = "technical";
      confidence = Math.min(technicalScore / words.length + 0.5, 1.0);
    }

    return {
      type,
      requiresTechnical:
        technicalScore > 0 || packageScore > 0 || pythonScore > 0 || rustScore > 0,
      requiresCode: codeScore > 0,
      requiresNews: newsScore > 0,
      confidence,
      language,
    };
  }

  /**
   * Select the best search engines for a given intent
   */
  selectEngines(intent: SearchIntent): SearchEngine[] {
    const engines: SearchEngine[] = [];

    // Check if query contains package keywords - prioritize language-specific search
    const hasPackageIntent = intent.requiresTechnical && intent.confidence > 0.6;

    // Select engines based on intent type
    switch (intent.type) {
      case "technical":
      case "code":
        // Route to language-specific package search
        if (hasPackageIntent && intent.language) {
          if (intent.language === "python") {
            engines.push(this.pypiEngine); // Python packages
          } else if (intent.language === "rust") {
            engines.push(this.cratesEngine); // Rust crates
          } else if (intent.language === "javascript") {
            engines.push(this.npmEngine); // npm packages
          }
        } else if (hasPackageIntent) {
          // Default to npm if language not detected
          engines.push(this.npmEngine);
        }
        break;

      case "news":
      case "general":
      default:
        // Default to npm for general queries (always available)
        engines.push(this.npmEngine);
        break;
    }

    // Package search as ultimate fallback (always available, no API key needed)
    // Prefer npm as it's most commonly used
    if (engines.length === 0) {
      engines.push(this.npmEngine);
    }

    return engines;
  }

  /**
   * Get all available engines
   */
  getAvailableEngines(): SearchEngine[] {
    const engines: SearchEngine[] = [];

    // Package search engines are always available (no API key required)
    engines.push(this.npmEngine);
    engines.push(this.pypiEngine);
    engines.push(this.cratesEngine);

    return engines;
  }

  /**
   * Check if any search engine is available
   * Always returns true because package search engines require no API key
   */
  hasAvailableEngines(): boolean {
    return true; // npm, PyPI, and crates.io search are always available
  }
}
