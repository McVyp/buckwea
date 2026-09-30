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
header { display: flex; align-items: center; gap:16px; padding: 8px 10px; flex-wrap: wrap; }
#summary { font-weight: 600 }
#controls { display: flex; align-items: center; gap: 6px; }
#controls button {
    font: inherit; padding: 2px 8px; cursor: pointer;
    border: 1px solid #999; border-radius: 3px; background: #fff;
}
#controls[data-size="outputBytes"] button[data-size="outputBytes"],
#controls[data-size="sourceBytes"] button[data-size="sourceBytes"] {
    border-color: #111; background: #eee;
}
.legend { display: inline-flex; align-items: center; gap: 4px; margin-left: 8px; color: #555; }
.swatch { display: inline-block; width: 14px; height: 14px; border: 1px solid rgba(0, 0, 0, 0.25); background-color: #bbf7d0;}
#map { position: relative; flex: 1; margin: 0 10px 10px; }
.box { position: absolute; box-sizing: border-box; border: 1px solid rgba(0, 0, 0, 0.25); border-radius: 6px; }
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
.unused {
    background-image: repeating-linear-gradient(45deg, transparent 0 6px, rgba(234, 88, 12, 0.3) 6px 12px);
}
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
    var controls = document.getElementById("controls");
    var sizeKey = "outputBytes"; // or "sourceBytes", switched by the buttons
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

    function plural(n, word) {
        return n + " " + word + (n !== 1 ? "s" : "");
    }

    document.getElementById("summary").textContent = 
    "buckwea: " + plural(stats.modules.length, "module") + " in " + plural(stats.files.length, "file") + 
    ", " + size(stats.totals.bytes) + " (" + size(stats.totals.gzipBytes) + " gzip)" + (stats.minified ? ", minified" : "");

    function hasUnused(node) {
        return node.kind === "module" && moduleById[node.id].unusedExports.length > 0;
    }

    function draw() {
        var rect = { x: 0, y: 0, width: map.clientWidth, height: map.clientHeight };
        // header must fir a label: 12px x 1.4 line height + 4px padding = ~21
        var boxes = layoutTree(tree, rect, { size: sizeKey, padding: 3, header: 21 });
        shown = boxes;
        map.replaceChildren();
        for (var i = 0; i < boxes.length; i++) {
            var b = boxes[i];
            if (b.width < 3 || b.height < 3) continue; // too smal to see or hover
            var el = document.createElement("div");
            el.className = "box " + b.node.kind + (hasUnused(b.node) ? " unused" : "");
            el.dataset.i = String(i);
            el.style.left = b.x + "px";
            el.style.top = b.y + "px";
            el.style.width = b.width + "px";
            el.style.height = b.height + "px";
            var label = document.createElement("span");
            label.textContent = b.node.name + " " + size(b.node[sizeKey]);
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

    //size toggle: css highglights the button matching controls' data-size.
    controls.dataset.size = sizeKey;
    controls.addEventListener("click", function (e) {
        var button = e.target.closest(".size");
        if (!button) return;
        sizeKey = button.dataset.size;
        controls.dataset.size = sizeKey;
        tip.hidden = true;
        draw();
    });

    //redraw once the window stops resizing, not on every resize event.
    var resizeTimer = 0;
    window.addEventListener("resize", function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(draw, 100);
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
    <header>
        <div id="summary"></div>
        <nav id="controls">
            size:
            <button class="size" data-size="outputBytes">output</button>
            <button class="size" data-size="sourceBytes">source</button>
            <span class="legend"><span class="swatch unused"></span>has unused exports</span>
        </nav>
    </header>
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
