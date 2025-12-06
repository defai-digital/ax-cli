# Custom Instructions for AX CLI

**Project**: @defai.digital/ax-cli v3.12.8
**Type**: cli
**Language**: TypeScript
**Stack**: React, Vitest, Zod, Commander, Ink, ESM, TypeScript

Generated: 11/30/2025, 8:45:19 PM

## Project Context

- **Entry Point**: `dist/index.js`
- **Package Manager**: pnpm
- **Module System**: ESM
- **CLI Tool**: This is a command-line interface application

## Code Conventions

### TypeScript
- Use explicit type annotations for function parameters and returns
- Prefer `const` and `let` over `var`
- Use strict mode (strict type checking enabled)
- **CRITICAL**: Always use `.js` extension in import statements (ESM requirement)
  - Example: `import { foo } from "./bar.js"` (NOT "./bar" or "./bar.ts")

### ES Modules
- Use `import/export` syntax (not `require/module.exports`)
- Top-level await is supported

### Validation
- Use **zod** for runtime validation
- Validate all external inputs (API requests, file reads, user input)
- Use `.safeParse()` for error handling

## File Structure

- **Source Code**: `src/`
- **Tests**: `tests/`
- **Tools**: `src/tools/`

### Typical Structure
- Commands: `src/commands/`
- Utilities: `src/utils/`
- Types: `src/types/`

### Key Files
- `package.json`: Node.js package configuration
- `tsconfig.json`: TypeScript configuration
- `vitest.config.ts`: Vitest test configuration
- `.eslintrc.js`: ESLint configuration
- `README.md`: Project documentation
- `CLAUDE.md`: Claude-specific instructions

## Development Workflow

### Before Making Changes
1. Read relevant files with `view_file` to understand current implementation
2. Use `search` to find related code or patterns
3. Check existing tests to understand expected behavior

### Making Changes
1. **NEVER** use `create_file` on existing files - use `str_replace_editor` instead
2. Make focused, atomic changes
3. Preserve existing code style and patterns
4. Update related tests when modifying functionality

### After Changes
1. Run linter: `eslint . --ext .js,.jsx,.ts,.tsx`
2. Run tests: `vitest run`
3. Build: `npm run build:schemas && tsc && chmod +x dist/index.js`

## Testing Guidelines

### Vitest
- Use `describe`, `it`, `expect` for test structure
- Place tests in `tests/` directory or `*.test.ts` files
- Test edge cases: empty inputs, null/undefined, boundary conditions
- Include Unicode and special character tests where relevant

### Coverage Requirements
- Aim for high test coverage (80%+ for new code)
- Always test error paths and edge cases
- Test both success and failure scenarios

## Available Scripts

- **Development**: `tsx src/index.ts`
- **Build**: `npm run build:schemas && tsc && chmod +x dist/index.js`
- **Test**: `vitest run`
- **Lint**: `eslint . --ext .js,.jsx,.ts,.tsx`

### Quick Commands
```bash
pnpm dev    # Start development
pnpm test   # Run tests
pnpm build  # Build for production
```