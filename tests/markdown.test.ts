import rehypeStringify from "rehype-stringify";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { describe, expect, it } from "vitest";
import { type MarkdownDiagramOptions, parseMeta, rehypeMmdViz, remarkMmdViz } from "../src/markdown.js";

const viaRehype = (markdown: string, options?: MarkdownDiagramOptions) =>
  String(
    unified()
      .use(remarkParse)
      .use(remarkRehype)
      .use(rehypeMmdViz, options)
      .use(rehypeStringify, { allowDangerousHtml: true })
      .processSync(markdown)
  );

const viaRemark = (markdown: string, options?: MarkdownDiagramOptions) =>
  String(
    unified()
      .use(remarkParse)
      .use(remarkMmdViz, options)
      .use(remarkRehype, { allowDangerousHtml: true })
      .use(rehypeStringify, { allowDangerousHtml: true })
      .processSync(markdown)
  );

const DOC = "# Doc\n\n```mermaid\nflowchart LR\n  a --> b\n```\n\n```ts\nconst x = 1;\n```\n";

describe("rehypeMmdViz", () => {
  it("turns mermaid blocks into an <img> with the animated SVG, other code stays", () => {
    const html = viaRehype(DOC);
    expect(html).toMatch(/<img class="mmd-viz" src="data:image\/svg\+xml,%3Csvg/);
    expect(html).toMatch(/width="\d+" height="\d+"/);
    expect(decodeURIComponent(html)).toContain("<animateMotion");
    expect(html).toContain('<code class="language-ts">');
    expect(html).not.toContain("language-mermaid");
  });

  it("inlines the SVG with as: svg", () => {
    const html = viaRehype(DOC, { as: "svg", className: "diagram" });
    expect(html).toContain('<div class="diagram"><svg xmlns="http://www.w3.org/2000/svg"');
  });

  it("draws markmap blocks as mind maps", () => {
    const html = viaRehype("```markmap\n# Root\n- a\n- b\n```\n", { as: "svg" });
    expect(html).toContain("pele-root");
    expect(html).toContain('data-id="0.1"');
  });

  it("reads per-block options from the fence", () => {
    const html = viaRehype('```mermaid theme=light title="Login flow" static\nflowchart LR\n  a --> b\n```\n', {
      as: "svg",
    });
    expect(html).toContain("Login flow");
    expect(html).toContain("#F8FAFC"); // light background
    expect(html).not.toContain("<animateMotion");
  });

  it("keeps a block that doesn't render, or fails the build when asked", () => {
    const broken = "```mermaid\nflowchart LR\n  a -->\n```\n";
    expect(viaRehype(broken)).toContain('<code class="language-mermaid">');
    expect(() => viaRehype(broken, { onError: "throw" })).toThrow();
    const errors: string[] = [];
    viaRehype(broken, { onError: (_e, source) => errors.push(source) });
    expect(errors).toHaveLength(1);
  });

  it("gives every block its own id prefix", () => {
    const html = viaRehype(`${DOC}\n${DOC}`, { as: "svg" });
    const prefixes = new Set([...html.matchAll(/class="(mmd\d+)-root"/g)].map((m) => m[1]));
    expect(prefixes.size).toBe(2);
  });
});

describe("remarkMmdViz", () => {
  it("replaces code nodes with html", () => {
    const html = viaRemark(DOC);
    expect(html).toMatch(/<img class="mmd-viz" src="data:image\/svg\+xml,/);
    expect(html).toContain('<code class="language-ts">');
  });

  it("escapes the alt text", () => {
    const html = viaRemark('```mermaid alt="a \\"b\\" <c>"\nflowchart LR\n  a --> b\n```\n');
    expect(html).not.toContain("<c>");
  });
});

describe("parseMeta", () => {
  it("reads theme, title, footer, speed and flags", () => {
    expect(parseMeta('theme=nord title="A b" footer=x speed=2 static transparent')).toEqual({
      theme: "nord",
      title: "A b",
      footer: "x",
      speed: 2,
      animate: false,
      transparent: true,
    });
    expect(parseMeta("theme=nope")).toEqual({});
    expect(parseMeta(undefined)).toEqual({});
  });
});
