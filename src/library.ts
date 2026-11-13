import { morningName, morningParts, morningTerm, morningYears } from "./morning-catalog";
import { questionPath } from "./routes";
import { el, link } from "./dom";

const archives = [
  [2025, "nl10bi0000009lh8"],
  [2024, "m42obm000000afqx"],
  [2023, "ps6vr70000010d6y"],
  [2022, "gmcbt80000008smf"],
  [2021, "gmcbt8000000apad"],
] as const;

export function library(availableIds: Set<string>, signal: AbortSignal) {
  const nav = el("nav", "", "library-nav");
  nav.id = "library-nav";
  nav.setAttribute("aria-label", "区分・問番号・年度から選ぶ");
  const panel = document.querySelector<HTMLElement>(".library-panel")!;
  const toggle = document.querySelector<HTMLButtonElement>("#library-toggle")!;
  const mobile = matchMedia("(max-width: 760px)");
  function setOpen(open: boolean) {
    nav.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    toggle.title = open ? "サイドバーを閉じる" : "サイドバーを開く";
    toggle.setAttribute("aria-label", toggle.title);
  }
  setOpen(!mobile.matches);
  toggle.onclick = () => setOpen(nav.hidden);
  mobile.addEventListener("change", () => setOpen(!mobile.matches), {signal});
  panel.append(nav);
  signal.addEventListener("abort", () => nav.remove(), {once: true});
  const entries = new Map<string, {year: number; title: string; paper: string; anchor: HTMLAnchorElement; session: HTMLDetailsElement}>();
  const morningLinks = new Map<string, HTMLAnchorElement>();
  for (const part of morningParts) {
    const session = el("details", "", "session");
    session.append(el("summary", morningName(part)));
    for (const year of morningYears) {
      const path = "/" + year + "/" + part;
      const anchor = link(year + "年度", path, "year-link");
      anchor.append(el("small", morningTerm(year)));
      anchor.onclick = () => { if (mobile.matches) setOpen(false); };
      morningLinks.set(path, anchor);
      session.append(anchor);
    }
    nav.append(session);
  }
  for (const pm of [1, 2]) {
    const name = pm === 1 ? "午後Ⅰ" : "午後Ⅱ";
    const session = el("details", "", "session");
    session.open = pm === 1 && !morningLinks.has(location.pathname.replace(/\/$/, ""));
    session.append(el("summary", name));
    for (let q = 1; q <= (pm === 1 ? 3 : 2); q++) {
      const group = el("section", "", "question-group");
      group.append(el("h2", "問" + q));
      for (const [year, dir] of archives) {
        const id = year + "-autumn-db-pm" + pm + "-q" + q;
        const ready = availableIds.has(id);
        const anchor = link(year + "年度", questionPath(id), "year-link");
        anchor.append(el("small", ready ? "演習" : "冊子"));
        anchor.onclick = () => { if (mobile.matches) { setOpen(false); toggle.focus(); } };
        group.append(anchor);
        const paper = "https://www.ipa.go.jp/shiken/mondai-kaiotu/" + dir + "-att/" + year + "r0" + (year-2018) + "a_db_pm" + pm + "_qs.pdf";
        entries.set(id, {year, title: name + "　問" + q, paper, anchor, session});
      }
      session.append(group);
    }
    nav.append(session);
  }
  return {
    select(id: string) {
      for (const [path, anchor] of morningLinks) {
        if (path === location.pathname.replace(/\/$/, "")) {
          anchor.setAttribute("aria-current", "page");
          anchor.closest("details")!.open = true;
        } else anchor.removeAttribute("aria-current");
      }
      for (const entry of entries.values()) entry.anchor.removeAttribute("aria-current");
      const entry = entries.get(id);
      if (entry) {
        entry.session.open = true;
        entry.anchor.setAttribute("aria-current", "page");
      }
      return entry;
    }
  };
}
