"""Verify generated print assets without starting a browser or changing files."""
from answer_sheet_scores import score_text

import json
import logging
import re
from pathlib import Path
from pypdf import PdfReader
import pdfplumber

logging.getLogger("pdfminer").setLevel(logging.ERROR)

root = Path(__file__).resolve().parents[1]
folder = root / "public/answer-sheets"
manifest = json.loads((folder / "manifest.json").read_text())
assert len(manifest) == 20
assert {(m["year"],m["part"]) for m in manifest} == {(y,p) for y in range(2016,2026) for p in ["pm1","pm2"]}
plans = json.loads((root / "src/score-plan.json").read_text())
questions = {q["id"]: q for q in json.loads((root / "tmp/pdfs/answer-sheet-assets/questions.json").read_text())}
example = questions["2018-spring-db-pm1-q1"]
assert score_text(example, example["plan"][0][0]["items"]) == "予想配点 14点　a〜d:5点／e〜h:5点／i〜k:4点"
assert score_text(example, example["plan"][2][0]["items"]) == "予想配点 3点　関係スキーマ:1点／関係名:1点／属性名:1点"
example = questions["2025-autumn-db-pm1-q3"]
assert score_text(example, example["plan"][0][0]["items"]) == "予想配点 13点　a:2点／b:2点／c:1点／d:1点／e:2点／f:2点／g:1点／h・i:2点"
diagram_example = {"sections": [], "diagrams": [{"title": "図1　例", "answer": [["a", "b", "1対多"]] * 4}]}
assert score_text(diagram_example, [{"ids": ["diagram:0"], "points": 8}]) == "予想配点 8点　関係の種類・向きの誤り−1点／本、接続先の誤り・線の不足・余分な線−2点／本"
diagram_example["diagrams"][0]["answer"] = [["a", "b", "1対多"]] * 3
assert "1/" not in score_text(diagram_example, [{"ids": ["diagram:0"], "points": 8}])
total = 0
for item in manifest:
    path = folder / item["file"]
    pdf = PdfReader(path)
    assert len(pdf.pages) == item["pages"], path
    assert item["pages"] % 2 == 0, (path, "Duplex / 2-up year boundary")
    assert item["contentPages"] + item["memoPages"] == item["pages"], path
    assert 0 <= item["memoPages"] <= 3, path
    assert len(item["questions"]) == (3 if item["part"] == "pm1" else 2)
    if item["part"] == "pm1":
        assert item["pages"] == 6 and item["memoPages"] == 0, (path, "Afternoon I must be six pages")
        assert all(q["contentPages"] == 2 for q in item["questions"]), (path, "Two pages per question")
    if item["part"] == "pm2":
        assert item["pages"] == 4 and item["memoPages"] == 0, (path, "Afternoon II must be four pages")
        assert all(q["contentPages"] == 2 for q in item["questions"]), (path, "Two pages per question")
    next_start = 1
    memo_pages = set()
    for q in item["questions"]:
        assert q["startPage"] == next_start and next_start % 2 == 1, (path, q)
        if q["contentPages"] % 2:
            assert q["memoPage"] == q["startPage"] + q["contentPages"], (path, q)
            memo_pages.add(q["memoPage"])
        else:
            assert q["memoPage"] is None, (path, q)
        assert q["endPage"] == q["startPage"] + q["contentPages"] - 1 + (q["memoPage"] is not None)
        question_id = next(key for key in plans if key.startswith(str(item["year"]))
                           and f"-{item['part']}-q{q['question']}" in key)
        sections = plans[question_id]
        assert sum(i["points"] for groups in sections for group in groups for i in group["items"]) == (50 if item["part"] == "pm1" else 100), question_id
        next_start = q["endPage"] + 1
    for heading in item["scoreHeadings"]:
        printed = re.sub(r"\s+", "", pdf.pages[heading["page"]-1].extract_text())
        assert re.sub(r"\s+", "", heading["text"]) in printed, (path, heading)
    if item["year"] == 2025 and item["part"] == "pm1":
        split = [h for h in item["scoreHeadings"] if h["question"] == "2025-autumn-db-pm1-q1" and h["context"] == "設問1（3）"]
        assert [(h["page"], h["text"]) for h in split] == [
            (1, "予想配点 6点　ア:2点／イ:2点／ウ:1点／エ:1点"),
            (2, "予想配点 17点　オ:1点／カ:2点／キ:3点／ク:2点／ケ:1点／コ:2点／サ:2点／シ:2点／ス:2点"),
        ], split
    assert next_start == item["pages"] + 1, (path, "Unnecessary year-end padding")
    assert len(memo_pages) == item["memoPages"]
    assert path.stat().st_size == item["size"], path
    for number, page in enumerate(pdf.pages, 1):
        assert abs(float(page.mediabox.width)-595.276) < .1, (path, number)
        assert abs(float(page.mediabox.height)-841.89) < .1, (path, number)
        text = page.extract_text()
        assert "https://ipa-db-sp.naritai.app/" in text, (path, number)
        assert "https://x.com/taiki_smec" in text, (path, number)
        assert "誤記のご報告・お問い合わせはXへ" in text, (path, number)
        links = [a.get_object().get("/A", {}).get("/URI") for a in page.get("/Annots", [])]
        assert "https://ipa-db-sp.naritai.app/" in links, (path, number)
        assert links.count("https://x.com/taiki_smec") == 2, (path, number)
        assert not any(old in text for old in ["接続のみ", "表記誤り", "17/32", "17/16", "最低0点", "図1全体", "内訳は前ページ"]), (path, number, "Obsolete diagram scoring")
        assert "字以内" not in text, (path, number, "Redundant grid caption")
        assert str(item["year"]) + "年度" in text, (path, number)
        assert ("午後Ⅰ" if item["part"] == "pm1" else "午後Ⅱ") in text, (path, number)
        assert "公式の答案用紙ではありません" in text, (path, number)
        assert all(label not in text for label in ["受験番号", "選択欄", "実施日："]), (path, number)
        if number not in memo_pages:
            assert "設問" in text, (path, number, "Blank answer page")
        else:
            assert "メモ" in text and "設問" not in text, (path, number)
        for font in page["/Resources"].get("/Font", {}).values():
            font = font.get_object()
            if font.get("/Subtype") == "/TrueType":
                assert "/FontFile2" in font["/FontDescriptor"], (path, number, "Unembedded font")
    text = "\n".join(p.extract_text() for p in pdf.pages)
    for q in range(1,4 if item["part"] == "pm1" else 3):
        assert f"問{q}" in text, (path, q)
    with pdfplumber.open(path) as geometry:
        cells = 0
        for number, page in enumerate(geometry.pages, 1):
            if number in memo_pages:
                assert not [edge for edge in page.edges if 105 < edge["top"] < page.height-48], (path, number, "Ruled memo page")
            cells += sum(abs(r["width"]-(7 if item["part"] == "pm2" else 8)*72/25.4)<.01 and abs(r["height"]-(7 if item["part"] == "pm2" else 8)*72/25.4)<.01 for r in page.rects)
            assert all(c["x0"] >= 25 and c["x1"] <= page.width-24 and c["top"] >= 15 and c["bottom"] <= page.height-10
                       for c in page.chars if c["text"].strip()), (path, "Text outside print margins")
        assert cells == item["gridCells"], (path, "Handwriting squares", cells, item["gridCells"])
    total += len(pdf.pages)
for part in ["pm1", "pm2"]:
    combined = PdfReader(folder / f"2016-2025-{part}.pdf")
    entries = [m for m in manifest if m["part"] == part]
    assert len(combined.pages) == sum(m["pages"] for m in entries)
    assert len(combined.outline) == 10
    offset = 0
    for entry, bookmark in zip(entries, combined.outline):
        assert offset % 2 == 0
        assert combined.get_destination_page_number(bookmark) == offset
        for p in combined.pages[offset:offset+entry["pages"]]:
            assert f"{entry['year']}年度" in p.extract_text()
        offset += entry["pages"]
print(f"Verified 20 PDFs / {total} A4 pages, 8 / 7 mm grids, two-page question boundaries, unruled memo pages only after odd-length questions, both bundles, and every footer.")
