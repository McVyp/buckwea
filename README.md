# buckwea
A simple JavaScript/TypeScript bundler 

<p align="center">
  <img alt="buckwea" src="https://github.com/user-attachments/assets/970c18a5-1316-46b1-a902-c00ea95651f3" />
</p>

## Quick start
Requires Node.js 24+ and pnpm

```bash
pnpm install
pnpm build
pnpm report examples/lazy/index.ts
```

> This writes `report.html` and opens it in the browser (Windows/WSL).
On macOS or Linux, run
`node apps/cli/dist/index.js analyze examples/lazy/index.ts --html report.html`
and open `report.html`

## Usage

Run commands as `node apps/cli/dist/index.js <command>`:
```bash
buckwea build <entry> [--outdir <dir>] [--minify] [--no-cache]
buckwea analyze <entry> [--minify] [--no-cache] [--json | --html <file>]
buckwea graph <entry>
```

## Caching
Parse results are cached in `.buckwea-cache/` (safe to delete anytime);
pass `--no-cache` to skip it.

On a generated 500-module project, a warm cache makes a full build ~35-40X faster. Most of the uncached time is parsing:
<p align="center">
  <img alt="image" src="https://github.com/user-attachments/assets/5b9d10f0-7baf-42fe-861c-208676a160ae" />
</p>

Measure it:
```bash
pnpm timing:cache
```
