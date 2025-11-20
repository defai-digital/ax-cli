# Product Requirements Document: AX CLI Init 2.0

**Product:** AX CLI
**Feature:** Enhanced Init Command & Onboarding Experience
**Version:** 2.0
**Date:** 2025-11-19
**Status:** Draft
**Owner:** AX CLI Team
**Contributors:** Claude Code, AX Agent

---

## 📋 Document Overview

| Section | Page |
|---------|------|
| [Executive Summary](#executive-summary) | 1 |
| [Problem Statement](#problem-statement) | 2 |
| [Goals & Success Metrics](#goals--success-metrics) | 3 |
| [User Personas & Journeys](#user-personas--journeys) | 4 |
| [Functional Requirements](#functional-requirements) | 6 |
| [Technical Specifications](#technical-specifications) | 12 |
| [User Experience Design](#user-experience-design) | 15 |
| [Implementation Plan](#implementation-plan) | 18 |
| [Testing Strategy](#testing-strategy) | 20 |
| [Risks & Mitigations](#risks--mitigations) | 21 |
| [Appendices](#appendices) | 22 |

---

## Executive Summary

### Vision

Transform AX CLI's `/init` command from a silent project analyzer into an **industry-leading interactive setup wizard** that provides a world-class onboarding experience, rivaling or surpassing Claude Code, Cursor AI, and other top-tier AI coding assistants.

### Current State

AX CLI v0.x has a solid but basic `/init` command that:
- ✅ Performs excellent project analysis (10+ project types, 20+ frameworks)
- ✅ Generates CUSTOM.md and index.json automatically
- ❌ Lacks interactivity and user guidance
- ❌ Provides no onboarding flow for new users
- ❌ Requires manual configuration editing
- ❌ Offers minimal feedback during execution

### Proposed State

AX CLI v2.0 will deliver a comprehensive initialization experience that:
- 🎯 **Interactive Setup Wizard** - Guided configuration with smart defaults
- 🎯 **First-Run Onboarding** - 30-second setup flow for new users
- 🎯 **Configuration Templates** - Pre-built presets for common project types
- 🎯 **Validation & Preview** - Review before file creation
- 🎯 **Enhanced Feedback** - Real-time progress with detailed status
- 🎯 **Memory Management** - Easy instruction editing and updates
- 🎯 **LLM-Optimized Instructions** - Token-efficient, comprehension-optimized CUSTOM.md

### Success Criteria

| Metric | Current | Target |
|--------|---------|--------|
| Time to First Success | ~5 min (manual) | < 60 seconds |
| Setup Completion Rate | ~70% | > 95% |
| User Satisfaction | Unknown | > 4.5/5 |
| Init Test Coverage | 0% (no tests) | > 95% |
| CUSTOM.md Token Efficiency | Baseline | 30-40% reduction |
| LLM Code Quality Improvement | Baseline | +30% better outputs |

### Investment & Timeline

- **Phase 1 (MVP):** 2-3 weeks - Interactive wizard + First-run flow + LLM-optimized CUSTOM.md
- **Phase 2:** 1-2 weeks - Templates + Memory management
- **Phase 3:** 1-2 weeks - Advanced features + Polish

**Total Estimated Effort:** 4-7 weeks

---

## Problem Statement

### The Problem

New users of AX CLI face significant friction when getting started:

1. **Unclear Setup Process**
   - Users don't know whether to run `init` or `setup` first
   - No guidance on what each command does
   - Silent execution provides no feedback on success

2. **Fragmented Configuration**
   - API keys set via `setup`
   - Project config via `init`
   - Model preferences via manual file editing
   - No single workflow ties it all together

3. **Poor First Impression**
   - No welcome message or introduction
   - No verification that setup is complete
   - No next steps guidance
   - Users feel lost after installation

4. **Manual Configuration Required**
   - Users must manually edit `.ax-cli/settings.json`
   - No prompts for common preferences
   - Trial-and-error to find correct settings
   - Higher barrier to entry vs. competitors

5. **Limited Discoverability**
   - Users don't know what CUSTOM.md does
   - No explanation of generated files
   - No preview before creation
   - Can't customize without reading docs

### Impact

**Quantitative:**
- ~30% of new users abandon during setup (estimated)
- Average 5-10 minutes to complete first successful interaction
- Multiple support requests about "how to get started"

**Qualitative:**
- Confusion about command purpose and order
- Frustration with manual configuration
- Perception that AX CLI is "harder to use" than competitors
- Missed opportunity to showcase intelligent project analysis

### Why Now?

1. **Competitive Pressure:** Claude Code has set a new standard with their 30-second onboarding
2. **User Growth:** As AX CLI gains adoption, onboarding quality becomes critical
3. **Market Expectations:** Modern CLIs are expected to be interactive and user-friendly
4. **Technical Readiness:** Core analysis engine is mature and tested (98%+ coverage)

### Who Is Affected?

- **Primary:** New users installing AX CLI for the first time
- **Secondary:** Existing users initializing new projects
- **Tertiary:** Teams onboarding multiple developers

---

## Goals & Success Metrics

### Product Goals

#### P0 Goals (Must-Have)

1. **Reduce Time to First Success**
   - Enable users to go from installation to first AI interaction in < 60 seconds
   - Eliminate need to read documentation before getting started

2. **Increase Setup Completion Rate**
   - Achieve > 95% completion rate for init workflow
   - Reduce abandonment during onboarding

3. **Improve User Satisfaction**
   - Achieve > 4.5/5 rating for onboarding experience
   - Reduce "getting started" support tickets by 80%

4. **Ensure Configuration Accuracy**
   - > 90% of users don't need to manually edit configs after init
   - Smart defaults work for majority of projects

#### P1 Goals (Should-Have)

5. **Enhance Discoverability**
   - Users understand what each generated file does
   - Clear next steps guidance after init

6. **Enable Customization**
   - Support project-specific templates and presets
   - Allow users to override auto-detection

7. **Improve Developer Confidence**
   - Users can preview changes before files are created
   - Validation prevents common mistakes

### Success Metrics

#### User Experience Metrics

| Metric | Measurement Method | Current | Target | Timeline |
|--------|-------------------|---------|--------|----------|
| Time to First Success | Analytics | ~5 min | < 60 sec | Launch + 1mo |
| Setup Completion Rate | Analytics | ~70% | > 95% | Launch + 1mo |
| User Satisfaction (NPS) | Survey | Unknown | > 4.5/5 | Launch + 3mo |
| Support Ticket Reduction | Support System | Baseline | -80% | Launch + 3mo |
| Documentation Reads (Pre-Init) | Analytics | High | -60% | Launch + 1mo |

#### Technical Metrics

| Metric | Measurement Method | Current | Target | Timeline |
|--------|-------------------|---------|--------|----------|
| Init Test Coverage | Vitest | 0% | > 95% | Before Launch |
| Init Execution Time | Telemetry | ~2 sec | < 3 sec | Launch |
| Error Rate | Telemetry | Unknown | < 2% | Launch + 1mo |
| Config Accuracy | User Feedback | ~60% | > 90% | Launch + 3mo |

#### Business Metrics

| Metric | Measurement Method | Current | Target | Timeline |
|--------|-------------------|---------|--------|----------|
| User Retention (30-day) | Analytics | Unknown | > 75% | Launch + 3mo |
| Word-of-Mouth Referrals | Surveys | Low | +50% | Launch + 6mo |
| GitHub Stars Growth | GitHub | Baseline | +30% | Launch + 6mo |

### Non-Goals (Out of Scope)

- ❌ Graphical UI or web-based setup (CLI-only)
- ❌ IDE integrations (VSCode extension, etc.)
- ❌ Enterprise single sign-on (SSO)
- ❌ Cloud-based configuration sync
- ❌ Multi-user collaboration features
- ❌ Automated project scaffolding (creating new projects from scratch)

---

## User Personas & Journeys

### Primary Persona: "First-Time Fiona"

**Profile:**
- Software engineer trying AX CLI for the first time
- Familiar with AI coding tools (GitHub Copilot, ChatGPT)
- Expects modern CLI UX (interactive prompts, clear feedback)
- Values speed and simplicity
- Low patience for complex setup

**Goals:**
- Get started quickly without reading extensive documentation
- Understand what the tool does before committing
- Configure basic settings without manual file editing
- Start using AI assistance within minutes

**Pain Points (Current):**
- Unclear which command to run first
- Silent execution provides no feedback
- Must manually edit config files
- No validation of setup success

**Journey (Current State):**

```
1. Install AX CLI
   ├─ npm install -g ax-cli
   └─ ⏱️ Time: 30 sec

2. Try to run
   ├─ ax-cli
   └─ ❌ Error: No API key configured
   └─ ⏱️ Time: +5 sec

3. Read documentation
   ├─ Google "ax cli getting started"
   ├─ Find README on GitHub
   └─ ⏱️ Time: +2 min

4. Run setup
   ├─ ax-cli setup
   ├─ Enter API key
   └─ ⏱️ Time: +1 min

5. Navigate to project
   ├─ cd ~/projects/my-app
   └─ ⏱️ Time: +10 sec

6. Run init
   ├─ ax-cli init
   ├─ See minimal output
   └─ ⏱️ Time: +5 sec

7. Manually configure
   ├─ Open .ax-cli/settings.json
   ├─ Edit model preferences
   └─ ⏱️ Time: +1 min

8. First successful use
   ├─ ax-cli
   └─ ✅ Finally working!
   └─ ⏱️ Total: ~5 minutes

Satisfaction: 2/5 (frustrated but relieved)
```

**Journey (Desired State - Init 2.0):**

```
1. Install AX CLI
   ├─ npm install -g ax-cli
   └─ ⏱️ Time: 30 sec

2. Navigate to project
   ├─ cd ~/projects/my-app
   └─ ⏱️ Time: 10 sec

3. Run init
   ├─ ax-cli init
   ├─ 👋 Welcome to AX CLI! First-time setup:
   │
   ├─ Step 1/3: API Configuration
   │  ? Which provider do you want to use?
   │    › GLM (Recommended)
   │      OpenAI
   │      Anthropic
   │      Local (Ollama)
   │
   │  ? Enter your GLM API key: [paste]
   │  ✓ API key validated successfully!
   │
   ├─ Step 2/3: Project Analysis
   │  🔍 Analyzing your project...
   │    ├─ Detected: TypeScript CLI tool
   │    ├─ Found: Vitest, Commander, Ink
   │    └─ Module: ESM
   │
   │  ? Generate project instructions? (Y/n) y
   │  ✓ Created .ax-cli/CUSTOM.md
   │
   ├─ Step 3/3: Preferences
   │  ? Select default model:
   │    › glm-4.6 (Recommended)
   │      glm-4-flash
   │      Custom...
   │
   │  ? Enable verbose output? (y/N) n
   │  ? Auto-confirm safe operations? (y/N) y
   │
   │  ✓ Configuration complete!
   │
   ├─ 📦 Setup Summary:
   │  ├─ API: GLM configured ✓
   │  ├─ Project: TypeScript CLI ✓
   │  ├─ Model: glm-4.6 ✓
   │  └─ Files: CUSTOM.md, settings.json ✓
   │
   └─ 🚀 You're ready to go! Try:
      • ax-cli - Start interactive session
      • ax-cli --help - View all commands
      • ax-cli memory - Edit project instructions
   └─ ⏱️ Total: 45 seconds

4. First successful use
   ├─ ax-cli
   └─ ✅ Working immediately!

Satisfaction: 5/5 (delighted)
```

---

### Secondary Persona: "Experienced Eliza"

**Profile:**
- Experienced AX CLI user
- Frequently initializes new projects
- Knows exactly what settings she wants
- Values speed and efficiency over guidance

**Goals:**
- Quickly initialize new projects with preferred settings
- Skip interactive prompts when possible
- Re-use configurations across projects
- Customize instructions easily

**Pain Points (Current):**
- Must manually copy config files between projects
- No way to save preferred defaults
- No quick-edit for CUSTOM.md
- Verbose analysis output can't be skipped

**Journey (Desired State):**

```
1. New project setup
   ├─ cd ~/projects/new-project
   └─ ⏱️ Time: 5 sec

2. Quick init with saved preferences
   ├─ ax-cli init --preset my-defaults
   │  🔍 Using preset: my-defaults
   │  ✓ Applied saved configuration
   │  ✓ Created CUSTOM.md
   └─ ⏱️ Time: 2 sec

3. Quick instruction update
   ├─ ax-cli memory add "Use 2-space indentation"
   │  ✓ Added to CUSTOM.md
   └─ ⏱️ Time: 3 sec

Total: 10 seconds
Satisfaction: 5/5 (efficient)
```

---

### Tertiary Persona: "Team Lead Tom"

**Profile:**
- Engineering manager onboarding team members
- Needs consistent setup across team
- Wants to enforce team standards
- Values reproducibility and documentation

**Goals:**
- Standardize configuration across team
- Enforce project conventions
- Quick onboarding for new hires
- Maintain team-wide instruction templates

**Pain Points (Current):**
- Each team member configures differently
- No way to share or enforce settings
- Manual instruction copy-paste
- Inconsistent project setups

**Journey (Desired State):**

```
1. Create team template
   ├─ ax-cli init --save-template team-standard
   │  ? Model: glm-4.6
   │  ? Conventions: Team coding standards
   │  ✓ Template saved
   └─ ⏱️ Time: 1 min

2. Team member onboarding
   ├─ New hire: ax-cli init --template team-standard
   │  ✓ Applied team configuration
   │  ✓ Loaded team instructions
   └─ ⏱️ Time: 10 sec

3. Update team standards
   ├─ Edit team CUSTOM.md template
   ├─ ax-cli template update team-standard
   └─ All projects can re-sync
   └─ ⏱️ Time: 2 min

Satisfaction: 5/5 (consistency achieved)
```

---

## Functional Requirements

### FR-1: Interactive Setup Wizard

**Priority:** P0 (Must-Have)
**Persona:** First-Time Fiona, Experienced Eliza

#### Description

An interactive, multi-step wizard that guides users through initial configuration with intelligent defaults and validation.

#### User Stories

```
AS a new user
I WANT to be guided through setup with prompts
SO THAT I don't have to read documentation or manually edit files

AS an experienced user
I WANT to skip interactive prompts with flags
SO THAT I can quickly initialize projects
```

#### Acceptance Criteria

**AC-1.1: API Provider Selection**
- [ ] Prompt user to select API provider (GLM, OpenAI, Anthropic, Ollama, Custom)
- [ ] Display description for each provider
- [ ] Show recommended option based on project analysis
- [ ] Support keyboard navigation (arrow keys, enter)
- [ ] Validate selection before proceeding

**AC-1.2: API Key Input**
- [ ] Prompt for API key based on selected provider
- [ ] Mask input (show as `***`)
- [ ] Validate API key format (basic regex)
- [ ] Optional: Test API key with actual API call
- [ ] Skip if already configured (show current provider)
- [ ] Support "skip for now" option with warning

**AC-1.3: Model Selection**
- [ ] Display available models for chosen provider
- [ ] Show recommended model based on project type
- [ ] Display model capabilities (context window, features)
- [ ] Allow custom model input
- [ ] Validate model exists (if possible)

**AC-1.4: Project Analysis Confirmation**
- [ ] Display detected project type, language, tech stack
- [ ] Show proposed CUSTOM.md structure
- [ ] Allow user to confirm or override detection
- [ ] Option to skip instruction generation
- [ ] Option to use template instead

**AC-1.5: Workflow Preferences**
- [ ] Prompt for verbose output preference (y/N)
- [ ] Prompt for auto-confirmation settings
- [ ] Prompt for editor choice for CUSTOM.md
- [ ] Save preferences for future use

**AC-1.6: Non-Interactive Mode**
- [ ] Support `--yes` flag to accept all defaults
- [ ] Support `--no-interaction` flag for CI/CD
- [ ] Support `--preset <name>` to use saved configuration
- [ ] All prompts skippable via environment variables

#### Technical Requirements

```typescript
// Interface for wizard steps
interface WizardStep {
  name: string;
  prompt: () => Promise<StepResult>;
  validate?: (answer: unknown) => boolean | string;
  skip?: () => boolean;
}

// Configuration result
interface InitWizardResult {
  provider: 'glm' | 'openai' | 'anthropic' | 'ollama' | 'custom';
  apiKey?: string;
  baseUrl?: string;
  model: string;
  generateInstructions: boolean;
  template?: string;
  preferences: {
    verbose: boolean;
    autoConfirm: boolean;
    editor?: string;
  };
}
```

#### Dependencies

- `inquirer` or `@clack/prompts` for interactive prompts
- API validation utilities
- Settings manager integration

#### Open Questions

- Should we validate API keys by making test requests?
- How to handle rate limits during validation?
- Should we support OAuth flows for certain providers?

---

### FR-2: First-Run Detection & Onboarding

**Priority:** P0 (Must-Have)
**Persona:** First-Time Fiona

#### Description

Automatic detection of first-time users with a welcoming onboarding flow that introduces AX CLI and guides through initial setup.

#### User Stories

```
AS a first-time user
I WANT to see a welcome message and guided setup
SO THAT I understand what the tool does and how to use it

AS a returning user
I WANT to skip the welcome flow
SO THAT I can start working immediately
```

#### Acceptance Criteria

**AC-2.1: First-Run Detection**
- [ ] Check for existence of `~/.ax-cli/` directory
- [ ] Check for user-level settings file
- [ ] Display welcome only on true first run
- [ ] Set flag after first successful init
- [ ] Support `--welcome` flag to force welcome screen

**AC-2.2: Welcome Screen**
- [ ] Display AX CLI logo/banner
- [ ] Show version information
- [ ] Brief description of what AX CLI does
- [ ] Estimated setup time (< 60 seconds)
- [ ] Option to skip to quick setup

**AC-2.3: Feature Introduction**
- [ ] Highlight key capabilities (AI-powered coding, project analysis, etc.)
- [ ] Show example commands
- [ ] Link to documentation
- [ ] Optional: Show quick demo/GIF

**AC-2.4: Guided Setup Flow**
- [ ] 3-step process: Auth → Project → Preferences
- [ ] Progress indicator (Step 1/3, 2/3, 3/3)
- [ ] Each step clearly labeled
- [ ] Option to go back to previous step
- [ ] Option to exit and resume later

**AC-2.5: Completion Summary**
- [ ] Show what was configured
- [ ] Display created files
- [ ] Provide next steps guidance
- [ ] Link to relevant documentation
- [ ] Suggest first command to try

#### Mock UI

```
┌─────────────────────────────────────────┐
│                                         │
│   ╔═╗═╗ ╦   ╔═╗╦  ╦                    │
│   ╠═╣ ╔╬╦╝  ║  ║  ║                    │
│   ╩ ╩ ╩ ╚═  ╚═╝╩═╝╩                    │
│                                         │
│   Enterprise AI Command Line Interface │
│   Version 2.0.0                         │
│                                         │
└─────────────────────────────────────────┘

👋 Welcome! This looks like your first time using AX CLI.

Let's get you set up in under 60 seconds:

⏩ Step 1/3: API Configuration
⏹ Step 2/3: Project Analysis
⏹ Step 3/3: Preferences

Press Enter to continue, or Ctrl+C to exit...
```

#### Technical Requirements

```typescript
interface OnboardingState {
  isFirstRun: boolean;
  currentStep: number;
  totalSteps: number;
  completed: boolean;
  skipped: boolean;
}

class OnboardingManager {
  static detectFirstRun(): boolean;
  static markCompleted(): void;
  static getCurrentState(): OnboardingState;
  static resetOnboarding(): void; // For testing
}
```

#### Dependencies

- Settings manager for first-run flag
- UI rendering library (Ink/React)
- Step-based wizard framework

---

### FR-3: Configuration Templates & Presets

**Priority:** P1 (Should-Have)
**Persona:** Experienced Eliza, Team Lead Tom

#### Description

Pre-defined and custom templates for common project types, allowing quick initialization with saved preferences.

#### User Stories

```
AS an experienced user
I WANT to save my preferred configuration as a template
SO THAT I can quickly initialize new projects

AS a team lead
I WANT to create team-wide templates
SO THAT all team members use consistent settings
```

#### Acceptance Criteria

**AC-3.1: Built-in Templates**
- [ ] Provide templates for common project types:
  - `cli` - Command-line tool
  - `web-app` - Frontend application
  - `api` - Backend API
  - `library` - Reusable package
  - `fullstack` - Full-stack application
- [ ] Each template includes:
  - Default model selection
  - Common CUSTOM.md instructions
  - Typical workflow preferences
- [ ] Templates adapt based on detected tech stack

**AC-3.2: Custom Template Creation**
- [ ] `ax-cli init --save-template <name>` saves current config as template
- [ ] Store templates in `~/.ax-cli/templates/<name>.json`
- [ ] Include all settings and instructions
- [ ] Support template metadata (description, author, version)

**AC-3.3: Template Usage**
- [ ] `ax-cli init --template <name>` uses saved template
- [ ] List available templates with `ax-cli templates list`
- [ ] Show template details with `ax-cli templates show <name>`
- [ ] Override template values with flags (e.g., `--model glm-4.6`)

**AC-3.4: Template Management**
- [ ] `ax-cli templates delete <name>` removes template
- [ ] `ax-cli templates rename <old> <new>` renames template
- [ ] `ax-cli templates export <name>` exports to shareable file
- [ ] `ax-cli templates import <file>` imports shared template

**AC-3.5: Team Templates**
- [ ] Support project-level templates in `.ax-cli/templates/`
- [ ] Project templates override user templates
- [ ] Check into version control for team sharing
- [ ] Team lead can enforce required templates

#### Template Schema

```typescript
interface TemplateConfig {
  name: string;
  description: string;
  version: string;
  author?: string;
  projectType: 'cli' | 'web-app' | 'api' | 'library' | 'fullstack';

  settings: {
    provider: string;
    model: string;
    baseUrl?: string;
    maxTokens?: number;
    temperature?: number;
  };

  instructions: {
    template: string; // CUSTOM.md template
    variables?: Record<string, string>; // Replaceable variables
  };

  preferences: {
    verbose: boolean;
    autoConfirm: boolean;
    editor?: string;
  };

  conventions?: {
    indentation?: string;
    lineLength?: number;
    importStyle?: 'esm' | 'commonjs';
  };
}
```

#### Built-in Template Examples

**CLI Template:**
```json
{
  "name": "cli",
  "description": "Command-line tool with TypeScript",
  "projectType": "cli",
  "settings": {
    "provider": "glm",
    "model": "glm-4.6"
  },
  "instructions": {
    "template": "# CLI Tool Instructions\n\n- Use Commander for CLI framework\n- Implement --help, --version flags\n- Handle errors gracefully\n- Provide progress feedback"
  },
  "preferences": {
    "verbose": false,
    "autoConfirm": true
  }
}
```

#### Dependencies

- File system utilities for template storage
- JSON schema validation
- Template rendering engine (Mustache/Handlebars)

---

### FR-4: Validation & Preview Mode

**Priority:** P1 (Should-Have)
**Persona:** First-Time Fiona, Team Lead Tom

#### Description

Show users what will be created before actually writing files, with validation to prevent common mistakes.

#### User Stories

```
AS a user
I WANT to preview generated files before they're created
SO THAT I can verify correctness and make adjustments

AS a cautious user
I WANT validation warnings for potential issues
SO THAT I avoid common mistakes
```

#### Acceptance Criteria

**AC-4.1: Preview Mode**
- [ ] `--preview` flag shows what would be created without writing files
- [ ] Display file paths and sizes
- [ ] Show truncated content of each file (first 20 lines)
- [ ] Highlight any detected issues
- [ ] Option to expand and view full content

**AC-4.2: Interactive Preview**
- [ ] After analysis, show preview before confirmation
- [ ] Format: `? Looks good? (Y/n/e for edit)`
- [ ] `Y` - Proceed with file creation
- [ ] `n` - Cancel initialization
- [ ] `e` - Open interactive editor to modify before creation

**AC-4.3: Validation Checks**
- [ ] Warn if files already exist (unless --force)
- [ ] Detect potential conflicts (e.g., both CLAUDE.md and CUSTOM.md)
- [ ] Warn if API key looks invalid (format check)
- [ ] Check file permissions before writing
- [ ] Validate JSON schema for settings.json
- [ ] Warn about deprecated configurations

**AC-4.4: Diff View**
- [ ] If files exist, show diff between current and proposed
- [ ] Color-coded: green for additions, red for removals
- [ ] Line-by-line comparison
- [ ] Option to merge or replace

**AC-4.5: Dry Run Mode**
- [ ] `--dry-run` flag simulates entire process
- [ ] Log all actions that would be taken
- [ ] No actual file writes or API calls
- [ ] Useful for CI/CD validation

#### Mock UI

```bash
$ ax-cli init --preview

🔍 Analyzing project...
  ├─ TypeScript CLI tool ✓
  └─ Vitest, Commander, Ink ✓

📝 The following files will be created:

  .ax-cli/CUSTOM.md (1.2 KB)
  ┌────────────────────────────────────────┐
  │ # AX CLI - Project Instructions        │
  │                                        │
  │ ## Project: ax-cli                     │
  │ Type: CLI Tool                         │
  │ Language: TypeScript                   │
  │ ...                                    │
  │ (Show more - 45 lines total)           │
  └────────────────────────────────────────┘

  .ax-cli/settings.json (342 bytes)
  ┌────────────────────────────────────────┐
  │ {                                      │
  │   "provider": "glm",                   │
  │   "model": "glm-4.6",                  │
  │   ...                                  │
  │ }                                      │
  └────────────────────────────────────────┘

? Proceed with creation? (Y/n/e for edit) █
```

#### Technical Requirements

```typescript
interface PreviewResult {
  files: Array<{
    path: string;
    size: number;
    content: string;
    action: 'create' | 'update' | 'skip';
    warnings?: string[];
  }>;

  validationErrors: ValidationError[];
  validationWarnings: ValidationWarning[];
}

interface ValidationError {
  severity: 'error' | 'warning';
  message: string;
  file?: string;
  line?: number;
  suggestion?: string;
}
```

#### Dependencies

- Diff library (diff-match-patch)
- Syntax highlighting for preview
- File system preview utilities

---

### FR-5: Enhanced Progress & Feedback

**Priority:** P1 (Should-Have)
**Persona:** All personas

#### Description

Real-time, detailed progress indicators during initialization with clear status updates and timing information.

#### User Stories

```
AS a user
I WANT to see what the tool is doing during initialization
SO THAT I understand progress and don't wonder if it's frozen

AS an impatient user
I WANT to see how long each step takes
SO THAT I know whether to wait or cancel
```

#### Acceptance Criteria

**AC-5.1: Step-by-Step Progress**
- [ ] Show current operation being performed
- [ ] Nested progress for sub-operations
- [ ] Checkmarks (✓) for completed steps
- [ ] Spinners for in-progress operations
- [ ] Error indicators (✗) for failures

**AC-5.2: Timing Information**
- [ ] Display elapsed time for each major step
- [ ] Total time at completion
- [ ] Estimated time remaining (if predictable)
- [ ] Highlight slow operations

**AC-5.3: Detailed Analysis Output**
- [ ] Show detected project characteristics in real-time
- [ ] Display found dependencies count
- [ ] Show scanned file count
- [ ] Verbose mode shows all detection details

**AC-5.4: Success Summary**
- [ ] Clear "✅ Success!" message
- [ ] List of created files with paths
- [ ] Configuration summary
- [ ] Next steps / suggested commands

**AC-5.5: Error Handling**
- [ ] Clear error messages with context
- [ ] Suggested remediation steps
- [ ] Option to retry failed steps
- [ ] Preserve successful steps on partial failure

#### Mock UI

```bash
$ ax-cli init

🔍 Analyzing project...
  ├─ Detecting language... TypeScript ✓ (0.1s)
  ├─ Scanning dependencies... 42 packages ✓ (0.3s)
  │  ├─ Frameworks: Commander, Ink
  │  ├─ Testing: Vitest
  │  └─ Build: TypeScript, ESBuild
  ├─ Analyzing structure... ✓ (0.2s)
  │  ├─ Source: src/ (32 files)
  │  └─ Tests: tests/ (18 files)
  ├─ Identifying conventions... ✓ (0.1s)
  │  ├─ Module: ESM
  │  ├─ Imports: .js extension required
  │  └─ Validation: Zod
  └─ Generating instructions... ✓ (0.4s)

✅ Initialization complete! (1.1s)

📦 Created:
  ├─ .ax-cli/CUSTOM.md (1.2 KB)
  ├─ .ax-cli/settings.json (342 bytes)
  └─ .ax-cli/index.json (1.8 KB)

🚀 Next steps:
  • Review CUSTOM.md and customize as needed
  • Run 'ax-cli' to start interactive session
  • Use 'ax-cli memory' to edit instructions
```

#### Technical Requirements

```typescript
interface ProgressTracker {
  startStep(name: string): void;
  completeStep(name: string, duration: number): void;
  failStep(name: string, error: Error): void;
  updateProgress(current: number, total: number): void;
}

class InitProgress extends EventEmitter {
  private startTime: number;
  private steps: Map<string, StepStatus>;

  constructor();
  track(stepName: string, fn: () => Promise<void>): Promise<void>;
  summarize(): ProgressSummary;
}
```

#### Dependencies

- `ora` for spinners
- `chalk` for colors
- `cli-progress` for progress bars
- Performance timing utilities

---

### FR-6: Memory Management Commands

**Priority:** P1 (Should-Have)
**Persona:** Experienced Eliza, Team Lead Tom

#### Description

Dedicated commands for viewing, editing, and managing project instructions (CUSTOM.md) without manual file editing.

#### User Stories

```
AS a user
I WANT to quickly add or edit project instructions
SO THAT I don't have to manually open and edit CUSTOM.md

AS a frequent user
I WANT shortcuts for common instruction updates
SO THAT I can maintain project conventions efficiently
```

#### Acceptance Criteria

**AC-6.1: View Instructions**
- [ ] `ax-cli memory` or `ax-cli memory show` displays CUSTOM.md
- [ ] Syntax-highlighted markdown rendering in terminal
- [ ] Paginated for long files
- [ ] Option to open in default editor

**AC-6.2: Quick Add**
- [ ] `ax-cli memory add "<instruction>"` appends to CUSTOM.md
- [ ] Intelligently places in appropriate section
- [ ] Validates instruction format
- [ ] Shows diff of what was added

**AC-6.3: Interactive Edit**
- [ ] `ax-cli memory edit` opens CUSTOM.md in preferred editor
- [ ] Respects $EDITOR environment variable
- [ ] Falls back to common editors (vim, nano, code)
- [ ] Validates after editing
- [ ] Shows what changed

**AC-6.4: Section Management**
- [ ] `ax-cli memory section <name>` shows specific section
- [ ] `ax-cli memory section <name> add "<content>"` adds to section
- [ ] Predefined sections: conventions, workflow, testing, structure

**AC-6.5: Reset & Templates**
- [ ] `ax-cli memory reset` regenerates from current project analysis
- [ ] `ax-cli memory template <name>` loads template instructions
- [ ] Confirmation before destructive operations
- [ ] Backup previous version

**AC-6.6: Sync & Share**
- [ ] Export instructions to shareable format
- [ ] Import instructions from file
- [ ] Merge instructions from multiple sources

#### Command Examples

```bash
# View current instructions
ax-cli memory
ax-cli memory show

# Quick add
ax-cli memory add "Use 2-space indentation for TypeScript"

# Edit interactively
ax-cli memory edit

# Section-specific operations
ax-cli memory section conventions
ax-cli memory section workflow add "Run tests before committing"

# Reset
ax-cli memory reset
ax-cli memory reset --from-template cli

# Share
ax-cli memory export > team-instructions.md
ax-cli memory import team-instructions.md
```

#### Technical Requirements

```typescript
interface MemoryManager {
  load(): Promise<string>;
  save(content: string): Promise<void>;
  show(options?: { section?: string }): Promise<void>;
  add(instruction: string, section?: string): Promise<void>;
  edit(editor?: string): Promise<void>;
  reset(template?: string): Promise<void>;
  export(path: string): Promise<void>;
  import(path: string, merge?: boolean): Promise<void>;
}

enum MemorySection {
  PROJECT_CONTEXT = 'Project Context',
  CODE_CONVENTIONS = 'Code Conventions',
  FILE_STRUCTURE = 'File Structure',
  DEVELOPMENT_WORKFLOW = 'Development Workflow',
  TESTING_GUIDELINES = 'Testing Guidelines',
  AVAILABLE_SCRIPTS = 'Available Scripts',
}
```

#### Dependencies

- Markdown parser and renderer
- Editor detection utilities
- Diff library for change display

---

### FR-7: Comprehensive Testing

**Priority:** P0 (Must-Have)
**Persona:** Development Team

#### Description

Full test coverage for init command and all related functionality, ensuring reliability and preventing regressions.

#### Acceptance Criteria

**AC-7.1: Unit Tests**
- [ ] Test each wizard step in isolation
- [ ] Test validation logic
- [ ] Test file generation
- [ ] Test configuration merging
- [ ] Test error handling
- [ ] > 95% code coverage for init.ts

**AC-7.2: Integration Tests**
- [ ] Test complete init workflow
- [ ] Test with various project types
- [ ] Test interactive and non-interactive modes
- [ ] Test template application
- [ ] Test file collision scenarios

**AC-7.3: E2E Tests**
- [ ] Simulate full user journeys
- [ ] Test first-run onboarding flow
- [ ] Test experienced user shortcuts
- [ ] Test error recovery
- [ ] Test across different environments

**AC-7.4: Regression Tests**
- [ ] Test backward compatibility with existing configs
- [ ] Test migration from legacy formats
- [ ] Test upgrade scenarios

**AC-7.5: Performance Tests**
- [ ] Benchmark init execution time
- [ ] Test with large projects (10,000+ files)
- [ ] Test with slow file systems
- [ ] Ensure < 3 second completion

#### Test Coverage Targets

```typescript
// Required coverage thresholds (vitest.config.ts)
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      statements: 95,
      branches: 90,
      functions: 95,
      lines: 95,
      include: ['src/commands/init.ts', 'src/utils/init-*.ts'],
    },
  },
});
```

#### Test Structure

```
tests/
├── commands/
│   └── init.test.ts              (Main command tests)
├── utils/
│   ├── init-wizard.test.ts       (Wizard step tests)
│   ├── init-validation.test.ts   (Validation logic)
│   └── init-templates.test.ts    (Template system)
└── e2e/
    └── init-flow.test.ts         (End-to-end journeys)
```

---

### FR-8: LLM-Optimized CUSTOM.md Generation

**Priority:** P0 (Must-Have)
**Persona:** All personas (impacts LLM performance for everyone)

#### Description

Transform CUSTOM.md generation from generic template-driven content to highly optimized, project-specific instructions that maximize LLM comprehension and minimize token usage. This directly improves AI coding assistant quality and reduces API costs.

#### User Stories

```
AS a user relying on AI assistance
I WANT CUSTOM.md to provide clear, specific instructions to the LLM
SO THAT the AI produces higher quality code that follows project conventions

AS a user paying for API usage
I WANT CUSTOM.md to be token-efficient
SO THAT I minimize costs while maintaining instruction quality

AS a developer using the AI agent
I WANT the AI to understand project patterns automatically
SO THAT I don't need to repeat myself in every prompt
```

#### Acceptance Criteria

**AC-8.1: Token Compression (30-40% reduction)**
- [ ] Remove filler words and verbose phrasing
- [ ] Use bullet fragments instead of full sentences where appropriate
- [ ] Replace "in order to" with "to", "utilize" with "use", etc.
- [ ] Optimize markdown structure (tables > prose, bullets > paragraphs)
- [ ] Measure token count before/after optimization
- [ ] Ensure 30-40% reduction without losing clarity

**Example:**
```markdown
<!-- Before (verbose): 115 tokens -->
### Before Making Changes
1. Read relevant files with `view_file` to understand current implementation
2. Use `search` to find related code or patterns
3. Check existing tests to understand expected behavior

<!-- After (compressed): 71 tokens -->
### Workflow
Before:
- Read files to understand implementation
- Search for related patterns
- Review tests for expected behavior
```

**AC-8.2: Hierarchical Structure (Front-load Critical Info)**
- [ ] Organize content in three tiers: Critical → Overview → Details
- [ ] Front-load top 5-10 most important rules in a "Critical Rules" section
- [ ] Use emoji icons for visual hierarchy (🎯 Critical, 📋 Overview, 📚 Reference)
- [ ] Place most frequently needed info first
- [ ] Enable lazy loading for detailed sections (via file imports)

**Structure:**
```markdown
# Project - Quick Reference

## 🎯 Critical Rules (Always Apply)
[Top 5-10 rules, front-loaded]

## 📋 Project Overview
[High-level context]

## 🔧 Development Guide
[Common tasks and patterns]

## 📚 Detailed Reference (Import on Demand)
[Deep-dive docs via @imports]
```

**AC-8.3: Project-Specific Code Pattern Extraction**
- [ ] Analyze existing codebase to extract actual code patterns
- [ ] Include real interfaces, classes, and function signatures
- [ ] Show project-specific patterns, not generic templates
- [ ] Extract from multiple example files in the codebase
- [ ] Update patterns when project code changes (optional: detection on re-init)

**Example:**
```typescript
## Code Patterns (Extracted from Codebase)

### Tool Implementation (src/tools/*.ts)
```typescript
export class MyTool {
  async execute(args: { param: string }): Promise<ToolResult> {
    try {
      return { success: true, output: 'result' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}
```
```

**AC-8.4: DO/DON'T Contrasts**
- [ ] Add clear DO/DON'T examples for critical conventions
- [ ] Use ✅ and ❌ emoji for visual clarity
- [ ] Show actual code examples (not just descriptions)
- [ ] Cover the most common mistakes
- [ ] Include TypeScript, module system, validation patterns

**Example:**
```markdown
## TypeScript Best Practices

✅ **DO:**
```typescript
function processFile(path: string): Promise<FileResult> { }
```

❌ **DON'T:**
```typescript
function process(data: any) { }  // ❌ No any types
```
```

**AC-8.5: Troubleshooting Section**
- [ ] Add troubleshooting section with problem-solution pairs
- [ ] Cover common errors specific to the project
- [ ] Include code examples for fixes
- [ ] Organize by category (build errors, runtime errors, etc.)
- [ ] Extract from actual project issues (if available)

**Example:**
```markdown
## Troubleshooting

### "Module not found" errors
**Problem:** Import fails with module not found
**Solution:** Ensure `.js` extension in imports (ESM requirement)
```typescript
// ✅ Correct
import { foo } from './bar.js';

// ❌ Wrong
import { foo } from './bar';
```
```

**AC-8.6: Context Caching Optimization (for supported models)**
- [ ] Add cache boundary comments for static content
- [ ] Separate static (conventions) from dynamic (current focus) content
- [ ] Structure for Anthropic/OpenAI prompt caching APIs
- [ ] Measure cost reduction with caching enabled
- [ ] Document caching strategy in generated file

**Example:**
```markdown
<!-- CACHE_BOUNDARY: Static conventions -->
## Code Conventions
[Rarely-changing rules]
<!-- /CACHE_BOUNDARY -->

<!-- DYNAMIC: Project status -->
## Current Focus
[Active development areas - NOT cached]
<!-- /DYNAMIC -->
```

**AC-8.7: File Import System for Large Projects**
- [ ] Support modular structure: CUSTOM.md + docs/ directory
- [ ] Implement `@path/to/file.md` import syntax
- [ ] Lazy-load detailed guides only when needed
- [ ] Generate docs/ directory with sectioned content
- [ ] Keep core CUSTOM.md under 300 lines (rest in imports)

**Structure:**
```
.ax-cli/
├── CUSTOM.md                    # Core (< 300 lines)
├── docs/
│   ├── conventions.md           # Detailed code style
│   ├── architecture.md          # System design
│   ├── testing.md               # Testing guide
│   └── troubleshooting.md       # Problem-solution pairs
```

**AC-8.8: Remove Incorrect Tool References**
- [ ] Remove references to `view_file`, `str_replace_editor` (wrong tools)
- [ ] Use generic descriptions or tool-agnostic language
- [ ] Verify all tool names match AX CLI's actual tools
- [ ] Update workflow instructions to be tool-independent

**AC-8.9: Specificity Over Vagueness**
- [ ] Replace vague guidance ("Write good code") with specific rules
- [ ] Quantify where possible ("80% coverage", "2-space indent")
- [ ] Provide actual examples, not just descriptions
- [ ] Follow Claude Code best practice: "Use 2-space indentation" > "Format properly"

**AC-8.10: Template Customization by Project Type**
- [ ] Different templates for CLI vs. API vs. Library vs. Web App
- [ ] CLI template emphasizes commands, args parsing, user input
- [ ] API template emphasizes routes, middleware, validation
- [ ] Library template emphasizes exports, API surface, versioning
- [ ] Web App template emphasizes components, state, routing

#### Technical Requirements

```typescript
interface OptimizedInstructionConfig {
  // Token optimization
  compressionLevel: 'none' | 'moderate' | 'aggressive';
  targetTokenReduction: number; // 0.3 = 30% reduction

  // Structure
  hierarchyEnabled: boolean;
  criticalRulesCount: number; // Top N rules to front-load

  // Content
  extractCodePatterns: boolean;
  includeDODONT: boolean;
  includeTroubleshooting: boolean;

  // Advanced features
  enableCaching: boolean;
  enableImports: boolean;
  maxCoreFileLines: number; // 300 recommended
}

class LLMOptimizedInstructionGenerator extends InstructionGenerator {
  constructor(config: OptimizedInstructionConfig);

  // Override base methods with optimizations
  generateInstructions(projectInfo: ProjectInfo): string;

  // New methods for optimization
  private compressText(text: string): string;
  private extractCodePatterns(projectInfo: ProjectInfo): CodePattern[];
  private generateDODONTExamples(projectInfo: ProjectInfo): string;
  private generateTroubleshooting(projectInfo: ProjectInfo): string;
  private applyCacheBoundaries(content: string): string;
  private splitIntoModules(content: string): ModularContent;
}

interface CodePattern {
  name: string;
  category: 'tool' | 'schema' | 'command' | 'util';
  example: string;
  location: string; // e.g., "src/tools/*.ts"
}

interface ModularContent {
  core: string; // Main CUSTOM.md
  modules: Map<string, string>; // docs/*.md files
}
```

#### Performance Targets

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| **Token Count** | ~2,500 | ~1,500 | Count with tiktoken |
| **Compression Ratio** | 0% | 30-40% | (original - optimized) / original |
| **LLM Comprehension** | Baseline | +50% | Quality of generated code |
| **Time to First Token** | Baseline | -20% | API latency measurement |
| **API Cost** | Baseline | -60% | With caching enabled |

#### Implementation Phases

**Phase 1: Quick Wins (Week 1)**
- Token compression (remove filler)
- DO/DON'T contrasts
- Remove incorrect tool references
- Add troubleshooting section

**Phase 2: Structure (Week 2)**
- Hierarchical organization
- Critical rules front-loading
- Template customization by project type

**Phase 3: Advanced (Week 3)**
- Code pattern extraction
- Context caching optimization
- File import system

#### Dependencies

- `tiktoken` for token counting
- AST parsers for code pattern extraction (TypeScript compiler API, etc.)
- Markdown parser for modular content
- Text compression utilities

#### Open Questions

- Should we extract code patterns automatically or use predefined templates?
  - **Recommendation:** Hybrid approach - predefined templates + optional automatic extraction
- How often should patterns be re-extracted?
  - **Recommendation:** On every `init --force` or via `ax-cli memory refresh`
- What's the optimal core CUSTOM.md size?
  - **Recommendation:** 200-300 lines, rest in imports
- Should caching be enabled by default?
  - **Recommendation:** Yes, with clear documentation on how it works

---

## Technical Specifications

### Architecture

#### Component Diagram

```
┌─────────────────────────────────────────────────────────┐
│                     CLI Entry Point                     │
│                    (src/index.ts)                       │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                   Init Command                          │
│              (src/commands/init.ts)                     │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │         First-Run Detection                      │  │
│  │    (OnboardingManager.detectFirstRun())          │  │
│  └─────────────────┬────────────────────────────────┘  │
│                    │                                    │
│                    ▼                                    │
│  ┌──────────────────────────────────────────────────┐  │
│  │     Interactive Setup Wizard (if first run)      │  │
│  │         (InitWizard.run())                       │  │
│  │                                                  │  │
│  │  Steps:                                          │  │
│  │  1. Welcome Screen                               │  │
│  │  2. API Configuration                            │  │
│  │  3. Project Analysis                             │  │
│  │  4. Preferences                                  │  │
│  └─────────────────┬────────────────────────────────┘  │
│                    │                                    │
│                    ▼                                    │
│  ┌──────────────────────────────────────────────────┐  │
│  │         Project Analysis                         │  │
│  │    (ProjectAnalyzer.analyze())                   │  │
│  │                                                  │  │
│  │  • Detect language, frameworks                   │  │
│  │  • Scan dependencies                             │  │
│  │  • Identify conventions                          │  │
│  └─────────────────┬────────────────────────────────┘  │
│                    │                                    │
│                    ▼                                    │
│  ┌──────────────────────────────────────────────────┐  │
│  │    Template/Preset Application (optional)        │  │
│  │         (TemplateManager.apply())                │  │
│  └─────────────────┬────────────────────────────────┘  │
│                    │                                    │
│                    ▼                                    │
│  ┌──────────────────────────────────────────────────┐  │
│  │      Validation & Preview                        │  │
│  │         (Validator.check())                      │  │
│  │         (Previewer.show())                       │  │
│  └─────────────────┬────────────────────────────────┘  │
│                    │                                    │
│                    ▼                                    │
│  ┌──────────────────────────────────────────────────┐  │
│  │     File Generation                              │  │
│  │  • InstructionGenerator.generateInstructions()   │  │
│  │  • SettingsGenerator.generateConfig()            │  │
│  │  • IndexGenerator.generateIndex()                │  │
│  └─────────────────┬────────────────────────────────┘  │
│                    │                                    │
│                    ▼                                    │
│  ┌──────────────────────────────────────────────────┐  │
│  │         Progress Tracking                        │  │
│  │      (InitProgress.track())                      │  │
│  └─────────────────┬────────────────────────────────┘  │
│                    │                                    │
│                    ▼                                    │
│  ┌──────────────────────────────────────────────────┐  │
│  │    Completion Summary & Next Steps              │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

#### Data Flow

```
User Input
   │
   ├─ Flags: --template, --preset, --yes, --preview
   ├─ Interactive: Prompts and answers
   └─ Environment: EDITOR, AXCLI_*
   │
   ▼
Configuration Builder
   │
   ├─ Defaults (from constants)
   ├─ User settings (from ~/.ax-cli/config.json)
   ├─ Template (if --template specified)
   ├─ Interactive answers
   └─ CLI flags (highest priority)
   │
   ▼
Merged Configuration
   │
   ▼
Validation Layer
   │
   ├─ Schema validation (Zod)
   ├─ API key format checks
   ├─ File permission checks
   └─ Conflict detection
   │
   ▼
File Generation
   │
   ├─ .ax-cli/CUSTOM.md
   ├─ .ax-cli/settings.json
   ├─ .ax-cli/index.json
   └─ ~/.ax-cli/config.json (if first run)
   │
   ▼
Success State
   │
   └─ First-run flag set
   └─ Ready for use
```

### File Structure Changes

```
src/
├── commands/
│   ├── init.ts                  (Enhanced - orchestration)
│   ├── init/                    (NEW - sub-modules)
│   │   ├── wizard.ts            (Interactive wizard)
│   │   ├── onboarding.ts        (First-run flow)
│   │   ├── templates.ts         (Template management)
│   │   ├── validation.ts        (Validation logic)
│   │   ├── preview.ts           (Preview mode)
│   │   └── progress.ts          (Progress tracking)
│   ├── memory.ts                (NEW - memory management)
│   └── templates.ts             (NEW - template CLI)
│
├── utils/
│   ├── project-analyzer.ts      (Existing - enhanced)
│   ├── instruction-generator.ts (Existing - enhanced)
│   ├── settings-manager.ts      (Existing - enhanced)
│   ├── template-manager.ts      (NEW)
│   └── onboarding-manager.ts    (NEW)
│
├── ui/
│   ├── components/
│   │   ├── wizard-step.tsx      (NEW - wizard UI)
│   │   ├── progress-tracker.tsx (NEW - progress UI)
│   │   ├── preview-display.tsx  (NEW - preview UI)
│   │   └── welcome-screen.tsx   (NEW - welcome UI)
│   └── ...
│
└── schemas/
    ├── template-schema.ts       (NEW - template validation)
    └── init-schema.ts           (NEW - init config validation)

tests/
├── commands/
│   ├── init.test.ts             (NEW - comprehensive)
│   ├── memory.test.ts           (NEW)
│   └── templates.test.ts        (NEW)
├── utils/
│   ├── template-manager.test.ts (NEW)
│   └── onboarding-manager.test.ts (NEW)
└── e2e/
    └── init-flow.test.ts        (NEW - end-to-end)

~/.ax-cli/                       (User directory)
├── config.json                  (User-level settings)
├── templates/                   (Custom templates)
│   ├── my-cli.json
│   └── team-standard.json
└── .first-run                   (First-run marker)

.ax-cli/                         (Project directory)
├── CUSTOM.md                    (Project instructions)
├── settings.json                (Project settings)
├── index.json                   (Project metadata)
└── templates/                   (Team templates - optional)
    └── team-standard.json
```

### API Interfaces

#### InitWizard

```typescript
interface InitWizardOptions {
  nonInteractive?: boolean;
  yes?: boolean;
  template?: string;
  preset?: string;
  preview?: boolean;
}

class InitWizard {
  constructor(options: InitWizardOptions);

  async run(): Promise<InitWizardResult>;

  private async stepWelcome(): Promise<void>;
  private async stepAPIConfig(): Promise<APIConfig>;
  private async stepProjectAnalysis(): Promise<ProjectAnalysis>;
  private async stepPreferences(): Promise<UserPreferences>;
  private async stepCompletion(result: InitWizardResult): Promise<void>;
}

interface InitWizardResult {
  apiConfig: APIConfig;
  projectAnalysis: ProjectAnalysis;
  preferences: UserPreferences;
  files: GeneratedFile[];
  success: boolean;
}
```

#### OnboardingManager

```typescript
class OnboardingManager {
  static detectFirstRun(): boolean;
  static markCompleted(): void;
  static getCurrentState(): OnboardingState;
  static resetOnboarding(): void;
  static shouldShowWelcome(): boolean;
}

interface OnboardingState {
  isFirstRun: boolean;
  setupCompleted: boolean;
  completedAt?: Date;
  version: string;
}
```

#### TemplateManager

```typescript
class TemplateManager {
  async listTemplates(scope?: 'user' | 'project' | 'builtin'): Promise<Template[]>;
  async loadTemplate(name: string): Promise<TemplateConfig>;
  async saveTemplate(name: string, config: TemplateConfig): Promise<void>;
  async deleteTemplate(name: string): Promise<void>;
  async exportTemplate(name: string, path: string): Promise<void>;
  async importTemplate(path: string): Promise<Template>;
  async applyTemplate(name: string, overrides?: Partial<TemplateConfig>): Promise<AppliedConfig>;
}

interface Template {
  name: string;
  scope: 'user' | 'project' | 'builtin';
  path: string;
  config: TemplateConfig;
}
```

#### Validator

```typescript
class InitValidator {
  validateAPIKey(key: string, provider: string): ValidationResult;
  validateModel(model: string, provider: string): ValidationResult;
  validateFilePermissions(directory: string): ValidationResult;
  validateConfigSchema(config: unknown): ValidationResult;
  checkConflicts(directory: string): ConflictResult[];

  async runAllValidations(config: InitConfig): Promise<ValidationReport>;
}

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

interface ValidationReport {
  passed: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: string[];
}
```

#### Previewer

```typescript
class InitPreviewer {
  async generatePreview(config: InitConfig): Promise<PreviewResult>;
  displayPreview(preview: PreviewResult): void;
  async promptForConfirmation(preview: PreviewResult): Promise<'yes' | 'no' | 'edit'>;
}

interface PreviewResult {
  files: PreviewFile[];
  settings: PreviewSettings;
  summary: PreviewSummary;
}

interface PreviewFile {
  path: string;
  size: number;
  content: string;
  action: 'create' | 'update' | 'skip';
  diff?: string; // If updating existing file
}
```

### Configuration Schema

```typescript
// Zod schemas for validation
const APIConfigSchema = z.object({
  provider: z.enum(['glm', 'openai', 'anthropic', 'ollama', 'custom']),
  apiKey: z.string().optional(),
  baseUrl: z.string().url().optional(),
  model: z.string(),
  maxTokens: z.number().optional(),
  temperature: z.number().min(0).max(2).optional(),
});

const UserPreferencesSchema = z.object({
  verbose: z.boolean().default(false),
  autoConfirm: z.boolean().default(false),
  editor: z.string().optional(),
  theme: z.enum(['light', 'dark', 'auto']).default('auto'),
});

const TemplateConfigSchema = z.object({
  name: z.string(),
  description: z.string(),
  version: z.string(),
  author: z.string().optional(),
  projectType: z.enum(['cli', 'web-app', 'api', 'library', 'fullstack']),
  settings: APIConfigSchema,
  instructions: z.object({
    template: z.string(),
    variables: z.record(z.string()).optional(),
  }),
  preferences: UserPreferencesSchema,
  conventions: z.object({
    indentation: z.string().optional(),
    lineLength: z.number().optional(),
    importStyle: z.enum(['esm', 'commonjs']).optional(),
  }).optional(),
});

const InitConfigSchema = z.object({
  api: APIConfigSchema,
  project: ProjectAnalysisSchema,
  preferences: UserPreferencesSchema,
  template: z.string().optional(),
  generateInstructions: z.boolean().default(true),
});
```

### Dependencies

#### New Dependencies

```json
{
  "dependencies": {
    "@clack/prompts": "^0.7.0",   // Interactive prompts (alternative: inquirer)
    "ora": "^8.0.0",               // Spinners
    "cli-progress": "^3.12.0",    // Progress bars
    "diff": "^5.2.0",              // Diff generation
    "marked": "^11.0.0",           // Markdown rendering
    "marked-terminal": "^7.0.0",  // Terminal markdown
    "mustache": "^4.2.0"           // Template rendering
  },
  "devDependencies": {
    "@types/diff": "^5.2.0",
    "@types/mustache": "^4.2.5"
  }
}
```

#### Evaluation: @clack/prompts vs inquirer

| Feature | @clack/prompts | inquirer |
|---------|----------------|----------|
| Bundle Size | ~50 KB | ~200 KB |
| TypeScript | ✅ Native | ⚠️ @types required |
| Modern API | ✅ Promise-based | ✅ Promise-based |
| Styling | ✅ Beautiful defaults | ⚠️ Requires plugins |
| Validation | ✅ Built-in | ✅ Built-in |
| Cancellation | ✅ Ctrl+C friendly | ⚠️ Manual handling |

**Recommendation:** Use `@clack/prompts` for better UX and smaller bundle size.

---

## User Experience Design

### UI/UX Principles

1. **Progressive Disclosure:** Show only what's needed at each step
2. **Smart Defaults:** Pre-select recommended options
3. **Forgiving:** Allow going back, easy to cancel
4. **Informative:** Explain what each choice means
5. **Fast:** Optimize for speed, skip unnecessary prompts

### Interaction Patterns

#### Welcome Flow (First-Time Users)

```
┌─────────────────────────────────────────────┐
│                                             │
│      ╔═╗═╗ ╦   ╔═╗╦  ╦                     │
│      ╠═╣ ╔╬╦╝  ║  ║  ║                     │
│      ╩ ╩ ╩ ╚═  ╚═╝╩═╝╩                     │
│                                             │
│   Enterprise AI Command Line Interface     │
│   Version 2.0.0                             │
│                                             │
└─────────────────────────────────────────────┘

┌─ Welcome ────────────────────────────────────┐
│                                              │
│  👋 Hi! This looks like your first time      │
│  using AX CLI.                               │
│                                              │
│  AX CLI is an enterprise-grade AI coding     │
│  assistant powered by GLM and other models.  │
│                                              │
│  Let's get you set up in under 60 seconds.  │
│                                              │
│  ⏩ Step 1/3: API Configuration              │
│  ⏹ Step 2/3: Project Analysis               │
│  ⏹ Step 3/3: Preferences                    │
│                                              │
│  Press Enter to continue...                  │
│                                              │
└──────────────────────────────────────────────┘
```

#### API Configuration Step

```
┌─ Step 1/3: API Configuration ────────────────┐
│                                              │
│  ? Which AI provider do you want to use?     │
│                                              │
│    ◉ GLM (Recommended)                       │
│      Fast, affordable, 200K context          │
│                                              │
│    ○ OpenAI                                  │
│      GPT-4, GPT-3.5                          │
│                                              │
│    ○ Anthropic                               │
│      Claude 3.5 Sonnet, Opus                 │
│                                              │
│    ○ Ollama (Local)                          │
│      Run models locally, no API key needed   │
│                                              │
│    ○ Custom                                  │
│      Use any OpenAI-compatible API           │
│                                              │
│  ↑↓ Navigate • Enter Select • Esc Cancel     │
│                                              │
└──────────────────────────────────────────────┘
```

#### Project Analysis Step

```
┌─ Step 2/3: Project Analysis ─────────────────┐
│                                              │
│  🔍 Analyzing your project...                │
│                                              │
│    ✓ Language: TypeScript                    │
│    ✓ Type: CLI Tool                          │
│    ✓ Framework: Commander, Ink               │
│    ✓ Testing: Vitest (83+ tests)             │
│    ✓ Build: TypeScript, ESBuild              │
│    ✓ Module: ESM                             │
│    ✓ Structure: src/ (32 files)              │
│    ✓ Conventions: Strict mode, Zod           │
│                                              │
│  ? Generate custom instructions (CUSTOM.md)? │
│    ◉ Yes (Recommended)                       │
│    ○ No, I'll create manually                │
│    ○ Use template instead                    │
│                                              │
│  Analysis complete in 1.2s                   │
│                                              │
└──────────────────────────────────────────────┘
```

#### Preferences Step

```
┌─ Step 3/3: Preferences ──────────────────────┐
│                                              │
│  ? Select your default model:                │
│    ◉ glm-4.6 (Recommended)                   │
│      200K context, reasoning mode            │
│    ○ glm-4-flash                             │
│      Faster, 32K context                     │
│    ○ Custom...                               │
│                                              │
│  ? Enable verbose output?                    │
│    ○ Yes                                     │
│    ◉ No (Default)                            │
│                                              │
│  ? Auto-confirm safe operations?             │
│    ◉ Yes (Default)                           │
│    ○ No, always ask                          │
│                                              │
│  ? Preferred editor for CUSTOM.md:           │
│    ◉ VS Code (detected)                      │
│    ○ Vim                                     │
│    ○ Nano                                    │
│    ○ Other...                                │
│                                              │
└──────────────────────────────────────────────┘
```

#### Completion Summary

```
┌─ Setup Complete! ────────────────────────────┐
│                                              │
│  ✅ You're all set!                          │
│                                              │
│  📦 Configuration Summary:                   │
│    • Provider: GLM                           │
│    • Model: glm-4.6                          │
│    • Project: TypeScript CLI                 │
│    • Auto-confirm: Enabled                   │
│                                              │
│  📂 Created Files:                           │
│    • ~/.ax-cli/config.json                   │
│    • .ax-cli/CUSTOM.md (1.2 KB)              │
│    • .ax-cli/settings.json (342 B)           │
│    • .ax-cli/index.json (1.8 KB)             │
│                                              │
│  🚀 Next Steps:                              │
│    1. Review and customize CUSTOM.md:        │
│       code .ax-cli/CUSTOM.md                 │
│                                              │
│    2. Start coding with AI:                  │
│       ax-cli                                 │
│                                              │
│    3. Get help anytime:                      │
│       ax-cli --help                          │
│                                              │
│  Total setup time: 45 seconds ✨             │
│                                              │
└──────────────────────────────────────────────┘
```

### Experienced User Flow

For users who want to skip interactive prompts:

```bash
# Skip all prompts with sensible defaults
ax-cli init --yes

# Use saved preset
ax-cli init --preset my-cli-defaults

# Non-interactive with explicit values
ax-cli init \
  --provider glm \
  --model glm-4.6 \
  --template cli \
  --no-interaction
```

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `↑` / `↓` | Navigate options |
| `Enter` | Select / Continue |
| `Space` | Toggle (for multi-select) |
| `Esc` | Cancel / Go back |
| `Ctrl+C` | Exit wizard |
| `?` | Show help for current step |
| `Tab` | Auto-complete (where applicable) |

---

## Implementation Plan

### Phase 1: MVP (Weeks 1-3)

**Goal:** Interactive wizard + First-run onboarding + LLM-optimized CUSTOM.md

#### Week 1: Foundation + LLM Optimization (Quick Wins)
- [ ] Install `@clack/prompts` and UI dependencies
- [ ] Install `tiktoken` for token counting
- [ ] Create `InitWizard` class structure
- [ ] Implement `OnboardingManager` with first-run detection
- [ ] Create UI components (welcome screen, step indicator)
- [ ] **LLM-OPT:** Implement token compression in InstructionGenerator
- [ ] **LLM-OPT:** Add DO/DON'T contrasts to templates
- [ ] **LLM-OPT:** Remove incorrect tool references (`view_file`, etc.)
- [ ] Write unit tests for new utilities

#### Week 2: Interactive Wizard + LLM Structure
- [ ] Implement API configuration step
- [ ] Implement project analysis step (integrate existing analyzer)
- [ ] Implement preferences step
- [ ] Add validation logic
- [ ] Create completion summary
- [ ] **LLM-OPT:** Implement hierarchical structure (Critical → Overview → Details)
- [ ] **LLM-OPT:** Add troubleshooting section generation
- [ ] **LLM-OPT:** Template customization by project type (CLI/API/Library/Web)
- [ ] Write integration tests

#### Week 3: Polish & Testing + LLM Validation
- [ ] Add progress tracking and feedback
- [ ] Implement non-interactive mode (`--yes`, `--no-interaction`)
- [ ] Error handling and recovery
- [ ] Write E2E tests for full flow
- [ ] **LLM-OPT:** Measure token count reduction (target: 30-40%)
- [ ] **LLM-OPT:** Validate LLM comprehension improvements
- [ ] **LLM-OPT:** Test with actual AI coding sessions
- [ ] Documentation updates
- [ ] Internal testing and bug fixes

**Deliverables:**
- ✅ Interactive setup wizard working
- ✅ First-run detection and onboarding
- ✅ LLM-optimized CUSTOM.md generation (30-40% token reduction)
- ✅ > 90% test coverage
- ✅ Updated documentation

---

### Phase 2: Templates & Memory (Weeks 4-5)

**Goal:** Template system + Memory management commands

#### Week 4: Template System
- [ ] Create `TemplateManager` class
- [ ] Implement built-in templates (cli, web-app, api, library)
- [ ] Add `--template` flag to init command
- [ ] Create `ax-cli templates` command group
  - [ ] `list`, `show`, `save`, `delete`, `export`, `import`
- [ ] Write template validation schemas
- [ ] Write tests for template functionality

#### Week 5: Memory Management
- [ ] Create `ax-cli memory` command
- [ ] Implement `show`, `add`, `edit`, `reset` subcommands
- [ ] Add section-based editing
- [ ] Integrate with existing `CUSTOM.md` generation
- [ ] Write tests for memory commands
- [ ] Documentation and examples

**Deliverables:**
- ✅ Template system fully functional
- ✅ Memory management commands working
- ✅ > 95% test coverage maintained
- ✅ User guide with examples

---

### Phase 3: Advanced Features + LLM Optimization (Weeks 6-7)

**Goal:** Preview mode, validation, enhanced feedback, advanced LLM features

#### Week 6: Validation & Preview + Code Pattern Extraction
- [ ] Create `InitValidator` class
- [ ] Implement all validation checks
- [ ] Create `InitPreviewer` class
- [ ] Add `--preview` and `--dry-run` modes
- [ ] Implement diff view for existing files
- [ ] Interactive edit option
- [ ] **LLM-OPT:** Implement code pattern extraction from codebase
- [ ] **LLM-OPT:** AST parsing for TypeScript/JavaScript patterns
- [ ] Write tests

#### Week 7: Enhanced Feedback & Advanced LLM Features
- [ ] Implement detailed progress tracking
- [ ] Add timing information
- [ ] Improve error messages with suggestions
- [ ] Add `--verbose` mode enhancements
- [ ] **LLM-OPT:** Implement context caching boundaries
- [ ] **LLM-OPT:** File import system for modular CUSTOM.md
- [ ] **LLM-OPT:** Measure API cost reduction with caching (target: 60%)
- [ ] Performance optimization
- [ ] Final testing and bug fixes
- [ ] Release preparation

**Deliverables:**
- ✅ Preview and validation working
- ✅ Enhanced progress feedback
- ✅ Advanced LLM optimizations (pattern extraction, caching, imports)
- ✅ 60%+ API cost reduction with caching enabled
- ✅ Comprehensive test suite
- ✅ Ready for production release

---

### Release Strategy

#### Alpha Release (End of Phase 1)
- Internal testing only
- Gather feedback from team
- Iterate on UX

#### Beta Release (End of Phase 2)
- Limited public release (opt-in flag)
- Community testing
- Bug fixes and refinements

#### Production Release (End of Phase 3)
- Full public release as v2.0
- Marketing and announcement
- Migration guide for existing users

---

## Testing Strategy

### Test Pyramid

```
        ┌─────────────┐
        │  E2E Tests  │  (10%)
        │   5 tests   │
        └─────────────┘
       ┌───────────────┐
       │ Integration   │  (30%)
       │  Tests        │
       │  15 tests     │
       └───────────────┘
      ┌─────────────────┐
      │  Unit Tests     │  (60%)
      │  50+ tests      │
      └─────────────────┘
```

### Test Coverage Requirements

| Component | Target Coverage | Critical Paths |
|-----------|----------------|----------------|
| `init.ts` | > 95% | All wizard steps, error handling |
| `wizard.ts` | > 95% | Step execution, validation |
| `onboarding.ts` | > 90% | First-run detection, state management |
| `templates.ts` | > 95% | Template load/save, application |
| `validation.ts` | > 95% | All validation rules |
| `preview.ts` | > 90% | Preview generation, diff creation |

### Test Scenarios

#### Unit Tests
- ✅ First-run detection logic
- ✅ Each wizard step in isolation
- ✅ Validation rules (API key, model, file permissions)
- ✅ Template loading and application
- ✅ Configuration merging (defaults → user → CLI flags)
- ✅ File generation (CUSTOM.md, settings.json, index.json)
- ✅ Error handling for each component

#### Integration Tests
- ✅ Complete wizard flow (interactive)
- ✅ Complete wizard flow (non-interactive with `--yes`)
- ✅ Template-based initialization
- ✅ Existing file handling (--force)
- ✅ Migration from legacy `.grok` directories
- ✅ Settings merging across scopes

#### E2E Tests
- ✅ First-time user onboarding (full flow)
- ✅ Experienced user quick init (with preset)
- ✅ Team lead template creation and sharing
- ✅ Error recovery (invalid API key, network failure)
- ✅ Dry-run and preview modes

### Performance Benchmarks

| Operation | Target | Measurement |
|-----------|--------|-------------|
| Init (small project) | < 1 sec | Time to complete analysis + file creation |
| Init (large project, 10K files) | < 3 sec | Same as above |
| Template application | < 100 ms | Load and apply template |
| Validation checks | < 200 ms | All validation rules |
| Preview generation | < 500 ms | Generate preview for 3 files |

---

## Risks & Mitigations

### Risk Matrix

| Risk | Probability | Impact | Severity | Mitigation |
|------|-------------|--------|----------|------------|
| **Complexity Creep** | Medium | High | 🔴 High | Strict scope control, phased rollout |
| **User Confusion** | Medium | High | 🔴 High | Extensive testing, clear UI/UX, help text |
| **Backward Incompatibility** | Low | High | 🟡 Medium | Migration logic, deprecation warnings |
| **Performance Degradation** | Low | Medium | 🟡 Medium | Benchmark tests, lazy loading |
| **Dependency Issues** | Low | Medium | 🟡 Medium | Careful dependency selection, lock versions |
| **Test Coverage Gaps** | Medium | Medium | 🟡 Medium | Mandatory coverage thresholds, code review |
| **Poor First Impression** | High | High | 🔴 High | User testing, iteration on UX |

### Detailed Mitigations

#### 1. Complexity Creep
**Risk:** Feature scope expands beyond plan, delaying release.

**Mitigation:**
- Strict adherence to phased rollout plan
- P0 features only in Phase 1
- Regular scope review meetings
- "Nice-to-have" features deferred to Phase 3 or post-release

#### 2. User Confusion
**Risk:** Interactive wizard overwhelms or confuses users.

**Mitigation:**
- User testing with real developers
- Clear, concise prompts with examples
- Progressive disclosure (don't show everything at once)
- Comprehensive help text at each step
- Ability to skip/cancel at any time
- Detailed documentation with GIFs/videos

#### 3. Backward Incompatibility
**Risk:** Existing users' configs break after upgrade.

**Mitigation:**
- Automatic migration from old formats
- Deprecation warnings for old commands
- Maintain backward compatibility for at least 2 versions
- Clear migration guide in release notes
- Test suite includes upgrade scenarios

#### 4. Performance Degradation
**Risk:** New features slow down init command.

**Mitigation:**
- Benchmark tests in CI/CD
- Lazy loading for optional features
- Optimize file scanning (use existing project-analyzer)
- Profile and optimize before release
- Performance regression tests

#### 5. Dependency Issues
**Risk:** New dependencies introduce bugs or bloat.

**Mitigation:**
- Evaluate dependencies carefully (bundle size, maintenance)
- Lock dependency versions in package.json
- Test with multiple Node versions
- Have fallback for optional dependencies
- Monitor bundle size in CI

#### 6. Test Coverage Gaps
**Risk:** Insufficient testing leads to bugs in production.

**Mitigation:**
- Mandatory 95% coverage threshold
- Code review process requires tests
- Automated coverage reporting in CI
- E2E tests for critical user journeys
- Beta testing period before release

#### 7. Poor First Impression
**Risk:** New onboarding frustrates users instead of delighting them.

**Mitigation:**
- Internal dogfooding (team uses it daily)
- External beta testing with volunteers
- Collect feedback early and often
- Iterate on UX based on real usage
- A/B test different onboarding flows (if feasible)
- Measure time-to-first-success metric

---

## Appendices

### Appendix A: Competitive Analysis Details

#### Claude Code

**Strengths:**
- 30-second setup flow
- 4-tier memory hierarchy
- `#` shortcut for quick instruction adds
- Excellent documentation
- Permission-based safety

**Weaknesses:**
- No templates or presets
- Limited customization during init
- Requires Claude.ai subscription or Console account

**Lessons for AX CLI:**
- Prioritize speed and simplicity
- Make onboarding feel effortless
- Provide clear next steps after setup

---

#### Cursor AI

**Strengths:**
- Conversational planning
- Integrated IDE experience
- Good chat-based UX

**Weaknesses:**
- No traditional init command
- Less structured onboarding
- Beta security concerns

**Lessons for AX CLI:**
- Chat-style prompts can feel natural
- But structured wizard may be clearer for CLI

---

#### Aider

**Strengths:**
- Simple YAML config
- Clear `.aider.conf.yml` file
- Multi-provider support

**Weaknesses:**
- No init command
- Manual config editing required
- Limited onboarding

**Lessons for AX CLI:**
- YAML is readable but JSON+Zod is safer
- Auto-generation >> manual editing

---

#### Continue.dev

**Strengths:**
- VSCode integration
- Good config wizard in UI
- Template support

**Weaknesses:**
- Extension-only (not CLI)
- Complex config structure
- Requires IDE

**Lessons for AX CLI:**
- Templates are valuable
- GUI wizards inspire CLI interactive design

---

### Appendix B: User Research Summary

(To be filled in during beta testing)

**Methodology:**
- 10-15 user interviews
- Task-based usability testing
- Time-to-first-success measurement
- Post-onboarding survey

**Key Findings:**
- TBD

**Recommendations:**
- TBD

---

### Appendix C: Migration Guide

#### For Existing Users

**Upgrading from AX CLI v1.x to v2.0:**

1. **Before Upgrade:**
   ```bash
   # Backup current config
   cp ~/.ax-cli/config.json ~/.ax-cli/config.json.backup
   cp .ax-cli/CUSTOM.md .ax-cli/CUSTOM.md.backup
   ```

2. **Upgrade:**
   ```bash
   npm update -g ax-cli
   ```

3. **Re-initialize (Optional):**
   ```bash
   # In each project
   ax-cli init --force
   ```

4. **What Changes:**
   - New first-run onboarding (won't trigger if you're upgrading)
   - Enhanced CUSTOM.md with more sections
   - New template system available
   - New `ax-cli memory` and `ax-cli templates` commands

5. **Breaking Changes:**
   - None! v2.0 is fully backward compatible

---

### Appendix D: Glossary

| Term | Definition |
|------|------------|
| **First-Run** | The initial launch of AX CLI after installation, triggering onboarding |
| **Onboarding** | The guided setup process for new users |
| **Wizard** | Step-by-step interactive prompt flow |
| **Template** | Pre-configured settings and instructions for specific project types |
| **Preset** | Saved user configuration for quick project initialization |
| **CUSTOM.md** | Markdown file containing project-specific AI instructions |
| **Memory** | The system of persistent instructions (CUSTOM.md) |
| **Preview Mode** | Showing what would be created without actually writing files |
| **Dry Run** | Simulating the full process without making any changes |
| **Validation** | Checking configuration for errors before applying |

---

### Appendix E: Success Criteria Checklist

**Before Release:**

- [ ] All P0 acceptance criteria met
- [ ] Test coverage > 95% for init module
- [ ] Performance benchmarks pass
- [ ] Documentation complete
- [ ] Beta testing feedback addressed
- [ ] Migration guide written
- [ ] Release notes prepared
- [ ] Marketing materials ready

**Post-Release (30 days):**

- [ ] Time to first success < 60 seconds (measured)
- [ ] Setup completion rate > 90%
- [ ] < 5 critical bugs reported
- [ ] User satisfaction survey > 4.0/5
- [ ] Support tickets for "getting started" reduced by 50%

**Post-Release (90 days):**

- [ ] 30-day user retention > 70%
- [ ] User satisfaction > 4.5/5
- [ ] GitHub stars +20%
- [ ] Positive community feedback
- [ ] Template ecosystem growing (community templates shared)

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1 | 2025-11-19 | Claude + AX Agent | Initial draft - all sections |
| 0.2 | TBD | Team Review | Incorporate feedback |
| 1.0 | TBD | Final Approval | Release version |

---

## Approval Signatures

**Product Owner:** _________________ Date: _______

**Engineering Lead:** _________________ Date: _______

**QA Lead:** _________________ Date: _______

---

**End of PRD**

Total Pages: 22
Word Count: ~12,000
Estimated Reading Time: 45 minutes
