import { button, el, link } from "./dom";
import { morningInfo, type MorningPart } from "./morning-catalog";
import { expiry } from "./store";
import "./morning.css";

interface MorningQuestion {
  number: number;
  stem: string;
  figure?: string;
  choices: string[];
  answer: string;
  explanation: string;
}
interface Paper {
  source: string;
  answerSource: string;
  questions: MorningQuestion[];
}
interface Progress {
  answer: string;
  excluded: string[];
  updated: number;
}
const labels = ["ア", "イ", "ウ", "エ"];
const blank = (): Progress => ({answer: "", excluded: [], updated: 0});

// Markup comes from the bundled, reviewed exam data (tables, math, SQL and figures).
function content<K extends keyof HTMLElementTagNameMap>(tag: K, html: string, cls = "") {
  const element = el(tag, "", cls);
  element.innerHTML = html;
  return element;
}

export async function renderMorning(app: HTMLElement, year: number, part: MorningPart, signal: AbortSignal) {
  const response = await fetch("/morning/data/" + year + "-" + part + ".json", {signal});
  if (!response.ok) throw new Error("Paper unavailable");
  const paper: Paper = await response.json();
  if (signal.aborted) return;
  const count = paper.questions.length;
  const prefix = "dbsp:morning:" + year + "-" + part + ":";
  const progress = new Map<number, Progress>();
  const reviews = new Map<number, Progress>();
  let reviewing = new URLSearchParams(location.search).get("review") === "wrong";
  const active = () => reviewing ? reviews : progress;
  const reviewPrefix = prefix + "review:";
  const updateRows = new Map<number, () => void>();
  const heading = morningInfo(year, part).heading;
  const wrapper = el("div", "", "morning");
  const sheet = el("article", "", "morning-sheet");
  const index = el("details", "", "index");
  index.append(el("summary", "問題一覧"));
  const narrow = matchMedia("(max-width: 64rem)");
  index.open = !narrow.matches;
  narrow.addEventListener("change", () => { index.open = !narrow.matches; }, {signal});
  const nav = el("nav");
  nav.setAttribute("aria-label", "問題一覧");
  const notice = el("p", "", "storage-notice");
  notice.setAttribute("role", "status");
  const score = el("p");
  score.setAttribute("role", "status");
  const reviewScore = el("p");
  reviewScore.setAttribute("role", "status");
  const titleNode = el("h1", heading);
  function mistakes() {
    return paper.questions.filter(q => {
      const answer = progress.get(q.number)?.answer;
      return answer && answer !== q.answer;
    });
  }
  function setMode(value: boolean) {
    reviewing = value;
    const url = new URL(location.href);
    if (value) url.searchParams.set("review", "wrong");
    else url.searchParams.delete("review");
    url.hash = "";
    history.replaceState(null, "", url);
    titleNode.textContent = heading + (value ? "　復習" : "");
    for (const render of updateRows.values()) render();
    updateScore();
  }
  const returnButton = button("初回の結果を見る", () => {
    setMode(false);
    footer.scrollIntoView();
  });
  const retry = button("間違えた問題だけ解き直す", () => {
    const missed = mistakes();
    if (!missed.length) return;
    if (missed.every(q => reviews.get(q.number)?.answer)) {
      for (const q of missed) {
        try { localStorage.removeItem(reviewPrefix + q.number); }
        catch { notice.textContent = "復習の記録を削除できませんでした。"; }
        reviews.set(q.number, blank());
      }
    }
    setMode(true);
    const next = missed.find(q => !reviews.get(q.number)?.answer) ?? missed[0];
    const question = document.getElementById("q" + next.number)!;
    question.scrollIntoView();
    question.querySelector<HTMLElement>("h2")?.focus({preventScroll:true});
  });
  function updateScore() {
    let answered = 0, correct = 0;
    for (const q of paper.questions) {
      const answer = progress.get(q.number)?.answer;
      if (answer) answered++;
      if (answer === q.answer) correct++;
    }
    score.textContent = answered === count
      ? "初回：" + count + "問中 " + correct + "問正解　" + Number((correct * 100 / count).toFixed(1)) + "／100点"
      : "解答済み " + answered + "／" + count + "問　正解 " + correct + "問";
    const missed = mistakes();
    const done = missed.filter(q => reviews.get(q.number)?.answer);
    const hits = done.filter(q => reviews.get(q.number)?.answer === q.answer);
    if (reviewing && (answered !== count || !missed.length)) {
      setMode(false);
      return;
    }
    titleNode.textContent = heading + (reviewing ? "　復習" : "");
    returnButton.hidden = !reviewing;
    retry.hidden = answered !== count || !missed.length || (reviewing && done.length < missed.length);
    retry.textContent = done.length && done.length < missed.length ? "間違えた問題の復習を続ける" : "間違えた問題だけ解き直す";
    reviewScore.hidden = !reviewing && !done.length;
    reviewScore.textContent = "復習：" + missed.length + "問中 " + done.length + "問解答・" + hits.length + "問正解";
  }
  function readProgress(n: number, review = false) {
    const key = (review ? reviewPrefix : prefix) + n;
    let state = blank();
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const value = JSON.parse(raw);
        if (Number.isFinite(value?.updated) && expiry(value.updated) > Date.now()) {
          state = {updated: value.updated, answer: labels.includes(value.answer) ? value.answer : "",
            excluded: labels.filter(label => Array.isArray(value.excluded) && value.excluded.includes(label))};
        } else localStorage.removeItem(key);
      }
    } catch { notice.textContent = "端末の進捗を読み込めません。"; }
    (review ? reviews : progress).set(n, state);
  }
  function save(n: number, state: Progress) {
    state.updated = Date.now();
    if (!reviewing && !progress.get(n)?.answer) {
      reviews.set(n, blank());
      try { localStorage.removeItem(reviewPrefix + n); }
      catch { notice.textContent = "端末の復習記録を更新できませんでした。"; }
    }
    active().set(n, state);
    try { localStorage.setItem((reviewing ? reviewPrefix : prefix) + n, JSON.stringify(state)); }
    catch { notice.textContent = "このブラウザでは進捗を保存できません。"; }
    updateRows.get(n)!();
    updateScore();
  }
  const reset = el("button", "リセット");
  const confirm = el("div", "", "morning-confirm");
  confirm.id = "morning-reset-confirm";
  confirm.popover = "auto";
  confirm.setAttribute("role", "dialog");
  confirm.setAttribute("aria-labelledby", "morning-reset-title");
  const prompt = el("p", "この年度の" + count + "問の初回・復習の記録を消して、最初から解き直しますか？");
  prompt.id = "morning-reset-title";
  reset.popoverTargetElement = confirm;
  const cancel = button("キャンセル", () => confirm.hidePopover());
  cancel.autofocus = true;
  confirm.append(prompt, cancel, button("リセットする", () => {
    for (const [n, render] of updateRows) {
      try { localStorage.removeItem(prefix + n); localStorage.removeItem(reviewPrefix + n); }
      catch { notice.textContent = "端末に保存した進捗を削除できませんでした。"; }
      reviews.set(n, blank());
      progress.set(n, blank());
      render();
    }
    updateScore();
    confirm.hidePopover();
    reset.focus();
  }));
  function placeConfirm() {
    if (!confirm.matches(":popover-open")) return;
    const anchor = reset.getBoundingClientRect();
    confirm.style.left = Math.max(8, Math.min(anchor.left, innerWidth - confirm.offsetWidth - 8)) + "px";
    confirm.style.top = Math.max(8, Math.min(anchor.bottom + 6, innerHeight - confirm.offsetHeight - 8)) + "px";
  }
  confirm.addEventListener("toggle", placeConfirm);
  window.addEventListener("resize", placeConfirm, {signal});
  nav.addEventListener("click", () => { if (narrow.matches) index.open = false; });
  index.append(reset, confirm, notice, nav);
  const guide = el("details", "", "phone-guide phone");
  const instructions = el("p", "左の記号を押すと解答が確定します。右の文章を押すと候補から外れ、もう一度押すと戻ります。");
  guide.append(el("summary", "解答方法"), instructions.cloneNode(true));
  instructions.className = "desktop-guide";
  sheet.append(titleNode, returnButton, guide, instructions, link("採点状況を見る", "#result"));
  for (const q of paper.questions) {
    const n = q.number;
    readProgress(n);
    readProgress(n, true);
    const section = el("section");
    section.id = "q" + n;
    const title = "問" + n;
    const questionHeading = el("h2", title);
    questionHeading.tabIndex = -1;
    section.append(questionHeading, content("div", q.stem, "stem"));
    if (q.figure) {
      if (q.figure.startsWith("/morning/figures/")) {
        const image = el("img");
        image.src = q.figure;
        image.alt = title + "の図表";
        section.append(image);
      } else section.append(content("div", q.figure, "figure"));
    }
    const anchor = link(title + " ", "#" + section.id);
    const mark = el("small");
    anchor.append(mark);
    nav.append(anchor);
    const feedback = el("div", "", "feedback");
    const verdict = el("strong");
    feedback.tabIndex = -1;
    feedback.append(verdict, content("div", q.explanation));
    const rows = q.choices.map((html, i) => {
      const label = labels[i];
      const row = el("div", "", "row");
      const letter = button(label, () => {
        save(n, {...active().get(n)!, answer: label});
        feedback.focus({preventScroll:true});
        feedback.scrollIntoView({block:"nearest"});
      });
      letter.className = "letter";
      letter.setAttribute("aria-label", title + " " + label + "で解答");
      const choice = content("button", html, "choice");
      choice.onclick = () => {
        const state = active().get(n)!;
        const excluded = state.excluded.includes(label) ? state.excluded.filter(item => item !== label) : [...state.excluded, label];
        save(n, {...state, excluded});
      };
      row.append(letter, choice);
      section.append(row);
      return {label, row, letter, choice};
    });
    function render() {
      const first = progress.get(n)!.answer;
      section.hidden = reviewing && (!first || first === q.answer);
      anchor.hidden = section.hidden;
      const {answer, excluded} = active().get(n)!;
      const hit = answer === q.answer;
      const result = !answer ? "未回答" : hit ? "正解" : "不正解";
      mark.textContent = !answer ? "-" : hit ? "○" : "×";
      anchor.className = !answer ? "" : hit ? "right" : "wrong";
      anchor.setAttribute("aria-label", title + " " + result);
      for (const {label, row, letter, choice} of rows) {
        const omitted = excluded.includes(label) && !(answer && label === q.answer);
        row.classList.toggle("excluded", omitted);
        row.classList.toggle("right", !!answer && label === q.answer);
        row.classList.toggle("wrong", answer === label && !hit);
        letter.disabled = !!answer || omitted;
        choice.disabled = !!answer;
        choice.setAttribute("aria-pressed", String(omitted));
        choice.setAttribute("aria-label", label + (omitted ? "を候補に戻す：" : "を候補から外す：") + choice.textContent);
      }
      feedback.hidden = !answer;
      verdict.textContent = answer ? result + "　あなたの解答：" + answer + "　正答：" + q.answer : "";
    }
    updateRows.set(n, render);
    render();
    section.append(feedback);
    sheet.append(section);
  }
  function refresh(n: number) {
    if (!updateRows.has(n)) return;
    readProgress(n);
    readProgress(n, true);
    updateRows.get(n)?.();
  }
  window.addEventListener("storage", event => {
    if (event.key === null) for (const n of updateRows.keys()) refresh(n);
    else if (event.key.startsWith(reviewPrefix)) refresh(Number(event.key.slice(reviewPrefix.length)));
    else if (event.key.startsWith(prefix)) refresh(Number(event.key.slice(prefix.length)));
    updateScore();
  }, {signal});
  const footer = el("footer");
  footer.id = "result";
  footer.append(el("h2", "採点結果"), score, reviewScore, retry, el("p", "進捗はこのブラウザに、各問の最終変更から6か月間保存されます。"),
    el("p", "出典：IPA " + (part === "am1" ? "高度試験共通 " : "データベーススペシャリスト試験 ") + heading + " 問1〜" + count + "。図表と選択肢の配置を演習用に整えています。解説は本教材用に作成しました。"),
    link("公式問題冊子", paper.source), document.createTextNode("　"), link("公式解答例", paper.answerSource));
  sheet.append(footer);
  // Keep each value beside its column heading when a wide table folds into rows.
  for (const table of sheet.querySelectorAll("table")) {
    const headers = table.tHead?.rows;
    if (headers?.length !== 1 || headers[0].cells.length < 6) continue;
    const rows = Array.from(table.tBodies).flatMap(body => Array.from(body.rows));
    if (!rows.every(row => row.cells.length === headers[0].cells.length && Array.from(row.cells).every(cell => cell.colSpan === 1 && cell.rowSpan === 1))) continue;
    table.classList.add("fold-table");
    for (const row of rows) for (const cell of row.cells)
      cell.dataset.column = headers[0].cells[cell.cellIndex].textContent;
  }
  updateScore();
  wrapper.append(sheet, index);
  app.replaceChildren(wrapper);
  app.dataset.morning = location.pathname;
  const target = document.getElementById(location.hash.slice(1));
  if (target && sheet.contains(target)) target.scrollIntoView();
  else window.scrollTo(0, 0);
}
