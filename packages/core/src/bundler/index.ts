import { ModuleGraph } from "../module-graph/index.js";
import { findUsedExports, UsedExports } from "../tree-shaking/index.js";

function rewriteModule(
  graph: ModuleGraph,
  filePath: string,
  usedExports: UsedExports,
): string {
  const node = graph.get(filePath);
  if (!node) {
    throw new Error(`Module "${filePath}" not found in module graph.`);
  }

  const { parsedModule, dependencies } = node;
  const usedHere = usedExports.get(filePath);
  let source = parsedModule.source;

  const edits: { start: number; end: number; replacement: string }[] = [];

  for (const imp of parsedModule.imports) {
    const resolved = dependencies.get(imp.specifier);
    if (!resolved) {
      throw new Error(
        `Failed to resolve import "${imp.specifier}" in "${filePath}".`,
      );
    }

    let replacement: string;

    if (imp.bindings === "default") {
      replacement = `var ${imp.local} = require("${resolved}").default;`;
    } else if (imp.bindings === "*") {
      replacement = `var ${imp.local} = require("${resolved}");`;
    } else {
      replacement = `var ${imp.local} = require("${resolved}").${imp.bindings};`;
    }

    edits.push({
      start: imp.start,
      end: imp.end,
      replacement,
    });
  }

  for (const exp of parsedModule.exports) {
    let replacement: string;
    const isDefault = exp.exported === "default";
    const isUsed = isDefault || usedHere?.has(exp.exported) === true;

    if (isDefault) {
      const originalText = source.slice(exp.start, exp.end);
      const withoutExportDefault = originalText.replace(
        /^export\s+default\s+/,
        "",
      );
      replacement = `module.exports.default = ${withoutExportDefault};`;
    } else if (exp.reexportFrom) {
      const resolved = dependencies.get(exp.reexportFrom);
      if (!resolved) {
        throw new Error(
          `Failed to resolve re-export "${exp.reexportFrom}" in "${filePath}".`,
        );
      }
      replacement = isUsed
        ? `module.exports.${exp.exported} = require(${JSON.stringify(resolved)}).${exp.local};`
        : "";
    } else {
      // export const x = 1;  -> module.exports.x = (function() { const x = 1; return x; })
      const originalText = source.slice(exp.start, exp.end);
      if (originalText.trim().startsWith("export {")) {
        replacement = isUsed
          ? `module.exports.${exp.exported} = ${exp.local};`
          : "";
      } else {
        const withoutExport = originalText.replace(/^export\s+/, "");
        replacement = isUsed
          ? `${withoutExport} module.exports.${exp.exported} = ${exp.local};`
          : withoutExport;
      }
    }
    edits.push({
      start: exp.start,
      end: exp.end,
      replacement,
    });
  }

  edits.sort((a, b) => b.start - a.start);
  for (const edit of edits) {
    source =
      source.slice(0, edit.start) + edit.replacement + source.slice(edit.end);
  }

  return source;
}

export function bundle(graph: ModuleGraph, entryPath: string): string {
  const entryNode = graph.get(entryPath);
  if (!entryNode) {
    throw new Error(`Entry path "${entryPath}" not found in module graph.`);
  }

  const usedExports = findUsedExports(graph);

  let entrySet = usedExports.get(entryPath);
  if (!entrySet) {
    entrySet = new Set();
    usedExports.set(entryPath, entrySet);
  }
  for (const exp of entryNode.parsedModule.exports) {
    entrySet.add(exp.exported);
  }

  const moduleEntries: string[] = [];
  for (const [filePath] of graph) {
    const rewritten = rewriteModule(graph, filePath, usedExports);
    moduleEntries.push(
      `__modules__[${JSON.stringify(filePath)}] = function(module, exports, require) {\n${rewritten}\n};`,
    );
  }
  return `
  var __modules__ = {};
  var __cache__ = {};

  function __require__(path) {
  if (__cache__[path]) return __cache__[path].exports;
  var module = { exports:  {} };
  __cache__[path] = module;
  __modules__[path](module, module.exports, __require__);
  return module.exports;
  }
  
  ${moduleEntries.join("\n")}
  return __require__(${JSON.stringify(entryPath)});
  `.trim();
}
