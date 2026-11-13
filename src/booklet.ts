import type { MaterialBlock, Question } from "./exam";
import { diagram } from "./diagram";
import { schemaPreview } from "./schema-input";
import { el, link } from "./dom";


const captions = [
  "図1　現状業務の概念データモデル（未完成）",
  "図2　現状業務の関係スキーマ（未完成）",
  "図3　納期調整シートの帳票サンプル",
  "図4　修正後の概念データモデル（未完成）",
];
const region = "得意先納品要求に関するトランザクションの領域";

function vector(tag: string, attrs: Record<string, string | number>) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [key, value] of Object.entries(attrs))
    node.setAttribute(key, String(value));
  return node;
}

function model(d: Question["diagrams"][number]) {
  const current = d.section === 2;
  const canvas = vector("svg", {
    class: "paper-model",
    viewBox: "0 0 710 " + (current ? 313 : 130),
    role: "img",
    "aria-label":
      d.title +
      "（未完成）。" +
      region +
      "。エンティティ：" +
      d.nodes.map((n) => n[0]).join("、") +
      "。既存の関係：" +
      d.fixed.map((e) => e.join(" ")).join("、"),
  });
  const defs = vector("defs", {});
  const markerId = "paper-arrow-" + d.section;
  const marker = vector("marker", {
    id: markerId,
    viewBox: "0 0 10 10",
    refX: 9,
    refY: 5,
    markerWidth: 8,
    markerHeight: 8,
    orient: "auto",
  });
  marker.append(
    vector("path", {
      d: "M1 1 L9 5 L1 9",
      fill: "none",
      stroke: "currentColor",
    }),
  );
  defs.append(marker);
  canvas.append(
    defs,
    vector("rect", {
      x: current ? 359 : 6,
      y: current ? 212 : 8,
      width: current ? 340 : 690,
      height: current ? 93 : 116,
      rx: 6,
      fill: "none",
      stroke: "currentColor",
      "stroke-dasharray": "5 4",
    }),
  );
  const annotation = vector("text", {
    x: current ? 529 : 350,
    y: current ? 294 : 111,
    "text-anchor": "middle",
    "font-size": 13,
  });
  annotation.textContent = region;
  canvas.append(annotation);
  const positions = new Map(
    d.nodes.map(([name, x, y]) => [
      String(name),
      { x: Number(x), y: Number(y) },
    ]),
  );
  for (const [start, end, type] of d.fixed) {
    const a = positions.get(start)!,
      b = positions.get(end)!;
    const path =
      a.y === b.y
        ? "M " + (a.x + 66) + " " + a.y + " H " + (b.x - 66)
        : a.x === b.x
          ? "M " + a.x + " " + (a.y + 20) + " V " + (b.y - 20)
          : "M " +
            a.x +
            " " +
            (a.y + 20) +
            " V " +
            (a.y + b.y) / 2 +
            " H " +
            (b.x + 28) +
            " V " +
            (b.y - 20);
    const line = vector("path", {
      d: path,
      fill: "none",
      stroke: "currentColor",
      "stroke-width": 1.5,
    });
    if (type === "1対多")
      line.setAttribute("marker-end", "url(#" + markerId + ")");
    canvas.append(line);
  }
  for (const [name, x, y] of d.nodes) {
    const g = vector("g", { transform: "translate(" + x + " " + y + ")" });
    g.append(
      vector("rect", {
        x: -66,
        y: -20,
        width: 132,
        height: 40,
        fill: "white",
        stroke: "currentColor",
      }),
    );
    const label = vector("text", {
      "text-anchor": "middle",
      y: 5,
      "font-size": String(name).length > 8 ? 12 : 15,
    });
    label.textContent = String(name);
    g.append(label);
    canvas.append(g);
  }
  return canvas;
}

function schema(lines: string[]) {
  const frame = el("div", "", "schema-frame");
  for (const line of lines) {
    const [name, rest] = line.slice(0, -1).split("（");
    const row = el("p", name + "（");
    rest.split(", ").forEach((attr, i) => {
      if (i) row.append("，");
      if (attr.startsWith("PK:") || attr.startsWith("FK:")) {
        const pk = attr.startsWith("PK:");
        attr
          .slice(3)
          .split("＋")
          .forEach((key, j) => {
            if (j) row.append("，");
            const alsoForeign =
              (name === "得意先担当者" && key === "得意先コード") ||
              (name === "得意先納品要求" && key === "契約番号");
            const span = el("span", key, pk ? "pk" : "fk");
            if (alsoForeign) span.classList.add("fk");
            row.append(span);
          });
      } else if (attr.startsWith("[") || attr === "属性は非表示") {
        const hidden = attr === "属性は非表示";
        const blank = el(
          "span",
          hidden ? "" : attr.slice(1, -1),
          hidden ? "schema-blank masked" : "schema-blank",
        );
        if (hidden) blank.setAttribute("aria-label", "設問の都合上非表示");
        row.append(blank);
      } else row.append(attr);
    });
    row.append("）");
    frame.append(row);
  }
  const wrap = el("div");
  wrap.append(
    frame,
    el("small", "注記　設問の都合上，網掛け部分は表示していない。"),
  );
  return wrap;
}

const headings = [
  "要求番号",
  "要求納期年月日時分",
  "要求数量",
  "納期調整番号",
  "納品可能年月日時分",
  "納品可能数量",
  "確定フラグ",
  "出荷番号",
];
const sampleRows = [
  [
    "001",
    "2025-01-09 12:00",
    "200",
    "01",
    "2025-01-09 12:00",
    "200",
    "確定",
    "2617",
  ],
  [
    "002",
    "2025-01-12 14:00",
    "300",
    "01",
    "2025-01-12 14:00",
    "300",
    "確定",
    "2879",
  ],
  [
    "003",
    "2025-01-14 11:00",
    "50",
    "01",
    "2025-01-12 14:00",
    "50",
    "確定",
    "2879",
  ],
  [
    "004",
    "2025-01-15 16:00",
    "600",
    "01",
    "2025-01-15 16:00",
    "100",
    "確定",
    "",
  ],
  ["004", "2025-01-15 16:00", "600", "02", "2025-01-16 11:00", "500", "", ""],
];
function schedule() {
  const table = el("table");
  const caption = table.createCaption();
  caption.textContent = "契約番号　000273";
  const head = table.createTHead();
  const groups = head.insertRow();
  for (const [label, count] of [
    ["得意先納品要求", 3],
    ["納期回答", 4],
    ["出荷", 1],
  ] as const) {
    const th = el("th", label);
    th.colSpan = count;
    groups.append(th);
  }
  const cols = head.insertRow();
  for (const label of headings) cols.append(el("th", label));
  const body = table.createTBody();
  sampleRows.forEach((values, i) => {
    const row = body.insertRow();
    values.forEach((v, j) => {
      if ((i === 4 && j < 3) || (i === 2 && j === 7)) return;
      const td = row.insertCell();
      td.textContent = v;
      if ((i === 3 && j < 3) || (i === 1 && j === 7)) td.rowSpan = 2;
    });
  });
  const wrap = el("div", "", "table-scroll");
  wrap.append(table);
  return wrap;
}
function bookletLines(q: Question) {
  return [...q.booklet, ...q.sections.flatMap(section => [
    section.heading, ...section.prompts.flatMap(prompt => prompt.lines),
  ])];
}

export function bookletText(q: Question) {
  if (q.materialBlocks) return q.materialBlocks.map(block => {
    const model = block.diagramIndex === undefined ? undefined : q.diagrams[block.diagramIndex];
    const rows = block.table ? [block.table.headers, ...block.table.rows] : [];
    return [
      block.text, ...(block.underline ? ["下線部：" + block.underline] : []), ...(block.lines ?? []),
      ...rows.map(row => row.map(cell => cell ?? "（網掛け）").join("\t")),
      ...(model ? [JSON.stringify({ entities: model.nodes.map(n => n[0]), relationships: model.fixed })] : []),
      ...(block.description ? [block.description] : []), ...(block.notes ?? []),
    ].join("\n");
  }).join("\n\n");
  if (q.figures) {
    return bookletLines(q).map(line => {
      if (!line.startsWith("@")) return line;
      const fig = q.figures![Number(line.slice(1)) - 1];
      const d = q.diagrams[0];
      return [fig.caption, ...fig.lines, ...(fig.lines.length || !d ? [] : [
        d.nodes.map(n => n[0]).join("、"), JSON.stringify(d.fixed),
      ])].join("\n");
    }).join("\n\n");
  }
  const figures = [
    q.diagrams[0].nodes.map((n) => n[0]).join("、") +
      "\n" +
      JSON.stringify(q.diagrams[0].fixed),
    q.schema.join("\n"),
    [
      "契約番号 000273",
      headings.join(" | "),
      ...sampleRows.map((row) => row.join(" | ")),
    ].join("\n"),
    q.diagrams[1].nodes.map((n) => n[0]).join("、"),
  ];
  return bookletLines(q)
    .map((line) =>
      line.startsWith("@")
        ? captions[Number(line.slice(1)) - 1] +
          "\n" +
          figures[Number(line.slice(1)) - 1]
        : line,
    )
    .join("\n\n");
}
// Keep the printed labels in URLs so a copied link identifies the same step or entity.
function figureParts(figure: Element) {
  const parts = new Map<string, Set<Element>>();
  function add(label: string | null, element: Element) {
    const key = label?.trim();
    if (!key) return;
    if (!parts.has(key)) parts.set(key, new Set());
    parts.get(key)!.add(element);
  }
  for (const part of figure.querySelectorAll("[data-figure-part]"))
    add(part.getAttribute("data-figure-part"), part);
  for (const group of figure.querySelectorAll("svg g:has(> rect):has(> text)"))
    add(group.querySelector("text")!.textContent, group);
  const lines = figure.querySelectorAll(".schema-frame > pre, .schema-frame > p");
  for (const [index, line] of lines.entries()) {
    add("本文の" + (index + 1) + "行目", line);
    const text = line.textContent.trim();
    const name = /^([①-⑳](?:-\d+)?|[^（(\s]+(?=[（(]))/.exec(text);
    if (name) add(name[1], line);
    const clause = /^(SELECT|FROM|WHERE|AND|UPDATE|GROUP BY|ORDER BY|HAVING)\b/i.exec(text);
    if (clause) add(clause[1].toUpperCase(), line);
  }
  for (const row of figure.querySelectorAll("tbody > tr")) {
    if (row instanceof HTMLTableRowElement) add("表の" + (row.sectionRowIndex + 1) + "行目", row);
    const cell = row.firstElementChild;
    if (cell && cell.textContent.trim().length <= 30) add(cell.textContent, row);
  }
  for (const blank of figure.querySelectorAll(".schema-blank:not(.masked)"))
    add(blank.textContent, blank);
  return parts;
}

export function showFigure(number: number, labels: string[] = []) {
  const figure = document.getElementById("paper-figure-" + number);
  if (!figure) return;
  const parts = figureParts(figure);
  const selected = labels.flatMap(label => [...(parts.get(label) ?? [])]).filter(el => el.getClientRects().length);
  const targets = selected.length ? selected : [figure];
  showPaperTarget(figure.id, targets[0]);
  for (const target of targets) target.classList.add("paper-figure-selected");
}
export function showPaperTarget(id: string, target?: Element) {
  const figure = target ?? document.getElementById(id);
  const paper = figure?.closest<HTMLElement>(".paper-viewport");
  if (!paper || !figure) return;
  for (const old of paper.querySelectorAll(".paper-figure-selected")) old.classList.remove("paper-figure-selected");
  figure.setAttribute("tabindex", "-1");
  if (figure instanceof HTMLElement || figure instanceof SVGElement) figure.focus({preventScroll: true});
  paper.scrollTop += figure.getBoundingClientRect().top - paper.getBoundingClientRect().top - 10;
  if (matchMedia("(max-width: 900px)").matches)
    paper.closest(".materials")?.scrollIntoView({block: "start"});
}

export function figureReferences(line: string, q: Question, followingText?: string) {
  const content = document.createDocumentFragment();
  let offset = 0;
  const titles = q.figures?.map(fig => fig.caption) ?? captions;
  for (const match of line.matchAll(/([図表][ \t　]*[0-9０-９]+)(?:\{([^}]+)\})?/g)) {
    const number = titles.findIndex(title => /^[図表]\s*\d+/.exec(title.normalize("NFKC"))?.[0].replace(/\s/g, "") === match[1].normalize("NFKC").replace(/\s/g, "")) + 1;
    if (!number) continue;
    const labels = match[2]?.split("|") ?? [];
    if (followingText !== undefined && !labels.length) {
      const figure = document.getElementById("paper-figure-" + number);
      if (figure) {
        const after = (line.slice(match.index + match[0].length) + followingText).replace(/^(?:中の|では|から|の|で|は|に)?[\s「［“]*/, "");
        const label = [...figureParts(figure).keys()].sort((a, b) => b.length - a.length)
          .find(key => after.startsWith(key) && !(/[A-Za-z0-9]$/.test(key) && /^[A-Za-z0-9]/.test(after.slice(key.length))));
        if (label) labels.push(label);
      }
    }
    const params = new URLSearchParams({figure: String(number)});
    for (const label of labels) params.append("part", label);
    const anchor = link(match[1], location.pathname + "?" + params);
    anchor.title = [titles[number - 1], ...labels].join(" ／ ");
    anchor.onclick = event => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      showFigure(number, labels);
    };
    content.append(line.slice(offset, match.index), anchor);
    offset = match.index + match[0].length;
  }
  content.append(line.slice(offset));
  return content;
}

function sqlTable(sql: string) {
  const table = el("table", "", "sql-table");
  const head = table.createTHead().insertRow();
  head.append(el("th", "SQL"), el("th", "SQL文の構文（上段：目的，下段：構文）"));
  for (const block of sql.split("\n\n")) {
    const [heading, ...lines] = block.split("\n");
    const [name, purpose] = heading.split("　");
    const body = table.createTBody();
    const row = body.insertRow();
    const label = el("th", name);
    label.scope = "rowgroup";
    label.rowSpan = 2;
    row.append(label, el("td", purpose));
    const code = el("pre");
    const text = lines.join("\n");
    const start = text.indexOf("㋐");
    if (start < 0) code.textContent = text;
    else {
      const end = text.indexOf(" AS 中央移動平均", start);
      const formula = el("u", text.slice(start, end));
      formula.dataset.figurePart = "㋐";
      code.append(text.slice(0, start), formula, text.slice(end));
    }
    body.insertRow().insertCell().append(code);
  }
  return table;
}

function archiveText(value: string) {
  const node = schemaPreview(value);
  for (const child of Array.from(node.childNodes)) {
    if (!(child instanceof Text)) continue;
    const parts = child.data.split(/(【網掛け】|［\s*[a-zA-Zア-ヶあ-ん]\s*］)/);
    if (parts.length === 1) continue;
    child.replaceWith(...parts.map((part, i) => {
      if (i % 2 === 0) return part;
      if (part.startsWith("［")) return el("span", part.slice(1, -1).trim(), "schema-blank");
      const mask = el("span", "", "schema-blank masked");
      mask.setAttribute("role", "img");
      mask.setAttribute("aria-label", "網掛け（非表示）");
      return mask;
    }));
  }
  return node;
}

function withUnderline(text: string, underline: string | undefined, render: (s: string) => Node) {
  const at = underline ? text.indexOf(underline) : -1;
  if (!underline || at < 0) return render(text);
  const result = document.createDocumentFragment(), mark = el("u");
  mark.append(render(underline));
  result.append(render(text.slice(0, at)), mark, render(text.slice(at + underline.length)));
  return result;
}

function archiveTables(caption: string, data: NonNullable<MaterialBlock["table"]>, underline?: string) {
  const columns = data.headers.map((_, i) => i);
  function tableFor(indices: number[], title: string) {
    const table = el("table", "", "archive-table");
    table.createCaption().textContent = title;
    const header = table.createTHead().insertRow();
    for (const index of indices) {
      const th = el("th", data.headers[index]);
      th.scope = "col";
      header.append(th);
    }
    const body = table.createTBody();
    for (const [rowIndex, cells] of data.rows.entries()) {
      const row = body.insertRow();
      for (const index of indices) {
        const cell = row.insertCell(), value = cells[index];
        cell.dataset.figurePart = (rowIndex + 1) + "行" + (index + 1) + "列";
        if (value === null) {
          cell.className = "masked";
          cell.setAttribute("aria-label", "網掛け（非表示）");
        } else {
          const content = archiveText(value ?? "");
          if (underline) for (const child of Array.from(content.childNodes)) {
            if (child instanceof Text && child.data.includes(underline))
              child.replaceWith(withUnderline(child.data, underline, s => document.createTextNode(s)));
          }
          cell.append(content);
        }
      }
    }
    return table;
  }
  const full = tableFor(columns, caption);
  if (columns.length < 8) return full;
  // A CRUD matrix may have fourteen columns. On narrow paper panels repeat the
  // row key in each band; readers can still compare cells without panning.
  const wrap = el("div", "", "wide-matrix"), bands = el("div", "", "matrix-bands");
  for (let i = 1; i < columns.length; i += 4) {
    const group = columns.slice(i, i + 4);
    bands.append(tableFor([0, ...group], caption + "（" + data.headers[i] + "～" + data.headers[group.at(-1)!] + "）"));
  }
  wrap.append(full, bands);
  return wrap;
}

export function materials(q: Question, reviewing: boolean, evidence: ReadonlyMap<string, string>) {
  const box = el("aside", "", "card materials"),
    bar = el("div", "", "paper-bar");
  const source = link("IPA原本 ↗", q.paper);
  source.target = "_blank";
  source.rel = "noopener";
  bar.append(el("h2", "問題資料"), source);
  const paper = el("article", "", "paper-viewport");
  paper.tabIndex = 0;
  paper.setAttribute("aria-label", q.source + "の問題本文");
  function renderPassage(line: string, underline?: string) {
    const result = document.createDocumentFragment();
    const underlineStart = underline ? line.indexOf(underline) : -1;
    function render(start: number, end: number) {
      const text = line.slice(start, end);
      if (!underline || underlineStart < 0) return figureReferences(text, q);
      const from = Math.max(start, underlineStart);
      const to = Math.min(end, underlineStart + underline.length);
      return withUnderline(text, from < to ? line.slice(from, to) : undefined, part => figureReferences(part, q));
    }
    const matches = reviewing ? Array.from(evidence, ([quote, id]) => ({
      quote, id, start: line.indexOf(quote),
    })).filter(match => match.start >= 0).sort((a, b) => a.start - b.start) : [];
    let offset = 0;
    for (const {quote, id, start} of matches) {
      result.append(render(offset, start));
      const mark = el("mark", "", "paper-evidence");
      mark.append(render(start, start + quote.length));
      mark.id = "paper-evidence-" + id;
      mark.tabIndex = -1;
      result.append(mark);
      offset = start + quote.length;
    }
    result.append(render(offset, line.length));
    return result;
  }
  if (q.materialBlocks) {
    for (const block of q.materialBlocks) {
      const item = el(block.illustration || block.diagramIndex !== undefined || block.lines || block.table ? "figure" : block.heading ? "h3" : "p");
      if (block.reference) item.id = "paper-figure-" + block.reference;
      if (block.diagramIndex !== undefined) {
        item.append(diagram(q.diagrams[block.diagramIndex], [], undefined, "paper"), el("figcaption", block.text));
      } else if (block.lines) {
        const frame = el("div", "", "schema-frame archive-lines");
        for (const line of block.lines) frame.append(archiveText(line));
        item.append(frame, el("figcaption", block.text));
      } else if (block.table) {
        item.append(archiveTables(block.text, block.table, block.underline));
      } else if (block.illustration && block.illustrationParts && reviewing) {
        const svg = vector("svg", { viewBox: block.illustrationParts.viewBox, class: "paper-illustration", role: "img", "aria-label": block.description ?? block.text });
        const [x, y, width, height] = block.illustrationParts.viewBox.split(" ");
        svg.append(vector("image", {href: block.illustration, x, y, width, height}));
        for (const [name, path] of Object.entries(block.illustrationParts.paths))
          svg.append(vector("path", {d: path, class: "paper-overlay", "data-figure-part": name}));
        item.append(svg, el("figcaption", block.text));
      } else if (block.illustration) {
        const image = el("img");
        image.src = block.illustration;
        image.alt = block.description ?? block.text;
        image.loading = "lazy";
        item.append(image, el("figcaption", block.text));
      } else item.append(renderPassage(block.text, block.underline));
      paper.append(item);
      for (const [i, note] of (block.notes ?? []).entries()) {
        const paragraph = el("p", note, "paper-note");
        paragraph.dataset.figurePart = "注記" + (i + 1);
        if (block.reference) item.append(paragraph);
        else paper.append(paragraph);
      }
    }
    box.append(bar, paper);
    return box;
  }
  for (const line of bookletLines(q)) {
    if (line.startsWith("@")) {
      const n = Number(line.slice(1));
      const fig = el("figure");
      fig.id = "paper-figure-" + n;
      if (q.figures) {
        const {caption, lines} = q.figures[n - 1];
        const frame = el("div", "", "schema-frame");
        for (const text of lines) frame.append(schemaPreview(text));
        const body = caption.startsWith("表1") ? sqlTable(lines[0])
          : lines.length ? frame : diagram(q.diagrams[0], [], undefined, "paper");
        fig.append(body, el("figcaption", caption));
      } else fig.append(
        n === 1
          ? model(q.diagrams[0])
          : n === 2
            ? schema(q.schema)
            : n === 3
              ? schedule()
              : model(q.diagrams[1]),
        el("figcaption", captions[n - 1]),
      );
      paper.append(fig);
    } else {
      const tag = /^(問[1-3]|〔|設問)/.test(line) ? "h3" : /^\d．/.test(line) ? "h4" : "p";
      const paragraph = el(tag, "", /^[(①②③]/.test(line) ? "clause" : "");
      const marked = "㋑索引の更新頻度の増加";
      paragraph.append(renderPassage(line, marked));
      paper.append(paragraph);
    }
  }
  box.append(bar, paper);
  return box;
}
