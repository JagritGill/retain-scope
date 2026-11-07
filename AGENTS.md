# Working on retain-scope

Purpose: explain individual and collective retention in a small supplied strong-
reference graph. Start with [README](README.md), [architecture](docs/architecture.md)
and [related work](docs/related-work.md). All examples are synthetic.

File map: `src/model.ts` validates/copies/sorts; `src/analyze.ts` calculates pure
graph results; `src/report.ts` formats text; `cli.mjs` handles bounded input and
status; `tests/` provides behavioral/oracle/CLI/release checks;
`scripts/check-release.mjs` owns the explicit source inventory.

## Commands and verification scope

Use Node >=24.4. No installation is needed for these verified local commands:

```sh
node cli.mjs examples/shared-caches.json
node cli.mjs examples/shared-caches.json --format json
node cli.mjs examples/nested-removal.json
node cli.mjs examples/root-pinned.json
node cli.mjs --help
npm run demo
npm test
npm run check:release
```

All should exit 0. Invalid input/usage exits 2, with no partial stdout report.
For compiler setup use `npm ci --ignore-scripts --no-audit --no-fund`, then
`npm run check:types`. The local build verified that command with existing
TypeScript 6.0.3 on PATH; clean installation was not run. Strict checking covers
`src/**/*.ts`, not the JavaScript CLI/tests/checker. No linter is configured.
Node 24.4.1 was tested locally. The initial published commit passed Node 24/26 CI,
including clean compiler installation; the README links that observed run.
Verify actual final-commit results before making claims about subsequent changes.

## Invariants and pitfalls

- Preserve exact BigInt arithmetic and decimal-string byte output. A zero-byte
  node can still dominate and retain others.
- Include virtual-root edges even if a declared root has ordinary predecessors.
  Never count originally unreachable objects as newly unreachable.
- Group comparison subtracts the **union**, not sum, of singleton cuts. Joint-only
  membership does not mean all selected members are necessary in a larger group.
- Stable UTF-16 string sorting, well-formed IDs and nonmutation are part of the
  contract. Keep prototype-like names safe; no ID-keyed plain-object lookup.
- Require `parseGraph` before `analyze`. Keep bounds, strict fields and strong-
  reference semantics. Duplicate JSON keys are last-wins, not rejected.
- Removal deletes vertices/root membership in the supplied model; never label
  reported bytes as actual measured/freeable runtime memory or a leak verdict.

For semantic changes add a meaningful regression and run the independent oracle,
type check, examples and release check. Update exact README output and inventory
when intentional changes require them. Avoid tests that merely restate a new
implementation. Document unsupported cases and checks that were not run.

## Ownership and handoff

Check status and current owner before editing. Preserve unrelated local changes;
do not discard, stage or publish another task's work. Keep runtime offline and
inputs synthetic; do not import private/customer/employer heaps or source. No
CodeRabbit, paid reviewers, hardware actions or credential/security changes.
Do not add dependencies or change CI permissions to make a check pass.

Run `git diff --check`, review exact staged paths and check secrets/provenance
before any authorized publication. A local commit is not permission to publish;
honor the task's specific destination and approval scope. Never bypass denied
operations or failing protections. Handoff with changes, exact checks, commit,
remaining limitations and honest local/remote CI status.
