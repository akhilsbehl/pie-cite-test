# pie-cite-test

A Pi extension that tests whether cited web sources support explicit claims.

It implements the failure checks described in the linked Reddit discussion:

- Does the source support the claim as written?
- Does one citation support every material part, or was the claim stitched from several sources?
- Does the source fit the user's topic and freshness constraints?

The extension reads each URL through Jina Reader. It then sends the claim, request context, URL, and source text to JEV as three bounded decisions. A citation passes only when JEV marks it as supported, complete from that source alone, and not mismatched to the request.

## Requirements

- Node.js 22.19 or newer
- `JINA_API_KEY`
- `OPENROUTER_API_KEY`

## Install

```bash
npm install
npm run build
pi --extension ./dist/pie-cite-test.mjs
```

Pi can also load the project directory through the `extensions` setting.

## Tool

The extension registers `cite_test`.

```json
{
  "citations": [
    {
      "claim": "The product launched in March 2025.",
      "url": "https://example.com/announcement",
      "context": "Use first-party sources published in 2025."
    }
  ]
}
```

Pass explicit claim-to-source pairs. Split compound claims when different sources support different parts. Failed reads and uncertain results do not pass.

## Source note

Reddit blocked direct automated access to the supplied thread. The implementation uses the thread title and an indexed summary of its main findings. Source: <https://www.promppy.com/item/1861902>.

## Development

```bash
npm run typecheck
npm test
npm run build
```
