import { parseArgs as parseNodeArgs } from "node:util";

export type CliCommand =
  | { command: "build"; entry: string; outdir: string; minify: boolean }
  | { command: "graph"; entry: string }
  | { command: "help" };

export class UsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UsageError";
  }
}

export const USAGE = `Usage:
buckwea build <entry> [--outdir <dir>] [--minify]
buckwea graph <entry>
buckwea --help`;

function runNodeParse(argv: string[]) {
  return parseNodeArgs({
    args: argv,
    allowPositionals: true,
    options: {
      outdir: { type: "string" },
      minify: { type: "boolean" },
      help: { type: "boolean", short: "h" },
    },
  });
}

export function parseArgs(argv: string[]): CliCommand {
  let parsed: ReturnType<typeof runNodeParse>;
  try {
    parsed = runNodeParse(argv);
  } catch (err) {
    throw new UsageError((err as Error).message);
  }

  const { values, positionals } = parsed;
  if (values.help || positionals.length === 0) {
    return { command: "help" };
  }

  const [command, entry, ...extra] = positionals;
  if (command !== "build" && command !== "graph") {
    throw new UsageError(`Unknown command: ${command}`);
  }

  if (!entry) {
    throw new UsageError(`Missing entry file: buckwea ${command} <entry>`);
  }
  if (extra.length > 0) {
    throw new UsageError(`Unexpected extra arguments: ${extra[0]}`);
  }

  if (command === "graph") {
    return { command: "graph", entry };
  }

  return {
    command: "build",
    entry,
    outdir: values.outdir ?? "dist",
    minify: values.minify ?? false,
  };
}
