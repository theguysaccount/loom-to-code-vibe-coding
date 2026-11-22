# Pointbrief

**User.** Founders, designers and PMs who review apps built with AI coding agents, and developers who
take their feedback. They explain changes by talking over the screen and pointing ("this is too small",
"move that over here"); today they record a Loom for a human, or type a vague prompt and let the agent guess.

**Painful job.** Turning "this, here, bigger" into an edit the agent makes on the right element the first
time. Agents can't watch video, and a screenshot doesn't say which component renders those pixels.

**Promise.** Point at your app, say what to change, and your agent gets a brief it can apply: every change
in your words, tied to the exact element, selector and source file.

**Wedge.** A one-line script tag (or a bookmarklet) for any local web app, plus a Claude Code plugin that
receives briefs and applies them with a diff to approve. Free, open source, no account, no upload.

**Why now.** Vibe-coding moved the bottleneck from writing code to describing changes. In 2026 the coding
agents and Loom added visual inputs, but none line up continuous narration, pointing and drawing with the
DOM elements behind them (see DECISIONS.md, "Competition").

**Activation metric.** A brief produced with at least one targeted item (demo: `event/brief`; in an app:
a brief sent to the bridge). Instrumented on the site, off until the GoatCounter key is set.

**First revenue event.** A GitHub Sponsors sponsorship (slot ready, key in OPERATIONS.md). Later: a hosted
team inbox (shared briefs, history, issue-tracker hand-off) as a paid tier on separate hosting.

**v1 deliberately won't:** record video or screenshots; analyse tone of voice beyond emphasis words,
repetition and repeated gestures; run any server or model; apply changes without the user approving
the diff; work in native mobile apps.
