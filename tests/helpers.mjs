import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function rel(...parts) {
  return path.join(ROOT, ...parts);
}

export function read(relativePath) {
  return fs.readFileSync(rel(relativePath), "utf8");
}

export function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

export function listFiles(relativeDir, exts, options = {}) {
  const dir = rel(relativeDir);
  const out = [];
  const excluded = options.excluded ?? [];

  function walk(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      const relative = path.relative(ROOT, full).replaceAll("\\", "/");
      if (excluded.some((pattern) => relative.includes(pattern))) continue;
      if (entry.isDirectory()) {
        walk(full);
      } else if (exts.includes(path.extname(entry.name))) {
        out.push(relative);
      }
    }
  }

  walk(dir);
  return out.sort();
}

export function assertNoMatches(assert, files, pattern, message) {
  const offenders = [];
  for (const file of files) {
    const content = read(file);
    if (pattern.test(content)) offenders.push(file);
  }
  assert.deepEqual(offenders, [], message);
}

export function solidityConstants(source, prefix = "ACTION_") {
  const map = new Map();
  const re = new RegExp(`uint8\\s+(?:public|internal)\\s+constant\\s+(${prefix}[A-Z0-9_]+)\\s*=\\s*(\\d+)`, "g");
  for (const match of source.matchAll(re)) {
    map.set(match[1], Number(match[2]));
  }
  return map;
}

export function tsNumberConstants(source, prefix = "ACTION_") {
  const map = new Map();
  const re = new RegExp(`const\\s+(${prefix}[A-Z0-9_]+)\\s*=\\s*(\\d+)`, "g");
  for (const match of source.matchAll(re)) {
    map.set(match[1], Number(match[2]));
  }
  return map;
}
