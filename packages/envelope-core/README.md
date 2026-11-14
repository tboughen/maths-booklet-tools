# envelope-core

The shared foundation under every diagram family's saved file (its "envelope").

- `sha256Hex(text)`: the one SHA-256 used for every `contentHash`.
- `sortedJson(value)`: canonical JSON with sorted keys, for new families.
- `toBase64Url` / `fromBase64Url`: the one editor-link encoding.
- `defineEnvelope({ kind, validate, canonical })`: a family's `canonical`, `contentHash`,
  `encodeLink` and `decodeLink` from its validator and canonical rule.

## Hash stability

A `contentHash` is the SHA-256 of a family's canonical JSON. Models quote it back as `baseHash`
when revising, and editor links carry the same canonical text, so it must not drift.

The twelve families that existed before this package use **schema-order** canonical JSON
(`JSON.stringify` of the validated envelope, so keys follow the zod schema). Graph and ratio
table have their own canonical writers. All of them are frozen by the golden corpus:

- `fixtures/corpus/<kind>/*.json`: real saved envelopes, including every historical schema
  version we hold (bar model 1, 2 and 3; cuboids 1 and 2; Venn 1 and 2; ratio table 1 and 2;
  triangle 1 and 2). Files are only ever added, never removed or edited.
- `fixtures/golden.json`: each file's schema version, contentHash and the SHA-256 of its pupil
  and answer SVG.
- `packages/diagram-core/src/golden.test.ts` fails if any of those change.

A zod upgrade or schema edit that reorders keys, or a renderer change that moves a single byte,
therefore fails CI instead of silently breaking saved files, links and in-flight revisions. If a
change is intended, regenerate with `UPDATE_GOLDEN=1 npx vitest run packages/diagram-core/src/golden.test.ts`
and say in the pull request which files changed and why.

New families should use `canonical: "sorted"`, which does not depend on schema order.

To add a file to the corpus, save it under `fixtures/corpus/<kind>/` and regenerate the golden file.
