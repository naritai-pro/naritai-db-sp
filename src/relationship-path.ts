export type Point = { x: number; y: number };
export type Box = Point & { width: number; height: number };

export type Segment = [Point, Point];

// Read the straight segments of the supplied SVG routes, including relative
// commands and implicit line segments following a move.
export function straightSegments(path: string): Segment[] {
  const result: Segment[] = [];
  let x = 0, y = 0, origin: Point = {x, y};
  for (const [, command, args] of path.matchAll(/([MmLlHhVvZzQqCc])([^MmLlHhVvZzQqCc]*)/g)) {
    const values = (args.match(/[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/gi) ?? []).map(Number);
    const op = command.toUpperCase(), relative = op !== command;
    const step = op === "H" || op === "V" ? 1 : op === "Q" ? 4 : op === "C" ? 6 : 2;
    if (op === "Z") { x = origin.x; y = origin.y; continue; }
    for (let i = 0; i + step <= values.length; i += step) {
      const from = {x, y};
      if (op !== "V") x = (relative ? x : 0) + values[i + (step > 2 ? step-2 : 0)];
      if (op !== "H") y = (relative ? y : 0) + values[i + step-1];
      if (op === "M" && i === 0) origin = {x, y};
      else if (step <= 2 && (from.x === x || from.y === y)) result.push([from, {x,y}]);
    }
  }
  return result;
}

export function relationshipPath(start: Box, end: Box, obstacles: Box[], parallel: number, occupied: Segment[]) {
  const lane = Math.ceil(parallel / 2) * (parallel % 2 ? 1 : -1);
  let best: Point[] = [];
  let bestScore = Infinity;

  function consider(points: Point[]) {
    let score = 0;
    const route = points.filter((p, i) => !i || p.x !== points[i-1].x || p.y !== points[i-1].y);
    if (route.length < 2) return;
    for (let i = 1; i < route.length; i++) {
      const p = route[i-1], q = route[i];
      score += Math.abs(p.x-q.x) + Math.abs(p.y-q.y) + 3;
      const axis = p.x === q.x ? "y" : "x", cross = axis === "x" ? "y" : "x";
      for (const [a,b] of occupied) {
        if (a[cross] !== b[cross] || Math.abs(a[cross]-p[cross]) >= 3) continue;
        const overlap = Math.min(Math.max(p[axis],q[axis]), Math.max(a[axis],b[axis]))
          - Math.max(Math.min(p[axis],q[axis]), Math.min(a[axis],b[axis]));
        if (overlap > 0) score += 100 + overlap * 100;
      }
      for (const box of obstacles) {
        if (Math.max(p.x,q.x) > box.x-box.width/2 && Math.min(p.x,q.x) < box.x+box.width/2 &&
            Math.max(p.y,q.y) > box.y-box.height/2 && Math.min(p.y,q.y) < box.y+box.height/2) score += 100000;
      }
    }
    if (score < bestScore) { bestScore = score; best = route; }
  }

  if (start === end) {
    const top = start.y-start.height/2, right = start.x+start.width/2, arm = 12+parallel*8;
    consider([{x:right,y:start.y},{x:right+arm,y:start.y},{x:right+arm,y:top-arm},{x:start.x,y:top-arm},{x:start.x,y:top}]);
  } else {
    // Try a middle channel first, then channels just outside entity boxes.
    // Ports on facing sides keep the last segment perpendicular to the target.
    for (const horizontal of [true, false]) {
      const axis = horizontal ? "x" : "y", cross = horizontal ? "y" : "x";
      const size = horizontal ? "width" : "height", span = horizontal ? "height" : "width";
      const point = (a: number, b: number) => horizontal ? {x:a,y:b} : {x:b,y:a};
      const channels = new Set([(start[axis]+end[axis])/2 + lane*5]);
      for (const b of obstacles) {
        channels.add(b[axis]-b[size]/2-8);
        channels.add(b[axis]+b[size]/2+8);
      }
      for (const c of channels) {
        if (Math.abs(c-start[axis]) < start[size]/2 || Math.abs(c-end[axis]) < end[size]/2) continue;
        const port = (b: Box, shift: number) => b[cross] + Math.tanh(lane/2 + shift)*b[span]*0.4;
        const edge = (b: Box) => b[axis]+Math.sign(c-b[axis])*b[size]/2;
        for (const shift of [0, 0.7, -0.7]) {
          consider([point(edge(start),port(start,shift)),point(c,port(start,shift)),point(c,port(end,shift)),point(edge(end),port(end,shift))]);
        }
      }
    }
  }
  if (!best.length) return "";
  return best.map((p,i) => !i ? 'M'+p.x+' '+p.y : best[i-1].x === p.x ? 'V'+p.y : 'H'+p.x).join(" ");
}
