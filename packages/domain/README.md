# @foss-tasks/domain

Pure, framework-agnostic domain logic (ADR-0004), shared by the Device and — from
#17 — the backend write path.

```
src/
  ids.ts         Client-generated UUID pks (ADR-0005 §1)
  order-key.ts   Fractional-index ordering (ADR-0005 §4)
  lww.ts         Last-write-wins merge (ADR-0005 §2)
  row.ts         Base syncable / orderable row shapes
```

## Why this is a package and not a folder

`pickLwwWinner` has three tie-breaking rules, not one. If the server reimplements
them, the two sides eventually disagree about the same pair of rows — and sync
cannot repair that, because both sides believe they converged. So there is
exactly one copy, and both consumers import it (ADR-0008 §11).

## Why it ships compiled JS

Its two consumers cannot agree on raw TypeScript:

- `services/*` use `"module": "NodeNext"` — relative imports **require** a `.js`
  extension.
- Metro **rejects** the `.js`→`.ts` mapping. This is the exact failure that made
  T02's bundle never build once (`docs/agents/verification.md`).

Compiled plain JS satisfies both, so `tsc` emits ESM + `.d.ts` to `dist/` and the
package is exposed via **`main`**. There is deliberately **no `exports` field**:
Metro's package-exports support is behind a flag in RN 0.76, while `main`
resolves everywhere.

Two consequences worth knowing:

- Source files write relative imports **with** the `.js` extension, so the
  emitted output is valid Node ESM. Metro only ever sees `dist/`, where those
  files genuinely exist.
- Consumers resolve `dist/`, so **build before you typecheck or test them** — an
  unbuilt package looks like a missing module. The root `npm run typecheck` and
  `npm test` do this for you.

```sh
npm run build -w @foss-tasks/domain
npm test  -w @foss-tasks/domain
```
