import { renderAnimatedSvg, THEME_NAMES, type ThemeName } from "../src/index.js";

interface Preset {
  name: string;
  title: string;
  footer: string;
  source: string;
}

const PRESETS: Preset[] = [
  {
    name: "Architecture Hub (Flowchart)",
    title: "AGENTPOOL · UNIFIED ORCHESTRATION",
    footer: "define once in YAML · planner | (coder & goose)",
    source: `flowchart LR
  native["Native Agent<br/>PydanticAI · Tools"]:::cyan --> hub(["AgentPool<br/>MessageNode"]):::hub
  acp["ACP Agent<br/>Goose · Codex"]:::indigo --> hub
  claude["Claude Code<br/>CLI · Subagents"]:::amber --> hub
  agui["AG-UI & Teams<br/>Chain | Parallel"]:::emerald --> hub
  hub --> s_acp["ACP Server<br/>Zed · VS Code"]:::cyan
  hub --> s_oc["OpenCode<br/>TUI · Desktop"]:::indigo
  hub --> s_mcp["MCP Server<br/>Tools · Prompts"]:::amber
  hub --> s_agui["AG-UI / OpenAI<br/>Web · REST / SSE"]:::emerald`,
  },
  {
    name: "Sequence Relay (sequenceDiagram)",
    title: "SEQUENCE · CHRONOLOGICAL RELAY",
    footer: "messages fire sequentially: 1 -> 2 -> 3 -> 4",
    source: `sequenceDiagram
  participant IDE as Zed / VS Code
  participant AP as AgentPool
  participant LLM as Model / Tool
  IDE->>AP: session/prompt
  AP->>LLM: stream request
  LLM-->>AP: tool_call + deltas
  AP-->>IDE: session/update`,
  },
  {
    name: "State Machine (stateDiagram-v2)",
    title: "STATE MACHINE · TRANSITIONS",
    footer: "stateDiagram-v2 via Pele",
    source: `stateDiagram-v2
  [*] --> Idle
  Idle --> Planning: prompt
  Planning --> Executing: plan_ready
  Executing --> Verifying: tool_done
  Verifying --> Executing: retry
  Verifying --> Idle: complete`,
  },
  {
    name: "Git Graph (gitGraph)",
    title: "GITGRAPH · BRANCHES & COMMITS",
    footer: "themed branches & pulsing commits",
    source: `gitGraph
  commit id: "init"
  branch feat/themes
  checkout feat/themes
  commit id: "auto-theme"
  commit id: "sankey"
  checkout main
  merge feat/themes id: "v0.4.0"`,
  },
  {
    name: "Sankey Flow (sankey-beta)",
    title: "SANKEY · CENTERLINE PARTICLES",
    footer: "sankey-beta weighted flow ribbons",
    source: `sankey-beta
  Prompt,Planner,60
  Prompt,Direct,40
  Planner,Coder,35
  Planner,Research,25`,
  },
  {
    name: "Gantt Roadmap (gantt)",
    title: "GANTT · SWEEPING PLAYHEAD",
    footer: "gantt with animated playhead",
    source: `gantt
  dateFormat YYYY-MM-DD
  section Core
  Parser & Layout :a1, 2026-01-01, 5d
  SVG Animator    :a2, after a1, 4d
  section Launch
  npm Release     :a3, after a2, 2d`,
  },
  {
    name: "Timeline (timeline)",
    title: "TIMELINE · AXIS & MILESTONES",
    footer: "axis pulse & pulsing milestone dots",
    source: `timeline
  2025 : Native Agents : MCP Tools
  2026 : ACP Protocol : OpenCode & AG-UI`,
  },
  {
    name: "Service Architecture (architecture-beta)",
    title: "ARCHITECTURE-BETA · SERVICE TRAFFIC",
    footer: "architecture-beta via Pele",
    source: `architecture-beta
  group api(cloud)[API Layer]
  service gw(internet)[Gateway] in api
  service pool(server)[AgentPool] in api
  service db(database)[Storage]
  gw:R --> L:pool
  pool:B --> T:db`,
  },
];

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

    currentSvg = renderAnimatedSvg(sourceEl.value, opts);
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
