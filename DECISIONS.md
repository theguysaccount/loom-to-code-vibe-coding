# Decisions

1. **Name: Pointbrief, not "Loom-to-code".** "Loom" is Atlassian's trademark and Loom itself shipped a
   "record for agent" mode in July 2026, so the name would mislead. The repo keeps the assigned slug.
   `pointbrief` was free on GitHub and npm (checked 2026-11-10 and 2026-11-22).
2. **Events, not pixels.** The evaluator suggested screen recording. A video can't be mapped to code, and
   uploading screens is the privacy risk the notes flag. Recording DOM events (what you pointed at, drew
   and said, with times) gives the element-mapped change list directly, needs no server, and stores no
   screens. Pixel capture (getDisplayMedia, Region Capture) is a possible v2 for visual glitches.
3. **A toolbar script, not a browser extension.** A script tag or bookmarklet works in every browser, on
   phones, and inside Claude Code's preview flows, with no store listing (which would need an account).
   An extension can wrap the same bundle later.
4. **Voice through the Web Speech API.** Free, no key, on-device in Chrome when the language pack is
   installed. The toolbar says which mode applies before recording and offers typing everywhere. Tone
   analysis is cut (the brief's own scope note); emphasis comes from words, repetition and gestures.
5. **One-stroke gesture recognition.** Circles (any size or direction, including boxes and double loops),
   lines classified by what's under them (strike-through vs underline), arrows by their head, crosses as
   two crossing lines, scribbles by reversals, pins by taps. Pure functions with unit tests.
6. **Time alignment rules** (src/brief.js): pauses of 2.2 s always split items; 0.9 s pauses split when the
   pointer moved to something new; marks up to 6 s before or 2.5 s after speech belong to it; a lead-in
   with no target merges with the marked sentence that follows; a parked pointer is a hint, never a target.
7. **No dependencies anywhere.** A 70-line bundler, a small Markdown renderer, a hand-written MCP server and
   CDP-driven browser tests. Nothing to install or audit, and nothing breaks when a package changes.
8. **The committed bundle is the distribution.** `plugin/toolbar/pointbrief.js` is built from `src/` and
   committed, so jsDelivr can serve any tag, the plugin can serve it offline, and CI proves it matches.
9. **Bridge security.** 127.0.0.1 only; local page origins only; a custom header so browsers must pass a
   CORS preflight; JSON only; 2 MB cap; sanitised ids; several sessions share one inbox.
10. **Cursor support is manifest-only and untested here.** No Cursor on this machine. The MCP server path
    in the docs is the reliable route; the GitHub import is documented as untested.
11. **Competition (Nov 2026).** Loom "record for agent" (video, keyframes, no DOM mapping, paid plans);
    Cursor design mode (element select + notes, proprietary, per note); Agentation and React Grab (element
    pickers, no voice or drawing); Jam, Clipy, ThinkRun (recorders, no element mapping or no drawing). None
    found that combines continuous narration, pointer and drawing with element mapping. Big platforms could
    add it natively; being open, agent-neutral and local-first is the hedge.
12. **Defaults for the open questions.** Stand-alone open-source tool (not a Persist-internal feature), MIT,
    free; the hosted team tier and any Persist pipeline integration come later on separate hosting.
