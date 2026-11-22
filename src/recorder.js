// The recording session: a clock, an event log and a registry of the elements that were referenced.
import { describeElement, detectFramework, pageOf, pageRect } from "./elements.js";

const STORE_KEY = "pointbrief:live";
const RESUME_MAX_AGE = 30 * 60 * 1000;

function sessionId(date) {
  const p = (n) => String(n).padStart(2, "0");
  const stamp = `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}_${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`;
  return `pb_${stamp}_${Math.random().toString(36).slice(2, 6)}`;
}

export function createRecorder({ version = "" } = {}) {
  let session = null;
  let base = 0;                 // performance.now() at the session's zero
  let refs = new WeakMap();     // element -> ref
  let live = new Map();         // ref -> element (this page only)
  let counter = 0;
  let lastPage = "";
  let navTimer = null;
  const listeners = new Set();

  const now = () => Math.round(performance.now() - base);
  const emit = (ev) => listeners.forEach((fn) => fn(ev));

  function checkNav() {
    if (!session) return;
    const page = pageOf();
    if (page !== lastPage) {
      lastPage = page;
      session.events.push({ type: "nav", t: now(), page, url: location.origin + page, title: document.title });
    }
  }

  function begin(resumed) {
    lastPage = resumed ? resumed.lastPage : pageOf();
    navTimer = setInterval(checkNav, 400);
    window.addEventListener("popstate", checkNav);
    window.addEventListener("hashchange", checkNav);
  }

  function start(meta = {}) {
    const startedAt = Date.now();
    base = performance.now();
    refs = new WeakMap();
    live = new Map();
    counter = 0;
    session = {
      id: sessionId(new Date(startedAt)), startedAt, endedAt: 0, events: [], elements: {}, contains: {},
      meta: {
        origin: location.origin === "null" ? "file://" : location.origin, title: document.title, page: pageOf(),
        viewport: { w: window.innerWidth, h: window.innerHeight }, framework: detectFramework(), voice: "none", version, ...meta,
      },
    };
    begin(null);
    return session;
  }

  // Register an element, or refresh where it is if it was referenced before.
  function refFor(el) {
    if (!session || !el) return null;
    let ref = refs.get(el);
    if (ref) {
      if (session.elements[ref]) session.elements[ref].rect = pageRect(el);
      return ref;
    }
    ref = `e${++counter}`;
    refs.set(el, ref);
    live.set(ref, el);
    let d;
    try {
      d = describeElement(el);
    } catch {
      d = { tag: el.tagName ? el.tagName.toLowerCase() : "element", classes: [], selector: "", text: "", page: pageOf() };
    }
    session.elements[ref] = { ref, ...d };
    return ref;
  }

  function add(ev) {
    if (!session) return null;
    checkNav();
    const full = { page: pageOf(), ...ev };
    session.events.push(full);
    emit(full);
    return full;
  }

  function remove(ev) {
    if (!session) return;
    const i = session.events.indexOf(ev);
    if (i >= 0) session.events.splice(i, 1);
  }

  function computeContains() {
    for (const [a, elA] of live) {
      for (const [b, elB] of live) {
        if (a !== b && elA.contains(elB)) {
          const list = session.contains[a] || (session.contains[a] = []);
          if (!list.includes(b)) list.push(b);
        }
      }
    }
  }

  function teardown() {
    clearInterval(navTimer);
    window.removeEventListener("popstate", checkNav);
    window.removeEventListener("hashchange", checkNav);
  }

  function stop() {
    if (!session) return null;
    checkNav();
    computeContains();
    session.endedAt = session.startedAt + now();
    teardown();
    const done = session;
    session = null;
    try {
      sessionStorage.removeItem(STORE_KEY);
    } catch { /* storage may be blocked */ }
    return done;
  }

  // A full page load in the middle of a recording: keep the log and carry on after the load.
  function suspend() {
    if (!session) return;
    computeContains();
    try {
      sessionStorage.setItem(STORE_KEY, JSON.stringify({ session, elapsed: now(), counter, lastPage, savedAt: Date.now() }));
    } catch { /* storage may be blocked or full */ }
  }

  function resume() {
    let saved = null;
    try {
      saved = JSON.parse(sessionStorage.getItem(STORE_KEY) || "null");
      sessionStorage.removeItem(STORE_KEY);
    } catch { /* ignore */ }
    if (!saved || !saved.session || Date.now() - saved.savedAt > RESUME_MAX_AGE) return null;
    session = saved.session;
    // The clock keeps running across the load, so times stay in order.
    base = performance.now() - (saved.elapsed + (Date.now() - saved.savedAt));
    refs = new WeakMap();
    live = new Map();
    counter = saved.counter || Object.keys(session.elements).length;
    begin(saved);
    checkNav();
    return session;
  }

  return {
    start, stop, suspend, resume, add, remove, refFor, now,
    get active() {
      return !!session;
    },
    get session() {
      return session;
    },
    elementFor: (ref) => live.get(ref) || null,
    on(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
