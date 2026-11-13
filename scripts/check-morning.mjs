import { readFileSync, existsSync } from "node:fs";

const root = new URL("../", import.meta.url);
const read = path => JSON.parse(readFileSync(new URL(path, root), "utf8"));
const official = read("scripts/fixtures/morning-official-answers.json");
const errors = [];
let checked = 0;
const nonempty = value => typeof value === "string" && value.trim().length > 0;

function checkContent(value, where) {
  if (!nonempty(value)) {
    errors.push(where + " が空です");
    return;
  }
  if (/\uFFFD|\b(?:TODO|FIXME)\b|<script\b|\bon(?:load|error|click)\s*=|javascript:/i.test(value)) {
    errors.push(where + " に未処理の文字または実行可能なHTMLがあります");
  }
  for (const match of value.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["']/gi)) {
    checkAsset(match[1], where);
  }
}

function checkAsset(path, where) {
  if (!path.startsWith("/morning/figures/") || path.includes("..") || !existsSync(new URL("public" + path, root))) {
    errors.push(where + " の画像を確認できません: " + path);
  }
}

for (let year = 2016; year <= 2025; year++) {
  for (const [section, count] of [["am1", 30], ["am2", 25]]) {
    const id = year + "-" + section;
    const expected = official[id];
    const path = "public/morning/data/" + id + ".json";
    if (!existsSync(new URL(path, root))) {
      errors.push(path + " がありません");
      continue;
    }
    const set = read(path);
    if (set.year !== year || !nonempty(set.title) || !nonempty(set.session)) errors.push(id + " の年度・表題・実施期に欠損があります");
    for (const key of ["source", "answerSource"]) {
      if (set[key] !== expected[key]) errors.push(id + " の " + key + " が公式の実施回と異なります");
    }
    if (set.questions?.length !== count) errors.push(id + " の問題数が " + count + " 問ではありません");
    for (const [index, q] of (set.questions ?? []).entries()) {
      const where = id + " 問" + (index + 1);
      if (q.number !== index + 1) errors.push(where + " の問番号が一致しません");
      if (q.answer !== expected.answers[index]) errors.push(where + " の正答が公式解答と一致しません");
      checkContent(q.stem, where + " 問題文");
      checkContent(q.explanation, where + " 解説");
      if (!Array.isArray(q.choices) || q.choices.length !== 4) errors.push(where + " の選択肢が4件ではありません");
      else for (const [n, choice] of q.choices.entries()) checkContent(choice, where + " 選択肢" + "アイウエ"[n]);
      if (q.figure) {
        if (q.figure.startsWith("/")) checkAsset(q.figure, where);
        else checkContent(q.figure, where + " 図");
      }
      checked++;
    }
  }
}
if (errors.length) {
  throw Error(errors.join("\n"));
}
console.log("午前20セット・" + checked + "問の公式正答、出典、問番号、本文・選択肢・解説、画像参照を確認しました。");
