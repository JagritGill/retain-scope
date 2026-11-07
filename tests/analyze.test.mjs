import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {parseGraph} from "../src/model.ts";
import {analyze} from "../src/analyze.ts";

const example = name => parseGraph(JSON.parse(readFileSync(`examples/${name}.json`, "utf8")));
const sorted = values => [...values].sort();

test("shared caches expose joint-only cyclic payload and non-reference dominator edges", () => {
  const report = analyze(example("shared-caches"));
  assert.equal(report.live_bytes, "5280"); assert.equal(report.already_unreachable_bytes, "8");
  assert.deepEqual(report.group.newly_unreachable, ["blob", "chunk", "left", "right"]);
  assert.equal(report.group.bytes, "5200"); assert.equal(report.group.individual_union_bytes, "80");
  assert.deepEqual(report.group.joint_only, ["blob", "chunk"]); assert.equal(report.group.joint_only_bytes, "5120");
  assert.equal(report.nodes.find(row => row.id === "blob").immediate_dominator, "app");
});
test("nested removals use a union, not a double-counted sum", () => {
  const report = analyze(example("nested-removal"));
  assert.equal(report.individual.reduce((total, row) => total + BigInt(row.bytes), 0n), 110n);
  assert.equal(report.group.bytes, "60"); assert.equal(report.group.individual_union_bytes, "60");
  assert.equal(report.group.joint_only_bytes, "0"); assert.deepEqual(report.group.joint_only, []);
});
test("an additional root keeps shared data live", () => {
  const report = analyze(example("root-pinned"));
  assert.equal(report.group.bytes, "20"); assert.equal(report.group.joint_only_bytes, "0");
  assert.equal(report.nodes.find(row => row.id === "payload").immediate_dominator, null);
});
test("unreachable cycles and empty roots are excluded from new releases", () => {
  const graph = parseGraph({version: 1, nodes: [{id: "a", bytes: "5", refs: ["b"]}, {id: "b", bytes: "7", refs: ["a"]}], roots: [], remove: ["a"]});
  const report = analyze(graph);
  assert.equal(report.live_bytes, "0"); assert.equal(report.already_unreachable_bytes, "12");
  assert.equal(report.group.bytes, "0"); assert.equal(report.individual[0].bytes, "0");
  assert.equal(analyze(parseGraph({version: 1, nodes: [], roots: [], remove: []})).live_count, 0);
});
test("byte totals stay exact beyond Number precision and zero-sized nodes still dominate", () => {
  const report = analyze(parseGraph({version: 1, nodes: [
    {id: "root", bytes: "0", refs: ["a", "b"]},
    {id: "a", bytes: "9007199254740993", refs: []},
    {id: "b", bytes: "999999999999999999999999999999", refs: []}], roots: ["root"], remove: ["root"]}));
  assert.equal(report.group.bytes, (9007199254740993n + 999999999999999999999999999999n).toString());
  assert.equal(report.nodes.find(row => row.id === "root").retained_count, 3);
  assert.equal(report.nodes.find(row => row.id === "a").immediate_dominator, "root");
});
test("Unicode and prototype-like IDs survive stable sorting without mutation", () => {
  const data = {version: 1, nodes: [{id: "🌎", bytes: "1", refs: ["constructor", "__proto__"]},
    {id: "constructor", bytes: "2", refs: []}, {id: "__proto__", bytes: "3", refs: []}], roots: ["🌎"], remove: ["constructor", "🌎"]};
  const before = structuredClone(data), first = analyze(parseGraph(data)); assert.deepEqual(data, before);
  data.nodes.reverse(); data.nodes.forEach(node => node.refs.reverse()); data.roots.reverse(); data.remove.reverse();
  const graph = parseGraph(data);
  graph.nodes.forEach(node => {Object.freeze(node.refs); Object.freeze(node);}); Object.freeze(graph.nodes); Object.freeze(graph.roots); Object.freeze(graph.remove); Object.freeze(graph);
  assert.deepEqual(analyze(graph), first);
});
test("maximum-depth reverse chain converges against sorted iteration order", () => {
  const names = Array.from({length: 256}, (_, index) => `n${String(index).padStart(3, "0")}`);
  const graph = parseGraph({version: 1, nodes: names.map((id, i) => ({id, bytes: "1", refs: i ? [names[i - 1]] : []})), roots: [names[255]], remove: [names[128]]});
  const report = analyze(graph);
  assert.equal(report.live_count, 256); assert.equal(report.group.bytes, "129");
  assert.equal(report.nodes[0].immediate_dominator, "n001");
  assert.equal(report.nodes[255].retained_bytes, "256");
});

/** Independent boolean transitive closure after removing vertices. No dominators or DFS. */
function oracleLive(edgeMask, rootMask, removedMask) {
  const relation = Array.from({length: 3}, (_, i) => Array.from({length: 3}, (_, j) =>
    !(removedMask & (1 << i)) && !(removedMask & (1 << j)) && (i === j || Boolean(edgeMask & (1 << (i * 3 + j))))));
  for (let k = 0; k < 3; k++) for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) relation[i][j] ||= relation[i][k] && relation[k][j];
  return [0, 1, 2].filter(j => [0, 1, 2].some(i => (rootMask & (1 << i)) && relation[i][j]));
}
test("32,768 graph/root/group combinations match independent vertex-cut closure", () => {
  const names = ["a", "b", "c"], sizes = [1n, 2n, 4n];
  const bytes = indices => indices.reduce((sum, i) => sum + sizes[i], 0n).toString();
  let checked = 0;
  for (let edges = 0; edges < 512; edges++) for (let roots = 0; roots < 8; roots++) {
    const live = oracleLive(edges, roots, 0);
    const freed = [0, 1, 2].map(i => live.filter(v => !oracleLive(edges, roots, 1 << i).includes(v)));
    const nodes = names.map((id, i) => ({id, bytes: sizes[i].toString(), refs: names.filter((_, j) => edges & (1 << (i * 3 + j)))}));
    for (let removed = 0; removed < 8; removed++) {
      const selected = [0, 1, 2].filter(i => removed & (1 << i));
      const report = analyze(parseGraph({version: 1, nodes, roots: names.filter((_, i) => roots & (1 << i)), remove: selected.map(i => names[i])}));
      assert.equal(report.live_bytes, bytes(live));
      for (let i = 0; i < 3; i++) {
        assert.equal(report.nodes[i].reachable, live.includes(i));
        assert.equal(report.nodes[i].retained_bytes, bytes(freed[i]));
        assert.equal(report.nodes[i].retained_count, freed[i].length);
        const strict = [0, 1, 2].filter(d => d !== i && freed[d].includes(i));
        const closest = strict.find(d => strict.every(other => other === d || freed[other].includes(d)));
        assert.equal(report.nodes[i].immediate_dominator, closest === undefined ? null : names[closest]);
      }
      const after = oracleLive(edges, roots, removed), group = live.filter(i => !after.includes(i));
      const union = [...new Set(selected.flatMap(i => freed[i]))], joint = group.filter(i => !union.includes(i));
      assert.deepEqual(report.group.newly_unreachable, group.map(i => names[i]));
      assert.deepEqual(report.group.individual_union, sorted(union.map(i => names[i])));
      assert.deepEqual(report.group.joint_only, joint.map(i => names[i]));
      assert.equal(report.group.bytes, bytes(group)); assert.equal(report.group.individual_union_bytes, bytes(union)); assert.equal(report.group.joint_only_bytes, bytes(joint));
      for (const item of report.individual) assert.deepEqual(item.newly_unreachable, freed[names.indexOf(item.id)].map(i => names[i]));
      checked++;
    }
  }
  assert.equal(checked, 32768);
});
