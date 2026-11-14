import { morningName, morningParts, morningTerm, morningYears } from "./morning-catalog";
import { afternoonId, pastPapers } from "./past-papers";
import { questionPath } from "./routes";
import { el, link } from "./dom";

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
  const entries = new Map<string, {year: number; title: string; paper: string; anchor: HTMLAnchorElement; session: HTMLDetailsElement; group: HTMLDetailsElement}>();
  const morningLinks = new Map<string, HTMLAnchorElement>();
  const homeLink = link("", "/", "library-home");
  const homeIcon = document.querySelector("header .brand svg")!.cloneNode(true);
  homeLink.append(homeIcon, el("span", "ホーム"));
  homeLink.onclick = () => { if (mobile.matches) setOpen(false); };
  nav.append(homeLink);
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
      const group = el("details", "", "question-group");
      group.append(el("summary", "問" + q));
      for (const year of morningYears) {
        const id = afternoonId(year, "pm" + pm, q);
        const ready = availableIds.has(id);
        const anchor = link(year + "年度", questionPath(id), "year-link");
        anchor.append(el("small", ready ? "演習" : "冊子"));
        anchor.onclick = () => { if (mobile.matches) { setOpen(false); toggle.focus(); } };
        group.append(anchor);
        const paper = pastPapers.get(id)?.paper ?? "";
        entries.set(id, {year, title: name + "　問" + q, paper, anchor, session, group});
      }
      session.append(group);
    }
    nav.append(session);
  }
  const pdfLink = link("PDF", "/pdf", "library-pdf");
  pdfLink.onclick = () => { if (mobile.matches) setOpen(false); };
  const contactLink = link("問い合わせ先", "/contact", "library-pdf library-contact");
  contactLink.onclick = () => { if (mobile.matches) setOpen(false); };
  nav.append(pdfLink, contactLink);
  return {
    select(id: string) {
      const path = location.pathname.replace(/\/$/, "");
      if (path === "") homeLink.setAttribute("aria-current", "page");
      else homeLink.removeAttribute("aria-current");
      if (path === "/contact") contactLink.setAttribute("aria-current", "page");
      else contactLink.removeAttribute("aria-current");
      if (location.pathname.replace(/\/$/, "") === "/pdf") pdfLink.setAttribute("aria-current", "page");
      else pdfLink.removeAttribute("aria-current");
      for (const [path, anchor] of morningLinks) {
        if (path === location.pathname.replace(/\/$/, "")) {
          anchor.setAttribute("aria-current", "page");
          anchor.closest("details")!.open = true;
        } else anchor.removeAttribute("aria-current");
      }
      for (const entry of entries.values()) entry.anchor.removeAttribute("aria-current");
      const entry = path === "/contact" || path === "/pdf" ? undefined : entries.get(id);
      if (entry) {
        entry.session.open = true;
        entry.group.open = true;
        entry.anchor.setAttribute("aria-current", "page");
      }
      return entry;
    }
  };
}
