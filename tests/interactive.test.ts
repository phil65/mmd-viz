import { describe, expect, it } from "vitest";
import { distanceToBox, flowThrough, nearestBox, nearestCircle, pairLabels, sankeyEnds } from "../src/interactive.js";

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

describe("quadrant chart points", () => {
  const circles = [
    { id: "big", x: 100, y: 100, r: 9 },
    { id: "small", x: 106, y: 100, r: 5 },
    { id: "far", x: 300, y: 300, r: 5 },
  ];

  it("finds the point whose center is nearest, where points overlap", () => {
    expect(nearestCircle({ x: 105, y: 100 }, circles)).toBe("small");
    expect(nearestCircle({ x: 98, y: 101 }, circles)).toBe("big");
  });

  it("finds a point near its rim, within reach", () => {
    expect(nearestCircle({ x: 300, y: 315 }, circles)).toBe("far");
    expect(nearestCircle({ x: 300, y: 330 }, circles)).toBeNull();
    expect(nearestCircle({ x: 300, y: 330 }, circles, 30)).toBe("far");
  });

  it("pairs labels with points by name, the nearest where names repeat", () => {
    // Pele draws points in reverse and labels in source order, labels below or above
    const points = [
      { id: "Dup", x: 400, y: 50 },
      { id: "Dup", x: 80, y: 420 },
      { id: "A long name", x: 200, y: 200 },
    ];
    const labels = [
      { id: "A long\nname", x: 200, y: 221 },
      { id: "Dup", x: 80, y: 441 },
      { id: "Dup", x: 400, y: 71 },
    ];
    expect(pairLabels(points, labels)).toEqual([2, 1, 0]);
  });

  it("pairs a label no name matches with the nearest point left", () => {
    const points = [
      { id: "A", x: 0, y: 0 },
      { id: "B", x: 100, y: 0 },
    ];
    expect(pairLabels(points, [{ id: "B…", x: 100, y: 20 }, { id: "A", x: 0, y: 20 }])).toEqual([1, 0]);
    expect(pairLabels(points, [])).toEqual([]);
  });
});
