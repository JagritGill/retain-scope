import type {Graph, ObjectNode} from "./model.ts";

/** Reachability after removing vertices, including their root membership. */
function reachable(graph: Graph, byId: ReadonlyMap<string, ObjectNode>, removed: ReadonlySet<string>): Set<string> {
  const visited = new Set<string>(), pending = [...graph.roots];
  while (pending.length) {
    const id = pending.pop();
    if (id === undefined || removed.has(id) || visited.has(id)) continue;
    visited.add(id);
    const node = byId.get(id);
    if (!node) throw new Error("internal missing graph node");
    pending.push(...node.refs);
  }
  return visited;
}

export function analyze(graph: Graph) {
  const byId = new Map(graph.nodes.map(node => [node.id, node]));
  const live = reachable(graph, byId, new Set());
  const ids = [...live].sort();
  // Bit zero is a synthetic root connected directly to every declared live root.
  const bits = new Map(ids.map((id, index) => [id, 1n << BigInt(index + 1)]));
  const all = (1n << BigInt(ids.length + 1)) - 1n;
  const dominators = new Map(ids.map(id => [id, all]));
  const predecessors = new Map(ids.map(id => [id, [] as string[]]));
  const rootIds = new Set(graph.roots);
  for (const id of ids) {
    for (const target of byId.get(id)?.refs ?? []) predecessors.get(target)?.push(id);
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const id of ids) {
      let common = rootIds.has(id) ? 1n : all;
      for (const previous of predecessors.get(id) ?? []) common &= dominators.get(previous) ?? 0n;
      const value = common | (bits.get(id) ?? 0n);
      if (value !== dominators.get(id)) {dominators.set(id, value); changed = true;}
    }
  }
  const retained = new Map<string, string[]>();
  for (const node of graph.nodes) {
    const bit = bits.get(node.id) ?? 0n;
    retained.set(node.id, bit === 0n ? [] : ids.filter(id => ((dominators.get(id) ?? 0n) & bit) !== 0n));
  }
  const size = (selected: Iterable<string>): string => {
    let total = 0n;
    for (const id of selected) total += byId.get(id)?.bytes ?? 0n;
    return total.toString();
  };
  const rows = graph.nodes.map(node => {
    const ownBit = bits.get(node.id) ?? 0n;
    const strict = (dominators.get(node.id) ?? 0n) & ~ownBit;
    // Strict dominators form a chain. The closest has the largest dominator set.
    let immediate: string | null = null, depth = 0;
    for (const candidate of ids) {
      if ((strict & (bits.get(candidate) ?? 0n)) === 0n) continue;
      const candidateDepth = (dominators.get(candidate) ?? 0n).toString(2).replaceAll("0", "").length;
      if (candidateDepth > depth) {immediate = candidate; depth = candidateDepth;}
    }
    const controlled = retained.get(node.id) ?? [];
    return {id: node.id, reachable: live.has(node.id), shallow_bytes: node.bytes.toString(),
      retained_bytes: size(controlled), retained_count: controlled.length, immediate_dominator: immediate};
  });
  const individual = graph.remove.map(id => {
    const released = retained.get(id) ?? [];
    return {id, newly_unreachable: released, bytes: size(released)};
  });
  const individualUnion = new Set(individual.flatMap(item => item.newly_unreachable));
  const after = reachable(graph, byId, new Set(graph.remove));
  const group = ids.filter(id => !after.has(id));
  const jointOnly = group.filter(id => !individualUnion.has(id));
  const unreachable = graph.nodes.filter(node => !live.has(node.id)).map(node => node.id);
  return {version: 1, model: "supplied_strong_reference_graph", units: "bytes", live_count: live.size,
    live_bytes: size(ids), already_unreachable: unreachable, already_unreachable_bytes: size(unreachable),
    nodes: rows, individual,
    group: {remove: [...graph.remove], newly_unreachable: group, bytes: size(group),
      individual_union: [...individualUnion].sort(), individual_union_bytes: size(individualUnion),
      joint_only: jointOnly, joint_only_bytes: size(jointOnly)}};
}
