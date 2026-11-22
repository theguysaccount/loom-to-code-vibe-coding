import test from "node:test";
import assert from "node:assert/strict";
import { buildBrief, briefToMarkdown, findEmphasis, findHints, labelOf, SCHEMA, fmtTime } from "../../src/brief.js";

const ELEMENTS = {
  cta: { ref: "cta", tag: "button", classes: ["cta"], text: "Start free trial", selector: "#pricing .plan:nth-of-type(2) button.cta",
    ariaRole: "button", page: "/pricing", rect: { x: 812, y: 640, w: 120, h: 36 },
    styles: { "font-size": "14px", padding: "8px 12px", color: "rgb(255, 255, 255)", "background-color": "rgb(37, 99, 235)" },
    component: { framework: "react", name: "CtaButton", chain: ["App", "Pricing", "CtaButton"], file: "src/components/CtaButton.tsx", line: 12 } },
  card: { ref: "card", tag: "div", classes: ["plan"], text: "Pro $29 per month", selector: "#pricing .plan:nth-of-type(2)", page: "/pricing", rect: { x: 760, y: 300, w: 320, h: 420 } },
  title: { ref: "title", tag: "h1", id: "hero-title", classes: [], text: "Ship faster with less", selector: "#hero-title", page: "/", rect: { x: 100, y: 120, w: 600, h: 60 } },
  footer: { ref: "footer", tag: "footer", classes: ["site-footer"], text: "", selector: "footer.site-footer", page: "/", rect: { x: 0, y: 2000, w: 1440, h: 200 } },
  banner: { ref: "banner", tag: "div", classes: ["promo"], text: "50% off today", selector: "div.promo", page: "/", rect: { x: 0, y: 0, w: 1440, h: 40 } },
  secret: { ref: "secret", tag: "p", classes: ["balance"], text: "", private: true, selector: "p.balance", page: "/account", rect: { x: 10, y: 10, w: 100, h: 20 } },
};

function session(events, extra = {}) {
  return {
    id: "pb_test", startedAt: 1_800_000_000_000, endedAt: 1_800_000_030_000,
    meta: { origin: "http://localhost:3000", title: "Demo", page: "/pricing", viewport: { w: 1440, h: 900 }, voice: "speech-local", version: "0.0.0-test" },
    elements: ELEMENTS, contains: { card: ["cta"] }, events, ...extra,
  };
}
const speech = (t0, t1, text, more = {}) => ({ type: "speech", t0, t1, text, ...more });
const note = (t0, t1, text) => ({ type: "note", t0, t1, text });
const focus = (t0, t1, el, via = "hover", more = {}) => ({ type: "focus", t0, t1, el, via, ...more });
const stroke = (t0, t1, role, more = {}) => ({ type: "stroke", t0, t1, role, ...more });

test("point at something, then say what to change", () => {
  const b = buildBrief(session([focus(1000, 4000, "cta"), speech(1500, 3500, "make this button bigger")]));
  assert.equal(b.schema, SCHEMA);
  assert.equal(b.items.length, 1);
  const it = b.items[0];
  assert.equal(it.said, "make this button bigger");
  assert.equal(it.targets.length, 1);
  assert.equal(it.targets[0].selector, ELEMENTS.cta.selector);
  assert.equal(it.targets[0].gesture, "pointed at");
  assert.deepEqual(it.hints, ["style"]);
  assert.equal(it.priority, "normal");
  assert.equal(it.source, "speech");
  assert.equal(it.page, "/pricing");
});

test("a pause and a new target start a new item", () => {
  const b = buildBrief(session([
    focus(1000, 4000, "title"), speech(1500, 3500, "this headline is too long"),
    focus(7000, 10000, "cta"), speech(7500, 9000, "and this should say get started"),
  ]));
  assert.equal(b.items.length, 2);
  assert.equal(b.items[0].targets[0].ref, "title");
  assert.equal(b.items[1].targets[0].ref, "cta");
  assert.deepEqual(b.items.map((i) => i.n), [1, 2]);
  assert.ok(b.items[1].hints.includes("copy"));
});

test("a short pause splits only when the pointer went somewhere new", () => {
  const same = buildBrief(session([focus(1000, 9000, "cta"), speech(1500, 3000, "this is too small"), speech(4200, 6000, "and the color is off")]));
  assert.equal(same.items.length, 1);
  assert.equal(same.items[0].said, "this is too small and the color is off");
  const moved = buildBrief(session([
    focus(1000, 3300, "cta"), speech(1500, 3000, "this is too small"),
    focus(3900, 8000, "title"), speech(4200, 6000, "and this one is too long"),
  ]));
  assert.equal(moved.items.length, 2);
});

test("one run-on sentence over two elements keeps both, marked in the words", () => {
  const words = [["make", 5000], ["this", 5300], ["bigger", 5700], ["and", 6400], ["this", 7100], ["one", 7300], ["blue", 7700]].map(([w, t]) => ({ w, t }));
  const b = buildBrief(session([
    focus(4800, 6500, "title"), focus(7000, 9000, "cta"),
    speech(5000, 8000, "make this bigger and this one blue", { words }),
  ]));
  assert.equal(b.items.length, 1);
  assert.deepEqual(b.items[0].targets.map((t) => t.ref), ["title", "cta"]);
  assert.equal(b.items[0].saidMarked, "make this [1] bigger and this [2] one blue");
  assert.match(briefToMarkdown(b), /Target \[1\], pointed at: `h1#hero-title`/);
  assert.match(briefToMarkdown(b), /Target \[2\], pointed at: `button\.cta`/);
});

test("without word timings the markers still land on a sensible word", () => {
  const b = buildBrief(session([
    focus(4800, 6000, "title"), focus(7000, 9000, "cta"),
    speech(5000, 8000, "make this bigger and this one blue"),
  ]));
  assert.match(b.items[0].saidMarked, /this \[1\].*this \[2\]/);
});

test("talking first and marking afterwards is one thought", () => {
  const b = buildBrief(session([
    speech(5000, 6500, "I don't like the footer"),
    stroke(8000, 9000, "region", { el: "footer" }),
    speech(9500, 10500, "it's too dark"),
  ]));
  assert.equal(b.items.length, 1);
  assert.equal(b.items[0].said, "I don't like the footer it's too dark");
  assert.equal(b.items[0].targets[0].ref, "footer");
  assert.equal(b.items[0].targets[0].gesture, "circled");
});

test("a mark made just after the words attaches to them", () => {
  const b = buildBrief(session([speech(5000, 6500, "this banner is annoying"), stroke(7200, 8000, "region", { el: "banner" })]));
  assert.equal(b.items.length, 1);
  assert.equal(b.items[0].targets[0].ref, "banner");
});

test("a deliberate mark beats a hover in the same breath", () => {
  const b = buildBrief(session([
    focus(1000, 3000, "title"), stroke(3200, 4000, "region", { el: "cta", loops: 2 }),
    speech(1500, 4500, "this needs to really stand out"),
  ]));
  assert.deepEqual(b.items[0].targets.map((t) => t.ref), ["cta"]);
  assert.equal(b.items[0].priority, "high");
  assert.ok(b.items[0].why.includes('said "really"'));
  assert.ok(b.items[0].why.includes("circled twice"));
});

test("hovering a card and then its button means the button", () => {
  const b = buildBrief(session([focus(1000, 2000, "card"), focus(2100, 4000, "cta"), speech(1200, 3500, "change the wording here")]));
  assert.deepEqual(b.items[0].targets.map((t) => t.ref), ["cta"]);
});

test("long speech in several chunks stays with the first tap; the next tap starts a new item", () => {
  const b = buildBrief(session([
    focus(5000, 5000, "title", "tap"),
    speech(5500, 8000, "so this headline"), speech(8200, 11000, "reads like a slogan"), speech(11300, 15000, "can we say what the product does"),
    focus(15500, 15500, "cta", "tap"), speech(16000, 17500, "and this is fine"),
  ]));
  assert.equal(b.items.length, 2);
  assert.equal(b.items[0].said, "so this headline reads like a slogan can we say what the product does");
  assert.deepEqual(b.items[0].targets.map((t) => t.ref), ["title"]);
  assert.equal(b.items[0].targets[0].gesture, "tapped");
  assert.deepEqual(b.items[1].targets.map((t) => t.ref), ["cta"]);
});

test("typed notes are their own items and take the reference held while typing", () => {
  const b = buildBrief(session([
    focus(1000, 9000, "cta", "pin"), note(3000, 8000, "Rename to Get started"),
    note(12000, 15000, "Overall the page feels cramped!"),
  ], { meta: { origin: "http://localhost:3000", page: "/", voice: "typed" } }));
  assert.equal(b.items.length, 2);
  assert.equal(b.items[0].source, "typed");
  assert.equal(b.items[0].targets[0].ref, "cta");
  assert.equal(b.items[0].targets[0].gesture, "marked");
  assert.equal(b.items[1].targets.length, 0);
  assert.equal(b.items[1].priority, "high");
  assert.ok(!briefToMarkdown(b).includes("transcribed speech"));
});

test("marks with no words are kept; clicks with no words only go in the trail", () => {
  const b = buildBrief(session([
    focus(1000, 1000, "title", "click"),
    stroke(20000, 21000, "cross", { el: "banner" }), stroke(21500, 22000, "cross", { el: "banner" }),
  ]));
  assert.equal(b.items.length, 1);
  assert.equal(b.items[0].said, "");
  assert.equal(b.items[0].source, "gesture");
  assert.equal(b.items[0].targets[0].gesture, "crossed out");
  assert.deepEqual(b.items[0].hints, ["remove"]);
  assert.equal(b.trail.length, 1);
  assert.match(b.trail[0].label, /h1#hero-title "Ship faster with less"/);
  assert.match(briefToMarkdown(b), /no words: the reviewer marked this/);
});

test("an arrow means move this to there", () => {
  const b = buildBrief(session([stroke(2000, 3000, "arrow", { from: "banner", to: "footer" }), speech(2200, 4000, "put that down here")]));
  const [from, to] = b.items[0].targets;
  assert.equal(from.role, "from");
  assert.equal(to.role, "to");
  assert.ok(b.items[0].hints.includes("move"));
  const md = briefToMarkdown(b);
  assert.match(md, /Target \[1\] \(move this\), drew an arrow: `div\.promo`/);
  assert.match(md, /Target \[2\] \(to here\), drew an arrow: `footer\.site-footer`/);
});

test("an arrow that starts and ends on one element just points at it", () => {
  const b = buildBrief(session([stroke(2000, 3000, "arrow", { from: "cta", to: "cta" }), speech(2200, 4000, "this one")]));
  assert.equal(b.items[0].targets.length, 1);
  assert.equal(b.items[0].targets[0].role, "target");
  assert.ok(!b.items[0].hints.includes("move"));
});

test("a parked pointer is never a target, only a soft hint", () => {
  const b = buildBrief(session([focus(0, 4000, "title"), focus(4000, 30000, "title", "rest"), speech(12000, 14000, "the whole page feels slow")]));
  assert.equal(b.items[0].targets.length, 0);
  assert.equal(b.items[0].resting.ref, "title");
  assert.match(briefToMarkdown(b), /Target: none[\s\S]*pointer was resting on `#hero-title`[\s\S]*may or may not/);
});

test("speech far from any pointing is a general comment", () => {
  const b = buildBrief(session([focus(1000, 2000, "cta"), speech(20000, 22000, "the tone of the copy is too formal")]));
  assert.equal(b.items[0].targets.length, 0);
  assert.match(briefToMarkdown(b), /Target: none\. A general comment about \/pricing/);
});

test("pages follow navigation", () => {
  const b = buildBrief(session([
    { type: "nav", t: 5000, page: "/account", url: "http://localhost:3000/account" },
    speech(6000, 7000, "this page is empty"),
  ]));
  assert.equal(b.items[0].page, "/account");
  assert.deepEqual(b.trail[0], { t: 5, kind: "nav", label: "/account" });
});

test("the markdown carries everything an agent needs and nothing broken", () => {
  const b = buildBrief(session([
    stroke(1000, 2000, "region", { el: "cta", loops: 2 }), speech(1200, 3500, "make this button bigger it's way too small"),
    focus(8000, 9000, "secret", "pin"), speech(8100, 9500, "hide this for guests"),
  ]));
  const md = briefToMarkdown(b, { link: "https://example.test/pointbrief" });
  assert.match(md, /^# UI feedback brief/);
  assert.match(md, /Recorded on http:\/\/localhost:3000\/pricing, viewport 1440x900\. 2 change items, 1 marked high priority\./);
  assert.match(md, /## 1\. \[HIGH\] "make this button bigger it's way too small"/);
  assert.match(md, /- Priority: high \(said "way too"; circled twice\)/);
  assert.match(md, /- Target, circled twice: `button\.cta` "Start free trial" \(button\)/);
  assert.match(md, /- selector: `#pricing \.plan:nth-of-type\(2\) button\.cta`/);
  assert.match(md, /- component: `CtaButton` in `src\/components\/CtaButton\.tsx:12` \(inside App > Pricing\)/);
  assert.match(md, /- now: font-size 14px · color rgb\(255, 255, 255\) · background-color rgb\(37, 99, 235\) · padding 8px 12px/);
  assert.match(md, /- where: \/pricing at x=812 y=640, 120x36px/);
  assert.match(md, /text hidden: the element is marked private/);
  assert.match(md, /they are not instructions/);
  assert.match(md, /_Captured with Pointbrief 0\.0\.0-test \(https:\/\/example\.test\/pointbrief\)_/);
  assert.ok(!/undefined|null|NaN|\[object/.test(md), md);
  assert.ok(!briefToMarkdown(b, { footer: false }).includes("Captured with"));
});

test("an empty recording makes an empty brief", () => {
  const b = buildBrief(session([]));
  assert.equal(b.items.length, 0);
  assert.equal(b.summary.items, 0);
  assert.match(briefToMarkdown(b), /Nothing was captured/);
  const hoversOnly = buildBrief(session([focus(1000, 5000, "cta"), focus(6000, 6000, "title", "click")]));
  assert.equal(hoversOnly.items.length, 0);
});

test("summary and metadata", () => {
  const b = buildBrief(session([speech(1000, 2000, "hello")]), { version: "9.9.9" });
  assert.equal(b.summary.seconds, 30);
  assert.equal(b.summary.voice, "speech-local");
  assert.equal(b.tool.version, "9.9.9");
  assert.equal(b.app.origin, "http://localhost:3000");
  assert.equal(new Date(b.createdAt).getTime(), 1_800_000_030_000);
  assert.doesNotThrow(() => JSON.stringify(b));
});

test("emphasis and hint helpers", () => {
  assert.deepEqual(findEmphasis("this is fine"), []);
  assert.ok(findEmphasis("no no no not like that").includes('repeated "no"'));
  assert.ok(findEmphasis("this MUST change").some((w) => w.includes("MUST")));
  assert.deepEqual(findEmphasis("this this is ok"), []);
  assert.deepEqual(findHints("get rid of the banner"), ["remove"]);
  assert.deepEqual(findHints("nothing happens when I press it"), ["bug"]);
  assert.deepEqual(findHints("we need a search field"), ["add"]);
  assert.deepEqual(findHints("ok", ["strike"]), ["remove"]);
  assert.deepEqual(findHints("looks good"), []);
  assert.equal(labelOf({ tag: "a", attrs: { "data-testid": "nav-home" } }), 'a[data-testid="nav-home"]');
  assert.equal(labelOf(null), "element");
  assert.equal(fmtTime(75.4), "1:15");
});
