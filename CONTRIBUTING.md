# Contributing to forgejo-mcp

## Getting Started
1. Fork the repository
2. Clone your fork
3. Install dependencies: `npm install`
4. Create a branch: `git checkout -b feature/my-feature`

## Development
- Run in dev mode: `npm run dev`
- Run tests: `npm test`
- Type check: `npx tsc --noEmit`
- Build: `npm run build`

## Adding New Tools
1. Find the appropriate file in `src/tools/`
2. Add your tool using `server.tool(name, description, schema, handler)`
3. Add tests in `src/__tests__/tools/`
4. Update the README tools table

## Commit Messages
Use conventional commits: `feat:`, `fix:`, `docs:`, `chore:`, etc.

## Pull Requests
- Keep PRs focused on a single change
- Include tests for new tools
- Update documentation as needed
