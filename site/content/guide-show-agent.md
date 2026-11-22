---
title: How to show a coding agent what to change in your UI (screenshots, video, element pickers, point and talk)
description: Coding agents can't watch you point at the screen. A practical comparison of the ways to give an AI coding agent visual UI feedback, from screenshots to element pickers and point-and-talk briefs, and when each works.
path: /guides/show-a-coding-agent-what-to-change/
updated: 2026-11-22
og: guide-show
---

# How to show a coding agent what to change

"The button on the right is too small, and the heading has a typo" is clear to a person standing behind you. To a coding agent reading your chat, it's a guessing game: which button, which heading, which file? Most wasted agent turns on UI work come from that gap between what you see and what the agent can find.

Here are the ways to close it, roughly from least to most precise. Products change quickly; this reflects what was available in November 2026.

## 1. Describe it in words

Typing "make the pricing CTA bigger" works when the element has an obvious name and there's only one of it. It breaks down with repeated components (three "Choose plan" buttons), visual-only problems ("the spacing feels off here") and anything that needs a "this".

**Make it work better:** quote the element's visible text exactly, name the page, and say what it is now and what you want ("the 'Start free trial' button on / is 12px text; make it 16px").

## 2. Screenshots

Agents that accept images can see the problem, and a screenshot with a circle drawn on it carries a lot. But a picture still has to be mapped back to code: the agent has to guess which component renders those pixels. Screenshots also go stale fast, and a page of five issues becomes five images plus five explanations.

**Good for:** one visual problem, where the element's text is distinctive enough to search for.

## 3. Screen recordings with narration

Recording a video while you talk is how most people give feedback to developers, and some tools now turn narrated recordings into task lists for agents. Loom added a "record for agent" mode in 2026 that produces tasks with transcript quotes and keyframes; bug-capture tools like Jam pair a recording with console and network logs and expose them to agents through MCP.

The limit is the same as screenshots: a video knows pixels, not elements. The agent still has to find the code that matches a frame.

**Good for:** feedback for a mix of people and agents, bug reports where logs matter, and apps you can't add anything to.

## 4. Element pickers

Pickers let you click an element and copy what an agent needs to find it: its HTML, selector, and in React or Vue dev builds the component and source file. Cursor's built-in browser has a design mode for this, with notes per element; open-source tools such as React Grab copy the component and file for a clicked element, and Agentation adds a toolbar for annotating several elements with notes.

This is precise, but it's one element and one typed note at a time. It's awkward for feedback that's naturally spoken, spans several elements in one sentence, or is about removing or rearranging things.

**Good for:** targeted tweaks to a few elements when you know exactly what you want.

## 5. Point and talk

[Pointbrief]({{base}}/) combines the last two: you record over your running app the way you would in a Loom, talking and pointing and drawing, but it records events instead of pixels. Every sentence is lined up with what you were pointing at when you said it, and each drawn mark is mapped to the element under it. The result is a list of change items, each with your words and the exact elements (selector, text, styles, component and file), which any agent can apply.

Gestures carry meaning the agent can use: a strike-through or cross means remove, an underline usually means wording, an arrow means move this there. Emphasis ("way too small", circling twice) marks an item high priority.

**Good for:** reviewing a whole page or flow in one go, feedback from people who think out loud, and handing a list of changes to an agent in one paste.

## Which to use

| Situation | Best fit |
|---|---|
| One obvious element, one change | Describe it in words |
| One visual glitch | Screenshot with a mark on it |
| Bug with console errors or network failures | A bug recorder with logs |
| A few precise tweaks | An element picker |
| A review pass over a page or flow | Point and talk |
| You can't add a script to the app | Screenshots or video; or the Pointbrief bookmarklet if the page allows it |

## Whatever you use

- **Say what it is now and what you want.** "Bigger" is relative; "from 12px to 16px" isn't. Pointbrief includes current styles for this reason.
- **One thought per item.** Agents do better with a numbered list than a paragraph.
- **Ask for the diff before committing.** Review item by item, then let the agent commit.

[Try point and talk on a demo app]({{base}}/demo/), or read the [UI feedback template]({{base}}/guides/ui-feedback-template-for-ai-coding-agents/) for writing it by hand.
