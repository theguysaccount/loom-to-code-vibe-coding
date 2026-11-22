---
title: Pointbrief docs: install the toolbar and record your first brief
description: Add the Pointbrief toolbar to your app in development, record point-and-talk feedback, and hand the brief to Claude Code, Cursor or any coding agent. Options, shortcuts and the JavaScript API.
path: /docs/
updated: 2026-11-22
og: docs
---

# Getting started

Pointbrief has two parts:

- **The toolbar**, one script you add to your web app in development. You record over the running app: point, talk or type, draw. Pressing **Done** turns the recording into a brief.
- **The plugin** for Claude Code (and an MCP server for Cursor and others), which receives briefs from the toolbar and applies them. Optional: you can always copy the brief and paste it anywhere.

Want to see it first? [Try the demo]({{base}}/demo/).

## Add the toolbar

Pick one script tag and add it to your app's HTML **in development only**.

```html
<!-- Pinned to a release (recommended) -->
<script src="https://cdn.jsdelivr.net/gh/theguysaccount/loom-to-code-vibe-coding@v{{version}}/plugin/toolbar/pointbrief.js" defer></script>

<!-- Always the latest release -->
<script src="{{site}}/pointbrief.js" defer></script>

<!-- Served by the Claude Code plugin while it runs (no internet needed) -->
<script src="http://127.0.0.1:47823/pointbrief.js" defer></script>
```

The toolbar appears in the bottom-right corner. It lives in its own shadow DOM, so your CSS doesn't change it and it doesn't change your page.

### Keeping it out of production

**Vite** (React, Vue, Svelte, Solid). In `src/main.tsx` or `src/main.js`:

```js
if (import.meta.env.DEV) {
  const s = document.createElement("script");
  s.src = "https://cdn.jsdelivr.net/gh/theguysaccount/loom-to-code-vibe-coding@v{{version}}/plugin/toolbar/pointbrief.js";
  s.defer = true;
  document.head.appendChild(s);
}
```

**Next.js App Router.** In `app/layout.tsx`:

```tsx
import Script from "next/script";

// inside <body>:
{process.env.NODE_ENV === "development" && (
  <Script src="https://cdn.jsdelivr.net/gh/theguysaccount/loom-to-code-vibe-coding@v{{version}}/plugin/toolbar/pointbrief.js" strategy="afterInteractive" />
)}
```

The Pages Router is the same, in `pages/_app.tsx`.

**Nuxt.** In `nuxt.config.ts`, under `$development: { app: { head: { script: [{ src: "…/pointbrief.js", defer: true }] } } }`.

**SvelteKit.** Add the tag to `src/app.html`, or load it from `+layout.svelte` when `dev` from `$app/environment` is true.

**Server-rendered apps** (Rails, Django, Laravel, Phoenix): put the tag in the base template behind the framework's development check.

**No access to the HTML?** Use the bookmarklet on the [home page]({{base}}/#install). It loads the same script into whatever page you're on, unless that page's Content Security Policy blocks outside scripts.

## Record a brief

1. Press **Record**. The first time, a card explains what is recorded and how your browser handles voice. Choose **Start recording**, or **Type instead** to skip the microphone.
2. Use your app and talk. Point at what you mean while you say it: "this button is too small". Hover is enough; clicking works too.
3. Switch to **Mark** to draw on the page:
   - **Circle** or box something: "this area".
   - **Underline** text: usually a wording change.
   - **Strike through**, **cross out** (two lines) or **scribble over** something: remove it.
   - **Arrow** from one thing to another: move it there.
   - **Tap** once: pin a spot.
4. Type a note at any time in the box under the bar. It's tied to whatever you were pointing at when you started typing.
5. Press **Done**. The review panel shows one item per thought. Fix any misheard words, delete items you don't want, then **Copy brief**, **Send to agent**, or download `.md` / `.json`.

Pauses split items: stop talking for a couple of seconds, or move to something else, and the next sentence starts a new item. Saying "this… and this" while pointing at two things keeps them in one item, marked `[1]` and `[2]`.

### Shortcuts

| Keys | What it does |
|---|---|
| <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd> | Start recording, or stop and show the brief |
| <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>D</kbd> | Switch between Point and Mark |
| <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>H</kbd> | Hide or show the toolbar |
| <kbd>Esc</kbd> | Close a card or the brief, or leave Mark mode |

A full page load in the middle of a recording doesn't lose it: the recording carries on after the new page loads.

## Options

Set them as `data-` attributes on the script tag:

| Attribute | Effect |
|---|---|
| `data-position="left"` | Put the toolbar in the bottom-left corner |
| `data-lang="de-DE"` | Language for speech recognition (default: the browser's language) |
| `data-voice="off"` | Typing only; never asks for the microphone |
| `data-bridge="off"` | Hide **Send to agent** (copy and download only) |
| `data-bridge="http://127.0.0.1:5000"` | Use a bridge on another port |
| `data-footer="off"` | Leave the "Captured with Pointbrief" line out of briefs |
| `data-hidden` | Start hidden; <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>H</kbd> shows it |
| `data-manual` | Don't start automatically; call `Pointbrief.init()` yourself |

Add `?pointbrief=off` to a URL to load the page without the toolbar. Mark an element `data-pointbrief-private` to keep its text out of briefs.

## JavaScript API

```js
// With data-manual on the script tag:
const toolbar = Pointbrief.init({
  position: "right",
  lang: "en-US",
  voice: "auto",            // or "off"
  bridge: "http://127.0.0.1:47823",
  onBrief(brief, markdown) {
    // your own hand-off: post it to your issue tracker, save it, ...
  },
});

await Pointbrief.start();           // start recording (skips the consent card)
const brief = await Pointbrief.stop();
Pointbrief.briefToMarkdown(brief);  // the Markdown an agent gets
```

The toolbar also fires DOM events on its host element: `pointbrief:start`, `pointbrief:brief` (with the brief as `detail`) and `pointbrief:handoff`.

## Next

- [Claude Code plugin]({{base}}/docs/claude-code/): send briefs straight to Claude Code and apply them.
- [Cursor]({{base}}/docs/cursor/): the same MCP server in Cursor.
- [Brief format]({{base}}/docs/brief-format/): every field, plus the JSON Schema.
- [Privacy]({{base}}/docs/privacy/): what's captured, and where voice goes.
