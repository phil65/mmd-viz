#!/usr/bin/env node
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { parseArgs } from "node:util";
import { renderAnimatedSvg } from "./animate.js";
import { THEME_NAMES, type AnimateOptions, type ThemeName } from "./themes.js";

const HELP = `mmd-viz — Turn Mermaid diagrams into zero-JS styled & animated SVGs

Usage:
  mmd-viz <input.mmd> [options]
  mmd-viz <directory> [-o <outDir>] [options]   Batch-render all *.mmd files
  cat diagram.mmd | mmd-viz [options] > out.svg

Options:
  -o, --output <path>     Output SVG file (or output directory in batch mode)
  --title <text>          Header badge above the diagram
  --footer <text>         Monospace footer pill below the diagram
  --theme <name>          Theme: ${THEME_NAMES.join(" | ")} (default: dark)
  --speed <multiplier>    Animation speed multiplier, e.g. 0.5, 1, 2 (default: 1)
  --transparent           Omit background card, dot grid, and ambient glows
  --static                Disable animations (styled static SVG)
  --prefix <id>           Prefix for internal SVG IDs (default: mmd)
  -h, --help              Show this help
`;

function collectMmdFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectMmdFiles(full));
    } else if (entry.isFile() && entry.name.endsWith(".mmd")) {
      results.push(full);
    }
  }
  return results.sort();
}

function main(): void {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      output: { type: "string", short: "o" },
      title: { type: "string" },
      footer: { type: "string" },
      theme: { type: "string" },
      speed: { type: "string" },
      transparent: { type: "boolean", default: false },
      static: { type: "boolean", default: false },
      prefix: { type: "string" },
      help: { type: "boolean", short: "h", default: false },
    },
  });

  if (values.help) {
    process.stdout.write(HELP);
    return;
  }

  const theme = (values.theme ?? "dark") as ThemeName;
  if (!THEME_NAMES.includes(theme)) {
    process.stderr.write(
      `Error: Invalid --theme "${theme}". Expected one of: ${THEME_NAMES.join(", ")}.\n`
    );
    process.exitCode = 1;
    return;
  }

  let speed = 1;
  if (values.speed !== undefined) {
    speed = Number.parseFloat(values.speed);
    if (!Number.isFinite(speed) || speed <= 0) {
      process.stderr.write(`Error: Invalid --speed "${values.speed}". Expected a positive number.\n`);
      process.exitCode = 1;
      return;
    }
  }

  const opts: AnimateOptions = {
    theme,
    animate: !values.static,
    transparent: values.transparent,
    speed,
  };
  if (values.title !== undefined) opts.title = values.title;
  if (values.footer !== undefined) opts.footer = values.footer;
  if (values.prefix !== undefined) opts.idPrefix = values.prefix;

  const inputPath = positionals[0];

  // Directory batch mode: convert all *.mmd recursively
  if (inputPath && inputPath !== "-" && statSync(inputPath).isDirectory()) {
    const rootDir = resolve(inputPath);
    const outRoot = values.output ? resolve(values.output) : rootDir;
    const files = collectMmdFiles(rootDir);
    if (files.length === 0) {
      process.stderr.write(`No .mmd files found in ${inputPath}\n`);
      return;
    }
    for (const file of files) {
      const rel = relative(rootDir, file).replace(/\.mmd$/, ".svg");
      const outFile = join(outRoot, rel);
      mkdirSync(dirname(outFile), { recursive: true });
      const svg = renderAnimatedSvg(readFileSync(file, "utf8"), opts);
      writeFileSync(outFile, svg, "utf8");
      process.stdout.write(`${file} -> ${outFile}\n`);
    }
    return;
  }

  let source: string;
  if (inputPath && inputPath !== "-") {
    source = readFileSync(inputPath, "utf8");
  } else if (!process.stdin.isTTY) {
    source = readFileSync(0, "utf8");
  } else {
    process.stderr.write("Error: Provide an input file, directory, or pipe Mermaid source on stdin.\n\n");
    process.stderr.write(HELP);
    process.exitCode = 1;
    return;
  }

  const svg = renderAnimatedSvg(source, opts);

  if (values.output) {
    mkdirSync(dirname(resolve(values.output)), { recursive: true });
    writeFileSync(values.output, svg, "utf8");
  } else {
    process.stdout.write(svg);
  }
}

main();
