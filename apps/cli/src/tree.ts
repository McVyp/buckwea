import type { BundleStats } from "@buckwea/core";

export type TreeNodeKind = "root" | "file" | "folder" | "module" | "runtime";

export interface TreeNode {
  kind: TreeNodeKind;
  name: string;
  id: string;
  sourceBytes: number;
  outputBytes: number;
  children: TreeNode[];
}

/**
this function is copied into the HTML report as source text (buildTree.toString()), so it must stay self-contained: no runtime imports, no calls to other top-level functions. Keep helpers inside it.
*/
export function buildTree(stats: BundleStats): TreeNode {
  function node(kind: TreeNodeKind, name: string, id: string): TreeNode {
    return { kind, name, id, sourceBytes: 0, outputBytes: 0, children: [] };
  }

  const root = node("root", "", "");

  for (const file of stats.files) {
    const fileNode = node("file", file.fileName, file.fileName);
    for (const m of stats.modules) {
      if (m.fileName !== file.fileName) continue;
      const parts = m.id.split("/");
      let parent = fileNode;
      for (let i = 0; i < parts.length - 1; i++) {
        const folderId = parts.slice(0, i + 1).join("/");
        let folder = parent.children.find(
          (c) => c.kind === "folder" && c.id === folderId,
        );
        if (!folder) {
          folder = node("folder", parts[i], folderId);
          parent.children.push(folder);
        }
        parent = folder;
      }
      const leaf = node("module", parts[parts.length - 1], m.id);
      leaf.sourceBytes = m.sourceBytes;
      leaf.outputBytes = m.outputBytes;
      parent.children.push(leaf);
    }
    const runtime = node("runtime", "(runtime)", file.fileName);
    runtime.outputBytes = file.runtimeBytes;
    fileNode.children.push(runtime);
    root.children.push(fileNode);
  }
  function finish(n: TreeNode): void {
    for (const c of n.children) finish(c);
    if (
      n.kind === "folder" &&
      n.children.length === 1 &&
      n.children[0].kind === "folder"
    ) {
      const only = n.children[0];
      n.name = `${n.name}/${only.name}`;
      n.id = only.id;
      n.children = only.children;
    }
    if (n.children.length > 0) {
      n.sourceBytes = n.children.reduce((sum, c) => sum + c.sourceBytes, 0);
      n.outputBytes = n.children.reduce((sum, c) => sum + c.outputBytes, 0);
    }
  }
  finish(root);
  return root;
}
