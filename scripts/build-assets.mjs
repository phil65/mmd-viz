// Regenerates the README images in assets/ from assets/src (run: npm run assets)
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { renderAnimatedSvg, renderMindmapSvg } from "../dist/index.js";

const src = new URL("../assets/src/", import.meta.url).pathname;
const out = new URL("../assets/", import.meta.url).pathname;
const assets = JSON.parse(readFileSync(join(src, "assets.json"), "utf8"));

for (const [name, { source, ...options }] of Object.entries(assets)) {
  const file = source ?? `${name}.mmd`;
  const text = readFileSync(join(src, file), "utf8");
  const opts = { idPrefix: name.replace(/\W/g, ""), ...options };
  const svg = file.endsWith(".md") ? renderMindmapSvg(text, opts) : renderAnimatedSvg(text, opts);
  writeFileSync(join(out, `${name}.svg`), svg);
  console.log(`assets/${name}.svg`);
}
