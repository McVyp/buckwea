import { assignChunks } from "../chunking/index.js";
import { ModuleGraph } from "../module-graph/index.js";
import { findUsedExports, UsedExports } from "../tree-shaking/index.js";
import {
  addModuleMappings,
  buildSourceMap,
  offsetToLineColumn,
  shiftSourceMapBuilder,
  SourceMapV3,
  SourceMapBuilder,
  createSourceMapBuilder,
} from "../sourcemap/index.js";

interface ModuleEntriesResult {
  code: string;
  mapBuilder: SourceMapBuilder;
}

export interface Mapping {
  generatedStart: number;
  originalStart: number;
}

export interface RewriteResult {
  code: string;
  mappings: Mapping[];
}

export interface BundleFile {
  code: string;
  map: SourceMapV3;
}

export interface BundleOutput {
  entry: BundleFile;
  chunks: Map<string, BundleFile>;
}

export function rewriteModule(
  graph: ModuleGraph,
  filePath: string,
  usedExports: UsedExports,
): RewriteResult {
  const node = graph.get(filePath);
  if (!node) {
    throw new Error(`Module "${filePath}" not found in module graph.`);
  }

  const { parsedModule, dependencies, dynamicDependencies } = node;
  const usedHere = usedExports.get(filePath);
  const source = parsedModule.source;

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

  for (const dynImp of parsedModule.dynamicImports) {
    const resolved = dynamicDependencies.get(dynImp.specifier);
    if (!resolved) {
      throw new Error(
        `Failed to resolve dynamic import "${dynImp.specifier}" in "${filePath}".`,
      );
    }
    const replacements = `__loadChunk__(${JSON.stringify(resolved)}).then(function() { return __require__(${JSON.stringify(resolved)})})`;

    edits.push({
      start: dynImp.start,
      end: dynImp.end,
      replacement: replacements,
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

  edits.sort((a, b) => a.start - b.start);
  let code = "";
  const mappings: Mapping[] = [];
  let cursor = 0;

  for (const edit of edits) {
    if (edit.start > cursor) {
      mappings.push({ generatedStart: code.length, originalStart: cursor });
      code += source.slice(cursor, edit.start);
    }
    if (edit.replacement !== "") {
      mappings.push({ generatedStart: code.length, originalStart: edit.start });
    }
    code += edit.replacement;
    cursor = edit.end;
  }

  if (cursor < source.length) {
    mappings.push({ generatedStart: code.length, originalStart: cursor });
    code += source.slice(cursor);
  }

  return { code, mappings };
}

function buildModuleEntries(
  graph: ModuleGraph,
  members: Set<string>,
  usedExports: Map<string, Set<string>>,
): ModuleEntriesResult {
  const moduleEntries: string[] = [];
  const mapBuilder = createSourceMapBuilder();
  let currentLine = 0;

  for (const filePath of members) {
    const node = graph.get(filePath);
    if (!node) {
      throw new Error(`Module "${filePath}" not found in module graph.`);
    }
    const { code: rewritten, mappings } = rewriteModule(
      graph,
      filePath,
      usedExports,
    );

    const wrapperPrefix = `__modules__[${JSON.stringify(filePath)}] = function(module, exports, require) {\n`;
    const moduleCodeStartLine = currentLine + 1;

    addModuleMappings(
      mapBuilder,
      filePath,
      node.parsedModule.source,
      rewritten,
      mappings,
      moduleCodeStartLine,
    );
    const entryText = `${wrapperPrefix}${rewritten}\n};`;
    moduleEntries.push(entryText);

    const newLineCount = (entryText.match(/\n/g) || []).length;
    currentLine += newLineCount + 1;
  }
  return { code: moduleEntries.join("\n"), mapBuilder };
}

export function bundle(graph: ModuleGraph, entryPath: string): BundleOutput {
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

  const { chunks: chunkMembers, dynamicRoots } = assignChunks(graph, entryPath);

  for (const chunkId of dynamicRoots) {
    if (chunkId === entryPath) continue;
    const chunkNode = graph.get(chunkId);
    if (!chunkNode) continue;
    let chunkSet = usedExports.get(chunkId);
    if (!chunkSet) {
      chunkSet = new Set();
      usedExports.set(chunkId, chunkSet);
    }

    for (const exp of chunkNode.parsedModule.exports) {
      chunkSet.add(exp.exported);
    }
  }

  const entryMembers = chunkMembers.get(entryPath)!;
  const { code: entryModuleEntries, mapBuilder: entryModuleBuilder } =
    buildModuleEntries(graph, entryMembers, usedExports);

  const entryOutput = `
  var __modules__ = {};
  var __cache__ = {};

  function __require__(path) {
  if (__cache__[path]) return __cache__[path].exports;
  var module = { exports: {} };
  __cache__[path] = module;
  __modules__[path](module, module.exports, __require__);
  return module.exports;
}
  ${entryModuleEntries}
  return __require__(${JSON.stringify(entryPath)});
  `.trim();

  const moduleEntriesOffset = entryOutput.indexOf(entryModuleEntries);
  if (moduleEntriesOffset === -1) {
    throw new Error("Failed to locate module entries in the entry output.");
  }

  const { line: moduleEntriesLine } = offsetToLineColumn(
    entryOutput,
    moduleEntriesOffset,
  );

  const shiftedEntryBuilder = shiftSourceMapBuilder(
    entryModuleBuilder,
    moduleEntriesLine - 1,
  );

  const entryMap = buildSourceMap(shiftedEntryBuilder);

  const chunkOutputs = new Map<string, BundleFile>();
  for (const [chunkId, members] of chunkMembers) {
    if (chunkId === entryPath) continue;
    const { code, mapBuilder } = buildModuleEntries(
      graph,
      members,
      usedExports,
    );
    const map = buildSourceMap(mapBuilder);
    chunkOutputs.set(chunkId, { code, map });
  }
  return { entry: { code: entryOutput, map: entryMap }, chunks: chunkOutputs };
}
