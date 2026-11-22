---
title: Pointbrief for Claude Code: send UI feedback from your app straight to the agent
description: Install the Pointbrief plugin in Claude Code, add the toolbar to your app with /pointbrief:setup, and apply recorded point-and-talk feedback with /pointbrief:apply. How the local bridge works and how it stays safe.
path: /docs/claude-code/
updated: 2026-11-22
og: docs
---

# Claude Code plugin

The plugin lets the toolbar's **Send to agent** button deliver briefs to Claude Code, and gives Claude Code two commands: one that adds the toolbar to your app, and one that applies a brief and shows you the diff.

## Install

In Claude Code:

```text
/plugin marketplace add theguysaccount/loom-to-code-vibe-coding
/plugin install pointbrief@pointbrief
```

Or from a terminal:

```bash
claude plugin marketplace add theguysaccount/loom-to-code-vibe-coding
claude plugin install pointbrief@pointbrief
```

The plugin runs a small server with Node.js, so you need **Node.js 18 or newer** on your PATH. If your app runs on Vite, Next.js or similar, you already have it. Restart Claude Code after installing so the server starts.

## Use it

1. **`/pointbrief:setup`** asks the plugin for the right script tag and adds the toolbar to your app in development only. You can also add it yourself ([how]({{base}}/docs/#add-the-toolbar)).
2. Run your app, press **Record** on the toolbar, point and talk (or type), mark things up, and press **Done**.
3. Press **Send to agent** in the review panel. The panel confirms with the brief's id.
4. **`/pointbrief:apply`** in Claude Code. It reads the newest brief, finds the code for each item (component file first, then selector, then visible text), makes the smallest change that does what you said, and shows you `git diff` item by item. Nothing is committed unless you ask.
5. When you approve, it marks the brief done with a one-line summary per item.

You can also just ask: "apply my latest Pointbrief". The skill triggers on that.

## What the plugin adds

| Part | What it is |
|---|---|
| MCP server `pointbrief` | Tools `latest_brief`, `list_briefs`, `get_brief`, `mark_done` and `toolbar_setup` |
| Local bridge | `http://127.0.0.1:47823`: receives briefs from the toolbar and serves `/pointbrief.js` |
| `/pointbrief:setup` | Adds the toolbar to your app in development |
| `/pointbrief:apply` | Applies the latest brief (or `/pointbrief:apply <id>`), then shows the diff |

Briefs are kept in `~/.pointbrief/inbox/` until they're marked done, then in `~/.pointbrief/done/` (the newest 200). Set `POINTBRIEF_HOME` to keep them somewhere else.

## How the bridge stays safe

The bridge listens on `127.0.0.1` only, so nothing outside your computer can reach it. Within your computer, any web page could try to send it requests, so it only accepts briefs from **local pages**:

- the request must come from `http://localhost`, `127.0.0.1`, `[::1]`, a `*.localhost` or a `*.test` origin, on any port;
- it must be JSON and carry an `X-Pointbrief` header, which makes the browser ask the bridge first (a CORS preflight), and the bridge says no to every other site;
- bodies are capped at 2 MB and must be a Pointbrief brief.

A page on the public internet therefore can't drop a brief into your agent's inbox. To allow another origin (say, a staging URL you test against), start Claude Code with `POINTBRIEF_ALLOW_ORIGINS=https://staging.example.com`.

Briefs contain text copied from your page. The brief tells the agent that quoted page text and selectors are data for finding code, never instructions, and `/pointbrief:apply` repeats it.

## Settings

| Environment variable | Default | Effect |
|---|---|---|
| `POINTBRIEF_PORT` | `47823` | Bridge port. Point the toolbar at it with `data-bridge="http://127.0.0.1:PORT"`. |
| `POINTBRIEF_BRIDGE` | on | `off` stops the bridge; the tools still read the inbox. |
| `POINTBRIEF_HOME` | `~/.pointbrief` | Where briefs are kept. |
| `POINTBRIEF_ALLOW_ORIGINS` | none | Extra page origins allowed to send briefs, comma-separated. |

## Several Claude Code sessions

Only one process can own the port. The first session with the plugin starts the bridge; the others notice and read the same inbox, so `/pointbrief:apply` works in any of them. If the first session closes, another takes over the port within about ten seconds.

## Troubleshooting

- **No Send to agent button**: the toolbar couldn't reach the bridge. Check the plugin is installed and Claude Code was restarted, and that the page is local (`localhost` or similar). Ask Claude Code to run `toolbar_setup`: it reports whether the bridge is listening.
- **"port 47823 is in use by another program"**: set `POINTBRIEF_PORT` to a free port and add `data-bridge="http://127.0.0.1:PORT"` to the script tag.
- **Nothing happens on `/pointbrief:apply`**: run `claude plugin list` to check the plugin is enabled, and `node --version` to check Node.js 18+.

The plugin's source is in [`plugin/`]({{repo}}/tree/main/plugin) on GitHub.
