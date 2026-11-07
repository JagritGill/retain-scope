import {lstatSync, readFileSync, readdirSync, existsSync} from "node:fs";
import {join, dirname, resolve, relative, sep} from "node:path";
import {pathToFileURL} from "node:url";

export const inventory = [
  ".gitignore", ".github/workflows/ci.yml", "AGENTS.md", "LICENSE", "README.md", "THIRD_PARTY_NOTICES.md",
  "cli.mjs", "docs/architecture.md", "docs/related-work.md", "examples/nested-removal.json",
  "examples/root-pinned.json", "examples/shared-caches.json", "package-lock.json", "package.json",
  "scripts/check-release.mjs", "src/analyze.ts", "src/model.ts", "src/report.ts",
  "tests/analyze.test.mjs", "tests/cli.test.mjs", "tests/model.test.mjs", "tests/release.test.mjs", "tsconfig.json",
].sort();
const ignoredRoot = new Set([".git", "node_modules", "out", ".DS_Store"]);
const patterns = [
  /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/,
  /\b(?:gh[pousr]_[A-Za-z0-9]{36,255}|github_pat_[A-Za-z0-9_]{40,})\b/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\b(?:api[_-]?key|password|secret)\s*[:=]\s*["'][A-Za-z0-9/+_=-]{16,}["']/i,
  /(?:\/Users\/|\/home\/)[A-Za-z0-9._-]+\//,
];

export function inspect(root) {
  root = resolve(root);
  const actual = [], contents = new Map();
  function walk(directory, prefix = "") {
    for (const name of readdirSync(directory).sort()) {
      if (!prefix && ignoredRoot.has(name)) continue;
      const path = join(directory, name), local = prefix + name, info = lstatSync(path);
      if (info.isSymbolicLink()) throw new Error(`symlink in release scope: ${local}`);
      if (info.isDirectory()) walk(path, local + "/");
      else if (info.isFile()) actual.push(local);
      else throw new Error(`nonregular release file: ${local}`);
    }
  }
  walk(root);
  if (JSON.stringify(actual.sort()) !== JSON.stringify(inventory)) throw new Error("release inventory mismatch");
  for (const path of actual) {
    const bytes = readFileSync(join(root, path));
    if (bytes.length > 1_048_576) throw new Error(`oversized release file: ${path}`);
    const content = new TextDecoder("utf-8", {fatal: true}).decode(bytes);
    if (content.includes("\0") || patterns.some(pattern => pattern.test(content))) throw new Error(`secret/private-path or binary pattern: ${path}`);
    contents.set(path, content);
  }
  let links = 0;
  for (const [path, content] of contents) {
    if (!path.endsWith(".md")) continue;
    for (const match of content.matchAll(/\[[^\]\n]+\]\(([^)\s]+)\)/g)) {
      const url = match[1];
      if (/^https:\/\//.test(url) || url.startsWith("#")) continue;
      const target = resolve(root, dirname(path), decodeURIComponent(url.split("#")[0]));
      const local = relative(root, target);
      if (local.startsWith(".." + sep) || local === ".." || !existsSync(target) || !inventory.includes(local.split(sep).join("/"))) throw new Error(`unreviewed or missing local link: ${path} -> ${url}`);
      links++;
    }
  }
  const pkg = JSON.parse(contents.get("package.json")), lock = JSON.parse(contents.get("package-lock.json"));
  if (pkg.private !== true || pkg.license !== "MIT" || Object.keys(pkg.dependencies ?? {}).length ||
      Object.keys(pkg.optionalDependencies ?? {}).length || Object.keys(pkg.peerDependencies ?? {}).length ||
      JSON.stringify(pkg.devDependencies) !== JSON.stringify({typescript: "6.0.3"}) ||
      JSON.stringify(lock.packages[""].devDependencies) !== JSON.stringify(pkg.devDependencies) ||
      Object.keys(lock.packages).sort().join("|") !== "|node_modules/typescript") throw new Error("dependency scope changed");
  const compiler = lock.packages["node_modules/typescript"];
  if (compiler.version !== "6.0.3" || compiler.license !== "Apache-2.0" || compiler.dev !== true ||
      compiler.resolved !== "https://registry.npmjs.org/typescript/-/typescript-6.0.3.tgz" ||
      compiler.integrity !== "sha512-y2TvuxSZPDyQakkFRPZHKFm+KKVqIisdg9/CZwm9ftvKXLP8NRWj38/ODjNbr43SsoXqNuAisEf1GdCxqWcdBw==") throw new Error("compiler lock changed");
  const allowed = new Set(["node:fs", "./src/model.ts", "./src/analyze.ts", "./src/report.ts", "./model.ts", "./analyze.ts"]);
  for (const path of ["cli.mjs", "src/model.ts", "src/analyze.ts", "src/report.ts"]) {
    for (const match of contents.get(path).matchAll(/\bfrom\s+["']([^"']+)["']/g)) {
      if (!allowed.has(match[1])) throw new Error(`unreviewed runtime import: ${path}`);
    }
  }
  return {files: actual.length, local_links: links};
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const result = inspect(process.cwd());
    process.stdout.write(`Release check passed: ${result.files} files, ${result.local_links} local links; pinned dependencies and pattern scan checked.\n`);
  } catch (error) {process.stderr.write(`release check failed: ${error.message}\n`); process.exitCode = 1;}
}
