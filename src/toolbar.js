// The toolbar: a small bar on top of the app, the consent card, live highlights, and the review panel.
// Everything lives in one shadow root so the app's CSS can't reach it and it can't reach the app.
import { CSS_TEXT, ICONS } from "./styles.js";
import { createRecorder } from "./recorder.js";
import { createPointerTracker } from "./pointer.js";
import { createDrawLayer } from "./draw.js";
import { createSpeechEngine, speechMode, installLocalSpeech } from "./speech.js";
import { buildBrief, briefToMarkdown, fmtTime, findHints } from "./brief.js";
import { setOwnHost, quickLabel, pageOf } from "./elements.js";
import { copyText, downloadFile, bridgeHealth, sendToBridge, isLocalPage, DEFAULT_BRIDGE } from "./handoff.js";

const CONSENT_KEY = "pointbrief:consent";
const LAST_KEY = "pointbrief:last";
const MAX_MS = 15 * 60 * 1000;

const MIC = {
  starting: ["", "Starting mic…"],
  listening: ["live", "Listening"],
  denied: ["off", "Mic blocked: type instead"],
  "no-mic": ["off", "No mic: type instead"],
  offline: ["off", "Speech service unreachable"],
  failed: ["off", "Voice stopped: type instead"],
  "unsupported-language": ["off", "No voice for this language"],
  stopped: ["", "Mic off"],
  typed: ["", "Typing only"],
};

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function storage(kind) {
  try {
    return window[kind] || null;
  } catch {
    return null;
  }
}
function getItem(kind, key) {
  try {
    const s = storage(kind);
    return s ? s.getItem(key) : null;
  } catch {
    return null;
  }
}
function setItem(kind, key, value) {
  try {
    const s = storage(kind);
    if (s) s.setItem(key, value);
  } catch { /* storage blocked or full */ }
}

export function createToolbar(options = {}) {
  const opts = {
    position: "right", lang: navigator.language || "en-US", bridge: DEFAULT_BRIDGE, voice: "auto",
    footer: true, link: "", version: "", coach: false, onSample: null, onBrief: null, hidden: false, open: false,
    ...options,
  };

  const host = document.createElement("pointbrief-toolbar");
  host.setAttribute("data-pointbrief", "");
  host.style.cssText = "position:fixed;left:0;top:0;width:0;height:0;z-index:2147483647;display:block;";
  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `<style>${CSS_TEXT}</style>
    <div class="root ${opts.position === "left" ? "left" : ""} ${opts.hidden ? "hidden" : ""}" part="root">
      <canvas class="ink" aria-hidden="true"></canvas>
      <div class="hl" aria-hidden="true"><span></span></div>
      <div class="hl mark" aria-hidden="true"><span></span></div>
      <div class="ghost" aria-hidden="true" hidden>${ICONS.hand}</div>
      <section class="card" role="dialog" aria-modal="false" aria-labelledby="pb-card-title" hidden></section>
      <aside class="panel" role="dialog" aria-modal="false" aria-labelledby="pb-panel-title" hidden></aside>
      <div class="bar idle" role="toolbar" aria-label="Pointbrief"></div>
      <div class="toast" role="status" aria-live="polite"></div>
    </div>`;
  const $ = (sel) => shadow.querySelector(sel);
  const root = $(".root"), bar = $(".bar"), card = $(".card"), panel = $(".panel"), toast = $(".toast");
  const [hl, hlMark] = shadow.querySelectorAll(".hl");
  const ghost = $(".ghost");
  (document.body || document.documentElement).appendChild(host);
  setOwnHost(host);

  const recorder = createRecorder({ version: opts.version });
  let state = "idle";            // idle | starting | recording | finishing | review
  let mode = "point";
  let engine = null;
  let micState = "typed";
  let brief = null;
  let timer = null;
  let noteStart = null;
  let hlEl = null, hlRaf = 0, markTimer = 0;
  let discardArmed = 0;
  let health = null;

  const pointer = createPointerTracker({ recorder, onTarget: (el, via) => mode === "point" && showHighlight(hl, el, el ? quickLabel(el) : "", via) });
  const draw = createDrawLayer({ canvas: $(".ink"), recorder, onMark: flashMark });

  // ---------- highlights ----------
  function place(box, el, label) {
    const r = el.getBoundingClientRect();
    if (!r.width && !r.height) return false;
    box.style.left = `${r.left - 3}px`;
    box.style.top = `${r.top - 3}px`;
    box.style.width = `${r.width + 6}px`;
    box.style.height = `${r.height + 6}px`;
    box.classList.toggle("low", r.top < 26);
    if (label != null) box.firstElementChild.textContent = label;
    return true;
  }
  function showHighlight(box, el, label) {
    if (box === hl) hlEl = el;
    if (!el) {
      box.classList.remove("on");
      return;
    }
    if (place(box, el, label)) box.classList.add("on");
    trackScroll();
  }
  function trackScroll() {
    cancelAnimationFrame(hlRaf);
    hlRaf = requestAnimationFrame(() => {
      if (hlEl && hl.classList.contains("on") && hlEl.isConnected) place(hl, hlEl, null);
    });
  }
  window.addEventListener("scroll", trackScroll, { passive: true, capture: true });
  window.addEventListener("resize", trackScroll, { passive: true });

  function flashMark(ev) {
    if (!ev) return;
    const refs = ev.type === "stroke" ? [ev.el || ev.to || ev.from] : [ev.el];
    const el = recorder.elementFor(refs[0]);
    if (!el) return;
    const word = { region: "circled", scribble: "scribbled", strike: "struck through", cross: "crossed out", underline: "underlined", arrow: "arrow", pin: "marked" }[ev.role || ev.via] || "marked";
    clearTimeout(markTimer);
    showHighlight(hlMark, el, `${word}: ${quickLabel(el)}`);
    markTimer = setTimeout(() => hlMark.classList.remove("on"), 1600);
  }

  function say(msg) {
    toast.textContent = msg;
    toast.classList.add("on");
    clearTimeout(say.t);
    say.t = setTimeout(() => toast.classList.remove("on"), 2600);
  }

  // ---------- idle ----------
  function renderIdle() {
    state = "idle";
    bar.className = "bar idle";
    const last = brief || readLast();
    bar.innerHTML = `
      <div class="row">
        <span class="brand">${ICONS.logo}<span>Pointbrief</span></span>
        <button class="btn primary" data-act="record" title="Record feedback (Alt+Shift+R)"><span class="dot" aria-hidden="true"></span>Record</button>
        ${last ? `<button class="btn ghost small" data-act="last" title="Open the last brief">Last brief</button>` : ""}
        <button class="icon" data-act="help" aria-label="How Pointbrief works">${ICONS.help}</button>
        <button class="icon" data-act="hide" aria-label="Hide the toolbar (Alt+Shift+H brings it back)">${ICONS.close}</button>
      </div>`;
    if (opts.coach && !card.dataset.dismissed) renderCoach();
  }

  function readLast() {
    try {
      return JSON.parse(getItem("sessionStorage", LAST_KEY) || "null");
    } catch {
      return null;
    }
  }

  function renderCoach() {
    card.innerHTML = `
      <h2 id="pb-card-title">Try it on this page</h2>
      <ol>
        <li>Press <b>Record</b>.</li>
        <li>Point at something and say what to change, or type it.</li>
        <li>Switch to <b>Mark</b> to circle, cross out or draw an arrow.</li>
        <li>Press <b>Done</b>: you get a brief your coding agent can apply.</li>
      </ol>
      <div class="row">
        ${opts.onSample ? `<button class="btn primary small" data-act="sample">${ICONS.eye}Play a sample recording</button>` : ""}
        <button class="btn ghost small" data-act="dismiss">Got it</button>
      </div>`;
    card.hidden = false;
  }

  function renderHelp() {
    card.innerHTML = `
      <h2 id="pb-card-title">How Pointbrief works</h2>
      <p>Record, then use your app as usual: point at things and say what should change. In <b>Mark</b> mode you can circle, underline, cross out, scribble over or draw arrows. Press <b>Done</b> and you get a brief: every change, in your words, tied to the exact element.</p>
      <p>Paste it into Claude Code, Cursor or any coding agent, or send it straight to Claude Code with the Pointbrief plugin.</p>
      <p><kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd> record or stop · <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>D</kbd> point or mark · <kbd>Esc</kbd> back</p>
      <div class="row"><button class="btn ghost small" data-act="dismiss">Close</button>${opts.link ? `<a class="btn ghost small" href="${esc(opts.link)}" target="_blank" rel="noopener">Docs</a>` : ""}</div>`;
    card.hidden = false;
  }

  // ---------- consent ----------
  async function renderConsent() {
    state = "starting";
    card.innerHTML = `
      <h2 id="pb-card-title">Record feedback on this page</h2>
      <p>Pointbrief notes where you point and click, what you draw, and what you say or type. It doesn't record video or read form fields. Nothing leaves this page until you copy, download or send the brief.</p>
      <p class="voice-line">Checking voice…</p>
      <div class="row">
        <button class="btn primary" data-act="go-voice">${ICONS.mic}Start recording</button>
        <button class="btn ghost" data-act="go-typed">Type instead</button>
        <button class="btn ghost small" data-act="cancel-consent">Cancel</button>
      </div>`;
    card.hidden = false;
    const line = card.querySelector(".voice-line");
    const m = opts.voice === "off" ? "none" : await speechMode(opts.lang);
    if (!line.isConnected) return;
    const voiceBtn = card.querySelector('[data-act="go-voice"]');
    if (m === "local") line.textContent = "Voice: your browser transcribes it on this device.";
    else if (m === "downloadable") {
      line.innerHTML = `Voice: your browser can transcribe on this device after a one-time download. <button class="btn ghost small" data-act="install-voice">Download it</button> Otherwise it uses its online speech service.`;
    } else if (m === "cloud") line.textContent = "Voice: your browser sends the audio to its speech service to transcribe it (Google's for Chrome, Apple's for Safari). Choose Type instead to keep it all on this page.";
    else {
      line.textContent = "Voice isn't available in this browser, so you'll type your notes.";
      voiceBtn.hidden = true;
      card.querySelector('[data-act="go-typed"]').classList.replace("ghost", "primary");
    }
  }

  // ---------- recording ----------
  async function startRecording({ voice = true, speech = null, resumed = false } = {}) {
    card.hidden = true;
    panel.hidden = true;
    if (!resumed) recorder.start({ voice: "none" });
    state = "recording";
    mode = "point";
    pointer.start();
    draw.setActive(false);
    renderRecording();
    timer = setInterval(tickTimer, 500);
    host.dispatchEvent(new CustomEvent("pointbrief:start", { bubbles: true, composed: true }));
    if (voice) await startVoice(speech);
    else setMic("typed");
    if (recorder.session && recorder.session.meta.voice === "none") recorder.session.meta.voice = "typed";
  }

  async function startVoice(custom) {
    engine = custom || opts.speech || createSpeechEngine({ now: recorder.now });
    if (!engine) return setMic("typed");
    setMic("starting");
    try {
      const m = await engine.start({
        lang: opts.lang,
        onInterim: (text) => caption(text, true),
        onFinal: (r) => {
          if (state !== "recording" && state !== "finishing") return;
          recorder.add({ type: "speech", t0: r.t0, t1: r.t1, text: r.text, words: r.words, confidence: r.confidence });
          caption(r.text, false);
        },
        onState: setMic,
      });
      if (recorder.session) recorder.session.meta.voice = m || "speech";
    } catch {
      setMic("failed");
    }
  }

  function setMic(s) {
    micState = s;
    const el = bar.querySelector(".mic");
    if (!el) return;
    const [cls, label] = MIC[s] || ["", s];
    el.className = `mic ${cls}`;
    el.innerHTML = `${cls === "off" || s === "typed" ? ICONS.micOff : ICONS.mic}<span>${esc(label)}</span>`;
  }

  function caption(text, interim) {
    const el = bar.querySelector(".caption");
    if (!el) return;
    if (!text && interim) return;
    el.innerHTML = `<bdi>${esc(text)}</bdi>`;
    el.style.opacity = interim ? ".75" : "1";
  }

  function renderRecording() {
    bar.className = "bar rec";
    bar.innerHTML = `
      <div class="row">
        <span class="btn primary small rec" aria-hidden="true"><span class="dot"></span><span class="time">0:00</span></span>
        <div class="seg" role="group" aria-label="Pointer mode">
          <button data-mode="point" aria-pressed="true" title="Use the app and point (Alt+Shift+D)">${ICONS.hand}<span>Point</span></button>
          <button data-mode="mark" aria-pressed="false" title="Draw on the page (Alt+Shift+D)">${ICONS.pen}<span>Mark</span></button>
        </div>
        <span class="mic"></span>
        <span class="spacer"></span>
        <button class="btn primary small" data-act="done" title="Stop and see the brief (Alt+Shift+R)">Done</button>
        <button class="icon" data-act="discard" aria-label="Discard this recording">${ICONS.trash}</button>
      </div>
      <div class="caption" aria-live="off"></div>
      <form class="note" autocomplete="off">
        <label class="sr" for="pb-note">Note</label>
        <input id="pb-note" type="text" placeholder="Say it, or type a note and press Enter" enterkeyhint="send">
        <button class="btn small" type="submit" aria-label="Add note">${ICONS.enter}</button>
      </form>`;
    setMic(micState);
    tickTimer();
  }

  function tickTimer() {
    const el = bar.querySelector(".time");
    const t = recorder.now();
    if (el) el.textContent = fmtTime(t / 1000);
    if (state === "recording" && t > MAX_MS) {
      say("Stopped at 15 minutes");
      stopRecording();
    }
  }

  function setMode(m) {
    if (state !== "recording" || m === mode) return;
    pointer.flush();
    mode = m;
    draw.setActive(m === "mark");
    if (m === "mark") hl.classList.remove("on");
    bar.querySelectorAll(".seg button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === m)));
  }

  function submitNote(text) {
    text = String(text || "").trim();
    if (!text || state !== "recording") return false;
    const t1 = recorder.now();
    recorder.add({ type: "note", t0: noteStart == null ? t1 : noteStart, t1, text });
    noteStart = null;
    pointer.hold(false);
    caption(`Note: ${text}`, false);
    return true;
  }

  async function stopRecording() {
    if (state !== "recording") return null;
    state = "finishing";
    clearInterval(timer);
    pointer.flush();
    pointer.stop();
    draw.setActive(false);
    hl.classList.remove("on");
    const input = bar.querySelector("#pb-note");
    if (input && input.value.trim()) submitNote(input.value);
    if (engine) {
      engine.stop();
      // Final words arrive a moment after the mic stops.
      await sleep(micState === "listening" ? 900 : 150);
      engine = null;
    }
    const session = recorder.stop();
    if (!session) return renderIdle();
    brief = buildBrief(session, { version: opts.version });
    saveLast();
    host.dispatchEvent(new CustomEvent("pointbrief:brief", { detail: brief, bubbles: true, composed: true }));
    if (opts.onBrief) {
      try {
        opts.onBrief(brief, markdown());
      } catch { /* the host app's callback failed; the brief is still shown */ }
    }
    renderIdle();
    openReview();
    return brief;
  }

  function discard() {
    if (state !== "recording") return;
    if (Date.now() - discardArmed > 3000) {
      discardArmed = Date.now();
      say("Press the bin again to discard this recording");
      return;
    }
    clearInterval(timer);
    pointer.stop();
    draw.setActive(false);
    draw.clear();
    if (engine) engine.stop();
    engine = null;
    recorder.stop();
    hl.classList.remove("on");
    renderIdle();
    say("Recording discarded");
  }

  function saveLast() {
    if (brief) setItem("sessionStorage", LAST_KEY, JSON.stringify(brief));
  }

  // ---------- review ----------
  function markdown() {
    return briefToMarkdown(brief, { footer: opts.footer, link: opts.footer ? opts.link : "" });
  }

  function renumber() {
    brief.items.forEach((it, i) => (it.n = i + 1));
    brief.summary.items = brief.items.length;
    brief.summary.high = brief.items.filter((it) => it.priority === "high").length;
    saveLast();
  }

  function findLive(t) {
    if (!t || !t.selector || (t.page && t.page !== pageOf())) return null;
    try {
      const scope = t.shadowHost ? document.querySelector(t.shadowHost)?.shadowRoot : document;
      return scope ? scope.querySelector(t.selector) : null;
    } catch {
      return null;
    }
  }

  function targetHtml(t) {
    const role = t.role === "from" ? "move: " : t.role === "to" ? "to: " : "";
    const label = t.selector || t.tag;
    const text = t.text || t.name || "";
    const comp = t.component ? `${t.component.name || ""}${t.component.file ? ` · ${t.component.file}${t.component.line ? `:${t.component.line}` : ""}` : ""}` : "";
    return `<div class="target"><span class="how">${esc(role)}${esc(t.gesture)}</span><code title="${esc(label)}">${esc(label)}</code><span class="what">${esc(text)}</span></div>` +
      (comp ? `<div class="src" title="${esc(comp)}">${esc(comp)}</div>` : "");
  }

  function itemHtml(it) {
    const said = it.saidMarked || it.said;
    const tags = [it.priority === "high" ? `<span class="tag high" title="${esc(it.why.join("; "))}">High</span>` : "",
      ...it.hints.slice(0, 2).map((h) => `<span class="tag">${esc(h)}</span>`)].join("");
    return `<article class="item ${it.priority === "high" ? "high" : ""}" data-n="${it.n}">
      <div class="item-head"><span class="num">${it.n}</span>${tags}<span class="spacer"></span>
        <button class="icon" data-act="del" aria-label="Delete item ${it.n}">${ICONS.trash}</button></div>
      <label class="sr" for="pb-said-${it.n}">What you said for item ${it.n}</label>
      <textarea id="pb-said-${it.n}" rows="2" placeholder="(no words: add what should change)">${esc(said)}</textarea>
      ${it.targets.length ? it.targets.map(targetHtml).join("") : `<div class="none">No element: a general comment about ${esc(it.page || "this page")}</div>`}
    </article>`;
  }

  async function openReview() {
    if (!brief) brief = readLast();
    if (!brief) return;
    state = "review";
    card.hidden = true;
    const n = brief.items.length;
    panel.innerHTML = `
      <header>
        <h2 id="pb-panel-title" tabindex="-1">Brief<small>${n} ${n === 1 ? "item" : "items"} · ${fmtTime(brief.summary.seconds)}</small></h2>
        <button class="icon" data-act="close" aria-label="Close the brief">${ICONS.close}</button>
      </header>
      <div class="items">${n ? brief.items.map(itemHtml).join("") :
        `<div class="empty"><b>Nothing captured</b>Point at something and say or type what should change, or circle it in Mark mode.</div>`}</div>
      <footer>
        <p class="status" role="status"></p>
        <div class="row">
          <button class="btn primary" data-act="copy" ${n ? "" : "disabled"}>${ICONS.copy}Copy brief</button>
          <button class="btn" data-act="send" hidden>${ICONS.send}Send to agent</button>
        </div>
        <div class="row">
          <button class="btn ghost small" data-act="dl-md" ${n ? "" : "disabled"}>${ICONS.down}.md</button>
          <button class="btn ghost small" data-act="dl-json" ${n ? "" : "disabled"}>${ICONS.down}.json</button>
          <span class="spacer"></span>
          <button class="btn ghost small" data-act="again">${ICONS.mic}Record again</button>
        </div>
        <p class="hint">Paste it into Claude Code, Cursor or any coding agent. It lists each change with the element's selector, text and source hints.</p>
      </footer>`;
    panel.hidden = false;
    panel.querySelector("#pb-panel-title").focus({ preventScroll: true });
    panel.querySelectorAll("textarea").forEach(autosize);
    const send = panel.querySelector('[data-act="send"]');
    if (opts.bridge && opts.bridge !== "off" && n) {
      health = await bridgeHealth(opts.bridge);
      if (health && send.isConnected) {
        send.hidden = false;
      } else if (send.isConnected && isLocalPage()) {
        status(`No agent connected. Run Claude Code with the Pointbrief plugin to send briefs straight to it.`, false);
      }
    }
  }

  function autosize(ta) {
    ta.style.height = "auto";
    ta.style.height = `${Math.min(220, ta.scrollHeight + 2)}px`;
  }

  function status(msg, ok = true) {
    const el = panel.querySelector(".status");
    if (!el) return;
    el.textContent = msg;
    el.classList.toggle("err", !ok);
  }

  function closeReview() {
    panel.hidden = true;
    hlMark.classList.remove("on");
    hl.classList.remove("on");
    draw.clear();
    renderIdle();
  }

  async function copyBrief() {
    const ok = await copyText(markdown(), shadow);
    status(ok ? "Copied. Paste it into your coding agent." : "Couldn't copy: use .md to download it instead.", ok);
    if (ok) host.dispatchEvent(new CustomEvent("pointbrief:handoff", { detail: { via: "copy" }, bubbles: true, composed: true }));
  }

  async function sendBrief() {
    status("Sending…");
    try {
      const r = await sendToBridge(opts.bridge, brief, markdown());
      status(`Sent to your agent as ${r.id}. In Claude Code, run /pointbrief:apply.`);
      host.dispatchEvent(new CustomEvent("pointbrief:handoff", { detail: { via: "bridge", id: r.id }, bubbles: true, composed: true }));
    } catch (e) {
      status(`Couldn't send (${e.message}). Copy the brief instead.`, false);
    }
  }

  // ---------- events ----------
  shadow.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-act],[data-mode]");
    if (!btn) return;
    if (btn.dataset.mode) return setMode(btn.dataset.mode);
    const act = btn.dataset.act;
    if (act === "record") return begin();
    if (act === "go-voice" || act === "go-typed") {
      setItem("localStorage", CONSENT_KEY, "1");
      return startRecording({ voice: act === "go-voice" && opts.voice !== "off" });
    }
    if (act === "install-voice") {
      btn.disabled = true;
      btn.textContent = "Downloading…";
      installLocalSpeech(opts.lang).then((ok) => {
        btn.textContent = ok ? "Ready: on this device" : "Not available";
      });
      return;
    }
    if (act === "cancel-consent") {
      card.hidden = true;
      return renderIdle();
    }
    if (act === "done") return stopRecording();
    if (act === "discard") return discard();
    if (act === "help") return renderHelp();
    if (act === "hide") return api.hide();
    if (act === "dismiss") {
      card.hidden = true;
      card.dataset.dismissed = "1";
      return;
    }
    if (act === "sample") {
      card.hidden = true;
      card.dataset.dismissed = "1";
      return opts.onSample && opts.onSample();
    }
    if (act === "last") return openReview();
    if (act === "close") return closeReview();
    if (act === "copy") return copyBrief();
    if (act === "send") return sendBrief();
    if (act === "dl-md") return downloadFile(`${brief.id || "pointbrief"}.md`, markdown(), "text/markdown", shadow);
    if (act === "dl-json") return downloadFile(`${brief.id || "pointbrief"}.json`, JSON.stringify(brief, null, 2), "application/json", shadow);
    if (act === "again") {
      panel.hidden = true;
      return begin();
    }
    if (act === "del") {
      const n = Number(btn.closest(".item").dataset.n);
      brief.items = brief.items.filter((it) => it.n !== n);
      renumber();
      return openReview();
    }
  });

  shadow.addEventListener("submit", (e) => {
    e.preventDefault();
    const input = e.target.querySelector("input");
    if (input && submitNote(input.value)) input.value = "";
  });

  shadow.addEventListener("input", (e) => {
    if (e.target.id === "pb-note") {
      if (noteStart == null && e.target.value) {
        noteStart = recorder.now();
        pointer.hold(true);
      }
      if (!e.target.value) {
        noteStart = null;
        pointer.hold(false);
      }
    } else if (e.target.tagName === "TEXTAREA" && brief) {
      const n = Number(e.target.closest(".item").dataset.n);
      const it = brief.items.find((x) => x.n === n);
      if (!it) return;
      const v = e.target.value.trim();
      it.said = v.replace(/\s*\[\d+\]/g, "");
      if (/\[\d+\]/.test(v)) it.saidMarked = v;
      else delete it.saidMarked;
      it.hints = findHints(it.said, it.targets.map((t) => t.gestureKind));
      if (it.source === "gesture" && v) it.source = "typed";
      autosize(e.target);
      saveLast();
    }
  });

  shadow.addEventListener("pointerover", (e) => {
    const item = e.target.closest && e.target.closest(".item");
    if (!item || !brief) return;
    const it = brief.items.find((x) => x.n === Number(item.dataset.n));
    const el = it && findLive(it.targets[0]);
    if (el) showHighlight(hlMark, el, `${it.n}. ${quickLabel(el)}`);
    else hlMark.classList.remove("on");
  });
  shadow.addEventListener("pointerout", (e) => {
    if (e.target.closest && e.target.closest(".items") && !(e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest(".item"))) hlMark.classList.remove("on");
  });

  function onKey(e) {
    if (e.altKey && e.shiftKey && !e.ctrlKey && !e.metaKey) {
      if (e.code === "KeyR") {
        e.preventDefault();
        return state === "recording" ? stopRecording() : state === "idle" || state === "review" ? begin() : null;
      }
      if (e.code === "KeyD") {
        e.preventDefault();
        return setMode(mode === "point" ? "mark" : "point");
      }
      if (e.code === "KeyH") {
        e.preventDefault();
        return root.classList.contains("hidden") ? api.show() : api.hide();
      }
    }
    if (e.key === "Escape") {
      if (!card.hidden && state !== "starting") card.hidden = true;
      else if (state === "recording" && mode === "mark") setMode("point");
      else if (!panel.hidden) closeReview();
    }
  }
  window.addEventListener("keydown", onKey, true);

  function onPageHide() {
    if (state === "recording") {
      pointer.flush();
      recorder.suspend();
    }
  }
  window.addEventListener("pagehide", onPageHide);

  function begin() {
    if (state === "recording" || state === "finishing") return;
    panel.hidden = true;
    if (getItem("localStorage", CONSENT_KEY) === "1") return startRecording({ voice: opts.voice !== "off" });
    renderConsent();
  }

  const api = {
    host,
    get state() {
      return state;
    },
    get brief() {
      return brief;
    },
    markdown: () => (brief ? markdown() : ""),
    start: (o = {}) => (state === "idle" || state === "review"
      ? startRecording({ voice: !!o.speech || (o.voice !== false && opts.voice !== "off"), speech: o.speech || null })
      : Promise.resolve()),
    stop: () => stopRecording(),
    begin,
    openReview,
    closeReview,
    show() {
      root.classList.remove("hidden");
    },
    hide() {
      root.classList.add("hidden");
      if (state !== "recording") say("Pointbrief hidden: Alt+Shift+H brings it back");
    },
    toggle() {
      if (root.classList.contains("hidden")) api.show();
      else api.hide();
    },
    destroy() {
      if (state === "recording") discardArmed = Date.now() - 10000, discard();
      pointer.stop();
      draw.destroy();
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("scroll", trackScroll, true);
      window.removeEventListener("resize", trackScroll);
      host.remove();
      setOwnHost(null);
    },
    // Used by the sample replay and the self-test.
    driver: {
      canvas: $(".ink"),
      ghost,
      recorder,
      setMode,
      submitNote,
      noteInput: () => bar.querySelector("#pb-note"),
    },
  };

  // A full page load in the middle of a recording carries on where it left off.
  const resumed = recorder.resume();
  if (resumed) {
    startRecording({ voice: resumed.meta.voice && resumed.meta.voice.startsWith("speech"), resumed: true });
  } else {
    renderIdle();
    if (opts.open) begin();
  }
  return api;
}
