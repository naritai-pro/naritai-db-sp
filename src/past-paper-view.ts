import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { answerField } from "./answer-field";
import { button, el, link } from "./dom";
import { morningTerm } from "./morning-catalog";
import { phoneQuestion } from "./phone";
import type { PastPaper } from "./past-papers";
import type { RecordData } from "./store";

GlobalWorkerOptions.workerSrc = workerUrl;
type Point = [number, number];

function external(label: string, url: string) {
  const a = link(label, url);
  a.target = "_blank";
  a.rel = "noopener";
  return a;
}

function viewer(title: string, url: string, official: string, signal: AbortSignal,
  ink?: {record: RecordData; save: () => void; editable: boolean; firstPage: number; lastPage: number}) {
  const view = el("div", "", "pdf-viewer");
  const controls = el("div", "", "pdf-controls");
  const message = el("div", "読み込み中…");
  message.setAttribute("role", "status");
  const pageHost = el("div", "", "pdf-page");
  const pageSelect = el("select");
  pageSelect.setAttribute("aria-label", title + "のページ");
  let doc: PDFDocumentProxy;
  let revision = 0;
  let writing = false;
  const pen = button("図に記入", () => {
    writing = !writing;
    pen.setAttribute("aria-pressed", String(writing));
    pageHost.classList.toggle("writing", writing);
  });
  pen.setAttribute("aria-pressed", "false");
  let overlay: HTMLCanvasElement | undefined;
  function strokes(): Point[][] {
    return ink?.record.strokes?.[pageSelect.value] ?? [];
  }
  function paint(current?: Point[]) {
    if (!overlay) return;
    const ctx = overlay.getContext("2d")!;
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    ctx.lineWidth = overlay.width / 380;
    ctx.strokeStyle = "#008254";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const stroke of current ? [...strokes(), current] : strokes()) {
      if (!stroke.length) continue;
      ctx.beginPath();
      ctx.moveTo(stroke[0][0] * overlay.width, stroke[0][1] * overlay.height);
      for (const [x,y] of stroke.slice(1)) ctx.lineTo(x * overlay.width, y * overlay.height);
      if (stroke.length === 1) ctx.lineTo(stroke[0][0] * overlay.width + 1, stroke[0][1] * overlay.height);
      ctx.stroke();
    }
    undo.disabled = !strokes().length;
  }
  const undo = button("一筆戻す", () => {
    strokes().pop();
    ink?.save();
    paint();
  });
  const prev = button("前へ", () => step(-1));
  const next = button("次へ", () => step(1));
  function step(delta: number) {
    pageSelect.value = String(Number(pageSelect.value) + delta);
    void show();
  }
  async function show() {
    const thisRevision = ++revision;
    const number = Number(pageSelect.value);
    prev.disabled = number <= 1;
    next.disabled = number >= doc.numPages;
    message.textContent = "読み込み中…";
    pageHost.replaceChildren();
    overlay = undefined;
    try {
      const page = await doc.getPage(number);
      if (signal.aborted || thisRevision !== revision) return;
      const base = page.getViewport({scale: 1});
      const viewport = page.getViewport({scale: Math.min(3, 1800 / base.width)});
      const canvas = el("canvas");
      canvas.setAttribute("role", "img");
      canvas.setAttribute("aria-label", title + " " + number + "ページ");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({canvas, viewport}).promise;
      if (signal.aborted || thisRevision !== revision) return;
      message.textContent = "";
      pageHost.replaceChildren(canvas);
      if (!ink) return;
      const inkLayer = el("canvas", "", "pdf-ink");
      inkLayer.setAttribute("aria-hidden", "true");
      inkLayer.width = canvas.width;
      inkLayer.height = canvas.height;
      overlay = inkLayer;
      pageHost.append(inkLayer);
      paint();
      if (!ink.editable) return;
      let points: Point[] | undefined;
      let pointer: number | undefined;
      function point(e: PointerEvent): Point {
        const box = inkLayer.getBoundingClientRect();
        const norm = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 10000) / 10000;
        return [norm((e.clientX-box.left)/box.width), norm((e.clientY-box.top)/box.height)];
      }
      inkLayer.onpointerdown = e => {
        if (!writing || e.button !== 0 || points) return;
        pointer = e.pointerId;
        inkLayer.setPointerCapture(pointer);
        points = [point(e)];
        paint(points);
      };
      inkLayer.onpointermove = e => {
        if (!points || pointer !== e.pointerId) return;
        points.push(point(e));
        paint(points);
      };
      inkLayer.onpointerup = e => {
        if (!points || pointer !== e.pointerId) return;
        const pages = ink.record.strokes ??= {};
        (pages[String(number)] ??= []).push(points);
        points = undefined;
        pointer = undefined;
        ink.save();
        paint();
      };
      inkLayer.onpointercancel = () => { points = undefined; pointer = undefined; paint(); };
    } catch {
      if (!signal.aborted && thisRevision === revision) message.textContent = "ページを表示できません。PDFを開いてご覧ください。";
    }
  }
  prev.disabled = next.disabled = undo.disabled = true;
  pageSelect.onchange = () => void show();
  controls.append(prev, pageSelect, next);
  if (ink?.editable) controls.append(pen, undo);
  controls.append(external("PDFを開く ↗", url), external("IPA原本 ↗", official));
  view.append(controls, message, pageHost);
  const task = getDocument({url, cMapUrl: "/pdfjs/cmaps/", cMapPacked: true, standardFontDataUrl: "/pdfjs/standard_fonts/", wasmUrl: "/pdfjs/wasm/"});
  signal.addEventListener("abort", () => { void task.destroy().catch(() => {}); }, {once: true});
  void task.promise.then(pdf => {
    if (signal.aborted) return;
    doc = pdf;
    for (let n = 1; n <= doc.numPages; n++) {
      const paperPage = ink ? ink.firstPage + n - 1 : undefined;
      const label = ink && paperPage ? paperPage <= ink.lastPage ? "冊子 p." + paperPage : "表記ルール " + (paperPage - ink.lastPage) : n + " / " + doc.numPages;
      pageSelect.add(new Option(label, String(n)));
    }
    void show();
  }).catch(() => { if (!signal.aborted) message.textContent = "資料を表示できません。PDFを開いてご覧ください。"; });
  return view;
}

export function renderPastPaper(app: HTMLElement, q: PastPaper, reviewing: boolean, status: HTMLElement,
  record: RecordData, save: () => void, signal: AbortSignal) {
  const solve = "/" + q.year + "/" + q.part + "/q" + q.number;
  const base = "/past-papers/" + q.year + "/" + q.part + "-q" + q.number + "-";
  const exam = q.year + "年度 " + morningTerm(q.year) + " " + (q.part === "pm1" ? "午後Ⅰ" : "午後Ⅱ") + " 問" + q.number;
  const top = el("div", "", "question-top");
  const nav = el("nav", "", "breadcrumbs");
  nav.setAttribute("aria-label", "パンくずリスト");
  nav.append(link("問題一覧", "/"), " / ", el("span", exam), " / ", el("h1", q.title));
  top.append(nav, status);
  const layout = el("div", "", "layout");
  const sheet = el("article", "", "card");
  const paper = el("aside", "", "card materials");
  const bar = el("div", "", "paper-bar");
  const heading = el("div", "", "sheet-heading");
  const tabs = el("div", "", "tabs");
  tabs.append(link("解答する", solve, reviewing ? "" : "active"), link("答え合わせ", solve + "/answer", reviewing ? "active" : ""));
  tabs.children[reviewing ? 1 : 0].setAttribute("aria-current", "page");
  bar.append(el("h2", reviewing ? "解答例と採点講評" : "解答用紙"), tabs);
  heading.append(bar);
  sheet.append(heading);
  if (reviewing) {
    if (q.studyNote) {
      const guide = el("section");
      guide.append(el("h2", "解き方"), el("p", q.studyNote));
      sheet.append(guide);
    }
    const docs = [{kind:"answer", title:"IPA解答例", source:q.answer}, {kind:"comment", title:"IPA採点講評", source:q.comment}];
    for (const {kind, title, source} of docs) {
      const section = el("section");
      section.append(el("h2", title), viewer(title, base + kind + ".pdf", source, signal));
      sheet.append(section);
    }
  }
  for (const [i, n] of q.sections.entries()) {
    const section = el("section");
    const heading = n === 0 ? "設問" : "設問" + n;
    section.append(el("h2", heading));
    for (const sub of q.subparts[i]?.length ? q.subparts[i] : [0]) {
      const label = sub ? heading + "（" + sub + "）" : heading;
      const key = "past-" + n + "-" + sub;
      if (reviewing) {
        section.append(el("h3", label + "の答案"), el("pre", record.fields[key]?.trim() || "未解答"));
      } else {
        section.append(answerField(key, label, record.fields[key] ?? "", value => { record.fields[key] = value; save(); }));
      }
    }
    sheet.append(section);
  }
  sheet.append(link(reviewing ? "解答用紙に戻る" : "解答例・採点講評を確認する →", reviewing ? solve : solve + "/answer", "primary"));
  const paperBar = el("div", "", "paper-bar");
  paperBar.append(el("h2", "問題資料"));
  paper.append(paperBar, viewer("問題冊子", base + "question.pdf", q.paper, signal, {record, save, editable: !reviewing, firstPage: q.firstPage, lastPage: q.lastPage}));
  layout.append(sheet, paper);
  app.replaceChildren(top, layout);
  phoneQuestion(layout, sheet, paper, reviewing);
}
