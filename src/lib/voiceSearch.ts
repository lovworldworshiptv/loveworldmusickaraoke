import { supabase } from "@/integrations/supabase/client";

/** Upload rate: speech needs no more than 16 kHz mono, which keeps clips small and fast. */
export const VOICE_SAMPLE_RATE = 16000;
export const VOICE_MAX_MS = 10000;
/** Stop this long after the person stops speaking. */
export const VOICE_SILENCE_MS = 1300;
/** Give up if nobody speaks within this window. */
export const VOICE_NO_SPEECH_MS = 6000;
const SPEECH_RMS = 0.02;

const LEADING = [
  /^(?:hey|ok(?:ay)?|um+|uh+|please)[\s,]+/i,
  /^(?:can you |could you |please )?(?:play|search(?: for)?|find(?: me)?|look(?:ing)? for|show(?: me)?|open|i want to (?:hear|sing|listen to)|sing|let me hear)\s+/i,
  /^(?:the )?(?:song|track|lyrics?)(?: called| titled| that goes)?\s+/i,
];
const TRAILING = [/[\s,]+(?:please|thanks?(?: you)?)$/i, /\s+(?:song|track|lyrics)$/i, /\s+by\s+(?:the\s+)?loveworld singers$/i];

/** Removes spoken commands around the actual title or lyric ("play Way Maker please" → "Way Maker"). */
export function cleanVoiceQuery(text: string): string {
  let q = (text || "").replace(/[“”"]/g, "").replace(/\s+/g, " ").trim().replace(/[.!?…]+$/g, "").trim();
  for (let pass = 0; pass < 2; pass++) {
    for (const re of LEADING) q = q.replace(re, "");
    for (const re of TRAILING) q = q.replace(re, "");
    q = q.trim().replace(/^[,;:\-\s]+|[,;:\-\s]+$/g, "");
  }
  return q;
}

/** Averages input samples down to the target rate (simple anti-aliasing box filter). */
export function downsample(input: Float32Array, fromRate: number, toRate = VOICE_SAMPLE_RATE): Float32Array {
  if (toRate >= fromRate) return input;
  const ratio = fromRate / toRate;
  const out = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j++) sum += input[j];
    out[i] = end > start ? sum / (end - start) : 0;
  }
  return out;
}

export function encodeWav(chunks: readonly Float32Array[], sampleRate: number): Blob {
  const length = chunks.reduce((sum, c) => sum + c.length, 0);
  const bytes = new ArrayBuffer(44 + length * 2);
  const view = new DataView(bytes);
  const tag = (o: number, v: string) => { for (let i = 0; i < v.length; i++) view.setUint8(o + i, v.charCodeAt(i)); };
  tag(0, "RIFF"); view.setUint32(4, 36 + length * 2, true); tag(8, "WAVE"); tag(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true); tag(36, "data"); view.setUint32(40, length * 2, true);
  let o = 44;
  for (const c of chunks) for (const v of c) { const s = Math.max(-1, Math.min(1, v)); view.setInt16(o, s * (s < 0 ? 32768 : 32767), true); o += 2; }
  return new Blob([bytes], { type: "audio/wav" });
}

export interface VoiceCapture {
  /** Stops recording and returns the clip (rejects when nothing was said). */
  stop: () => Promise<File>;
  cancel: () => void;
}

/**
 * Records the microphone until the person stops speaking (or the time limit),
 * reporting the input level for a live meter. `onAutoStop` fires when recording ends on its own.
 */
export async function startVoiceCapture(opts: { onLevel?: (level: number) => void; onAutoStop?: () => void } = {}): Promise<VoiceCapture> {
  // Create and resume the audio context inside the tap itself — iPhones refuse it after an await.
  const Ctx = window.AudioContext || (window as any).webkitAudioContext;
  const ctx: AudioContext = new Ctx();
  const resumed = ctx.resume().catch(() => {});
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
    });
  } catch (e) {
    ctx.close().catch(() => {});
    throw e;
  }
  try {
    await resumed;
    if (ctx.state !== "running") await ctx.resume();
    const source = ctx.createMediaStreamSource(stream);
    const node = ctx.createScriptProcessor(4096, 1, 1);
    const chunks: Float32Array[] = [];
    const startedAt = performance.now();
    let heardSpeech = false;
    let lastVoice = startedAt;
    let done = false;
    node.onaudioprocess = (e) => {
      if (done) return;
      const data = e.inputBuffer.getChannelData(0);
      chunks.push(downsample(new Float32Array(data), ctx.sampleRate));
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
      const rms = Math.sqrt(sum / data.length);
      opts.onLevel?.(Math.min(1, rms * 8));
      const now = performance.now();
      if (rms > SPEECH_RMS) { heardSpeech = true; lastVoice = now; }
      const elapsed = now - startedAt;
      if (elapsed > VOICE_MAX_MS || (heardSpeech && now - lastVoice > VOICE_SILENCE_MS) || (!heardSpeech && elapsed > VOICE_NO_SPEECH_MS)) {
        opts.onAutoStop?.();
      }
    };
    source.connect(node);
    node.connect(ctx.destination);
    const release = () => {
      done = true;
      node.onaudioprocess = null;
      try { node.disconnect(); source.disconnect(); } catch { /* already disconnected */ }
      stream.getTracks().forEach((t) => t.stop());
      ctx.close().catch(() => {});
    };
    return {
      async stop() {
        if (done) throw new Error("Recording already stopped");
        release();
        const blob = encodeWav(chunks, Math.min(VOICE_SAMPLE_RATE, ctx.sampleRate));
        if (!heardSpeech || blob.size < 4096) throw new Error("We didn't hear anything. Tap the mic and try again.");
        return new File([blob], "voice.wav", { type: "audio/wav" });
      },
      cancel: release,
    };
  } catch (e) {
    stream.getTracks().forEach((t) => t.stop());
    ctx.close().catch(() => {});
    throw e;
  }
}

/* ---------- Browser speech recognition (used for guests, no upload) ---------- */

type BrowserRecognition = {
  lang: string; interimResults: boolean; continuous: boolean; maxAlternatives: number;
  start: () => void; stop: () => void; abort: () => void;
  onresult: ((e: any) => void) | null; onerror: ((e: any) => void) | null; onend: (() => void) | null;
};

const recognitionCtor = (): (new () => BrowserRecognition) | null =>
  typeof window === "undefined" ? null : ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null);

/** True when the browser can turn speech into text by itself (Chrome, Edge, Safari). */
export const browserSpeechAvailable = () => !!recognitionCtor();

/** Listens with the browser's own recogniser, streaming words as they're heard. */
export function startBrowserSpeech(opts: { onText: (text: string) => void; onDone: (text: string) => void; onError: (message: string) => void }) {
  const Ctor = recognitionCtor();
  if (!Ctor) throw new Error("Voice search isn't supported on this device.");
  const rec = new Ctor();
  rec.lang = navigator.language || "en-US";
  rec.interimResults = true;
  rec.continuous = false;
  rec.maxAlternatives = 1;
  let text = "";
  let failed = false;
  rec.onresult = (e: any) => {
    text = Array.from(e.results as ArrayLike<any>).map((r: any) => r[0]?.transcript || "").join(" ").replace(/\s+/g, " ").trim();
    opts.onText(text);
  };
  rec.onerror = (e: any) => {
    failed = true;
    const code = e?.error;
    opts.onError(code === "not-allowed" || code === "service-not-allowed" ? "Allow microphone access to search by voice."
      : code === "no-speech" ? "We didn't hear anything. Tap the mic and try again."
      : "Voice search isn't available right now. Please sign in or type your search.");
  };
  rec.onend = () => { if (!failed) opts.onDone(text); };
  rec.start();
  return { stop: () => rec.stop(), cancel: () => { failed = true; rec.abort(); } };
}

/** Friendly wording for gateway/function failures. */
export function voiceErrorMessage(status: number, serverMessage?: string): string {
  if (status === 401) return "Sign in to search by voice.";
  if (status === 402) return serverMessage || "Voice search is paused right now. Please type your search instead.";
  if (status === 429) return "Lots of people are searching right now. Please try again in a moment.";
  if (status === 413) return serverMessage || "That recording is too long. Try a shorter phrase.";
  if (status === 400) return serverMessage || "We couldn't understand that recording. Please try again.";
  return serverMessage || "Voice search failed. Please try again or type your search.";
}

/** Sends the clip for transcription, calling `onText` as words stream in. Resolves with the final transcript. */
export async function transcribeVoice(file: File, onText?: (text: string) => void, signal?: AbortSignal): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error(voiceErrorMessage(401));
  const form = new FormData();
  form.append("file", file, file.name);
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/voice-search`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
    body: form,
    signal,
  });
  if (!res.ok || !res.body) {
    let msg: string | undefined;
    try { const j = await res.json(); msg = j?.error?.message || j?.error || j?.message; } catch { /* not JSON */ }
    throw new Error(voiceErrorMessage(res.status, typeof msg === "string" ? msg : undefined));
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let final: string | null = null;
  const handle = (line: string) => {
    if (!line.startsWith("data:")) return;
    const payload = line.slice(5).trim();
    if (!payload || payload === "[DONE]") return;
    let evt: any;
    try { evt = JSON.parse(payload); } catch { return; }
    if (evt.type === "transcript.text.delta" && typeof evt.delta === "string") { text += evt.delta; onText?.(text); }
    else if (evt.type === "transcript.text.done" && typeof evt.text === "string") { final = evt.text; onText?.(evt.text); }
    else if (evt.type === "error" || evt.error) throw new Error(voiceErrorMessage(500, evt.error?.message || evt.message));
  };
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n")) >= 0) { handle(buffer.slice(0, idx).replace(/\r$/, "")); buffer = buffer.slice(idx + 1); }
  }
  if (buffer) handle(buffer.trim());
  const result = (final ?? text).trim();
  if (!result) throw new Error("We couldn't make out any words. Please try again.");
  return result;
}

/** Picks the one or two lyric lines that best match a spoken phrase, for the result preview. */
export function bestLyricLines(lyrics: string | null | undefined, query: string): string | null {
  if (!lyrics) return null;
  const words = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s']/g, " ").split(/\s+/).filter((w) => w.length > 1);
  const q = new Set(words(query));
  if (!q.size) return null;
  const lines = lyrics.replace(/\[[^\]]*\]/g, " ").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let best = -1, bestScore = 0;
  for (let i = 0; i < lines.length; i++) {
    // The line itself counts double so the preview starts where the phrase starts.
    const own = new Set(words(lines[i]).filter((x) => q.has(x))).size;
    const next = lines[i + 1] ? new Set(words(lines[i + 1]).filter((x) => q.has(x))).size : 0;
    const score = own * 2 + next;
    if (score > bestScore) { bestScore = score; best = i; }
  }
  if (best < 0) return null;
  return [lines[best], lines[best + 1]].filter(Boolean).join(" / ");
}
