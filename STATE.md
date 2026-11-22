# State (2026-11-22)

- **Before this build:** one Apple Note (Nov 2025): vibe-coding tools "fail to take in the context of emotion +
  cursor to highlight and draw on the canvas"; "Loom -> Code makes more sense". No code, no prototype.
- **Works now:** the toolbar (record voice, pointer and drawings over any page; one-stroke recognition of
  circles, arrows, underlines, strike-throughs, crosses, scribbles and pins; element mapping with unique
  selectors and React/Vue/Svelte component and file lookup; a brief in Markdown and JSON), the Claude Code
  plugin (MCP server with 5 tools, local bridge, `/pointbrief:setup`, `/pointbrief:apply`), Cursor
  manifests, the website with docs, guides and a demo app.
- **Verified:** 40+ unit tests, browser tests in headless Chrome (sample recording through the real
  capture code at desktop and phone widths, element-mapping fixtures, toolbar → bridge → inbox, real React
  19 and Vue 3 builds, every page at two widths), `claude plugin validate --strict` and
  `--profile directory --strict`, install from GitHub in an isolated Claude Code config.
- **Not verified:** voice recognition with a real microphone (headless tests use a scripted speech engine);
  the Cursor import path (no Cursor here); Safari and Firefox by hand.
- **Related, not reused:** `theguysaccount/tellscreen` (another session's hosted service that turns an
  existing video into a change list) is the complement: video in, server-side. Pointbrief is local-first,
  no video, element-mapped.
