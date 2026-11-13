import {button, el} from "./dom";

const phone = matchMedia("(max-width: 760px)");
const indexButton = document.querySelector<HTMLButtonElement>("#phone-index")!;
let dismiss: (() => void) | undefined;

// Borrow existing controls so progress, handlers and diagram editing stay live.
function panel(title: string, side: string, content: HTMLElement, restore?: () => void) {
  dismiss?.();
  const dialog = el("dialog", "", "phone-panel " + side);
  dialog.setAttribute("aria-label", title);
  const bar = el("div", "", "panel-title");
  function close() {
    dialog.close();
    restore?.();
    dialog.remove();
    dismiss = undefined;
  }
  bar.append(el("strong", title), button("閉じる", close));
  dialog.append(bar, content);
  dialog.oncancel = e => { e.preventDefault(); close(); };
  dialog.onclick = e => {
    const r = dialog.getBoundingClientRect();
    if (e.target === dialog && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)) close();
  };
  document.body.append(dialog);
  dialog.showModal();
  dismiss = close;
}
function borrow(node: HTMLElement, title: string, side: string) {
  const marker = document.createComment("");
  node.before(marker);
  const hidden = node.hidden;
  const open = node instanceof HTMLDetailsElement && node.open;
  node.hidden = false;
  if (node instanceof HTMLDetailsElement) node.open = true;
  panel(title, side, node, () => {
    marker.replaceWith(node);
    node.hidden = hidden;
    if (node instanceof HTMLDetailsElement) node.open = open;
  });
}
export function setupPhone(signal: AbortSignal) {
  document.querySelector<HTMLButtonElement>("#phone-library")!.onclick = () =>
    borrow(document.querySelector(".library-nav")!, "年度・試験を選ぶ", "drawer");
  document.addEventListener("click", e => {
    if (e.target instanceof Element && e.target.closest(".phone-panel a")) dismiss?.();
  }, {capture:true, signal});
  phone.addEventListener("change", () => dismiss?.(), {signal});
  signal.addEventListener("abort", resetPhone);
}
export function resetPhone() {
  dismiss?.();
  indexButton.hidden = true;
  indexButton.onclick = null;
}
export function morningIndex(app: HTMLElement) {
  const index = app.querySelector<HTMLElement>(".index")!;
  indexButton.hidden = false;
  indexButton.onclick = () => borrow(index, "問題一覧", "bottom morning");
}
export function phoneQuestion(layout: HTMLElement, sheet: HTMLElement, paper: HTMLElement, review: boolean) {
  const tools = el("div", "", "phone phone-tools");
  const positions = {paper:0, sheet:0};
  let active: keyof typeof positions = review ? "sheet" : "paper";
  function select(key: typeof active) {
    if (!phone.matches) return;
    if (active !== key) {
      positions[active] = window.scrollY;
      active = key;
      render();
      window.scrollTo(0, positions[active]);
    }
  }
  const first = button("問題資料", () => select("paper"));
  const second = button(review ? "解説" : "解答用紙", () => select("sheet"));
  const more = button("その他", () => {
    const items = el("div", "", "jump-list");
    for (const a of layout.querySelectorAll<HTMLAnchorElement>(".paper-bar a:not(.active)")) items.append(a.cloneNode(true));
    panel("その他", "bottom", items);
  });
  function render() {
    layout.dataset.pane = active;
    first.setAttribute("aria-pressed", String(active === "paper"));
    second.setAttribute("aria-pressed", String(active === "sheet"));
  }
  tools.append(first, second, more);
  layout.before(tools);
  render();
  paper.addEventListener("reveal-paper", () => select("paper"));
  indexButton.hidden = false;
  indexButton.onclick = () => {
    const list = el("div", "", "jump-list");
    for (const [title, pane, nodes] of [
      ["設問・小問", "sheet", sheet.querySelectorAll("section > h2, .exam-prompt, .score-heading")],
      ["資料・図表", "paper", paper.querySelectorAll(".paper-viewport h3, .paper-viewport h4, figcaption, caption")],
    ] as const) {
      list.append(el("h3", title));
      for (const n of nodes) {
        const text = n.textContent.trim();
        if (!text || n.closest(".matrix-bands")) continue;
        list.append(button(text, () => {
          dismiss?.(); select(pane);
          n.scrollIntoView({block:"start"});
        }));
      }
    }
    panel("問一覧", "bottom", list);
  };
  for (const graphic of layout.querySelectorAll<HTMLElement>(".canvas, figure > img, figure > svg")) {
    const zoom = button("図を拡大", () => borrow(graphic, "図の拡大", "zoom"));
    zoom.className = "phone zoom-button";
    graphic.after(zoom);
  }
}
