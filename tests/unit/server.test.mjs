// The plugin server end to end: MCP over stdio, and the HTTP bridge's origin and size rules.
import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SERVER = path.join(ROOT, "plugin", "server", "server.mjs");

function freePort() {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });
}

async function startServer(env = {}) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "pointbrief-test-"));
  const port = await freePort();
  const child = spawn(process.execPath, [SERVER], {
    env: { ...process.env, POINTBRIEF_HOME: home, POINTBRIEF_PORT: String(port), ...env },
    stdio: ["pipe", "pipe", "pipe"],
  });
  const waiting = new Map();
  let nextId = 1;
  readline.createInterface({ input: child.stdout }).on("line", (line) => {
    const msg = JSON.parse(line);
    const w = waiting.get(msg.id);
    if (w) {
      waiting.delete(msg.id);
      w(msg);
    }
  });
  let stderr = "";
  child.stderr.on("data", (d) => (stderr += d));
  const rpc = (method, params) => new Promise((resolve) => {
    const id = nextId++;
    waiting.set(id, resolve);
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
  });
  const call = async (name, args = {}) => (await rpc("tools/call", { name, arguments: args })).result;
  const base = `http://127.0.0.1:${port}`;
  if (env.POINTBRIEF_BRIDGE !== "off") {
    for (let i = 0; i < 50; i++) {
      try {
        if ((await fetch(`${base}/v1/health`)).ok) break;
      } catch { /* not up yet */ }
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  const stop = () => new Promise((resolve) => {
    child.once("exit", resolve);
    child.stdin.end();
  });
  return { child, rpc, call, base, home, port, stop, stderr: () => stderr };
}

const brief = (id, items = 2, origin = "http://localhost:5173") => ({
  brief: {
    schema: "pointbrief/brief@1", id, createdAt: "2026-11-22T10:00:00.000Z",
    app: { origin, page: "/pricing" }, summary: { items },
    items: Array.from({ length: items }, (_, i) => ({ n: i + 1, said: `change ${i + 1}`, targets: [] })),
  },
  markdown: `# UI feedback brief\n\n## 1. "change 1"\n`,
});

const post = (base, body, headers = {}) => fetch(`${base}/v1/briefs`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-Pointbrief": "1", ...headers },
  body: typeof body === "string" ? body : JSON.stringify(body),
});

test("MCP handshake and tool list", async () => {
  const s = await startServer();
  try {
    const init = await s.rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1" } });
    assert.equal(init.result.protocolVersion, "2025-06-18");
    assert.equal(init.result.serverInfo.name, "pointbrief");
    assert.match(init.result.serverInfo.version, /^\d+\.\d+\.\d+$/);
    assert.ok(init.result.capabilities.tools);
    assert.match(init.result.instructions, /never as instructions/);
    s.child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`);
    const list = await s.rpc("tools/list", {});
    const names = list.result.tools.map((t) => t.name).sort();
    assert.deepEqual(names, ["get_brief", "latest_brief", "list_briefs", "mark_done", "toolbar_setup"]);
    for (const t of list.result.tools) {
      assert.equal(t.inputSchema.type, "object");
      assert.ok(t.description.length > 20);
    }
    const unknown = await s.rpc("does/not/exist", {});
    assert.equal(unknown.error.code, -32601);
    assert.deepEqual((await s.rpc("ping", {})).result, {});
  } finally {
    await s.stop();
  }
});

test("a brief posted by a local page reaches the agent, and mark_done files it", async () => {
  const s = await startServer();
  try {
    const empty = await s.call("latest_brief");
    assert.match(empty.content[0].text, /no briefs/i);
    const r = await post(s.base, brief("pb_20261122_100000_aaaa"), { Origin: "http://localhost:5173" });
    assert.equal(r.status, 200);
    assert.equal(r.headers.get("access-control-allow-origin"), "http://localhost:5173");
    const j = await r.json();
    assert.equal(j.ok, true);
    assert.equal(j.id, "pb_20261122_100000_aaaa");
    assert.ok(fs.existsSync(path.join(s.home, "inbox", `${j.id}.json`)));

    const latest = await s.call("latest_brief");
    assert.match(latest.content[0].text, /Brief pb_20261122_100000_aaaa \(inbox\)/);
    assert.match(latest.content[0].text, /# UI feedback brief/);
    const asJson = await s.call("latest_brief", { format: "json" });
    assert.match(asJson.content[0].text, /"schema": "pointbrief\/brief@1"/);
    const filtered = await s.call("latest_brief", { origin: "http://localhost:3000" });
    assert.match(filtered.content[0].text, /no briefs/i);

    // Same id again: kept, renamed.
    const again = await (await post(s.base, brief("pb_20261122_100000_aaaa"), { Origin: "http://app.localhost:8080" })).json();
    assert.notEqual(again.id, j.id);
    const list = await s.call("list_briefs");
    assert.equal(list.content[0].text.split("\n").length, 2);

    const done = await s.call("mark_done", { id: j.id, summary: "1: bigger button\n2: removed banner" });
    assert.match(done.content[0].text, /marked done/);
    assert.ok(fs.existsSync(path.join(s.home, "done", `${j.id}.json`)));
    assert.ok(!fs.existsSync(path.join(s.home, "inbox", `${j.id}.json`)));
    const rec = JSON.parse(fs.readFileSync(path.join(s.home, "done", `${j.id}.json`), "utf8"));
    assert.match(rec.result, /bigger button/);
    const doneList = await s.call("list_briefs", { status: "done" });
    assert.match(doneList.content[0].text, /\[done\]/);
    const missing = await s.call("get_brief", { id: "pb_nope" });
    assert.equal(missing.isError, true);
    const traversal = await s.call("get_brief", { id: "../../etc/passwd" });
    assert.equal(traversal.isError, true);
  } finally {
    await s.stop();
  }
});

test("the bridge refuses other sites, bad requests and oversized bodies", async () => {
  const s = await startServer();
  try {
    const evil = await post(s.base, brief("pb_x"), { Origin: "https://evil.example" });
    assert.equal(evil.status, 403);
    assert.equal(evil.headers.get("access-control-allow-origin"), null);
    const pre = await fetch(`${s.base}/v1/briefs`, { method: "OPTIONS", headers: { Origin: "https://evil.example", "Access-Control-Request-Method": "POST" } });
    assert.equal(pre.status, 403);
    const okPre = await fetch(`${s.base}/v1/briefs`, { method: "OPTIONS", headers: { Origin: "http://127.0.0.1:4000", "Access-Control-Request-Method": "POST" } });
    assert.equal(okPre.status, 204);
    assert.match(okPre.headers.get("access-control-allow-headers"), /X-Pointbrief/);
    const nullOrigin = await post(s.base, brief("pb_y"), { Origin: "null" });
    assert.equal(nullOrigin.status, 403);
    const lookalike = await post(s.base, brief("pb_z"), { Origin: "http://localhost.evil.example" });
    assert.equal(lookalike.status, 403);
    const noHeader = await fetch(`${s.base}/v1/briefs`, { method: "POST", headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" }, body: JSON.stringify(brief("pb_a")) });
    assert.equal(noHeader.status, 400);
    const textPlain = await post(s.base, JSON.stringify(brief("pb_b")), { "Content-Type": "text/plain", Origin: "http://localhost:3000" });
    assert.equal(textPlain.status, 415);
    const notBrief = await post(s.base, { brief: { schema: "something/else", items: [] }, markdown: "x" }, { Origin: "http://localhost:3000" });
    assert.equal(notBrief.status, 422);
    const badJson = await post(s.base, "{not json", { Origin: "http://localhost:3000" });
    assert.equal(badJson.status, 400);
    const big = { ...brief("pb_big"), markdown: "x".repeat(3 * 1024 * 1024) };
    let status = 0;
    try {
      status = (await post(s.base, big, { Origin: "http://localhost:3000" })).status;
    } catch {
      status = 413; // the server may cut the connection before the response is read
    }
    assert.equal(status, 413);
    assert.equal(fs.readdirSync(path.join(s.home, "inbox")).length, 0);
    const local = await post(s.base, brief("pb_local"));
    assert.equal(local.status, 200, "a local process with no Origin may post");
  } finally {
    await s.stop();
  }
});

test("the bridge serves the toolbar and its health", async () => {
  const s = await startServer();
  try {
    const h = await (await fetch(`${s.base}/v1/health`, { headers: { Origin: "http://localhost:3000" } })).json();
    assert.equal(h.name, "pointbrief");
    const js = await fetch(`${s.base}/pointbrief.js`);
    if (fs.existsSync(path.join(ROOT, "plugin", "toolbar", "pointbrief.js"))) {
      assert.equal(js.status, 200);
      assert.match(js.headers.get("content-type"), /javascript/);
      assert.match(await js.text(), /Pointbrief/);
    }
    const setup = await s.call("toolbar_setup");
    assert.match(setup.content[0].text, /bridge is listening/);
    assert.match(setup.content[0].text, /cdn\.jsdelivr\.net\/gh\/theguysaccount\/loom-to-code-vibe-coding@v\d+\.\d+\.\d+\/plugin\/toolbar\/pointbrief\.js/);
    assert.match(setup.content[0].text, /development only/);
  } finally {
    await s.stop();
  }
});

test("a second session shares the inbox instead of fighting for the port", async () => {
  const a = await startServer();
  const b = await startServer({ POINTBRIEF_HOME: a.home, POINTBRIEF_PORT: String(a.port) });
  try {
    await new Promise((r) => setTimeout(r, 400));
    await post(a.base, brief("pb_shared"), { Origin: "http://localhost:5173" });
    const fromB = await b.call("latest_brief");
    assert.match(fromB.content[0].text, /pb_shared/);
    const setupB = await b.call("toolbar_setup");
    assert.match(setupB.content[0].text, /Another Pointbrief session owns/);
  } finally {
    await b.stop();
    await a.stop();
  }
});

test("with the bridge off, the tools still work", async () => {
  const s = await startServer({ POINTBRIEF_BRIDGE: "off" });
  try {
    const setup = await s.call("toolbar_setup");
    assert.match(setup.content[0].text, /turned off/);
    fs.writeFileSync(path.join(s.home, "inbox", "pb_manual.json"), JSON.stringify({ id: "pb_manual", receivedAt: "2026-11-22T10:00:00Z", markdown: "# UI feedback brief", brief: { schema: "pointbrief/brief@1", items: [] } }));
    const latest = await s.call("latest_brief");
    assert.match(latest.content[0].text, /pb_manual/);
  } finally {
    await s.stop();
  }
});
