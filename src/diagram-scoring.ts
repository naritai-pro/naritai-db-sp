import policy from "./diagram-scoring-policy.json";
import { el } from "./dom";

export const diagramScoringText = [policy.summary, ...policy.details, policy.formula, policy.disclaimer].join("\n");

export function diagramScoringNotice(showSummary = true) {
  const box = el("div", "", "diagram-scoring-rules");
  if (showSummary) box.append(el("p", policy.summary, "score-note"));
  const details = el("details");
  details.append(el("summary", policy.title));
  for (const text of [policy.intro, ...policy.details, policy.formula, policy.example, policy.disclaimer]) {
    details.append(el("p", text, "exam-note"));
  }
  box.append(details);
  return box;
}
