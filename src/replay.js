// Plays a scripted recording through the real capture pipeline: synthetic pointer events with real
// hit-testing, real stroke recognition, and a stand-in speech engine. The demo's "Play a sample
// recording" and the in-page self-test both use it, so the self-test exercises the same code a
// person's recording goes through.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** A speech engine that "hears" whatever the script says. */
export function createScriptedSpeech({ now }) {
  let cb = null;
  let running = false;
  return {
    async start(opts) {
      cb = { onInterim() {}, onFinal() {}, onState() {}, ...opts };
      running = true;
      cb.onState("listening");
      return "sample";
    },
    stop() {
      running = false;
      if (cb) cb.onState("stopped");
    },
    async say(text, ms = 1600) {
      if (!running) return;
      const words = text.split(/\s+/);
      const t0 = now();
      const times = [];
      for (let i = 0; i < words.length; i++) {
        times.push(now());
        cb.onInterim(words.slice(0, i + 1).join(" "));
        await sleep(ms / words.length);
      }
      if (!running) return;
      cb.onFinal({ text, t0, t1: now(), words: words.map((w, i) => ({ w, t: times[i] })), confidence: 1 });
    },
  };
}

function resolve(sel) {
  const el = typeof sel === "string" ? document.querySelector(sel) : sel;
  if (!el) throw new Error(`replay: nothing matches ${sel}`);
  return el;
}

function centre(el) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, r };
}

function fire(target, type, x, y, extra = {}) {
  const init = { clientX: x, clientY: y, bubbles: true, cancelable: true, composed: true, pointerId: 41, pointerType: "mouse", isPrimary: true, button: 0, buttons: type === "pointerup" ? 0 : 1, ...extra };
  const Ctor = type.startsWith("pointer") && typeof PointerEvent === "function" ? PointerEvent : MouseEvent;
  target.dispatchEvent(new Ctor(type, init));
}

export function createPlayer({ toolbar, speed = 1, cursor = true }) {
  const d = toolbar.driver;
  const speech = createScriptedSpeech({ now: d.recorder.now });
  let pos = { x: window.innerWidth * 0.6, y: window.innerHeight * 0.7 };
  const pending = [];
  const wait = (ms) => sleep(ms / speed);

  function showCursor(x, y, fast) {
    if (!cursor) return;
    d.ghost.hidden = false;
    d.ghost.classList.toggle("fast", !!fast);
    d.ghost.style.transform = `translate(${x - 4}px, ${y - 2}px)`;
  }

  async function ensureVisible(el) {
    const r = el.getBoundingClientRect();
    if (r.top < 60 || r.bottom > window.innerHeight - 140) {
      el.scrollIntoView({ block: "center", behavior: "instant" in document.documentElement.style ? "instant" : "auto" });
      await wait(250);
    }
  }

  // Glide the pointer to (x, y), firing pointermove on whatever is under it.
  async function moveTo(x, y, ms = 420) {
    const steps = Math.max(6, Math.round(ms / 35));
    const from = { ...pos };
    for (let i = 1; i <= steps; i++) {
      const k = i / steps;
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      const px = from.x + (x - from.x) * e, py = from.y + (y - from.y) * e;
      const under = document.elementFromPoint(px, py) || document.body;
      fire(under, "pointermove", px, py, { buttons: 0 });
      showCursor(px, py, true);
      await wait(ms / steps);
    }
    pos = { x, y };
  }

  async function dwell(ms) {
    const end = performance.now() + ms / speed;
    let i = 0;
    while (performance.now() < end) {
      const jx = pos.x + ((i % 3) - 1), jy = pos.y + (((i + 1) % 3) - 1);
      fire(document.elementFromPoint(jx, jy) || document.body, "pointermove", jx, jy, { buttons: 0 });
      i++;
      await wait(140);
    }
  }

  async function stroke(points, ms = 650) {
    const canvas = d.canvas;
    const [first] = points;
    await moveTo(first.x, first.y, 300);
    fire(canvas, "pointerdown", first.x, first.y);
    for (let i = 1; i < points.length; i++) {
      fire(canvas, "pointermove", points[i].x, points[i].y);
      showCursor(points[i].x, points[i].y, true);
      await wait(ms / points.length);
    }
    const last = points[points.length - 1];
    fire(canvas, "pointerup", last.x, last.y, { buttons: 0 });
    pos = { ...last };
    await wait(220);
  }

  const shapes = {
    circle(el, loops = 1) {
      const { x, y, r } = centre(el);
      const rx = r.width / 2 + 14, ry = r.height / 2 + 12;
      const n = Math.round(36 * loops) + 4;
      const pts = [];
      for (let i = 0; i <= n; i++) {
        const a = -2.2 + (i / n) * (loops * 2 * Math.PI + 0.35);
        pts.push({ x: x + Math.cos(a) * rx, y: y + Math.sin(a) * ry });
      }
      return pts;
    },
    strike(el) {
      const { y, r } = centre(el);
      const pts = [];
      for (let i = 0; i <= 18; i++) pts.push({ x: r.left - 6 + ((r.width + 12) * i) / 18, y: y + Math.sin(i) * 1.2 });
      return pts;
    },
    underline(el) {
      const { r } = centre(el);
      const pts = [];
      for (let i = 0; i <= 16; i++) pts.push({ x: r.left + (r.width * i) / 16, y: r.bottom + 4 + Math.sin(i) });
      return pts;
    },
    arrow(a, b) {
      const p = centre(a), q = centre(b);
      const pts = [];
      for (let i = 0; i <= 22; i++) pts.push({ x: p.x + ((q.x - p.x) * i) / 22, y: p.y + ((q.y - p.y) * i) / 22 });
      const ang = Math.atan2(q.y - p.y, q.x - p.x);
      for (const s of [1, -1]) {
        pts.push({ x: q.x - Math.cos(ang + s * 0.5) * 16, y: q.y - Math.sin(ang + s * 0.5) * 16 });
        pts.push({ x: q.x, y: q.y });
      }
      return pts;
    },
  };

  async function step(s) {
    if (s.wait === "speech") {
      await Promise.all(pending.splice(0));
      return;
    }
    if (typeof s.wait === "number") return wait(s.wait);
    if (s.mode) {
      d.setMode(s.mode);
      return wait(250);
    }
    if (s.say) {
      const p = speech.say(s.say, (s.ms || 1600) / speed);
      if (s.async) pending.push(p);
      else await p;
      return;
    }
    if (s.hover) {
      const el = resolve(s.hover);
      await ensureVisible(el);
      const { x, y } = centre(el);
      await moveTo(x, y);
      return dwell(s.ms || 900);
    }
    if (s.click) {
      const el = resolve(s.click);
      await ensureVisible(el);
      const { x, y } = centre(el);
      await moveTo(x, y);
      fire(el, "pointerdown", x, y);
      fire(el, "pointerup", x, y, { buttons: 0 });
      el.dispatchEvent(new MouseEvent("click", { clientX: x, clientY: y, bubbles: true, cancelable: true, composed: true }));
      return wait(400);
    }
    if (s.note) {
      if (s.at) {
        const el = resolve(s.at);
        await ensureVisible(el);
        const { x, y } = centre(el);
        await moveTo(x, y);
        await dwell(600);
      }
      const input = d.noteInput();
      if (input) {
        input.value = s.note.slice(0, 1);
        input.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
        await wait(Math.min(1400, s.note.length * 35));
        input.value = "";
      }
      d.submitNote(s.note);
      return wait(300);
    }
    for (const kind of ["circle", "strike", "underline"]) {
      if (s[kind]) {
        const el = resolve(s[kind]);
        await ensureVisible(el);
        return stroke(shapes[kind](el, s.loops || 1), s.ms || (kind === "circle" ? 800 : 450));
      }
    }
    if (s.arrow) {
      const [a, b] = s.arrow.map(resolve);
      return stroke(shapes.arrow(a, b), s.ms || 650);
    }
    throw new Error(`replay: unknown step ${JSON.stringify(s)}`);
  }

  return {
    speech,
    async play(steps) {
      try {
        for (const s of steps) await step(s);
        await Promise.all(pending.splice(0));
      } finally {
        d.ghost.hidden = true;
      }
    },
  };
}
