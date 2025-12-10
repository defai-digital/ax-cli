# Analyzers API Documentation
Last reviewed: 2025-02-21  
Status: Legacy/archived — the analyzers API surface is not shipped in current v4.4.x builds; keep for historical reference only.

This document provides detailed API documentation for programmatic usage of the AX CLI analyzers.

---

## Table of Contents

1. [Installation](#installation)
2. [Dependency Analyzer](#dependency-analyzer)
3. [Code Smell Analyzer](#code-smell-analyzer)
4. [Git Analyzer](#git-analyzer)
5. [Metrics Analyzer](#metrics-analyzer)
6. [Security Analyzer](#security-analyzer)
7. [Type Definitions](#type-definitions)

---

## Installation

```bash
npm install @defai.digital/ax-cli
```

```typescript
import {
  DependencyAnalyzer,
  CodeSmellAnalyzer,
  GitAnalyzer,
  MetricsAnalyzer,
  SecurityAnalyzer,
} from '@defai.digital/ax-cli/analyzers';
```

---

## Dependency Analyzer

Analyzes code dependencies, detects circular dependencies, and calculates coupling metrics.

### API

```typescript
class DependencyAnalyzer {
  constructor();

  analyzeDependencies(
    directory: string,
    pattern?: string,
    options?: DependencyAnalysisOptions
  ): Promise<DependencyAnalysisResult>;
}
```

### Options

```typescript
interface DependencyAnalysisOptions {
  readonly includeNodeModules?: boolean;   // Include node_modules in analysis
  readonly maxDepth?: number;              // Maximum dependency depth
  readonly ignorePatterns?: readonly string[]; // Patterns to ignore
}
```

### Result

```typescript
interface DependencyAnalysisResult {
  readonly graph: DependencyGraph;
  readonly circularDependencies: ReadonlyArray<CircularDependency>;
  readonly couplingMetrics: ReadonlyArray<CouplingMetrics>;
  readonly orphanedFiles: ReadonlyArray<string>;
  readonly hubFiles: ReadonlyArray<string>;
  readonly summary: DependencySummary;
  readonly timestamp: Date;
}

interface CircularDependency {
  readonly cycle: ReadonlyArray<string>;
  readonly length: number;
  readonly severity: 'critical' | 'high' | 'medium' | 'low';
  readonly impact: number;  // 0-100
  readonly description: string;
}

interface CouplingMetrics {
  readonly file: string;
  readonly afferentCoupling: number;  // Ca
  readonly efferentCoupling: number;  // Ce
  readonly instability: number;       // I = Ce / (Ce + Ca)
  readonly abstractness: number;      // A = abstract/total
  readonly distanceFromMainSequence: number; // D = |A + I - 1|
  readonly zone: 'useless' | 'painful' | 'balanced';
}
```

### Example Usage

```typescript
import { DependencyAnalyzer } from '@defai.digital/ax-cli/analyzers';

const analyzer = new DependencyAnalyzer();

const result = await analyzer.analyzeDependencies('./src', '**/*.ts', {
  includeNodeModules: false,
  ignorePatterns: ['**/*.test.ts', '**/*.spec.ts'],
});

console.log(`Health Score: ${result.summary.healthScore}/100`);
console.log(`Circular Dependencies: ${result.circularDependencies.length}`);

for (const cycle of result.circularDependencies) {
  console.log(`${cycle.severity}: ${cycle.cycle.join(' → ')}`);
}
```

---

## Code Smell Analyzer

Detects code smells and anti-patterns using AST analysis.

### API

```typescript
class CodeSmellAnalyzer {
  constructor();

  analyze(
    directory: string,
    pattern?: string,
    options?: CodeSmellAnalysisOptions
  ): Promise<CodeSmellAnalysisResult>;
}
```

### Options

```typescript
interface CodeSmellAnalysisOptions {
  readonly detectorConfigs?: Readonly<Record<SmellType, DetectorConfig>>;
  readonly ignorePatterns?: readonly string[];
}

interface DetectorConfig {
  readonly enabled: boolean;
  readonly thresholds?: Readonly<Record<string, number>>;
}

enum SmellType {
  LONG_METHOD = 'LONG_METHOD',
  LARGE_CLASS = 'LARGE_CLASS',
  LONG_PARAMETER_LIST = 'LONG_PARAMETER_LIST',
  DUPLICATE_CODE = 'DUPLICATE_CODE',
  DEAD_CODE = 'DEAD_CODE',
  MAGIC_NUMBERS = 'MAGIC_NUMBERS',
  NESTED_CONDITIONALS = 'NESTED_CONDITIONALS',
  FEATURE_ENVY = 'FEATURE_ENVY',
  DATA_CLUMPS = 'DATA_CLUMPS',
  INAPPROPRIATE_INTIMACY = 'INAPPROPRIATE_INTIMACY',
}
```

### Result

```typescript
interface CodeSmellAnalysisResult {
  readonly smells: ReadonlyArray<CodeSmell>;
  readonly summary: CodeSmellSummary;
  readonly timestamp: Date;
}

interface CodeSmell {
  readonly type: SmellType;
  readonly severity: SmellSeverity;
  readonly filePath: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly message: string;
  readonly suggestion: string;
  readonly metadata: Readonly<Record<string, unknown>>;
}

enum SmellSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}
```

### Example Usage

```typescript
import { CodeSmellAnalyzer, SmellType } from '@defai.digital/ax-cli/analyzers';

const analyzer = new CodeSmellAnalyzer();

const result = await analyzer.analyze('./src', '**/*.ts', {
  detectorConfigs: {
    [SmellType.LONG_METHOD]: {
      enabled: true,
      thresholds: { maxLines: 30 }, // Stricter than default
    },
    [SmellType.DEAD_CODE]: {
      enabled: false, // Disable dead code detection
    },
  },
});

const criticalSmells = result.smells.filter(s => s.severity === 'CRITICAL');
console.log(`Critical smells found: ${criticalSmells.length}`);
console.log(`Code Health Score: ${result.summary.codeHealthScore}/100`);
```

---

## Git Analyzer

Analyzes git history to identify code hotspots.

### API

```typescript
class GitAnalyzer {
  constructor(directory: string);

  analyze(options?: GitAnalysisOptions): Promise<GitAnalysisResult>;
}
```

### Options

```typescript
interface GitAnalysisOptions {
  readonly since?: string;          // e.g., '3 months ago'
  readonly until?: string;
  readonly includePatterns?: string[];
  readonly excludePatterns?: string[];
  readonly hotspotThreshold?: number; // Minimum score to be considered hotspot
}
```

### Result

```typescript
interface GitAnalysisResult {
  readonly hotspots: ReadonlyArray<CodeHotspot>;
  readonly summary: GitAnalysisSummary;
  readonly timestamp: Date;
}

interface CodeHotspot {
  readonly filePath: string;
  readonly commitCount: number;
  readonly churnScore: number;
  readonly maxComplexity: number;
  readonly hotspotScore: number;  // 0-100
  readonly severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  readonly reason: string;
  readonly recommendation: string;
}
```

### Example Usage

```typescript
import { GitAnalyzer } from '@defai.digital/ax-cli/analyzers';

const analyzer = new GitAnalyzer('./');

const result = await analyzer.analyze({
  since: '6 months ago',
  excludePatterns: ['**/*.test.ts'],
  hotspotThreshold: 50,
});

const criticalHotspots = result.hotspots.filter(h => h.severity === 'CRITICAL');

for (const hotspot of criticalHotspots) {
  console.log(`${hotspot.filePath}: ${hotspot.hotspotScore}/100`);
  console.log(`  ${hotspot.reason}`);
  console.log(`  ${hotspot.recommendation}`);
}
```

---

## Metrics Analyzer

Calculates code complexity and maintainability metrics.

### API

```typescript
class MetricsAnalyzer {
  constructor();

  analyze(
    directory: string,
    pattern?: string,
    options?: MetricsAnalysisOptions
  ): Promise<MetricsAnalysisResult>;
}
```

### Options

```typescript
interface MetricsAnalysisOptions {
  readonly ignorePatterns?: readonly string[];
  readonly includeTests?: boolean;
}
```

### Result

```typescript
interface MetricsAnalysisResult {
  readonly fileMetrics: ReadonlyArray<FileMetrics>;
  readonly summary: MetricsSummary;
  readonly timestamp: Date;
}

interface FileMetrics {
  readonly filePath: string;
  readonly loc: number;  // Lines of code
  readonly complexity: ComplexityMetrics;
  readonly halstead: HalsteadMetrics;
  readonly maintainability: MaintainabilityIndex;
}

interface ComplexityMetrics {
  readonly cyclomaticComplexity: number;
  readonly cognitiveComplexity: number;
  readonly maxNestingDepth: number;
}

interface HalsteadMetrics {
  readonly volume: number;
  readonly difficulty: number;
  readonly effort: number;
  readonly vocabulary: number;
  readonly length: number;
}

interface MaintainabilityIndex {
  readonly score: number;  // 0-100
  readonly rating: 'A' | 'B' | 'C' | 'D' | 'F';
  readonly halsteadVolume: number;
  readonly cyclomaticComplexity: number;
  readonly linesOfCode: number;
}
```

### Example Usage

```typescript
import { MetricsAnalyzer } from '@defai.digital/ax-cli/analyzers';

const analyzer = new MetricsAnalyzer();

const result = await analyzer.analyze('./src', '**/*.ts', {
  includeTests: false,
});

const poorMaintainability = result.fileMetrics.filter(
  m => m.maintainability.rating === 'D' || m.maintainability.rating === 'F'
);

console.log(`Average Maintainability: ${result.summary.averageMaintainability}`);
console.log(`Files needing attention: ${poorMaintainability.length}`);
```

---

## Security Analyzer

Identifies potential security vulnerabilities using pattern detection.

### API

```typescript
class SecurityAnalyzer {
  constructor();

  analyze(
    directory: string,
    pattern?: string,
    options?: SecurityAnalysisOptions
  ): Promise<SecurityAnalysisResult>;
}
```

### Options

```typescript
interface SecurityAnalysisOptions {
  readonly ignorePatterns?: readonly string[];
  readonly severityThreshold?: SecuritySeverity;  // Only report >= threshold
}

enum SecuritySeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}
```

### Result

```typescript
interface SecurityAnalysisResult {
  readonly vulnerabilities: ReadonlyArray<SecurityVulnerability>;
  readonly summary: SecuritySummary;
  readonly timestamp: Date;
}

interface SecurityVulnerability {
  readonly type: VulnerabilityType;
  readonly severity: SecuritySeverity;
  readonly filePath: string;
  readonly lineNumber: number;
  readonly code: string;
  readonly message: string;
  readonly recommendation: string;
  readonly cweId?: string;  // Common Weakness Enumeration ID
}

enum VulnerabilityType {
  SQL_INJECTION = 'SQL_INJECTION',
  XSS = 'XSS',
  PATH_TRAVERSAL = 'PATH_TRAVERSAL',
  COMMAND_INJECTION = 'COMMAND_INJECTION',
  HARDCODED_SECRET = 'HARDCODED_SECRET',
  INSECURE_RANDOM = 'INSECURE_RANDOM',
  PROTOTYPE_POLLUTION = 'PROTOTYPE_POLLUTION',
  EVAL_USAGE = 'EVAL_USAGE',
}
```

### Example Usage

```typescript
import { SecurityAnalyzer, SecuritySeverity } from '@defai.digital/ax-cli/analyzers';

const analyzer = new SecurityAnalyzer();

const result = await analyzer.analyze('./src', '**/*.ts', {
  severityThreshold: SecuritySeverity.MEDIUM,
});

const criticalVulns = result.vulnerabilities.filter(
  v => v.severity === SecuritySeverity.CRITICAL
);

for (const vuln of criticalVulns) {
  console.log(`${vuln.type} in ${vuln.filePath}:${vuln.lineNumber}`);
  console.log(`  ${vuln.message}`);
  console.log(`  Fix: ${vuln.recommendation}`);
}
```

---

## Type Definitions

### Complete Type Exports

```typescript
// Dependency types
export type {
  DependencyAnalysisOptions,
  DependencyAnalysisResult,
  DependencyNode,
  CircularDependency,
  CouplingMetrics,
  DependencySummary,
} from './analyzers/dependency/types.js';

// Code smell types
export type {
  CodeSmellAnalysisOptions,
  CodeSmellAnalysisResult,
  CodeSmell,
  CodeSmellSummary,
  DetectorConfig,
} from './analyzers/code-smells/types.js';
export { SmellType, SmellSeverity } from './analyzers/code-smells/types.js';

// Git analysis types
export type {
  GitAnalysisOptions,
  GitAnalysisResult,
  CodeHotspot,
  GitAnalysisSummary,
} from './analyzers/git/types.js';

// Metrics types
export type {
  MetricsAnalysisOptions,
  MetricsAnalysisResult,
  FileMetrics,
  ComplexityMetrics,
  HalsteadMetrics,
  MaintainabilityIndex,
} from './analyzers/metrics/types.js';

// Security types
export type {
  SecurityAnalysisOptions,
  SecurityAnalysisResult,
  SecurityVulnerability,
  SecuritySummary,
} from './analyzers/security/types.js';
export { VulnerabilityType, SecuritySeverity } from './analyzers/security/types.js';
```

---

## Error Handling

All analyzers may throw errors. Always wrap in try-catch:

```typescript
try {
  const result = await analyzer.analyze('./src');
  // Process result
} catch (error) {
  if (error instanceof Error) {
    console.error(`Analysis failed: ${error.message}`);
  }
}
```

Common errors:
- Directory not found
- Invalid file patterns
- Git repository not found (Git Analyzer)
- Parse errors (invalid TypeScript/JavaScript)

---

## Performance Considerations

- **Large Codebases**: Analysis may take time (30s - 2min for 1000+ files)
- **Caching**: AST parser caches are cleared after each file to prevent memory leaks
- **Parallel Processing**: Analyzers process files sequentially (future: parallel)
- **Filtering**: Use `ignorePatterns` to exclude unnecessary files

### Optimization Tips

```typescript
// Good: Focused analysis
await analyzer.analyze('./src/feature', '**/*.ts', {
  ignorePatterns: ['**/*.test.ts', '**/*.spec.ts'],
});

// Avoid: Analyzing entire node_modules
await analyzer.analyze('./', '**/*.{ts,js}');  // Too broad!
```

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Code Quality

on: [push, pull_request]

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2

      - name: Install AX CLI
        run: npm install -g @defai.digital/ax-cli

      - name: Run Analysis
        run: |
          ax --prompt "analyze dependencies in src/"
          ax --prompt "detect code smells"
          ax --prompt "analyze security"
```

---

## TypeScript Configuration

For optimal results, ensure your `tsconfig.json` includes:

```json
{
  "compilerOptions": {
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "moduleResolution": "bundler"
  },
  "include": ["src/**/*"]
}
```

---

## Further Reading

- [Code Analysis Tools Guide](../analysis-tools.md)
- [Examples](../../examples/)
- [Source Code](../../src/analyzers/)
