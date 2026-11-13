import { questionReset } from "./question-reset";
import { setupPhone, phoneQuestion, resetPhone, morningIndex } from "./phone";
import { circleTable } from "./circle-table";
import { partTree, treeAnswer } from "./part-tree";
import { pastAnswerHistory, pastNotesText } from "./past-paper-history";
import { morningInfo, morningTerm, morningRoute } from "./morning-catalog";
import { enablePaperHighlights } from "./paper-highlights";
import { questionPath, resolveRoute } from "./routes";
import { schemaControls, schemaPreview } from "./schema-input";
import { answerField } from "./answer-field";
import { materials, bookletText, figureReferences, showPaperTarget, showFigure } from "./booklet";
import "./style.css";
import { library } from "./library";
import { button, el, link } from "./dom";
import { sectionScores } from "./review-scores";
import { diagram } from "./diagram";
import { empty, read, type Edge } from "./store";
import type { Question } from "./exam";

import { origin, pageInfo, questionTitles } from "./seo";
const archiveModules = import.meta.glob<{default: Question}>("./archive/*.json");

const app = document.querySelector<HTMLElement>("#app")!;
const exercises = new Map<string, () => Promise<{default: Question}>>([
  ["2025-autumn-db-pm1-q1", () => import("./university")],
  ["2025-autumn-db-pm1-q2", () => import("./question.json")],
  ["2025-autumn-db-pm1-q3", () => import("./inventory")],
]);
for (const id of Object.keys(questionTitles)) {
  if (!exercises.has(id)) exercises.set(id, archiveModules["./archive/" + id + ".json"]);
}
function sessionName(id: string) {
  return id.includes("-pm2-") ? "午後Ⅱ" : "午後Ⅰ";
}
function diagramSlots(q: Question, section: number) {
  return q.diagrams.map((model, index) => ({model, index})).filter(slot => slot.model.section === section)
    .map((slot, order) => ({...slot, key: slot.model.storageKey ?? (order === 0 ? String(section) : section + ":" + slot.index)}));
}
function examTerm(id: string) {
  const year = Number(id.slice(0, 4));
  const era = year < 2020 ? "平成" + (year - 1988) : "令和" + (year - 2018);
  return era + "年度 " + morningTerm(year);
}
const lifetime = new AbortController();
const navigatorTree = library(new Set(Object.keys(questionTitles)), lifetime.signal);
setupPhone(lifetime.signal);
const unsaved: Map<string, ReturnType<typeof empty>> = import.meta.hot?.data.unsaved ?? new Map();
let key = "";
const status = el("span", "", "status");
status.setAttribute("role", "status");
let record = empty();
function restore(id: string) {
  key = "dbsp:v1:" + id;
  try {
    record = unsaved.get(key) ?? read(key);
    status.textContent = unsaved.has(key) ? "端末に未保存" : record.updated ? "保存済み" : "未解答";
  } catch {
    record = empty();
    status.textContent = "端末の記録を読み込めません";
  }
}
function save() {
  record.updated = Date.now();
  try {
    localStorage.setItem(key, JSON.stringify(record));
    unsaved.delete(key);
    status.textContent = "この端末に保存済み";
  } catch {
    unsaved.set(key, record);
    status.textContent = "保存できません。この画面で答案をコピーしてください";
  }
}

function exportText(q: Question, withAnswer: boolean, section: number) {
  const blocks = [
    "# " + q.source + "　" + q.title,
    "相談範囲：" + (section ? q.sections[section - 1].heading : "大問全体"),
    withAnswer
      ? "自分の答案とIPA解答例を照合し、正しく答えた点、改善点、本文の根拠を小問ごとに教えてください。得点を示す場合は推定としてください。"
      : "自分の答案を踏まえ、答えを明かさずに、次に確認する本文・図表と考え方のヒントをください。",
    "予想配点は当サイト独自の推定です。まとめて配点した欄は一組として扱ってください。",
    "出典：" + q.paper,
    "## 問題",
    bookletText(q),
    "凡例：1対多では始点が1、終点が多。1対1では両端が1。サブタイプでは始点がスーパータイプ、終点がサブタイプ。PKは主キー、FKは外部キー。",
  ];
  const graph = (lines: string[][]) =>
    JSON.stringify(
      lines.map(([始点, 終点, 関係]) => ({ 始点, 終点, 関係 })),
      null,
      2,
    );
  q.sections.forEach((s, i) => {
    const n = i + 1;
    if (section && n !== section) return;
    blocks.push("## " + s.heading);
    const fields = new Map(s.fields.map(field => [field[0], field]));
    const slots = diagramSlots(q, n);
    const diagrams = new Map(slots.map(slot => ["diagram:" + slot.index, slot]));
    const prompts = new Map(s.prompts.map(prompt => [
      prompt.before === "diagram" ? "diagram:" + slots[0]?.index : prompt.before, prompt.lines,
    ]));
    let heading = "";
    for (const [id, score] of sectionScores(q.id, i, s.heading)) {
      if (heading !== score.heading) {
        heading = score.heading;
        blocks.push("### " + heading);
      }
      const prompt = prompts.get(id);
      if (prompt) blocks.push(prompt.join("\n"));
      const { ids, points } = score.item;
      if (id === ids[0]) {
        const names = ids.map(key => diagrams.get(key)?.model.title ?? fields.get(key)![1]);
        blocks.push(names.join("・") + "｜予想配点 " + (ids.length > 1 ? "計" : "") + points + "点");
      }
      const slot = diagrams.get(id);
      if (slot) {
        const d = slot.model;
        blocks.push(
          "エンティティ：" + d.nodes.map(v => v[0]).join("、"),
          "問題で与えられた関係：\n" + graph(d.fixed),
          "自分が追加した関係：\n" + (record.edges[slot.key]?.length ? graph(record.edges[slot.key]) : "未解答"),
        );
        const ownNames = Object.entries(d.nodeFields ?? {}).filter(([, key]) => record.fields[key]?.trim());
        if (ownNames.length) blocks.push("自分が記入したエンティティ名：" + JSON.stringify(Object.fromEntries(ownNames.map(([node,key]) => [node, record.fields[key]]))));
        if (withAnswer) {
          if (d.solutionLabels) blocks.push("IPA解答例のエンティティ名：" + JSON.stringify(d.solutionLabels));
          blocks.push("IPA解答例の追加関係：\n" + graph(d.answer));
        }
      } else {
        const [, label, answer] = fields.get(id)!;
        const own = id === "deadlock-case2" ? treeAnswer(record) : record.fields[id]?.trim();
        blocks.push(label + "の答案：" + (own || "未解答"));
        if (withAnswer) blocks.push("IPA解答例（表記を変換）：" + (id === "deadlock-case2" ? treeAnswer(record, true) : answer));
      }
    }
  });
  blocks.push(...pastNotesText(record, section));
  if (withAnswer) blocks.push("解答例の出典：" + q.solution);
  return blocks.join("\n\n");
}
function copyBox(q: Question, withAnswer: boolean) {
  const area = el("div", "", "copybox"),
    scope = el("select");
  scope.setAttribute("aria-label", "コピーする範囲");
  scope.add(new Option("大問全体", "0"));
  q.sections.forEach((_, i) =>
    scope.add(new Option("設問" + (i + 1), String(i + 1))),
  );
  const result = el("div");
  result.setAttribute("role", "status");
  area.append(
    scope,
    button(
      "相談用にコピー",
      async () => {
        const value = exportText(q, withAnswer, Number(scope.value));
        try {
          await navigator.clipboard.writeText(value);
          result.textContent = "コピーしました。お使いのAIに貼り付けてください。";
        } catch {
          const t = el("textarea");
          t.readOnly = true;
          t.value = value;
          t.setAttribute("aria-label", "コピー用テキスト");
          result.replaceChildren("テキストを選択してコピーしてください。", t);
          t.select();
        }
      },
    ),
    result,
  );
  return area;
}
function renderQuestion(q: Question, reviewing: boolean) {
  const solve = questionPath(q.id), review = solve + "/answer";
  const top = el("div", "", "question-top");
  const nav = el("nav", "", "breadcrumbs");
  nav.setAttribute("aria-label", "パンくずリスト");
  nav.append(link("問題一覧", "/"));
  for (const item of [el("span", examTerm(q.id)), el("span", sessionName(q.id)), el("span", "問" + q.id.slice(-1)), el("h1", q.title)]) {
    const separator = el("span", "/");
    separator.setAttribute("aria-hidden", "true");
    nav.append(separator, item);
  }
  nav.lastElementChild?.setAttribute("aria-current", "page");
  top.append(nav, status);
  const tabs = el("div", "", "tabs");
  tabs.append(
    link("解答する", solve, reviewing ? "" : "active"),
    link("解説を見る", review, reviewing ? "active" : ""),
  );
  tabs.children[reviewing ? 1 : 0].setAttribute("aria-current", "page");
  const layout = el("div", "", "layout"),
    sheet = el("article", "", "card");
  app.replaceChildren(top, layout);
  const evidence = new Map<string, string>();
  // Preserve existing links to the first passage of each explanation.
  q.explanations?.forEach((item, i) => evidence.set(item.quotes[0], String(i + 1)));
  q.explanations?.forEach((item, i) => item.quotes.forEach((quote, j) => {
    if (!evidence.has(quote)) evidence.set(quote, (i + 1) + "-" + (j + 1));
  }));
  const booklet = materials(q, reviewing, evidence);
  layout.append(sheet, booklet);
  if (!reviewing) enablePaperHighlights(booklet.querySelector<HTMLElement>(".paper-viewport")!, record.highlights, save);
  const heading = el("div", "", "sheet-heading");
  const original = link("解答例原本 ↗", q.solution);
  original.target = "_blank";
  original.rel = "noopener";
  const bar = el("div", "", "paper-bar");
  bar.append(el("h2", reviewing ? "解説と答え合わせ" : "解答用紙"), tabs, original);
  if (reviewing && q.comment) {
    const commentary = link("IPA採点講評 ↗", q.comment);
    commentary.target = "_blank";
    commentary.rel = "noopener";
    bar.append(commentary);
  }
  heading.append(bar);
  sheet.append(heading);
  if (reviewing) {
    const toggle = el("input");
    toggle.type = "checkbox";
    toggle.onchange = () => sheet.classList.toggle("show-own-answers", toggle.checked);
    const label = el("label", "", "review-toggle");
    label.append(toggle, "自分の答案を表示");
    tabs.before(label);
    sheet.append(el("p", "予想配点は当サイト独自の推定です。自己採点の目安としてお使いください。", "score-note"), copyBox(q, reviewing));
  }
  const labelRefresh = new Map<string, (() => void)[]>();
  const modelAnswers = Object.fromEntries(q.sections.flatMap(s => s.fields.map(([k, , answer]) => [k, answer])));
  for (const [i, s] of q.sections.entries()) {
    const n = i + 1,
      part = el("section");
    const title = el("h2");
    title.append(figureReferences(s.heading, q));
    part.append(title);
    const scores = reviewing ? sectionScores(q.id, i, s.heading) : undefined;
    const shownHeadings = new Set<string>();
    function appendScoreHeading(id: string) {
      const score = scores?.get(id);
      if (score && !shownHeadings.has(score.heading)) {
        part.append(el("h3", score.heading, "score-heading"));
        shownHeadings.add(score.heading);
      }
    }
    function appendScoreCell(row: HTMLTableRowElement, id: string) {
      const { item } = scores!.get(id)!;
      if (id !== item.ids[0]) return;
      const cell = row.insertCell();
      cell.rowSpan = item.ids.length;
      cell.className = "score-cell";
      cell.textContent = (item.ids.length > 1 ? "計" : "") + item.points + "点";
    }
    function appendPrompt(before: string) {
      const prompt = s.prompts.find(group => group.before === before);
      for (const line of prompt?.lines ?? []) {
        const paragraph = el("p", "", "exam-prompt");
        paragraph.append(figureReferences(line, q));
        part.append(paragraph);
      }
    }
    function appendExplanation(before: string) {
      if (!reviewing) return;
      q.explanations?.forEach(item => {
        if (item.before !== before || (item.section !== undefined && item.section !== n)) return;
        const box = el("div", "", "answer-explanation");
        const paragraph = el("p");
        const runs = item.text.split(/\*\*(.+?)\*\*/g);
        for (const [i, text] of runs.entries()) {
          const run = figureReferences(text, q, runs.slice(i + 1).join(""));
          if (i % 2) {
            const strong = el("strong");
            strong.append(run);
            paragraph.append(strong);
          } else paragraph.append(run);
        }
        box.append(el("h3", item.title), paragraph);
        for (const quote of item.quotes) {
          const number = evidence.get(quote)!;
          const anchor = link("本文「" + quote + "」", location.pathname + "?evidence=" + number);
          anchor.onclick = event => {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            showPaperTarget("paper-evidence-" + number);
          };
          box.append(anchor);
        }
        part.append(box);
      });
    }
    const slots = diagramSlots(q, n);
    const drawn = new Set<number>();
    function appendDiagram(slot: typeof slots[number], before: string) {
      if (drawn.has(slot.index)) return;
      drawn.add(slot.index);
      const scoreId = "diagram:" + slot.index;
      appendScoreHeading(scoreId);
      appendPrompt(before);
      appendExplanation(before);
      const d = slot.model;
      const added = (record.edges[slot.key] ??= []);
      function labels(values: Record<string, string>) {
        return Object.fromEntries(Object.entries(d.nodeFields ?? {}).map(([node, field]) => [node, values[field]?.trim() || node]));
      }

      const panel = diagram(d, added, reviewing ? undefined : save, "sheet", () => labels(record.fields));
      if (reviewing) {
        const own = el("div", "", "own-answer");
        own.append(el("h3", "自分の答案" + (added.length ? "" : "（未解答）")), panel);
        part.append(own);
      } else part.append(panel);
      for (const field of Object.values(d.nodeFields ?? {})) {
        const hooks = labelRefresh.get(field) ?? [];
        hooks.push(() => panel.dispatchEvent(new Event("diagram-labels")));
        labelRefresh.set(field, hooks);
      }
      if (scores) {
        const points = scores.get(scoreId)!.item.points;
        part.append(
          el("h3", "IPA 解答例"),
          diagram(d, d.answer as Edge[], undefined, "solution", () => labels(modelAnswers), points),
        );
      }
    }
    // Keep diagrams beside their own prompt, including consecutive diagrams
    // and diagrams whose section has no following text field.
    function diagramsBefore(next?: string) {
      for (const [index, prompt] of s.prompts.entries()) {
        if (!/^diagram(?::\d+)?$/.test(prompt.before)) continue;
        const following = s.prompts.slice(index + 1).find(p => !p.before.startsWith("diagram"));
        if (following?.before !== next) continue;
        const slot = prompt.before === "diagram" ? slots[0] : slots.find(d => d.index === Number(prompt.before.slice(8)));
        if (slot) appendDiagram(slot, prompt.before);
      }
    }
    const circles = reviewing ? undefined : circleTable(q, s.fields, record.fields, (key, value) => {
      record.fields[key] = value;
      save();
    });
    let shared: ReturnType<typeof schemaControls> | undefined;
    for (const [k, label, answer] of s.fields) {
      diagramsBefore(k);
      appendScoreHeading(k);
      appendPrompt(k);
      appendExplanation(k);
      if (circles?.keys.has(k)) {
        if (k === circles.first) part.append(circles.element);
        continue;
      }
      if (k === "deadlock-case2") {
        if (scores) part.append(el("p", "予想配点 " + scores.get(k)!.item.points + "点", "score-note"));
        part.append(partTree(record, save, reviewing));
        continue;
      }
      const singleAnswer = k === "1-1" || k === "1-2a" || k === "3-2";
      if (reviewing) {
        let table = part.lastElementChild;
        if (!(table instanceof HTMLTableElement) || !table.classList.contains("field-answers")) {
          const answers = el("table", "", "review-answers field-answers");
          const header = answers.createTHead().insertRow();
          header.append(el("th", "解答欄"), el("th", "IPA 解答例"), el("th", "予想配点", "score-cell"), el("th", "自分の答案", "own-answer"));
          answers.createTBody();
          part.append(answers);
          table = answers;
        }
        const row = (table as HTMLTableElement).tBodies[0].insertRow();
        const name = el("th", singleAnswer ? "解答" : label);
        name.scope = "row";
        row.append(name);
        row.insertCell().append(schemaPreview(answer, "model"));
        appendScoreCell(row, k);
        const own = row.insertCell();
        own.className = "own-answer";
        const value = record.fields[k]?.trim() || "未解答";
        const schema = q.controls?.[k] === "schema" || k === "1-2s" || k === "3-2" || k.startsWith("2-");
        own.append(schema ? schemaPreview(value) : el("pre", value));
      } else {
        const control = q.controls?.[k];
        const compactSchema = control === "schema" || k.startsWith("2-");
        let container: Element = part;
        if (compactSchema || control === "short" || control === "step" || control === "step5" || Array.isArray(control)) {
          const gridClass = compactSchema ? "schema-answers" : "short-answers";
          let grid = part.lastElementChild;
          if (!grid?.classList.contains(gridClass)) {
            grid = el("div", "", gridClass);
            if (compactSchema) {
              shared = schemaControls(grid as HTMLElement, k);
              grid.append(shared.hint, el("div", "", "schema-fields"), shared.toolbar());
            }
            part.append(grid);
          }
          container = compactSchema ? grid.querySelector(".schema-fields")! : grid;
        }
        const field = answerField(k, singleAnswer ? "" : label, record.fields[k] ?? "", (value) => {
          record.fields[k] = value;
          labelRefresh.get(k)?.forEach(refresh => refresh());
          save();
        }, control, compactSchema ? shared : undefined);
        if (singleAnswer) field.querySelector("input, textarea, select")?.setAttribute("aria-label", label);
        container.append(field);
      }
    }
    diagramsBefore();
    for (const slot of slots) if (!drawn.has(slot.index)) appendDiagram(slot, "diagram:" + slot.index);
    if (reviewing && !q.explanations) part.append(el("h3", "考え方"), el("p", s.note));
    sheet.append(part);
  }
  sheet.append(el("h2", "AIに相談する"), copyBox(q, reviewing));
  phoneQuestion(layout, sheet, booklet, reviewing);
  if (!reviewing) sheet.append(link("解説と答え合わせへ →", review, "primary"));
}
let morningLifetime: AbortController | undefined;
async function route() {
  resetPhone();
  delete app.dataset.morning;
  morningLifetime?.abort();
  const morning = morningRoute(location.pathname);
  const {id, reviewing} = resolveRoute();
  const page = morning ? morningInfo(morning.year, morning.part) : pageInfo(id, reviewing);
  document.title = page.title;
  document.querySelector('meta[name="description"]')?.setAttribute("content", page.description);
  document.querySelector('meta[property="og:title"]')?.setAttribute("content", page.title);
  document.querySelector('meta[property="og:description"]')?.setAttribute("content", page.description);
  document.querySelector('meta[property="og:url"]')?.setAttribute("content", origin + page.path);
  document.querySelector('link[rel="canonical"]')?.setAttribute("href", origin + page.path);
  const requested = location.href;
  const entry = navigatorTree.select(id);
  const exercise = exercises.get(id);
  if (morning) {
    const controller = new AbortController();
    morningLifetime = controller;
    const signal = AbortSignal.any([controller.signal, lifetime.signal]);
    app.replaceChildren(el("p", "問題を読み込み中…"));
    try {
      const {renderMorning} = await import("./morning");
      await renderMorning(app, morning.year, morning.part, signal);
      if (!signal.aborted) morningIndex(app);
    } catch {
      if (!signal.aborted) app.replaceChildren(el("p", "問題を読み込めませんでした。"), button("再読み込み", () => void route()));
    }
    return;
  }
  if (exercise) {
    const { default: q } = await exercise();
    if (lifetime.signal.aborted || location.href !== requested) return;
    restore(id);
    renderQuestion(q, reviewing);
    const history = pastAnswerHistory(id, record);
    if (history) app.querySelector(".layout > article")?.append(history);
  } else if (entry) {
    const card = el("article", "", "card catalog");
    const source = link("IPAの問題冊子を開く ↗", entry.paper, "primary");
    source.target = "_blank";
    source.rel = "noopener";
    card.append(el("h2", "問題冊子"), el("p", "この問題の解答画面は未収録です。公式の問題冊子で " + entry.title + " を参照できます。"), source);
    app.replaceChildren(el("small", entry.year + "年度 " + morningTerm(entry.year), "eyebrow"), el("h1", entry.title), card);
  } else {
    app.replaceChildren(
      el("h1", page.heading),
      el("p", page.description),
      el("p", "左の一覧から区分と年度を選んでください。午前は年度ごとに、午後は大問ごとに演習できます。"),
    );
  }
  const top = app.querySelector(".question-top");
  if (top) {
    const year = Number(id.slice(0, 4));
    const label = year + "年度 " + morningTerm(year) + " " + sessionName(id) + " 問" + id.slice(-1);
    top.append(questionReset(label, () => {
      try {
        localStorage.removeItem(key);
      } catch {
        status.textContent = "端末に保存した答案を削除できませんでした";
        return;
      }
      unsaved.delete(key);
      const solve = questionPath(id);
      if (location.pathname !== solve || location.search) history.replaceState(null, "", solve);
      void route();
    }));
  }
  window.scrollTo(0, 0);
  const params = new URLSearchParams(location.search);
  if (params.has("figure")) showFigure(Number(params.get("figure")), params.getAll("part"));
  if (params.has("evidence")) showPaperTarget("paper-evidence-" + params.get("evidence"));
}
document.addEventListener("click", event => {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const anchor = event.target instanceof Element ? event.target.closest("a") : null;
  if (!anchor || anchor.target || anchor.hasAttribute("download") || anchor.origin !== location.origin) return;
  if (app.dataset.morning && anchor.hash && anchor.pathname === location.pathname && anchor.search === location.search) return;
  event.preventDefault();
  if (anchor.href !== location.href) history.pushState(null, "", anchor.href);
  void route();
}, {signal: lifetime.signal});
window.addEventListener("popstate", () => { if (app.dataset.morning !== location.pathname) void route(); }, {signal: lifetime.signal});
if (import.meta.hot) {
  import.meta.hot.accept();
  import.meta.hot.dispose(data => {
    data.unsaved = unsaved;
    lifetime.abort();
  });
}
void route();
