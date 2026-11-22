---
title: Pointbrief privacy: what the toolbar records and where your voice goes
description: Pointbrief records events, not video. What it captures, what it never reads, how each browser handles speech recognition, and where briefs are stored.
path: /docs/privacy/
updated: 2026-11-22
og: docs
---

# Privacy

Pointbrief has no server, no account and no analytics in the toolbar. Here is exactly what happens on your machine.

## What a recording contains

- **What you point at.** The elements you rest the pointer on, click or tap, with times.
- **What you draw** in Mark mode, reduced to a shape (circle, line, arrow…) and the element under it.
- **What you say or type**, as text.
- For each element you referred to: its tag, a CSS selector, its visible text (up to 100 characters), a few attributes, its position and some computed styles, and in development builds its component name and source file.
- Pages you visited during the recording.

## What it never records

- No screen video, no screenshots, no audio files.
- No form values: inputs, text areas and selects are described by name and role only, and password fields are marked private.
- Nothing inside an element marked `data-pointbrief-private` (or `data-private`): its text and attributes are left out.
- Nothing from pages where the toolbar isn't loaded.

## Where your voice goes

The toolbar uses your browser's built-in speech recognition (the Web Speech API). Pointbrief never sees the audio; the browser hands it back as text. Where the browser does the recognition depends on the browser:

| Browser | Where speech is recognised |
|---|---|
| Chrome and Edge on desktop | On the device when the browser has the language pack (Chrome offers to download it; the toolbar shows a **Download it** button). Otherwise the browser's online speech service. |
| Chrome on Android | The phone's speech service (usually Google's). |
| Safari (macOS, iOS) | Apple's speech recognition; on-device for some languages and devices, otherwise Apple's servers. Siri must be enabled. |
| Firefox (version 160 and later) | On the device. |
| Others | Many browsers don't offer speech recognition at all; the toolbar then offers typing. |

Before your first recording, the toolbar checks and tells you which case applies. **Type instead** never touches the microphone, and `data-voice="off"` on the script tag removes the voice option entirely.

## Where briefs go

- They stay in the page. A copy of the last brief is kept in the tab's `sessionStorage` so a reload doesn't lose it; closing the tab clears it.
- **Copy brief** puts the Markdown on your clipboard. **.md** and **.json** download files.
- **Send to agent** posts the brief to the Pointbrief plugin on `127.0.0.1` (your own computer), which saves it in `~/.pointbrief/`. The bridge accepts briefs only from local pages. See [how the bridge stays safe]({{base}}/docs/claude-code/#how-the-bridge-stays-safe).
- What your coding agent then does with it (for example, sending it to its model provider as part of your conversation) is up to the agent you use, the same as anything else you paste into it.

## This website

The Pointbrief website is static and sets no cookies. The demo page runs the toolbar entirely in your browser and has no Send to agent button.
