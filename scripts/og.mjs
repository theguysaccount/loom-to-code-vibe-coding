// Render the Open Graph cards (1200x630) and the plugin icon (512x512) with headless Chrome.
//   node scripts/og.mjs
// Output is committed: site/static/assets/og/*.png and plugin/.claude-plugin/icon.png.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const OUT = path.join(ROOT, "site", "static", "assets", "og");
const LOGO = `<svg width="64" height="64" viewBox="0 0 24 24" fill="none"><path d="M12 3.2c5 0 9 3.3 9 7.6s-4 7.6-9 7.6c-1 0-2-.1-2.9-.4L4.6 20l1-3.6C4 15 3 13 3 10.8 3 6.5 7 3.2 12 3.2Z" stroke="#ff5a36" stroke-width="2.2" stroke-linejoin="round"/><circle cx="12" cy="10.8" r="2.3" fill="#ff5a36"/></svg>`;
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

const CARDS = {
  home: ["Point at your app.", "Say what to change.", "Your coding agent gets a brief it can apply."],
  demo: ["Try it on a demo app", "Record, point, draw.", "See the brief a coding agent would get."],
  docs: ["Pointbrief docs", "Toolbar, plugin, brief format.", "Claude Code, Cursor or any agent."],
  "guide-show": ["Show a coding agent", "what to change.", "Screenshots vs video vs pickers vs point and talk."],
  "guide-react": ["DOM element to", "component and file.", "React 19, React 18, Vue 3 and Svelte."],
  "guide-template": ["UI feedback template", "for coding agents.", "Copy, paste, get the right edit first time."],
};

function card([a, b, c]) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;width:1200px;height:630px;overflow:hidden}
body{background:#14161b;color:#f4f5f7;font-family:-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;display:flex;flex-direction:column;justify-content:space-between;padding:64px 76px;box-sizing:border-box;position:relative}
.top{display:flex;align-items:center;gap:16px;font-size:34px;font-weight:750}
h1{font-size:76px;line-height:1.04;letter-spacing:-.025em;margin:0}
h1 span{color:#ff5a36}
p{font-size:30px;color:#a3a9b6;margin:0}
.ring{position:absolute;right:70px;top:150px;width:290px;height:170px;border:6px solid #ff5a36;border-radius:50%;transform:rotate(-8deg);opacity:.9}
</style></head><body><div class="ring"></div><div class="top">${LOGO}Pointbrief</div><div><h1>${esc(a)}<br><span>${esc(b)}</span></h1></div><p>${esc(c)}</p></body></html>`;
}

function icon() {
  return `<!doctype html><html><head><style>html,body{margin:0;width:512px;height:512px;overflow:hidden;background:#14161b}
svg{position:absolute;left:96px;top:96px}</style></head><body><svg width="320" height="320" viewBox="0 0 24 24" fill="none"><path d="M12 3.2c5 0 9 3.3 9 7.6s-4 7.6-9 7.6c-1 0-2-.1-2.9-.4L4.6 20l1-3.6C4 15 3 13 3 10.8 3 6.5 7 3.2 12 3.2Z" stroke="#ff5a36" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="10.8" r="2.4" fill="#ff5a36"/></svg></body></html>`;
}

function shoot(html, out, w, h) {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "pointbrief-og-"));
  const page = path.join(work, "card.html");
  fs.writeFileSync(page, html);
  execFileSync(CHROME, ["--headless=new", "--disable-gpu", "--no-first-run", "--hide-scrollbars", `--user-data-dir=${path.join(work, "profile")}`,
    `--window-size=${w},${h}`, "--virtual-time-budget=1500", `--screenshot=${out}`, `file://${page}`], { stdio: "ignore" });
  fs.rmSync(work, { recursive: true, force: true });
  console.log("wrote", path.relative(ROOT, out));
}

fs.mkdirSync(OUT, { recursive: true });
for (const [name, lines] of Object.entries(CARDS)) shoot(card(lines), path.join(OUT, `${name}.png`), 1200, 630);
shoot(icon(), path.join(ROOT, "plugin", ".claude-plugin", "icon.png"), 512, 512);
