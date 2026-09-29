import type { BundleStats } from "@buckwea/core";
import { layoutTree, squarify } from "./layout.js";
import { buildTree } from "./tree.js";
import { formatStatsJson } from "./report.js";

export function embeddedLayoutCode(): string {
  return [buildTree, squarify, layoutTree]
    .map((f) => f.toString())
    .join("\n\n");
}

const STYLE = "";
const MAIN = "";

export function renderHtmlReport(stats: BundleStats): string {
  const json = formatStatsJson(stats).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Bundle Report</title>
  <style>${STYLE}</style>
</head>
<body>
  <div id="map"></div>
  <script type="application/json" id="stats">${json}</script>
  <script>
  ${embeddedLayoutCode()}
  ${MAIN}
  </script>
</body>
</html>`;
}
