import { render } from "pele";
import { describe, expect, it } from "vitest";
import { canFold, fold } from "../src/fold.js";

const TREE = `treeView-beta
  src
    components
      button.tsx
      card.tsx
    index.ts
  docs
    index.ts
  package.json`;

const drawnIds = (source: string) =>
  [...render(source).svg.matchAll(/<g class="pele-node[^"]*" data-id="([^"]*)"/g)].map((m) => m[1]);

describe("fold treeView", () => {
  it("lists folders with how many entries they hide, keyed by line", () => {
    const folded = fold(TREE, "treeView")!;
    expect([...folded.foldable]).toEqual([
      ["L1", 4],
      ["L2", 2],
      ["L6", 1],
    ]);
    expect(folded.source).toBe(TREE);
  });

  it("leaves a folded folder's entries out and says how many", () => {
    const folded = fold(TREE, "treeView", new Set(["L2"]))!;
    expect(drawnIds(folded.source)).toEqual(["src", "components (+2)", "index.ts", "docs", "index.ts", "package.json"]);
    // Clicks map back to source lines, past the folded part
    expect(folded.keyAt(1, "components (+2)")).toBe("L2");
    expect(folded.keyAt(3, "docs")).toBe("L6");
    expect(folded.keyAt(2, "index.ts")).toBeNull();
  });

  it("folds nested folders inside a folded one away entirely", () => {
    const folded = fold(TREE, "treeView", new Set(["L1", "L2"]))!;
    expect(drawnIds(folded.source)).toEqual(["src (+4)", "docs", "index.ts", "package.json"]);
  });
});

const CLASSES = `classDiagram
  class Animal {
    <<abstract>>
    +String name
    +eat() void
  }
  Animal : +int age
  Dog : +bark() void
  Dog : +fetch() void
  class Cat
  Animal <|-- Dog
  Animal <|-- Cat : is a`;

describe("fold classDiagram", () => {
  it("counts members from blocks and member lines, not relations", () => {
    const folded = fold(CLASSES, "class")!;
    expect([...folded.foldable]).toEqual([
      ["Animal", 3],
      ["Dog", 2],
    ]);
    expect(folded.keyAt(0, "Cat")).toBeNull();
    expect(folded.keyAt(0, "Dog")).toBe("Dog");
  });

  it("replaces a folded class's members with one line, keeping annotations and relations", () => {
    const folded = fold(CLASSES, "class", new Set(["Animal", "Dog"]))!;
    expect(folded.source).toContain("<<abstract>>");
    expect(folded.source).toContain("⋯ 3 members");
    expect(folded.source).toContain("Dog : ⋯ 2 members");
    expect(folded.source).not.toMatch(/eat\(\)|\+int age|bark|fetch/);
    expect(folded.source).toContain("Animal <|-- Cat : is a");
    const svg = render(folded.source).svg;
    expect(svg).toContain("⋯ 3 members");
    expect(svg).toContain('data-id="Cat"');
  });

  it("knows which types fold", () => {
    expect(canFold("treeView")).toBe(true);
    expect(canFold("class")).toBe(true);
    expect(canFold("flowchart")).toBe(false);
    expect(fold("flowchart LR\n  a --> b", "flowchart")).toBeNull();
  });
});
