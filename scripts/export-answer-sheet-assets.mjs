// Run against `npm run dev`. Uses the same blank diagrams and table definitions
// as the exercise UI; no saved answers or solution relationships are rendered.
// PLAYWRIGHT_MODULE can point to a bundled Playwright installation.
import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE
  ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : "playwright");
const base = process.env.ANSWER_SHEET_BASE_URL ?? "http://127.0.0.1:4173";
const output = "tmp/pdfs/answer-sheet-assets";
await mkdir(output, {recursive: true});
const browser = await chromium.launch({channel: "chrome", headless: true});
try {
  const page = await browser.newPage();
  await page.goto(base);
  const data = await page.evaluate(async () => {
    const [{questionTitles}, {diagram}, {circleTable}, {partTree}, {empty}, {default: plans}] = await Promise.all([
      import("/src/seo.ts"), import("/src/diagram.ts"), import("/src/circle-table.ts"),
      import("/src/part-tree.ts"), import("/src/store.ts"), import("/src/score-plan.json"),
    ]);
    const special = {"2025-autumn-db-pm1-q1": "/src/university.ts", "2025-autumn-db-pm1-q2": "/src/question.json", "2025-autumn-db-pm1-q3": "/src/inventory.ts"};
    const result = [];
    for (const id of Object.keys(questionTitles).sort()) {
      const {default: q} = await import(special[id] ?? `/src/archive/${id}.json`);
      const diagrams = q.diagrams.map(d => diagram(d, [], undefined, "sheet").querySelector("svg").outerHTML);
      const tables = q.sections.map(section => {
        const grid = circleTable(q, section.fields, {}, () => {});
        if (!grid) return null;
        const table = grid.element.querySelector("table");
        return {keys: [...grid.keys.keys()], first: grid.first,
          rows: [...table.rows].map(row => [...row.cells].map(cell => ({
            text: cell.textContent, colspan: cell.colSpan, rowspan: cell.rowSpan,
          })))};
      });
      const tree = q.sections.some(s => s.fields.some(f => f[0] === "deadlock-case2"))
        ? partTree(empty(), () => {}, false).querySelector("svg").outerHTML : undefined;
      result.push({...q, plan: plans[id], diagramSvgs: diagrams, tables, treeSvg: tree});
    }
    return result;
  });
  const render = await browser.newPage();
  for (const q of data) {
    const figures = [...q.diagramSvgs.map((svg, i) => [String(i), svg]), ...(q.treeSvg ? [["tree", q.treeSvg]] : [])];
    q.figureFiles = {};
    for (const [key, svg] of figures) {
      const viewBox = svg.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
      const [,,width,height] = viewBox;
      // The SVG is already a blank answer diagram. Retain original fixed edges.
      const monochrome = svg.replace(/#66777b|#687f83|currentColor/g, "#000000");
      await render.setContent(`<html><head><style>@page{margin:0}*{box-sizing:border-box}html,body{margin:0;width:${width}px;height:${height}px;color:#000;font-family:'Hiragino Kaku Gothic ProN','Arial Unicode MS',sans-serif}svg{display:block;width:100%;height:100%}</style></head><body>${monochrome}</body></html>`);
      await render.evaluate(() => document.fonts.ready);
      const file = `${output}/${q.id}-${key}.pdf`;
      await render.pdf({path:file,width:`${width}px`,height:`${height}px`,printBackground:true,margin:{top:0,bottom:0,left:0,right:0}});
      q.figureFiles[key] = {file, width:width*.75, height:height*.75};
    }
    delete q.diagramSvgs; delete q.treeSvg;
  }
  await writeFile(`${output}/questions.json`, JSON.stringify(data, null, 2));
  console.log(`Exported ${data.length} questions and ${data.reduce((n,q)=>n+Object.keys(q.figureFiles).length,0)} blank diagrams.`);
} finally { await browser.close(); }
