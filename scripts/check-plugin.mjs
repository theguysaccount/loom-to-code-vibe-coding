// Validates the plugin and marketplace manifests for Claude Code and Cursor, the skills, the MCP
// configs and version agreement, then starts the MCP server and lists its tools.
//   node scripts/check-plugin.mjs
// Exits 1 on any problem. (CI also runs `claude plugin validate --strict` when the CLI installs.)
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import os from "node:os";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PLUGIN = path.join(ROOT, "plugin");
const problems = [];
const ok = [];
const need = (cond, msg) => (cond ? ok.push(msg) : problems.push(msg));
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SEMVER = /^\d+\.\d+\.\d+(-[\w.]+)?$/;

const pkg = read("package.json");
const claude = read("plugin/.claude-plugin/plugin.json");
const cursor = read("plugin/.cursor-plugin/plugin.json");
const market = read(".claude-plugin/marketplace.json");
const cmarket = read(".cursor-plugin/marketplace.json");

// Claude Code plugin manifest.
const CLAUDE_FIELDS = new Set(["$schema", "name", "displayName", "version", "description", "author", "homepage", "repository", "license", "keywords",
  "metadata", "defaultEnabled", "dependencies", "settings", "icon", "documentationUrl", "supportUrl", "privacyPolicyUrl", "termsOfServiceUrl",
  "skills", "commands", "agents", "hooks", "mcpServers", "lspServers", "outputStyles", "workflows", "experimental", "userConfig", "channels", "types"]);
need(KEBAB.test(claude.name), `plugin name "${claude.name}" is kebab-case`);
need(!/^(claude|anthropic|anthropics|cc-plugin)-/.test(claude.name) && !["claude", "anthropic", "claude-code"].includes(claude.name), "plugin name avoids reserved prefixes");
need(SEMVER.test(claude.version), `plugin version ${claude.version} is semver`);
need(claude.description && claude.description.length >= 20, "plugin has a description");
need(claude.author && claude.author.name, "plugin has an author name");
need(Object.keys(claude).every((k) => CLAUDE_FIELDS.has(k)), `plugin.json has only known fields (${Object.keys(claude).filter((k) => !CLAUDE_FIELDS.has(k)).join(", ") || "ok"})`);
try {
  new URL(claude.homepage);
  ok.push("homepage is a URL");
} catch {
  problems.push("homepage must be a URL");
}
need(!fs.existsSync(path.join(PLUGIN, "CLAUDE.md")), "no CLAUDE.md at the plugin root");

// Versions agree everywhere.
const bundleHead = fs.readFileSync(path.join(PLUGIN, "toolbar", "pointbrief.js"), "utf8").slice(0, 200);
need(claude.version === pkg.version && cursor.version === pkg.version, `plugin versions match package.json (${pkg.version})`);
need(bundleHead.includes(`Pointbrief v${pkg.version}`), "toolbar bundle banner matches the version");
for (const entry of market.plugins) if (entry.version) need(entry.version === pkg.version, "marketplace entry version matches");

// Claude marketplace.
need(KEBAB.test(market.name) && !["claude-plugins-official", "claude-code-plugins", "claude-community", "github", "npm"].includes(market.name), `marketplace name "${market.name}" is allowed`);
need(market.owner && market.owner.name, "marketplace has an owner name");
need(market.description, "marketplace has a description");
need(Array.isArray(market.plugins) && market.plugins.length === 1, "marketplace lists the plugin");
const entry = market.plugins[0] || {};
need(entry.name === claude.name, "marketplace entry name matches plugin.json");
need(entry.source === "./plugin" && fs.existsSync(path.join(ROOT, entry.source, ".claude-plugin", "plugin.json")), "marketplace source ./plugin has a manifest");

// Cursor manifests.
need(cursor.name === claude.name && KEBAB.test(cursor.name), "Cursor plugin name matches");
need(cmarket.name && cmarket.owner && cmarket.owner.name && Array.isArray(cmarket.plugins), "Cursor marketplace has name, owner and plugins");
need(cmarket.plugins[0] && cmarket.plugins[0].name === cursor.name && fs.existsSync(path.join(ROOT, cmarket.plugins[0].source, ".cursor-plugin", "plugin.json")), "Cursor marketplace source has a manifest");

// MCP configs: the command runs a file inside the plugin.
for (const [file, varName] of [[".mcp.json", "CLAUDE_PLUGIN_ROOT"], ["mcp.json", "CURSOR_PLUGIN_ROOT"]]) {
  const cfg = JSON.parse(fs.readFileSync(path.join(PLUGIN, file), "utf8"));
  const servers = cfg.mcpServers || {};
  need(Object.keys(servers).length === 1 && servers.pointbrief, `${file} declares the pointbrief server`);
  const s = servers.pointbrief || {};
  const script = (s.args || [])[0] || "";
  need(s.command === "node" && script.startsWith(`\${${varName}}/`), `${file} runs node with \${${varName}}`);
  need(fs.existsSync(path.join(PLUGIN, script.replace(`\${${varName}}/`, ""))), `${file} points at an existing script`);
}

// Skills: frontmatter that both Claude Code and Cursor accept.
for (const name of fs.readdirSync(path.join(PLUGIN, "skills"))) {
  const file = path.join(PLUGIN, "skills", name, "SKILL.md");
  const text = fs.readFileSync(file, "utf8");
  const fm = text.match(/^---\n([\s\S]*?)\n---\n/);
  need(!!fm, `skill ${name} has frontmatter`);
  if (!fm) continue;
  const data = Object.fromEntries(fm[1].split("\n").map((l) => l.match(/^([\w-]+):\s*(.*)$/)).filter(Boolean).map((m) => [m[1], m[2]]));
  need(data.name === name && KEBAB.test(name) && name.length <= 64, `skill ${name}: name matches its folder`);
  need(data.description && data.description.length >= 40 && data.description.length <= 1024, `skill ${name}: description length ok`);
  need(text.split("\n").length < 500, `skill ${name}: under 500 lines`);
}
for (const name of fs.readdirSync(path.join(PLUGIN, "rules"))) {
  const text = fs.readFileSync(path.join(PLUGIN, "rules", name), "utf8");
  need(/^---\ndescription: .+\n(globs: .*\n)?alwaysApply: (true|false)\n---\n/.test(text), `rule ${name}: Cursor frontmatter`);
}

// Nothing in the plugin reaches outside it (only ./plugin is copied on install).
for (const file of ["server/server.mjs"]) {
  const src = fs.readFileSync(path.join(PLUGIN, file), "utf8");
  const outside = [...src.matchAll(/from\s+["'](\.\.?\/[^"']+)["']/g)].map((m) => path.resolve(path.dirname(path.join(PLUGIN, file)), m[1])).filter((p) => !p.startsWith(PLUGIN));
  need(!outside.length, `${file} imports nothing outside plugin/`);
}
need(fs.existsSync(path.join(PLUGIN, "README.md")) && fs.existsSync(path.join(PLUGIN, "LICENSE")), "plugin has README.md and LICENSE");

// Start the server and list its tools.
async function smoke() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "pointbrief-check-"));
  const child = spawn(process.execPath, [path.join(PLUGIN, "server", "server.mjs")], {
    env: { ...process.env, POINTBRIEF_HOME: home, POINTBRIEF_BRIDGE: "off" }, stdio: ["pipe", "pipe", "inherit"],
  });
  let buf = "";
  const got = new Promise((resolve) => child.stdout.on("data", (d) => {
    buf += d;
    if (buf.split("\n").filter(Boolean).length >= 2) resolve(buf);
  }));
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "check", version: "1" } } })}\n`);
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} })}\n`);
  const out = await Promise.race([got, new Promise((r) => setTimeout(() => r(""), 5000))]);
  child.stdin.end();
  const [init, list] = out.split("\n").filter(Boolean).map((l) => JSON.parse(l));
  need(init && init.result && init.result.serverInfo.version === pkg.version, "MCP server starts and reports the package version");
  need(list && list.result && list.result.tools.length === 5, "MCP server lists 5 tools");
  fs.rmSync(home, { recursive: true, force: true });
}

await smoke();
for (const m of ok) console.log(`ok   ${m}`);
for (const m of problems) console.log(`FAIL ${m}`);
console.log(problems.length ? `\n${problems.length} problem(s)` : `\nplugin checks passed (${ok.length})`);
process.exit(problems.length ? 1 : 0);
