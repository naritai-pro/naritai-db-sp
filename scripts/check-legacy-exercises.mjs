import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read = f => JSON.parse(readFileSync(new URL("../src/" + f + ".json", import.meta.url)));
const original = read("legacy-fields");
let figures = 0, parts = 0, blanks = 0, trees = 0;
for (const [id, rows] of Object.entries(original)) {
  const q = read("archive/" + id);
  assert(q.materialBlocks.length && q.sections.every(s => s.heading && s.prompts.length), id);
  const fields = new Map(q.sections.flatMap(s => s.fields.map(f => [f[0], f])));
  for (const f of rows) {
    const key = ["past", f.section, f.sub, f.label].join("-");
    assert(fields.has(key), id + " 保存済み解答との互換性 " + key);
    blanks++;
  }
  assert(q.materialBlocks.every(b => !b.illustration), id + " 資料が画像です");
  for (const d of q.diagrams) {
    assert(!d.background && !d.solutionImage && d.storageKey, id + " 関係図の画像または保存キー");
    assert(d.answer.length && d.solutionPath && d.nodes.length, id + " 公式解答図");
    figures++;
  }
  for (const b of q.materialBlocks.filter(b => b.reference)) {
    assert(b.layout?.labels.length || b.table?.rows.length || b.lines?.length || b.diagramIndex !== undefined, id + " 空の図表 " + b.text);
  }
  const hasTree = fields.has("deadlock-case2");
  if (hasTree) { assert.equal(id,"2019-spring-db-pm1-q3"); trees++; }
  parts += q.explanations.length;
}
assert.deepEqual([Object.keys(original).length, parts, blanks, figures, trees], [25,166,1056,17,1]);
console.log("旧25問の166小問・1056個の旧解答キー・17枚の関係図・部品選択図を確認しました。");
