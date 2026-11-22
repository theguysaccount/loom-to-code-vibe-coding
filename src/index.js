// Entry point: window.Pointbrief, and auto-start from the <script> tag that loaded it.
//   <script src=".../pointbrief.js" defer></script>
// data- attributes on that tag: data-position="left", data-lang="de-DE", data-voice="off",
// data-bridge="off" (or a URL), data-footer="off", data-hidden, data-open, data-coach, data-manual.
import { createToolbar } from "./toolbar.js";
import { createPlayer } from "./replay.js";
import { buildBrief, briefToMarkdown, SCHEMA } from "./brief.js";
import { classifyStroke } from "./shapes.js";
import { describeElement, uniqueSelector, frameworkInfo, semanticTarget } from "./elements.js";

export const VERSION = "__VERSION__";
export const DOCS_URL = "__DOCS_URL__";

let toolbar = null;

function attrs(script) {
  const o = {};
  if (!script) return o;
  const d = script.dataset;
  if (d.position) o.position = d.position;
  if (d.lang) o.lang = d.lang;
  if (d.bridge) o.bridge = d.bridge;
  if (d.voice) o.voice = d.voice;
  if (d.footer === "off" || d.footer === "false") o.footer = false;
  if ("hidden" in d) o.hidden = true;
  if ("open" in d) o.open = true;
  if ("coach" in d) o.coach = true;
  return o;
}

const api = {
  version: VERSION,
  schema: SCHEMA,
  init(opts = {}) {
    if (!toolbar) toolbar = createToolbar({ version: VERSION, link: DOCS_URL, ...opts });
    return toolbar;
  },
  get toolbar() {
    return toolbar;
  },
  start(o) {
    return api.init().start(o);
  },
  stop() {
    return toolbar ? toolbar.stop() : Promise.resolve(null);
  },
  toggle() {
    if (!toolbar) api.init();
    else toolbar.toggle();
  },
  show() {
    api.init().show();
  },
  hide() {
    if (toolbar) toolbar.hide();
  },
  destroy() {
    if (toolbar) toolbar.destroy();
    toolbar = null;
  },
  get lastBrief() {
    return toolbar ? toolbar.brief : null;
  },
  /** Play a scripted recording through the real pipeline (the demo and the self-test use this). */
  async playSample(steps, { speed = 1, cursor = true } = {}) {
    const tb = api.init();
    if (tb.state === "recording") await tb.stop();
    tb.closeReview();
    const player = createPlayer({ toolbar: tb, speed, cursor });
    await tb.start({ speech: player.speech });
    await player.play(steps);
    return tb.stop();
  },
  buildBrief,
  briefToMarkdown,
  classifyStroke,
  describeElement,
  uniqueSelector,
  frameworkInfo,
  semanticTarget,
};

if (typeof window !== "undefined") {
  if (window.Pointbrief && window.Pointbrief.version) {
    // Loaded a second time (a bookmarklet pressed again): show or hide the toolbar that is already there.
    window.Pointbrief.toggle();
  } else {
    window.Pointbrief = api;
    const script = document.currentScript;
    const cfg = window.PointbriefConfig || {};
    const off = /[?&]pointbrief=off\b/.test(location.search);
    if (!off && !cfg.manual && !(script && script.hasAttribute("data-manual"))) {
      const go = () => api.init({ ...attrs(script), ...cfg });
      if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go, { once: true });
      else go();
    }
  }
}

export default api;
