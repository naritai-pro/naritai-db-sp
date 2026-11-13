import {el, link} from "./dom";
import type {RecordData} from "./store";
import {pastPapers} from "./past-papers";

function notes(record: RecordData, section?: number) {
  return Object.entries(record.fields).flatMap(([key, value]) => {
    const match = /^past-(\d+)-(\d+)$/.exec(key);
    if (!match || !value.trim() || (section && (Number(match[1]) || 1) !== section)) return [];
    const name = (match[1] === "0" ? "設問" : "設問" + match[1]) + (match[2] === "0" ? "" : "（" + match[2] + "）");
    return [{name, value}];
  });
}

export function pastNotesText(record: RecordData, section?: number) {
  return notes(record, section).map(({name,value}) => name + "の旧答案：" + value);
}

export function pastAnswerHistory(id: string, record: RecordData) {
  const original = pastPapers.get(id);
  if (!original) return;
  const oldNotes = notes(record);
  const pages = Object.entries(record.strokes ?? {}).filter(([page, strokes]) => /^\d+$/.test(page) && strokes.some(s => s.length));
  if (!pages.length && !oldNotes.length) return;
  const history = el("details", "", "past-answer-history");
  history.append(el("summary", "以前の解答用紙に保存した答案"));
  for (const {name,value} of oldNotes) history.append(el("h3", name), el("pre", value));
  for (const [page, strokes] of pages) {
    const offset = Number(page) - 1;
    const originalPage = original.firstPage + offset;
    const isRule = originalPage > original.lastPage;
    const pageNo = isRule ? originalPage - original.lastPage + 2 : originalPage;
    const source = link("IPA原本 p." + pageNo + " ↗", original.paper.replace(/#.*$/, "") + "#page=" + pageNo);
    source.target = "_blank";
    source.rel = "noopener";
    const caption = el("figcaption", "以前の書き込み（" + (isRule ? "表記ルール" : "問題冊子") + " p." + pageNo + "） ");
    caption.append(source);
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 600 848");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", caption.textContent);
    for (const points of strokes) {
      const line = document.createElementNS(ns, "polyline");
      line.setAttribute("points", points.map(([x,y]) => x * 600 + "," + y * 848).join(" "));
      line.setAttribute("fill", "none");
      line.setAttribute("stroke", "#008254");
      line.setAttribute("stroke-width", "2");
      line.setAttribute("stroke-linecap", "round");
      svg.append(line);
    }
    const figure = el("figure");
    figure.append(caption, svg);
    history.append(figure);
  }
  return history;
}
