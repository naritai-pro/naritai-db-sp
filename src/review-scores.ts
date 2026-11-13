import plans from "./score-plan.json";

type ScoreItem = { ids: string[]; points: number };
type Subquestion = { label: string; items: ScoreItem[] };
type ScoreEntry = { heading: string; item: ScoreItem };

const questions: Record<string, Subquestion[][]> = plans;

export function sectionScores(questionId: string, sectionIndex: number, sectionHeading: string) {
  const entries = new Map<string, ScoreEntry>();
  const sectionLabel = sectionHeading.split(/\s/, 1)[0];
  for (const { label, items } of questions[questionId][sectionIndex]) {
    const total = items.reduce((sum, item) => sum + item.points, 0);
    const heading = sectionLabel + label + "｜予想配点 " + total + "点";
    for (const item of items) {
      for (const id of item.ids) entries.set(id, { heading, item });
    }
  }
  return entries;
}
