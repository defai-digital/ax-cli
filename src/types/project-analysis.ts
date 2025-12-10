/**
 * Types for project analysis and initialization
 */

export interface ProjectInfo {
  /** Project name from package.json or directory name */
  name: string;
  /** Project version */
  version?: string;
  /** Project description from README or package.json */
  description?: string;
  /** Primary programming language */
  primaryLanguage: string;
  /** Detected tech stack */
  techStack: string[];
  /** Project type (e.g., 'cli', 'web-app', 'library', 'api') */
  projectType: string;
  /** Main entry point file */
  entryPoint?: string;
  /** Key directories */
  directories: {
    source?: string;
    tests?: string;
    config?: string;
    tools?: string;
  };
  /** Key files and their purposes */
  keyFiles: Record<string, string>;
  /** Detected code conventions */
  conventions: CodeConventions;
  /** Build and test scripts */
  scripts: {
    build?: string;
    test?: string;
    lint?: string;
    dev?: string;
  };
  /** Package manager (npm, yarn, pnpm, bun) */
  packageManager?: string;
  /** Last analysis timestamp */
  lastAnalyzed: string;
  /** CI/CD platform detected */
  cicdPlatform?: string;
  /** Important gotchas and tips */
  gotchas?: string[];
}

export interface CodeConventions {
  /** Module system (commonjs, esm) */
  moduleSystem?: string;
  /** Import file extension requirement */
  importExtension?: string;
  /** Testing framework */
  testFramework?: string;
  /** Linting tool */
  linter?: string;
  /** Type checking */
  typeChecker?: string;
  /** Validation library */
  validation?: string;
  /** Code style preferences */
  style?: {
    semicolons?: boolean;
    quotes?: 'single' | 'double';
    indentation?: 'tabs' | 'spaces';
    indentSize?: number;
  };
}

export interface InitOptions {
  /** Force regeneration even if files exist */
  force?: boolean;
  /** Output format for generated instructions */
  format?: 'markdown' | 'text';
  /** Verbose output */
  verbose?: boolean;
  /** Skip specific analysis steps */
  skip?: string[];
}

export interface AnalysisResult {
  success: boolean;
  projectInfo?: ProjectInfo;
  error?: string;
  warnings?: string[];
  /** Analysis duration in milliseconds */
  duration?: number;
}
