import { spawn } from "child_process";
import { ToolResult } from "../types/index.js";
import fs from "fs-extra";
import path from "path";

export interface SearchResult {
  file: string;
  line: number;
  column: number;
  text: string;
  match: string;
}

export interface FileSearchResult {
  path: string;
  name: string;
  score: number;
}

export interface UnifiedSearchResult {
  type: "text" | "file";
  file: string;
  line?: number;
  column?: number;
  text?: string;
  match?: string;
  score?: number;
}

export class SearchTool {
  private static readonly DEFAULT_MAX_RESULTS = 50;
  private static readonly MAX_RECURSION_DEPTH = 10;
  private static readonly MAX_DISPLAY_RESULTS = 8;
  private static readonly SCORE_EXACT_MATCH = 100;
  private static readonly SCORE_CONTAINS_MATCH = 80;
  private static readonly SCORE_PATH_MATCH = 60;
  private static readonly SCORE_FUZZY_BASE = 40;
  private static readonly SCORE_FUZZY_MIN = 10;
  private static readonly SKIP_DIRECTORIES = [
    "node_modules",
    ".git",
    ".svn",
    ".hg",
    "dist",
    "build",
    ".next",
    ".cache",
  ];

  private currentDirectory: string = process.cwd();

  /**
   * Unified search method that can search for text content or find files
   */
  async search(
    query: string,
    options: {
      searchType?: "text" | "files" | "both";
      includePattern?: string;
      excludePattern?: string;
      caseSensitive?: boolean;
      wholeWord?: boolean;
      regex?: boolean;
      maxResults?: number;
      fileTypes?: string[];
      excludeFiles?: string[];
      includeHidden?: boolean;
    } = {}
  ): Promise<ToolResult> {
    try {
      const searchType = options.searchType || "both";
      const results: UnifiedSearchResult[] = [];

      // Search for text content if requested
      if (searchType === "text" || searchType === "both") {
        const textResults = await this.executeRipgrep(query, options);
        results.push(
          ...textResults.map((r) => ({
            type: "text" as const,
            file: r.file,
            line: r.line,
            column: r.column,
            text: r.text,
            match: r.match,
          }))
        );
      }

      // Search for files if requested
      if (searchType === "files" || searchType === "both") {
        const fileResults = await this.findFilesByPattern(query, options);
        results.push(
          ...fileResults.map((r) => ({
            type: "file" as const,
            file: r.path,
            score: r.score,
          }))
        );
      }

      if (results.length === 0) {
        return {
          success: true,
          output: `No results found for "${query}"`,
        };
      }

      const formattedOutput = this.formatUnifiedResults(
        results,
        query,
        searchType
      );

      return {
        success: true,
        output: formattedOutput,
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Search error: ${error.message}`,
      };
    }
  }

  /**
   * Execute ripgrep command with specified options
   */
  private async executeRipgrep(
    query: string,
    options: {
      includePattern?: string;
      excludePattern?: string;
      caseSensitive?: boolean;
      wholeWord?: boolean;
      regex?: boolean;
      maxResults?: number;
      fileTypes?: string[];
      excludeFiles?: string[];
    }
  ): Promise<SearchResult[]> {
    return new Promise((resolve, reject) => {
      const args = [
        "--json",
        "--with-filename",
        "--line-number",
        "--column",
        "--no-heading",
        "--color=never",
      ];

      // Add case sensitivity
      if (!options.caseSensitive) {
        args.push("--ignore-case");
      }

      // Add whole word matching
      if (options.wholeWord) {
        args.push("--word-regexp");
      }

      // Add regex mode
      if (!options.regex) {
        args.push("--fixed-strings");
      }

      // Add max results limit
      if (options.maxResults !== undefined) {
        // Validate maxResults is a positive integer
        if (!Number.isInteger(options.maxResults) || options.maxResults < 1) {
          reject(new Error(`maxResults must be a positive integer, got: ${options.maxResults}`));
          return;
        }
        args.push("--max-count", options.maxResults.toString());
      }

      // Add file type filters
      if (options.fileTypes) {
        options.fileTypes.forEach((type) => {
          args.push("--type", type);
        });
      }

      // Add include pattern
      if (options.includePattern) {
        args.push("--glob", options.includePattern);
      }

      // Add exclude pattern
      if (options.excludePattern) {
        args.push("--glob", `!${options.excludePattern}`);
      }

      // Add exclude files
      if (options.excludeFiles) {
        options.excludeFiles.forEach((file) => {
          args.push("--glob", `!${file}`);
        });
      }

      // Respect gitignore and common ignore patterns
      args.push(
        "--no-require-git",
        "--follow",
        "--glob",
        "!.git/**",
        "--glob",
        "!node_modules/**",
        "--glob",
        "!.DS_Store",
        "--glob",
        "!*.log"
      );

      // Add query and search directory
      args.push(query, this.currentDirectory);

      const rg = spawn("rg", args);
      let output = "";
      let errorOutput = "";
      let isResolved = false;

      rg.stdout.on("data", (data) => {
        output += data.toString();
      });

      rg.stderr.on("data", (data) => {
        errorOutput += data.toString();
      });

      rg.on("close", (code) => {
        if (isResolved) return;
        isResolved = true;

        if (code === 0 || code === 1) {
          // 0 = found, 1 = not found
          const results = this.parseRipgrepOutput(output);
          resolve(results);
        } else {
          reject(new Error(`Ripgrep failed with code ${code}: ${errorOutput}`));
        }
      });

      rg.on("error", (error) => {
        if (isResolved) return;
        isResolved = true;

        // Kill process if it's still running
        // Wrap in try-catch as process might already be dead
        if (!rg.killed) {
          try {
            rg.kill('SIGTERM');
          } catch {
            // Process already terminated, ignore
          }
        }
        reject(error);
      });
    });
  }

  /**
   * Type guard for ripgrep match data with proper type narrowing
   */
  private isRipgrepMatch(parsed: unknown): parsed is {
    type: 'match';
    data: {
      path: { text: string };
      line_number: number;
      lines: { text: string };
      submatches?: Array<{
        start: number;
        match: { text: string };
      }>;
    };
  } {
    if (typeof parsed !== 'object' || parsed === null) return false;
    const obj = parsed as any;

    return (
      obj.type === 'match' &&
      typeof obj.data?.path?.text === 'string' &&
      typeof obj.data?.line_number === 'number' &&
      typeof obj.data?.lines?.text === 'string'
    );
  }

  /**
   * Parse ripgrep JSON output into SearchResult objects with full type safety
   */
  private parseRipgrepOutput(output: string): SearchResult[] {
    if (!output.trim()) return [];

    const results: SearchResult[] = [];
    const lines = output.trim().split("\n");

    for (const line of lines) {
      try {
        const parsed: unknown = JSON.parse(line);
        if (this.isRipgrepMatch(parsed)) {
          // TypeScript now knows parsed has the correct structure
          results.push({
            file: parsed.data.path.text,
            line: parsed.data.line_number,
            column: parsed.data.submatches?.[0]?.start ?? 0,
            text: parsed.data.lines.text.trim(),
            match: parsed.data.submatches?.[0]?.match?.text ?? '',
          });
        }
      } catch {
        // Skip invalid JSON lines
        continue;
      }
    }

    return results;
  }

  /**
   * Find files by pattern using a simple file walking approach
   */
  private async findFilesByPattern(
    pattern: string,
    options: {
      maxResults?: number;
      includeHidden?: boolean;
      excludePattern?: string;
    }
  ): Promise<FileSearchResult[]> {
    const files: FileSearchResult[] = [];
    const maxResults = options.maxResults || SearchTool.DEFAULT_MAX_RESULTS;
    const searchPattern = pattern.toLowerCase(); // Cache once for all comparisons

    const walkDir = async (dir: string, depth: number = 0): Promise<void> => {
      if (depth > SearchTool.MAX_RECURSION_DEPTH || files.length >= maxResults) return;

      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          if (files.length >= maxResults) break;

          const fullPath = path.join(dir, entry.name);
          const relativePath = path.relative(this.currentDirectory, fullPath);

          // Skip hidden files unless explicitly included
          if (!options.includeHidden && entry.name.startsWith(".")) {
            continue;
          }

          // Skip common directories
          if (entry.isDirectory() && SearchTool.SKIP_DIRECTORIES.includes(entry.name)) {
            continue;
          }

          // Apply exclude pattern
          if (
            options.excludePattern &&
            relativePath.includes(options.excludePattern)
          ) {
            continue;
          }

          if (entry.isFile()) {
            const score = this.calculateFileScore(
              entry.name,
              relativePath,
              searchPattern
            );
            if (score > 0) {
              files.push({
                path: relativePath,
                name: entry.name,
                score,
              });
            }
          } else if (entry.isDirectory()) {
            await walkDir(fullPath, depth + 1);
          }
        }
      } catch {
        // Skip directories we can't read
      }
    };

    await walkDir(this.currentDirectory);

    // Sort by score (descending) and return top results
    return files.sort((a, b) => b.score - a.score).slice(0, maxResults);
  }

  /**
   * Calculate fuzzy match score for file names
   */
  private calculateFileScore(
    fileName: string,
    filePath: string,
    pattern: string
  ): number {
    const lowerFileName = fileName.toLowerCase();
    const lowerFilePath = filePath.toLowerCase();

    // Exact matches get highest score
    if (lowerFileName === pattern) return SearchTool.SCORE_EXACT_MATCH;
    if (lowerFileName.includes(pattern)) return SearchTool.SCORE_CONTAINS_MATCH;
    if (lowerFilePath.includes(pattern)) return SearchTool.SCORE_PATH_MATCH;

    // Fuzzy matching - check if all characters of pattern exist in order
    return this.calculateFuzzyScore(lowerFileName, pattern, fileName.length);
  }

  /**
   * Calculate fuzzy match score for character sequence matching
   */
  private calculateFuzzyScore(text: string, pattern: string, originalLength: number): number {
    let patternIndex = 0;

    for (let i = 0; i < text.length && patternIndex < pattern.length; i++) {
      if (text[i] === pattern[patternIndex]) {
        patternIndex++;
      }
    }

    // All characters found in order - score based on how close they are
    return patternIndex === pattern.length
      ? Math.max(SearchTool.SCORE_FUZZY_MIN, SearchTool.SCORE_FUZZY_BASE - (originalLength - pattern.length))
      : 0;
  }

  /**
   * Format unified search results for display
   */
  private formatUnifiedResults(
    results: UnifiedSearchResult[],
    query: string,
    _searchType: string
  ): string {
    if (results.length === 0) {
      return `No results found for "${query}"`;
    }

    let output = `Search results for "${query}":\n`;

    // Separate text and file results
    const textResults = results.filter((r) => r.type === "text");
    const fileResults = results.filter((r) => r.type === "file");

    // Show all unique files (from both text matches and file matches)
    const allFiles = new Set<string>();

    // Add files from text results
    textResults.forEach((result) => {
      allFiles.add(result.file);
    });

    // Add files from file search results
    fileResults.forEach((result) => {
      allFiles.add(result.file);
    });

    const fileList = Array.from(allFiles);
    const displayLimit = SearchTool.MAX_DISPLAY_RESULTS;

    // Show files in compact format
    fileList.slice(0, displayLimit).forEach((file) => {
      // Count matches in this file for text results
      const matchCount = textResults.filter((r) => r.file === file).length;
      const matchIndicator = matchCount > 0 ? ` (${matchCount} matches)` : "";
      output += `  ${file}${matchIndicator}\n`;
    });

    // Show "+X more" if there are additional results
    if (fileList.length > displayLimit) {
      const remaining = fileList.length - displayLimit;
      output += `  ... +${remaining} more\n`;
    }

    return output.trim();
  }

  /**
   * Update current working directory
   */
  setCurrentDirectory(directory: string): void {
    this.currentDirectory = directory;
  }

  /**
   * Get current working directory
   */
  getCurrentDirectory(): string {
    return this.currentDirectory;
  }
}
