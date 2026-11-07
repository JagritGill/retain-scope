import test from "node:test";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {mkdtempSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";

const cli = (...args) => spawnSync(process.execPath, ["cli.mjs", ...args], {encoding: "utf8", timeout: 10000});
test("JSON preserves exact byte strings and expected group behavior", () => {
  const result = cli("examples/shared-caches.json", "--format", "json");
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout); assert.equal(report.group.joint_only_bytes, "5120"); assert.equal(typeof report.live_bytes, "string");
  assert.equal(cli("examples/nested-removal.json").status, 0); assert.equal(cli("examples/root-pinned.json").status, 0);
});
test("invalid JSON, UTF-8, oversized files and invalid models emit no partial report", () => {
  const dir = mkdtempSync(join(tmpdir(), "retain-input-")), path = join(dir, "input.json");
  try {
    for (const content of ["{", "[]", '{"version":true}', '\ufeff{"version":1,"nodes":[],"roots":[],"remove":[]}', Buffer.from([0xff]), " ".repeat(1_048_577)]) {
      writeFileSync(path, content); const result = cli(path, "--format", "json"); assert.equal(result.status, 2); assert.equal(result.stdout, ""); assert.match(result.stderr, /error:/);
    }
    const result = cli(dir); assert.equal(result.status, 2); assert.equal(result.stdout, "");
  } finally {rmSync(dir, {recursive: true, force: true});}
});
test("help and usage are explicit", () => {
  assert.equal(cli("--help").status, 0);
  for (const args of [[], ["missing.json"], ["examples/shared-caches.json", "--format", "csv"], ["examples/shared-caches.json", "--extra", "value"]]) {
    const result = cli(...args); assert.equal(result.status, 2); assert.equal(result.stdout, "");
  }
});
