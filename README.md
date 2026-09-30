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
buckwea build <entry> [--outdir <dir>] [--minify]
buckwea analyze <entry> [--minify] [--json | --html <file>]
buckwea graph <entry>
```
