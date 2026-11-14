"""Generate reusable A4 morning mark sheets (reportlab; Japanese TTF required)."""
import os
from pathlib import Path
from shutil import copyfile

from pypdf import PdfReader, PdfWriter
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.graphics import renderPDF

ROOT = Path(__file__).resolve().parents[1]
FONT = os.environ.get("ANSWER_SHEET_FONT", "/Library/Fonts/Arial Unicode.ttf")
pdfmetrics.registerFont(TTFont("Japanese", FONT))
W, H = A4


def build():
    output = ROOT / "output/pdf/db-answer-sheet-morning.pdf"
    output.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(output), pagesize=A4, invariant=1)
    c.setTitle("午前Ⅰ・午前Ⅱ マークシート（年度共通）")
    c.setAuthor("データベーススペシャリスト試験演習室")

    def text(value, x, y, size=10, center=False):
        c.setFont("Japanese", size)
        (c.drawCentredString if center else c.drawString)(x, y, value)

    c.setFillGray(0.12)
    text("データベーススペシャリスト試験", 36, H - 38, 13)
    text("午前Ⅰ・午前Ⅱ マークシート", 36, H - 64, 18)
    text("年度共通 / A4・1ページ", 36, H - 83, 9)
    text("各問のア・イ・ウ・エから一つ選び、楕円の中を塗りつぶしてください。", 36, H - 102, 9)
    draw_section(c, text, "午前Ⅰ", 30, H - 139)
    draw_section(c, text, "午前Ⅱ", 25, H - 468)
    c.setFillGray(0.25)
    c.setStrokeGray(0.4)
    c.setLineWidth(0.6)
    c.line(36, 44, W - 36, 44)
    text("学習用（公式の答案用紙ではありません）", 36, 35, 6.5)
    text("年度共通 / 午前Ⅰ・午前Ⅱ / 1", 36, 24, 7)
    site_url = "https://ipa-db-sp.naritai.app/"
    contact_url = "https://x.com/taiki_smec"
    text(site_url, 36, 13, 8)
    c.linkURL(site_url, (36, 11, 36 + pdfmetrics.stringWidth(site_url, "Japanese", 8), 22), relative=0)
    qr_size = 32
    qr_x, qr_y = W - 36 - qr_size, 10
    contact = "誤記のご報告・お問い合わせはXへ"
    text(contact, qr_x - 10 - pdfmetrics.stringWidth(contact, "Japanese", 7), 31, 7)
    url_x = qr_x - 10 - pdfmetrics.stringWidth(contact_url, "Japanese", 8)
    text(contact_url, url_x, 16, 8)
    c.linkURL(contact_url, (url_x, 14, qr_x - 10, 26), relative=0)
    qr = QrCodeWidget(contact_url, barLevel="M")
    x0, y0, x1, y1 = qr.getBounds()
    drawing = Drawing(qr_size, qr_size, transform=[qr_size / (x1-x0), 0, 0, qr_size / (y1-y0), 0, 0])
    drawing.add(qr)
    renderPDF.draw(drawing, c, qr_x, qr_y)
    c.linkURL(contact_url, (qr_x, qr_y, W - 36, qr_y + qr_size), relative=0)
    c.showPage()
    c.save()
    public = ROOT / "public/answer-sheets/morning.pdf"
    public.parent.mkdir(parents=True, exist_ok=True)
    copyfile(output, public)
    # One download includes the common morning sheet and both afternoon bundles.
    with PdfWriter() as writer:
        for name in ["morning.pdf", "2016-2025-pm1.pdf", "2016-2025-pm2.pdf"]:
            writer.append(PdfReader(public.parent / name))
        writer.add_metadata({"/Title": "学習用解答用紙（午前Ⅰ・Ⅱ／午後Ⅰ・Ⅱ 2016〜2025年度）"})
        writer.write(public.parent / "2016-2025-all.pdf")
    print(public)


def draw_section(c, text, label, count, top):
    c.setFillGray(0.12)
    text(f"{label}（{count}問）", 36, top + 11, 12)
    gap = 14
    width = (W - 72 - 2 * gap) / 3
    row_h = 26
    header_h = 23
    for col in range(3):
        x = 36 + col * (width + gap)
        start = col * 10 + 1
        rows = min(10, count - start + 1)
        c.setFillGray(0.2)
        c.rect(x, top - header_h, width, header_h, fill=1, stroke=0)
        c.setFillGray(1)
        text("問", x + 19, top - 16, center=True)
        text("解答欄", x + 38 + (width - 38) / 2, top - 16, center=True)
        for row in range(rows):
            y = top - header_h - row * row_h
            c.setFillGray(0.95)
            c.rect(x, y - row_h, 38, row_h, fill=1, stroke=0)
            c.setStrokeGray(0.55)
            c.setLineWidth(0.5)
            c.rect(x, y - row_h, width, row_h, fill=0, stroke=1)
            c.line(x + 38, y, x + 38, y - row_h)
            c.setFillGray(0.1)
            text(str(start + row), x + 19, y - 17, 10, center=True)
            for i, choice in enumerate("アイウエ"):
                cx = x + 38 + (width - 38) * (i + 0.5) / 4
                cy = y - row_h / 2
                c.setDash(1, 1.5)
                c.ellipse(cx - 10, cy - 7, cx + 10, cy + 7)
                c.setDash()
                text(choice, cx, cy - 3.2, 9, center=True)


if __name__ == "__main__":
    build()
