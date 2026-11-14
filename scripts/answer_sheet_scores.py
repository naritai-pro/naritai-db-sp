"""Print explicit answer-to-score mappings without changing estimated scores."""
from collections import OrderedDict
import json
from pathlib import Path

POLICY = json.loads((Path(__file__).resolve().parents[1] / "src/diagram-scoring-policy.json").read_text())


def names(labels):
    labels = list(dict.fromkeys(labels))
    if len(labels) >= 3 and all(len(s) == 1 for s in labels):
        for alphabet in ["abcdefghijklmnopqrstuvwxyz", "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "アイウエオカキクケコサシスセソタチツテトナニヌネノ", "あいうえおかきくけこさしすせそたちつてとなにぬねの", "①②③④⑤⑥⑦⑧⑨⑩"]:
            if "".join(labels) in alphabet:
                return labels[0] + "〜" + labels[-1]
    return "・".join(labels)


def targets(labels, all_labels):
    # Table answers retain both their row and column names. Combine rows only
    # when their included columns are exactly the same; never imply extra cells.
    by_row = OrderedDict()
    plain = []
    for label in labels:
        if "：" in label:
            row, col = label.split("：", 1)
            by_row.setdefault(row, []).append(col)
        else:
            plain.append(label)
    by_columns = OrderedDict()
    for row, cols in by_row.items():
        universe = list(dict.fromkeys(label.split("：", 1)[1] for label in all_labels if label.startswith(row + "：")))
        if cols == universe:
            description = "全空欄"
        elif len(cols) >= 3 and all(col in universe for col in cols) and universe[universe.index(cols[0]):universe.index(cols[-1])+1] == cols:
            description = cols[0] + "〜" + cols[-1]
        else:
            description = names(cols)
        by_columns.setdefault(description, []).append(row)
    chunks = [names(plain)] if plain else []
    all_rows = list(dict.fromkeys(label.split("：", 1)[0] for label in all_labels if "：" in label))
    def row_names(rows):
        if len(rows) >= 3 and all_rows[all_rows.index(rows[0]):all_rows.index(rows[-1])+1] == rows:
            return rows[0] + "〜" + rows[-1]
        return names(rows)
    chunks += [row_names(rows) + "［" + cols + "］" for cols, rows in by_columns.items()]
    return "・".join(chunks)


def score_text(question, items):
    points = [item["points"] for item in items]
    fields = {f[0]: f[1] for section in question["sections"] for f in section["fields"]}
    def label(key):
        if key.startswith("diagram:"):
            title = question["diagrams"][int(key.split(":")[1])]["title"]
            return title.split("　")[0]
        if key == "deadlock-case2":
            return "図4"
        return fields[key].replace("のエンティティ名", "")
    def item_text(item):
        result = targets([label(key) for key in item["ids"]], list(fields.values())) + f":{item['points']:g}点"
        if len(item["ids"]) == 1 and item["ids"][0].startswith("diagram:"):
            diagram = question["diagrams"][int(item["ids"][0].split(":")[1])]
            count = len(diagram["answer"])
            if count:
                if len(items) == 1:
                    return POLICY["compact"]
                result += "（" + POLICY["compact"] + "）"
        return result
    chunks = [item_text(item) for item in items]
    return f"予想配点 {sum(points):g}点　" + "／".join(chunks)
