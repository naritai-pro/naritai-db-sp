"""Create A4 handwriting sheets from the checked exercise definitions.

First run export-answer-sheet-assets.mjs against the local Vite server.
Requires reportlab and pypdf. ANSWER_SHEET_FONT may name a Japanese TTF.
The publisher samples are layout references only, not embedded page images.
"""
from answer_sheet_scores import score_text

import io
import json
import math
import os
import re
from collections import Counter
from pathlib import Path

from pypdf import PdfReader, PdfWriter, Transformation
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.graphics import renderPDF

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "tmp/pdfs/answer-sheet-assets"
OUT = ROOT / "public/answer-sheets"
URL = "https://ipa-db-sp.naritai.app/"
X_URL = "https://x.com/taiki_smec"
QR_SIZE = 32
qr = QrCodeWidget(X_URL, barLevel="M")
x0, y0, x1, y1 = qr.getBounds()
QR_DRAWING = Drawing(QR_SIZE, QR_SIZE, transform=[QR_SIZE / (x1-x0), 0, 0, QR_SIZE / (y1-y0), 0, 0])
QR_DRAWING.add(qr)
FONT = os.environ.get("ANSWER_SHEET_FONT", "/Library/Fonts/Arial Unicode.ttf")
pdfmetrics.registerFont(TTFont("Japanese", FONT))
W, H = A4
LEFT, RIGHT, BOTTOM = 34, W - 34, 48
WIDTH = RIGHT - LEFT
questions = json.loads((ASSETS / "questions.json").read_text())
OUT.mkdir(parents=True, exist_ok=True)


def wrap(text, width, size=9):
    lines = []
    for paragraph in str(text).split("\n"):
        line = ""
        for char in paragraph:
            if line and pdfmetrics.stringWidth(line + char, "Japanese", size) > width:
                lines.append(line)
                line = ""
            line += char
        lines.append(line)
    return lines


class Coverage(list):
    def __init__(self, sheet):
        super().__init__()
        self.sheet = sheet

    def append(self, entry):
        super().append(entry)
        self.sheet.field_pages.setdefault(entry, set()).add(self.sheet.page)

    def extend(self, entries):
        for entry in entries:
            self.append(entry)


class Sheet:
    def __init__(self, year, part, density=1, heading_heights=None):
        self.year, self.part = year, part
        self.density = density
        self.name = "午後Ⅰ" if part == "pm1" else "午後Ⅱ"
        self.term = "春期" if year <= 2019 else "10月" if year == 2020 else "秋期"
        self.buf = io.BytesIO()
        self.c = canvas.Canvas(self.buf, pagesize=A4, pageCompression=1)
        self.c.setTitle(f"{year}年度 {self.term} データベーススペシャリスト {self.name} 解答用紙")
        self.c.setAuthor("データベーススペシャリスト試験演習室")
        self.page = 0
        self.placements = []
        self.field_pages = {}
        self.coverage = Coverage(self)
        self.heading_records = []
        self.heading_heights = dict(heading_heights or {})
        self.heading_counts = Counter()
        self.limits = []
        self.question_pages = []
        self.q = None
        self.context = ""
        self.context_items = []
        self.shown_score_headings = set()
        self.page_context = None

    def text(self, text, x, y, size=9):
        self.c.setFillColorRGB(0, 0, 0)
        self.c.setFont("Japanese", size)
        self.c.drawString(x, y, str(text))

    def centered(self, text, x, y, size=9):
        self.c.setFillColorRGB(0, 0, 0)
        self.c.setFont("Japanese", size)
        self.c.drawCentredString(x, y, str(text))

    def lines(self, lines, x, top, size=9, leading=13):
        for i, line in enumerate(lines):
            self.text(line, x, top - size - i * leading, size)

    def rect(self, x, top, width, height, shade=False):
        self.c.setStrokeColorRGB(0, 0, 0)
        self.c.setLineWidth(.55)
        if shade:
            self.c.setFillColorRGB(.95, .95, .95)
        self.c.rect(x, top - height, width, height, fill=int(shade))
        self.c.setFillColorRGB(0, 0, 0)

    def new_page(self, continuation=False, memo=False):
        if self.page:
            self.c.showPage()
        self.page += 1
        self.c.setLineWidth(.6)
        self.text("データベーススペシャリスト試験", LEFT, H - 31, 10)
        self.text(f"{self.year}年度 {self.term}　{self.name} 解答用紙", LEFT, H - 53, 15)
        self.text("A4・学習用", RIGHT - 62, H - 31, 8)
        self.c.line(LEFT, H - (59 if self.part == "pm2" else 65), RIGHT, H - (59 if self.part == "pm2" else 65))
        if memo:
            self.text(f"問{self.q['id'][-1]} メモ", LEFT, H - 88, 12)
            self.y = H - 100
        else:
            number = self.q["id"][-1]
            self.text(f"問{number}" + ("（続き）" if continuation else ""), LEFT, H - (78 if self.part == "pm2" else 88), 12)
            title = wrap(self.q["title"], WIDTH - 95, 9)
            self.lines(title, LEFT + 95, H - (66 if self.part == "pm2" else 76), 9, 12)
            self.y = H - (88 if self.part == "pm2" else 100) - max(0, len(title) - 1) * 12
        # Keep contact links and a vector QR code inside the existing footer,
        # preserving the answer space and two-page question boundaries.
        self.c.line(LEFT, 44, RIGHT, 44)
        self.text("出典：IPAの試験問題／学習用（公式の答案用紙ではありません）", LEFT, 35, 6.5)
        self.text(f"{self.year} / {self.name} / {self.page}", LEFT, 24, 7)
        self.text(URL, LEFT, 13, 8)
        self.c.linkURL(URL, (LEFT, 11, LEFT + pdfmetrics.stringWidth(URL, "Japanese", 8), 22), relative=0)
        qr_x, qr_y = RIGHT - QR_SIZE, 10
        contact = "誤記のご報告・お問い合わせはXへ"
        contact_x = qr_x - 10 - pdfmetrics.stringWidth(contact, "Japanese", 7)
        self.text(contact, contact_x, 31, 7)
        url_x = qr_x - 10 - pdfmetrics.stringWidth(X_URL, "Japanese", 8)
        self.text(X_URL, url_x, 16, 8)
        self.c.linkURL(X_URL, (url_x, 14, qr_x - 10, 26), relative=0)
        renderPDF.draw(QR_DRAWING, self.c, qr_x, qr_y)
        self.c.linkURL(X_URL, (qr_x, qr_y, RIGHT, qr_y + QR_SIZE), relative=0)
        self.page_context = None

    def heading_layout(self):
        estimate = score_text(self.q, self.context_items)
        if (self.q["id"], self.context) in self.shown_score_headings:
            total = sum(item["points"] for item in self.context_items)
            estimate = f"予想配点 {total:g}点（続き・内訳は前ページ）"
        available = WIDTH - pdfmetrics.stringWidth(self.context, "Japanese", 10) - 22
        size = 9
        first = wrap(estimate, available, size)[0]
        lines = [first] + (wrap(estimate[len(first):], WIDTH - 16, size) if len(first) < len(estimate) else [])
        base = 16 if self.part == "pm2" else 18 if self.density < 1 else 22
        key = (self.q["id"], self.context, self.heading_counts[(self.q["id"], self.context)])
        return lines, size, max(base, len(lines) * (size + 2) + 6, self.heading_heights.get(key, 0))

    def heading(self):
        lines, size, height = self.heading_layout()
        self.rect(LEFT, self.y, WIDTH, height, True)
        self.text(self.context, LEFT + 8, self.y - (13 if self.density < 1 else 15), 9 if self.density < 1 else 10)
        key = (self.q["id"], self.context, self.heading_counts[(self.q["id"], self.context)])
        self.heading_counts[(self.q["id"], self.context)] += 1
        self.heading_records.append({"key": key, "question": self.q, "context": self.context,
                                     "items": self.context_items, "page": self.page, "top": self.y, "height": height})
        self.y -= height
        self.page_context = self.context
        self.shown_score_headings.add((self.q["id"], self.context))

    def ensure(self, height):
        extra = self.heading_layout()[2] + (3 if self.part == "pm2" else 8 * self.density) if self.page_context != self.context else 0
        if self.y - height - extra < BOTTOM:
            self.new_page(True)
        if self.page_context != self.context:
            self.y -= 3 if self.part == "pm2" else 8 * self.density
            self.heading()
        if self.y - height < BOTTOM:
            raise ValueError(f"Oversize block: {self.q['id']} {self.context}: {height}")

    def field(self, key, label, answer, control, prefix=""):
        label = (prefix + " " + label).strip()
        is_schema = control == "schema" or key in ["1-2s", "3-2"] or key.startswith("2-")
        limit = control if isinstance(control, int) else 70 if key == "1-2b" else 0
        # Only normal-form questions explicitly require circling a printed choice.
        # Other select widgets are a web convenience; the paper gets a blank box.
        normal = control == "normal" or key == "1-2a"
        choices = control if isinstance(control, list) and set(control) in [set(["有", "無"]), set(["増分", "差分"]), set(["容量", "時間"])] else None
        label_width = 81 if len(label) > 5 else 47
        label_lines = wrap(label, label_width - 10, 8.5)
        if limit:
            # 8 mm / 20 columns for I; 7 mm / 25 columns for II. Standalone writing area:
            # no surrounding answer table or cramped side-label column.
            size = (7 if self.part == "pm2" else 8) * 72 / 25.4
            cols = 25 if self.part == "pm2" else 20
            rows = math.ceil(limit / cols)
            # Only answer identifiers belong beside the grid. The final cell
            # count already communicates the limit, so no caption is needed.
            identifiers = re.findall(r"[（(][a-z][）)]|[①-⑳]|(?<![A-Za-z])[A-Za-z](?![A-Za-z])", label)
            if re.fullmatch(r"[ァ-ヶ]", label):
                identifiers = [label]
            side_label = " ".join(identifiers).replace("（", "(").replace("）", ")")
            side_lines = wrap(side_label, 20, 8) if side_label else []
            height = max(rows * size, len(side_lines) * 9 + 4) + 8
            self.ensure(height)
            grid_top = self.y - 4
            grid_x = LEFT + 20
            self.lines(side_lines, LEFT, grid_top - 2, 8, 9)
            for n in range(limit):
                self.rect(grid_x + (n % cols) * size, grid_top - (n // cols) * size, size, size)
                if (n + 1) % cols == 0 or n + 1 == limit:
                    self.text(str(n + 1), grid_x + 3 + ((n % cols) + 1) * size,
                              grid_top - (n // cols + 1) * size + 3, 7)
            self.limits.append({"question":self.q["id"],"key":key,"cells":limit,"page":self.page,
                                "sizePt":size,"columns":cols,"standalone":True})
            self.y -= height
            self.coverage.append((self.q["id"], key))
            return
        elif normal:
            height = 38
        elif is_schema:
            # Leave room to handwrite attributes and underline keys.
            longest = max((len(line) for line in answer.splitlines()), default=1)
            rows = max(len(answer.splitlines()), math.ceil(longest / 40))
            height = max(30, min(120, rows * 21 + 6))
        else:
            rows = max(len(answer.splitlines()), math.ceil(len(answer) / 48))
            height = max(27, min(96, rows * 21 + 5))
        height = max(height * self.density, 21, len(label_lines) * 12 + (8 if self.part == "pm2" else 12))
        self.ensure(height)
        self.rect(LEFT, self.y, label_width, height)
        self.rect(LEFT + label_width, self.y, WIDTH - label_width, height)
        self.lines(label_lines, LEFT + 5, self.y - 6, 8.5, 12)
        x = LEFT + label_width + 8
        if normal:
            self.text("非正規形 ・ 第1正規形 ・ 第2正規形 ・ 第3正規形", x + 6, self.y - 23, 10)
        elif choices:
            self.text(" ・ ".join(choices), x + 6, self.y - 20, 10)
        elif "関係名・属性名" in label:
            self.text("関係名", x, self.y - 14, 8)
            self.text("属性名", x, self.y - 31, 8)
        self.y -= height
        self.coverage.append((self.q["id"], key))

    def paired_fields(self, fields):
        """Two short answers per row, with enough room for handwritten names."""
        for start in range(0, len(fields), 2):
            height = 24 if self.part == "pm2" else 28
            self.ensure(height)
            for column, (key, label, _) in enumerate(fields[start:start + 2]):
                x = LEFT + column * WIDTH / 2
                label = label.replace("のエンティティ名", "")
                label_width = 78 if len(label) > 4 else 47
                self.rect(x, self.y, label_width, height)
                self.rect(x + label_width, self.y, WIDTH / 2 - label_width, height)
                self.text(label, x + 5, self.y - 17, 8.5)
                self.coverage.append((self.q["id"], key))
            self.y -= height

    def printed_sql(self, key, sql):
        lines = []
        for line in sql.splitlines():
            lines.extend(wrap(line, WIDTH - 24, 8.5))
        height = max(55, len(lines) * 19 + 25)
        self.ensure(height)
        self.rect(LEFT, self.y, WIDTH, height)
        self.lines(lines, LEFT + 10, self.y - 10, 8.5, 19)
        self.y -= height
        self.coverage.append((self.q["id"], key))

    def data_table(self, headers, rows, keys, title="", compact=False):
        """Preserve tabular answers, given cells and spare blank rows."""
        compact = compact or (self.part == "pm2" and self.density < 1)
        n = len(headers)
        first_width = (150 if compact and self.part == "pm1" else 105) if n >= 5 else WIDTH / n
        widths = [first_width] + [(WIDTH-first_width)/(n-1)]*(n-1)
        size = 7 if n >= 8 else 8.5
        head_lines = [wrap(label or "", width-10, size) for label,width in zip(headers,widths)]
        head_height = max(29, max(len(lines) for lines in head_lines)*(size+3)+12)
        row_data = []
        for row in rows:
            clean = [re.sub(r"［\s*］", "", str(value or "")) for value in row]
            cell_lines = [wrap(value, width-10, size) for value,width in zip(clean,widths)]
            height = max(15 if compact and self.q["id"] == "2017-spring-db-pm2-q2" else 17 if compact and self.part == "pm2" else 20 if compact else 32, max(len(lines) for lines in cell_lines)*(size+3)+(4 if self.q["id"] == "2017-spring-db-pm2-q2" else 6 if self.part == "pm2" and compact else 10))
            row_data.append((cell_lines,height))
        index = 0
        row_pages = {}
        total_height = head_height + sum(height for _,height in row_data) + (18 if title else 0)
        if total_height <= 580 and self.part == "pm1":
            self.ensure(total_height)
        while index < len(row_data):
            title_height = 18 if title else 0
            self.ensure(head_height + row_data[index][1] + title_height)
            if title:
                self.text(title + ("（続き）" if index else ""), LEFT+5, self.y-12, 8)
                self.y -= title_height
            def row(cells,height,header=False):
                x = LEFT
                for lines,width in zip(cells,widths):
                    self.rect(x,self.y,width,height,header)
                    self.lines(lines,x+5,self.y-6,size,size+3)
                    x += width
                self.y -= height
            row(head_lines,head_height,True)
            while index < len(row_data) and self.y-row_data[index][1] >= BOTTOM:
                row(*row_data[index])
                row_pages[index] = self.page
                index += 1
            if index < len(row_data):
                self.new_page(True)
        self.coverage.extend((self.q["id"],key) for key in keys)
        fields = {f[0]: f[1] for section in self.q["sections"] for f in section["fields"]}
        for key in keys:
            label = fields[key]
            matches = [i for i, row in enumerate(rows) if str(row[0]) and label.startswith(str(row[0]) + "：")]
            if not matches and len(set(row_pages.values())) > 1:
                raise ValueError(f"Cannot locate split-table answer: {self.q['id']} {label}")
            self.field_pages[(self.q["id"], key)] = {row_pages[i] for i in matches} if matches else set(row_pages.values())

    def figure(self, key, title, ids):
        fig = self.q["figureFiles"][key]
        # Full width diagrams retain the fixed lines, node labels and blank parts.
        max_height = 270 if self.q["id"] == "2018-spring-db-pm1-q1" and key == "1" else 420
        if self.part == "pm2" and key.isdigit() and len(self.q["diagrams"][int(key)]["nodes"]) <= 3:
            max_height = min(max_height, 100)
        scale = min((WIDTH - 22) / fig["width"], max_height * self.density / fig["height"])
        side_names = [f for section in self.q["sections"] for f in section["fields"]
                      if f[0].startswith("model-name-")] if self.q["id"] == "2018-spring-db-pm1-q1" and key == "1" else []
        if side_names:
            scale = min(scale, (WIDTH / 2 - 18) / fig["width"])
        width, height = fig["width"] * scale, fig["height"] * scale
        if side_names:
            height = max(height, len(side_names) * 28)
        caption = wrap(title, WIDTH - 16, 8)
        box_height = height + 16 + len(caption) * 12
        self.ensure(box_height)
        self.rect(LEFT, self.y, WIDTH, box_height)
        self.lines(caption, LEFT + 8, self.y - 5, 8, 12)
        self.placements.append({"page": self.page - 1, "file": fig["file"], "scale":scale,
                                "x": LEFT + 8 if side_names else LEFT + (WIDTH - width) / 2, "y": self.y - box_height + 7})
        if side_names:
            for key, _, _ in side_names:
                self.field_pages[(self.q["id"], key)] = {self.page}
            x = LEFT + WIDTH / 2
            for i, (_, label, _) in enumerate(side_names):
                top = self.y - 26 - i * 28
                self.rect(x, top, 47, 28)
                self.rect(x + 47, top, WIDTH / 2 - 55, 28)
                self.text(label.replace("のエンティティ名", ""), x + 5, top - 18, 8.5)
        self.y -= box_height
        self.coverage.extend((self.q["id"], id_) for id_ in ids)

    def tall_figure_with_fields(self, section):
        # The tall 2017 diagram must not be shrunk to a tiny thumbnail.
        # Put its short attribute answers beside it instead of underneath.
        fig = self.q["figureFiles"]["0"]
        height = 300
        scale = height / fig["height"]
        width = fig["width"] * scale
        block_height = height + 28
        self.ensure(block_height)
        self.rect(LEFT, self.y, WIDTH, block_height)
        self.text("（1）図3　概念データモデル", LEFT + 8, self.y - 14, 8)
        self.placements.append({"page": self.page - 1, "file": fig["file"], "scale": scale,
                                "x": LEFT + 5, "y": self.y - block_height + 7})
        x = LEFT + width + 16
        self.text("（2）属性名", x, self.y - 14, 8)
        for index, (key, label, _) in enumerate(section["fields"]):
            top = self.y - 24 - index * 25
            self.rect(x, top, 24, 25)
            self.rect(x + 24, top, RIGHT - x - 29, 25)
            self.text(label, x + 5, top - 17, 8.5)
            self.coverage.append((self.q["id"], key))
        self.coverage.append((self.q["id"], "diagram:0"))
        self.y -= block_height

    def matrix(self, grid):
        rows = grid["rows"]
        if self.q["id"] == "2018-spring-db-pm1-q1" and self.density < 1:
            # Horizontal attribute labels avoid very tall vertical headers.
            headers = [rows[0][0]["text"]] + [row[0]["text"] for row in rows[1:]]
            transposed = [[rows[0][i]["text"]] + [row[i]["text"] for row in rows[1:]]
                          for i in range(1, len(rows[0]))]
            self.data_table(headers, transposed, grid["keys"], compact=True)
            return
        grouped = any(cell["rowspan"] > 1 for cell in rows[0])
        top = rows[1] if grouped else rows[0][1:]
        labels = [cell["text"] for cell in top]
        col_count = len(labels)
        row_width = 150 if self.part == "pm2" and col_count <= 7 else 100 if col_count <= 7 else 64
        col_width = (WIDTH - row_width) / col_count
        vertical = col_width < (45 if self.part == "pm2" else 55)
        header_height = max(46, max(len(label) for label in labels) * 8.5 + 12) if vertical else (max(30, max(len(wrap(label, col_width - 10, 8)) for label in labels) * 11 + 12) if self.part == "pm2" else 64)
        group_height = 20 if grouped else 0
        body = rows[2:] if grouped else rows[1:]
        heights = [max(18 if self.part == "pm2" else 30, len(wrap(row[0]["text"], row_width - 10, 8)) * 11 + (7 if self.part == "pm2" else 10)) for row in body]
        height = header_height + group_height + sum(heights)
        self.ensure(height)
        self.rect(LEFT, self.y, row_width, header_height + group_height, True)
        self.lines(wrap(rows[0][0]["text"], row_width - 10, 8), LEFT + 5, self.y - 7, 8, 11)
        if grouped:
            x = LEFT + row_width
            for cell in rows[0][1:]:
                width = col_width * cell["colspan"]
                self.rect(x, self.y, width, group_height, True)
                self.centered(cell["text"], x + width / 2, self.y - 14, 8)
                x += width
        top_y = self.y - group_height
        for i, label in enumerate(labels):
            x = LEFT + row_width + i * col_width
            self.rect(x, top_y, col_width, header_height, True)
            if vertical:
                for j, char in enumerate(label):
                    self.centered(char, x + col_width / 2, top_y - 13 - j * 8.5, 8)
            else:
                self.lines(wrap(label, col_width - 10, 8), x + 5, top_y - 7, 8, 11)
        y = top_y - header_height
        for row, h in zip(body, heights):
            self.rect(LEFT, y, row_width, h)
            self.lines(wrap(row[0]["text"], row_width - 10, 8), LEFT + 5, y - 7, 8, 11)
            for i, cell in enumerate(row[1:]):
                x = LEFT + row_width + i * col_width
                self.rect(x, y, col_width, h)
                # Empty interactive cells remain empty; only given marks survive.
                if cell["text"]:
                    self.centered(cell["text"], x + col_width / 2, y - h / 2 - 3, 10)
            y -= h
        self.y = y
        self.coverage.extend((self.q["id"], key) for key in grid["keys"])

    def question(self, q):
        self.q = q
        start_page = self.page + 1
        self.new_page()
        for section_index, (section, groups) in enumerate(zip(q["sections"], q["plan"])):
            if q["id"] == "2020-october-db-pm2-q1" and section_index == 2:
                self.new_page(True)
            if q["id"] == "2020-october-db-pm2-q2" and section_index == 1:
                self.new_page(True)
            if q["id"] == "2017-spring-db-pm2-q2" and section_index == 0:
                self.context = "設問1"
                self.context_items = [item for group in groups for item in group["items"]]
                self.tall_figure_with_fields(section)
                continue
            fields = {field[0]: field for field in section["fields"]}
            diagram_indices = [i for i, d in enumerate(q["diagrams"]) if d["section"] == section_index + 1]
            prompt_prefix = {}
            for prompt in section["prompts"]:
                key = prompt["before"]
                if key == "diagram":
                    key = "diagram:" + str(diagram_indices[0])
                letters = re.findall(r"^[（(]([a-z])[）)]", "\n".join(prompt["lines"]), re.M)
                prompt_prefix[key] = "（" + letters[0] + "）" if len(letters) == 1 else ""
            grid = q["tables"][section_index]
            rendered_grid = False
            consumed = set()
            # These paper forms include given cells or extra blank rows absent
            # from web inputs. Reuse only problem tables, never answer tables.
            source_specs = {
                ("2016-spring-db-pm1-q1",2): ("表2", lambda label: label.startswith(("(b)","(c)"))),
                ("2017-spring-db-pm1-q3",1): ("表4", lambda label: "行目：" in label),
                ("2017-spring-db-pm2-q1",1): ("表7", lambda label: label.startswith("f　表7")),
                ("2017-spring-db-pm2-q2",1): ("表1", lambda label: "：" in label),
                ("2019-spring-db-pm1-q1",1): ("表1", lambda label: "：条件" in label),
                ("2022-autumn-db-pm2-q1",0): ("表8", lambda label: label.startswith("会員番号")),
                ("2024-autumn-db-pm1-q2",0): ("表2", lambda label: label.startswith("時系列")),
            }
            source_spec = source_specs.get((q["id"],section_index))
            source_keys = [key for key, label, _ in section["fields"] if source_spec and source_spec[1](label)]
            for group in groups:
                self.context = f"設問{section_index + 1}{group['label']}"
                self.context_items = group["items"]
                prefix = ""
                group_keys = [key for item in group["items"] for key in item["ids"]]
                tabular_keys = [key for key in group_keys if key in fields and "：" in fields[key][1]
                                and not (grid and key in grid["keys"]) and key not in source_keys
                                and not isinstance(q.get("controls",{}).get(key),int)]
                short_keys = [key for key in group_keys if key in fields
                              and key not in source_keys and "：" not in fields[key][1]
                              and not (grid and key in grid["keys"])
                              and (len(fields[key][1]) <= (8 if self.part == "pm2" else 4) or "のエンティティ名" in fields[key][1])
                              and len(re.sub(r"(?:PK|FK)\[|\]", "", fields[key][2])) <= (26 if self.part == "pm2" else 24)
                              and (q.get("controls", {}).get(key) in (None, "short", "schema")
                                   or (self.part == "pm2" and (q.get("controls", {}).get(key) == "text" or isinstance(q.get("controls", {}).get(key), list))))]
                paired = self.density < 1 and len(short_keys) >= 4
                # Keep short row/column answers together instead of a page of
                # separate inputs (types, indexes, result rows, schedules).
                tabular = len(tabular_keys) >= 4 and all(len(fields[key][2]) < 50 for key in tabular_keys)
                for item in group["items"]:
                    for key in item["ids"]:
                        if key in consumed:
                            continue
                        if q["id"] == "2018-spring-db-pm1-q1" and key.startswith("model-name-"):
                            # The diagram block supplies five adjacent name fields.
                            self.coverage.append((q["id"], key))
                            consumed.add(key)
                            continue
                        if key in prompt_prefix:
                            prefix = prompt_prefix[key]
                        if paired and key in short_keys:
                            self.paired_fields([fields[k] for k in short_keys])
                            consumed.update(short_keys)
                        elif key in source_keys:
                            block = next(b for b in q["materialBlocks"] if b.get("table") and b["text"].startswith(source_spec[0]+"　"))
                            table = block["table"]
                            self.data_table(table["headers"],table["rows"],source_keys,block["text"],compact=len(table["rows"])>15)
                            consumed.update(source_keys)
                        elif tabular and key in tabular_keys:
                            pairs = {key:fields[key][1].split("：",1) for key in tabular_keys}
                            row_names = list(dict.fromkeys(pair[0] for pair in pairs.values()))
                            columns = list(dict.fromkeys(pair[1] for pair in pairs.values()))
                            self.data_table(["項目"]+columns,[[name]+[""]*len(columns) for name in row_names],tabular_keys)
                            consumed.update(tabular_keys)
                        elif q["id"] == "2016-spring-db-pm1-q3" and fields.get(key,[None,None])[1] in ["二重線で消す箇所", "SQL文"]:
                            sql_name = "SQL4" if fields[key][1] == "二重線で消す箇所" else "SQL5"
                            sql = next(row[1] for b in q["materialBlocks"] if b.get("table") for row in b["table"]["rows"] if row[0] == sql_name)
                            sql = re.sub(r"［\s*］", "\n\n", sql)
                            self.printed_sql(key,sql)
                        elif key.startswith("diagram:"):
                            i = int(key.split(":")[1])
                            self.figure(str(i), prefix + " " + q["diagrams"][i]["title"], [key])
                        elif key == "deadlock-case2":
                            self.figure("tree", "図4　対象の部品を○で囲んでください。", [key])
                        elif grid and key in grid["keys"]:
                            if not rendered_grid:
                                self.matrix(grid)
                                rendered_grid = True
                        else:
                            _, label, answer = fields[key]
                            # Labels that already carry a subpart retain their own numbering.
                            existing = re.match(r"^[（(]([a-z])[）)]", label)
                            if existing:
                                prefix = "（" + existing[1] + "）"
                            if q["id"] == "2023-autumn-db-pm1-q1" and key in ["archive-3-2-2", "archive-3-2-3"]:
                                prefix = "（b）"
                            use_prefix = "" if existing else prefix
                            self.field(key, label, answer, q.get("controls", {}).get(key), use_prefix)

        content_pages = self.page - start_page + 1
        memo_page = None
        # Each large question starts on the front of a sheet / a new pair.
        # Pad only an odd-length question, never the year to a multiple of four.
        if content_pages % 2:
            self.new_page(memo=True)
            memo_page = self.page
        self.question_pages.append({"question":int(q["id"][-1]),"startPage":start_page,
                                    "contentPages":content_pages,"memoPage":memo_page,"endPage":self.page})

    def page_score(self, record):
        local, shared = [], []
        qid, page = record["question"]["id"], record["page"]
        for item in record["items"]:
            ids = [key for key in item["ids"] if page in self.field_pages.get((qid, key), set())]
            if not ids:
                continue
            if all(self.field_pages[(qid, key)] == {page} for key in item["ids"]):
                local.append(item)
            else:
                label = score_text(record["question"], [{"ids": ids, "points": item["points"]}]).split("　", 1)[1]
                shared.append(label + "（他頁と合算）")
        if not shared:
            return score_text(record["question"], local)
        prefix = score_text(record["question"], local) if local else "予想配点（他頁と合算）"
        return prefix + "　" + "／".join(shared)

    def score_lines(self, record):
        text = self.page_score(record)
        available = WIDTH - pdfmetrics.stringWidth(record["context"], "Japanese", 10) - 22
        first = wrap(text, available, 9)[0]
        return [first] + (wrap(text[len(first):], WIDTH - 16, 9) if len(first) < len(text) else [])

    def required_heading_heights(self):
        result = dict(self.heading_heights)
        for record in self.heading_records:
            result[record["key"]] = max(record["height"], len(self.score_lines(record)) * 11 + 6)
        return result

    def finish(self):
        content_pages = sum(q["contentPages"] for q in self.question_pages)
        self.c.save()
        reader = PdfReader(self.buf)
        for number, page in enumerate(reader.pages, 1):
            overlay = io.BytesIO()
            painter = canvas.Canvas(overlay, pagesize=A4)
            painter.setFont("Japanese", 9)
            for record in self.heading_records:
                if record["page"] == number:
                    for i, line in enumerate(self.score_lines(record)):
                        painter.drawRightString(RIGHT - 8, record["top"] - 12 - i * 11, line)
            painter.save()
            page.merge_page(PdfReader(overlay).pages[0])
        for placement in self.placements:
            source = PdfReader(ROOT / placement["file"]).pages[0]
            reader.pages[placement["page"]].merge_transformed_page(source, Transformation().scale(placement["scale"]).translate(placement["x"], placement["y"]))
        writer = PdfWriter()
        writer.append(reader)
        writer.add_metadata({"/Title":f"{self.year}年度 {self.name} 解答用紙", "/Author":"データベーススペシャリスト試験演習室"})
        path = OUT / f"{self.year}-{self.part}.pdf"
        writer.write(path)
        return {"year":self.year,"part":self.part,"pages":self.page,"contentPages":content_pages,
                "memoPages":self.page-content_pages,"fields":len(self.coverage),
                "questions":self.question_pages,
                "scoreHeadings":[{"page": r["page"], "question":r["question"]["id"], "context":r["context"], "text":self.page_score(r)} for r in self.heading_records],
                "gridCells":sum(grid["cells"] for grid in self.limits),"grids":len(self.limits),
                "file":path.name,"size":path.stat().st_size}


manifest = []
all_coverage = []
all_limits = []
for year in range(2025, 2015, -1):
    for part in ["pm1", "pm2"]:
        sheet = Sheet(year, part)
        selected = [q for q in questions if q["id"].startswith(str(year)) and f"-{part}-" in q["id"]]
        assert len(selected) == (3 if part == "pm1" else 2)
        for q in selected:
            if part in ["pm1", "pm2"]:
                # Measure each question before writing it. Keep the roomy layout
                # when it fits; only reduce rows/diagram height when needed.
                # Character squares keep a fixed physical size for each part.
                for density in ([1, .9, .8, .7, .6] if part == "pm1" else [.9, .8, .7, .6, .5, .45, .4, .35]):
                    heights = {}
                    for attempt in range(10):
                        probe = Sheet(year, part, density, heights)
                        probe.question(q)
                        required = probe.required_heading_heights()
                        if required == heights:
                            break
                        heights = required
                    else:
                        raise ValueError(f"Score heading pagination did not converge: {q['id']}")
                    if probe.question_pages[0]["contentPages"] <= 2:
                        sheet.density = density
                        sheet.heading_heights.update(heights)
                        break
                else:
                    raise ValueError(f"Question exceeds two pages: {q['id']}")
                print(f"{q['id']}: density={density}")
            sheet.question(q)
        manifest.append(sheet.finish())
        all_coverage.extend(sheet.coverage)
        all_limits.extend(sheet.limits)

expected = [(q["id"], key) for q in questions for groups in q["plan"] for group in groups for item in group["items"] for key in item["ids"]]
assert Counter(expected) == Counter(all_coverage), "Missing or duplicate answer fields"
assert all(n == 1 for n in Counter(all_coverage).values())

deliverable = ROOT / "output/pdf"
deliverable.mkdir(parents=True, exist_ok=True)
for part, label in [("pm1","午後Ⅰ"),("pm2","午後Ⅱ")]:
    combined = PdfWriter()
    for entry in manifest:
        if entry["part"] == part:
            combined.append(OUT / entry["file"], outline_item=f"{entry['year']}年度 {label}")
    combined.add_metadata({"/Title":f"データベーススペシャリスト {label} 解答用紙 2016〜2025年度", "/Author":"データベーススペシャリスト試験演習室"})
    combined.write(OUT / f"2016-2025-{part}.pdf")
    (deliverable / f"db-answer-sheets-2016-2025-{part}.pdf").write_bytes((OUT / f"2016-2025-{part}.pdf").read_bytes())
(OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
(ASSETS / "validation.json").write_text(json.dumps({"fields":len(all_coverage),"characterGrids":all_limits,"figures":sum(len(q["figureFiles"]) for q in questions)},ensure_ascii=False,indent=2))
print(json.dumps({"files":len(manifest),"pages":sum(m["pages"] for m in manifest),"answerFields":len(all_coverage),"characterGrids":len(all_limits)},ensure_ascii=False))
