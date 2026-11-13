export const morningYears = Array.from({length: 10}, (_, i) => 2025 - i);
export const morningParts = ["am1", "am2"] as const;
export type MorningPart = typeof morningParts[number];

export function morningName(part: MorningPart) {
  return part === "am1" ? "午前Ⅰ" : "午前Ⅱ";
}
export function morningTerm(year: number) {
  if (year <= 2019) return "春期";
  return year === 2020 ? "10月" : "秋期";
}
export function morningInfo(year: number, part: MorningPart) {
  const heading = year + "年度 " + morningTerm(year) + " " + morningName(part);
  return {
    heading, path: "/" + year + "/" + part,
    title: heading + "｜データベーススペシャリスト試験演習室",
    description: heading + "の過去問を解き、各問の正答と解説を確認できます。",
  };
}
export function morningRoute(path: string) {
  const match = /^\/(\d{4})\/(am[12])\/?$/.exec(path);
  if (!match || !morningYears.includes(Number(match[1]))) return null;
  return {year: Number(match[1]), part: match[2] as MorningPart};
}
