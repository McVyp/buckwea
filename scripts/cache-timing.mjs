import { mkdirSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { styleText } from "node:util";
import {
  buildModuleGraph,
  relativizeGraph,
  bundle,
  createDiskCache,
  toModuleId,
} from "../packages/core/dist/index.js";

const MODULES = 500;
const RUNS = 5;

const TOTAL_STEPS = 1 + 2 * RUNS + 1 + RUNS;
let done = 0;

// module i impoirts 2i+1 and 2i+2 (a tree, so recursion stays shallow).
// 20 helper functions with type annotations give the paser real work.
function moduleSource(i) {
  const kids = [2 * i + 1, 2 * i + 2].filter((k) => k < MODULES);
  const imports = kids
    .map((k) => `import { f${k} } from "./m${k}.js";`)
    .join("\n");
  const calls = kids.map((k) => ` + f${k}(p)`).join("");
  const helpers = Array.from(
    { length: 20 },
    (_, j) => `
    function h${j}(xs: number[], factor: number): number {
        let total: number = 0;
        for (const x of xs) {
            total += x * factor + ${j};
        }
        return total;
    }`,
  ).join("\n");
  return `${imports}
  interface Point { x : number; y : number; }
  ${helpers}

  export function f${i}(p: Point): number {
    return h0([p.x, p.y], ${i})${calls};
  }
  `;
}

function generateProject(dir) {
  mkdirSync(dir, { recursive: true });
  let bytes = 0;
  for (let i = 0; i < MODULES; i++) {
    const source = moduleSource(i);
    bytes += Buffer.byteLength(source);
    writeFileSync(join(dir, `m${i}.ts`), source);
  }
  const entry = join(dir, "index.ts");
  writeFileSync(
    entry,
    'import {f0} from "./m0.js";\nconsole.log(f0({ x: 1, y : 2}));\n',
  );
  return { entry, bytes };
}

function buildOnce(entry, root, cacheDir) {
  const options =
    cacheDir === undefined ? {} : { cache: createDiskCache(cacheDir) };
  const graph = relativizeGraph(buildModuleGraph(entry, options), root);
  return bundle(graph, toModuleId(root, entry), { format: "script" });
}

function time(fn) {
  const start = performance.now();
  const result = fn();
  return { ms: performance.now() - start, result };
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function progress(label) {
  if (!process.stdout.isTTY) return;
  const width = 30;
  const filled = Math.round((done / TOTAL_STEPS) * width);
  const bar =
    styleText("cyan", "#".repeat(filled)) + "-".repeat(width - filled);
  const pct = String(Math.round((done / TOTAL_STEPS) * 100)).padStart(3);
  process.stdout.write(`\r[${bar}] ${pct}% ${label.padEnd(30)}`);
}

function step(label, fn) {
  progress(label);
  const result = fn();
  done++;
  return result;
}

function clearProgress() {
  if (process.stdout.isTTY) process.stdout.write(`\r${"".padEnd(80)}\r`);
}

const work = mkdtempSync(join(tmpdir(), "buckwea-timing-"));
try {
  const root = join(work, "project");
  const { entry, bytes } = generateProject(root);
  const reference = step("warm-up build", () => buildOnce(entry, root)).entry
    .code;

  const none = [];
  const cold = [];
  const warm = [];
  
  for (let r = 0; r < RUNS; r++) {
    none.push(
      step(
        `no cache  run ${r + 1}/${RUNS}`,
        () => time(() => buildOnce(entry, root)).ms,
      ),
    );

    // a fresh. empty folder every run: parse everything  + write the cache
    cold.push(
      step(
        `cold cache  run ${r + 1}/${RUNS}`,
        () => time(() => buildOnce(entry, root, join(work, `cold-${r}`))).ms,
      ),
    );
  }

  const warmDir = join(work, "warm");
  step("filling the warm cache", () => buildOnce(entry, root, warmDir));
  for (let r = 0; r < RUNS; r++) {
    const { ms, result } = step(`warm cache  run ${r + 1}/${RUNS}`, () =>
      time(() => buildOnce(entry, root, warmDir)),
    );
    if (result.entry.code !== reference) {
      throw new Error("Warm build produced different output than reference");
    }
    warm.push(ms);
  }
  clearProgress();

  const fmt = (ms) => `${ms.toFixed(1).padStart(8)} ms`;
  console.log(
    `Project: ${MODULES + 1} modules, ${(bytes / 1024).toFixed(0)} KB`,
  );
  console.log(`Full build (graph + build), median of ${RUNS} runs:`);
  console.log(`  no cache   ${fmt(median(none))}`);
  console.log(`  cold cache ${fmt(median(cold))}`);
  console.log(`  warm cache ${fmt(median(warm))}`);
  console.log(
    `warm cache is ${(median(none) / median(warm)).toFixed(1)}X faster than no cache.`,
  );
} finally {
  rmSync(work, { recursive: true, force: true });
}
