import { el, link } from "./dom";

const repository = "https://github.com/naritai-pro/naritai-db-sp";

export function openSourceSection(card = false) {
  const section = el("section", "", card ? "card open-source" : "open-source");
  const heading = el("h2", "オープンソースについて");
  heading.id = "open-source-title";
  section.setAttribute("aria-labelledby", heading.id);
  const links = el("ul", "", "exam-links");
  for (const [label, href] of [
    ["GitHubリポジトリを見る ↗", repository],
    ["MIT-0ライセンス全文 ↗", `${repository}/blob/main/LICENSE`],
  ]) {
    const item = el("li");
    const anchor = link(label, href);
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    item.append(anchor);
    links.append(item);
  }
  section.append(
    heading,
    el("p", "このアプリはオープンソースのプロジェクトです。ソースコードをGitHubで公開しています。学習や教材づくり、独自のアプリ開発などにご活用ください。"),
    el("p", "独自に作成したソースコードとドキュメントは、MIT-0（MIT No Attribution）ライセンスで公開しています。商用利用・改変・再配布・販売が可能で、クレジット表記や改変したソースコードの公開は必須ではありません。"),
    links,
    el("p", "IPAの試験問題・解答例・採点講評、それらに由来する本文・図表などの第三者著作物はMIT-0の対象外です。依存ライブラリを含め、それぞれの権利者の利用条件が適用されます。本ソフトウェアは無保証で提供されます。", "exam-note"),
  );
  return section;
}
