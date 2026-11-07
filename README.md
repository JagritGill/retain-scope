# retain-scope

Explain why two small caches can keep one large object graph alive. Given a
small JSON graph of strong references, retain-scope reports each object's
retained size and what becomes unreachable when a selected group is removed
together. It separates the group's result from the **union** of individual
results, making shared retention and overlapping counts visible.

Useful for learning memory-analysis concepts, reviewing a proposed ownership
graph, or building a small reproducible retention example. No heap capture,
application attachment, credentials, service or runtime dependency is needed.

## Quickstart

From this folder, with Node.js **24.4 or newer**:

```sh
node cli.mjs examples/shared-caches.json
node cli.mjs examples/shared-caches.json --format json
node cli.mjs examples/nested-removal.json
node cli.mjs examples/root-pinned.json
node cli.mjs --help
npm test
npm run check:release
```

No installation is needed for these commands. `npm run demo` runs the first
example. Its direct CLI output is:

<!-- example-output:start -->
```text
live: 6 objects, 5280 bytes
already unreachable: "orphan" (8 bytes)
"app": shallow 64, retained 5280, immediate dominator none/virtual root
"blob": shallow 4096, retained 5120, immediate dominator "app"
"chunk": shallow 1024, retained 1024, immediate dominator "blob"
"left": shallow 32, retained 32, immediate dominator "app"
"metrics": shallow 16, retained 16, immediate dominator "app"
"orphan": shallow 8, retained 0, immediate dominator none/virtual root
"right": shallow 48, retained 48, immediate dominator "app"
remove "left" alone: 32 bytes; "left"
remove "right" alone: 48 bytes; "right"
remove together: 5200 bytes; "blob", "chunk", "left", "right"
individual union: 80 bytes
joint only: 5120 bytes; "blob", "chunk"
Counterfactual graph reachability only; no actual heap was measured or changed.
```
<!-- example-output:end -->

`left` and `right` each point to `blob`; `blob` and `chunk` form a cycle.
Removing either cache alone leaves the shared payload reachable through the
other. Removing both makes another 5,120 bytes unreachable. The nested example
shows the other trap: summing individual retained sizes double-counts objects.
The root-pinned example shows how an extra root preserves shared payload.

## Input and interpretation

The entire document must have exactly these four fields:

```json
{
  "version": 1,
  "nodes": [
    {"id": "cache", "bytes": "16", "refs": ["payload"]},
    {"id": "payload", "bytes": "1024", "refs": []}
  ],
  "roots": ["cache"],
  "remove": ["cache"]
}
```

Each node has exactly `id`, `bytes` and `refs`. `bytes` is its supplied shallow
size, a canonical nonnegative decimal **string** of up to 30 digits. BigInt
arithmetic keeps sums exact; every byte field in JSON output is also a string.
Counts and format version are numbers. Zero-byte objects can still retain others.

IDs are case-sensitive, well-formed Unicode strings of 1–64 UTF-16 code units,
without C0/C1 controls or Unicode line separators. No Unicode normalization is
applied. Nodes, references, roots and removal IDs must be unique within their
respective lists; every referenced ID must exist. Self-edges, cycles, empty
graphs and empty root/removal lists are supported. Lists are sorted by JavaScript
string order so permutations of the input produce identical output.

Limits: 256 nodes, 2,048 reference edges, 16 selected removal IDs, and a regular
UTF-8 JSON file no larger than 1 MiB. Extra fields, invalid UTF-8 and a leading
BOM are rejected. Standard `JSON.parse` semantics apply: duplicate JSON property
names use the last value; this is different from duplicate IDs, which are rejected.

The model connects a virtual root to every declared root. A removal experiment
deletes selected vertices and their incident edges, including their root
membership. It counts only objects that were initially reachable and become
unreachable afterward. It does **not** model clearing one particular field or
freeing an object while leaving other references intact.

| Output | Meaning |
| --- | --- |
| `live_bytes` | Sum of initially reachable objects' supplied shallow sizes |
| `already_unreachable` | Objects excluded from all newly-unreachable calculations |
| Node `retained_bytes` / `retained_count` | Result of removing that object alone; zero for initially unreachable objects |
| Node `immediate_dominator` | Closest object on every root-to-object path; null for the virtual root or an unreachable node (see `reachable`) |
| `individual` | Removal set and exact size for each selected object alone |
| `group.newly_unreachable` / `bytes` | Result of removing every selected object together |
| `group.individual_union` / `individual_union_bytes` | Union of the individual results, counted once per object |
| `group.joint_only` / `joint_only_bytes` | Group result minus that union; the additional jointly retained objects |

A dominator edge need not be a reference edge: `app` immediately dominates
`blob` in the example without directly referring to it. A valid report exits 0,
even with a nonempty joint-only result. Invalid input or usage exits 2 with an
error on stderr and no partial report on stdout. There is no leak verdict or
policy threshold.

## Development and verification

Runtime and tests use Node built-ins. TypeScript 6.0.3 is the only development
dependency. To set up its pinned compiler on another checkout:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run check:types
npm test
npm run check:release
npm run demo
```

The November 7 local build used Node 24.4.1 and an already installed TypeScript
6.0.3 compiler; no dependency installation was needed or tested locally. The
strict compiler check covers `src/**/*.ts`; Node's native TypeScript stripping
alone does not check types. The JavaScript CLI, release checker and tests are
runtime-tested, not statically checked. No separate linter is configured.

Tests compare 32,768 three-node graph/root/removal combinations with an independent
boolean transitive-closure oracle, plus explicit cycles, large exact byte counts,
Unicode, bounds, CLI errors and README-output checks. The release check reviews
the explicit file inventory, local documentation links, pinned dependencies and
common secret/private-path patterns. It is a safeguard, not a proof that every
possible secret can be detected; inspect the staged diff before publication.

[CI configuration](.github/workflows/ci.yml) targets Node 24 and 26, including
clean compiler installation. **Remote publication and CI are pending** for this
local build; Node 26 and that installation path have not been verified here.

## Design, provenance and limits

[Architecture and tradeoffs](docs/architecture.md) explain the dominator fixed
point and group calculation. [Related work](docs/related-work.md) credits Chrome
DevTools and Eclipse/IBM Memory Analyzer concepts. Mature profilers already
provide retained-set analysis; this project's value is a small, inspectable
teaching and experimentation format. No claim of worldwide uniqueness is made.

Implementation, tests and synthetic examples were written independently from
scratch with AI assistance; no third-party application was cloned or translated.
Original files use the [MIT license](LICENSE). See
[third-party notices](THIRD_PARTY_NOTICES.md) and [agent guidance](AGENTS.md).

This is a supplied-graph experiment, not a heap profiler or leak detector. It
does not import heap snapshots, discover real GC roots, model weak references,
ephemerons, finalizers, object movement, allocator overhead, concurrent mutation
or collection timing. Missing references/roots or inaccurate shallow sizes
produce misleading results. The bounded, simple implementation is intended for
small graphs; no production scale or performance claim is made.
