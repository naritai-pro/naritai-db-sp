import { relationshipPath, straightSegments, type Segment, type Box } from "./relationship-path";
import type { Diagram } from "./exam";
import type { Edge } from "./store";
import { el } from "./dom";
import { diagramScoringNotice } from "./diagram-scoring";


const answerStrokeWidth = 2;

function svg(tag: string, attrs: Record<string, string | number> = {}) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [key, val] of Object.entries(attrs))
    node.setAttribute(key, String(val));
  return node;
}

function onDiagramKeydown(event: KeyboardEvent) {
  if (!["1", "2", "3"].includes(event.key) || event.isComposing || event.defaultPrevented ||
      event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
  const target = event.target;
  if (!(target instanceof Element) ||
      target.closest('textarea, select, input:not([type="radio"]), [contenteditable="true"]')) return;

  const frames = Array.from(document.querySelectorAll<HTMLElement>(".canvas:has(.relation-switch)"));
  const visible = frames.filter(frame => {
    const rect = frame.getBoundingClientRect();
    return rect.top < innerHeight && rect.bottom > 0;
  });
  const frame = visible.find(frame => frame.matches(":hover")) ??
    visible.find(frame => frame.contains(target)) ?? visible[0];
  const radio = frame?.querySelectorAll<HTMLInputElement>(".relation-switch input")[Number(event.key) - 1];
  if (radio) {
    event.preventDefault();
    radio.click();
    radio.focus({preventScroll: true});
  }
}
document.addEventListener("keydown", onDiagramKeydown);
if (import.meta.hot) import.meta.hot.dispose(() => document.removeEventListener("keydown", onDiagramKeydown));

export function diagram(d: Diagram, additions: Edge[], onChange?: () => void, presentation: "sheet" | "paper" | "solution" = "sheet", labels?: () => Record<string, string>, estimatedPoints?: number) {
  if (presentation !== "paper" && d.sheetLayout) {
    d = { ...d, ...d.sheetLayout, fixedPath: undefined, solutionPath: undefined };
  }
  const panel = el("div", "", "diagram");
  const canvas = svg("svg", {
    viewBox: d.viewBox ?? ("0 0 700 " + (d.section === 2 ? 296 : 130)),
    "aria-label": d.title,
  });
  const halfWidth = d.boxSize ? d.boxSize[0] / 2 : d.routes ? 35 : 66;
  const halfHeight = d.boxSize ? d.boxSize[1] / 2 : d.routes ? 14 : 20;
  const boxes = new Map(d.nodes.map(([id, x, y]) => {
    const [width, height] = d.nodeSizes?.[id] ?? [halfWidth * 2, halfHeight * 2];
    return [String(id), { x: Number(x), y: Number(y), width, height }] as const;
  }));
  const obstacles = Array.from(boxes.values());
  const sheetLanes = Object.values(d.sheetLayout?.routes ?? {}).flatMap(straightSegments);
  let occupied: Segment[] = [];
  const grayLines = svg("g", { "pointer-events": "none" });
  function addedPath(a: string, b: string | null, target: Box, type: string, earlier: string[][]) {
    const parent = boxes.get(a)!;
    const count = d.allowParallel ? earlier.filter(([from, to]) =>
      (from === a && to === b) || (from === b && to === a)).length : 0;
    if (type !== "サブタイプ") {
      const sheetRoute = b && d.sheetLayout?.routes?.[[a,b,type].join("|")];
      if (sheetRoute && count === 0) return {path: sheetRoute, stem: "", symbol: ""};
      return {path: relationshipPath(parent, target, obstacles, count, occupied), stem: "", symbol: ""};
    }
    const previous = earlier.slice(d.fixed.length).find(([from,,kind]) => from === a && kind === type);
    const existing = d.subtypeJunctions?.[a];
    const firstChild = previous ? boxes.get(previous[1]) ?? target : target;
    const sign = firstChild.y >= parent.y ? 1 : -1;
    const side = parent.y + sign * parent.height/2;
    // Offset the trunk if an existing vertical connection already uses the central port.
    const x = existing?.[0] ?? ([0, -.24, .24, -.4, .4].map(n => parent.x + n*parent.width)
      .find(port => !occupied.some(([p,q]) => p.x === q.x && Math.abs(p.x-port)<3 &&
        Math.max(p.y,q.y)>Math.min(side,side+sign*16) && Math.min(p.y,q.y)<Math.max(side,side+sign*16))) ?? parent.x);
    const y = existing?.[1] ?? side+sign*16;
    const junction = {x,y,width:0,height:0};
    const path = relationshipPath(junction, target, obstacles, count, occupied);
    if (existing || previous) return {path, stem:"", symbol:""};
    return {path, stem:'M'+x+' '+side+' V'+(y-sign*10),
      symbol:'M'+x+' '+(y-sign*10)+' l-5 '+(sign*10)+' h10 Z'};
  }
  const frame = el("div", "", d.routes ? "canvas detailed-model" : "canvas");
  frame.append(canvas);
  const message = el("div", "", "feedback");
  message.setAttribute("role", "status");
  const markerId = "head-" + crypto.randomUUID();
  function removeEdge(index: number) {
    additions.splice(index, 1);
    message.textContent = "関係を削除しました。";
    onChange?.();
    draw();
  }
  let sourceMark = "○", targetMark = "○";
  function draw() {
    const defs = svg("defs");
    for (const [suffix, color] of [
      ["fixed", "#66777b"],
      ["added", "#097464"],
    ]) {
      const marker = svg("marker", {
        id: markerId + suffix,
        viewBox: "0 0 10 10",
        refX: 9,
        refY: 5,
        markerWidth: suffix === "added" ? 5 : 6,
        markerHeight: suffix === "added" ? 5 : 6,
        orient: "auto",
      });
      marker.append(
        svg("path", {
          d: "M 1 1 L 9 5 L 1 9",
          fill: "none",
          stroke: color,
          "stroke-width": 1.8,
        }),
      );
      defs.append(marker);
    }
    canvas.replaceChildren(defs);
    if (d.background) {
      const [, , width, height] = d.viewBox!.split(" ");
      canvas.append(svg("image", {href: d.background, width, height, "pointer-events": "none"}));
    }
    grayLines.replaceChildren();
    const symbols = svg("g", { "pointer-events": "none" });
    occupied = [...straightSegments(d.fixedPath ?? ""), ...sheetLanes];
    for (const r of d.regions ?? []) {
      const outline = svg("rect", {x:r.x, y:r.y, width:r.width, height:r.height, rx:8, fill:"none", stroke:"currentColor"});
      const caption = svg("text", {x:r.x+r.width/2, y:r.bottom ? r.y+r.height-5 : r.y+19, "text-anchor":"middle", "font-size":16});
      caption.textContent = r.label;
      canvas.append(outline, caption);
    }
    for (const {x, y, text} of d.annotations ?? []) {
      const label = svg("text", {x, y, "text-anchor":"middle", "font-size":17});
      label.textContent = text;
      canvas.append(label);
    }
    if (d.fixedPath) grayLines.append(svg("path", {d: d.fixedPath, fill: "none", stroke: "#66777b", "stroke-width": 1.6}));
    if (presentation === "paper") for (const [name, path] of Object.entries(d.fixedParts ?? {})) {
      grayLines.append(svg("path", {d: path, class: "paper-overlay", "data-figure-part": name}));
    }
    if (presentation === "solution" && d.solutionPath)
      canvas.append(svg("path", {d: d.solutionPath, fill: "none", stroke: "#097464", "stroke-width": answerStrokeWidth}));
    for (const [cx, cy, r] of d.fixedOpenDots ?? []) grayLines.append(svg("circle", {cx, cy, r, fill: "white", stroke: "#66777b", "stroke-width": 1.6}));
    for (const [cx, cy, r] of d.fixedDots ?? []) grayLines.append(svg("circle", {cx, cy, r, fill: "#66777b"}));
    if (presentation === "solution") {
      for (const [cx, cy, r] of d.solutionOpenDots ?? []) canvas.append(svg("circle", {cx, cy, r, fill: "white", stroke: "#097464", "stroke-width": answerStrokeWidth}));
      for (const [cx, cy, r] of d.solutionDots ?? []) canvas.append(svg("circle", {cx, cy, r, fill: "#097464"}));
    }
    const names = presentation === "solution" && d.solutionLabels ? d.solutionLabels : labels?.() ?? {};
    const all = [...d.fixed, ...additions];
    all.forEach(([a, b, savedType], i) => {
      const [type, firstMark, lastMark] = savedType.split("|");
      if ((i < d.fixed.length && d.fixedPath) || (presentation === "solution" && d.solutionPath)) return;
      const start = d.nodes.find((n) => n[0] === a),
        end = d.nodes.find((n) => n[0] === b);
      if (!start || !end) return;
      const x = Number(start[1]),
        y = Number(start[2]),
        dx = Number(end[1]) - x,
        dy = Number(end[2]) - y;
      const startSize = d.nodeSizes?.[a] ?? [halfWidth * 2, halfHeight * 2];
      const endSize = d.nodeSizes?.[b] ?? [halfWidth * 2, halfHeight * 2];
      const fixed = i < d.fixed.length;
      let symbol = "", stem = "";
      let path = d.routes?.[[a,b,type].join("|")];
      const pair = (edge: string[]) => (edge[0] === a && edge[1] === b) || (edge[1] === a && edge[0] === b);
      const previous = all.slice(0, i).filter(pair).length;
      if (!fixed && presentation !== "solution") {
        ({path, symbol, stem} = addedPath(a, b, boxes.get(b)!, type, all.slice(0, i)));
      } else if (a === b) {
        const right = x + startSize[0] / 2, top = y - startSize[1] / 2, arm = 12 + previous * 8;
        path ??= "M" + right + " " + y + "h" + arm + "V" + (top-arm) + "H" + x + "V" + top;
      } else {
        const inset = Math.min(startSize[0] / 2 / Math.abs(dx), startSize[1] / 2 / Math.abs(dy));
        const endInset = Math.min(endSize[0] / 2 / Math.abs(dx), endSize[1] / 2 / Math.abs(dy));
        const x1 = x + dx * inset, y1 = y + dy * inset;
        const x2 = x + dx * (1 - endInset), y2 = y + dy * (1 - endInset);
        const midX = (x1+x2)/2, midY = (y1+y2)/2;
        if (previous && d.allowParallel) {
          const offset = 26 * Math.ceil(previous / 2) * (previous % 2 ? 1 : -1) * (a < b ? 1 : -1) / Math.hypot(dx, dy);
          path = "M"+x1+" "+y1+" Q"+(midX-dy*offset)+" "+(midY+dx*offset)+" "+x2+" "+y2;
        }
        const triangle = type === "サブタイプ" ? " M"+midX+" "+(midY-4)+" l-4 8 h8 Z" : "";
        path ??= "M"+x1+" "+y1+" L"+x2+" "+y2+triangle;
      }
      const line = svg("path", {
        d: path,
        fill: "none",
        stroke: fixed ? "#66777b" : "#097464",
        "stroke-width": fixed ? 1.8 : answerStrokeWidth,
      });
      if (presentation === "paper") line.setAttribute("data-figure-part", a + "→" + b);
      if (type === "1対多")
        line.setAttribute(
          "marker-end",
          "url(#" + markerId + (fixed ? "fixed" : "added") + ")",
        );
      if (fixed) {
        occupied.push(...straightSegments(path));
        grayLines.append(line);
      } else {
        canvas.append(line);
        if (firstMark && lastMark) {
          const curve = line as SVGPathElement;
          const length = curve.getTotalLength();
          for (const [distance, mark] of [[Math.min(10, length / 3), firstMark], [Math.max(length - 10, 2 * length / 3), lastMark]] as const) {
            const point = curve.getPointAtLength(distance);
            canvas.append(svg("circle", {cx: point.x, cy: point.y, r: 3.5,
              stroke: "#097464", fill: mark === "○" ? "white" : "#097464", "pointer-events": "none"}));
          }
        }
      }
      if (stem) canvas.append(svg("path", { d: stem, fill: "none", stroke: "#097464", "stroke-width": answerStrokeWidth }));

      if (symbol) symbols.append(svg("path", { d: symbol, class: "subtype-symbol" }));
      if (!fixed && onChange) {
        const hit = line.cloneNode(false) as SVGPathElement;
        if (stem && additions.filter(([from,,kind]) => from === a && kind === type).length === 1)
          hit.setAttribute("d", path + stem);
        hit.removeAttribute("marker-end");
        hit.setAttribute("stroke", "transparent");
        hit.setAttribute("stroke-width", "16");
        hit.setAttribute("pointer-events", "stroke");
        hit.style.cursor = "pointer";
        const title = svg("title");
        title.textContent = a + "と" + b + "の関係を削除";
        hit.append(title);
        hit.setAttribute("tabindex", "0");
        hit.setAttribute("role", "button");
        hit.setAttribute("aria-label", title.textContent);
        hit.addEventListener("keydown", event => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            removeEdge(i - d.fixed.length);
          }
        });
        hit.addEventListener("click", () => removeEdge(i - d.fixed.length));
        canvas.append(hit);
      }
    });
    canvas.append(grayLines, symbols);
    for (const [label, x, y] of d.nodes) {
      const id = String(label);
      const name = names[id] || id;
      const [width, height] = d.nodeSizes?.[id] ?? [halfWidth * 2, halfHeight * 2];
      const g = svg("g", { transform: "translate(" + x + " " + y + ")" });
      g.append(
        svg("rect", {
          x: -width / 2,
          y: -height / 2,
          width,
          height,
          fill: "#fff",
          stroke: "#687f83",
        }),
      );
      const lines = name === id ? d.labelLines?.[id] : undefined;
      const fontSize = d.nodeSizes || name !== id ? Math.min(d.fontSize ?? 12, height / ((lines?.length ?? 1) + .2),
        (width - 5) / Math.max(...(lines ?? [name]).map(line => Array.from(line).reduce(
          (length, char) => length + (char.charCodeAt(0) < 128 ? .65 : 1), 0))))
        : d.routes ? 10 : name.length > 8 ? 12 : 14;
      const text = svg("text", {
        "text-anchor": "middle",
        y: fontSize * .35,
        "font-size": fontSize,
      });
      if (lines) {
        lines.forEach((line, index) => {
          const span = svg("tspan", { x: 0, y: fontSize * (.34 + (index - (lines.length - 1) / 2) * 1.04) });
          span.textContent = line;
          text.append(span);
        });
      } else {
        text.textContent = name;
      }
      if (d.background && !d.extraNodes?.includes(id) && name === id) {
        const box = g.firstElementChild!;
        box.setAttribute("fill", "transparent");
        box.setAttribute("stroke", "none");
        const tooltip = svg("title");
        tooltip.textContent = id;
        g.append(tooltip);
      } else g.append(text);
      if (d.background && name !== id) g.classList.add("filled-entity");
      if (onChange) {
        g.classList.add("selectable");
        g.setAttribute("data-entity", id);
      }
      canvas.append(g);
    }
  }
  if (presentation === "paper") {
    draw();
    canvas.classList.add("paper-model");
    canvas.setAttribute("role", "img");
    return canvas;
  }
  const title = el("h3", d.title);
  if (estimatedPoints !== undefined) {
    title.className = "scored-diagram-title";
    title.append(el("span", "予想配点 " + estimatedPoints + "点", "diagram-score"));
  }
  panel.append(title);
  if (d.answer.length) panel.append(diagramScoringNotice());
  panel.append(frame);
  const footer = el("div", "", "diagram-footer");
  const legend = el("div", "", "diagram-legend");
  const symbols = [
    ["1対1", "M2 7 H28"],
    ["1対多", "M2 7 H28 M20 3 L28 7 L20 11"],
  ];
  if (d.routes) symbols.push(["サブタイプ", "M9 12 L15 2 L21 12 Z"]);
  for (const [label, path] of symbols) {
    const item = el("span", label);
    const icon = svg("svg", { viewBox: "0 0 30 14", width: 30, height: 14, "aria-hidden": "true" });
    icon.append(svg("path", { d: path, fill: "none", stroke: "currentColor", "stroke-width": 1.6 }));
    item.append(icon);
    legend.append(item);
  }
  footer.append(legend);
  frame.append(footer);
  if (onChange) {
    let kind = "1対多";
    function connect(a: string, b: string) {
      if (!a || !b || (a === b && !d.selfRelations?.includes(a))) {
        message.textContent = "異なる始点・終点と関係の種類を選んでください。";
        return;
      }
      if (
        !d.allowParallel && [...(d.fixedPath ? [] : d.fixed), ...additions].some(
          ([s, t]) => (s === a && t === b) || (s === b && t === a),
        )
      ) {
        message.textContent = "この組には既に関係があります。";
        return;
      }
      additions.push([a, b, d.endpointMarks ? [kind, sourceMark, targetMark].join("|") : kind]);
      message.textContent = "関係を追加しました。";
      onChange?.();
      draw();
    }
    const surface = canvas as SVGSVGElement;
    let drag: { id: number; source: string; guide: SVGElement; line: SVGElement; symbol: SVGElement; leftSource: boolean } | undefined;
    function entityAt(x: number, y: number) {
      const target = document.elementFromPoint(x, y)?.closest("[data-entity]");
      return target && canvas.contains(target)
        ? target.getAttribute("data-entity")
        : null;
    }
    surface.onpointerdown = (event) => {
      if (drag || event.button !== 0) return;
      const source = entityAt(event.clientX, event.clientY);
      if (!source) return;
      const guide = svg("g", {"pointer-events": "none"});
      const line = svg("path", {
        fill: "none",
        stroke: "#097464",
        "stroke-width": answerStrokeWidth,
        "pointer-events": "none",
      });
      if (kind === "1対多")
        line.setAttribute("marker-end", "url(#" + markerId + "added)");
      const symbol = svg("path", { class: "subtype-symbol" });
      guide.append(line, symbol);
      surface.insertBefore(guide, grayLines);
      drag = { id: event.pointerId, source, guide, line, symbol, leftSource: false };
      surface.setPointerCapture(event.pointerId);
    };
    surface.onpointermove = (event) => {
      if (!drag || drag.id !== event.pointerId) return;
      const target = entityAt(event.clientX, event.clientY);
      if (target !== drag.source) drag.leftSource = true;
      if (target === drag.source && !(drag.leftSource && d.selfRelations?.includes(target))) {
        drag.line.removeAttribute("d");
        drag.symbol.removeAttribute("d");
        return;
      }
      const matrix = surface.getScreenCTM();
      if (!matrix) return;
      const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(
        matrix.inverse(),
      );
      const end = target ? boxes.get(target)! : { x: point.x, y: point.y, width: 0, height: 0 };
      const route = addedPath(drag.source, target, end, kind, [...d.fixed, ...additions]);
      drag.line.setAttribute("d", route.path + route.stem);
      drag.symbol.setAttribute("d", route.symbol);
    };
    surface.onpointerup = (event) => {
      if (!drag || drag.id !== event.pointerId) return;
      const { source, guide, leftSource } = drag;
      drag = undefined;
      guide.remove();
      const target = entityAt(event.clientX, event.clientY);
      if (target && (source !== target || (leftSource && d.selfRelations?.includes(source)))) connect(source, target);
    };
    surface.onlostpointercapture = () => {
      drag?.guide.remove();
      drag = undefined;
    };
    const switcher = el("div", "", "relation-switch");
    switcher.setAttribute("role", "radiogroup");
    switcher.setAttribute("aria-label", "関係の種類");
    const kinds = d.routes ? ["1対1", "1対多", "サブタイプ"] : ["1対1", "1対多"];
    for (const [index, type] of kinds.entries()) {
      const label = el("label");
      const radio = el("input");
      radio.type = "radio";
      radio.name = markerId + "-kind";
      radio.checked = type === kind;
      radio.onchange = () => { kind = type; };
      const key = String(index + 1);
      radio.setAttribute("aria-keyshortcuts", key);
      const caption = el("span", type);
      const shortcut = el("kbd", key);
      shortcut.setAttribute("aria-hidden", "true");
      caption.append(shortcut);
      label.append(radio, caption);
      switcher.append(label);
    }
    const toolbar = el("div", "", "diagram-toolbar");
    toolbar.append(switcher,
      el(
        "p",
        "ドラッグで線を追加、緑の線をクリックで削除。数字キーで切り替え（" +
          kinds.map((type, index) => (index + 1) + "：" + type).join("、") + "）。" +
          (d.selfRelations?.length ? "自己参照は箱の外を経由して同じ箱に戻します。" : ""),
      ),
    );
    if (d.endpointMarks) {
      for (const endpoint of ["始点", "終点"]) {
        const label = el("label", endpoint);
        const select = el("select");
        for (const mark of ["○", "●"]) select.add(new Option(mark === "○" ? "○ ゼロを含む" : "● ゼロを含まない", mark));
        select.onchange = () => {
          if (endpoint === "始点") sourceMark = select.value;
          else targetMark = select.value;
        };
        label.append(select);
        toolbar.append(label);
      }
    }
    frame.prepend(toolbar);
    panel.append(message);
  }
  panel.addEventListener("diagram-labels", draw);
  draw();
  return panel;
}
