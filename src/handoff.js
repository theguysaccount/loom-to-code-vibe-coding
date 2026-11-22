// Getting the brief out of the page: clipboard, file download, or the local agent bridge that the
// Pointbrief plugin runs (http://127.0.0.1:47823 by default). Nothing here talks to any other host.

export const DEFAULT_BRIDGE = "http://127.0.0.1:47823";

function withTimeout(ms) {
  if (typeof AbortSignal !== "undefined" && AbortSignal.timeout) return AbortSignal.timeout(ms);
  const c = new AbortController();
  setTimeout(() => c.abort(), ms);
  return c.signal;
}

export function isLocalPage(loc = location) {
  const h = loc.hostname;
  return loc.protocol === "file:" || h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h === "::1" ||
    h.endsWith(".localhost") || h.endsWith(".test") || /^192\.168\.|^10\.|^172\.(1[6-9]|2\d|3[01])\./.test(h);
}

export async function copyText(text, root) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fall back below */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0";
    (root || document.body).appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

export function downloadFile(name, text, type, root) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.style.display = "none";
  (root || document.body).appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** { ok, name, version, inbox } when the bridge answers; null when it doesn't. */
export async function bridgeHealth(base) {
  if (!base || base === "off") return null;
  try {
    const r = await fetch(`${base.replace(/\/$/, "")}/v1/health`, { headers: { "X-Pointbrief": "1" }, signal: withTimeout(1500) });
    if (!r.ok) return null;
    const j = await r.json();
    return j && j.name === "pointbrief" ? j : null;
  } catch {
    return null;
  }
}

export async function sendToBridge(base, brief, markdown) {
  const r = await fetch(`${base.replace(/\/$/, "")}/v1/briefs`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Pointbrief": "1" },
    body: JSON.stringify({ brief, markdown }),
    signal: withTimeout(5000),
  });
  let j = null;
  try {
    j = await r.json();
  } catch { /* not JSON */ }
  if (!r.ok || !j || !j.ok) throw new Error((j && j.error) || `bridge answered ${r.status}`);
  return j;
}
