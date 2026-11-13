import { defineConfig } from "vite";
import { origin, pageInfo, questionTitles, siteName } from "./src/seo.ts";

const home = pageInfo();
const questions = Object.keys(questionTitles).sort().reverse().map(id => [pageInfo(id), pageInfo(id, true)]);
const pages = [home, ...questions.flat()];
const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
function render(template: string, page: typeof home) {
  const url = origin + page.path;
  const title = escape(page.title);
  const description = escape(page.description);
  const head = [
    `<title>${title}</title>`,
    `<meta name="description" content="${description}" />`,
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:locale" content="ja_JP" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${siteName}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:image" content="${origin}/apple-touch-icon.png" />`,
    `<meta property="og:image:alt" content="DB" />`,
    `<meta name="twitter:card" content="summary" />`,
  ].join("\n    ");
  const links = page === home
    ? "<ul>" + questions.map(([q]) => `<li><a href="${q.path}">${escape(q.heading)}</a></li>`).join("") + "</ul>"
    : page.path.endsWith("/answer")
      ? `<a href="${page.path.slice(0, -7)}">問題を解く</a>`
      : `<a href="${page.path}/answer">解答例・解説を見る</a>`;
  return template.replace(/<title>.*?<\/title>/, () => head)
    .replace('<main id="app"></main>', () => `<main id="app"><h1>${escape(page.heading)}</h1><p>${description}</p>${links}</main>`);
}

export default defineConfig({
  plugins: [{
    name: "exam-page-metadata",
    transformIndexHtml(html, ctx) {
      if (ctx.server) return render(html, pages.find(p => p.path === ctx.path.replace(/\/$/, "")) ?? home);
    },
    generateBundle: {
      order: "post",
      handler(_, bundle) {
        const index = bundle["index.html"];
        if (!index || index.type !== "asset") throw new Error("index.html is missing");
        const template = String(index.source);
        index.source = render(template, home);
        for (const page of pages.slice(1)) {
          this.emitFile({type: "asset", fileName: page.path.slice(1) + ".html", source: render(template, page)});
        }
        const urls = pages.map(p => `  <url><loc>${origin}${p.path}</loc></url>`).join("\n");
        this.emitFile({type: "asset", fileName: "sitemap.xml", source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`});
      },
    },
  }],
});
