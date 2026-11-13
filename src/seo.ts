import { pastPapers } from "./past-papers.ts";
import { morningTerm } from "./morning-catalog.ts";
import archiveTitles from "./archive-titles.json" with { type: "json" };
import { questionPath } from "./routes.ts";

export const origin = "https://ipa-db-sp.naritai.app";
export const siteName = "データベーススペシャリスト試験演習室";
export const questionTitles: Record<string, string> = {
  ...Object.fromEntries(Array.from(pastPapers, ([id, q]) => [id, q.title])),
  ...archiveTitles,
  "2025-autumn-db-pm1-q1": "大学の学習管理システム",
  "2025-autumn-db-pm1-q2": "化学メーカーの営業販売管理システム",
  "2025-autumn-db-pm1-q3": "オフィスじゅう器メーカーの在庫管理システム",
};

export function pageInfo(id = "", reviewing = false) {
  if (!questionTitles[id]) return {
    path: "/", heading: "データベーススペシャリスト試験の過去問演習",
    title: "データベーススペシャリスト試験の過去問演習・解説",
    description: "データベーススペシャリスト試験の過去問をブラウザで演習できます。2016〜2025年度の午前Ⅰ・午前Ⅱ・午後Ⅰ・午後Ⅱを収録。問題文や図表を見ながら解答し、IPAの解答例と解説で復習できます。",
  };
  const [year, pm, number] = questionPath(id).slice(1).split("/");
  const exam = year + "年度 " + morningTerm(Number(year)) + " " + (pm === "pm1" ? "午後Ⅰ" : "午後Ⅱ") + " 問" + number.slice(1);
  const heading = exam + "「" + questionTitles[id] + "」";
  const reviewDescription = pastPapers.has(id)
    ? "の解答例と採点講評。自分の答案をIPAの原本と見比べられます。"
    : "の解説。設問ごとに自分の答案とIPAの解答例を見比べて、答えの導き方を確認できます。";
  return {
    path: questionPath(id) + (reviewing ? "/answer" : ""),
    heading,
    title: heading + (reviewing ? "の解答例・解説" : "の過去問演習") + "｜" + siteName,
    description: "データベーススペシャリスト試験 " + heading + (reviewing
      ? reviewDescription
      : "の演習ページ。問題文と図表を参照しながら設問ごとに答案を入力できます。答案はブラウザに自動保存され、途中から再開できます。"),
  };
}
