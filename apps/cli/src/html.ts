import { layoutTree, squarify } from "./layout.js";
import { buildTree } from "./tree.js";

export function embeddedLayoutCode(): string {
  return [buildTree, squarify, layoutTree]
    .map((f) => f.toString())
    .join("\n\n");
}
