import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { ROOT } from "./helpers.mjs";

const require = createRequire(import.meta.url);
const ts = require(path.join(ROOT, "frontend/node_modules/typescript"));

export async function importTs(relativePath) {
  const fullPath = path.join(ROOT, relativePath);
  const source = fs.readFileSync(fullPath, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
    fileName: fullPath,
  }).outputText;

  const encoded = Buffer.from(compiled, "utf8").toString("base64");
  return import(`data:text/javascript;base64,${encoded}#${Date.now()}-${Math.random().toString(16).slice(2)}`);
}
