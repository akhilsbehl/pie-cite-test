# pie-cite-test project instructions

This project is an Akhil-owned, personal-use Pi extension that checks whether cited web sources support explicit claims by combining Jina Reader source text with JEV bounded decisions.

## Development

- Use Node.js 22.19 or newer.
- Run `npm run typecheck` for TypeScript checks.
- Run `npm test` for the Vitest suite.
- Run `npm run build` after source changes.
- The generated `dist/` files are tracked because the package entry points at them. Keep them synchronized with source changes.
- Do not track `node_modules/`.

## Submodule development

This project is checked out as a Git submodule of `configs`. For normal development, switch from the parent's detached pinned commit to a named child branch before editing. Commit and push changes in this child repository, then update the parent repository's submodule pin in a separate commit. Use the detached pinned state only for read-only verification, reproduction, or testing the exact parent integration.
