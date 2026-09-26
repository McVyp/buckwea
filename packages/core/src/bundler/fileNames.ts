import { basename, extname } from "node:path";

export function assignFileNames(
  entryPath: string,
  chunkIds: Iterable<string>,
): Map<string, string> {
  const names = new Map<string, string>();
  const used = new Set<string>();

  const take = (id: string) => {
    const base = basename(id, extname(id));
    let name = `${base}.js`;
    let n = 2;
    while (used.has(name.toLowerCase())) {
      name = `${base}-${n}.js`;
      n++;
    }
    used.add(name.toLowerCase());
    names.set(id, name);
  };

  take(entryPath);
  for (const id of chunkIds) {
    if (id === entryPath) continue;
    take(id);
  }
  return names;
}
