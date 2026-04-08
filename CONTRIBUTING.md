# Contributing to BillClaw

Thank you for your interest in contributing to BillClaw! This document provides guidelines for contributing to the project.

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Focus on what is best for the community
- Show empathy towards other community members

## Getting Started

### Prerequisites

- Node.js >= 20.0.0
- pnpm >= 9.0.0
- Git

### Setup Development Environment

```bash
# Fork and clone the repository
git clone https://github.com/YOUR_USERNAME/billclaw.git
cd billclaw

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test
```

## Development Workflow

### Branch Organization

- `main` - Stable production code
- `develop` - Integration branch for features
- `feature/*` - Feature branches
- `fix/*` - Bugfix branches
- `docs/*` - Documentation updates

### Making Changes

1. Create a branch from `develop`
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/your-feature-name
   ```

2. Make your changes
   - Follow the coding standards below
   - Add tests for new functionality
   - Update documentation as needed

3. Commit your changes
   ```bash
   git add .
   git commit -m "feat: add support for new feature"
   ```

4. Push and create a pull request
   ```bash
   git push origin feature/your-feature-name
   ```

## Coding Standards

### Language

All code and documentation must be in **English**:
- Code comments
- Variable/function names
- Commit messages
- Error messages
- Documentation

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

Types:
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation changes
- `style` - Code style changes (formatting)
- `refactor` - Code refactoring
- `test` - Adding or updating tests
- `chore` - Maintenance tasks
- `ci` - CI/CD changes
- `perf` - Performance improvements

Examples:
```
feat(plaid): add support for webhook notifications
fix(gmail): handle empty email body gracefully
docs(readme): update installation instructions
```

### TypeScript Style

- Use TypeScript strict mode
- Provide meaningful type annotations
- Prefer `interface` for public APIs
- Prefer `type` for unions and intersections
- Use `readonly` for immutable properties
- Avoid `any` - use `unknown` when necessary

### Testing

- Write tests for new functionality
- Maintain test coverage above 80%
- Use Vitest for unit tests
- Place tests alongside source files (*.test.ts)

Example:
```typescript
// my-function.test.ts
import { describe, it, expect } from "vitest";
import { myFunction } from "./my-function.js";

describe("myFunction", () => {
  it("should return expected result", () => {
    expect(myFunction("input")).toBe("output");
  });
});
```

### Code Formatting

- Use oxfmt for formatting
- Use oxlint for linting
- Pre-commit hooks enforce formatting

```bash
pnpm lint    # Check code style
pnpm format  # Format code
```

## Pull Request Guidelines

### PR Title

Use the same format as commit messages:
```
feat(plaid): add webhook support
```

### PR Description

Include:
- Summary of changes
- Motivation for the change
- Related issues
- Testing performed
- Screenshots (if applicable)

### Review Process

1. Automated checks must pass (CI)
2. Code review approval required
3. Maintainable and well-documented code
4. Tests for new features

### Merge Requirements

- All CI checks pass
- At least one approval
- No merge conflicts
- Documentation updated

## Project Structure

```
billclaw/
├── packages/
│   ├── core/          # Framework-agnostic core
│   │   ├── src/
│   │   │   ├── models/      # Data models and schemas
│   │   │   ├── storage/     # Transaction storage
│   │   │   ├── sync/        # Sync service
│   │   │   ├── sources/     # Data source integrations
│   │   │   ├── exporters/   # Format exporters
│   │   │   ├── credentials/ # Credential management
│   │   │   ├── security/    # Security features
│   │   │   └── runtime/     # Runtime abstractions
│   │   └── test/
│   ├── openclaw/      # OpenClaw plugin
│   │   ├── src/
│   │   │   ├── tools/       # Agent tools
│   │   │   ├── cli/         # CLI commands
│   │   │   ├── oauth/       # OAuth providers
│   │   │   └── runtime/     # Runtime adapter
│   │   └── test/
│   └── cli/           # Standalone CLI
│       ├── src/
│       │   ├── commands/    # CLI commands
│       │   ├── runtime/     # CLI runtime
│       │   └── utils/       # CLI utilities
│       └── test/
└── .github/
    └── workflows/     # CI/CD
```

## Questions?

- Open an issue for bugs or feature requests
- Start a discussion for questions
- Check existing documentation first

## License

By contributing, you agree that your contributions will be licensed under the GNU Affero General Public License v3.0 (AGPL-3.0).
