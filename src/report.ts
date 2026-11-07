import type {analyze} from "./analyze.ts";

export function textReport(result: ReturnType<typeof analyze>): string {
  const names = (ids: readonly string[]) => ids.length ? ids.map(id => JSON.stringify(id)).join(", ") : "none";
  const lines = [`live: ${result.live_count} objects, ${result.live_bytes} bytes`,
    `already unreachable: ${names(result.already_unreachable)} (${result.already_unreachable_bytes} bytes)`];
  for (const row of result.nodes) lines.push(`${JSON.stringify(row.id)}: shallow ${row.shallow_bytes}, retained ${row.retained_bytes}, immediate dominator ${row.immediate_dominator === null ? "none/virtual root" : JSON.stringify(row.immediate_dominator)}`);
  for (const item of result.individual) lines.push(`remove ${JSON.stringify(item.id)} alone: ${item.bytes} bytes; ${names(item.newly_unreachable)}`);
  lines.push(`remove together: ${result.group.bytes} bytes; ${names(result.group.newly_unreachable)}`,
    `individual union: ${result.group.individual_union_bytes} bytes`,
    `joint only: ${result.group.joint_only_bytes} bytes; ${names(result.group.joint_only)}`,
    "Counterfactual graph reachability only; no actual heap was measured or changed.");
  return lines.join("\n") + "\n";
}
