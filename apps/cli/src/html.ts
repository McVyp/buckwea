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
  .box:hover { outline: 2px solid #111; outline-offset: -2px; }
.file { background: #e0e7ff; }
.folder { background: #fef3c7; }
.module { background: #bbf7d0; }
.runtime { background: #e5e7eb; }
#tip {
    position: fixed;  z-index: 10; pointer-events: none;
    max-width: 420px; padding: 6px 8px; border-radius: 4px;
    background: rgba(17, 17, 17, 0.92); color: #fff; overflow-wrap: anywhere;
}
#tip .title { font-weight: 600; margin-bottom: 4px; }
`;

const MAIN = `
(function () {
    var stats = JSON.parse(document.getElementById("stats").textContent);
    var tree = buildTree(stats);
    var map = document.getElementById("map");
    var tip = document.getElementById("tip");
    var shown = []; //boxes drawn by the last draw(); a box div's data-i indexes this
    
    var moduleById = {};

    for (var m =0; m < stats.modules.length; m++) {
        moduleById[stats.modules[m].id] = stats.modules[m];
    }

    var fileByName = {};

    for (var f = 0; f < stats.files.length; f++) {
        fileByName[stats.files[f].fileName] = stats.files[f];
    }

    function size(n) {
        return n < 1024 ? n + " B" : (n / 1024).toFixed(2) + " KB";
    }

    document.getElementById("summary").textContent = 
    "buckwea: " + stats.modules.length + " modules in " + stats.files.length + 
    " files, " + size(stats.totals.bytes) + " (" + size(stats.totals.gzipBytes) + " gzip)" + (stats.minified ? ", minified" : "");

    function draw() {
        var rect = { x: 0, y: 0, width: map.clientWidth, height: map.clientHeight };
        var boxes = layoutTree(tree, rect, { size: "outputBytes" , padding: 3, header: 21 });
        shown = boxes;
        map.replaceChildren();
        for (var i = 0; i < boxes.length; i++) {
            var b = boxes[i];
            if (b.width < 3 || b.height < 3) continue; // too smal to see or hover
            var el = document.createElement("div");
            el.className = "box " + b.node.kind;
            el.dataset.i = String(i);
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

    // tooltip's lines for one box; the first line is the title.
    function tipLines(node) {
        if (node.kind === "module") {
            var mod = moduleById[node.id];
            return [
                node.id,
                "file: " + mod.fileName,
                "source: " + size(mod.sourceBytes),
                "output: " + size(mod.outputBytes),
                "gzip (alone): " + size(mod.gzipBytes),
                "unused exports: " + (mod.unusedExports.length > 0 ? mod.unusedExports.join(", ") : "none"),
            ]
        }
        if (node.kind === "runtime") {
            var owner = fileByName[node.id];
            return [
                "(runtime) in " + owner.fileName,
                "output: " + size(owner.runtimeBytes),
                "code buckwea adds: module table, require, chunk loading",
            ];
        }
        if (node.kind === "file") {
            var file = fileByName[node.id];
            return [
                file.fileName + (file.isEntry ? " (entry)" : ""),
                "output: " + size(file.bytes),
                "gzip: " + size(file.gzipBytes),
                "runtime: " + size(file.runtimeBytes),
                "modules: " + file.moduleCount,
            ];
        }
        return [
            node.id + "/",
            "output: " + size(node.outputBytes),
            "source: " + size(node.sourceBytes),
        ]
    }

    function showTip(node, x, y) {
        var lines = tipLines(node);
        tip.replaceChildren();
        for (var i = 0; i < lines.length; i++) {
            var line = document.createElement("div");
            line.textContent = lines[i];
            if (i === 0) line.className = "title";
            tip.appendChild(line);
        }
        tip.hidden = false;
        // next to the pointer; flip to the other side near the window edge.
        var left = x + 14;
        var top = y + 14;
        if ( left + tip.offsetWidth > window.innerWidth) left = x - 14 - tip.offsetWidth;
        if (top + tip.offsetHeight > window.innerHeight) top = y - 14 - tip.offsetHeight;
        tip.style.left = Math.max(0, left) + "px";
        tip.style.top = Math.max(0, top) + "px";
    }
    map.addEventListener("mousemove", function(e) {
        var el = e.target.closest(".box");
        if (!el) {
            tip.hidden = true;
            return;
        }
        showTip(shown[Number(el.dataset.i)].node, e.clientX, e.clientY);
    });
    map.addEventListener("mouseleave", function() {
        tip.hidden = true;
    });
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
    <div id="tip" hidden></div>
    <script type="application/json" id="stats">${json}</script>
    <script>
    ${embeddedLayoutCode()}
    ${MAIN}
    </script>
    </body>
</html>`;
}
