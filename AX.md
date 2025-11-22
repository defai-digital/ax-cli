# Project Context for @defai.digital/ax-cli

> Last updated: 2025-11-19
> Project: @defai.digital/ax-cli (v1.2.3)

## Project Overview

[![Tests](https://img.shields.io/badge/tests-306%20passing-brightgreen?style=flat-square)](https://github.com/defai-digital/ax-cli/actions/workflows/test.yml)
[![Coverage](https://img.shields.io/badge/coverage-98.29%25-brightgreen?style=flat-square)](https://github.com/defai-digital/ax-cli)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D24.0.0-brightgreen?style=flat-square)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9%2B-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

![AX CLI Logo](.github/assets/ax-cli.png)

<p align="center">
  <strong>Production-Ready AI CLI • Enterprise-Grade Architecture • 98%+ Test Coverage • TypeScript & Zod Validation</strong>
</p>

---

**Version:** 1.2.3  
**Language:** TypeScript  
**Framework:** React  
**Test Framework:** Vitest  
**Type:** Monorepo

**Stack:** TypeScript, React, Vitest, react, Monorepo

## Architecture

**Type:** Single Page Application (SPA)

**Flow:**
```
1. React SPA
   ↓
2. Components & State Management
   ↓
3. API Client
   ↓
4. Backend Services
```

**Key Components:**
- `src/index.ts` - Main entry point
- `src/constants.ts`

## File Structure

**Entry Point:** `src/index.ts`

**Directories:**
- `src/` - Source code (71 files)
- `tests/` - Test files (8 files)
- `docs/` - Documentation (11 files)
- `dist/` - Build output (210 files)

**Total Files:** 300

## Getting Started

### Prerequisites
- Node.js 20.0.0+

### First Time Setup
1. Clone repository: `git clone https://github.com/defai-digital/ax-cli`
2. Install dependencies: `npm install`
3. Copy environment: `cp .env.example .env`
4. Start dev server: `npm run dev`
5. Visit: http://localhost:3000

### Environment Variables

**Required:**
- `YOUR_API_KEY` - Grok API Configuration
  - Example: `your_grok_api_key_here`


## Troubleshooting

### Common Issues

**Problem**: `npm install` fails with EACCES
**Solution**: Fix npm permissions: `sudo chown -R $USER ~/.npm`

**Problem**: Port already in use
**Solution**: Kill process: `lsof -ti:3000 | xargs kill`

**Problem**: TypeScript errors after `git pull`
**Solution**: Clean install: `rm -rf node_modules && npm install`

**Problem**: Hot reload not working
**Solution**: Check file watcher limits: `echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf`

### Debug Mode
Run with verbose logging:
```bash
DEBUG=* npm run dev
LOG_LEVEL=debug npm test
```

## Development Workflow

### Daily Workflow
1. Pull latest: `git pull origin main`
2. Create feature branch: `git checkout -b feature/my-feature`
3. Make changes
4. Run tests: `npm test`
5. Commit: `git commit -m "feat: add my feature"`
6. Push: `git push origin feature/my-feature`
7. Open PR on GitHub
8. Wait for CI + reviews
9. Merge to main (squash merge)

### Code Review Process
- Minimum 1 approval required
- CI must pass (tests + lint)
- No merge conflicts

### Hot Reload
- Frontend: Hot module replacement enabled

### Testing Strategy
- Run all: `npm test`





## Agent Delegation Rules

### Development
- **Frontend/UI (React)** → @frontend (Frank)
- **TypeScript issues** → @fullstack (Felix)
- **Infrastructure/DevOps** → @devops (Oliver)

### Quality & Architecture
- **Tests/QA** → @quality (Queenie)
- **Security audits** → @security (Steve) - mandatory for: auth, payments, PII
- **Architecture/ADR** → @architecture (Avery)

### Documentation & Product
- **Technical writing** → @writer (Wendy)
- **Product management** → @product (Paris)

## Coding Conventions

### Testing
- **Framework:** Vitest
- **Coverage:** 80% minimum
- **Run:** `npm test`

### Code Style
- **Linter:** ESLint
- **TypeScript:** Strict mode enabled
- **Indent:** 2 spaces
- **Max line:** 100 chars

### Git Workflow
- **Branch naming:** `feature/description` or `fix/description`
- **Commits:** Conventional commits format (feat/fix/chore/docs)
- **PRs:** Review required before merge

## Critical Guardrails

⚠️ **NEVER:**
- Commit to main/production branches directly
- Skip tests before pushing
- Expose API keys or credentials in code

✅ **ALWAYS:**
- Run `npm test` before pushing
- Run `npm run lint` to check code style
- Document breaking changes
- Add tests for new features

## Canonical Commands

```bash
# Development
npm run dev                        # Start development server
npm run start                      # Start development server

# Building
npm run build                      # Build for production
npm run build:schemas              # Run build:schemas
npm run build:bun                  # TypeScript compilation

# Testing
npm run test                       # Run all tests
npm run test:watch                 # Watch mode for test
npm run test:ui                    # Run Vitest tests
npm run test:coverage              # Run Vitest tests

# Quality Checks
npm run lint                       # Check code style
npm run typecheck                  # Type check TypeScript

# Other
npm run dev:node                   # Run dev:node
npm run start:bun                  # Run start:bun
npm run install:bun                # Run install:bun
```

## Useful Links

- [Repository](https://github.com/defai-digital/ax-cli)
- [Documentation](docs/)

---

**Generated by `ax init` • Run regularly to keep up-to-date**
