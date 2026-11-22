import { detectType } from "pele/core";
import { renderAnimatedSvg, renderMindmapSvg, THEME_NAMES, type ThemeName } from "../src/index.js";
import { PRESETS } from "./presets.js";

/** Not Mermaid but a Markdown outline (headings or list items): drawn as a mind map. */
const isOutline = (text: string) =>
  detectType(text) === null && /^\s*(#{1,6}\s|[-*+]\s|\d+[.)]\s)/m.test(text);

const presetEl = document.getElementById("preset") as HTMLSelectElement;
const themeEl = document.getElementById("theme") as HTMLSelectElement;
const speedEl = document.getElementById("speed") as HTMLSelectElement;
const animateEl = document.getElementById("animate") as HTMLInputElement;
const transparentEl = document.getElementById("transparent") as HTMLInputElement;
const titleEl = document.getElementById("titleInput") as HTMLInputElement;
const footerEl = document.getElementById("footerInput") as HTMLInputElement;
const sourceEl = document.getElementById("source") as HTMLTextAreaElement;
const previewEl = document.getElementById("preview") as HTMLDivElement;
const statsEl = document.getElementById("stats") as HTMLSpanElement;
const copyBtn = document.getElementById("copyBtn") as HTMLButtonElement;
const downloadBtn = document.getElementById("downloadBtn") as HTMLButtonElement;

for (const [idx, preset] of PRESETS.entries()) {
  const opt = document.createElement("option");
  opt.value = String(idx);
  opt.textContent = preset.name;
  presetEl.append(opt);
}

for (const theme of THEME_NAMES) {
  const opt = document.createElement("option");
  opt.value = theme;
  opt.textContent = `Theme: ${theme}`;
  themeEl.append(opt);
}

let currentSvg = "";

function update(): void {
  const t0 = performance.now();
  try {
    const opts: Parameters<typeof renderAnimatedSvg>[1] = {
      theme: themeEl.value as ThemeName,
      animate: animateEl.checked,
      transparent: transparentEl.checked,
      speed: Number.parseFloat(speedEl.value) || 1,
    };
    if (titleEl.value.trim()) opts.title = titleEl.value.trim();
    if (footerEl.value.trim()) opts.footer = footerEl.value.trim();

    currentSvg = isOutline(sourceEl.value)
      ? renderMindmapSvg(sourceEl.value, opts)
      : renderAnimatedSvg(sourceEl.value, opts);
    previewEl.innerHTML = currentSvg;
    const ms = (performance.now() - t0).toFixed(1);
    const kb = (new Blob([currentSvg]).size / 1024).toFixed(1);
    statsEl.textContent = `${kb} KB · rendered in ${ms} ms`;
  } catch (err) {
    currentSvg = "";
    const msg = err instanceof Error ? err.message : String(err);
    previewEl.innerHTML = `<div class="error">${msg.replaceAll("<", "&lt;")}</div>`;
    statsEl.textContent = "Parse error";
  }
}

function loadPreset(index: number): void {
  const preset = PRESETS[index] ?? PRESETS[0]!;
  titleEl.value = preset.title;
  footerEl.value = preset.footer;
  sourceEl.value = preset.source;
  update();
}

presetEl.addEventListener("change", () => loadPreset(Number(presetEl.value)));
for (const el of [themeEl, speedEl, animateEl, transparentEl, titleEl, footerEl, sourceEl]) {
  el.addEventListener("input", update);
  el.addEventListener("change", update);
}

copyBtn.addEventListener("click", async () => {
  if (!currentSvg) return;
  await navigator.clipboard.writeText(currentSvg);
  copyBtn.textContent = "Copied!";
  setTimeout(() => {
    copyBtn.textContent = "Copy SVG";
  }, 1500);
});

downloadBtn.addEventListener("click", () => {
  if (!currentSvg) return;
  const blob = new Blob([currentSvg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "diagram.svg";
  a.click();
  URL.revokeObjectURL(url);
});

loadPreset(0);
