// Build everything:
//   node scripts/build.mjs          bundle the toolbar into plugin/toolbar/pointbrief.js and build the site into dist/
//   node scripts/build.mjs --check  fail if the committed bundle differs from a fresh build (CI)
// Settings (environment): SITE_URL (the site's base URL; the one setting a custom domain changes),
// SPONSOR_URL and GOATCOUNTER_URL (optional keys, off when unset), GITHUB_SHA (for version.json).
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { bundle } from "./bundle.mjs";
import { render, frontMatter, escapeHtml } from "./md.mjs";
import { buildBrief, briefToMarkdown } from "../src/brief.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
const REPO_URL = pkg.repository.url.replace(/^git\+/, "").replace(/\.git$/, "");
const DEFAULT_SITE = pkg.homepage.replace(/\/$/, "");
const BUNDLE_OUT = path.join(ROOT, "plugin", "toolbar", "pointbrief.js");

export function toolbarBundle() {
  const banner = `/*! Pointbrief v${pkg.version} · MIT · ${REPO_URL} */\n`;
  return bundle(path.join(ROOT, "src", "index.js"), {
    banner,
    root: path.join(ROOT, "src"),
    define: { __VERSION__: pkg.version, __DOCS_URL__: `${DEFAULT_SITE}/docs/` },
  });
}

function writeBundle(check) {
  const js = toolbarBundle();
  if (check) {
    const committed = fs.existsSync(BUNDLE_OUT) ? fs.readFileSync(BUNDLE_OUT, "utf8") : "";
    if (committed !== js) {
      console.error("plugin/toolbar/pointbrief.js is out of date: run `node scripts/build.mjs` and commit it.");
      process.exit(1);
    }
    console.log("bundle up to date");
    return js;
  }
  fs.mkdirSync(path.dirname(BUNDLE_OUT), { recursive: true });
  fs.writeFileSync(BUNDLE_OUT, js);
  console.log(`bundle: ${path.relative(ROOT, BUNDLE_OUT)} (${Math.round(js.length / 1024)} KB)`);
  return js;
}

// ---------------------------------------------------------------- site

export function siteConfig(env = process.env) {
  const siteUrl = (env.SITE_URL || DEFAULT_SITE).replace(/\/$/, "");
  return {
    siteUrl,
    base: new URL(siteUrl).pathname.replace(/\/$/, ""),
    sponsorUrl: env.SPONSOR_URL || "",
    goatcounter: env.GOATCOUNTER_URL || "",
  };
}

const NAV = [["Demo", "/demo/"], ["Docs", "/docs/"], ["Claude Code", "/docs/claude-code/"], ["Cursor", "/docs/cursor/"], ["Brief format", "/docs/brief-format/"]];

function layout(cfg, page) {
  const url = `${cfg.siteUrl}${page.path}`;
  const og = `${cfg.siteUrl}/assets/og/${page.og || "home"}.png`;
  const title = page.path === "/" ? page.title : `${page.title} · Pointbrief`;
  const nav = NAV.map(([label, href]) => `<a href="${cfg.base}${href}"${page.path === href ? ' aria-current="page"' : ""}>${label}</a>`).join("");
  const analytics = cfg.goatcounter ? `<script data-goatcounter="${escapeHtml(cfg.goatcounter)}" async src="https://gc.zgo.at/count.js"></script>` : "";
  const sponsor = cfg.sponsorUrl ? `<a href="${escapeHtml(cfg.sponsorUrl)}" rel="noopener">Sponsor Pointbrief</a>` : "";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(page.description)}">
<link rel="canonical" href="${url}">
${page.noindex ? '<meta name="robots" content="noindex">' : ""}
<meta property="og:type" content="${page.path === "/" ? "website" : "article"}">
<meta property="og:site_name" content="Pointbrief">
<meta property="og:title" content="${escapeHtml(page.title)}">
<meta property="og:description" content="${escapeHtml(page.description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${og}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#14161b">
<link rel="icon" href="${cfg.base}/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="${cfg.base}/assets/site.css">
${page.head || ""}
${(page.jsonld || []).map((j) => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, "\\u003c")}</script>`).join("\n")}
${analytics}
</head>
<body class="${page.bodyClass || ""}">
<a class="skip" href="#main">Skip to content</a>
<header class="site-header"><div class="wrap">
  <a class="logo" href="${cfg.base}/"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3.2c5 0 9 3.3 9 7.6s-4 7.6-9 7.6c-1 0-2-.1-2.9-.4L4.6 20l1-3.6C4 15 3 13 3 10.8 3 6.5 7 3.2 12 3.2Z" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><circle cx="12" cy="10.8" r="2.3" fill="currentColor"/></svg>Pointbrief</a>
  <nav aria-label="Site">${nav}<a href="${REPO_URL}" rel="noopener">GitHub</a></nav>
</div></header>
<main id="main">
${page.body}
</main>
<footer class="site-footer"><div class="wrap">
  <p><strong>Pointbrief</strong> is free and open source (MIT). No account, nothing uploaded.</p>
  <p class="links"><a href="${cfg.base}/docs/">Docs</a><a href="${cfg.base}/docs/privacy/">Privacy</a><a href="${cfg.base}/guides/show-a-coding-agent-what-to-change/">Guides</a><a href="${REPO_URL}" rel="noopener">GitHub</a><a href="${REPO_URL}/issues" rel="noopener">Issues</a>${sponsor}</p>
</div></footer>
${page.scripts || ""}
<script src="${cfg.base}/assets/site.js" defer></script>
</body>
</html>
`;
}

function docPage(cfg, file) {
  const { data, body } = frontMatter(fs.readFileSync(file, "utf8").replaceAll("{{base}}", cfg.base).replaceAll("{{site}}", cfg.siteUrl).replaceAll("{{repo}}", REPO_URL).replaceAll("{{version}}", pkg.version));
  const { html, toc } = render(body);
  const tocHtml = toc.length > 2 ? `<nav class="toc" aria-label="On this page"><p>On this page</p><ul>${toc.map((t) => `<li><a href="#${t.id}">${t.text.replace(/`/g, "")}</a></li>`).join("")}</ul></nav>` : "";
  const crumbs = data.path.split("/").filter(Boolean);
  const jsonld = [{
    "@context": "https://schema.org", "@type": "TechArticle", headline: data.title, description: data.description,
    url: `${cfg.siteUrl}${data.path}`, ...(data.updated ? { dateModified: data.updated } : {}),
    isPartOf: { "@type": "WebSite", name: "Pointbrief", url: `${cfg.siteUrl}/` },
  }, {
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: [{ "@type": "ListItem", position: 1, name: "Pointbrief", item: `${cfg.siteUrl}/` },
      ...crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 2, name: i === crumbs.length - 1 ? data.title : c[0].toUpperCase() + c.slice(1), item: `${cfg.siteUrl}/${crumbs.slice(0, i + 1).join("/")}/` }))],
  }];
  return {
    path: data.path, title: data.title, description: data.description, og: data.og || "docs", jsonld,
    body: `<div class="wrap doc"><article class="prose">${html}</article>${tocHtml}</div>`,
  };
}

function fill(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vars ? vars[k] : m));
}

export function exampleBrief() {
  const session = JSON.parse(fs.readFileSync(path.join(ROOT, "site", "data", "sample-session.json"), "utf8"));
  const brief = buildBrief(session, { version: pkg.version });
  return { brief, markdown: briefToMarkdown(brief, { link: REPO_URL }) };
}

function bookmarklet(cfg) {
  const src = `${cfg.siteUrl}/pointbrief.js`;
  return `javascript:(function(){if(window.Pointbrief){window.Pointbrief.toggle();return}var s=document.createElement('script');s.src='${src}';document.head.appendChild(s)})()`;
}

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const name of fs.readdirSync(from)) {
    const a = path.join(from, name), b = path.join(to, name);
    if (fs.statSync(a).isDirectory()) copyDir(a, b);
    else fs.copyFileSync(a, b);
  }
}

function gitSha() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  try {
    return execSync("git rev-parse HEAD", { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "";
  }
}

export function buildSite(js, { env = process.env, out = path.join(ROOT, "dist") } = {}) {
  const cfg = siteConfig(env);
  fs.rmSync(out, { recursive: true, force: true });
  copyDir(path.join(ROOT, "site", "static"), out);
  fs.writeFileSync(path.join(out, "pointbrief.js"), js);

  const ex = exampleBrief();
  fs.writeFileSync(path.join(out, "example-brief.md"), ex.markdown);
  fs.writeFileSync(path.join(out, "example-brief.json"), `${JSON.stringify(ex.brief, null, 2)}\n`);

  const vars = {
    base: cfg.base, site: cfg.siteUrl, repo: REPO_URL, version: pkg.version,
    example: escapeHtml(ex.markdown), bookmarklet: escapeHtml(bookmarklet(cfg)),
    pinned: escapeHtml(`<script src="https://cdn.jsdelivr.net/gh/theguysaccount/loom-to-code-vibe-coding@v${pkg.version}/plugin/toolbar/pointbrief.js" defer></script>`),
    hosted: escapeHtml(`<script src="${cfg.siteUrl}/pointbrief.js" defer></script>`),
  };
  const pages = [];
  const tpl = (name) => fs.readFileSync(path.join(ROOT, "site", "templates", name), "utf8");
  const faq = JSON.parse(fs.readFileSync(path.join(ROOT, "site", "data", "faq.json"), "utf8"));
  vars.faq = faq.map((q) => `<details><summary>${escapeHtml(q.q)}</summary><p>${fill(q.a, vars)}</p></details>`).join("\n");
  pages.push({
    path: "/", og: "home",
    title: "Pointbrief: point at your app, say what to change, your coding agent applies it",
    description: "A free, open-source dev toolbar and Claude Code plugin. Record your voice, pointer and drawings over your local app and get an element-mapped change list your coding agent can apply.",
    body: fill(tpl("home.html"), vars),
    jsonld: [{
      "@context": "https://schema.org", "@type": "SoftwareApplication", name: "Pointbrief", applicationCategory: "DeveloperApplication",
      operatingSystem: "Any modern web browser", url: `${cfg.siteUrl}/`, softwareVersion: pkg.version, license: "https://opensource.org/licenses/MIT",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      description: "Dev toolbar and Claude Code plugin that turns point-and-talk feedback on a running web app into an element-mapped brief for coding agents.",
    }, {
      "@context": "https://schema.org", "@type": "FAQPage",
      mainEntity: faq.map((q) => ({ "@type": "Question", name: q.q, acceptedAnswer: { "@type": "Answer", text: fill(q.a, vars).replace(/<[^>]+>/g, "") } })),
    }],
  });
  pages.push({
    path: "/demo/", og: "demo", bodyClass: "demo",
    title: "Try Pointbrief on a demo app",
    description: "Press Record, point at things on a small demo app, say or type what to change, circle or cross things out, and get the brief a coding agent would receive. Runs in your browser.",
    body: fill(tpl("demo.html"), vars),
    head: `<link rel="stylesheet" href="${cfg.base}/assets/demo.css">`,
    scripts: `<script src="${cfg.base}/pointbrief.js" data-manual></script>\n<script src="${cfg.base}/assets/demo.js"></script>`,
  });
  const contentDir = path.join(ROOT, "site", "content");
  for (const name of fs.readdirSync(contentDir).filter((n) => n.endsWith(".md")).sort()) pages.push(docPage(cfg, path.join(contentDir, name)));

  for (const page of pages) {
    const dir = path.join(out, page.path);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "index.html"), layout(cfg, page));
  }
  fs.writeFileSync(path.join(out, "404.html"), layout(cfg, {
    path: "/404.html", title: "Page not found", description: "This page doesn't exist.", noindex: true,
    body: `<div class="wrap doc"><article class="prose"><h1>Page not found</h1><p>Try the <a href="${cfg.base}/">home page</a>, the <a href="${cfg.base}/demo/">demo</a> or the <a href="${cfg.base}/docs/">docs</a>.</p></article></div>`,
  }));

  // Self-test fixtures: deployed so the weekly job can run them against the live site, never indexed.
  copyDir(path.join(ROOT, "site", "selftest"), path.join(out, "selftest"));

  const urls = pages.map((p) => `${cfg.siteUrl}${p.path}`);
  fs.writeFileSync(path.join(out, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${u}</loc></url>`).join("\n")}\n</urlset>\n`);
  fs.writeFileSync(path.join(out, "robots.txt"), `User-agent: *\nAllow: /\nDisallow: ${cfg.base}/selftest/\n\nSitemap: ${cfg.siteUrl}/sitemap.xml\n`);
  fs.writeFileSync(path.join(out, "urls.txt"), `${urls.join("\n")}\n`);
  const key = fs.readFileSync(path.join(ROOT, "site", "indexnow-key.txt"), "utf8").trim();
  fs.writeFileSync(path.join(out, `${key}.txt`), key);
  fs.writeFileSync(path.join(out, "version.json"), `${JSON.stringify({ name: "pointbrief", version: pkg.version, commit: gitSha(), builtAt: new Date().toISOString(), siteUrl: cfg.siteUrl }, null, 2)}\n`);
  console.log(`site: ${pages.length} pages -> ${path.relative(ROOT, out)}/ (${cfg.siteUrl})`);
  return { pages, urls, cfg };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes("--check");
  const js = writeBundle(check);
  if (!check) buildSite(js);
}
