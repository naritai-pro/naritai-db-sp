import type { PaperHighlight } from "./store";

export function enablePaperHighlights(paper: HTMLElement, highlights: PaperHighlight[], save: () => void) {
  const content = paper.textContent ?? "";
  function paint() {
    for (const mark of paper.querySelectorAll("mark.user-highlight")) {
      const parent = mark.parentNode!;
      mark.replaceWith(...mark.childNodes);
      parent.normalize();
    }
    const walker = document.createTreeWalker(paper, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];
    while (walker.nextNode()) nodes.push(walker.currentNode as Text);
    let offset = 0;
    for (const node of nodes) {
      const start = offset;
      offset += node.length;
      if (node.parentElement?.closest("svg")) continue;
      // Work backwards so splitting a text node preserves its earlier offsets.
      for (const h of highlights.slice().reverse()) {
        if (h.end <= start || h.start >= offset) continue;
        if (content.slice(h.start, h.end) !== h.text) continue;
        const end = Math.min(h.end, offset) - start;
        if (end < node.length) node.splitText(end);
        const localStart = Math.max(h.start - start, 0);
        const selected = localStart ? node.splitText(localStart) : node;
        const mark = document.createElement("mark");
        mark.className = "user-highlight";
        mark.dataset.start = String(h.start);
        selected.replaceWith(mark);
        mark.append(selected);
      }
    }
  }
  for (const link of paper.querySelectorAll("a")) link.draggable = false;
  let dragging = false;
  let justMarked = false;
  paper.addEventListener("pointerdown", event => {
    dragging = event.isPrimary && event.button === 0;
    justMarked = false;
  });
  paper.addEventListener("pointercancel", () => { dragging = false; });
  paper.addEventListener("pointerup", event => {
    if (!dragging || !event.isPrimary || event.button !== 0) return;
    dragging = false;
    const selection = window.getSelection();
    if (!selection?.rangeCount || selection.isCollapsed) return;
    const range = selection.getRangeAt(0);
    if (!paper.contains(range.commonAncestorContainer)) return;
    const selected = range.toString();
    if (!selected.trim() || (range.commonAncestorContainer instanceof Element
      ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement)?.closest("svg")) return;
    const prefix = document.createRange();
    prefix.selectNodeContents(paper);
    prefix.setEnd(range.startContainer, range.startOffset);
    const start = prefix.toString().length, end = start + selected.length;
    const remaining = highlights.filter(h => h.end <= start || h.start >= end);
    remaining.push({start, end, text: selected});
    remaining.sort((a, b) => a.start - b.start);
    highlights.splice(0, highlights.length, ...remaining);
    justMarked = true;
    selection.removeAllRanges();
    paint();
    save();
  });
  paper.addEventListener("click", event => {
    const mark = event.target instanceof Element ? event.target.closest("mark.user-highlight") : null;
    if (!justMarked && !mark) return;
    event.preventDefault();
    event.stopPropagation();
    if (!justMarked && mark) {
      const index = highlights.findIndex(h => h.start === Number((mark as HTMLElement).dataset.start));
      if (index >= 0) {
        highlights.splice(index, 1);
        paint();
        save();
      }
    }
    justMarked = false;
  }, true);
  paint();
}
