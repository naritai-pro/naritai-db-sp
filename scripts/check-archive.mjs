import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const file = path => new URL("../" + path, import.meta.url);
const read = path => JSON.parse(readFileSync(file(path), "utf8"));
const catalog = read("src/archive-titles.json");
for (const [id, title] of Object.entries(catalog)) {
  const q = read("src/archive/" + id + ".json");
  const check = (condition, message) => assert(condition, id + ": " + message);
  check(q.id === id && q.title === title, "一覧のID・題名が一致しません");
  const ids = q.sections.flatMap(s => s.fields.map(([key]) => key));
  check(new Set(ids).size === ids.length, "解答欄のIDが重複しています");
  const referenced = new Set();
  for (const b of q.materialBlocks) {
    if (b.reference) {
      check(!referenced.has(b.reference), "参照番号の重複: " + b.reference);
      referenced.add(b.reference);
      check(q.figures[b.reference - 1]?.caption.replace(/\s/g, "") === b.text.replace(/\s/g, ""), "図表リンクの不一致: " + b.text);
    }
    if (b.illustration) check(existsSync(file("public" + b.illustration)), "画像がありません: " + b.illustration);
    if (b.diagramIndex !== undefined) check(q.diagrams[b.diagramIndex], "概念図がありません: " + b.text);
    if (b.table) check(b.table.rows.every(row => row.length === b.table.headers.length), "表の列数が一致しません: " + b.text);
  }
  for (const d of q.diagrams) {
    const nodes = new Set(d.nodes.map(([name]) => name));
    for (const [a, b] of [...d.fixed, ...d.answer]) check(nodes.has(a) && nodes.has(b), "線の端点がありません: " + [a, b].join(" → "));
  }
  const passages = q.materialBlocks.filter(b => !b.table && !b.lines && !b.illustration && b.diagramIndex === undefined).map(b => b.text);
  const citations = new Set();
  for (const item of q.explanations ?? []) {
    const sections = item.section ? [q.sections[item.section - 1]] : q.sections;
    check(sections.some(s => s && (s.fields.some(([id]) => id === item.before) || s.prompts.some(p => p.before === item.before))), "解説の表示位置がありません: " + item.title);
    check(item.quotes.length > 0, "解説の根拠がありません: " + item.title);
    for (const quote of item.quotes) {
      check(quote && passages.filter(p => p.includes(quote)).length === 1, "根拠のリンク先を特定できません: " + quote);
      citations.add(quote);
    }
  }
  for (const passage of passages) {
    const ranges = Array.from(citations, quote => ({ start: passage.indexOf(quote), quote }))
      .filter(r => r.start >= 0).sort((a, b) => a.start - b.start);
    for (let i = 1; i < ranges.length; i++) {
      check(ranges[i].start >= ranges[i - 1].start + ranges[i - 1].quote.length, "本文の蛍光ペンが重複しています: " + ranges[i].quote);
    }
  }
}
console.log(Object.keys(catalog).length + "問の解答欄・図表参照・表の列数・線の端点を確認しました。");
