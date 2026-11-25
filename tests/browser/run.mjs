// Browser test for mmd-viz/interactive (and folding): geometry needs a real engine.
// Run: npm run test:browser (needs `npx playwright install chromium` once)
import { build } from "esbuild";
import { chromium } from "playwright";

const bundle = await build({
  entryPoints: [new URL("./page.ts", import.meta.url).pathname],
  bundle: true,
  format: "iife",
  write: false,
});
const script = bundle.outputFiles[0].text;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
await page.setContent(`<html><body style="margin:0"><script>${script.replaceAll("</script", "<\\/script")}</script></body></html>`);

const results = await page.evaluate(() => {
  const count = (id, selector) => document.querySelectorAll(`#${id} ${selector}`).length;
  const out = {};
  for (const [id, controls] of Object.entries(window.api)) {
    const name = id.split("-")[0];
    const row = { steps: controls.steps };
    if (name === "flowchart" || name === "hidden") {
      controls.focusOn("hub");
      row.hubOn = count(id, ".mmdi-on");
      row.dOn = document.querySelector(`#${id} g.pele-node[data-id="d"]`).classList.contains("mmdi-on");
    } else if (name === "sankey") {
      controls.focusOn("B");
      row.xToD = document.querySelector(`#${id} [data-id="X->D"]`).classList.contains("mmdi-on");
      row.bToC = document.querySelector(`#${id} [data-id="B->C"]`).classList.contains("mmdi-on");
    } else if (name === "gitGraph") {
      controls.focusOn("feat");
      row.on = count(id, ".mmdi-on");
    } else if (name === "quadrantChart") {
      const on = () => [...document.querySelectorAll(`#${id} .mmdi-on`)];
      controls.focusOn("Beta");
      row.beta = on().map((el) => `${el.tagName}:${el.dataset.id ?? el.textContent}`).sort();
      row.focus = controls.focus;
      controls.focusOn("Dup");
      row.dup = on().length;
      row.kept = [...document.querySelectorAll(`#${id} .mmdi-keep`)].map((el) => el.textContent);
    } else if (name === "xychart") {
      controls.focusOn("Real");
      row.on = [...document.querySelectorAll(`#${id} .mmdi-on`)].map((el) => el.getAttribute("class")).sort();
    } else if (name === "state" || name === "sequence") {
      controls.next();
      controls.next();
      row.step = controls.step;
      row.now = count(id, ".mmdi-now");
      row.past = count(id, ".mmdi-past");
      if (name === "state") row.busyNow = document.querySelector(`#${id} g.pele-node[data-id="Busy"]`).classList.contains("mmdi-now");
    }
    controls.reset();
    row.clean = count(id, ".mmdi-on, .mmdi-now, .mmdi-past") === 0;
    out[id] = row;
  }
  out.folded = window.foldFlow();
  return out;
});

// Hovering near a quadrant chart point (not on it) finds it; its label shows, the others stay hidden
const hovered = {};
for (const mode of ["framed", "embed"]) {
  const circle = page.locator(`#quadrantChart-${mode} circle.pele-point[data-id="Gamma"]`);
  await circle.scrollIntoViewIfNeeded();
  const box = await circle.boundingBox();
  await page.mouse.move(box.x + box.width / 2 + 2, box.y + box.height + 3);
  await page.waitForTimeout(300);
  hovered[mode] = await page.evaluate((id) => {
    const opacity = (text) =>
      getComputedStyle([...document.querySelectorAll(`#${id} .pele-point-labels > .pele-label`)].find((el) => el.textContent === text)).opacity;
    return { focus: window.api[id].focus, gamma: opacity("Gamma"), beta: opacity("Beta"), alpha: opacity("Alpha") };
  }, `quadrantChart-${mode}`);
  await page.mouse.move(1590, 1190);
  await page.mouse.move(1595, 1195);
  await page.waitForTimeout(50);
  hovered[mode].after = await page.evaluate((id) => window.api[id].focus, `quadrantChart-${mode}`);
}

const failures = [];
const expect = (ok, what) => ok || failures.push(what);
for (const mode of ["framed", "embed"]) {
  const f = results[`flowchart-${mode}`];
  // hub, its 3 edges, its 3 neighbors; d stays out
  expect(f.hubOn === 7 && !f.dOn, `${mode} flowchart hover: ${JSON.stringify(f)}`);
  const s = results[`sankey-${mode}`];
  expect(s.bToC && !s.xToD, `${mode} sankey flow through B: ${JSON.stringify(s)}`);
  expect(results[`gitGraph-${mode}`].on >= 2, `${mode} gitGraph branch: ${JSON.stringify(results[`gitGraph-${mode}`])}`);
  const st = results[`state-${mode}`];
  expect(st.steps === 3 && st.step === 1 && st.busyNow, `${mode} state stepping: ${JSON.stringify(st)}`);
  const sq = results[`sequence-${mode}`];
  expect(sq.steps === 3 && sq.now >= 1 && sq.past >= 1, `${mode} sequence stepping: ${JSON.stringify(sq)}`);
  const q = results[`quadrantChart-${mode}`];
  // the point and its label, by name though pele draws them in different orders
  expect(
    JSON.stringify(q.beta) === JSON.stringify(["circle:Beta", "text:Beta"]) && q.focus === "Beta",
    `${mode} quadrant focus: ${JSON.stringify(q)}`
  );
  expect(q.dup === 4 && JSON.stringify(q.kept) === '["Alpha"]', `${mode} quadrant names twice, kept labels: ${JSON.stringify(q)}`);
  const x = results[`xychart-${mode}`];
  expect(x.on.length === 2 && x.on.some((c) => c.includes("pele-line")) && x.on.some((c) => c.includes("pele-legend-item")), `${mode} xychart series: ${JSON.stringify(x)}`);
  for (const name of ["flowchart", "sankey", "gitGraph", "state", "sequence", "quadrantChart", "xychart"]) {
    expect(results[`${name}-${mode}`].clean, `${mode} ${name} reset leaves classes`);
  }
}
for (const [mode, h] of Object.entries(hovered)) {
  // Alpha keeps its label (faded with the rest), Beta's stays hidden
  expect(
    h.focus === "Gamma" && h.gamma === "1" && h.beta === "0" && Number(h.alpha) > 0 && Number(h.alpha) < 1 && h.after === null,
    `${mode} quadrant hover: ${JSON.stringify(h)}`
  );
}
const hidden = results["hidden-flow"];
expect(hidden.hubOn === 7 && !hidden.dOn, `set up while hidden, hovered once shown: ${JSON.stringify(hidden)}`);
expect(results.folded.includes("backend") && !results.folded.includes("db"), `subgraph fold: ${results.folded}`);
expect(errors.length === 0, `page errors: ${errors.join("; ")}`);
await browser.close();

if (failures.length) {
  console.error(`✗ browser test\n  ${failures.join("\n  ")}`);
  process.exit(1);
}
console.log("✓ browser test: hover, flows, branches, quadrant points, xychart series, stepping, reset, folding (framed and embedded)");
