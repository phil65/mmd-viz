import { describe, expect, it } from "vitest";
import { renderAnimatedSvg, THEME_NAMES } from "../src/index.js";

const SAMPLE = `flowchart LR
  native["Native Agent<br/>PydanticAI · Tools"]:::cyan --> hub(["AgentPool<br/>MessageNode"]):::hub
  acp["ACP Agent<br/>Goose · Codex"]:::indigo --> hub
  hub --> s_acp["ACP Server<br/>Zed · VS Code"]:::cyan
  hub --> s_mcp["MCP Server<br/>Tools · Prompts"]:::amber
`;

describe("renderAnimatedSvg", () => {
  it("renders a self-contained animated SVG with zero JS", () => {
    const svg = renderAnimatedSvg(SAMPLE, {
      title: "AgentPool",
      footer: "define once in YAML",
    });

    expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    expect(svg).toContain('role="img"');
    expect(svg).toContain('aria-label="AgentPool"');
    expect(svg).toContain("prefers-reduced-motion: reduce");
    expect(svg).toContain("transform-box: fill-box");
    expect(svg).not.toContain("<script");
  });

  it("uses negative begin offsets on all animateMotion packets so none park at (0,0)", () => {
    const svg = renderAnimatedSvg(SAMPLE);
    const begins = [...svg.matchAll(/<animateMotion[^>]*begin="([^"]+)"/g)].map((m) => m[1]);
    expect(begins.length).toBe(4);
    for (const b of begins) {
      expect(b).toMatch(/^-[0-9.]+s$/);
    }
  });

  it("matches longest node IDs first when coloring edges (s_acp vs acp)", () => {
    const svg = renderAnimatedSvg(SAMPLE);
    const edgeMatch = svg.match(/<g class="pele-edge" data-id="L_hub_s_acp_0">([\s\S]*?)<\/g>/);
    expect(edgeMatch?.[1]).toContain('stroke="#38BDF8"');
  });

  it("supports static mode without animations or animateMotion", () => {
    const svg = renderAnimatedSvg(SAMPLE, { animate: false });
    expect(svg).not.toContain("<animateMotion");
    expect(svg).not.toContain("@keyframes");
  });

  it("supports auto theme with prefers-color-scheme media query and all curated themes", () => {
    const autoSvg = renderAnimatedSvg(SAMPLE, { theme: "auto" });
    expect(autoSvg).toContain("@media (prefers-color-scheme: light)");

    for (const theme of THEME_NAMES) {
      const svg = renderAnimatedSvg(SAMPLE, { theme, idPrefix: "custom" });
      expect(svg).toContain('id="custom-dots"');
    }
  });

  it("supports transparent mode and speed multiplier", () => {
    const svg = renderAnimatedSvg(SAMPLE, { transparent: true, speed: 2 });
    expect(svg).not.toContain('class="mmd-bg"');
    expect(svg).toContain("0.90s linear infinite");
  });

  it("differentiates thick (==>) and dotted (-.->) edges", () => {
    const mmd = `flowchart LR
      a["Fast"]:::cyan ==> b["Core"]:::indigo
      b -.-> c["Async"]:::emerald
    `;
    const svg = renderAnimatedSvg(mmd);
    expect(svg).toContain('r="4.6"');
    expect(svg).toContain('r="3.2"');
    expect(svg).toContain('stroke-dasharray="5 5"');
  });

  it("animates sequenceDiagram messages as a chronological relay", () => {
    const seq = `sequenceDiagram
      Client->>AgentPool: prompt
      AgentPool-->>Client: stream
    `;
    const svg = renderAnimatedSvg(seq, { title: "Sequence" });
    expect(svg).toContain("<svg");
    expect(svg).toContain("AgentPool");
    expect(svg).toContain('keyPoints="0;1;1"');
    expect(svg).toContain('keyPoints="0;0;1;1"');
    expect(svg).toContain('attributeName="opacity"');
  });

  it("animates stateDiagram-v2 transitions", () => {
    const state = `stateDiagram-v2
      [*] --> Idle
      Idle --> Running: start
      Running --> Idle: done
    `;
    const svg = renderAnimatedSvg(state, { title: "State Machine" });
    const motions = [...svg.matchAll(/<animateMotion/g)];
    expect(motions.length).toBe(3);
  });

  it("animates gitGraph branches and commits", () => {
    const git = `gitGraph
      commit id: "init"
      branch feat
      checkout feat
      commit id: "add-api"
      checkout main
      merge feat id: "v0.2"
    `;
    const svg = renderAnimatedSvg(git, { title: "Git Flow" });
    const motions = [...svg.matchAll(/<animateMotion/g)];
    expect(motions.length).toBeGreaterThanOrEqual(3);
    expect(svg).toContain("mmd-pulse");
  });
});
