import { el } from "./dom";
import type { RecordData } from "./store";

const parts = [
  ["AX/P1", 99, 141], ["AX/P4", 160, 141], ["AX/P9", 219, 141],
  ["AX/P1/P2", 69, 205], ["AX/P1/P9", 129, 205], ["AX/P1/P2/P3", 69, 254],
  ["AZ/P3", 312, 141], ["AZ/P7", 370, 141], ["AZ/P9", 429, 141],
  ["AZ/P7/P2", 340, 205], ["AZ/P7/P4", 400, 205], ["AZ/P7/P2/P3", 340, 254],
] as const;
const correct = new Set(["AX/P4", "AX/P9", "AZ/P9", "AZ/P7/P4"]);

export function treeAnswer(record: RecordData, official = false) {
  return parts.map(([path]) => path).filter(path => official ? correct.has(path) : record.fields["tree-" + path] === "○").join("、");
}

export function partTree(record: RecordData, save: () => void, reviewing: boolean) {
  const section = el("div", "", "part-tree");
  if (!reviewing) section.append(el("p", "図4で対象の部品を選んで丸を付けます。もう一度選ぶと丸が外れます。"));
  function tree(solution: boolean) {
    const frame = el("div", "", "part-tree-figure");
    const ns = "http://www.w3.org/2000/svg";
    const picture = document.createElementNS(ns, "svg");
    picture.setAttribute("viewBox", "0 0 540 325");
    picture.setAttribute("role", "img");
    picture.setAttribute("aria-label", "図4　デッドロックのケース2。製品AXとAZの部品構成");
    picture.style.display = "block";
    picture.style.width = "100%";
    const nodes: [string, number, number][] = [["AX", 160, 78], ["AZ", 370, 78], ...parts.map(([id,x,y]) => [id,x,y] as [string,number,number])];
    for (const [id, x, y] of nodes) {
      const children = nodes.filter(([child]) => child.slice(0, child.lastIndexOf("/")) === id && child.includes("/"));
      if (children.length) {
        const branchY = (y + children[0][2]) / 2;
        const path = document.createElementNS(ns, "path");
        path.setAttribute("d", "M" + x + "," + (y+16) + "V" + branchY + children.map(([,cx,cy]) =>
          "M" + x + "," + branchY + "H" + cx + "V" + (cy-17)).join(""));
        path.setAttribute("stroke", "currentColor");
        path.setAttribute("stroke-width", "2");
        path.setAttribute("fill", "none");
        picture.append(path);
      }
      const label = document.createElementNS(ns, "text");
      label.setAttribute("x", String(x));
      label.setAttribute("y", String(y+8));
      label.setAttribute("text-anchor", "middle");
      label.setAttribute("font-size", "24");
      label.textContent = id.split("/").at(-1)!;
      picture.append(label);
    }
    const caption = document.createElementNS(ns, "text");
    caption.setAttribute("x", "270");
    caption.setAttribute("y", "308");
    caption.setAttribute("text-anchor", "middle");
    caption.setAttribute("font-size", "19");
    caption.textContent = "図4　デッドロックのケース2";
    picture.append(caption);
    frame.append(picture);
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
  if (reviewing) {
    const own = el("div", "", "own-answer");
    own.append(el("h4", "自分の答案"), tree(false));
    section.append(own, el("h4", "IPA解答例"), tree(true));
  } else section.append(tree(false));
  return section;
}
