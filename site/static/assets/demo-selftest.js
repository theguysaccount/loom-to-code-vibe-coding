// End-to-end self-test of capture and element mapping, run on the demo page with ?selftest=1.
// It plays the sample recording through the real pipeline (synthetic pointer events, real
// hit-testing, real stroke recognition, scripted speech), then checks the brief item by item.
// Result: <body data-selftest="pass|fail"> and the details in <pre id="selftest">.
(function () {
  "use strict";
  var errors = [];
  window.addEventListener("error", function (e) { errors.push(String(e.message || e)); });
  window.addEventListener("unhandledrejection", function (e) { errors.push("unhandled rejection: " + String(e.reason && e.reason.message || e.reason)); });
  var lines = [];
  var failed = 0;
  function check(ok, what) {
    lines.push((ok ? "ok   " : "FAIL ") + what);
    if (!ok) failed++;
  }
  function resolves(t, sel) {
    if (!t || !t.selector) return false;
    var a = document.querySelectorAll(t.selector);
    var want = document.querySelector(sel);
    return a.length === 1 && !!want && (a[0] === want || want.contains(a[0]));
  }
  function finish(status) {
    var pre = document.createElement("pre");
    pre.id = "selftest";
    pre.textContent = lines.join("\n");
    document.body.appendChild(pre);
    document.body.setAttribute("data-selftest", status);
  }
  var started = Date.now();
  window.Pointbrief.playSample(window.POINTBRIEF_DEMO_SAMPLE, { speed: 1, cursor: true }).then(function (brief) {
    var it = (brief && brief.items) || [];
    check(!!brief && brief.schema === "pointbrief/brief@1", "brief has the pointbrief/brief@1 schema");
    check(it.length === 5, "five items (got " + it.length + ": " + it.map(function (x) { return JSON.stringify(x.said); }).join(", ") + ")");
    var a = it[0] || {}, b = it[1] || {}, c = it[2] || {}, d = it[3] || {}, e = it[4] || {};
    check(a.targets && resolves(a.targets[0], "#start-trial"), "1: hovering maps to the trial button (" + (a.targets && a.targets[0] && a.targets[0].selector) + ")");
    check(a.priority === "high", "1: 'way too small' makes it high priority");
    check(a.hints && a.hints.indexOf("style") >= 0, "1: hinted as a style change");
    check(a.targets && a.targets[0] && a.targets[0].styles && /px/.test(a.targets[0].styles["font-size"] || ""), "1: current styles captured");
    check(b.targets && resolves(b.targets[0], ".hero-title"), "2: the circle maps to the headline (" + (b.targets && b.targets[0] && b.targets[0].selector) + ")");
    check(b.targets && b.targets[0] && b.targets[0].gestureKind === "region", "2: recognised as a circle");
    check(b.hints && b.hints.indexOf("copy") >= 0, "2: hinted as a copy change");
    check(c.targets && resolves(c.targets[0], "#promo"), "3: the strike maps to the promo banner (" + (c.targets && c.targets[0] && c.targets[0].selector) + ")");
    check(c.targets && c.targets[0] && c.targets[0].gestureKind === "strike", "3: recognised as a strike-through (" + (c.targets && c.targets[0] && c.targets[0].gestureKind) + ")");
    check(c.hints && c.hints.indexOf("remove") >= 0, "3: hinted as a removal");
    var from = d.targets && d.targets.filter(function (t) { return t.role === "from"; })[0];
    var to = d.targets && d.targets.filter(function (t) { return t.role === "to"; })[0];
    check(!!from && resolves(from, ".tb-login"), "4: the arrow starts at the login button (" + (from && from.selector) + ")");
    check(!!to && resolves(to, ".tb-logo"), "4: the arrow ends at the logo (" + (to && to.selector) + ")");
    check(d.hints && d.hints.indexOf("move") >= 0, "4: hinted as a move");
    check(e.source === "typed", "5: the typed note is its own item");
    check(e.targets && resolves(e.targets[0], ".footer-links"), "5: the note is tied to the footer links (" + (e.targets && e.targets[0] && e.targets[0].selector) + ")");
    var md = window.Pointbrief.briefToMarkdown(brief, { link: "https://example.test/" });
    check(/^# UI feedback brief/.test(md), "markdown starts with the brief heading");
    check(!/undefined|NaN|\[object /.test(md), "markdown has no undefined, NaN or [object]");
    it.forEach(function (x) {
      (x.targets || []).forEach(function (t) {
        check(md.indexOf(t.selector) >= 0, "markdown carries selector " + t.selector);
        check(document.querySelectorAll(t.selector).length === 1, "selector is unique on the page: " + t.selector);
      });
    });
    var round = JSON.parse(JSON.stringify(brief));
    check(round.items.length === it.length, "brief survives a JSON round trip");
    var panel = window.Pointbrief.toolbar.host.shadowRoot.querySelector(".panel");
    check(panel && !panel.hidden && panel.querySelectorAll(".item").length === it.length, "the review panel lists every item");
    var phone = window.innerWidth < 600;
    check(document.documentElement.scrollWidth <= window.innerWidth + 1, "no horizontal scroll at " + window.innerWidth + "px");
    check(errors.length === 0, "no page errors" + (errors.length ? ": " + errors.join(" | ") : ""));
    lines.push("took " + Math.round((Date.now() - started) / 1000) + " s" + (phone ? " (phone width)" : ""));
    finish(failed ? "fail" : "pass");
  }).catch(function (err) {
    check(false, "the sample recording threw: " + (err && err.stack || err));
    finish("fail");
  });
})();
