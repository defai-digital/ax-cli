# AutomatosX Project Output

This directory contains all AI-generated and project management artifacts for the AX CLI project.

## 📁 Directory Structure

```
automatosx/
├── PRD/              # Product Requirement Documents
│   ├── features/     # Feature specifications
│   ├── api/          # API documentation
│   └── archive/      # Old/deprecated PRDs
├── REPORT/           # Project reports and analysis
│   ├── status/       # Status reports
│   ├── plans/        # Implementation plans
│   ├── analysis/     # Code analysis reports
│   └── metrics/      # Performance and quality metrics
└── tmp/              # Temporary files (git-ignored)
    ├── logs/         # Debug and execution logs
    ├── cache/        # Cached data
    └── scratch/      # Temporary work files
```

## 📝 Usage Guidelines

### PRD (Product Requirement Documents)

**Path:** `./PRD/`

**Purpose:** Store all product requirements, feature specifications, and architecture decisions.

**Naming Convention:**
- `YYYY-MM-DD-feature-name.md` for dated specs
- `feature-name-v1.md` for versioned docs

**Examples:**
```bash
PRD/features/2025-11-20-mcp-integration.md
PRD/api/rest-api-spec.md
PRD/archive/old-feature-spec.md
```

**When to Use:**
- Writing new feature specifications
- Documenting API contracts
- Recording architectural decisions
- Planning major changes

### REPORT (Reports & Plans)

**Path:** `./REPORT/`

**Purpose:** Store implementation plans, status reports, and analysis documents.

**Subdirectories:**
- `status/` - Weekly/monthly status updates
- `plans/` - Implementation and execution plans
- `analysis/` - Code quality, performance analysis
- `metrics/` - Test coverage, performance metrics

**Naming Convention:**
- `YYYY-MM-DD-report-type.md` for time-based reports
- `descriptive-name.md` for analysis

**Examples:**
```bash
REPORT/status/2025-11-20-weekly-status.md
REPORT/plans/authentication-implementation-plan.md
REPORT/analysis/code-quality-report.md
REPORT/metrics/test-coverage-trends.md
```

**When to Use:**
- Creating implementation plans
- Writing status updates
- Documenting code analysis
- Tracking metrics over time

### tmp (Temporary Files)

**Path:** `./tmp/` (git-ignored)

**Purpose:** Store temporary files, logs, cache, and scratch work.

**Auto-Cleanup:** Files older than 7 days can be safely deleted.

**Examples:**
```bash
tmp/logs/ai-session-2025-11-20.log
tmp/cache/api-response-cache.json
tmp/scratch/debugging-notes.md
```

**When to Use:**
- Debug logging
- Temporary calculations
- Cache data
- Scratch work that doesn't need version control

## 🎯 Best Practices

### File Naming

1. **Use kebab-case:** `feature-name.md` (not `Feature_Name.md` or `feature_name.md`)
2. **Include dates for time-sensitive docs:** `2025-11-20-status-report.md`
3. **Be descriptive:** `user-authentication-flow.md` (not `flow.md`)
4. **Version when needed:** `api-spec-v2.md`

### Content Organization

1. **PRD files should include:**
   - Problem statement
   - Proposed solution
   - Technical requirements
   - Success criteria
   - Timeline (optional)

2. **Report files should include:**
   - Summary/Executive summary
   - Details/Findings
   - Recommendations
   - Next steps

3. **Use Markdown formatting:**
   - Clear headings (H1, H2, H3)
   - Bullet points for lists
   - Code blocks for examples
   - Tables for comparisons

### Version Control

**Tracked (in git):**
- ✅ All PRD documents
- ✅ All REPORT documents
- ✅ This README

**Not Tracked (git-ignored):**
- ❌ Everything in `tmp/`
- ❌ Large binary files
- ❌ Sensitive data

### Maintenance

**Weekly:**
- Review and update active plans in `REPORT/plans/`
- Create status report in `REPORT/status/`

**Monthly:**
- Archive old PRDs to `PRD/archive/`
- Clean up `tmp/` directory
- Generate metrics report in `REPORT/metrics/`

**As Needed:**
- Update feature specs when requirements change
- Create new analysis reports after major changes
- Document architectural decisions

## 🔗 Related Documentation

- Main project README: `../README.md`
- Development guide: `../docs/development.md`
- Architecture docs: `../docs/architecture.md`
- Custom instructions: `../.ax-cli/CUSTOM.md`

## 📞 Questions?

If you're unsure where to put a document:

1. **Is it a requirement or specification?** → `PRD/`
2. **Is it a plan or report?** → `REPORT/`
3. **Is it temporary or debug data?** → `tmp/`

When in doubt, prefer `REPORT/` over `PRD/` - it's easier to promote a report to a PRD than vice versa.
