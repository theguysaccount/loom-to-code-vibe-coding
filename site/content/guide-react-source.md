---
title: Find the React component and source file for a DOM element (React 19 included)
description: React 19 removed fiber._debugSource. How dev tools still map a DOM element to its component name and source file and line in React 19 and React 18, plus Vue 3 and Svelte, with working code.
path: /guides/react-component-source-from-dom-element/
updated: 2026-11-22
og: guide-react
---

# Find the component and source file for a DOM element

Click-to-source tools, inspectors and feedback toolbars all need the same thing: given a DOM element in a development build, which component rendered it, and where is that in the source? Until React 18 this was one property away. React 19 removed it. This is how Pointbrief does it today, in a few dozen lines with no dependencies.

## React 18 and earlier: `_debugSource`

In development, React attaches its internal fiber to each host DOM node under a key that starts with `__reactFiber$` (older versions used `__reactInternalInstance$`). With the JSX dev transform, each fiber has `_debugSource`:

```js
function fiberOf(el) {
  for (const key in el) {
    if (key.startsWith("__reactFiber$") || key.startsWith("__reactInternalInstance$")) return el[key];
  }
  return null;
}

const fiber = fiberOf(element);
fiber._debugSource; // { fileName: "/abs/path/src/pages/Pricing.jsx", lineNumber: 33, columnNumber: 7 }
```

## React 19: `_debugStack`

React 19 dropped `_debugSource` ([facebook/react#28265](https://github.com/facebook/react/pull/28265)). What's left in development builds is:

- `_debugOwner`: the fiber of the component that rendered this element (the owner, not the parent);
- `_debugStack`: an `Error` captured when the JSX element was created;
- `_debugInfo` and `_debugTask`.

The `_debugStack` is the useful one. Its stack trace starts inside React's JSX runtime; the first frame outside React is the line in your component where the JSX was written:

```text
Error: react-stack-top-frame
    at exports.jsxDEV (http://localhost:5173/node_modules/.vite/deps/react_jsx-dev-runtime.js?v=1a2b:250:30)
    at Hero (http://localhost:5173/src/components/Hero.tsx?t=1732000000:12:7)
    at renderWithHooks (…/node_modules/.vite/deps/chunk-ABCDEF12.js:11548:26)
```

So: skip frames from `node_modules`, React's runtime and bundler chunks, and take the URL, line and column of the first one left.

```js
function frameFromStack(stack) {
  const text = typeof stack === "string" ? stack : stack && stack.stack;
  if (typeof text !== "string") return null;
  for (const line of text.split("\n")) {
    if (/node_modules|react-dom|jsx-dev-runtime|jsx-runtime|chunk-[A-Z0-9]{6,}|<anonymous>/.test(line)) continue;
    const m = line.match(/((?:https?|file|webpack-internal):\/\/[^\s)]+?|\/[^\s):]+)(?::(\d+))(?::(\d+))?\)?\s*$/);
    if (m) return { file: m[1], line: Number(m[2]) };
  }
  return null;
}
```

The regular expression accepts Chrome's `at Name (url:line:col)` and Firefox's `Name@url:line:col`.

Two caveats:

- **Line numbers are from the code the browser ran.** Vite serves your modules nearly untransformed in development, so lines usually match your source. With heavier transforms you need source maps to map them back (React DevTools and tools like bippy do this).
- **The URL is not a path on disk.** Strip the origin, the query string (`?t=…`, `?v=…`) and anything machine-specific. Pointbrief keeps the part from `src/`, `app/`, `pages/` or `components/` onwards, which is what an agent can search for.

## The component name: walk the owners

The JSX call site gives you the file; the owner chain gives you names. Walk `_debugOwner` (falling back to `return`) and collect function or class names that start with a capital letter:

```js
function componentName(fiber) {
  let type = fiber && fiber.type;
  if (type && typeof type === "object") type = type.render || type.type || type; // forwardRef, memo
  const name = (fiber.type && fiber.type.displayName) || (type && (type.displayName || type.name)) || "";
  return /^[A-Z]/.test(name) ? name : "";
}

function ownerChain(fiber, max = 4) {
  const chain = [];
  for (let f = fiber, guard = 0; f && guard < 200 && chain.length < max; f = f._debugOwner || f.return, guard++) {
    const name = componentName(f);
    if (name && chain[0] !== name) chain.unshift(name);
  }
  return chain; // ["App", "Landing", "Hero"]
}
```

Minified production builds have no `_debugOwner`, no `_debugStack` and mangled names, which is fine: this is a development tool.

## Vue 3

In development, Vue sets `__vueParentComponent` on elements. The component's options carry `__name` and, with `@vitejs/plugin-vue`, `__file` (a path, without a line number):

```js
let inst = null;
for (let el = element; el && !inst; el = el.parentElement) inst = el.__vueParentComponent;
inst.type.__name; // "PricingCard"
inst.type.__file; // "/home/dev/shop/src/components/PricingCard.vue"
inst.parent;      // walk up for the chain
```

For line numbers, `vite-plugin-vue-inspector` adds a `data-v-inspector="path:line:column"` attribute.

## Svelte 4 and 5

Svelte's dev build puts the location on the element itself:

```js
element.__svelte_meta; // { loc: { file: "src/routes/+page.svelte", line: 14, column: 2 } }
```

## Build-time annotations

Some build plugins write the location into the DOM, which works for any framework and survives React's internal changes:

- Sentry's React component annotation: `data-sentry-component` and `data-sentry-source-file`;
- react-dev-inspector: `data-inspector-relative-path` and `data-inspector-line`;
- code-inspector-plugin: `data-insp-path="file:line:col"`.

Pointbrief checks React, then Vue, then Svelte, then these attributes, and records whatever it finds as `component: { framework, name, chain, file, line }` on each target in the [brief]({{base}}/docs/brief-format/). The full code is in [`src/elements.js`]({{repo}}/blob/main/src/elements.js), and a [self-test page]({{base}}/selftest/elements.html) exercises each case in a real browser every week.
