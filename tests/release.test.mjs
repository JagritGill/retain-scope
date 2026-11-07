import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, rmSync, symlinkSync} from "node:fs";
import {tmpdir} from "node:os";
import {join, dirname} from "node:path";
import {spawnSync} from "node:child_process";
import {inspect, inventory} from "../scripts/check-release.mjs";

test("README example output matches the actual CLI", () => {
  const readme = readFileSync("README.md", "utf8");
  const expected = readme.match(/<!-- example-output:start -->\n```text\n([\s\S]*?)```\n<!-- example-output:end -->/)[1];
  const result = spawnSync(process.execPath, ["cli.mjs", "examples/shared-caches.json"], {encoding: "utf8", timeout: 10000});
  assert.equal(result.status, 0, result.stderr); assert.equal(result.stdout, expected);
});
test("release inventory and local documentation links are complete", () => {
  const result = inspect(process.cwd()); assert.equal(result.files, inventory.length); assert.ok(result.local_links > 0);
});
test("release guard rejects scope drift, credential-shaped data, missing links and symlinks", () => {
  const root = mkdtempSync(join(tmpdir(), "retain-release-"));
  try {
    for (const path of inventory) {const target = join(root, path); mkdirSync(dirname(target), {recursive: true}); copyFileSync(path, target);}
    const readme = readFileSync(join(root, "README.md"), "utf8");
    writeFileSync(join(root, "unexpected.json"), "{}"); assert.throws(() => inspect(root), /inventory/); rmSync(join(root, "unexpected.json"));
    writeFileSync(join(root, "README.md"), readme + "\n" + "gh" + "p_" + "x".repeat(36) + "\n"); assert.throws(() => inspect(root), /pattern/);
    writeFileSync(join(root, "README.md"), readme + "\n[missing](absent.md)\n"); assert.throws(() => inspect(root), /missing local link/);
    writeFileSync(join(root, "README.md"), readme);
    const pkgPath = join(root, "package.json"), pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    pkg.dependencies = {unexpected: "1.0.0"}; writeFileSync(pkgPath, JSON.stringify(pkg)); assert.throws(() => inspect(root), /dependency scope/);
    copyFileSync("package.json", pkgPath);
    rmSync(join(root, "LICENSE")); symlinkSync(join(process.cwd(), "LICENSE"), join(root, "LICENSE")); assert.throws(() => inspect(root), /symlink/);
  } finally {rmSync(root, {recursive: true, force: true});}
});
