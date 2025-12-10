/**
 * Types for project analysis and initialization
 *
 * Tier 1: Basic project info (name, version, tech stack)
 * Tier 2: Quality metrics (test coverage, documentation)
 * Tier 3: Architecture analysis (dependency graph, complexity, hotspots) - DEFAULT
 * Tier 4: Security analysis (secrets, dangerous APIs) - OPTIONAL via settings
 */

// ═══════════════════════════════════════════════════════════════════════════
// TIER 1: Basic Project Info
// ═══════════════════════════════════════════════════════════════════════════

export interface ProjectInfo {
  /** Schema version for future compatibility */
  schemaVersion: '2.0';
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
    docs?: string;
    dist?: string;
  };
  /** Key files and their purposes */
  keyFiles: Record<string, string>;
  /** Detected code conventions */
  conventions: CodeConventions;
  /** Build and test scripts */
  scripts: ProjectScripts;
  /** Package manager (npm, yarn, pnpm, bun) */
  packageManager?: string;
  /** Last analysis timestamp */
  lastAnalyzed: string;
  /** CI/CD platform detected */
  cicdPlatform?: string;
  /** Important gotchas and tips */
  gotchas?: string[];
  /** Runtime targets */
  runtimeTargets?: string[];

  // ═══════════════════════════════════════════════════════════════════════
  // TIER 2: Quality Metrics
  // ═══════════════════════════════════════════════════════════════════════

  /** Code statistics */
  codeStats?: CodeStatistics;
  /** Test analysis */
  testing?: TestAnalysis;
  /** Documentation analysis */
  documentation?: DocumentationAnalysis;
  /** Technical debt indicators */
  technicalDebt?: TechnicalDebt;

  // ═══════════════════════════════════════════════════════════════════════
  // TIER 3: Architecture Analysis (DEFAULT)
  // ═══════════════════════════════════════════════════════════════════════

  /** Module dependency analysis */
  architecture?: ArchitectureAnalysis;

  // ═══════════════════════════════════════════════════════════════════════
  // TIER 4: Security Analysis (OPTIONAL - via settings)
  // ═══════════════════════════════════════════════════════════════════════

  /** Security analysis (optional, enabled in settings) */
  security?: SecurityAnalysis;
}

export interface ProjectScripts {
  build?: string;
  test?: string;
  lint?: string;
  dev?: string;
  typecheck?: string;
  /** All other scripts */
  custom?: Record<string, string>;
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

// ═══════════════════════════════════════════════════════════════════════════
// TIER 2: Quality Types
// ═══════════════════════════════════════════════════════════════════════════

export interface CodeStatistics {
  /** Total files by extension */
  filesByExtension: Record<string, number>;
  /** Total lines of code (excluding comments/blanks) */
  totalLinesOfCode: number;
  /** Total files */
  totalFiles: number;
  /** Large files (>500 lines) that may need refactoring */
  largeFiles: Array<{
    path: string;
    lines: number;
  }>;
  /** Average file size in lines */
  averageFileSize: number;
}

export interface TestAnalysis {
  /** Test framework detected */
  framework?: string;
  /** Test file patterns */
  patterns: string[];
  /** Modules with tests */
  modulesWithTests: string[];
  /** Modules missing tests */
  modulesMissingTests: string[];
  /** Test coverage percentage (if available) */
  coveragePercent?: number;
  /** Test types detected */
  testTypes: Array<'unit' | 'integration' | 'e2e' | 'snapshot'>;
  /** Total test file count */
  testFileCount: number;
}

export interface DocumentationAnalysis {
  /** JSDoc/TSDoc coverage percentage */
  jsdocCoverage: number;
  /** Files with JSDoc */
  filesWithDocs: number;
  /** Files without JSDoc */
  filesWithoutDocs: number;
  /** README exists and has content */
  hasReadme: boolean;
  /** README completeness score (0-100) */
  readmeScore?: number;
  /** Inline comment density (comments per 100 lines) */
  commentDensity: number;
  /** Related documentation files */
  docFiles: string[];
}

export interface TechnicalDebt {
  /** TODO comments with locations */
  todos: Array<{
    file: string;
    line: number;
    text: string;
  }>;
  /** FIXME comments with locations */
  fixmes: Array<{
    file: string;
    line: number;
    text: string;
  }>;
  /** Deprecated API usage */
  deprecatedUsage: Array<{
    file: string;
    api: string;
    suggestion?: string;
  }>;
  /** Total debt indicators count */
  totalCount: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// TIER 3: Architecture Types
// ═══════════════════════════════════════════════════════════════════════════

export interface ArchitectureAnalysis {
  /** Detected architecture pattern */
  pattern?: 'layered' | 'clean' | 'hexagonal' | 'mvc' | 'plugin-based' | 'monolith' | 'unknown';
  /** Module list with metadata */
  modules: ModuleInfo[];
  /** Dependency graph edges */
  dependencyGraph: DependencyEdge[];
  /** Circular dependencies detected */
  circularDependencies: string[][];
  /** High fan-in modules (many dependents) */
  highFanInModules: Array<{
    module: string;
    fanIn: number;
  }>;
  /** High fan-out modules (many dependencies) */
  highFanOutModules: Array<{
    module: string;
    fanOut: number;
  }>;
  /** Hotspot files (complex + high churn + low coverage) */
  hotspots: Array<{
    file: string;
    reason: string;
    score: number;
  }>;
  /** Layer definitions if detected */
  layers?: Array<{
    name: string;
    pattern: string;
    modules: string[];
  }>;
  /** Public API surface */
  publicApi: Array<{
    module: string;
    exports: string[];
    type: 'function' | 'class' | 'interface' | 'type' | 'const';
  }>;
  /** Entry points with their purposes */
  entryPoints: Array<{
    path: string;
    type: 'cli' | 'http' | 'worker' | 'script' | 'library';
    description?: string;
  }>;
  /** Extension points (plugins, hooks, providers) */
  extensionPoints?: Array<{
    kind: 'plugin' | 'provider' | 'hook' | 'command' | 'middleware';
    path: string;
    registration?: string;
  }>;
}

export interface ModuleInfo {
  /** Module path relative to source */
  path: string;
  /** Module type/category */
  kind: 'command' | 'component' | 'util' | 'service' | 'schema' | 'adapter' | 'domain' | 'config' | 'type' | 'test' | 'other';
  /** Exported symbols */
  exports: string[];
  /** Is this a public API module */
  isPublic: boolean;
  /** Lines of code */
  loc: number;
  /** Cyclomatic complexity (if calculable) */
  complexity?: number;
  /** Number of functions/methods */
  functionCount: number;
  /** Dependencies (imports) */
  dependencies: string[];
  /** Dependents (imported by) */
  dependents: string[];
}

export interface DependencyEdge {
  /** Source module */
  from: string;
  /** Target module */
  to: string;
  /** Import type */
  type: 'static' | 'dynamic' | 'type-only';
}

// ═══════════════════════════════════════════════════════════════════════════
// TIER 4: Security Types (Optional)
// ═══════════════════════════════════════════════════════════════════════════

export interface SecurityAnalysis {
  /** Environment variables used */
  envVarsUsed: Array<{
    name: string;
    files: string[];
    isSecret: boolean;
  }>;
  /** Sensitive files detected */
  sensitiveFiles: Array<{
    path: string;
    reason: string;
  }>;
  /** Dangerous API usage */
  dangerousApis: Array<{
    file: string;
    line: number;
    api: string;
    risk: 'low' | 'medium' | 'high';
    suggestion?: string;
  }>;
  /** Unvalidated inputs detected */
  unvalidatedInputs: Array<{
    file: string;
    location: string;
    inputType: string;
  }>;
  /** Hardcoded secrets (patterns detected) */
  potentialSecrets: Array<{
    file: string;
    line: number;
    pattern: string;
    confidence: 'low' | 'medium' | 'high';
  }>;
  /** Authentication patterns */
  authPatterns?: {
    jwtUsage: boolean;
    sessionUsage: boolean;
    authMiddleware: string[];
    unprotectedRoutes?: string[];
  };
  /** Crypto usage analysis */
  cryptoUsage?: Array<{
    file: string;
    algorithm: string;
    isSecure: boolean;
    suggestion?: string;
  }>;
}

// ═══════════════════════════════════════════════════════════════════════════
// Analysis Options and Results
// ═══════════════════════════════════════════════════════════════════════════

export interface InitOptions {
  /** Force regeneration even if files exist */
  force?: boolean;
  /** Output format for generated instructions */
  format?: 'markdown' | 'text';
  /** Verbose output */
  verbose?: boolean;
  /** Skip specific analysis steps */
  skip?: string[];
  /** Analysis depth (default: 3) */
  tier?: 1 | 2 | 3 | 4;
}

export interface AnalysisResult {
  success: boolean;
  projectInfo?: ProjectInfo;
  error?: string;
  warnings?: string[];
  /** Analysis duration in ms */
  duration?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// Legacy Support (for migration from old schema)
// ═══════════════════════════════════════════════════════════════════════════

export interface LegacyProjectInfo {
  projectName: string;
  version?: string;
  primaryLanguage: string;
  techStack: string[];
  projectType: string;
  entryPoint?: string;
  directories: {
    source?: string;
    tests?: string;
    config?: string;
    tools?: string;
  };
  keyFiles: string[];
  conventions: {
    moduleSystem?: string;
    importExtension?: string;
    testFramework?: string;
    validation?: string;
  };
  scripts: {
    build?: string;
    test?: string;
    lint?: string;
    dev?: string;
  };
  packageManager?: string;
  lastAnalyzed: string;
}

/** Check if index is legacy format */
export function isLegacyIndex(index: unknown): index is LegacyProjectInfo {
  return typeof index === 'object' && index !== null &&
    'projectName' in index && !('schemaVersion' in index);
}

/** Migrate legacy index to new format */
export function migrateLegacyIndex(legacy: LegacyProjectInfo): ProjectInfo {
  return {
    schemaVersion: '2.0',
    name: legacy.projectName,
    version: legacy.version,
    primaryLanguage: legacy.primaryLanguage,
    techStack: legacy.techStack,
    projectType: legacy.projectType,
    entryPoint: legacy.entryPoint,
    directories: legacy.directories,
    keyFiles: legacy.keyFiles.reduce((acc, file) => {
      acc[file] = 'Key project file';
      return acc;
    }, {} as Record<string, string>),
    conventions: legacy.conventions,
    scripts: legacy.scripts,
    packageManager: legacy.packageManager,
    lastAnalyzed: legacy.lastAnalyzed,
  };
}
