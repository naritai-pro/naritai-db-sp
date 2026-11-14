import { el, link } from "./dom";
import { openSourceSection } from "./open-source";

export const contactPageInfo = {
  path: "/contact",
  heading: "問い合わせ先",
  title: "問い合わせ先｜データベーススペシャリスト試験演習室",
  description: "誤字・誤記のご報告、ご要望・ご希望、その他のお問い合わせは、運営者のXアカウントへお願いします。",
};

export function contactPage() {
  const page = el("section", "", "card contact-page");
  const account = link("@taiki_smec（X）", "https://x.com/taiki_smec", "primary");
  account.target = "_blank";
  account.rel = "noopener noreferrer";
  page.append(
    el("h1", contactPageInfo.heading),
    el("p", contactPageInfo.description),
    account,
    el("p", "誤字・誤記のご報告には、該当ページのURLや年度・問題番号を添えていただけると助かります。"),
  );
  page.append(openSourceSection());
  return page;
}
