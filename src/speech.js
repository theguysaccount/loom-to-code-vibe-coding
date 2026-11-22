// Voice: the browser's own speech recognition (Web Speech API), on-device when the browser offers it.
// Audio never goes anywhere from this code; whether the browser sends it to a speech service is
// reported as "local" or "cloud" so the toolbar can say so before recording.
//
// A custom engine can be passed to Pointbrief.init({ speech: engine }) with the same shape:
//   engine.start({ lang, onInterim(text), onFinal({ text, t0, t1, words, confidence }), onState(state) })
//   engine.stop()
// Times are milliseconds on the clock passed in as `now`.

const LATENCY = 350; // recognisers report a word a little after it was said

function getCtor() {
  return typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition || null : null;
}

export function speechSupported() {
  return !!getCtor();
}

/** "local" (on-device), "downloadable" (on-device after a model download), "cloud" or "none". */
export async function speechMode(lang) {
  const SR = getCtor();
  if (!SR) return "none";
  try {
    if (typeof SR.available === "function") {
      const status = await SR.available({ langs: [lang], processLocally: true });
      if (status === "available") return "local";
      if (status === "downloadable" || status === "downloading") return "downloadable";
    }
  } catch { /* older browsers: no on-device API */ }
  return "cloud";
}

/** Ask the browser to download its on-device model for `lang`. Needs a user gesture. */
export async function installLocalSpeech(lang) {
  const SR = getCtor();
  if (!SR || typeof SR.install !== "function") return false;
  try {
    return !!(await SR.install({ langs: [lang], processLocally: true }));
  } catch {
    return false;
  }
}

export function createSpeechEngine({ now }) {
  const SR = getCtor();
  if (!SR) return null;
  let rec = null;
  let wanted = false;
  let cb = null;
  let lang = "en-US";
  let local = false;
  let restarts = 0;
  let lastStart = 0;
  let firstSeen = new Map();   // result index -> time its first words were heard
  let wordTimes = new Map();   // result index -> [time each word first appeared]

  function handleResult(e) {
    const t = now();
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const res = e.results[i];
      const text = (res[0] && res[0].transcript ? res[0].transcript : "").trim();
      if (!text) continue;
      if (!firstSeen.has(i)) firstSeen.set(i, t - LATENCY);
      const times = wordTimes.get(i) || [];
      const words = text.split(/\s+/);
      for (let w = times.length; w < words.length; w++) times[w] = t - LATENCY;
      wordTimes.set(i, times);
      if (res.isFinal) {
        const t0 = Math.max(0, firstSeen.get(i));
        cb.onFinal({
          text, t0, t1: Math.max(t0, t - LATENCY / 2),
          words: words.map((w, k) => ({ w, t: Math.max(0, times[k] == null ? t0 : times[k]) })),
          confidence: res[0].confidence || 0,
        });
        firstSeen.delete(i);
        wordTimes.delete(i);
      } else {
        interim += (interim ? " " : "") + text;
      }
    }
    cb.onInterim(interim);
  }

  function begin() {
    rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.lang = lang;
    if (local) {
      try {
        rec.processLocally = true;
      } catch { /* not supported */ }
    }
    firstSeen = new Map();
    wordTimes = new Map();
    rec.onstart = () => cb.onState("listening");
    rec.onresult = handleResult;
    rec.onerror = (e) => {
      const err = e.error || "error";
      if (err === "not-allowed" || err === "service-not-allowed" || err === "audio-capture" || err === "language-not-supported") {
        wanted = false;
        cb.onState(err === "audio-capture" ? "no-mic" : err === "language-not-supported" ? "unsupported-language" : "denied");
      } else if (err === "network") {
        cb.onState("offline");
      }
      // "no-speech" and "aborted" are normal: onend restarts.
    };
    rec.onend = () => {
      rec = null;
      if (!wanted) return cb.onState("stopped");
      // Browsers end recognition after a while or after silence: start again, but never spin.
      const quick = now() - lastStart < 1500;
      restarts = quick ? restarts + 1 : 0;
      if (restarts > 4) {
        wanted = false;
        return cb.onState("failed");
      }
      setTimeout(() => wanted && tryStart(), quick ? 400 * restarts : 60);
    };
    lastStart = now();
    rec.start();
  }

  function tryStart() {
    try {
      begin();
    } catch {
      wanted = false;
      cb.onState("failed");
    }
  }

  return {
    async start(opts) {
      cb = { onInterim() {}, onFinal() {}, onState() {}, ...opts };
      lang = opts.lang || "en-US";
      const mode = await speechMode(lang);
      local = mode === "local";
      wanted = true;
      restarts = 0;
      cb.onState("starting");
      tryStart();
      return local ? "speech-local" : "speech-cloud";
    },
    stop() {
      wanted = false;
      if (rec) {
        try {
          rec.stop();
        } catch { /* already stopped */ }
      }
    },
  };
}
