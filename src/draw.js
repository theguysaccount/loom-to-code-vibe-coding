// Mark mode: the reviewer draws on top of the app. Circles, arrows, underlines, strike-throughs,
// scribbles and crosses are recognised and mapped to the elements underneath; a tap leaves a pin.
import { classifyStroke, isCross, pointInPolygon, rectIoU, bboxOf } from "./shapes.js";
import { semanticTarget, isOwn } from "./elements.js";

const INK = "#ff5a36";
const FADE_AFTER = 3800;
const FADE_MS = 900;
const CROSS_WINDOW = 2500;

export function createDrawLayer({ canvas, recorder, onMark }) {
  const ctx = canvas.getContext("2d");
  let active = false;
  let drawing = null;         // { pts, id }
  let strokes = [];           // rendered ink: { pts, doneAt, pin }
  let lastLine = null;        // { shape, event, at } for cross detection
  let raf = 0;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paint();
  }

  // Hit-test the page under the overlay.
  function under(pageX, pageY) {
    const x = pageX - window.scrollX, y = pageY - window.scrollY;
    if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) return null;
    const prev = canvas.style.pointerEvents;
    canvas.style.pointerEvents = "none";
    const hit = document.elementFromPoint(x, y);
    canvas.style.pointerEvents = prev;
    return hit && !isOwn(hit) ? hit : null;
  }
  const targetAt = (p) => semanticTarget(under(p.x, p.y));

  function rectOf(el) {
    const r = el.getBoundingClientRect();
    return { x: r.left + window.scrollX, y: r.top + window.scrollY, w: r.width, h: r.height };
  }

  // The element whose box best matches the drawn region: circle a button and you get the button;
  // circle a whole card and you get the card.
  function regionTarget(pts, box, polygon) {
    const candidates = new Set();
    const centre = { x: box.x + box.w / 2, y: box.y + box.h / 2 };
    const samples = [centre];
    for (let i = 1; i <= 4; i++) {
      for (let j = 1; j <= 4; j++) {
        const p = { x: box.x + (box.w * i) / 5, y: box.y + (box.h * j) / 5 };
        if (!polygon || pointInPolygon(p, pts)) samples.push(p);
      }
    }
    for (const p of samples) {
      let el = targetAt(p);
      for (let up = 0; el && up < 5; up++, el = el.parentElement) {
        if (el === document.body || el === document.documentElement) break;
        candidates.add(el);
      }
    }
    let best = null, bestScore = 0;
    for (const el of candidates) {
      const score = rectIoU(rectOf(el), box);
      if (score > bestScore) {
        best = el;
        bestScore = score;
      }
    }
    return bestScore >= 0.12 ? best : targetAt(centre) || best;
  }

  // A roughly horizontal line: through the middle of an element (strike) or just under it (underline)?
  function lineRole(shape) {
    const n = 7, on = new Map(), above = new Map();
    for (let i = 0; i < n; i++) {
      const f = (i + 0.5) / n;
      const p = { x: shape.start.x + (shape.end.x - shape.start.x) * f, y: shape.start.y + (shape.end.y - shape.start.y) * f };
      const a = targetAt(p), b = targetAt({ x: p.x, y: p.y - 10 });
      if (a) on.set(a, (on.get(a) || 0) + 1);
      if (b) above.set(b, (above.get(b) || 0) + 1);
    }
    const top = (m) => [...m.entries()].sort((x, y) => y[1] - x[1])[0];
    const y = (shape.start.y + shape.end.y) / 2;
    const hitOn = top(on), hitAbove = top(above);
    if (hitOn && hitOn[1] >= n / 2) {
      const r = rectOf(hitOn[0]);
      const rel = (y - r.y) / Math.max(r.h, 1);
      if (r.h <= 140 && rel > 0.2 && rel < 0.72) return { role: "strike", el: hitOn[0] };
      if (r.h <= 140 && rel >= 0.72) return { role: "underline", el: hitOn[0] };
    }
    if (hitAbove && hitAbove[1] >= n / 2) {
      const r = rectOf(hitAbove[0]);
      if (r.h <= 140 && y >= r.y + r.h * 0.7 && y <= r.y + r.h + 14) return { role: "underline", el: hitAbove[0] };
    }
    return null;
  }

  function commit(pts, t0) {
    const shape = classifyStroke(pts);
    const t1 = recorder.now();
    let ev = null;
    if (shape.shape === "dot") {
      const el = targetAt(pts[0]);
      if (el) ev = { type: "focus", t0, t1: t0, el: recorder.refFor(el), via: "pin", x: Math.round(pts[0].x), y: Math.round(pts[0].y) };
      lastLine = null;
    } else if (shape.shape === "line") {
      if (lastLine && t0 - lastLine.at <= CROSS_WINDOW && isCross(lastLine.shape, shape)) {
        // Second stroke of an X: replace the first line with one "crossed out" mark.
        recorder.remove(lastLine.event);
        const box = bboxOf([lastLine.shape.start, lastLine.shape.end, shape.start, shape.end]);
        const el = regionTarget(null, box, false);
        if (el) ev = { type: "stroke", t0: lastLine.event.t0, t1, role: "cross", el: recorder.refFor(el), bbox: round(box) };
        lastLine = null;
      } else {
        const flat = shape.horizontal ? lineRole(shape) : null;
        if (flat) {
          ev = { type: "stroke", t0, t1, role: flat.role, el: recorder.refFor(flat.el), bbox: round(shape.bbox) };
        } else {
          const from = targetAt(shape.start), to = targetAt(shape.end);
          if (from || to) {
            ev = { type: "stroke", t0, t1, role: "arrow", from: from ? recorder.refFor(from) : undefined, to: to ? recorder.refFor(to) : undefined, bbox: round(shape.bbox) };
          }
        }
        lastLine = ev ? { shape, event: null, at: t1 } : null;
      }
    } else {
      const el = regionTarget(pts, shape.bbox, shape.shape === "circle");
      if (el) {
        ev = { type: "stroke", t0, t1, role: shape.shape === "scribble" ? "scribble" : "region", loops: shape.loops || 1, el: recorder.refFor(el), bbox: round(shape.bbox) };
      }
      lastLine = null;
    }
    if (ev) {
      const added = recorder.add(ev);
      if (lastLine && !lastLine.event) lastLine.event = added;
      onMark && onMark(added);
    } else if (lastLine && !lastLine.event) {
      lastLine = null;
    }
    return ev;
  }

  const round = (b) => ({ x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.w), h: Math.round(b.h) });

  function paint() {
    const now = performance.now();
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    const sx = window.scrollX, sy = window.scrollY;
    let alive = false;
    const all = drawing ? [...strokes, { pts: drawing.pts, doneAt: 0 }] : strokes;
    for (const s of all) {
      const age = s.doneAt ? now - s.doneAt : 0;
      const alpha = age <= FADE_AFTER ? 1 : 1 - (age - FADE_AFTER) / FADE_MS;
      if (alpha <= 0) continue;
      alive = true;
      ctx.globalAlpha = Math.min(1, alpha) * 0.92;
      ctx.strokeStyle = INK;
      ctx.fillStyle = INK;
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      if (s.pin) {
        const p = s.pts[0];
        const grow = Math.min(1, age / 260);
        ctx.beginPath();
        ctx.arc(p.x - sx, p.y - sy, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(p.x - sx, p.y - sy, 8 + 10 * grow, 0, Math.PI * 2);
        ctx.stroke();
        continue;
      }
      ctx.beginPath();
      s.pts.forEach((p, i) => (i ? ctx.lineTo(p.x - sx, p.y - sy) : ctx.moveTo(p.x - sx, p.y - sy)));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    strokes = strokes.filter((s) => now - s.doneAt < FADE_AFTER + FADE_MS);
    cancelAnimationFrame(raf);
    if (alive) raf = requestAnimationFrame(paint);
  }

  function point(e) {
    return { x: e.clientX + window.scrollX, y: e.clientY + window.scrollY, t: recorder.now() };
  }

  function down(e) {
    if (!active || !recorder.active || (e.button != null && e.button > 0)) return;
    e.preventDefault();
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch { /* synthetic events have no capturable pointer */ }
    drawing = { pts: [point(e)], t0: recorder.now(), id: e.pointerId };
    paint();
  }

  function move(e) {
    if (!drawing || e.pointerId !== drawing.id) return;
    e.preventDefault();
    const batch = e.getCoalescedEvents ? e.getCoalescedEvents() : null;
    if (batch && batch.length) batch.forEach((c) => drawing.pts.push(point(c)));
    else drawing.pts.push(point(e));
    paint();
  }

  function up(e) {
    if (!drawing || e.pointerId !== drawing.id) return;
    e.preventDefault();
    const { pts, t0 } = drawing;
    drawing = null;
    if (e.type === "pointercancel") return paint();
    const ev = commit(pts, t0);
    strokes.push({ pts, doneAt: performance.now(), pin: !!ev && ev.type === "focus" });
    paint();
  }

  // Let the wheel and trackpad scroll the page while marking.
  function wheel(e) {
    window.scrollBy(e.deltaX, e.deltaY);
  }

  canvas.addEventListener("pointerdown", down);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);
  canvas.addEventListener("wheel", wheel, { passive: true });
  window.addEventListener("resize", resize);
  window.addEventListener("scroll", paint, { passive: true });
  resize();

  return {
    setActive(on) {
      active = !!on;
      canvas.style.pointerEvents = active ? "auto" : "none";
      canvas.style.cursor = active ? "crosshair" : "";
      if (!active && drawing) {
        drawing = null;
        paint();
      }
    },
    get active() {
      return active;
    },
    clear() {
      strokes = [];
      drawing = null;
      lastLine = null;
      paint();
    },
    destroy() {
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", paint);
      cancelAnimationFrame(raf);
    },
  };
}
