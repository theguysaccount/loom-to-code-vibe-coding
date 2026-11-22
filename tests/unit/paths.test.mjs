import test from "node:test";
import assert from "node:assert/strict";
import { shortPath } from "../../src/elements.js";

test("source paths keep the part an agent can search for", () => {
  assert.equal(shortPath("/Users/someone/app/src/pages/Pricing.jsx"), "src/pages/Pricing.jsx");
  assert.equal(shortPath("http://localhost:5173/src/components/Hero.tsx?t=1732000000"), "src/components/Hero.tsx");
  assert.equal(shortPath("src/routes/+page.svelte"), "src/routes/+page.svelte");
  assert.equal(shortPath("/home/dev/repo/packages/web/src/ui/Button.tsx"), "src/ui/Button.tsx");
  assert.equal(shortPath("/Users/x/proj/app/dashboard/page.tsx"), "app/dashboard/page.tsx");
  assert.equal(shortPath("/Users/x/app/components/Nav.tsx"), "components/Nav.tsx");
  assert.equal(shortPath("webpack-internal:///./src/App.js"), "src/App.js");
  assert.equal(shortPath("C:\\work\\shop\\src\\App.vue"), "src/App.vue");
  assert.equal(shortPath("/opt/x/node_modules/some-lib/dist/index.js"), "node_modules/some-lib/dist/index.js");
  assert.equal(shortPath("NavBar.tsx"), "NavBar.tsx");
  assert.equal(shortPath("/a/b/c/d/e.js"), "c/d/e.js");
  assert.equal(shortPath(""), "");
});
