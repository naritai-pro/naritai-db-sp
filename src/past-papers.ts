import catalog from "./past-paper-catalog.json" with { type: "json" };

export interface PastPaper {
  year: number;
  part: string;
  number: number;
  title: string;
  sections: number[];
  subparts: number[][];
  firstPage: number;
  lastPage: number;
  studyNote?: string;
  paper: string;
  answer: string;
  comment: string;
}

export function afternoonId(year: number, part: string, number: number) {
  const term = year <= 2019 ? "spring" : year === 2020 ? "october" : "autumn";
  return year + "-" + term + "-db-" + part + "-q" + number;
}

export const pastPapers = new Map((catalog as PastPaper[]).map(paper => [
  afternoonId(paper.year, paper.part, paper.number), paper,
]));
