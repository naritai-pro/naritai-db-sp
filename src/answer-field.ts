import { type schemaControls, schemaInput } from "./schema-input";
import { el } from "./dom";

export function answerField(
  id: string,
  prompt: string,
  saved: string,
  update: (value: string) => void,
  control?: "schema" | "short" | "step" | "step5" | "normal" | string[] | number,
  shared?: ReturnType<typeof schemaControls>,
) {
  if (control === "schema" || id === "1-2s" || id === "3-2" || id.startsWith("2-")) return schemaInput(id,prompt,saved,update,shared);
  const label = el("label", "", "answer-field");
  if (prompt) {
    label.append(el("span", prompt, "field-caption"));
    if (Array.from(prompt.trim()).length === 1) label.classList.add("symbol-field");
  }
  if (Array.isArray(control) || control === "step" || control === "step5" || control === "normal" || id === "1-2a") {
    const select = el("select");
    const choices = Array.isArray(control) ? control : control === "step5" ? ["①","②","③","④","⑤"] : control === "step" ? ["①","②","③","④"] : ["非正規形", "第1正規形", "第2正規形", "第3正規形"];
    select.add(new Option("選択してください", ""));
    for (const choice of choices) select.add(new Option(choice, choice));
    if (saved && !choices.includes(saved)) {
      select.add(new Option("以前の答案：" + saved, saved));
    }
    select.value = saved;
    select.onchange = () => update(select.value);
    label.append(select);
    return label;
  }

  const short = control === "short" || id === "1-1";
  const limit = typeof control === "number" ? control : id === "1-2b" ? 70 : 0;
  // Keep older multiline answers editable for short fields without a length limit.
  const singleLine = !limit && short && !/[\r\n]/.test(saved);
  const text = singleLine ? el("input") : el("textarea");
  if (text instanceof HTMLInputElement) text.type = "text";
  else text.rows = limit ? Math.ceil(limit / 41) : short ? 2 : 5;
  const withoutBreaks = (value: string) => value.replace(/[\r\n\u2028\u2029]/g, "");
  text.value = limit ? withoutBreaks(saved) : saved;
  label.append(text);
  if (limit) {
    const counter = el("small", "", "word-count");
    counter.id = id + "-length";
    text.setAttribute("aria-describedby", counter.id);
    const count = () => {
      const size = Array.from(text.value).length;
      counter.textContent = size + " / " + limit + "字" + (size > limit ? "（字数超過）" : "");
      counter.classList.toggle("over-limit", size > limit);
    };
    count();
    label.append(counter);
    text.addEventListener("beforeinput", event => {
      const { inputType } = event as InputEvent;
      if (inputType === "insertLineBreak" || inputType === "insertParagraph") event.preventDefault();
    });
    text.oninput = () => {
      const value = withoutBreaks(text.value);
      if (value !== text.value) {
        const caret = withoutBreaks(text.value.slice(0, text.selectionStart ?? 0)).length;
        text.value = value;
        text.setSelectionRange(caret, caret);
      }
      count();
      update(text.value);
    };
  } else {
    text.oninput = () => update(text.value);
  }
  return label;
}
