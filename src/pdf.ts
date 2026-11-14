import { diagramScoringNotice } from "./diagram-scoring";
import archiveInfo from "../public/downloads/DB-Exam-PDF-2016-2025.json" with { type: "json" };
import catalog from "./pdf-catalog.json" with { type: "json" };
import answerSheets from "../public/answer-sheets/manifest.json" with { type: "json" };
import { el, link } from "./dom.ts";
import { morningTerm } from "./morning-catalog.ts";

export const pdfPageInfo = {
  path: "/pdf",
  heading: "過去問・解答用紙PDF",
  title: "過去問PDF（2016〜2025年度）｜データベーススペシャリスト試験演習室",
  description: "データベーススペシャリスト試験10年分（2016〜2025年度）のIPA公式問題PDF、午後Ⅰ・午後Ⅱの解答用紙と、年度共通の午前Ⅰ・午前Ⅱマークシートを掲載しています。",
};

function officialLink(label: string, href: string) {
  const anchor = link(label + " ↗", href);
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  return anchor;
}

function morningSheetLink() {
  return officialLink("午前Ⅰ・午前Ⅱのマークシート（年度共通）", "/answer-sheets/am1-am2.pdf");
}

function bindArchiveDownload(download: HTMLButtonElement, downloadStatus: HTMLElement, manifestPath: string, completedMessage: string) {
  download.onclick = async () => {
    download.disabled = true;
    downloadStatus.textContent = "ダウンロードを準備しています…";
    try {
      const response = await fetch(manifestPath);
      if (!response.ok) throw new Error("Archive manifest unavailable");
      const manifest: {filename: string; size: number; parts: {file: string; size: number}[]} = await response.json();
      const chunks: ArrayBuffer[] = [];
      let received = 0;
      for (const part of manifest.parts) {
        const response = await fetch("/downloads/" + part.file);
        if (!response.ok) throw new Error("Archive part unavailable");
        const chunk = await response.arrayBuffer();
        if (chunk.byteLength !== part.size) throw new Error("Incomplete archive part");
        chunks.push(chunk);
        received += chunk.byteLength;
        downloadStatus.textContent = `ダウンロードを準備しています… ${Math.round(received / manifest.size * 100)}%`;
      }
      if (received !== manifest.size) throw new Error("Incomplete archive");
      const url = URL.createObjectURL(new Blob(chunks, {type: "application/zip"}));
      const anchor = link("", url);
      anchor.download = manifest.filename;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      downloadStatus.textContent = completedMessage;
    } catch {
      downloadStatus.textContent = "ダウンロードできませんでした。通信状況を確認して、もう一度お試しください。";
    } finally {
      download.disabled = false;
    }
  };
}

export function pdfPage() {
  const page = el("div", "", "pdf-page");
  page.append(
    el("p", "IPA公式・2016〜2025年度", "eyebrow"),
    el("h1", pdfPageInfo.heading),
    el("p", "2016〜2025年度の公式問題冊子と、学習用の解答用紙を掲載しています。年度別の問題リンクからはIPA公式のPDFを新しいタブで開きます。"),
    el("p", "午前Ⅰは高度試験共通の問題です。", "exam-note"),
  );
  page.append(el("h2", "10年分の問題・解答用紙をまとめてダウンロード"), el("p", "公式問題冊子と学習用の解答用紙、図の採点ルールをまとめて収録しています。"));
  const download = el("button", "問題・解答用紙をすべてダウンロード（ZIP）", "pdf-download");
  download.type = "button";
  const downloadStatus = el("p", `${archiveInfo.pdfCount}本・約${Math.round(archiveInfo.size / 1_000_000)}MB／問題冊子・午前共通マークシート・午後Ⅰ／Ⅱの解答用紙10年分・図の採点ルール`, "exam-note");
  downloadStatus.setAttribute("role", "status");
  bindArchiveDownload(download, downloadStatus, "/downloads/DB-Exam-PDF-2016-2025.json", "問題・解答用紙・図の採点ルールをまとめたZIPの保存を開始しました。");
  page.append(download, downloadStatus);
  const printInfo = el("section", "", "card pdf-print-info");
  const sheetDownloads = el("div", "", "pdf-bulk-links");
  for (const [file, label, description] of [
    ["am1-am2.pdf", "午前Ⅰ・Ⅱ マークシート（PDF）", "年度共通・1ページ／午前Ⅰ30問＋午前Ⅱ25問"],
    ["2016-2025-pm1.pdf", "午後Ⅰ 解答用紙10年分（PDF）", "2016〜2025年度・60ページ"],
    ["2016-2025-pm2.pdf", "午後Ⅱ 解答用紙10年分（PDF）", "2016〜2025年度・40ページ"],
  ]) {
    const anchor = officialLink(label, "/answer-sheets/" + file);
    anchor.className = "primary";
    const item = el("div");
    item.append(anchor, el("small", description + "・新しいタブで開きます"));
    sheetDownloads.append(item);
  }
  printInfo.append(
    el("h2", "解答用紙だけダウンロード"),
    el("p", "必要な解答用紙を選んでダウンロードできます。すべてA4で印刷できます。"),
    el("p", "当サイト作成の学習用です。本試験の答案用紙とレイアウトは異なります。", "exam-note"),
    sheetDownloads,
    diagramScoringNotice(false),
    officialLink("図の採点ルールを印刷する（A4・1ページ）", "/answer-sheets/diagram-scoring-guide.pdf"),
  );
  page.append(printInfo);
  const groups = el("div", "", "pdf-groups");
  const years = [...catalog].sort((a, b) => b.year - a.year);
  for (const [part, label] of [["am1", "午前Ⅰ"], ["am2", "午前Ⅱ"], ["pm1", "午後Ⅰ"], ["pm2", "午後Ⅱ"]] as const) {
    const section = el("section", "", "card pdf-group");
    const heading = el("h2", label);
    heading.id = "pdf-part-" + part;
    section.setAttribute("aria-labelledby", heading.id);
    const links = el("ul", "", "pdf-links");
    const bulkItem = el("li");
    const bulkDownload = el("button", "10年分まとめて", "pdf-part-download");
    bulkDownload.type = "button";
    bulkDownload.setAttribute("aria-label", `${label}の問題10年分をまとめてダウンロード（ZIP）`);
    const bulkStatus = el("p", "", "exam-note");
    bulkStatus.setAttribute("role", "status");
    bindArchiveDownload(bulkDownload, bulkStatus, `/downloads/DB-Exam-PDF-2016-2025-${part}.json`, `${label}の問題10年分のZIPの保存を開始しました。`);
    bulkItem.append(bulkDownload);
    links.append(bulkItem);
    for (const {year, papers} of years) {
      const item = el("li");
      const yearLabel = year + "年度 " + morningTerm(year);
      const anchor = officialLink(yearLabel, papers[part]);
      anchor.setAttribute("aria-label", yearLabel + " " + label + " 問題PDF（新しいタブで開く）");
      item.append(anchor);
      links.append(item);
    }
    section.append(heading, links, bulkStatus);
    if (part === "am1" || part === "am2") {
      const sheetLink = el("p", "", "pdf-morning-sheet");
      sheetLink.append(morningSheetLink(), el("small", "A4・1ページ／全年度で使えます"));
      section.append(el("h3", "学習用の解答用紙"), sheetLink);
    }
    if (part === "pm1" || part === "pm2") {
      const sheetLinks = el("ul", "", "pdf-links pdf-answer-links");
      for (const {year} of years) {
        const sheet = answerSheets.find(sheet => sheet.year === year && sheet.part === part)!;
        const item = el("li");
        const anchor = officialLink(year + "年度", "/answer-sheets/" + sheet.file);
        anchor.setAttribute("aria-label", `${year}年度 ${label} 解答用紙PDF・A4・${sheet.pages}ページ（新しいタブで開く）`);
        anchor.append(el("small", `A4・${sheet.pages}ページ`));
        item.append(anchor);
        sheetLinks.append(item);
      }
      section.append(el("h3", "学習用の解答用紙"), sheetLinks);
    }
    groups.append(section);
  }
  const sources = el("details", "", "pdf-source");
  sources.append(el("summary", "IPA公式の年度別ページ"));
  const sourceList = el("ul");
  for (const {year, source} of years) {
    const item = el("li");
    item.append(officialLink(year + "年度 " + morningTerm(year), source));
    sourceList.append(item);
  }
  sources.append(sourceList);
  page.append(groups, sources);
  return page;
}
