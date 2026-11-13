import { el } from "./dom";
import type { RecordData } from "./store";

const parts = [
  ["AX/P1", 99, 141], ["AX/P4", 160, 141], ["AX/P9", 219, 141],
  ["AX/P1/P2", 69, 205], ["AX/P1/P9", 129, 205], ["AX/P1/P2/P3", 69, 254],
  ["AZ/P3", 312, 141], ["AZ/P7", 370, 141], ["AZ/P9", 429, 141],
  ["AZ/P7/P2", 340, 205], ["AZ/P7/P4", 400, 205], ["AZ/P7/P2/P3", 340, 254],
] as const;
const correct = new Set(["AX/P4", "AX/P9", "AZ/P9", "AZ/P7/P4"]);

export function partTree(record: RecordData, save: () => void, reviewing: boolean) {
  const section = el("div", "", "part-tree");
  if (!reviewing) section.append(el("p", "図4で対象の部品を選んで丸を付けます。もう一度選ぶと丸が外れます。"));
  function tree(solution: boolean) {
    const frame = el("div", "", "part-tree-figure");
    const image = el("img");
    image.src = "/archive/2019/models/deadlock.webp";
    image.alt = "図4　デッドロックのケース2。製品AXとAZの部品構成";
    frame.append(image);
    for (const [path, x, y] of parts) {
      const key = "tree-" + path;
      const mark = el("button");
      mark.type = "button";
      mark.style.left = x / 540 * 100 + "%";
      mark.style.top = y / 325 * 100 + "%";
      mark.setAttribute("aria-label", path.split("/").join("の子 "));
      mark.setAttribute("aria-pressed", String(solution ? correct.has(path) : record.fields[key] === "○"));
      mark.disabled = reviewing;
      mark.onclick = () => {
        const selected = record.fields[key] !== "○";
        if (selected) record.fields[key] = "○";
        else delete record.fields[key];
        mark.setAttribute("aria-pressed", String(selected));
        save();
      };
      frame.append(mark);
    }
    return frame;
  }
  section.append(tree(false));
  if (reviewing) section.append(el("h4", "IPA解答例"), tree(true));
  return section;
}
