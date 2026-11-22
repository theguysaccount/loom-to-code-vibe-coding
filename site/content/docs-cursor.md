---
title: Pointbrief in Cursor: point-and-talk UI feedback for the Cursor agent
description: Use Pointbrief briefs in Cursor by importing the repository as a plugin, adding the Pointbrief MCP server, or pasting a copied brief into the agent chat.
path: /docs/cursor/
updated: 2026-11-22
og: docs
---

# Cursor

The toolbar works the same whichever agent you use. For Cursor there are three ways to get a brief to the agent, from simplest to most connected.

## 1. Paste the brief

Record, press **Done**, then **Copy brief** and paste it into the agent chat. The brief explains itself: each item lists what you said and the element it refers to, so the agent can find the code without any setup.

## 2. Add the MCP server

The plugin's server is a plain Node.js script with no dependencies. Clone the repository somewhere permanent and point Cursor at it in `~/.cursor/mcp.json` (all projects) or `.cursor/mcp.json` (one project):

```bash
git clone https://github.com/theguysaccount/loom-to-code-vibe-coding.git ~/.pointbrief-plugin
```

```json
{
  "mcpServers": {
    "pointbrief": {
      "command": "node",
      "args": ["${userHome}/.pointbrief-plugin/plugin/server/server.mjs"]
    }
  }
}
```

Then ask the agent to "apply my latest Pointbrief". It calls `latest_brief`, edits the code, and calls `mark_done` when you approve. The same server runs the local bridge, so the toolbar's **Send to agent** button works too.

## 3. Import the repository as a plugin

The repository carries a Cursor marketplace manifest (`.cursor-plugin/marketplace.json`) next to the Claude Code one, with the plugin in `plugin/`: the MCP server (`mcp.json`), the `apply` and `setup` skills, and a rule. In Cursor, import it from **Customize → From GitHub Repository** with `https://github.com/theguysaccount/loom-to-code-vibe-coding`.

Cursor's GitHub imports are new, and the Pointbrief maintainers haven't been able to test this path in Cursor itself. If the import doesn't work for you, option 2 does the same thing.

## If you use both Claude Code and Cursor

Both can run the server at once. The first one to start owns the bridge port; the other reads the same inbox in `~/.pointbrief/`. A brief sent from the toolbar is visible to both, and whichever applies it marks it done.
