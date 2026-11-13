import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import university from "../src/university.ts";
import inventory from "../src/inventory.ts";

const read = path => JSON.parse(readFileSync(new URL("../src/" + path, import.meta.url), "utf8"));
const archive = Object.keys(read("archive-titles.json")).map(id => read("archive/" + id + ".json"));
const questions = [...archive, university, inventory, read("question.json")];
const plans = read("score-plan.json");

assert.deepEqual(Object.keys(plans).sort(), questions.map(q => q.id).sort(), "配点表と収録大問が一致しません");
let subquestions = 0;
let answerCount = 0;
for (const q of questions) {
  const plan = plans[q.id];
  assert.equal(plan.length, q.sections.length, q.id + ": 設問数");
  let total = 0;
  for (const [index, section] of q.sections.entries()) {
    const location = q.id + " 設問" + (index + 1);
    const firstDiagram = q.diagrams.findIndex(d => d.section === index + 1);
    const promptLabels = new Map();
    let label = "";
    for (const prompt of section.prompts) {
      for (const line of prompt.lines) {
        const number = line.normalize("NFKC").match(/^\s*\((\d+)\)/)?.[1];
        if (number) label = "（" + number + "）";
      }
      const id = prompt.before === "diagram" ? "diagram:" + firstDiagram : prompt.before;
      promptLabels.set(id, label);
    }
    const expected = new Map();
    const fieldOrder = section.fields.map(([id]) => id);
    const tableStarts = new Set([
      ...section.prompts.filter(p => p.lines.length).map(p => p.before),
      ...(q.explanations ?? []).filter(e => !e.section || e.section === index + 1).map(e => e.before),
    ]);
    for (const [position, prompt] of section.prompts.entries()) {
      if (!prompt.before.startsWith("diagram")) continue;
      const nextField = section.prompts.slice(position + 1).find(p => !p.before.startsWith("diagram"));
      if (nextField) tableStarts.add(nextField.before);
    }
    label = "";
    for (const [id] of section.fields) {
      label = promptLabels.get(id) ?? label;
      expected.set(id, label);
    }
    for (const [n, d] of q.diagrams.entries()) {
      if (d.section !== index + 1) continue;
      const id = "diagram:" + n;
      assert(promptLabels.has(id), location + ": 図の位置 " + id);
      expected.set(id, promptLabels.get(id));
    }
    const expectedLabels = [...new Set(promptLabels.values())];
    if (!expectedLabels.length) expectedLabels.push("");
    assert.deepEqual(plan[index].map(s => s.label), expectedLabels, location + ": 小問番号");
    for (const { label, items } of plan[index]) {
      subquestions++;
      assert(items.length, location + label + ": 配点がありません");
      for (const { ids, points } of items) {
        assert(Number.isSafeInteger(points) && points > 0 && ids.length, location + label + ": 配点単位");
        if (ids.length > 1) {
          const start = fieldOrder.indexOf(ids[0]);
          assert.deepEqual(fieldOrder.slice(start, start + ids.length), ids, location + label + ": 一体で評価する欄が連続していません");
          assert(!ids.slice(1).some(id => tableStarts.has(id)), location + label + ": 配点の結合セルが表をまたぎます");
        }
        total += points;
        for (const id of ids) {
          assert.equal(expected.get(id), label, location + label + ": " + id);
          expected.delete(id);
          answerCount++;
        }
      }
    }
    assert.equal(expected.size, 0, location + ": 配点がない解答欄 " + [...expected.keys()]);
  }
  assert.equal(total, q.id.includes("-pm1-") ? 50 : 100, q.id + ": 大問の合計");
}
console.log(questions.length + "問・" + subquestions + "小問・" + answerCount + "解答欄（作図を含む）の予想配点を確認しました。");
