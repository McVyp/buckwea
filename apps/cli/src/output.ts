import { BundleFile, BundleOutput } from "@buckwea/core";
import { join } from "node:path";

export interface OutputFile {
  path: string;
  contents: string;
}

function filesFor(file: BundleFile, outdir: string): OutputFile[] {
  const mapName = `${file.fileName}.map`;
  return [
    {
      path: join(outdir, file.fileName),
      contents: `${file.code}\n//# sourceMappingURL=${mapName}\n`,
    },
    {
      path: join(outdir, mapName),
      contents: JSON.stringify({ ...file.map, file: file.fileName }),
    },
  ];
}

// turn bundle into list of files to write: a .js and a .js.map for entry and for every chunk. Pure: never touches the disk.
export function createOutputFiles(
  output: BundleOutput,
  outdir: string,
): OutputFile[] {
  return [output.entry, ...output.chunks.values()].flatMap((file) =>
    filesFor(file, outdir),
  );
}
