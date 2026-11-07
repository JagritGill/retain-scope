import {openSync, readSync, closeSync, statSync, fstatSync} from "node:fs";
import {parseGraph} from "./src/model.ts";
import {analyze} from "./src/analyze.ts";
import {textReport} from "./src/report.ts";

function readInput(path) {
  if (!statSync(path).isFile()) throw new Error("input must be a regular JSON file");
  const fd = openSync(path, "r"), bytes = Buffer.alloc(1_048_577);
  let count = 0;
  try {
    if (!fstatSync(fd).isFile()) throw new Error("input must be a regular JSON file");
    while (count < bytes.length) {
      const read = readSync(fd, bytes, count, bytes.length - count, null);
      if (read === 0) break;
      count += read;
    }
  } finally {closeSync(fd);}
  if (count > 1_048_576) throw new Error("input exceeds 1 MiB");
  return JSON.parse(new TextDecoder("utf-8", {fatal: true, ignoreBOM: true}).decode(bytes.subarray(0, count)));
}
const usage = "Usage: node cli.mjs GRAPH.json [--format text|json]\n";
try {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === "--help") process.stdout.write(usage);
  else {
    if (!(args.length === 1 || (args.length === 3 && args[1] === "--format" && ["text", "json"].includes(args[2])))) throw new Error(usage.trim());
    const result = analyze(parseGraph(readInput(args[0])));
    process.stdout.write(args[2] === "json" ? JSON.stringify(result, null, 2) + "\n" : textReport(result));
  }
} catch (error) {process.stderr.write("error: " + error.message + "\n"); process.exitCode = 2;}
