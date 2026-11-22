#!/usr/bin/env node
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { parseArgs } from "node:util";
import { renderAnimatedSvg } from "./animate.js";
import { renderMindmapSvg } from "./mindmap-svg.js";
import { THEME_NAMES, type AnimateOptions, type ThemeName } from "./themes.js";

import { basename } from "node:path";

const HELP = `mmd-viz — Turn Mermaid diagrams into zero-JS styled & animated SVGs

Usage:
  mmd-viz <input.mmd> [options]
  mmd-viz <notes.mindmap.md> [options]              Markdown outline as a mind map
  mmd-viz <directory> [-o <outDir>] [options]       Batch-render all *.mmd and *.mindmap.md files
  mmd-viz extract <file.md> [-o <outDir>] [options] Extract & render \`\`\`mermaid and \`\`\`markmap blocks
  cat diagram.mmd | mmd-viz [options] > out.svg

Options:
  -o, --output <path>     Output SVG file (or output directory in batch/extract mode)
  --title <text>          Header badge above the diagram
  --footer <text>         Monospace footer pill below the diagram
  --theme <name>          Theme: ${THEME_NAMES.join(" | ")} (default: dark)
  --speed <multiplier>    Animation speed multiplier, e.g. 0.5, 1, 2 (default: 1)
  --transparent           Omit background card, dot grid, and ambient glows
  --static                Disable animations (styled static SVG)
  --prefix <id>           Prefix for internal SVG IDs (default: mmd)
  --mindmap               Read the input as a Markdown outline (headings, lists) and draw a mind map
  --expand-level <n>      Mind maps: show nodes down to this depth (root is 0)
  -h, --help              Show this help
`;

interface Block {
  kind: "mermaid" | "mindmap";
  source: string;
}

function extractBlocks(markdown: string): Block[] {
  const blocks: Block[] = [];
  const regex = /^```(mermaid|markmap)[^\n]*\n([\s\S]*?)^```/gm;
  for (const match of markdown.matchAll(regex)) {
    if (match[2]?.trim()) {
      blocks.push({ kind: match[1] === "markmap" ? "mindmap" : "mermaid", source: match[2].trim() });
    }
  }
  return blocks;
}

const MINDMAP_SUFFIX = ".mindmap.md";

function isMindmapFile(path: string): boolean {
  return path.toLowerCase().endsWith(MINDMAP_SUFFIX);
}

function collectMmdFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectMmdFiles(full));
    } else if (entry.isFile() && (entry.name.endsWith(".mmd") || isMindmapFile(entry.name))) {
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
      mindmap: { type: "boolean", default: false },
      "expand-level": { type: "string" },
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

  let expandLevel: number | undefined;
  if (values["expand-level"] !== undefined) {
    expandLevel = Number.parseInt(values["expand-level"], 10);
    if (!Number.isInteger(expandLevel) || expandLevel < 0) {
      process.stderr.write(
        `Error: Invalid --expand-level "${values["expand-level"]}". Expected a whole number >= 0.\n`
      );
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

  const render = (source: string, mindmap: boolean, options: AnimateOptions = opts) =>
    mindmap
      ? renderMindmapSvg(source, expandLevel === undefined ? options : { ...options, expandLevel })
      : renderAnimatedSvg(source, options);

  const inputPath = positionals[0];

  // Markdown extract mode: mmd-viz extract README.md [-o outDir]
  if (inputPath === "extract") {
    const mdPath = positionals[1];
    if (!mdPath) {
      process.stderr.write("Error: Provide a Markdown file path: mmd-viz extract <file.md>\n");
      process.exitCode = 1;
      return;
    }
    const mdContent = readFileSync(mdPath, "utf8");
    const blocks = extractBlocks(mdContent);
    if (blocks.length === 0) {
      process.stderr.write(`No \`\`\`mermaid or \`\`\`markmap blocks found in ${mdPath}\n`);
      return;
    }
    const outDir = values.output ? resolve(values.output) : dirname(resolve(mdPath));
    mkdirSync(outDir, { recursive: true });
    const stem = basename(mdPath).replace(/\.[^.]+$/, "");
    blocks.forEach((block, idx) => {
      const outFile = join(outDir, `${stem}-${idx + 1}.svg`);
      const svg = render(block.source, block.kind === "mindmap", {
        ...opts,
        idPrefix: `${opts.idPrefix ?? "mmd"}-${idx + 1}`,
      });
      writeFileSync(outFile, svg, "utf8");
      process.stdout.write(`${mdPath}[${idx + 1}] -> ${outFile}\n`);
    });
    return;
  }

  // Directory batch mode: convert all *.mmd recursively
  if (inputPath && inputPath !== "-" && statSync(inputPath).isDirectory()) {
    const rootDir = resolve(inputPath);
    const outRoot = values.output ? resolve(values.output) : rootDir;
    const files = collectMmdFiles(rootDir);
    if (files.length === 0) {
      process.stderr.write(`No .mmd or ${MINDMAP_SUFFIX} files found in ${inputPath}\n`);
      return;
    }
    for (const file of files) {
      const rel = relative(rootDir, file).replace(/(\.mindmap\.md|\.mmd)$/i, ".svg");
      const outFile = join(outRoot, rel);
      mkdirSync(dirname(outFile), { recursive: true });
      const svg = render(readFileSync(file, "utf8"), isMindmapFile(file));
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

  const svg = render(source, values.mindmap || (inputPath !== undefined && isMindmapFile(inputPath)));

  if (values.output) {
    mkdirSync(dirname(resolve(values.output)), { recursive: true });
    writeFileSync(values.output, svg, "utf8");
  } else {
    process.stdout.write(svg);
  }
}

main();
