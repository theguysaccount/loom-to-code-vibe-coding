// Tell IndexNow search engines (Bing, Yandex, Seznam, Naver and others) which URLs changed.
//   node scripts/indexnow.mjs dist/urls.txt
// The key file (<key>.txt) is published at the site root by the build. A failed submission is
// reported but exits 0: the site is already live, and the next deploy tries again.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
const base = (process.env.SITE_URL || pkg.homepage).replace(/\/$/, "");
const host = new URL(base).hostname;
const key = fs.readFileSync(path.join(ROOT, "site", "indexnow-key.txt"), "utf8").trim();
const list = fs.readFileSync(process.argv[2] || path.join(ROOT, "dist", "urls.txt"), "utf8").split(/\s+/).filter((u) => u && new URL(u).hostname === host).slice(0, 10000);
const body = JSON.stringify({ host, key, keyLocation: `${base}/${key}.txt`, urlList: list });

for (let attempt = 0; attempt < 4; attempt++) {
  if (attempt) await new Promise((r) => setTimeout(r, 30000 * attempt));
  try {
    const r = await fetch("https://api.indexnow.org/indexnow", { method: "POST", headers: { "Content-Type": "application/json; charset=utf-8" }, body });
    console.log(`IndexNow: ${r.status} for ${list.length} URLs`);
    if (r.ok) process.exit(0);
    // A new key answers 403 until the engine has fetched the key file; 429 and 5xx are worth a retry.
    if (r.status !== 403 && r.status !== 429 && r.status < 500) break;
  } catch (e) {
    console.log(`IndexNow: ${e.message}`);
  }
}
console.log("::warning::IndexNow submission didn't succeed; the next deploy will retry");
