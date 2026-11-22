---
title: A UI feedback template for AI coding agents (copy and paste)
description: A copy-and-paste template for writing UI feedback that Claude Code, Cursor and other coding agents apply correctly the first time, with a worked example and the mistakes that cause wrong edits.
path: /guides/ui-feedback-template-for-ai-coding-agents/
updated: 2026-11-22
og: guide-template
---

# A UI feedback template for coding agents

When an agent makes the wrong UI change, the cause is usually the feedback, not the model: it changed the wrong button because there were three, or made something "bigger" by an amount you didn't mean. This template fixes the common failures. It's the same structure the [Pointbrief toolbar]({{base}}/) produces automatically, so you can write it by hand when you can't use the toolbar.

## The template

```markdown
# UI feedback: <page or flow>

App: <URL, e.g. http://localhost:5173/pricing>. Viewport: <e.g. 1440x900 or iPhone width>.
Make each change in the source with the smallest edit. Show me the diff per item before committing.

## 1. <what should change, in one sentence>
- Element: <tag and exact visible text, e.g. button "Start free trial">
- Find it by: <id / data-testid / class / component file, if you know it>
- Now: <what it is now, e.g. 12px text, grey on light blue>
- Want: <what it should be, e.g. 16px, white on our primary blue>
- Priority: <high / normal>

## 2. …
```

## Why each line matters

- **Exact visible text** is the fastest way for an agent to find an element: it searches the source for the string. Paraphrasing ("the trial button") forces it to guess.
- **A selector or component file** removes ambiguity when the same text appears several times (three "Choose plan" buttons). In a browser, right-click → Inspect gives you the element's classes and id.
- **Now and want** turn relative words into numbers. "Bigger" could mean 13px or 20px; "from 12px to 16px" can't be misread. Note colours as hex or as the design token name.
- **One change per item** lets the agent work through a list and report per item, and lets you approve or reject each one.
- **Priority** tells it what to do first if the list is long.

## A worked example

```markdown
# UI feedback: landing page

App: http://localhost:5173/. Viewport: 1440x900.
Make each change in the source with the smallest edit. Show me the diff per item before committing.

## 1. Make the trial button much more prominent
- Element: button "Start free trial" (hero section)
- Find it by: #start-trial, in src/components/Hero.tsx
- Now: 12px text, rgb(124, 134, 173) on rgb(201, 210, 245), padding 6px 10px
- Want: 16px semibold, white on #3651d4, padding 12px 20px
- Priority: high

## 2. Fix the typo in the headline
- Element: h1 "Plan you week in minutes"
- Want: "Plan your week in minutes"

## 3. Remove the promo banner
- Element: div#promo "50% off all plans this week only"
- Want: gone (delete the component usage, keep the component file)
```

## Mistakes that cause wrong edits

1. **"This" and "that" with nothing pointing.** In writing, name the element every time.
2. **Several changes in one paragraph.** The agent does the first two and forgets the third.
3. **Describing the fix instead of the outcome.** "Add margin-top: 20px" may fight the layout system; "move it 20px further from the heading" lets the agent use the project's spacing scale.
4. **Feedback on built output.** Point at the source component, not a class name generated at build time like `css-1x2y3z` or `Button_primary__a1B2c`.
5. **No review step.** Always ask for the diff first.

## Skip the typing

Writing this by hand takes a few minutes per page. With Pointbrief you talk and point over the running app and get the same structure, including the selector, current styles, component and file, filled in for you. [Try it on the demo app]({{base}}/demo/).
