import test from "node:test";
import assert from "node:assert/strict";
import { classifyStroke, isCross, pointInPolygon, rectIoU, simplify } from "../../src/shapes.js";

// Deterministic pseudo-random jitter so strokes look hand-drawn.
function rng(seed) {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296 - 0.5);
}

function circle(cx, cy, r, turns = 1, jitter = 2, seed = 1, startAngle = -1.2) {
  const rand = rng(seed), pts = [];
  const steps = Math.round(48 * turns);
  for (let i = 0; i <= steps; i++) {
    const a = startAngle + (i / steps) * turns * 2 * Math.PI;
    pts.push({ x: cx + Math.cos(a) * r * 1.2 + rand() * jitter, y: cy + Math.sin(a) * r * 0.8 + rand() * jitter, t: i * 12 });
  }
  return pts;
}

function line(x0, y0, x1, y1, jitter = 1.5, seed = 2, steps = 24) {
  const rand = rng(seed), pts = [];
  for (let i = 0; i <= steps; i++) {
    pts.push({ x: x0 + ((x1 - x0) * i) / steps + rand() * jitter, y: y0 + ((y1 - y0) * i) / steps + rand() * jitter, t: i * 10 });
  }
  return pts;
}

function zigzag(x0, y0, w, h, passes = 5) {
  const pts = [];
  for (let p = 0; p < passes; p++) {
    const y = y0 + (h * p) / passes;
    const [a, b] = p % 2 ? [x0 + w, x0] : [x0, x0 + w];
    for (let i = 0; i <= 10; i++) pts.push({ x: a + ((b - a) * i) / 10, y: y + (h / passes) * (i / 10), t: (p * 11 + i) * 10 });
  }
  return pts;
}

test("a tap or a tiny wiggle is a dot", () => {
  assert.equal(classifyStroke([{ x: 10, y: 10 }]).shape, "dot");
  assert.equal(classifyStroke(line(10, 10, 15, 12, 0.5)).shape, "dot");
  assert.equal(classifyStroke([]).shape, "dot");
});

test("closed loops are circles, at any size, direction or start point", () => {
  for (const r of [18, 40, 120, 300]) {
    for (const seed of [1, 7, 23]) {
      const s = classifyStroke(circle(400, 300, r, 1, Math.min(3, r / 10), seed, seed));
      assert.equal(s.shape, "circle", `r=${r} seed=${seed}`);
      assert.equal(s.loops, 1);
    }
  }
  const ccw = circle(400, 300, 60).map((p) => ({ ...p, x: 800 - p.x }));
  assert.equal(classifyStroke(ccw).shape, "circle");
});

test("a circle that overshoots or stops short is still a circle", () => {
  assert.equal(classifyStroke(circle(200, 200, 50, 1.15)).shape, "circle");
  assert.equal(classifyStroke(circle(200, 200, 50, 0.88)).shape, "circle");
});

test("circling twice counts two loops", () => {
  const s = classifyStroke(circle(200, 200, 60, 2.05));
  assert.equal(s.shape, "circle");
  assert.equal(s.loops, 2);
});

test("a box drawn in one stroke is a region too", () => {
  const pts = [...line(100, 100, 300, 100), ...line(300, 100, 300, 220), ...line(300, 220, 100, 220), ...line(100, 220, 100, 104)];
  assert.equal(classifyStroke(pts).shape, "circle");
});

test("straight strokes are lines with a direction", () => {
  const right = classifyStroke(line(100, 200, 400, 205));
  assert.equal(right.shape, "line");
  assert.equal(right.horizontal, true);
  assert.ok(right.end.x > right.start.x);
  const diagonal = classifyStroke(line(100, 100, 300, 320));
  assert.equal(diagonal.shape, "line");
  assert.equal(diagonal.horizontal, false);
  const left = classifyStroke(line(400, 200, 100, 198));
  assert.equal(left.horizontal, true);
  assert.ok(left.end.x < left.start.x);
});

test("an arrow whose head doubles back still points from start to tip", () => {
  const shaft = line(100, 300, 420, 180, 1.5, 5, 30);
  const head = [...line(420, 180, 385, 178, 1, 6, 5), ...line(385, 178, 420, 180, 1, 7, 5), ...line(420, 180, 400, 210, 1, 8, 5)];
  const s = classifyStroke([...shaft, ...head]);
  assert.equal(s.shape, "line");
  assert.ok(s.end.x > 330 && s.end.y < 230, "tip is near the end of the shaft");
  assert.equal(s.head, true);
});

test("a long horizontal arrow keeps its head, so it is never read as a strike-through", () => {
  const shaft = line(100, 200, 900, 204, 1.2, 9, 60);
  const head = [...line(900, 204, 884, 196, 1, 3, 4), ...line(884, 196, 900, 204, 1, 4, 4), ...line(900, 204, 884, 212, 1, 5, 4)];
  const s = classifyStroke([...shaft, ...head]);
  assert.equal(s.shape, "line");
  assert.equal(s.horizontal, true);
  assert.equal(s.head, true);
  assert.ok(s.end.x > 880);
  const plain = classifyStroke(line(100, 200, 900, 204, 1.2, 9, 60));
  assert.equal(plain.head, false, "a plain straight stroke has no head");
});

test("zig-zags are scribbles", () => {
  assert.equal(classifyStroke(zigzag(100, 100, 220, 60, 5)).shape, "scribble");
  assert.equal(classifyStroke(zigzag(100, 100, 120, 30, 7)).shape, "scribble");
});

test("an open curve is a plain mark", () => {
  const pts = [];
  for (let i = 0; i <= 30; i++) {
    const a = (i / 30) * Math.PI * 0.9;
    pts.push({ x: 200 + Math.cos(a) * 80, y: 200 + Math.sin(a) * 80 });
  }
  assert.equal(classifyStroke(pts).shape, "mark");
});

test("two crossing lines make an X; parallel or distant lines don't", () => {
  const a = classifyStroke(line(100, 100, 200, 200));
  const b = classifyStroke(line(200, 100, 100, 200));
  assert.equal(isCross(a, b), true);
  assert.equal(isCross(a, classifyStroke(line(110, 100, 210, 200))), false);
  assert.equal(isCross(a, classifyStroke(line(500, 100, 400, 200))), false);
  assert.equal(isCross(a, classifyStroke(circle(150, 150, 40))), false);
});

test("geometry helpers", () => {
  const square = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
  assert.equal(pointInPolygon({ x: 5, y: 5 }, square), true);
  assert.equal(pointInPolygon({ x: 15, y: 5 }, square), false);
  assert.equal(rectIoU({ x: 0, y: 0, w: 10, h: 10 }, { x: 0, y: 0, w: 10, h: 10 }), 1);
  assert.equal(rectIoU({ x: 0, y: 0, w: 10, h: 10 }, { x: 20, y: 20, w: 5, h: 5 }), 0);
  assert.ok(Math.abs(rectIoU({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 0, w: 10, h: 10 }) - 1 / 3) < 1e-9);
  assert.equal(simplify([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 9, y: 0 }], 4).length, 2);
});
