import { el } from "./dom";
import type { Question } from "./exam";

type Grid = {
  heading: string;
  columns: string[];
  rows: string[];
  given?: Record<string, string[]>;
  groups?: string[];
};

const circles: Record<string, Grid> = {
  "2016-spring-db-pm1-q2": {
    heading: "契機", rows: ["T1", "T2", "T3", "T4", "T5"],
    columns: ["マスタ更新登録", "商品", "仕入先", "販売先", "受注", "出荷指図", "出荷", "在庫", "発注対象データ", "需要予測", "日別販売実績", "月別販売実績", "分析用データ"],
  },
  "2017-spring-db-pm2-q2": {
    heading: "統合後のエンティティタイプ",
    rows: ["補充要求", "営業所補充要求", "物流センタ補充要求", "補充要求明細", "計画生産品補充要求明細", "補充生産品補充要求明細"],
    columns: ["補充要求", "補充要求明細", "補充要求", "営業所補充要求", "物流センタ補充要求", "補充要求明細"],
    groups: ["計画生産品", "計画生産品", "補充生産品", "補充生産品", "補充生産品", "補充生産品"],
  },
  "2018-spring-db-pm1-q1": {
    heading: "エンティティタイプ名",
    rows: ["商品", "製品", "設置サービス", "本体製品", "オプション製品", "セット製品", "単体製品"],
    columns: ["商品名", "商品区分", "製品区分", "オプション区分", "単体セット製品区分", "シリーズコード", "製品サイズ", "標準設置時間", "設置サービス商品コード", "セット製品本体製品商品コード"],
    given: { 商品: ["商品名"] },
  },
  "2018-spring-db-pm2-q2": {
    heading: "品目", columns: ["受注品目", "投入品目", "製造品目", "発注品目"],
    rows: ["全体設計", "内製ユニット", "購買ユニット", "中間仕掛品", "構成部品", "専用すり合せ部品", "汎用すり合せ部品", "ソフトウェア", "設置・試運転"],
    given: { 全体設計: ["受注品目"], 内製ユニット: ["受注品目", "製造品目"] },
  },
  "2019-spring-db-pm2-q1": {
    heading: "処理名",
    rows: ["処理1", "処理2", "処理3", "処理4", "処理5", "処理6"],
    columns: ["支店", "端末種別", "窓口端末", "取引種別", "取引", "画面", "行員", "行員所属", "ログ収集", "ログ基本", "ログ明細", "ログ関連"],
    given: {
      処理1: ["支店", "取引", "行員", "行員所属", "ログ基本"], 処理2: ["ログ基本"],
      処理3: ["取引", "ログ収集", "ログ基本", "ログ関連"], 処理4: ["取引種別", "取引", "ログ基本", "ログ明細"],
      処理5: ["ログ基本"], 処理6: ["ログ基本"],
    },
  },
  "2019-spring-db-pm2-q2": {
    heading: "解答欄", rows: ["③ 物流の対象物"], columns: ["原材料", "生地材料", "成型材料", "製品"],
  },
};

export function circleTable(q: Question, fields: string[][], values: Record<string,string>, change: (key: string, value: string) => void) {
  const grid = circles[q.id];
  if (!grid) return;
  const keys = new Map<string,string>();
  for (const [key, label] of fields) {
    const choices = q.controls?.[key];
    if (Array.isArray(choices) && choices.includes("○") && choices.includes("（空欄）")) keys.set(label,key);
  }
  if (!keys.size) return;
  const wrap = el("div", "", "circle-table-scroll");
  const table = el("table", "", "circle-table");
  table.createCaption().textContent = "セルを押すと○が付き、もう一度押すと消えます。";
  const head = table.createTHead();
  const top = head.insertRow();
  const corner = el("th", grid.heading);
  corner.scope = "col";
  top.append(corner);
  let titles = top;
  if (grid.groups) {
    corner.rowSpan = 2;
    for (const group of new Set(grid.groups)) {
      const th = el("th", group);
      th.scope = "colgroup";
      th.colSpan = grid.groups.filter(g => g === group).length;
      top.append(th);
    }
    titles = head.insertRow();
  }
  for (const column of grid.columns) {
    const th = el("th", column);
    th.scope = "col";
    titles.append(th);
  }
  const body = table.createTBody();
  for (const rowName of grid.rows) {
    const row = body.insertRow();
    const th = el("th", rowName);
    th.scope = "row";
    row.append(th);
    grid.columns.forEach((column, i) => {
      const label = (grid.groups ? rowName + " ／ " + grid.groups[i] : rowName) + "：" + column;
      const key = keys.get(label);
      const cell = row.insertCell();
      if (!key) {
        cell.className = "circle-given";
        cell.textContent = grid.given?.[rowName]?.includes(column) ? "○" : "";
        return;
      }
      const button = el("button");
      button.type = "button";
      button.setAttribute("aria-label", label);
      const paint = (marked: boolean) => {
        button.textContent = marked ? "○" : "";
        button.setAttribute("aria-pressed", String(marked));
      };
      paint(values[key] === "○");
      button.onclick = () => {
        const marked = values[key] !== "○";
        change(key, marked ? "○" : "（空欄）");
        paint(marked);
      };
      cell.append(button);
    });
  }
  wrap.append(table);
  return {element: wrap, keys: new Set(keys.values()), first: keys.values().next().value};
}
