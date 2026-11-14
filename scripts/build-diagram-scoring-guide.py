"""Create a one-page, illustrated A4 guide to integer diagram deductions."""
import os
import shutil
from pathlib import Path
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.graphics import renderPDF

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/answer-sheets/diagram-scoring-guide.pdf'
OUT.parent.mkdir(parents=True, exist_ok=True)
pdfmetrics.registerFont(TTFont('Japanese', os.environ.get('ANSWER_SHEET_FONT', '/Library/Fonts/Arial Unicode.ttf')))
c = canvas.Canvas(str(OUT), pagesize=A4)
c.setTitle('図の採点ルール｜図でわかる整数減点')
c.setAuthor('データベーススペシャリスト試験演習室')
W, H = A4
L, R = 32, W - 32
INK = '#162c30'
MUTED = '#4c5d60'
ERROR = '#a62c28'


def text(value, x, y, size=10, color=INK, center=False):
    c.setFillColor(color)
    c.setFont('Japanese', size)
    (c.drawCentredString if center else c.drawString)(x, y, value)


def line(x1, y1, x2, y2, color=INK, width=1.25):
    c.setStrokeColor(color)
    c.setLineWidth(width)
    c.line(x1, y1, x2, y2)


def node(label, x, y, width=44):
    c.setStrokeColor(INK)
    c.setFillColor('white')
    c.setLineWidth(.8)
    c.rect(x, y - 11, width, 22, fill=1)
    text(label, x + width / 2, y - 3, 9, center=True)


def relation(x1, y1, x2, y2, kind='many', color=INK):
    """Same open arrow and subtype triangle conventions as the exercise sheets."""
    import math
    ux, uy = x2 - x1, y2 - y1
    length = math.hypot(ux, uy)
    ux, uy = ux / length, uy / length
    px, py = -uy, ux
    if kind == 'subtype':
        bx, by = x1 + ux * 13, y1 + uy * 13
        line(x1, y1, bx + px * 5, by + py * 5, color)
        line(x1, y1, bx - px * 5, by - py * 5, color)
        line(bx + px * 5, by + py * 5, bx - px * 5, by - py * 5, color)
        line(bx, by, x2, y2, color)
    else:
        line(x1, y1, x2, y2, color)
        if kind == 'many':
            for sign in [-1, 1]:
                line(x2, y2, x2 - ux * 7 + sign * px * 3.8,
                     y2 - uy * 7 + sign * py * 3.8, color)


def pair(x, y, kind='many', reverse=False, labels=('顧客', '注文'), wrong=False):
    node(labels[0], x, y, 51)
    node(labels[1], x + 117, y, 51)
    if kind == 'none':
        return
    a, b = (x + 51, y), (x + 117, y)
    if reverse:
        a, b = b, a
    relation(*a, *b, kind, ERROR if wrong else INK)


def wrong_target(x, y, wrong=False):
    node('A', x, y, 38)
    node('B', x + 120, y + 14, 38)
    node('C', x + 120, y - 17, 38)
    relation(x + 38, y, x + 120, y - 17 if wrong else y + 14,
             color=ERROR if wrong else INK)


def extra(x, y, wrong=False):
    for label, offset in [('A', 0), ('B', 65), ('C', 130)]:
        node(label, x + offset, y, 38)
    relation(x + 38, y, x + 65, y)
    relation(x + 103, y, x + 130, y)
    if wrong:
        # The existing two relations remain correct; the lower route is extra.
        line(x + 19, y - 11, x + 19, y - 25, ERROR)
        line(x + 19, y - 25, x + 149, y - 25, ERROR)
        relation(x + 149, y - 25, x + 149, y - 11, color=ERROR)
        text('余分な線', x + 84, y - 23, 8, ERROR, center=True)


text('図の採点ルール', L, H - 40, 23)
text('満点から引くだけ。小数点の計算は不要です。', L, H - 61, 11, MUTED)
card_w = (R - L - 12) / 2
for index, (title, subtitle, deduction) in enumerate([
    ('関係の種類・向きの誤り', 'つなぐ相手は合っている', '−1点／本'),
    ('接続先の誤り・不足・余分', '相手が違う／線がない／線が多い', '−2点／本'),
]):
    x = L + index * (card_w + 12)
    c.setFillColor('#eef3f3' if index == 0 else '#f7efec')
    c.roundRect(x, H - 143, card_w, 67, 7, fill=1, stroke=0)
    text(title, x + 12, H - 94, 11)
    text(subtitle, x + 12, H - 110, 8.5, MUTED)
    text(deduction, x + 12, H - 134, 19)

text('例：17点満点 − 向きの誤り1本 − 線の不足2本 ＝ 12点', L, H - 164, 11)
correct_x, wrong_x = 145, 355
text('間違いの種類', L + 6, H - 188, 9, MUTED)
text('正しい図', correct_x + 84, H - 188, 11, center=True)
text('間違いの例', wrong_x + 84, H - 188, 11, ERROR, center=True)

cases = [
    ('種類が違う', '−1点', '矢印がない：1対多 → 1対1', 'kind'),
    ('向きが逆', '−1点', '矢印が反対側についている', 'direction'),
    ('接続先が違う', '−2点', 'A→B が正解なのに、A→C', 'target'),
    ('線が不足', '−2点', '必要な線が描かれていない', 'missing'),
    ('線が余分', '−2点', '不要な A→C を追加している', 'extra'),
]
for i, (label, points, caption, kind) in enumerate(cases):
    top = H - 200 - i * 93.6
    line(L, top, R, top, '#c7d0d1', .6)
    text(label, L + 6, top - 23, 10)
    text(points, L + 6, top - 47, 17, ERROR)
    mid = top - 26
    if kind == 'target':
        wrong_target(correct_x, mid - 3)
        wrong_target(wrong_x, mid - 3, True)
    elif kind == 'extra':
        extra(correct_x, mid)
        extra(wrong_x, mid, True)
    else:
        pair(correct_x, mid)
        pair(wrong_x, mid, 'one' if kind == 'kind' else 'none' if kind == 'missing' else 'many',
             reverse=kind == 'direction', wrong=True)
    text(caption, correct_x, top - 68, 9, MUTED)

bottom = H - 668
line(L, bottom, R, bottom, '#c7d0d1', .6)
text('覚えておくことは、この3つ', L, bottom - 21, 11)
for i, note in enumerate([
    '同じ線は1回だけ減点。誤接続を「不足＋余分」と重ねて数えません。',
    '印刷済みの線は対象外。線の曲がり方・交差・配置の違いは減点しません。',
    'エンティティ名・属性名は別の解答欄で採点。ここでは重ねて減点しません。',
]):
    text('・' + note, L, bottom - 40 - i * 16, 9)
text('※ 向きに意味がある関係で判定します。種類と向きの両方が違っても、同じ線は−1点。', L, 79, 8, MUTED)
text('学習用の予想配点に対する自己採点基準です。IPAの公式採点基準ではありません。', L, 61, 8, MUTED)
line(L, 56, R, 56, '#c7d0d1', .6)
site_url = 'https://ipa-db-sp.naritai.app/'
x_url = 'https://x.com/taiki_smec'
text('データベーススペシャリスト試験演習室', L, 36, 8, MUTED)
text(site_url, L, 21, 8)
c.linkURL(site_url, (L, 19, L + pdfmetrics.stringWidth(site_url, 'Japanese', 8), 31), relative=0)
qr_size = 44
qr_x, qr_y = R - qr_size, 8
x_text_x = qr_x - 10 - pdfmetrics.stringWidth(x_url, 'Japanese', 8)
contact = '誤記のご報告・お問い合わせはXへ'
text(contact, qr_x - 10 - pdfmetrics.stringWidth(contact, 'Japanese', 7), 42, 7)
text(x_url, x_text_x, 26, 8)
c.linkURL(x_url, (x_text_x, 24, qr_x - 10, 36), relative=0)
qr = QrCodeWidget(x_url, barLevel='M')
x0, y0, x1, y1 = qr.getBounds()
qr_drawing = Drawing(qr_size, qr_size, transform=[qr_size/(x1-x0), 0, 0, qr_size/(y1-y0), 0, 0])
qr_drawing.add(qr)
renderPDF.draw(qr_drawing, c, qr_x, qr_y)
c.linkURL(x_url, (qr_x, qr_y, R, qr_y + qr_size), relative=0)
c.save()
final = ROOT / 'output/pdf/db-diagram-scoring-guide.pdf'
final.parent.mkdir(parents=True, exist_ok=True)
shutil.copyfile(OUT, final)
print(final)
