---
title: The Pointbrief brief format (pointbrief/brief@1)
description: Every field of a Pointbrief brief, the element-mapped change list for coding agents, as Markdown and as JSON, with the JSON Schema.
path: /docs/brief-format/
updated: 2026-11-22
og: docs
---

# Brief format

A brief comes in two forms with the same content: **Markdown** for pasting into any agent, and **JSON** (`pointbrief/brief@1`) for tools. The [JSON Schema]({{base}}/brief.schema.json) describes every field; an [example]({{base}}/example-brief.json) is built from the same code as the toolbar on every deploy.

## The Markdown

```markdown
# UI feedback brief

Recorded on http://localhost:5173/, viewport 1440x900. 5 change items, 1 marked high priority.

How to read this: …

## 1. [HIGH] "make this button bigger it's way too small"
- Priority: high (said "way too")
- Likely kind of change: style
- Target, pointed at: `button#start-trial` "Start free trial" (button)
  - selector: `#start-trial`
  - component: `Hero` in `src/components/Hero.tsx:18` (inside App > Landing)
  - now: font-size 12px · font-weight 500 · color rgb(124, 134, 173) · …
  - where: / at x=664 y=318, 112x27px
```

Each item is one thought: what the reviewer said or typed, and what they pointed at while saying it. When one sentence covers several elements, markers in the words show which part goes with which target: `make this [1] bigger and this [2] blue`.

## Top level

| Field | Meaning |
|---|---|
| `schema` | Always `pointbrief/brief@1` for this version |
| `id` | `pb_<date>_<time>_<random>`, unique per recording |
| `createdAt` | When the recording ended (ISO 8601) |
| `app` | `origin`, `title`, `page` (path where it started), `viewport` `{w, h}`, `framework` (detected, e.g. `react`) |
| `summary` | `items`, `high` (how many are high priority), `seconds` (length), `voice` (`speech-local`, `speech-cloud`, `typed`, `none`) |
| `items` | The change list (below) |
| `trail` | Pages visited and elements clicked, with times, for context |
| `tool` | `{ name: "pointbrief", version }` |

## Items

| Field | Meaning |
|---|---|
| `n` | Item number, from 1 |
| `said` | The reviewer's words (speech or typed note); empty for a silent mark |
| `saidMarked` | The same words with `[1]`, `[2]` markers, when there are several targets |
| `source` | `speech`, `typed`, or `gesture` (a mark with no words) |
| `t` | `[start, end]` in seconds from the start of the recording |
| `page` | Path the item refers to |
| `priority` | `high` or `normal` |
| `why` | Why it's high: `said "really"`, `circled twice`, `repeated "no"`, … |
| `hints` | Likely kinds of change, guessed from the words and gestures: `style`, `copy`, `remove`, `move`, `add`, `bug` |
| `targets` | The elements (below); empty for a general comment |
| `resting` | For a general comment: an element the pointer was parked on, which may or may not be the subject |

## Targets

| Field | Meaning |
|---|---|
| `n` | Target number within the item, matching the `[n]` markers |
| `role` | `target`, or `from` / `to` for an arrow |
| `gesture`, `gestureKind`, `gestureCount` | How it was referenced: `pointed at` (hover), `clicked`, `tapped`, `marked` (pin), `circled`, `underlined`, `struck through`, `crossed out`, `scribbled over`, `drew an arrow` |
| `tag`, `id`, `classes` | The element itself |
| `selector` | A short CSS selector that matched only this element when it was recorded |
| `text` | Visible text, trimmed to 100 characters; empty for form fields and private elements |
| `name` | Accessible name (`aria-label`, `alt`, placeholder or label) when different from the text |
| `ariaRole` | Explicit or implicit role (`button`, `link`, `heading 1`, …) |
| `attrs` | A few useful attributes: `href`, `src`, `type`, `name`, `alt`, `aria-label`, `data-testid`, … (never `value`) |
| `rect` | Position and size in page pixels |
| `styles` | The computed styles that matter for feedback: font size and weight, colours, padding, margin, radius, display, alignment, gap |
| `component` | When the dev build exposes it: `framework`, `name`, `chain` (owners, outermost first), `file`, `line` |
| `shadowHost` | Selector of the shadow host, when the element is inside a shadow root |
| `private` | `true` when its text was left out (`data-pointbrief-private` or a password field) |

## Compatibility

Fields may be added within `brief@1`; tools should ignore fields they don't know. A change that removes or redefines a field gets a new schema version.
