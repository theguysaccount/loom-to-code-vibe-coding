---
name: setup
description: Add the Pointbrief feedback toolbar to this project's web app in development only, so the user can point at the running app, talk and draw, and send the brief to this agent. Use when the user asks to set up, install or add Pointbrief to their app.
---

# Add the Pointbrief toolbar to this app

1. Call the `toolbar_setup` tool of the `pointbrief` MCP server. It returns the script tags (hosted,
   pinned to a version, or served by this plugin) and whether the local bridge is running.
2. Work out how the app is built (look at `package.json`, `index.html`, `app/layout.tsx`,
   `nuxt.config`, `src/app.html`, or the server templates) and add the toolbar **in development only**,
   using the snippet `toolbar_setup` gives for that framework. Never add it to a production build.
3. Prefer the pinned script tag unless the user wants offline use, in which case use the one served by
   this plugin (it works while the agent is running).
4. Show the user the change, then tell them how to use it: run the app, press **Record** on the toolbar
   (bottom right), point and talk or type, switch to **Mark** to circle or cross things out, press
   **Done**, then **Send to agent**, and run `/pointbrief:apply`.
5. If the bridge isn't running, they can still press **Copy brief** and paste it here.
