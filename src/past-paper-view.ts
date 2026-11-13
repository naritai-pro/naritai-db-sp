import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { partTree } from "./part-tree";
import rawPrompts from "./legacy-prompts.json";
import rawFields from "./legacy-fields.json";
import rawDiagrams from "./legacy-diagrams.json";
import { diagram } from "./diagram";
import type { Diagram } from "./exam";
import { schemaPreview } from "./schema-input";
import { afternoonId } from "./past-papers";
import { answerField } from "./answer-field";
import { button, el, link } from "./dom";
import { morningTerm } from "./morning-catalog";
import { phoneQuestion } from "./phone";
import type { PastPaper } from "./past-papers";
import type { RecordData } from "./store";

GlobalWorkerOptions.workerSrc = workerUrl;
type PaperField = {section: number; sub: number; label: string; answer: string; control?: Parameters<typeof answerField>[4]};
type PaperDiagram = Diagram & {sub: number; solutionImage: string};
const promptsByQuestion: Record<string, Record<string, string[]>> = rawPrompts;
const fieldsByQuestion = rawFields as Record<string, PaperField[]>;
const diagramsByQuestion = rawDiagrams as unknown as Record<string, PaperDiagram[]>;

function external(label: string, url: string) {
  const a = link(label, url);
  a.target = "_blank";
  a.rel = "noopener";
  return a;
}

function viewer(title: string, url: string, official: string, signal: AbortSignal,
  ink?: {record: RecordData; firstPage: number; lastPage: number}) {
  const view = el("div", "", "pdf-viewer");
  const controls = el("div", "", "pdf-controls");
  const message = el("div", "読み込み中…");
  message.setAttribute("role", "status");
  const pageHost = el("div", "", "pdf-page");
  const pageSelect = el("select");
  pageSelect.setAttribute("aria-label", title + "のページ");
  let doc: PDFDocumentProxy;
  let revision = 0;
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
      // Old pen answers stay visible on their original page.
      const strokes = ink?.record.strokes?.[String(number)];
      if (strokes?.length) {
        const ctx = canvas.getContext("2d")!;
        ctx.strokeStyle = "#008254";
        ctx.lineWidth = canvas.width / 380;
        ctx.lineCap = "round";
        for (const stroke of strokes) {
          ctx.beginPath();
          for (const [i, [x, y]] of stroke.entries()) {
            if (i === 0) ctx.moveTo(x * canvas.width, y * canvas.height);
            ctx.lineTo(x * canvas.width, y * canvas.height);
          }
          ctx.stroke();
        }
      }
    } catch {
      if (!signal.aborted && thisRevision === revision) message.textContent = "ページを表示できません。PDFを開いてご覧ください。";
    }
  }
  prev.disabled = next.disabled = true;
  pageSelect.onchange = () => void show();
  controls.append(prev, pageSelect, next);

  controls.append(external("PDFを開く ↗", url), external("IPA原本 ↗", official));
  view.append(controls, message, pageHost);
  const task = getDocument({url, cMapUrl: "/pdfjs/cmaps/", cMapPacked: true, standardFontDataUrl: "/pdfjs/standard_fonts/", wasmUrl: "/pdfjs/wasm/"});
  signal.addEventListener("abort", () => { void task.destroy().catch(() => {}); }, {once: true});
  void task.promise.then(pdf => {
    if (signal.aborted) return;
    doc = pdf;
    for (let n = 1; n <= doc.numPages; n++) {
      let label = n + " / " + doc.numPages;
      if (ink) {
        const paperPage = ink.firstPage + n - 1;
        label = paperPage <= ink.lastPage ? "冊子 p." + paperPage : "表記ルール " + (paperPage - ink.lastPage);
      }
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
  }
  for (const [i, n] of q.sections.entries()) {
    const section = el("section");
    const heading = n === 0 ? "設問" : "設問" + n;
    section.append(el("h2", heading));
    for (const sub of q.subparts[i]?.length ? q.subparts[i] : [0]) {
      const label = sub ? heading + "（" + sub + "）" : heading;
      const key = "past-" + n + "-" + sub;
      const question = afternoonId(q.year, q.part, q.number);
      const fields = fieldsByQuestion[question].filter(f => f.section === n && f.sub === sub);
      const models = (diagramsByQuestion[question] ?? []).filter(d => d.section === n && d.sub === sub);
      const group = el("div", "", "legacy-subpart");
      group.append(el("h3", label, "exam-prompt"));
      for (const src of promptsByQuestion[question][n + "-" + sub]) {
        const prompt = el("img", "", "legacy-prompt");
        prompt.src = src;
        prompt.alt = label + "の問題文（IPA問題冊子より）";
        group.append(prompt);
      }
      const grid = el("div", "", "legacy-fields");
      const fieldKeys = new Map<string, string>();
      const sheets: HTMLElement[] = [];
      for (const f of fields) {
        const id = key + "-" + f.label;
        fieldKeys.set(f.label, id);
        if (reviewing) {
          const pair = el("div", "", "legacy-comparison");
          pair.append(el("h4", f.label), el("small", "自分の答案"), schemaPreview(record.fields[id] || "未解答"),
            el("small", "IPA解答例"), schemaPreview(f.answer));
          grid.append(pair);
        } else {
          grid.append(answerField(id, f.label, record.fields[id] ?? "", value => {
            record.fields[id] = value;
            save();
            for (const panel of sheets) panel.dispatchEvent(new Event("diagram-labels"));
          }, f.control));
        }
      }
      group.append(grid);
      for (const model of models) {
        const graphKey = key + "-" + model.title;
        const nameFor = (node: string) => fieldKeys.get(node) ?? "model-name-" + graphKey + "-" + node;
        const labels = () => Object.fromEntries(model.nodes.map(([node]) =>
          [node, record.fields[nameFor(String(node))] || ""]));
        // Unlettered boxes on the original sheet are named by their position.
        for (const [node] of model.nodes) {
          if (!/^(太枠|追加)/.test(String(node)) || fieldKeys.has(String(node))) continue;
          const id = nameFor(String(node));
          if (!reviewing) grid.append(answerField(id, String(node) + "のエンティティ名", record.fields[id] || "", value => {
            record.fields[id] = value;
            save();
            for (const panel of sheets) panel.dispatchEvent(new Event("diagram-labels"));
          }, "short"));
        }
        const panel = diagram(model, record.edges[graphKey] ??= [], reviewing ? undefined : save, "sheet", labels) as HTMLElement;
        sheets.push(panel);
        group.append(panel);
        if (reviewing) {
          const solution = el("img", "", "legacy-model-answer");
          solution.src = model.solutionImage;
          solution.alt = model.title + "のIPA解答例";
          group.append(el("h4", "IPA解答例"), solution);
        }
      }
      if (q.year === 2019 && q.part === "pm1" && q.number === 3 && n === 4 && sub === 3) {
        group.append(partTree(record, save, reviewing));
      }
      if (record.fields[key]) {
        const old = el("details");
        old.append(el("summary", "以前の解答用紙に保存した答案"), el("pre", record.fields[key]));
        group.append(old);
      }
      section.append(group);
    }
    sheet.append(section);
  }
  if (reviewing) {
    const docs = [{kind:"answer", title:"IPA解答例", source:q.answer}, {kind:"comment", title:"IPA採点講評", source:q.comment}];
    for (const {kind, title, source} of docs) {
      const section = el("section");
      section.append(el("h2", title), viewer(title, base + kind + ".pdf", source, signal));
      sheet.append(section);
    }
  }
  sheet.append(link(reviewing ? "解答用紙に戻る" : "解答例・採点講評を確認する →", reviewing ? solve : solve + "/answer", "primary"));
  const paperBar = el("div", "", "paper-bar");
  paperBar.append(el("h2", "問題資料"));
  paper.append(paperBar, viewer("問題冊子", base + "question.pdf", q.paper, signal, {record, firstPage: q.firstPage, lastPage: q.lastPage}));
  layout.append(sheet, paper);
  app.replaceChildren(top, layout);
  phoneQuestion(layout, sheet, paper, reviewing);
}
