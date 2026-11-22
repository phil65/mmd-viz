import { describe, expect, it } from "vitest";
import { renderAnimatedSvg } from "../src/index.js";

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

  it("supports light theme and custom idPrefix", () => {
    const svg = renderAnimatedSvg(SAMPLE, { theme: "light", idPrefix: "custom" });
    expect(svg).toContain("#F8FAFC");
    expect(svg).toContain('id="custom-dots"');
    expect(svg).toContain('id="custom-edge-0"');
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
});
