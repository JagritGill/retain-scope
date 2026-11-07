# Related work and provenance

Research date: November 7, 2026, before implementation. Searches included "heap
graph group retained size", "Chrome DevTools memory dominators retained size" and
"Memory Analyzer dominator tree retained set". Public documentation was read for
context; source implementations were not cloned, copied or closely translated.

| Source | Documented overlap | This project's focus |
| --- | --- | --- |
| [Chrome DevTools memory terminology](https://developer.chrome.com/docs/devtools/memory-problems/get-started) | Shallow/retained sizes, roots and dominator concepts for memory profiling | A small explicit JSON graph with exact decimal byte counts and inspectable removal experiments |
| [Eclipse Memory Analyzer dominator tree](https://help.eclipse.org/latest/topic/org.eclipse.mat.ui.help/concepts/dominatortree.html) | Dominator relationships and retained sets in an object graph | A standalone educational CLI with a simple iterative dominator implementation and independent graph-cut tests |
| [IBM Memory Analyzer shallow and retained heap](https://www.ibm.com/docs/en/mon-diag-tools?topic=SS3KLZ%2Fcom.ibm.java.diagnostics.memory.analyzer.doc%2Fshallowretainedheap.htm) | Retained sets for individual objects and groups, including exact and minimum retained-size calculations | Explicitly show which objects disappear only when a selected group is removed together, beyond the union of individual results |

Group retained-size analysis already exists in mature profilers. The useful angle
here is the small portable input, worked synthetic examples and transparent
individual-union versus group comparison, not a new algorithm or a claim those
tools lack this capability. This is bounded research, not an exhaustive novelty
search or worldwide uniqueness guarantee.

The example has two caches pointing to one cyclic payload. Removing either cache
alone releases its own small header; removing both makes the shared payload
unreachable. A second example demonstrates why individual retained sizes cannot
simply be added when one selected object dominates another.

The implementation, format, tests, examples and documentation are independently
written here with AI assistance. Iterative dominator equations and reachability
are established techniques; no source snippets, figures or passages were copied.
Runtime/development dependencies and their terms are listed in
[THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md). The project does not collect
real heaps, inspect private source or connect to application processes.
