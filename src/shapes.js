// Stroke geometry. Pure functions: no DOM, so they run in Node tests and in the browser.
// A stroke is an array of points {x, y, t} in page coordinates.

export function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function pathLength(pts) {
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += dist(pts[i - 1], pts[i]);
  return len;
}

export function bboxOf(pts) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) {
    if (p.x < x0) x0 = p.x;
    if (p.y < y0) y0 = p.y;
    if (p.x > x1) x1 = p.x;
    if (p.y > y1) y1 = p.y;
  }
  if (!pts.length) return { x: 0, y: 0, w: 0, h: 0 };
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

// Drop points closer than minDist to the last kept point (removes pointer jitter).
export function simplify(pts, minDist = 4) {
  if (pts.length < 3) return pts.slice();
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    if (dist(out[out.length - 1], pts[i]) >= minDist) out.push(pts[i]);
  }
  out.push(pts[pts.length - 1]);
  return out;
}

function normAngle(a) {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a <= -Math.PI) a += 2 * Math.PI;
  return a;
}

// Signed and absolute turning along the path, in radians.
function turning(pts) {
  let signed = 0, abs = 0, prev = null;
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i].x - pts[i - 1].x, dy = pts[i].y - pts[i - 1].y;
    if (Math.hypot(dx, dy) < 2) continue;
    const a = Math.atan2(dy, dx);
    if (prev !== null) {
      const d = normAngle(a - prev);
      signed += d;
      abs += Math.abs(d);
    }
    prev = a;
  }
  return { signed, abs };
}

// Count back-and-forth reversals along the dominant axis (zig-zag scribbles).
function reversals(pts, box) {
  const axis = box.w >= box.h ? "x" : "y";
  const span = Math.max(axis === "x" ? box.w : box.h, 1);
  const minTravel = Math.max(span * 0.15, 8);
  let count = 0, dir = 0, anchor = pts[0][axis];
  for (let i = 1; i < pts.length; i++) {
    const v = pts[i][axis];
    const delta = v - anchor;
    if (Math.abs(delta) < minTravel) continue;
    const d = Math.sign(delta);
    if (dir !== 0 && d !== dir) count++;
    dir = d;
    anchor = v;
  }
  return count;
}

/**
 * Classify one freehand stroke.
 * Returns { shape, length, bbox, loops, angle, horizontal, start, end }.
 *   dot      a tap or a tiny mark: treat as a pin
 *   line     a straight stroke: an arrow (start -> end), an underline or a strike-through
 *   circle   a closed loop (also boxes): "this region"; loops >= 2 means circled more than once
 *   scribble a zig-zag: scribbling something out
 *   mark     anything else: treat as a region
 */
export function classifyStroke(raw) {
  const pts = simplify(raw || [], 4);
  const box = bboxOf(pts);
  const length = pathLength(pts);
  const start = pts[0] || { x: 0, y: 0 };
  const end = pts[pts.length - 1] || start;
  const base = { length, bbox: box, loops: 0, angle: 0, horizontal: false, start, end };
  if (pts.length < 3 || length < 14) return { shape: "dot", ...base };

  const diag = Math.max(Math.hypot(box.w, box.h), 1);
  const { signed, abs } = turning(pts);
  const straight = dist(start, end) / length;

  // A hand-drawn arrow often ends with a head that doubles back. The tip is the point farthest
  // from the start; what comes before it is the shaft, what comes after is the head.
  let far = 0, farDist = 0;
  for (let i = 1; i < pts.length; i++) farDist = Math.max(farDist, dist(start, pts[i]));
  // The head may come back to the tip, so take the first time the stroke gets that far.
  const near = farDist - Math.max(6, farDist * 0.03);
  for (let i = 1; i < pts.length; i++) {
    if (dist(start, pts[i]) >= near) {
      far = i;
      farDist = dist(start, pts[i]);
      break;
    }
  }
  const shaftLen = pathLength(pts.slice(0, far + 1));
  const headLen = length - shaftLen;
  const arrow = shaftLen >= 14 && farDist / shaftLen >= 0.92 && headLen <= shaftLen * 0.5;

  if (straight >= 0.9 || arrow) {
    const tip = straight >= 0.9 ? end : pts[far];
    const angle = Math.atan2(tip.y - start.y, tip.x - start.x);
    const deg = Math.abs((angle * 180) / Math.PI);
    return { shape: "line", ...base, end: tip, angle, horizontal: deg <= 20 || deg >= 160 };
  }

  const closure = dist(start, end) / diag;
  const turn = Math.abs(signed);
  if ((turn >= 1.5 * Math.PI && closure < 0.5) || turn >= 1.8 * Math.PI) {
    return { shape: "circle", ...base, loops: Math.max(1, Math.round(turn / (2 * Math.PI))) };
  }

  if (reversals(pts, box) >= 3 || (abs >= 2.5 * Math.PI && turn < 1.2 * Math.PI)) {
    return { shape: "scribble", ...base };
  }
  return { shape: "mark", ...base };
}

function segmentsIntersect(a, b, c, d) {
  const cross = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const d1 = cross(c, d, a), d2 = cross(c, d, b), d3 = cross(a, b, c), d4 = cross(a, b, d);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

// Two straight strokes drawn one after the other that cross each other: an "X".
export function isCross(a, b) {
  if (!a || !b || a.shape !== "line" || b.shape !== "line") return false;
  const ratio = a.length / Math.max(b.length, 1);
  if (ratio > 3 || ratio < 1 / 3) return false;
  let between = Math.abs(normAngle(a.angle - b.angle));
  if (between > Math.PI / 2) between = Math.PI - between;
  if (between < (35 * Math.PI) / 180) return false;
  return segmentsIntersect(a.start, a.end, b.start, b.end);
}

// Ray-casting point-in-polygon test.
export function pointInPolygon(p, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
    if (yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function rectIoU(a, b) {
  const x0 = Math.max(a.x, b.x), y0 = Math.max(a.y, b.y);
  const x1 = Math.min(a.x + a.w, b.x + b.w), y1 = Math.min(a.y + a.h, b.y + b.h);
  const inter = Math.max(0, x1 - x0) * Math.max(0, y1 - y0);
  const union = a.w * a.h + b.w * b.h - inter;
  return union > 0 ? inter / union : 0;
}
