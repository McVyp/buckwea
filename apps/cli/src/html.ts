import type { BundleStats } from "@buckwea/core";
import { layoutTree, squarify } from "./layout.js";
import { buildTree } from "./tree.js";
import { formatStatsJson } from "./report.js";

export function embeddedLayoutCode(): string {
  return [buildTree, squarify, layoutTree]
    .map((f) => f.toString())
    .join("\n\n");
}

const STYLE = `
:root { font: 12px/1.4 system-ui, sans-serif; color: #111; }
html, body { margin: 0; padding: 0; height: 100%; }
body { display: flex; flex-direction: column; background: #f4f4f5; }
#summary { padding: 8px 10px; font-weight: 600; }
#map { position: relative; flex: 1; margin: 0 10px 10px; }
.box { position: absolute; box-sizing: border-box; border: 1px solid rgba(0, 0, 0, 0.25); border-radius: 2px; }
.box > span {
  display: block;
  padding: 2px 4px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.file { background: #e0e7ff; }
.folder { background: #fef3c7; }
.module { background: #bbf7d0; }
.runtime { background: #e5e7eb; }
`;

const MAIN = `
(function () {
    var stats = JSON.parse(document.getElementById("stats").textContent);
    var tree = buildTree(stats);
    var map = document.getElementById("map");

    function size(n) {
    return n < 1024 ? n + " B" : (n / 1024).toFixed(2) + " KB";
    }
    document.getElementById("summary").textContent = 
    "buckwea: " + stats.modules.length + " modules in " + stats.files.length + 
    " files, " + size(stats.totals.bytes) + " (" + size(stats.totals.gzipBytes) + " gzip)" + (stats.minified ? ", minified" : "");

    function draw() {
        var rect = { x: 0, y: 0, width: map.clientWidth, height: map.clientHeight };
        var boxes = layoutTree(tree, rect, { size: "outputBytes" , padding: 3, header: 21 });
        map.replaceChildren();
        for (var i = 0; i < boxes.length; i++) {
            var b = boxes[i];
            if (b.width < 3 || b.height < 3) continue; // too smal to see or hover
            var el = document.createElement("div");
            el.className = "box " + b.node.kind;
            el.style.left = b.x + "px";
            el.style.top = b.y + "px";
            el.style.width = b.width + "px";
            el.style.height = b.height + "px";
            var label = document.createElement("span");
            label.textContent = b.node.name + " " + size(b.node.outputBytes);
            el.appendChild(label);
            map.appendChild(el);
        }
    }
    draw();
})();
`;

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
    <header id="summary"></header>
    <div id="map"></div>
    <script type="application/json" id="stats">${json}</script>
    <script>
    ${embeddedLayoutCode()}
    ${MAIN}
    </script>
    </body>
</html>`;
}
