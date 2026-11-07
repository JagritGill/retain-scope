# Architecture and tradeoffs

The CLI reads one bounded JSON file, validates it, runs a pure graph calculation,
and writes one text or JSON report. It never executes code from the input,
attaches to a process or modifies a heap. Runtime imports are only Node's file
API and this repository's modules.

| File | Responsibility |
| --- | --- |
| [model.ts](../src/model.ts) | Strict shape/ID/size/bounds validation; sorted copied graph |
| [analyze.ts](../src/analyze.ts) | Reachability, dominators, retained sets and group comparison |
| [report.ts](../src/report.ts) | Quoted-ID text rendering of the JSON-compatible result |
| [cli.mjs](../cli.mjs) | Bounded UTF-8 read, arguments, formatting and exit status |
| [tests](../tests/analyze.test.mjs) | Worked examples plus independent graph-cut oracle |
| [release check](../scripts/check-release.mjs) | Source inventory, dependency and documentation safeguards |

## Retained sets through dominators

First compute original reachability using an iterative stack. Add a conceptual
root `S` with edges to every declared root; ignore initially unreachable vertices
for all subsequent retention calculations. For a live vertex `v`:

```text
Dom(S) = {S}
Dom(v) = {v} union intersection(Dom(p) for p in predecessors(v))
```

Initialize every live vertex's set to all live vertices plus `S`, then iterate
until no set changes. Sets only shrink over a finite domain, so the iteration
terminates. Direct root edges contribute `{S}` to the intersection even when
that root also has ordinary incoming references. BigInt bitsets represent these
sets without a fixed 32-bit mask limit.

Object `d` retains exactly the live vertices whose dominator sets contain `d`:
every path from `S` to those vertices passes through `d`, so deleting `d` cuts
all those paths. This includes `d` itself. A live zero-byte vertex can dominate
positive-sized descendants. An initially unreachable vertex retains zero newly
unreachable objects under this experiment's definition.

Strict dominators of a live vertex form a chain. Choose the candidate with the
largest dominator-set cardinality as its immediate dominator. The virtual root
has no public ID; output null when it is the immediate dominator, and use the
separate `reachable` flag to distinguish unreachable objects.

## Group counterfactual

Let `L` be the original live set and `Reach(G - R)` reachability after deleting
the selected vertices `R`, including any root membership. Then:

```text
group = L minus Reach(G - R)
individual_union = union(retained(r) for r in R)
joint_only = group minus individual_union
```

Use sets, never sums, when combining individual results: nested selected nodes
can retain the same object. Every individual result is a subset of the group
result. Each byte count sums the supplied shallow sizes exactly once per member.
For three or more removals, `joint_only` means absent from every singleton result;
it does not claim every selected member was necessary or identify minimal cuts.

## Why this design

The simple fixed-point algorithm makes the dominator reasoning inspectable and
handles cycles and multiple roots without recursive traversal. Recomputing a
graph cut for every object would also work, but exposing dominators explains
ownership structure. The tests use independent boolean transitive closure after
vertex cuts to check both the retained sets and immediate dominators.

This is not an asymptotically optimized dominator algorithm. Bitset intersections
and repeated passes trade speed for clarity; retained-set construction and
dominator selection compare pairs of vertices. Storage includes per-vertex
dominator bitsets and retained memberships, which can grow quadratically.
Validation caps work at 256 vertices/2,048 edges rather than promising arbitrary
heap-snapshot scale. The reversed maximum-depth chain tests slow propagation.

Byte arithmetic uses BigInt while JSON carries decimal strings. Counts stay
small integers. Input ordering is canonicalized; original objects are not mutated.
`analyze` expects a `Graph` returned by `parseGraph`; hand-built invalid internal
graphs are outside its contract. No global state or wall clock affects results.

The JSON parser intentionally retains standard last-property-wins semantics;
validation rejects duplicate graph IDs, not duplicate JSON keys. The CLI's
regular-file checks and size bound are input safeguards, not a filesystem
security boundary against a concurrent adversary swapping paths. All semantic
and runtime limitations are described in the [README](../README.md).
