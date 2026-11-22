// Describes DOM elements for the brief: what the reviewer pointed at, how to find it again
// (a short unique selector) and where it probably lives in the source (component and file hints).
// Never reads form values.

const INTERACTIVE = 'a[href],button,input,select,textarea,summary,label,[role="button"],[role="link"],[role="tab"],' +
  '[role="menuitem"],[role="checkbox"],[role="switch"],[role="option"],[role="radio"],[onclick]';
const INLINE_TAGS = new Set(["SPAN", "B", "I", "EM", "STRONG", "SMALL", "SUB", "SUP", "MARK", "CODE", "U", "S", "ABBR",
  "TIME", "BR", "WBR", "FONT", "KBD", "Q", "CITE", "BDI", "BDO"]);
const REPLACED = new Set(["IMG", "VIDEO", "CANVAS", "INPUT", "BUTTON", "SELECT", "TEXTAREA", "IFRAME", "PICTURE", "AUDIO", "OBJECT", "EMBED"]);
const LANDMARKS = new Set(["main", "nav", "header", "footer", "section", "article", "aside", "form", "ul", "ol", "table", "dialog", "fieldset"]);
const TEST_ATTRS = ["data-testid", "data-test", "data-test-id", "data-cy", "data-qa"];
const KEEP_ATTRS = ["href", "src", "type", "name", "placeholder", "alt", "title", "role", "aria-label", "for",
  "data-testid", "data-test", "data-cy", "aria-expanded", "aria-selected", "aria-current", "disabled"];
const PRIVATE = "[data-pointbrief-private],[data-private]";

const GENERATED_ID = /^\d|[:.]|\d{4,}|^(radix|headlessui|react-aria|mui|ember|rc[-_]|r\d|__)|[a-f0-9]{8,}/i;
const HASHED_CLASS = /^(css|sc|jsx|jss|emotion|svelte|astro|v)-[a-z0-9]{4,}$|__[a-zA-Z0-9_-]{5,}$|^[a-zA-Z]+_[a-zA-Z0-9]+__[a-zA-Z0-9_-]+$|\d{5,}/;
const UTILITY_CLASS = new RegExp("^(?:-?(?:[mp][trblxyse]?|w|h|min-[wh]|max-[wh]|size|gap|space-[xy]|inset|top|left|right|bottom|z|" +
  "text|font|leading|tracking|bg|from|via|to|border|rounded|shadow|opacity|ring|outline|divide|basis|grow|shrink|order|" +
  "col|row|cols|rows|grid|flex|items|justify|content|self|place|overflow|object|aspect|duration|ease|delay|transition|" +
  "translate|scale|rotate|cursor|select|pointer-events|fill|stroke|line-clamp|whitespace|break|truncate|sr|decoration|" +
  "underline|list|align|float|clear|isolate|container|backdrop|blur|animate|d|fs|fw|lh|position)(?:-|$)|" +
  "block$|inline|hidden$|relative$|absolute$|fixed$|sticky$|static$|italic$|uppercase$|lowercase$|capitalize$|antialiased$|" +
  "group$|peer$|visible$|invisible$|row$|col$|clearfix$)");

let ownHost = null;
export function setOwnHost(host) {
  ownHost = host;
}
export function isOwn(node) {
  return !!ownHost && !!node && (node === ownHost || ownHost.contains(node));
}

const esc = (s) => (typeof CSS !== "undefined" && CSS.escape ? CSS.escape(s) : String(s).replace(/([^\w-])/g, "\\$1"));
const clip = (s, n) => {
  s = String(s == null ? "" : s).replace(/\s+/g, " ").trim();
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
};

function isInline(el) {
  if (REPLACED.has(el.tagName)) return false;
  if (INLINE_TAGS.has(el.tagName)) return true;
  if (el instanceof SVGElement) return true;
  return false;
}

function hops(ancestor, el) {
  let n = 0;
  for (let cur = el; cur && cur !== ancestor; cur = cur.parentElement) n++;
  return n;
}

/**
 * The element a person means when the pointer is over `el`: the button, not the icon inside it;
 * the paragraph, not the <em> inside it. Returns null for the page background.
 */
export function semanticTarget(el) {
  if (!el || el.nodeType !== 1 || isOwn(el)) return null;
  const doc = el.ownerDocument;
  if (el === doc.documentElement || el === doc.body) return null;
  const control = el.closest(INTERACTIVE);
  if (control && control !== doc.body && hops(control, el) <= 5) return control;
  const svg = el instanceof SVGElement ? el.ownerSVGElement || el : null;
  if (svg) {
    const r = svg.getBoundingClientRect();
    if (r.width >= 48 || r.height >= 48 || !svg.parentElement || svg.parentElement === doc.body) return svg;
    el = svg.parentElement;
  }
  let cur = el;
  for (let i = 0; i < 3 && cur.parentElement && cur.parentElement !== doc.body && isInline(cur); i++) cur = cur.parentElement;
  return cur === doc.body || cur === doc.documentElement ? el : cur;
}

function stableId(el) {
  const id = el.getAttribute("id");
  return id && id.length <= 60 && !GENERATED_ID.test(id) ? id : "";
}

export function semanticClasses(el) {
  const out = [];
  const raw = typeof el.className === "string" ? el.className : el.getAttribute("class") || "";
  for (const c of raw.split(/\s+/)) {
    if (!c || c.length > 40 || /[^\w-]/.test(c)) continue;
    if (HASHED_CLASS.test(c) || UTILITY_CLASS.test(c)) continue;
    out.push(c);
  }
  return out;
}

// The shortest token that says what this node is.
function token(el, strongOnly) {
  const tag = el.tagName.toLowerCase();
  const id = stableId(el);
  if (id) return { sel: `#${esc(id)}`, strong: true };
  for (const a of TEST_ATTRS) {
    const v = el.getAttribute(a);
    if (v && v.length <= 60) return { sel: `[${a}="${v.replace(/"/g, '\\"')}"]`, strong: true };
  }
  const classes = semanticClasses(el);
  if (classes.length) return { sel: `${tag}.${esc(classes[0])}`, strong: true };
  if (strongOnly) return { sel: tag, strong: LANDMARKS.has(tag) };
  const attr = (name, max = 60) => {
    const v = el.getAttribute(name);
    return v && v.length <= max && !/["\\\n]/.test(v) ? `${tag}[${name}="${v}"]` : "";
  };
  const byAttr = (tag === "a" && attr("href")) || ((tag === "input" || tag === "select" || tag === "textarea") && attr("name")) ||
    attr("aria-label") || (tag === "img" && attr("alt")) || (tag === "button" && attr("type", 10) && el.getAttribute("type") !== "button" && attr("type", 10));
  return { sel: byAttr || tag, strong: LANDMARKS.has(tag) };
}

function nthOfType(el) {
  const parent = el.parentElement;
  if (!parent) return "";
  const same = [...parent.children].filter((c) => c.tagName === el.tagName);
  return same.length > 1 ? `:nth-of-type(${same.indexOf(el) + 1})` : "";
}

function count(root, sel) {
  try {
    return root.querySelectorAll(sel).length;
  } catch {
    return -1;
  }
}

/** A short CSS selector that matches only this element (within its document or shadow root). */
export function uniqueSelector(el) {
  const root = el.getRootNode ? el.getRootNode() : el.ownerDocument;
  const unique = (sel) => count(root, sel) === 1 && root.querySelector(sel) === el;
  const self = token(el, false).sel;
  if (unique(self)) return self;
  const selfNth = self.startsWith("#") || self.startsWith("[") ? self : self + nthOfType(el);
  // Strict chain upwards; at each strong ancestor try the short descendant form first.
  let chain = selfNth;
  let cur = el.parentElement;
  for (let depth = 0; cur && depth < 12 && cur.tagName !== "HTML"; depth++, cur = cur.parentElement) {
    if (cur.tagName === "BODY") break;
    const t = token(cur, true);
    if (t.strong) {
      for (const tail of [self, selfNth]) {
        const loose = `${t.sel} ${tail}`;
        if (unique(loose)) return loose;
      }
    }
    const part = t.sel.startsWith("#") || t.sel.startsWith("[") ? t.sel : t.sel + nthOfType(cur);
    chain = `${part} > ${chain}`;
    if (unique(chain)) return chain;
  }
  // Full path from the top: always unique.
  const parts = [];
  for (let n = el; n && n.nodeType === 1 && n.tagName !== "HTML"; n = n.parentElement) {
    parts.unshift(n.tagName === "BODY" ? "body" : n.tagName.toLowerCase() + nthOfType(n));
  }
  return parts.join(" > ");
}

function implicitRole(el) {
  const tag = el.tagName.toLowerCase();
  const explicit = el.getAttribute("role");
  if (explicit) return explicit;
  if (tag === "a") return el.hasAttribute("href") ? "link" : "";
  if (/^h[1-6]$/.test(tag)) return `heading ${tag[1]}`;
  if (tag === "input") {
    const type = (el.getAttribute("type") || "text").toLowerCase();
    return { checkbox: "checkbox", radio: "radio", range: "slider", submit: "button", button: "button", search: "searchbox" }[type] || "textbox";
  }
  return { button: "button", select: "combobox", textarea: "textbox", img: "image", nav: "navigation", main: "main",
    header: "banner", footer: "footer", li: "list item", form: "form", table: "table", dialog: "dialog", summary: "disclosure" }[tag] || "";
}

function visibleText(el) {
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return "";
  const text = "innerText" in el && typeof el.innerText === "string" ? el.innerText : el.textContent || "";
  return clip(text, 100);
}

function accessibleName(el) {
  const direct = el.getAttribute("aria-label") || el.getAttribute("alt") || el.getAttribute("placeholder") || el.getAttribute("title");
  if (direct) return clip(direct, 80);
  if (el.labels && el.labels.length) return clip(el.labels[0].innerText || el.labels[0].textContent, 80);
  return "";
}

function cleanUrl(value) {
  try {
    const u = new URL(value, location.href);
    if (u.protocol === "data:" || u.protocol === "blob:") return `${u.protocol}…`;
    return u.origin === location.origin ? u.pathname + (u.hash.startsWith("#/") ? u.hash : "") : u.origin + u.pathname;
  } catch {
    return clip(value, 80);
  }
}

function keptAttrs(el) {
  const out = {};
  for (const name of KEEP_ATTRS) {
    if (!el.hasAttribute(name)) continue;
    let v = el.getAttribute(name);
    if (name === "href" || name === "src") v = cleanUrl(v);
    out[name] = clip(v === "" ? "true" : v, 80);
  }
  return out;
}

function styleSubset(el) {
  const cs = getComputedStyle(el);
  const out = { "font-size": cs.fontSize };
  if (cs.fontWeight && cs.fontWeight !== "400") out["font-weight"] = cs.fontWeight;
  out.color = cs.color;
  if (cs.backgroundColor && !/rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor)) out["background-color"] = cs.backgroundColor;
  const box = (prop) => {
    const v = [cs[`${prop}Top`], cs[`${prop}Right`], cs[`${prop}Bottom`], cs[`${prop}Left`]];
    if (v.every((x) => x === "0px")) return "";
    if (v[0] === v[2] && v[1] === v[3]) return v[0] === v[1] ? v[0] : `${v[0]} ${v[1]}`;
    return v.join(" ");
  };
  const padding = box("padding"), margin = box("margin");
  if (padding) out.padding = padding;
  if (margin) out.margin = margin;
  if (cs.borderTopLeftRadius && cs.borderTopLeftRadius !== "0px") out["border-radius"] = cs.borderTopLeftRadius;
  if (/flex|grid|none/.test(cs.display)) out.display = cs.display;
  if (/center|right|end|justify/.test(cs.textAlign)) out["text-align"] = cs.textAlign;
  if (/flex|grid/.test(cs.display) && cs.gap && cs.gap !== "normal" && cs.gap !== "0px") out.gap = cs.gap;
  return out;
}

// Keep the part of a source path an agent can search for; drop the machine-specific prefix.
export function shortPath(file) {
  if (!file) return "";
  let p = String(file).replace(/\\/g, "/").replace(/^[a-z-]+:\/\/[^/]*\//i, "/").replace(/[?#].*$/, "");
  p = p.replace(/^.*\/node_modules\//, "node_modules/");
  const m = p.match(/\/((?:src|app|pages|components|lib|routes|views|layouts|features|ui)\/.*)$/);
  if (m) return m[1];
  const parts = p.split("/").filter(Boolean);
  return parts.slice(-3).join("/");
}

function fiberOf(el) {
  for (let cur = el, i = 0; cur && i < 4; cur = cur.parentElement, i++) {
    for (const key in cur) {
      if (key.startsWith("__reactFiber$") || key.startsWith("__reactInternalInstance$")) return cur[key];
    }
  }
  return null;
}

function fiberName(fiber) {
  let type = fiber && fiber.type;
  if (!type) return "";
  if (typeof type === "object") type = type.render || type.type || type;
  if (typeof type === "object" && type) type = type.render || type.type || type;
  const name = (fiber.type && fiber.type.displayName) || (type && (type.displayName || type.name)) || "";
  return typeof name === "string" && /^[A-Z]/.test(name) ? name : "";
}

// Stack frames of a dev-mode React 19 element: the first frame outside React is the JSX call site.
function frameFromStack(stack) {
  if (!stack) return null;
  const text = typeof stack === "string" ? stack : stack.stack;
  if (typeof text !== "string") return null;
  for (const line of text.split("\n")) {
    if (/node_modules|react-dom|react\.development|react-jsx|jsx-dev-runtime|jsx-runtime|chunk-[A-Z0-9]{6,}|\(native\)|<anonymous>/.test(line)) continue;
    const m = line.match(/((?:https?|file|webpack-internal|rsc|about):\/\/[^\s)]+?|\/[^\s):]+)(?::(\d+))(?::(\d+))?\)?\s*$/);
    if (m) return { file: m[1], line: Number(m[2]) || 0 };
  }
  return null;
}

function reactInfo(el) {
  const fiber = fiberOf(el);
  if (!fiber) return null;
  const chain = [];
  let file = "", line = 0;
  const src = fiber._debugSource;
  if (src && src.fileName) {
    file = src.fileName;
    line = src.lineNumber || 0;
  } else {
    const frame = frameFromStack(fiber._debugStack);
    if (frame) ({ file, line } = frame);
  }
  for (let f = fiber, guard = 0; f && guard < 200; f = f._debugOwner || f.return, guard++) {
    const name = fiberName(f);
    if (name && chain[0] !== name) chain.unshift(name);
    if (!file && f._debugSource && f._debugSource.fileName) {
      file = f._debugSource.fileName;
      line = f._debugSource.lineNumber || 0;
    }
    if (chain.length >= 4) break;
  }
  if (!chain.length && !file) return null;
  return { framework: "react", name: chain[chain.length - 1] || "", chain, file: shortPath(file), line };
}

function vueInfo(el) {
  let inst = null;
  for (let cur = el, i = 0; cur && i < 6 && !inst; cur = cur.parentElement, i++) inst = cur.__vueParentComponent || null;
  if (!inst || !inst.type) return null;
  const chain = [];
  let file = "";
  for (let c = inst, guard = 0; c && guard < 50 && chain.length < 4; c = c.parent, guard++) {
    const t = c.type || {};
    const fromFile = t.__file ? t.__file.split("/").pop().replace(/\.vue$/, "") : "";
    const name = t.__name || t.name || fromFile;
    if (!file && t.__file) file = t.__file;
    if (name && chain[0] !== name) chain.unshift(name);
  }
  if (!chain.length && !file) return null;
  return { framework: "vue", name: chain[chain.length - 1] || "", chain, file: shortPath(file), line: 0 };
}

function svelteInfo(el) {
  for (let cur = el, i = 0; cur && i < 4; cur = cur.parentElement, i++) {
    const meta = cur.__svelte_meta;
    const loc = meta && meta.loc;
    if (loc && loc.file) {
      const name = loc.file.split("/").pop().replace(/\.svelte$/, "");
      return { framework: "svelte", name, chain: [name], file: shortPath(loc.file), line: loc.line || 0 };
    }
  }
  return null;
}

// Source annotations that build plugins write into the DOM in development.
function annotationInfo(el) {
  for (let cur = el, i = 0; cur && i < 4; cur = cur.parentElement, i++) {
    const get = (n) => cur.getAttribute && cur.getAttribute(n);
    const sentryFile = get("data-sentry-source-file");
    const sentryName = get("data-sentry-component") || get("data-component");
    if (sentryFile || sentryName) {
      return { framework: "annotated", name: sentryName || "", chain: sentryName ? [sentryName] : [], file: shortPath(sentryFile || ""), line: 0 };
    }
    const insp = get("data-insp-path");
    if (insp) {
      const [file, line] = insp.split(":");
      return { framework: "annotated", name: "", chain: [], file: shortPath(file), line: Number(line) || 0 };
    }
    const rel = get("data-inspector-relative-path");
    if (rel) return { framework: "annotated", name: "", chain: [], file: shortPath(rel), line: Number(get("data-inspector-line")) || 0 };
    const loc = get("data-source") || get("data-loc") || get("data-source-loc");
    if (loc && /\.[a-z]{2,5}(:\d+)/i.test(loc)) {
      const m = loc.match(/^(.*?):(\d+)/);
      return { framework: "annotated", name: "", chain: [], file: shortPath(m[1]), line: Number(m[2]) || 0 };
    }
  }
  return null;
}

/** Component name and source file of an element, when the app's dev build exposes them. */
export function frameworkInfo(el) {
  try {
    return reactInfo(el) || vueInfo(el) || svelteInfo(el) || annotationInfo(el) || null;
  } catch {
    return null;
  }
}

export function detectFramework() {
  try {
    const w = window;
    const parts = [];
    if (w.__NEXT_DATA__ || w.next) parts.push("next");
    else if (w.__NUXT__ || w.useNuxtApp) parts.push("nuxt");
    else if (w.__remixContext) parts.push("remix");
    else if (document.querySelector("[data-astro-cid],astro-island")) parts.push("astro");
    const hook = w.__REACT_DEVTOOLS_GLOBAL_HOOK__;
    if ((hook && hook.renderers && hook.renderers.size) || fiberOf(document.body.firstElementChild || document.body)) parts.push("react");
    else if (w.__VUE__ || document.querySelector("[data-v-app]")) parts.push("vue");
    else if (document.querySelector('[class*="svelte-"]')) parts.push("svelte");
    return parts.join(" + ") || null;
  } catch {
    return null;
  }
}

export function pageOf(loc = location) {
  return loc.pathname + (loc.hash.startsWith("#/") ? loc.hash : "");
}

export function pageRect(el) {
  const r = el.getBoundingClientRect();
  return { x: Math.round(r.left + window.scrollX), y: Math.round(r.top + window.scrollY), w: Math.round(r.width), h: Math.round(r.height) };
}

/** Everything the brief says about one element. */
export function describeElement(el) {
  const tag = el.tagName.toLowerCase();
  const isPrivate = !!el.closest(PRIVATE) || (tag === "input" && (el.getAttribute("type") || "").toLowerCase() === "password");
  const out = {
    tag,
    id: stableId(el),
    classes: (typeof el.className === "string" ? el.className : el.getAttribute("class") || "").split(/\s+/).filter((c) => c && c.length <= 40).slice(0, 6),
    selector: uniqueSelector(el),
    text: isPrivate ? "" : visibleText(el),
    name: isPrivate ? "" : accessibleName(el),
    ariaRole: implicitRole(el),
    attrs: isPrivate ? {} : keptAttrs(el),
    rect: pageRect(el),
    styles: styleSubset(el),
    page: pageOf(),
  };
  if (isPrivate) out.private = true;
  const root = el.getRootNode && el.getRootNode();
  if (root && root.host && root !== document) out.shadowHost = uniqueSelector(root.host);
  const component = frameworkInfo(el);
  if (component) out.component = component;
  if (out.name === out.text) out.name = "";
  return out;
}

/** A short label for the live highlight (cheap: no selector search). */
export function quickLabel(el) {
  if (!el || !el.tagName) return "";
  let s = el.tagName.toLowerCase();
  const id = stableId(el);
  if (id) s += `#${id}`;
  else {
    const c = semanticClasses(el)[0];
    if (c) s += `.${c}`;
  }
  const isPrivate = !!(el.closest && el.closest(PRIVATE));
  const text = isPrivate ? "" : clip(el.getAttribute("aria-label") || visibleText(el), 40);
  return text ? `${s} "${text}"` : s;
}
