# Pointbrief plugin

Point at your running app, say what to change, and draw on it. The Pointbrief toolbar turns that into a
brief (each change, in your words, tied to the exact element) and this plugin hands it to your agent.

## What it adds

- **MCP server `pointbrief`** (`server/server.mjs`, Node 18+, no dependencies):
  `latest_brief`, `list_briefs`, `get_brief`, `mark_done`, `toolbar_setup`.
- **Local bridge** on `http://127.0.0.1:47823`: the toolbar's **Send to agent** button posts briefs here.
  It accepts requests only from local pages (`localhost`, `127.0.0.1`, `*.localhost`, `*.test`) and keeps
  briefs in `~/.pointbrief/` (set `POINTBRIEF_HOME` to move it). It also serves the toolbar script at
  `/pointbrief.js`.
- **Skills**: `/pointbrief:setup` adds the toolbar to your app in development; `/pointbrief:apply` applies
  the latest brief and shows you the diff before anything is committed.

## Install (Claude Code)

```
/plugin marketplace add theguysaccount/loom-to-code-vibe-coding
/plugin install pointbrief@pointbrief
```

## What leaves your computer

Nothing, from this plugin. The toolbar runs in your page and posts to `127.0.0.1` only. Voice is
transcribed by your browser (on the device when the browser supports it); see the
[privacy notes](https://theguysaccount.github.io/loom-to-code-vibe-coding/docs/privacy/).

MIT licensed. Source and docs: https://github.com/theguysaccount/loom-to-code-vibe-coding
