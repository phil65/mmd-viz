import { describe, expect, it } from "vitest";
import {
  countDescendants,
  markdownToMindmap,
  parseOutline,
  renderMindmapSvg,
  type OutlineNode,
} from "../src/index.js";

/** The tree as indented lines: "id content", folded marked with "*". */
function lines(node: OutlineNode, depth = 0): string[] {
  const own = `${"  ".repeat(depth)}${node.id} ${node.content}${node.folded ? " *" : ""}`;
  return [own, ...node.children.flatMap((child) => lines(child, depth + 1))];
}

describe("parseOutline", () => {
  it("nests headings by level and lists by indentation under them", () => {
    const { root } = parseOutline(`# Root
## A
- a1
  - a1x
- a2
## B
### B1
- b
`);
    expect(lines(root)).toEqual([
      "0 Root",
      "  0.0 A",
      "    0.0.0 a1",
      "      0.0.0.0 a1x",
      "    0.0.1 a2",
      "  0.1 B",
      "    0.1.0 B1",
      "      0.1.0.0 b",
    ]);
  });

  it("makes paragraphs leaves and joins their lines and item continuations", () => {
    const { root } = parseOutline(`# Root
First line
second line

- item
  continued
`);
    expect(lines(root)).toEqual(["0 Root", "  0.0 First line second line", "  0.1 item continued"]);
  });

  it("gives several top-level items a root named by rootLabel or the title", () => {
    const md = "---\ntitle: \"My map\"\n---\n- one\n- two\n";
    expect(lines(parseOutline(md).root)).toEqual(["0 My map", "  0.0 one", "  0.1 two"]);
    expect(parseOutline(md, { rootLabel: "Other" }).root.content).toBe("Other");
    expect(parseOutline("- one\n- two").root.content).toBe("");
    expect(parseOutline(md).title).toBe("My map");
  });

  it("skips code, tables and rules, and keeps inline Markdown pele can draw", () => {
    const { root } = parseOutline(`# Root
\`\`\`
- not an item
\`\`\`
| a | b |
---
- [x] done with [a link](https://x.y) and **bold**
- [ ] todo <span>html</span> ![img](a.png)
`);
    expect(lines(root)).toEqual([
      "0 Root",
      "  0.0 ☑ done with a link and **bold**",
      "  0.1 ☐ todo html img",
    ]);
  });

  it("reads markmap fold comments", () => {
    const { root } = parseOutline(`# Root
## A <!-- markmap: fold -->
- a
## B <!-- markmap: foldAll -->
- b
  - c
`);
    expect(lines(root)).toEqual([
      "0 Root",
      "  0.0 A *",
      "    0.0.0 a",
      "  0.1 B *",
      "    0.1.0 b *",
      "      0.1.0.0 c *",
    ]);
  });

  it("counts descendants", () => {
    expect(countDescendants(parseOutline("# R\n- a\n  - b\n- c").root)).toBe(3);
  });
});

describe("markdownToMindmap", () => {
  const md = "# Root\n## A\n- a1\n- a2\n## B\n- b1\n";

  it("builds a pele model whose node ids are outline ids", () => {
    const model = markdownToMindmap(md);
    expect(model.nodes.map((node) => [node.nodeId, node.descr])).toEqual([
      ["0", "Root"],
      ["0.0", "A"],
      ["0.0.0", "a1"],
      ["0.0.1", "a2"],
      ["0.1", "B"],
      ["0.1.0", "b1"],
    ]);
  });

  it("leaves out folded branches and marks the folded node", () => {
    const model = markdownToMindmap(md, {
      folds: new Map([["0.0", true]]),
      foldedLabel: (text, hidden) => `${text} +${hidden}`,
    });
    expect(model.nodes.map((node) => node.nodeId)).toEqual(["0", "0.0", "0.1", "0.1.0"]);
    expect(model.nodes[1]).toMatchObject({ descr: "A +2", class: "mmd-folded" });
  });

  it("folds below expandLevel unless a node is unfolded", () => {
    const model = markdownToMindmap(md, { expandLevel: 1, folds: new Map([["0.1", false]]) });
    expect(model.nodes.map((node) => node.nodeId)).toEqual(["0", "0.0", "0.1", "0.1.0"]);
  });

  it("keeps labels that would be Mermaid syntax as text", () => {
    const model = markdownToMindmap('# a (b) [c] {d} "e" :::x\n- f');
    expect(model.nodes[0]?.descr).toBe('a (b) [c] {d} "e" :::x');
  });
});

describe("renderMindmapSvg", () => {
  const md = "# Plan\n## Build\n- **core**\n- cli\n## Ship\n- npm\n";

  it("renders a themed SVG with outline ids and no script", () => {
    const svg = renderMindmapSvg(md, { animate: false });
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    expect(svg).toContain('data-id="0.0.0"');
    expect(svg).toContain("pele-root");
    expect(svg).not.toContain("<script");
    // Mind map nodes keep pele's pills, not the flowchart cards
    expect(svg).not.toContain("mmd-card\"/><rect");
  });

  it("grows branches once when animated, honoring reduced motion", () => {
    const svg = renderMindmapSvg(md);
    expect(svg).toContain("mmd-grow");
    expect(svg).toContain('pathLength="1"');
    expect(svg).toContain("prefers-reduced-motion: reduce");
    // No looping packets or flowing dashes
    expect(svg).not.toContain("<animateMotion");
    expect(svg).not.toContain('class="mmd-flow"');
  });
});

describe("mmd-viz/mindmap with pele/lazy", () => {
  it("renders the model with pele/lazy's render, as contexter does", async () => {
    const lazy = await import("pele/lazy");
    await lazy.load("mindmap");
    const { svg } = lazy.render(markdownToMindmap("# Root\n- child"));
    expect(svg).toContain('data-id="0.0"');
  });
});
