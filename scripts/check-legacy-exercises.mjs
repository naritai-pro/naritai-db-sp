import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read = f => JSON.parse(readFileSync(new URL("../src/" + f + ".json", import.meta.url)));
const original = read("legacy-fields");
let materials = 0, figures = 0, parts = 0, blanks = 0, trees = 0;
for (const [id, rows] of Object.entries(original)) {
  const q = read("archive/" + id);
  assert(q.materialBlocks.length && q.sections.every(s => s.heading && s.prompts.length), id);
  assert(q.source.endsWith("問" + id.split("-q").at(-1)), id + " 出典の問番号");
  const fields = new Map(q.sections.flatMap(s => s.fields.map(f => [f[0], f])));
  for (const f of rows) {
    const key = ["past", f.section, f.sub, f.label].join("-");
    assert(fields.has(key), id + " 保存済み解答との互換性 " + key);
    blanks++;
  }

  for (const d of q.diagrams) {
    assert(!d.background && !d.solutionImage && d.storageKey, id + " 関係図の画像または保存キー");
    assert(d.answer.length && d.solutionPath && d.nodes.length, id + " 公式解答図");
    figures++;
  }
  for (const b of q.materialBlocks.filter(b => b.reference)) {
    materials++;
    assert(!b.sourceImages && !b.layout && !b.illustration && !b.illustrationParts, id + " 原本画像・旧座標レイアウト " + b.text);
    assert(Number.isInteger(b.sourcePage) && b.sourcePage > 0, id + " 原本ページ " + b.text);
    assert.equal([!!b.nativeSvg, !!b.table?.rows.length, !!b.lines?.length, b.diagramIndex !== undefined].filter(Boolean).length, 1, id + " 図表形式 " + b.text);
    if (b.nativeSvg) {
      assert(/^<svg\b/.test(b.nativeSvg) && /<text\b/.test(b.nativeSvg), id + " SVGの見出し " + b.text);
      for (const [, tag] of b.nativeSvg.matchAll(/<([\w:-]+)/g))
        assert(["svg","g","desc","title","path","rect","ellipse","circle","line","polyline","polygon","text","tspan","defs","pattern"].includes(tag), id + ": " + tag);
      assert(!/\s(?:on\w+|(?:xlink:)?href|style)\s*=|data:image/i.test(b.nativeSvg), id + " SVG内の外部参照");
    }
  }
  const hasTree = fields.has("deadlock-case2");
  if (hasTree) { assert.equal(id,"2019-spring-db-pm1-q3"); trees++; }
  parts += q.explanations.length;
}
assert.equal(materials, 210);
assert.deepEqual([Object.keys(original).length, parts, blanks, figures, trees], [25,166,1056,17,1]);
console.log("旧25問のネイティブ図表210点・166小問・1056個の旧解答キー・17枚の関係図・部品選択図を確認しました。");
