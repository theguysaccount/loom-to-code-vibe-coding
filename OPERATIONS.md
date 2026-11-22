# Operations

Pointbrief runs itself on GitHub: Pages hosts the site and the toolbar script, Actions runs every
recurring job. Nothing needs a person for it to keep working.

**Live:** https://code.screenrecordit.com/ (custom domain since 2026-11-22; the old address
https://theguysaccount.github.io/loom-to-code-vibe-coding/ redirects to it)
**Repo:** https://github.com/theguysaccount/loom-to-code-vibe-coding
**Install (Claude Code):** `/plugin marketplace add theguysaccount/loom-to-code-vibe-coding`, then `/plugin install pointbrief@pointbrief`

## Automated jobs

| Job | Workflow | When | What it does | How it fails safe |
|---|---|---|---|---|
| Deploy | `pages.yml` | every push to `main`; by hand | Unit tests (stroke recognition, brief builder, source paths, plugin server and bridge security), checks the committed toolbar bundle matches the source, validates the plugin and marketplace manifests, builds, drives the built site in headless Chrome (sample recording through the real capture code at desktop and phone widths, element-mapping fixtures, a real toolbar → bridge → inbox hand-off, every page at two widths), deploys, waits for the CDN to serve the new commit, runs the browser tests on the live site, pings IndexNow | Any failure before `deploy` leaves the last good site live. IndexNow problems are warnings. |
| Self-test | `selftest.yml` | Mondays 07:41 and Thursdays 19:17 UTC (two slots because GitHub skips some scheduled runs); by hand | All tests and manifest checks; Claude Code's own `claude plugin validate --strict` (installed from npm; a failed install is a warning); live health (every sitemap URL is 200 with its own canonical, `pointbrief.js` matches `version.json`, robots.txt has the sitemap); **staleness**: if the live build isn't the current `main` commit after an hour, it dispatches `pages.yml` and fails; warns if the last successful scheduled self-test is over 10 days old; browser tests on the live site; component lookup against real React 19, the newest React and Vue development builds from esm.sh (React 19 must pass; a newer major only warns; esm.sh being down only warns) | Read-only apart from the redeploy dispatch. A failure opens or comments on one `ops-alert` issue, and GitHub emails the repo owner. |
| Keep-alive | `selftest.yml` → `scripts/keepalive.sh` | every self-test run, even when the tests fail | Re-enables each scheduled workflow (skips any disabled by hand); pushes an empty `[skip ci]` commit when the last commit is 45+ days old | GitHub disables scheduled workflows after 60 days without activity; this resets the clock. |
| CI | `ci.yml` | pull requests and pushes to other branches | The same tests as the deploy, without deploying | Nothing is deployed from branches. |

Every job is safe to re-run: nothing is appended or counted, and a deploy of the same commit is identical.

**Schedule trigger verified:** the first schedule-triggered self-test passed on 2026-11-22
([run 45047476537](https://github.com/theguysaccount/loom-to-code-vibe-coding/actions/runs/45047476537)), from a temporary cron limited to
22 to 24 November that was then removed. New or edited crons on this account have taken about 8 hours to
fire for the first time, so don't read a quiet first day as a broken schedule.

## What to watch

- **Open `ops-alert` issues.** The issue links the failing run; the step name says what broke.
- **"real framework check" warnings** in self-test runs: a new React or Vue release changed the internals
  Pointbrief reads to find components (`src/elements.js`, `reactInfo` / `vueInfo`). Briefs still work
  without component names, but fix it before it becomes the version most people use. The React 19 check
  failing (not warning) means it already broke for the current version.
- **Issues from users**, especially "brief targets the wrong element" reports: attach the `.json` brief.

## Run anything by hand

```bash
node --test tests/unit/*.test.mjs
node scripts/build.mjs && node tests/e2e/run.mjs
node tests/e2e/run.mjs https://code.screenrecordit.com --frameworks
node scripts/check-live.mjs https://code.screenrecordit.com
~/.local/bin/gh workflow run pages.yml -R theguysaccount/loom-to-code-vibe-coding
~/.local/bin/gh workflow run selftest.yml -R theguysaccount/loom-to-code-vibe-coding
```

## Releasing a new version

1. Change the code, bump `version` in `package.json`, `plugin/.claude-plugin/plugin.json` and
   `plugin/.cursor-plugin/plugin.json` (CI checks they agree), run `node scripts/build.mjs`, commit.
2. Tag and release: `git tag v0.2.0 && git push origin v0.2.0 && gh release create v0.2.0 --generate-notes`.
   The pinned jsDelivr URL (`…@v0.2.0/plugin/toolbar/pointbrief.js`) works as soon as the tag exists.
3. Claude Code users get the new plugin version with `/plugin marketplace update pointbrief` (the
   version in plugin.json is what moves them).

## Keys Jack can turn later

Nothing below is needed for Pointbrief to work.

### 1. Custom domain: done, code.screenrecordit.com

**Turned on 2026-11-22 by the "domain rollout" session** (recorded in `~/code/DOMAIN_ROLLOUT.md`):
screenrecordit.com already serves a different tool (ScreenRecordIt, on Vercel), so the site took the
`code` subdomain: Namecheap `CNAME code → theguysaccount.github.io.`, Pages custom domain
`code.screenrecordit.com` with HTTPS enforced, and `SITE_URL=https://code.screenrecordit.com`. The deploy
and the scheduled self-test have passed on it. This repo changes no DNS.

The site's base URL is **one setting**: the repository variable `SITE_URL`. To move the site to another
domain later (the steps below use the apex as the example):

1. DNS for `screenrecordit.com` (Namecheap → Advanced DNS): `A @` → `185.199.108.153`, `185.199.109.153`,
   `185.199.110.153`, `185.199.111.153`; `AAAA @` → `2606:50c0:8000::153`, `2606:50c0:8001::153`,
   `2606:50c0:8002::153`, `2606:50c0:8003::153`; `CNAME www` → `theguysaccount.github.io`.
   Check first that nothing else is live on the domain, and never replace a record that serves something.
2. Set the Pages custom domain: `gh api -X PUT repos/theguysaccount/loom-to-code-vibe-coding/pages -f cname=screenrecordit.com`
   (or Settings → Pages → Custom domain). When the certificate is issued, tick **Enforce HTTPS**
   (`gh api -X PUT repos/theguysaccount/loom-to-code-vibe-coding/pages -F https_enforced=true`).
3. `gh variable set SITE_URL -R theguysaccount/loom-to-code-vibe-coding -b https://screenrecordit.com`
4. `gh workflow run pages.yml -R theguysaccount/loom-to-code-vibe-coding`. Canonicals, sitemap, share
   cards, the bookmarklet, IndexNow and the self-tests all follow `SITE_URL`.

The github.io address then redirects to the domain, so old links, the toolbar's docs link and
installed bookmarklets keep working. The pinned jsDelivr URL is unaffected.

### 2. Money: GitHub Sponsors (and later a hosted team tier)

Pages is non-commercial, so the site sells nothing. The slot is a **Sponsor Pointbrief** link in the
footer of every page, hidden until a URL is set.

- Turn on GitHub Sponsors for the account (needs the owner's bank and tax details), then
  `gh variable set SPONSOR_URL -R theguysaccount/loom-to-code-vibe-coding -b https://github.com/sponsors/<account>`
  and run the deploy. Optionally add a `.github/FUNDING.yml` with the same account.
- A hosted team tier (shared brief inbox, history, integrations with issue trackers) needs a server,
  Stripe and hosting other than Pages: a separate project.

### 3. Analytics (the activation metric)

Off by default. The activation event is **a brief produced on the demo** (`event/brief`), with
`event/copy-brief` and `event/copy-snippet` as hand-off signals. Create a free GoatCounter site, then
`gh variable set GOATCOUNTER_URL -R theguysaccount/loom-to-code-vibe-coding -b https://<code>.goatcounter.com/count`
and redeploy. The toolbar itself never sends analytics. Until then, the signals are GitHub stars, clones
(repo Insights → Traffic) and jsDelivr's stats for the pinned script
(`https://data.jsdelivr.com/v1/stats/packages/gh/theguysaccount/loom-to-code-vibe-coding`).

### 4. Directory and marketplace listings (each needs an account)

- **Anthropic's plugin directory:** submit at https://claude.ai/directory/manage (needs a paid claude.ai
  plan). `claude plugin validate --profile directory --strict ./plugin` passes, icon included.
- **Cursor Marketplace:** apply at https://cursor.com/marketplace/publish (Cursor sign-in, manual review,
  MIT is accepted). The repo already has `.cursor-plugin/` manifests.
- **npm** (`npx pointbrief` or an npm-hosted script): needs an npm account. The name `pointbrief` was
  free on 2026-11-22.
- **Google Search Console:** verify the site (needs a Google account; easiest after the custom domain)
  and submit `/sitemap.xml`. Bing and other IndexNow engines are pinged on every deploy.

### 5. Optional Claude routine

No recurring AI content is needed. A quarterly Claude routine could keep the comparison guide honest:
"Read site/content/guide-show-agent.md, check each product it mentions still works as described,
update the text and the `updated:` date, run the tests, commit." The weekly self-test already catches
framework changes that break component lookup.

## Safety and privacy rules the code keeps

- The toolbar records events, never pixels or audio; form values and `data-pointbrief-private` text are
  never read (tests check both).
- The bridge listens on 127.0.0.1 only and accepts briefs only from local page origins, with a required
  custom header that forces a CORS preflight; 2 MB cap; ids are sanitised (tests check all of it).
- Briefs tell the agent that quoted page text is data, not instructions; `/pointbrief:apply` repeats it
  and never commits without the user's approval.
