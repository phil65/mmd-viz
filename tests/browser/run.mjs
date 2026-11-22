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
    if (name === "flowchart") {
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
  for (const name of ["flowchart", "sankey", "gitGraph", "state", "sequence"]) {
    expect(results[`${name}-${mode}`].clean, `${mode} ${name} reset leaves classes`);
  }
}
expect(results.folded.includes("backend") && !results.folded.includes("db"), `subgraph fold: ${results.folded}`);
expect(errors.length === 0, `page errors: ${errors.join("; ")}`);
await browser.close();

if (failures.length) {
  console.error(`✗ browser test\n  ${failures.join("\n  ")}`);
  process.exit(1);
}
console.log("✓ browser test: hover, flows, branches, stepping, reset, folding (framed and embedded)");
