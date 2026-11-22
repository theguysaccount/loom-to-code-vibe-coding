// Copy buttons on code blocks, and analytics events when the optional GoatCounter key is on.
(function () {
  function count(name) {
    try {
      if (window.goatcounter && window.goatcounter.count) window.goatcounter.count({ path: "event/" + name, title: name, event: true });
    } catch (e) { /* analytics is optional */ }
  }
  window.pbCount = count;
  document.querySelectorAll("pre").forEach(function (pre) {
    if (pre.closest(".brief-card") || pre.closest(".no-copy")) return;
    var wrap = document.createElement("div");
    wrap.className = "code";
    pre.parentNode.insertBefore(wrap, pre);
    wrap.appendChild(pre);
    var b = document.createElement("button");
    b.type = "button";
    b.className = "copy";
    b.textContent = "Copy";
    b.addEventListener("click", function () {
      var text = pre.innerText;
      var done = function () {
        b.textContent = "Copied";
        setTimeout(function () { b.textContent = "Copy"; }, 1500);
        count("copy-snippet");
      };
      if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, function () {});
    });
    wrap.appendChild(b);
  });
  document.querySelectorAll("a.bookmarklet").forEach(function (a) {
    a.addEventListener("click", function (e) {
      e.preventDefault();
      alert("Drag this button to your bookmarks bar, then click it on any page of your app.");
    });
  });
})();
