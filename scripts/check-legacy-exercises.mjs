import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
const root = new URL("../", import.meta.url);
function data(file) {
  return JSON.parse(readFileSync(new URL("src/" + file + ".json", root)));
}
const fields = data("legacy-fields"), models = data("legacy-diagrams"), prompts = data("legacy-prompts");
let blanks = 0, figures = 0, subparts = 0;
for (const q of data("past-paper-catalog")) {
  const id = [q.year, q.year === 2020 ? "october" : "spring", "db", q.part, "q" + q.number].join("-");
  const groups = new Set(q.sections.flatMap((n, i) => (q.subparts[i].length ? q.subparts[i] : [0]).map(s => n + "-" + s)));
  const covered = new Set(), keys = new Set();
  for (const field of fields[id]) {
    const group = field.section + "-" + field.sub;
    assert(groups.has(group), id + " " + group);
    const key = group + "-" + field.label;
    assert(!keys.has(key) && field.label && typeof field.answer === "string", id + " " + key);
    keys.add(key);
    covered.add(group);
    blanks++;
  }
  for (const m of models[id] ?? []) {
    const group = m.section + "-" + m.sub;
    assert(groups.has(group));
    covered.add(group);
    assert.equal(new Set(m.nodes.map(([name]) => name)).size, m.nodes.length);
    for (const [name] of m.nodes) assert(m.nodeSizes[name].every(s => s > 0));
    for (const image of [m.background, m.solutionImage]) assert(existsSync(new URL("public" + image, root)), image);
    figures++;
  }
  if (id === "2019-spring-db-pm1-q3") covered.add("4-3");
  assert.deepEqual(covered, groups, id);
  for (const group of groups) {
    const images = prompts[id][group];
    assert(images.length && images.every(src => existsSync(new URL("public" + src, root))), id + " " + group);
    subparts++;
  }
}
assert.equal(figures, 17);
assert.equal(subparts, 166);
console.log(`追加25問・${subparts}小問の入力欄${blanks}件、関係図${figures}件と部品選択図を確認しました。`);
