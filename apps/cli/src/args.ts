import { parseArgs as parseNodeArgs } from "node:util";

export type CliCommand =
  | { command: "build"; entry: string; outdir: string; minify: boolean }
  | {
      command: "analyze";
      entry: string;
      minify: boolean;
      json: boolean;
      html: string | undefined;
    }
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
buckwea analyze <entry> [--minify] [--json | --html <file>]
buckwea graph <entry>
buckwea --help`;

function runNodeParse(argv: string[]) {
  return parseNodeArgs({
    args: argv,
    allowPositionals: true,
    options: {
      outdir: { type: "string" },
      minify: { type: "boolean" },
      json: { type: "boolean" },
      html: { type: "string" },
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
  if (command !== "build" && command !== "graph" && command !== "analyze") {
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

  if (command === "analyze") {
    if (values.json && values.html !== undefined) {
      throw new UsageError("Use either --json or --html <file>, not both");
    }

    return {
      command: "analyze",
      entry,
      minify: values.minify ?? false,
      json: values.json ?? false,
      html: values.html,
    };
  }

  return {
    command: "build",
    entry,
    outdir: values.outdir ?? "dist",
    minify: values.minify ?? false,
  };
}
