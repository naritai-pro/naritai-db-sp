export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text = "",
  cls = "",
) {
  const node = document.createElement(tag);
  node.textContent = text;
  if (cls) node.className = cls;
  return node;
}
export function button(text: string, action: () => void) {
  const b = el("button", text);
  b.type = "button";
  b.onclick = action;
  return b;
}
export function link(text: string, href: string, cls = "") {
  const a = el("a", text, cls);
  a.href = href;
  return a;
}
