/**
 * Git Churn Calculator
 *
 * Calculates file churn metrics from git history
 */

import { spawnSync } from 'child_process';
import type { FileChurn, GitAnalysisOptions, ContributorStats } from './types.js';

export class ChurnCalculator {
  private repositoryPath: string;

  constructor(repositoryPath: string) {
    this.repositoryPath = repositoryPath;
  }

  /**
   * Calculate churn for all files
   */
  async calculateChurn(options: GitAnalysisOptions = {}): Promise<FileChurn[]> {
    const gitLogOutput = this.getGitLog(options);
    const fileChurnMap = new Map<string, {
      commits: number;
      additions: number;
      deletions: number;
      lastModified: Date;
      authors: Set<string>;
    }>();

    // Parse git log output
    const commits = this.parseGitLog(gitLogOutput);

    for (const commit of commits) {
      for (const file of commit.files) {
        if (!this.shouldIncludeFile(file.path, options)) continue;

        if (!fileChurnMap.has(file.path)) {
          fileChurnMap.set(file.path, {
            commits: 0,
            additions: 0,
            deletions: 0,
            lastModified: commit.date,
            authors: new Set(),
          });
        }

        const churn = fileChurnMap.get(file.path);
        if (!churn) continue; // Safety guard
        churn.commits++;
        churn.additions += file.additions;
        churn.deletions += file.deletions;
        churn.authors.add(commit.author);

        // Update last modified date
        if (commit.date > churn.lastModified) {
          churn.lastModified = commit.date;
        }
      }
    }

    // Convert to FileChurn array
    const result: FileChurn[] = [];
    for (const [filePath, data] of fileChurnMap.entries()) {
      result.push(
        Object.freeze({
          filePath,
          commitCount: data.commits,
          additions: data.additions,
          deletions: data.deletions,
          totalChurn: data.additions + data.deletions,
          lastModified: data.lastModified,
          authors: Object.freeze(Array.from(data.authors)),
        })
      );
    }

    // Sort by total churn (descending)
    return result.sort((a, b) => b.totalChurn - a.totalChurn);
  }

  /**
   * Calculate contributor statistics
   */
  async calculateContributorStats(options: GitAnalysisOptions = {}): Promise<ContributorStats[]> {
    const gitLogOutput = this.getGitLog(options);
    const commits = this.parseGitLog(gitLogOutput);

    const contributorMap = new Map<string, {
      commits: number;
      files: Set<string>;
      added: number;
      deleted: number;
      firstCommit: Date;
      lastCommit: Date;
    }>();

    for (const commit of commits) {
      if (!contributorMap.has(commit.author)) {
        contributorMap.set(commit.author, {
          commits: 0,
          files: new Set(),
          added: 0,
          deleted: 0,
          firstCommit: commit.date,
          lastCommit: commit.date,
        });
      }

      const stats = contributorMap.get(commit.author);
      if (!stats) continue; // Safety guard
      stats.commits++;

      for (const file of commit.files) {
        if (this.shouldIncludeFile(file.path, options)) {
          stats.files.add(file.path);
          stats.added += file.additions;
          stats.deleted += file.deletions;
        }
      }

      // Update date range
      if (commit.date < stats.firstCommit) {
        stats.firstCommit = commit.date;
      }
      if (commit.date > stats.lastCommit) {
        stats.lastCommit = commit.date;
      }
    }

    // Convert to ContributorStats array
    const result: ContributorStats[] = [];
    for (const [author, data] of contributorMap.entries()) {
      result.push(
        Object.freeze({
          author,
          commitCount: data.commits,
          filesChanged: data.files.size,
          linesAdded: data.added,
          linesDeleted: data.deleted,
          firstCommit: data.firstCommit,
          lastCommit: data.lastCommit,
        })
      );
    }

    // Sort by commit count (descending)
    return result.sort((a, b) => b.commitCount - a.commitCount);
  }

  /**
   * Get git log with file stats
   * SECURITY FIX: Prevent command injection by validating inputs and using array-based execution
   */
  private getGitLog(options: GitAnalysisOptions): string {
    const args = ['log', '--numstat', '--pretty=format:%H|%an|%ad|%s'];

    // SECURITY FIX: Validate and sanitize inputs to prevent command injection
    if (options.since) {
      // Validate date format: only allow alphanumeric, spaces, hyphens, colons, and slashes
      if (!/^[\w\s\-:\/]+$/.test(options.since)) {
        throw new Error(`Invalid since parameter: contains unsafe characters`);
      }
      args.push('--since', options.since); // Pass as separate argument to prevent injection
    }

    if (options.until) {
      // Validate date format
      if (!/^[\w\s\-:\/]+$/.test(options.until)) {
        throw new Error(`Invalid until parameter: contains unsafe characters`);
      }
      args.push('--until', options.until);
    }

    if (options.branch) {
      // Validate branch name: only allow alphanumeric, hyphens, slashes, underscores, and dots
      if (!/^[\w\-\/\.]+$/.test(options.branch)) {
        throw new Error(`Invalid branch name: contains unsafe characters`);
      }
      args.push(options.branch);
    }

    try {
      // SECURITY FIX: Use spawnSync with array args instead of string interpolation
      // This prevents shell injection by not invoking a shell
      const result = spawnSync('git', args, {
        cwd: this.repositoryPath,
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        stdio: ['pipe', 'pipe', 'ignore'], // Ignore stderr to suppress warnings
      });

      if (result.error) {
        return '';
      }

      return result.stdout || '';
    } catch {
      // If git command fails, return empty string
      return '';
    }
  }

  /**
   * Parse git log output
   */
  private parseGitLog(output: string): Array<{
    hash: string;
    author: string;
    date: Date;
    message: string;
    files: Array<{ path: string; additions: number; deletions: number }>;
  }> {
    const commits: Array<{
      hash: string;
      author: string;
      date: Date;
      message: string;
      files: Array<{ path: string; additions: number; deletions: number }>;
    }> = [];

    const lines = output.split('\n');
    let currentCommit: any = null;

    for (const line of lines) {
      if (!line.trim()) continue;

      // Commit line: hash|author|date|message
      if (line.includes('|')) {
        const parts = line.split('|');
        if (parts.length >= 4) {
          // Save previous commit
          if (currentCommit) {
            commits.push(currentCommit);
          }

          // Start new commit
          // BUG FIX: Validate date to avoid Invalid Date objects
          const parsedDate = new Date(parts[2]);
          const validDate = isNaN(parsedDate.getTime()) ? new Date() : parsedDate;

          currentCommit = {
            hash: parts[0],
            author: parts[1],
            date: validDate,
            message: parts[3],
            files: [],
          };
        }
      } else if (currentCommit) {
        // File stat line: additions deletions filename
        const parts = line.split('\t');
        if (parts.length >= 3) {
          // BUG FIX: Handle NaN from parseInt - use || 0 to default to 0
          const additions = parts[0] === '-' ? 0 : (parseInt(parts[0], 10) || 0);
          const deletions = parts[1] === '-' ? 0 : (parseInt(parts[1], 10) || 0);
          const path = parts[2];

          currentCommit.files.push({ path, additions, deletions });
        }
      }
    }

    // Add last commit
    if (currentCommit) {
      commits.push(currentCommit);
    }

    return commits;
  }

  /**
   * Check if file should be included based on patterns
   */
  private shouldIncludeFile(filePath: string, options: GitAnalysisOptions): boolean {
    // Check exclude patterns
    if (options.excludePatterns) {
      for (const pattern of options.excludePatterns) {
        if (this.matchPattern(filePath, pattern)) {
          return false;
        }
      }
    }

    // Check include patterns
    if (options.includePatterns && options.includePatterns.length > 0) {
      for (const pattern of options.includePatterns) {
        if (this.matchPattern(filePath, pattern)) {
          return true;
        }
      }
      return false;
    }

    return true;
  }

  /**
   * Simple pattern matching (supports * wildcard)
   * SECURITY FIX: Prevent ReDoS by using non-greedy matching and proper escaping
   */
  private matchPattern(filePath: string, pattern: string): boolean {
    // CRITICAL FIX: Escape special regex characters EXCEPT * to prevent injection
    // Must escape: . + ? ^ $ { } ( ) | [ ] \
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');

    // CRITICAL FIX: Replace * with [^/]* (non-greedy, doesn't cross directories)
    // This prevents catastrophic backtracking from nested wildcards like "a*b*c*d*"
    // Old: .* (greedy, can cause ReDoS)
    // New: [^/]* (matches anything except /, prevents exponential backtracking)
    const regexPattern = '^' + escaped.replace(/\*/g, '[^/]*') + '$';

    try {
      const regex = new RegExp(regexPattern);
      return regex.test(filePath);
    } catch {
      // If regex construction fails, return false
      return false;
    }
  }
}
