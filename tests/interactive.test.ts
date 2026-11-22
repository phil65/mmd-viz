import { describe, expect, it } from "vitest";
import { distanceToBox, flowThrough, nearestBox, sankeyEnds } from "../src/interactive.js";

describe("interactive geometry", () => {
  const boxes = new Map([
    ["a", { x: 0, y: 0, width: 50, height: 20 }],
    ["b", { x: 200, y: 0, width: 50, height: 20 }],
  ]);

  it("measures from a point to a box", () => {
    expect(distanceToBox({ x: 10, y: 10 }, boxes.get("a")!)).toBe(0);
    expect(distanceToBox({ x: 53, y: 24 }, boxes.get("a")!)).toBe(5);
  });

  it("finds the node an edge starts or ends at, within reach", () => {
    expect(nearestBox({ x: 52, y: 10 }, boxes)).toBe("a");
    expect(nearestBox({ x: 197, y: 10 }, boxes)).toBe("b");
    expect(nearestBox({ x: 125, y: 10 }, boxes)).toBeNull();
  });
});

describe("sankey flows", () => {
  const links = ["Prompt->Planner", "Prompt->Direct", "Planner->Coder", "Planner->Research", "Other->Coder"];

  it("splits link ids", () => {
    expect(sankeyEnds("A->B")).toEqual(["A", "B"]);
    expect(sankeyEnds("nope")).toBeNull();
  });

  it("follows the flows through a node up- and downstream", () => {
    const through = flowThrough("Planner", links);
    expect([...through].sort()).toEqual(
      ["Coder", "Planner", "Planner->Coder", "Planner->Research", "Prompt", "Prompt->Planner", "Research"].sort()
    );
    expect(through.has("Prompt->Direct")).toBe(false);
    expect(through.has("Other->Coder")).toBe(false);
  });
});
