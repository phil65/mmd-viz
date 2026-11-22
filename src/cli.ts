#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { renderAnimatedSvg } from "./animate.js";
import type { AnimateOptions, ThemeName } from "./themes.js";

const HELP = `mmd-viz — Turn Mermaid diagrams into zero-JS styled & animated SVGs

Usage:
  mmd-viz [input.mmd] [options]
  cat diagram.mmd | mmd-viz [options] > out.svg

Options:
  -o, --output <file>   Write SVG to file instead of stdout
  --title <text>        Header badge above the diagram
  --footer <text>       Monospace footer pill below the diagram
  --theme <dark|light>  Color theme (default: dark)
  --static              Disable animations (styled static SVG)
  --prefix <id>         Prefix for internal SVG IDs (default: mmd)
  -h, --help            Show this help
`;

function main(): void {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      output: { type: "string", short: "o" },
      title: { type: "string" },
      footer: { type: "string" },
      theme: { type: "string" },
      static: { type: "boolean", default: false },
      prefix: { type: "string" },
      help: { type: "boolean", short: "h", default: false },
    },
  });

  if (values.help) {
    process.stdout.write(HELP);
    return;
  }

  const inputPath = positionals[0];
  let source: string;
  if (inputPath && inputPath !== "-") {
    source = readFileSync(inputPath, "utf8");
  } else if (!process.stdin.isTTY) {
    source = readFileSync(0, "utf8");
  } else {
    process.stderr.write("Error: Provide an input file or pipe Mermaid source on stdin.\n\n");
    process.stderr.write(HELP);
    process.exitCode = 1;
    return;
  }

  const theme = values.theme ?? "dark";
  if (theme !== "dark" && theme !== "light") {
    process.stderr.write(`Error: Invalid --theme "${theme}". Expected "dark" or "light".\n`);
    process.exitCode = 1;
    return;
  }

  const opts: AnimateOptions = {
    theme: theme as ThemeName,
    animate: !values.static,
  };
  if (values.title !== undefined) opts.title = values.title;
  if (values.footer !== undefined) opts.footer = values.footer;
  if (values.prefix !== undefined) opts.idPrefix = values.prefix;

  const svg = renderAnimatedSvg(source, opts);

  if (values.output) {
    writeFileSync(values.output, svg, "utf8");
  } else {
    process.stdout.write(svg);
  }
}

main();
