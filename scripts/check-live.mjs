// Health of the live site, for the weekly self-test.
//   node scripts/check-live.mjs https://theguysaccount.github.io/loom-to-code-vibe-coding
// Checks: version.json answers and names this package; every sitemap URL answers 200 with its own
// canonical; the toolbar script is served and has the right version; the live build is the
// current main commit (if not, the last deploy failed or never ran: it dispatches a deploy when
// GH_TOKEN is set, and fails); and the self-test itself has been running (warns when the last
// successful scheduled run is over 10 days old).
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
const base = (process.argv[2] || process.env.SITE_URL || pkg.homepage).replace(/\/$/, "");
const UA = `PointbriefHealthCheck/1.0 (+${pkg.repository.url.replace(/^git\+|\.git$/g, "")})`;
const problems = [];
const get = async (url) => {
  const r = await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow" });
  return { status: r.status, text: await r.text(), url: r.url };
};

const version = JSON.parse((await get(`${base}/version.json`)).text);
if (version.name !== "pointbrief") problems.push("version.json doesn't name pointbrief");

const sitemap = (await get(`${base}/sitemap.xml`)).text;
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
if (urls.length < 5) problems.push(`sitemap lists only ${urls.length} URLs`);
for (const u of urls) {
  try {
    const r = await get(u);
    const canon = r.text.match(/<link rel="canonical" href="([^"]+)"/);
    if (r.status !== 200 || !canon || canon[1] !== u) problems.push(`${u}: status ${r.status}, canonical ${canon ? canon[1] : "missing"}`);
  } catch (e) {
    problems.push(`${u}: ${e.message}`);
  }
}

const js = await get(`${base}/pointbrief.js`);
if (js.status !== 200 || !js.text.startsWith(`/*! Pointbrief v${version.version}`)) problems.push("pointbrief.js is missing or doesn't match version.json");
const robots = (await get(`${base}/robots.txt`)).text;
if (!/Sitemap: /.test(robots)) problems.push("robots.txt has no Sitemap line");

// Is the live build the current main commit?
let head = "";
try {
  head = execSync("git rev-parse HEAD", { cwd: ROOT }).toString().trim();
} catch { /* not a checkout */ }
if (head && version.commit && version.commit !== head) {
  const committedAt = Number(execSync("git log -1 --format=%ct", { cwd: ROOT }).toString().trim()) * 1000;
  const age = (Date.now() - committedAt) / 3600000;
  if (age > 1) {
    problems.push(`the live site is ${version.commit.slice(0, 7)}, main is ${head.slice(0, 7)} (committed ${age.toFixed(1)} h ago): the last deploy failed or never ran`);
    if (process.env.GH_TOKEN && process.env.GITHUB_REPOSITORY) {
      try {
        execSync(`gh workflow run pages.yml -R ${process.env.GITHUB_REPOSITORY}`, { stdio: "inherit" });
        console.log("dispatched pages.yml to redeploy main");
      } catch {
        console.log("::warning::couldn't dispatch pages.yml");
      }
    }
  } else console.log(`live build ${version.commit.slice(0, 7)} differs from main ${head.slice(0, 7)}, but main is under an hour old: a deploy is probably running`);
}

// Have the scheduled runs been happening?
if (process.env.GH_TOKEN && process.env.GITHUB_REPOSITORY) {
  try {
    const runs = JSON.parse(execSync(`gh api "repos/${process.env.GITHUB_REPOSITORY}/actions/workflows/selftest.yml/runs?status=success&event=schedule&per_page=1"`).toString());
    const last = runs.workflow_runs && runs.workflow_runs[0];
    if (last) {
      const days = (Date.now() - Date.parse(last.created_at)) / 86400000;
      console.log(`last successful scheduled self-test: ${last.created_at} (${days.toFixed(1)} days ago)`);
      if (days > 10) console.log(`::warning::the last successful scheduled self-test was ${days.toFixed(0)} days ago: GitHub may be skipping scheduled runs`);
    }
  } catch { /* the API is optional here */ }
}

console.log(`checked ${urls.length} pages, live ${version.version} @ ${String(version.commit).slice(0, 7)} built ${version.builtAt}`);
for (const p of problems) console.log(`::error::${p}`);
process.exit(problems.length ? 1 : 0);
