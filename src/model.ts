export interface ObjectNode {readonly id: string; readonly bytes: bigint; readonly refs: readonly string[]}
export interface Graph {readonly nodes: readonly ObjectNode[]; readonly roots: readonly string[]; readonly remove: readonly string[]}

function object(value: unknown, keys: readonly string[], where: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error(`${where}: expected an object`);
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== keys.length || keys.some(key => !Object.hasOwn(record, key))) throw new Error(`${where}: expected exactly ${keys.join(", ")}`);
  return record;
}
function array(value: unknown, limit: number, where: string): unknown[] {
  if (!Array.isArray(value) || value.length > limit) throw new Error(`${where}: expected an array of at most ${limit} items`);
  return value as unknown[];
}
function identifier(value: unknown): string {
  if (typeof value !== "string" || value.length < 1 || value.length > 64 || !value.isWellFormed() || /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/u.test(value)) {
    throw new Error("IDs must be well-formed Unicode strings of 1–64 UTF-16 code units without control/line-separator characters");
  }
  return value;
}
function identifiers(value: unknown, limit: number, where: string): string[] {
  const ids = Array.from(array(value, limit, where), identifier);
  if (new Set(ids).size !== ids.length) throw new Error(`${where}: duplicate ID`);
  return ids.sort();
}
export function parseGraph(value: unknown): Graph {
  const root = object(value, ["version", "nodes", "roots", "remove"], "graph");
  if (root.version !== 1) throw new Error("version must be 1");
  const nodes = Array.from(array(root.nodes, 256, "nodes"), row => {
    const node = object(row, ["id", "bytes", "refs"], "node");
    const id = identifier(node.id);
    if (typeof node.bytes !== "string" || !/^(?:0|[1-9][0-9]{0,29})$/.test(node.bytes)) throw new Error("bytes must be a canonical nonnegative decimal string of at most 30 digits");
    return {id, bytes: BigInt(node.bytes), refs: identifiers(node.refs, 256, "refs")};
  }).sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
  const known = new Set(nodes.map(node => node.id));
  if (known.size !== nodes.length) throw new Error("nodes: duplicate ID");
  if (nodes.reduce((count, node) => count + node.refs.length, 0) > 2048) throw new Error("at most 2048 reference edges are supported");
  const roots = identifiers(root.roots, 256, "roots"), remove = identifiers(root.remove, 16, "remove");
  for (const id of [...roots, ...remove, ...nodes.flatMap(node => node.refs)]) if (!known.has(id)) throw new Error("unknown node referenced in roots, remove or refs");
  return {nodes, roots, remove};
}
