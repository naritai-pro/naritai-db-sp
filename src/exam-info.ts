import { el, link } from "./dom";
import { contactPageInfo } from "./contact";

export function examInfo() {
  const info = el("div", "", "exam-info");
  const schedule = el("section", "", "card exam-schedule");
  const heading = el("h2", "試験スケジュール");
  heading.id = "exam-schedule-title";
  schedule.setAttribute("aria-labelledby", heading.id);
  const application = el("p", "", "exam-application");
  application.append(el("span", "申込期間"), el("strong", "2027年1月27日（水）〜2月27日（土）"));
  const dates = el("dl", "", "exam-dates");
  for (const [label, value] of [
    ["科目A-1・A-2", "2027年2月20日（土）〜3月2日（火）"],
    ["科目B-1・B-2", "2027年3月16日（火）〜3月28日（日）"],
    ["合格発表", "2027年6月頃予定"],
  ]) {
    const row = el("div");
    row.append(el("dt", label), el("dd", value));
    dates.append(row);
  }
  schedule.append(
    heading,
    el("p", "2026年度（令和8年度）後期", "eyebrow"),
    application,
    dates,
    el("p", "実施方式：CBT方式（会場のコンピューターで受験）"),
    el("p", "※2026年度の試験ですが、申込み・受験は2027年です。", "exam-note"),
  );

  const official = el("section", "", "card exam-official");
  const officialHeading = el("h2", "IPA公式情報");
  officialHeading.id = "exam-official-title";
  official.setAttribute("aria-labelledby", officialHeading.id);
  const links = el("ul", "", "exam-links");
  for (const [label, href, description] of [
    ["データベーススペシャリスト試験とは（IPA公式）", "https://www.ipa.go.jp/shiken/kubun/db.html", "対象者・試験内容・出題形式"],
    ["申込期間・試験スケジュール（IPA公式）", "https://www.ipa.go.jp/shiken/2026/ap_koudo_sc_kikan.html", "詳細な日程"],
    ["受験申込みの案内（IPA公式）", "https://www.ipa.go.jp/shiken/mousikomi/index.html", "申込方法・受付情報"],
  ]) {
    const item = el("li");
    const anchor = link(label + " ↗", href);
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    item.append(anchor, el("small", description));
    links.append(item);
  }
  official.append(officialHeading, links, el("p", "IPAは2027年度から新試験制度へ移行予定と案内しています。翌年度以降の受験についても、公式情報をご確認ください。", "exam-note"));
  info.append(schedule, official, el("p", "情報確認日：2026年11月14日 ｜ 最新情報はIPA公式サイトをご確認ください。", "exam-note exam-checked"));
  const contact = el("section", "", "card exam-contact");
  const contactHeading = el("h2", "問い合わせ先");
  contactHeading.id = "exam-contact-title";
  contact.setAttribute("aria-labelledby", contactHeading.id);
  const contactLinks = el("ul", "", "exam-links");
  const contactItem = el("li");
  const account = link("@taiki_smec（X） ↗", "https://x.com/taiki_smec");
  account.target = "_blank";
  account.rel = "noopener noreferrer";
  contactItem.append(account, el("small", "誤字・誤記のご報告、ご要望・その他のお問い合わせ"));
  contactLinks.append(contactItem);
  contact.append(contactHeading, el("p", contactPageInfo.description), contactLinks,
    el("p", "誤字・誤記のご報告には、該当ページのURLや年度・問題番号を添えていただけると助かります。", "exam-note"));
  info.append(contact);
  return info;
}
