// All toolbar CSS. It lives inside a shadow root, so it neither leaks into the app nor inherits from it.
export const CSS_TEXT = `
:host { all: initial; }
*, *::before, *::after { box-sizing: border-box; }
.root {
  --accent: #ff5a36; --accent-ink: #fff; --bg: #14161b; --bg2: #1d2027; --bg3: #272b34; --line: #343946;
  --text: #f4f5f7; --muted: #a3a9b6; --ok: #3ecf8e; --warn: #ffc857;
  position: fixed; inset: 0; pointer-events: none; z-index: 2147483000;
  font: 14px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: var(--text);
  -webkit-font-smoothing: antialiased; text-align: left; letter-spacing: normal;
}
.ink { position: fixed; left: 0; top: 0; width: 100vw; height: 100vh; pointer-events: none; touch-action: none; }
.hl { position: fixed; display: none; border: 2px solid var(--accent); border-radius: 5px; background: rgba(255, 90, 54, .09);
  pointer-events: none; transition: left .07s, top .07s, width .07s, height .07s; }
.hl.on { display: block; }
.hl.mark { border-style: dashed; }
.hl span { position: absolute; left: -2px; bottom: 100%; margin-bottom: 2px; max-width: min(70vw, 420px); overflow: hidden; text-overflow: ellipsis;
  white-space: nowrap; background: var(--accent); color: var(--accent-ink); font: 600 11px/1 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  padding: 4px 6px; border-radius: 4px; }
.hl.low span { bottom: auto; top: 100%; margin: 2px 0 0; }

.pb-cursor { position: fixed; left: 0; top: 0; width: 26px; height: 26px; pointer-events: none; transform: translate(-100px, -100px);
  transition: transform .32s cubic-bezier(.3, .7, .3, 1); filter: drop-shadow(0 2px 3px rgba(0, 0, 0, .45)); }
.pb-cursor svg { width: 26px; height: 26px; fill: #111; stroke: #fff; stroke-width: 1.6; }
.pb-cursor.fast { transition: none; }
.bar { position: fixed; right: 16px; bottom: 16px; pointer-events: auto; display: flex; flex-direction: column; gap: 8px;
  width: max-content; max-width: min(430px, calc(100vw - 24px)); padding: 8px; background: var(--bg); border: 1px solid var(--line);
  border-radius: 16px; box-shadow: 0 12px 34px rgba(0, 0, 0, .38), 0 1px 0 rgba(255, 255, 255, .04) inset; }
.root.left .bar { right: auto; left: 16px; }
.root.hidden .bar, .root.hidden .hl { display: none; }
.root.reviewing .bar, .root.reviewing .card { display: none; }
.row { display: flex; align-items: center; gap: 8px; min-width: 0; }
.brand { display: flex; align-items: center; gap: 7px; padding: 0 6px 0 4px; font-weight: 650; font-size: 13px; color: var(--text); white-space: nowrap; }
.brand svg { color: var(--accent); }
button { font: inherit; color: inherit; background: none; border: 0; padding: 0; margin: 0; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 7px; height: 36px; padding: 0 12px; border-radius: 10px;
  background: var(--bg3); color: var(--text); font-weight: 600; font-size: 13px; white-space: nowrap; border: 1px solid transparent; }
.btn:hover { background: #313642; }
.btn:focus-visible, .seg button:focus-visible, .icon:focus-visible, input:focus-visible, textarea:focus-visible, a:focus-visible {
  outline: 2px solid #8ab4ff; outline-offset: 2px; }
.btn.primary { background: var(--accent); color: var(--accent-ink); }
.btn.primary:hover { background: #ff6d4d; }
.btn.ghost { background: transparent; border-color: var(--line); }
.btn.ghost:hover { background: var(--bg2); }
.btn[disabled] { opacity: .5; cursor: default; }
.btn.small { height: 30px; padding: 0 9px; font-size: 12px; border-radius: 8px; }
.icon { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 9px; color: var(--muted); }
.icon:hover { background: var(--bg3); color: var(--text); }
.dot { width: 10px; height: 10px; border-radius: 50%; background: currentColor; }
.rec .dot { background: #fff; animation: pulse 1.4s ease-in-out infinite; }
@keyframes pulse { 50% { opacity: .35; } }
.time { font: 600 13px/1 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-variant-numeric: tabular-nums; }
.seg { display: inline-flex; padding: 3px; gap: 2px; background: var(--bg2); border-radius: 10px; border: 1px solid var(--line); }
.seg button { display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 10px; border-radius: 7px; color: var(--muted); font-weight: 600; font-size: 12.5px; }
.seg button[aria-pressed="true"] { background: var(--bg3); color: var(--text); box-shadow: 0 0 0 1px var(--line); }
.mic { display: inline-flex; align-items: center; gap: 6px; color: var(--muted); font-size: 12px; min-width: 0; }
.mic.live { color: var(--ok); }
.mic.off { color: var(--warn); }
.caption { min-height: 18px; font-size: 12.5px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; direction: rtl; text-align: left; }
.caption bdi { direction: ltr; unicode-bidi: isolate; }
.note { display: flex; gap: 6px; }
input[type="text"], textarea { font: inherit; color: var(--text); background: var(--bg2); border: 1px solid var(--line); border-radius: 9px;
  padding: 7px 10px; min-width: 0; width: 100%; }
input[type="text"]::placeholder, textarea::placeholder { color: #7d8492; }
input[type="text"] { height: 34px; }
textarea { resize: vertical; min-height: 54px; line-height: 1.4; display: block; }

.card { position: fixed; right: 16px; bottom: 76px; width: min(340px, calc(100vw - 24px)); pointer-events: auto; background: var(--bg);
  border: 1px solid var(--line); border-radius: 14px; padding: 14px; box-shadow: 0 12px 34px rgba(0, 0, 0, .38); }
.root.left .card { right: auto; left: 16px; }
.card h2 { margin: 0 0 6px; font-size: 14px; font-weight: 650; }
.card p { margin: 0 0 10px; color: var(--muted); font-size: 13px; }
.card ol { margin: 0 0 10px; padding-left: 18px; color: var(--muted); font-size: 13px; }
.card li { margin: 0 0 5px; }
.card b, .card strong { color: var(--text); font-weight: 600; }
.card .row { flex-wrap: wrap; }
kbd { font: 600 11px/1 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; background: var(--bg3); border: 1px solid var(--line);
  border-radius: 5px; padding: 2px 5px; color: var(--text); }
a { color: #9cc2ff; }

.panel { position: fixed; top: 0; right: 0; bottom: 0; width: min(440px, 100vw); pointer-events: auto; display: flex; flex-direction: column;
  background: var(--bg); border-left: 1px solid var(--line); box-shadow: -18px 0 40px rgba(0, 0, 0, .3); }
.root.left .panel { right: auto; left: 0; border-left: 0; border-right: 1px solid var(--line); }
.panel header { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 12px 12px 10px 16px; border-bottom: 1px solid var(--line); }
.panel h2 { margin: 0; font-size: 15px; font-weight: 650; }
.panel h2 small { color: var(--muted); font-weight: 500; font-size: 12.5px; margin-left: 6px; }
.items { flex: 1; overflow: auto; padding: 12px; display: flex; flex-direction: column; gap: 10px; overscroll-behavior: contain; }
.item { background: var(--bg2); border: 1px solid var(--line); border-radius: 12px; padding: 10px; display: flex; flex-direction: column; gap: 8px; }
.item.high { border-color: rgba(255, 90, 54, .65); }
.item-head { display: flex; align-items: center; gap: 8px; }
.num { display: inline-flex; align-items: center; justify-content: center; min-width: 22px; height: 22px; padding: 0 6px; border-radius: 7px;
  background: var(--bg3); font: 650 12px/1 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
.tag { font-size: 11px; font-weight: 650; padding: 3px 6px; border-radius: 6px; background: var(--bg3); color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
.tag.high { background: rgba(255, 90, 54, .18); color: #ff9a80; }
.spacer { flex: 1; }
.target { display: flex; align-items: center; gap: 6px; min-width: 0; font-size: 12.5px; color: var(--muted); }
.target code { font: 600 12px/1.3 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; color: #ffd0c4; background: rgba(255, 90, 54, .12);
  padding: 2px 6px; border-radius: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.target .what { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; flex: 1; }
.target .how { white-space: nowrap; }
.src { font: 500 11.5px/1.3 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.none { color: var(--muted); font-size: 12.5px; }
.empty { margin: auto; text-align: center; color: var(--muted); max-width: 300px; padding: 30px 10px; }
.empty b { display: block; color: var(--text); font-size: 15px; margin-bottom: 6px; }
.panel footer { border-top: 1px solid var(--line); padding: 12px; display: flex; flex-direction: column; gap: 8px; }
.panel footer .row { flex-wrap: wrap; }
.panel footer .btn { flex: 1 1 auto; }
.hint { color: var(--muted); font-size: 12px; margin: 0; }
.status { min-height: 18px; font-size: 12.5px; color: var(--ok); margin: 0; }
.status.err { color: var(--warn); }
.toast { position: fixed; left: 50%; bottom: 84px; transform: translateX(-50%); pointer-events: none; background: var(--bg); border: 1px solid var(--line);
  border-radius: 10px; padding: 8px 12px; font-size: 13px; box-shadow: 0 8px 24px rgba(0, 0, 0, .35); opacity: 0; transition: opacity .2s; max-width: calc(100vw - 24px); }
.toast.on { opacity: 1; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
[hidden] { display: none !important; }

@media (max-width: 520px) {
  .bar { left: 8px; right: 8px; bottom: 8px; width: auto; max-width: none; }
  .root.left .bar { left: 8px; }
  .bar.idle { left: auto; width: max-content; }
  .root.left .bar.idle { left: 8px; right: auto; }
  .card { left: 8px; right: 8px; width: auto; bottom: 68px; }
  .panel { width: 100vw; border-left: 0; }
  .btn { height: 40px; }
  .seg button { height: 32px; }
  input[type="text"] { height: 40px; font-size: 16px; }
  textarea { font-size: 16px; }
}
@media (prefers-reduced-motion: reduce) {
  .rec .dot { animation: none; }
  .hl, .toast { transition: none; }
}
`;

const svg = (path, size = 16) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;

export const ICONS = {
  logo: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3.2c5 0 9 3.3 9 7.6s-4 7.6-9 7.6c-1 0-2-.1-2.9-.4L4.6 20l1-3.6C4 15 3 13 3 10.800 3 6.500 7 3.200 12 3.200Z" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><circle cx="12" cy="10.8" r="2.3" fill="currentColor"/></svg>`,
  pen: svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>'),
  hand: svg('<path d="M4 4l7 17 2.500-7.500L21 11Z"/>'),
  mic: svg('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/>'),
  micOff: svg('<path d="M3 3l18 18"/><path d="M9 9v2a3 3 0 0 0 5 2.200"/><path d="M15 9.300V6a3 3 0 0 0-5.700-1.300"/><path d="M19 11a7 7 0 0 1-.600 2.800"/><path d="M5 11a7 7 0 0 0 10.500 6"/><path d="M12 18v3"/>'),
  help: svg('<circle cx="12" cy="12" r="9"/><path d="M9.500 9a2.500 2.500 0 1 1 3.500 2.300c-.700.400-1 1-1 1.700"/><path d="M12 17h.010"/>'),
  close: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
  copy: svg('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>'),
  send: svg('<path d="M21 3 10 14"/><path d="M21 3l-7 18-4-7-7-4Z"/>'),
  down: svg('<path d="M12 4v11"/><path d="M7 11l5 5 5-5"/><path d="M5 20h14"/>'),
  trash: svg('<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/>'),
  flag: svg('<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/>'),
  eye: svg('<path d="M2 12s3.600-7 10-7 10 7 10 7-3.600 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>'),
  enter: svg('<path d="M20 5v8a3 3 0 0 1-3 3H5"/><path d="M9 12l-4 4 4 4"/>'),
  swap: svg('<path d="M7 7h13"/><path d="M17 4l3 3-3 3"/><path d="M17 17H4"/><path d="M7 14l-3 3 3 3"/>'),
};
