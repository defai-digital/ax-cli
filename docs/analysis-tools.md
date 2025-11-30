# Code Analysis Tools Guide

AX CLI provides five powerful code analysis tools that can be invoked by the LLM agent to analyze your codebase and provide actionable insights.

---

## Overview

The analysis tools provide comprehensive insights into:
- **Dependencies** - Understand code structure and coupling
- **Code Smells** - Detect anti-patterns and quality issues
- **Hotspots** - Find frequently changing, complex code
- **Metrics** - Measure complexity and maintainability
- **Security** - Identify potential vulnerabilities

---

## 1. Dependency Analysis (`analyze_dependencies`)

**Purpose**: Analyzes code dependencies, detects circular dependencies, identifies orphan and hub files.

**When to Use**:
- Understanding codebase architecture
- Planning refactoring efforts
- Detecting tightly coupled modules
- Finding unused code (orphan files)
- Identifying critical dependencies (hub files)

**Example Usage**:
```bash
ax --prompt "analyze dependencies in src/"
```

**Output Includes**:
- Total files and dependencies analyzed
- Circular dependency cycles with severity
- Orphan files (no imports/exports)
- Hub files (high coupling)
- Health score (0-100)

**Metrics Explained**:
- **Afferent Coupling (Ca)**: Number of files depending on this file
- **Efferent Coupling (Ce)**: Number of files this file depends on
- **Instability (I)**: Ce / (Ce + Ca) - 0 = stable, 1 = unstable
- **Health Score**: Overall dependency health (100 = perfect)

---

## 2. Code Smell Detection (`detect_code_smells`)

**Purpose**: Identifies code quality issues and anti-patterns.

**When to Use**:
- Code review automation
- Technical debt assessment
- Refactoring planning
- Maintaining code quality standards

**Example Usage**:
```bash
ax --prompt "detect code smells in src/services"
```

**Detected Smells**:

### Long Method
Methods/functions exceeding recommended length (default: 50 lines)
- **Severity**: LOW to CRITICAL (based on length)
- **Fix**: Extract smaller, focused methods

### Large Class
Classes with too many methods/properties (default: 20 methods, 30 properties, 500 LOC)
- **Severity**: LOW to CRITICAL
- **Fix**: Split using Single Responsibility Principle

### Long Parameter List
Functions with excessive parameters (default: >5)
- **Severity**: LOW to CRITICAL
- **Fix**: Use parameter objects or builder pattern

### Magic Numbers
Unexplained numeric literals in code
- **Severity**: LOW to MEDIUM
- **Fix**: Replace with named constants

### Nested Conditionals
Deeply nested if/else structures (default: >3 levels)
- **Severity**: LOW to CRITICAL
- **Fix**: Use early returns or extract methods

### Dead Code
Unused variables, functions, or classes
- **Severity**: LOW to MEDIUM
- **Fix**: Remove unused code

### Duplicate Code
Similar code blocks across multiple locations
- **Severity**: MEDIUM
- **Fix**: Extract shared utility functions

### Feature Envy
Methods accessing external properties more than their own
- **Severity**: MEDIUM to HIGH
- **Fix**: Move logic to the appropriate class

### Data Clumps
Parameter groups appearing together frequently
- **Severity**: MEDIUM to HIGH
- **Fix**: Create data classes or configuration objects

### Inappropriate Intimacy
Classes accessing each other's internal details excessively
- **Severity**: MEDIUM to HIGH
- **Fix**: Reduce coupling, use composition

---

## 3. Hotspot Analysis (`find_hotspots`)

**Purpose**: Identifies code that changes frequently and has high complexity.

**When to Use**:
- Prioritizing refactoring efforts
- Identifying problem areas
- Code review focus
- Team onboarding guidance

**Example Usage**:
```bash
ax --prompt "find hotspots from last 6 months"
```

**Hotspot Formula**:
```
Hotspot Score = (Churn × 40%) + (Complexity × 30%) + (Commit Frequency × 30%)
```

**Metrics**:
- **Churn Score**: Lines added + lines deleted per commit
- **Complexity**: Cyclomatic complexity of the file
- **Commit Frequency**: How often the file changes

**Severity Levels**:
- **CRITICAL** (>80): Immediate action required
- **HIGH** (60-80): Prioritize for refactoring
- **MEDIUM** (40-60): Monitor and plan improvements
- **LOW** (<40): Acceptable change rate

---

## 4. Metrics Calculation (`calculate_metrics`)

**Purpose**: Calculates comprehensive code quality metrics.

**When to Use**:
- Measuring code quality objectively
- Tracking improvements over time
- Setting quality benchmarks
- Identifying complex code

**Example Usage**:
```bash
ax --prompt "calculate metrics for src/"
```

**Metrics Calculated**:

### Cyclomatic Complexity
Measures decision points in code
- **Formula**: Edges - Nodes + 2 (for connected graphs)
- **Thresholds**:
  - 1-10: Low complexity (good)
  - 11-20: Moderate complexity
  - 21-50: High complexity (refactor recommended)
  - 50+: Very high (critical - must refactor)

### Halstead Metrics
Measures program volume and difficulty
- **Volume (V)**: (N1 + N2) × log2(n1 + n2)
  - N1/N2: Total operators/operands
  - n1/n2: Distinct operators/operands
- **Difficulty (D)**: (n1/2) × (N2/n2)
- **Effort (E)**: D × V

### Maintainability Index (MI)
Overall maintainability score (0-100)
- **Formula**: 171 - 5.2×ln(V) - 0.23×CC - 16.2×ln(LOC)
- **Ratings**:
  - 80-100: A (Highly maintainable)
  - 65-79: B (Moderately maintainable)
  - 50-64: C (Somewhat maintainable)
  - 35-49: D (Difficult to maintain)
  - 0-34: F (Very difficult to maintain)

### Lines of Code (LOC)
- Total lines
- Comment density
- Code-to-comment ratio

---

## 5. Security Analysis (`analyze_security`)

**Purpose**: Identifies potential security vulnerabilities in code.

**When to Use**:
- Security audits
- Pre-deployment checks
- Compliance reviews
- Penetration testing preparation

**Example Usage**:
```bash
ax --prompt "analyze security vulnerabilities in src/"
```

**Detected Vulnerabilities**:

### SQL Injection
- Pattern: String concatenation in SQL queries
- **Fix**: Use parameterized queries/prepared statements

### XSS (Cross-Site Scripting)
- Pattern: Unsanitized user input in HTML
- **Fix**: Sanitize and encode user input

### Path Traversal
- Pattern: User input in file paths
- **Fix**: Validate and sanitize file paths

### Command Injection
- Pattern: User input in shell commands
- **Fix**: Use safe command execution, validate input

### Hardcoded Secrets
- Pattern: API keys, passwords in code
- **Fix**: Use environment variables or secret management

### Insecure Random
- Pattern: Math.random() for security-sensitive operations
- **Fix**: Use crypto.randomBytes()

### Prototype Pollution
- Pattern: Unsafe object property assignment
- **Fix**: Use Object.create(null) or Map

### Eval Usage
- Pattern: eval(), Function() constructor
- **Fix**: Use safe alternatives (JSON.parse, etc.)

---

## Common Workflows

### Pre-Commit Analysis
```bash
# Quick quality check
ax --prompt "detect code smells in files I changed"

# Calculate metrics to ensure no regression
ax --prompt "calculate metrics for src/feature.ts"
```

### Code Review
```bash
# Comprehensive analysis
ax --prompt "analyze dependencies and detect smells in src/auth/"

# Focus on hotspots
ax --prompt "find hotspots in PR files"
```

### Refactoring Planning
```bash
# Identify problem areas
ax --prompt "find critical hotspots from last year"

# Analyze before refactoring
ax --prompt "analyze dependencies and metrics for src/legacy/"

# Verify improvements
ax --prompt "compare metrics before and after refactoring"
```

### Security Review
```bash
# Full security audit
ax --prompt "analyze security in entire codebase"

# Focus on user input handling
ax --prompt "analyze security in src/api/ focusing on input validation"
```

### Technical Debt Assessment
```bash
# Comprehensive analysis
ax --prompt "run all analysis tools on src/"

# Generate report
ax --prompt "analyze dependencies, smells, hotspots, metrics, and security - create summary report"
```

---

## Interpreting Results

### Health Scores
- **90-100**: Excellent - maintain current practices
- **75-89**: Good - minor improvements recommended
- **60-74**: Fair - plan refactoring sprints
- **40-59**: Poor - prioritize technical debt
- **<40**: Critical - immediate action required

### Severity Levels
- **CRITICAL**: Block deployment, fix immediately
- **HIGH**: Fix before next release
- **MEDIUM**: Plan for upcoming sprints
- **LOW**: Address during routine maintenance

### Prioritization Strategy
1. Fix CRITICAL security vulnerabilities first
2. Address circular dependencies
3. Refactor CRITICAL hotspots
4. Reduce high-severity code smells
5. Improve metrics in critical paths
6. Address technical debt systematically

---

## Best Practices

1. **Run Analysis Regularly**: Integrate into CI/CD pipeline
2. **Set Baselines**: Establish quality metrics benchmarks
3. **Track Trends**: Monitor improvements over time
4. **Prioritize**: Focus on high-impact issues first
5. **Automate**: Use pre-commit hooks for quick checks
6. **Team Collaboration**: Share insights in code reviews
7. **Continuous Improvement**: Refactor incrementally

---

## Integration with Development Workflow

### Git Hooks (Pre-Commit)
```bash
#!/bin/bash
# .git/hooks/pre-commit

# Quick smell detection
ax --prompt "detect code smells in staged files" || exit 1
```

### CI/CD Pipeline
```yaml
# .github/workflows/code-quality.yml
- name: Code Quality Analysis
  run: |
    ax --prompt "analyze dependencies and detect smells in src/"
    ax --prompt "analyze security vulnerabilities"
```

### Regular Reports
```bash
# Weekly quality report
ax --prompt "analyze all code quality metrics and generate weekly report"
```

---

## Limitations

- **AST-Based**: Analysis depends on code parsing (TypeScript/JavaScript)
- **Static Analysis**: Cannot detect runtime issues
- **Heuristic Detection**: Some smells based on patterns/thresholds
- **Git History Required**: Hotspot analysis needs git repository
- **Performance**: Large codebases may take time to analyze

---

## Getting Help

For detailed API documentation, see `docs/api/analyzers.md`

For programmatic usage, see `examples/` directory

For troubleshooting, open an issue at: https://github.com/defai-digital/ax-cli/issues
