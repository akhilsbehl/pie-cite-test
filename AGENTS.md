# pie-cite-test project instructions

This project is an Akhil-owned, personal-use Pi extension. It checks whether cited web sources support explicit claims by combining Jina Reader source text with JEV bounded decisions.

## Development

- Use Node.js 22.19 or newer.
- Run `npm run typecheck` and `npm test` after source changes.
- Run `npm run build` after source changes.
- Track generated `dist/` files because the package entry point uses them.
- Do not track `node_modules/`.
