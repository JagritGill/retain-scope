import test from "node:test";
import assert from "node:assert/strict";
import {parseGraph} from "../src/model.ts";

const base = () => ({version: 1, nodes: [{id: "a", bytes: "1", refs: []}], roots: ["a"], remove: ["a"]});
test("strict fields, versions and byte encodings reject ambiguous input", () => {
  for (const value of [null, [], {}, {...base(), version: true}, {...base(), version: 2}, {...base(), extra: 1}]) assert.throws(() => parseGraph(value));
  for (const key of ["version", "nodes", "roots", "remove"]) {const data = base(); delete data[key]; assert.throws(() => parseGraph(data));}
  for (const bytes of [1, 1.5, null, true, "", "01", "+1", "-1", "1.0", "1e2", "9".repeat(31)]) {const data = base(); data.nodes[0].bytes = bytes; assert.throws(() => parseGraph(data));}
  const data = base(); data.nodes[0].unknown = 1; assert.throws(() => parseGraph(data));
});
test("duplicate IDs, edges, selections and unknown references are rejected", () => {
  const mutations = [data => data.nodes.push({...data.nodes[0]}), data => data.roots.push("a"), data => data.remove.push("a"), data => data.nodes[0].refs.push("a", "a"), data => data.nodes[0].refs.push("missing"), data => data.roots.push("missing"), data => data.remove.push("missing")];
  for (const change of mutations) {const data = base(); change(data); assert.throws(() => parseGraph(data));}
});
test("well-formed Unicode IDs are supported, controls and unpaired surrogates rejected", () => {
  for (const id of ["", "\ud800", "\udfff", "a\n", "a\u007f", "a\u0085", "a\u2028", "a\u2029", "x".repeat(65)]) {
    const data = base(); data.nodes[0].id = id; data.roots = [id]; data.remove = [id]; assert.throws(() => parseGraph(data));
  }
  const id = "🌎".repeat(32); assert.equal(parseGraph({version: 1, nodes: [{id, bytes: "0", refs: []}], roots: [id], remove: []}).nodes[0].id, id);
});
test("node, reference and removal limits are enforced", () => {
  const data = {version: 1, nodes: Array.from({length: 256}, (_, i) => ({id: `n${i}`, bytes: "0", refs: Array.from({length: 8}, (_, j) => `n${j}`)})), roots: [], remove: []};
  assert.equal(parseGraph(data).nodes.length, 256);
  data.nodes[0].refs.push("n8"); assert.throws(() => parseGraph(data), /2048/);
  data.nodes[0].refs.pop(); data.remove = Array.from({length: 17}, (_, i) => `n${i}`); assert.throws(() => parseGraph(data), /16/);
  data.remove = []; data.nodes.push({id: "extra", bytes: "0", refs: []}); assert.throws(() => parseGraph(data), /256/);
});
