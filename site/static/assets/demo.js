// The demo page: starts the toolbar with the coach card, offers the scripted sample recording,
// and prints the brief under the app. ?selftest=1 runs the in-page end-to-end test instead.
(function () {
  "use strict";
  var SAMPLE = [
    { say: "make this button bigger it's way too small", ms: 2600, async: true },
    { hover: "#start-trial", ms: 2600 },
    { wait: "speech" },
    { wait: 2600 },
    { mode: "mark" },
    { say: "there's a typo here it should say plan your week", ms: 2800, async: true },
    { circle: ".hero-title" },
    { wait: "speech" },
    { wait: 2600 },
    { say: "get rid of this banner", ms: 1700, async: true },
    { strike: "#promo" },
    { wait: "speech" },
    { wait: 2600 },
    { say: "move this next to the logo", ms: 1800, async: true },
    { arrow: [".tb-login", ".tb-logo"] },
    { wait: "speech" },
    { wait: 2600 },
    { mode: "point" },
    { note: "Footer links are too close together", at: ".footer-links" },
    { wait: 600 },
  ];
  window.POINTBRIEF_DEMO_SAMPLE = SAMPLE;

  var out = document.getElementById("brief-out");
  var box = document.getElementById("your-brief");
  var selftest = /[?&]selftest=1\b/.test(location.search);

  function show(brief, md) {
    out.textContent = md;
    box.hidden = false;
    if (window.pbCount) window.pbCount(brief && brief.items && brief.items.length ? "brief" : "empty-brief");
  }

  function play() {
    if (!window.Pointbrief) return;
    window.scrollTo(0, 0);
    return window.Pointbrief.playSample(SAMPLE);
  }

  window.Pointbrief.init({ coach: !selftest, bridge: "off", onSample: play, onBrief: show });
  document.getElementById("play-sample").addEventListener("click", play);
  document.getElementById("copy-brief").addEventListener("click", function () {
    var btn = this;
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(out.textContent).then(function () {
        btn.textContent = "Copied";
        if (window.pbCount) window.pbCount("copy-brief");
        setTimeout(function () { btn.textContent = "Copy brief"; }, 1500);
      });
    }
  });
  document.getElementById("start-trial").addEventListener("click", function () {});

  if (selftest) {
    var s = document.createElement("script");
    s.src = (document.querySelector('script[src$="/assets/demo.js"]').src).replace(/demo\.js$/, "demo-selftest.js");
    document.body.appendChild(s);
  }
})();
