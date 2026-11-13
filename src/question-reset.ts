import { button, el } from "./dom";

export function questionReset(label: string, reset: () => void) {
  const group = el("div", "", "question-reset");
  const trigger = el("button", "リセット");
  trigger.type = "button";
  const bubble = el("div", "", "reset-confirm");
  bubble.popover = "auto";
  bubble.setAttribute("role", "dialog");
  bubble.setAttribute("aria-labelledby", "reset-prompt");
  const prompt = el("p", label + "の答案と書き込みを消して、最初から解き直しますか？");
  prompt.id = "reset-prompt";
  const cancel = button("キャンセル", () => bubble.hidePopover());
  cancel.autofocus = true;
  trigger.popoverTargetElement = bubble;
  bubble.append(prompt, cancel, button("リセットする", reset));
  group.append(trigger, bubble);
  function position() {
    const rect = trigger.getBoundingClientRect();
    bubble.style.left = Math.max(8, Math.min(rect.right - bubble.offsetWidth, innerWidth - bubble.offsetWidth - 8)) + "px";
    bubble.style.top = (rect.bottom + bubble.offsetHeight + 8 <= innerHeight
      ? rect.bottom + 6 : Math.max(8, rect.top - bubble.offsetHeight - 6)) + "px";
  }
  bubble.addEventListener("toggle", () => {
    if (bubble.matches(":popover-open")) {
      position();
      window.addEventListener("resize", position);
      window.addEventListener("scroll", position, true);
    } else {
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
    }
  });
  return group;
}
