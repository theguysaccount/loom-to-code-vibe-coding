// Follows the pointer while the reviewer uses the app normally: where it rests (attention),
// what gets clicked or tapped, and when it sits idle. Emits "focus" events into the recorder.
import { semanticTarget, isOwn } from "./elements.js";

const DWELL_MIN = 450;     // resting this long on one element counts as pointing at it
const IDLE_AFTER = 4000;   // no movement for this long: the pointer is parked, not pointing
const TOUCH_LINGER = 6000; // a tap stays "current" this long (there is no hover on touch)
const SAMPLE_MS = 40;

export function createPointerTracker({ recorder, onTarget }) {
  let cur = null;        // { el, ref, t0, lastMove, via, clicks, x, y, touch }
  let held = false;      // pointer is over our own toolbar: keep the current reference alive
  let lastSample = 0;
  let lastPointerType = "mouse";
  let timer = null;
  let enabled = false;

  // Page background and near-full-page wrappers are not something a resting pointer "points at".
  function tooBig(el) {
    const r = el.getBoundingClientRect();
    return r.width >= window.innerWidth * 0.9 && r.height >= window.innerHeight * 0.6;
  }

  function targetAt(x, y) {
    const hit = document.elementFromPoint(x, y);
    if (!hit || isOwn(hit)) return null;
    return semanticTarget(hit);
  }

  function close(endAt) {
    if (!cur) return;
    const t1 = Math.max(cur.t0, endAt == null ? recorder.now() : endAt);
    const keep = cur.via === "hover" ? t1 - cur.t0 >= DWELL_MIN : cur.via === "rest" ? t1 - cur.t0 >= 1000 : true;
    if (keep) {
      const ref = recorder.refFor(cur.el);
      if (ref) recorder.add({ type: "focus", t0: cur.t0, t1, el: ref, via: cur.via, clicks: cur.clicks || undefined, x: cur.x, y: cur.y });
    }
    cur = null;
    onTarget && onTarget(null);
  }

  function open(el, via, x, y, touch) {
    const t = recorder.now();
    cur = { el, t0: t, lastMove: t, via, clicks: via === "hover" || via === "rest" ? 0 : 1, x: Math.round(x), y: Math.round(y), touch: !!touch };
    onTarget && onTarget(el, via);
  }

  function onMove(e) {
    if (!enabled) return;
    lastPointerType = e.pointerType || "mouse";
    if (e.pointerType === "touch") return; // touch moves are scrolling
    if (isOwn(e.target)) {
      held = true;
      return;
    }
    held = false;
    const t = performance.now();
    if (t - lastSample < SAMPLE_MS) return;
    lastSample = t;
    let el = targetAt(e.clientX, e.clientY);
    if (el && tooBig(el)) el = null;
    if (cur && cur.el === el && cur.via !== "rest") {
      cur.lastMove = recorder.now();
      return;
    }
    close();
    if (el) open(el, "hover", e.clientX + window.scrollX, e.clientY + window.scrollY);
  }

  function onDown(e) {
    lastPointerType = e.pointerType || "mouse";
    held = isOwn(e.target);
  }

  function onClick(e) {
    if (!enabled || isOwn(e.target)) return;
    const path = e.composedPath ? e.composedPath() : [];
    const el = semanticTarget(path[0] && path[0].nodeType === 1 ? path[0] : e.target);
    if (!el) return;
    const touch = lastPointerType === "touch";
    const via = touch ? "tap" : "click";
    if (cur && cur.el === el && cur.via !== "rest") {
      cur.via = via;
      cur.clicks = (cur.clicks || 0) + 1;
      cur.lastMove = recorder.now();
      cur.touch = touch;
      onTarget && onTarget(el, via);
      return;
    }
    close();
    open(el, via, e.pageX, e.pageY, touch);
  }

  function tick() {
    if (!cur || held) return;
    const t = recorder.now();
    if (cur.touch) {
      if (t - cur.lastMove > TOUCH_LINGER) close(cur.lastMove + TOUCH_LINGER);
      return;
    }
    if (cur.via !== "rest" && t - cur.lastMove > IDLE_AFTER) {
      const el = cur.el, x = cur.x, y = cur.y, since = cur.lastMove;
      close(since);
      cur = { el, t0: since, lastMove: since, via: "rest", clicks: 0, x, y, touch: false };
    }
  }

  function onScroll() {
    if (cur && cur.touch) close();
  }

  function onLeave() {
    if (!held) close();
  }

  const opts = { capture: true, passive: true };
  return {
    start() {
      if (enabled) return;
      enabled = true;
      window.addEventListener("pointermove", onMove, opts);
      window.addEventListener("pointerdown", onDown, opts);
      window.addEventListener("click", onClick, opts);
      window.addEventListener("scroll", onScroll, opts);
      document.documentElement.addEventListener("pointerleave", onLeave, opts);
      timer = setInterval(tick, 500);
    },
    stop() {
      if (!enabled) return;
      close();
      enabled = false;
      window.removeEventListener("pointermove", onMove, opts);
      window.removeEventListener("pointerdown", onDown, opts);
      window.removeEventListener("click", onClick, opts);
      window.removeEventListener("scroll", onScroll, opts);
      document.documentElement.removeEventListener("pointerleave", onLeave, opts);
      clearInterval(timer);
    },
    // Close the open span now (before a stroke, a mode change or a page unload).
    flush: () => close(),
    // The typed-note box took the focus: whatever was being pointed at stays current.
    hold(on) {
      held = !!on;
      if (cur) cur.lastMove = recorder.now();
    },
    get current() {
      return cur ? cur.el : null;
    },
  };
}
