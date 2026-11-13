import { button, el } from "./dom";

const keys = /(PK|FK|PK\+FK)\[([^\]\n]+)\]/g;

export function schemaPreview(value: string, className = "") {
  const preview = el("pre", "", ("schema-preview " + className).trim());
  let offset = 0;
  for (const match of value.matchAll(keys)) {
    preview.append(value.slice(offset, match.index));
    const mark = el("span", match[2], match[1].toLowerCase().replace("+", " "));
    mark.title = match[1];
    preview.append(mark);
    offset = match.index + match[0].length;
  }
  preview.append(value.slice(offset));
  return preview;
}

type KeyRange = { start: number; end: number; pk: boolean; fk: boolean };

function serialize(text: string, ranges: KeyRange[]) {
  let result = "", offset = 0;
  for (const r of ranges) {
    const key = r.pk ? (r.fk ? "PK+FK" : "PK") : "FK";
    result += text.slice(offset, r.start) + text.slice(r.start, r.end).replace(/[^\]\n]+/g, part => key + "[" + part + "]");
    offset = r.end;
  }
  return result + text.slice(offset);
}

export const schemaInstructions = "属性名を選択し、Aキーで主キー、Sキーで外部キーの下線を付け外しできます。ボタンでも操作できます。";

type KeyRole = "pk" | "fk";

export function schemaControls(root: HTMLElement, id: string) {
  const hint = el("small", schemaInstructions);
  hint.id = id + "-key-help";
  hint.setAttribute("aria-live", "polite");
  const buttons: HTMLButtonElement[] = [];
  let apply: ((role: KeyRole) => void) | undefined;
  function select(action?: typeof apply) {
    apply = action;
    buttons.forEach(b => { b.disabled = !action; });
    if (!action) hint.textContent = schemaInstructions;
  }
  root.addEventListener("focusout", event => {
    if (!root.contains(event.relatedTarget as Node | null)) select();
  });
  function toolbar() {
    const bar = el("div", "", "controls schema-tools");
    for (const [role, caption] of [["pk", "主キー"], ["fk", "外部キー"]] as const) {
      const toggle = button("", () => apply?.(role));
      toggle.setAttribute("aria-keyshortcuts", role === "pk" ? "A" : "S");
      toggle.append(el("span", caption, role));
      toggle.disabled = true;
      toggle.onmousedown = event => event.preventDefault();
      buttons.push(toggle);
      bar.append(toggle);
    }
    return bar;
  }
  return { hint, select, toolbar };
}

export function schemaInput(id: string, prompt: string, saved: string, update: (value: string) => void, shared?: ReturnType<typeof schemaControls>) {
  const group = el("div", "", "schema-input");
  const label = el("label", prompt, "answer-field");
  const surface = el("div", "", "schema-surface");
  const input = el("textarea");
  input.rows = shared ? 1 : id.startsWith("2-") ? 2 : 5;
  const mirror = el("div", "", "schema-mirror");
  mirror.setAttribute("aria-hidden", "true");
  // The native textarea handles typing, IME, selection and clipboard. The layer
  // below it paints the same text with key underlines at the same positions.
  const initial = schemaPreview(saved);
  let text = "", ranges: KeyRange[] = [];
  for (const node of initial.childNodes) {
    const start = text.length;
    text += node.textContent ?? "";
    if (node instanceof HTMLElement)
      ranges.push({start, end: text.length, pk: node.classList.contains("pk"), fk: node.classList.contains("fk")});
  }
  input.value = text;
  function paint() {
    const preview = schemaPreview(serialize(text, ranges));
    mirror.replaceChildren(...preview.childNodes, document.createTextNode("\u200b"));
    mirror.scrollTop = input.scrollTop;
  }
  input.onscroll = () => { mirror.scrollTop = input.scrollTop; };
  let selectionBefore = 0;
  input.onbeforeinput = () => { selectionBefore = input.selectionStart; };
  input.oninput = () => {
    const next = input.value;
    let left = 0, oldEnd = text.length, newEnd = next.length;
    while (left < selectionBefore && left < oldEnd && left < newEnd && text[left] === next[left]) left++;
    while (oldEnd > left && newEnd > left && text[oldEnd-1] === next[newEnd-1]) { oldEnd--; newEnd--; }
    const delta = newEnd - oldEnd;
    ranges = ranges.flatMap(r => {
      if (r.end <= left) return [r];
      if (r.start >= oldEnd) return [{...r,start:r.start+delta,end:r.end+delta}];
      const start = r.start < left ? r.start : left;
      const end = r.end >= oldEnd ? r.end + delta : left;
      return start < end ? [{...r,start,end}] : [];
    });
    text = next;
    paint(); update(serialize(text, ranges));
  };
  const controls = shared ?? schemaControls(group, id);
  const { hint } = controls;
  input.setAttribute("aria-describedby", hint.id);
  function hasSelection() {
    const selected = input.value.slice(input.selectionStart, input.selectionEnd);
    return !!selected.trim() && !/[\[\]\n]/.test(selected);
  }
  input.addEventListener("keydown", event => {
    if (event.isComposing || event.keyCode === 229 || event.ctrlKey || event.metaKey ||
        event.altKey || event.shiftKey || !hasSelection()) return;
    const key = event.key.toLowerCase();
    if (key !== "a" && key !== "s") return;
    event.preventDefault();
    if (!event.repeat) toggleKey(key === "a" ? "pk" : "fk");
  });
  function refreshButtons() {
    if (document.activeElement === input) controls.select(hasSelection() ? toggleKey : undefined);
  }
  for (const event of ["focus", "select", "selectionchange", "input", "keyup", "pointerup"])
    input.addEventListener(event, refreshButtons);
  function toggleKey(role: KeyRole) {
      if (!hasSelection()) return;
      const start = input.selectionStart, end = input.selectionEnd;
      const cuts = [...new Set([start,end,...ranges.flatMap(r=>[r.start,r.end])])].sort((a,b)=>a-b);
      const pieces: KeyRange[] = cuts.slice(0,-1).map((pos,i) => {
        const r = ranges.find(r=>r.start<=pos && pos<r.end);
        return {start:pos,end:cuts[i+1],pk:!!r?.pk,fk:!!r?.fk};
      });
      const selected = pieces.filter(r=>r.start>=start && r.end<=end);
      const enable = !selected.every(r=>r[role]);
      selected.forEach(r=>{r[role]=enable;});
      ranges = [];
      for (const r of pieces.filter(r=>r.pk || r.fk)) {
        const prev = ranges.at(-1);
        if (prev && prev.end===r.start && prev.pk===r.pk && prev.fk===r.fk) prev.end=r.end;
        else ranges.push(r);
      }
      paint();update(serialize(text,ranges));input.focus();input.setSelectionRange(start,end);
      hint.textContent = (role === "pk" ? "主キー" : "外部キー") + (enable ? "を付けました。" : "を外しました。");
  }
  surface.append(mirror,input);
  label.append(surface);
  group.append(label);
  if (!shared) group.append(controls.toolbar(), hint);
  paint();return group;
}
