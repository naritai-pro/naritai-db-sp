import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const rows = JSON.parse(readFileSync(new URL("../src/past-paper-catalog.json", import.meta.url)));
assert.equal(rows.length, 25);
for (let year = 2016; year <= 2020; year++) {
  for (const part of ["pm1", "pm2"]) {
    let previous = 5;
    for (let number = 1; number <= (part === "pm1" ? 3 : 2); number++) {
      const row = rows.find(r => r.year === year && r.part === part && r.number === number);
      assert.ok(row, [year, part, number].join("/"));
      assert.ok(row.firstPage > previous && row.lastPage >= row.firstPage);
      previous = row.lastPage;
      assert.ok(row.title && row.studyNote);
      assert.equal(row.sections.length, row.subparts.length);
      const unnumbered = [2016, 2018].includes(year) && part === "pm2" && number === 2;
      row.sections.forEach((s, i) => {
        assert.equal(s, unnumbered ? 0 : i + 1);
        row.subparts[i].forEach((v, n) => assert.equal(v, n + 1));
      });
      for (const [type, source, suffix] of [["question", "paper", "qs"], ["answer", "answer", "ans"], ["comment", "comment", "cmnt"]]) {
        const u = new URL(row[source]);
        assert.equal(u.origin, "https://www.ipa.go.jp");
        assert.ok(u.pathname.endsWith("_db_" + part + "_" + suffix + ".pdf"));
        assert.match(u.hash, /^#page=[1-9]\d*$/);
        if (source === "paper") assert.equal(u.hash, "#page=" + row.firstPage);
        const bytes = readFileSync(new URL(`../public/past-papers/${year}/${part}-q${number}-${type}.pdf`, import.meta.url));
        assert.equal(bytes.toString("ascii", 0, 5), "%PDF-");
      }
    }
  }
}
console.log("2016〜2020年度の午後25問の掲載範囲・小問・出典と75件のPDFを確認しました。");
