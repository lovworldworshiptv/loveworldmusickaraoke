import { useCallback, useState } from "react";
import { CheckCircle2, XCircle, MinusCircle, Loader2, Copy, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import AppLayout from "@/components/layout/AppLayout";
import { toast } from "sonner";
import * as store from "@/lib/secureDownloads/store";
import { generateDeviceKeys, unwrapContentKey, decryptChunk, chunkIv, chunkAad, GCM_TAG_BYTES } from "@/lib/secureDownloads/crypto";
import { isLicenceValid, plainChunkLength } from "@/lib/secureDownloads/policy";
import { offlineApi } from "@/lib/secureDownloads/api";
import { liveSyncStatus, renewSongLicence, devExpireLicences, renewAllNow } from "@/lib/secureDownloads/engine";

/** Known media file signatures; stored chunks must never start with one. */
function mediaSignature(b: Uint8Array): string | null {
  const s = (o: number, t: string) => t.split("").every((c, i) => b[o + i] === c.charCodeAt(0));
  if (s(0, "ID3")) return "ID3 (MP3)";
  if (s(0, "fLaC")) return "FLAC";
  if (s(0, "OggS")) return "Ogg";
  if (s(0, "RIFF")) return "RIFF/WAV";
  if (s(4, "ftyp")) return "MP4";
  if (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) return "MPEG audio frame";
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return "WebM";
  return null;
}

type Status = "pass" | "fail" | "skip";
interface Result { name: string; status: Status; detail: string }

const enc = new TextEncoder();
const MB = 1048576;

async function check(name: string, fn: () => Promise<{ status?: Status; detail: string }>): Promise<Result> {
  try {
    const r = await fn();
    return { name, status: r.status ?? "pass", detail: r.detail };
  } catch (e) {
    return { name, status: "fail", detail: (e as Error)?.message || String(e) };
  }
}

/** On-device diagnostics for encrypted offline downloads. Shows facts only — never keys or media bytes. */
async function runAll(): Promise<Result[]> {
  const out: Result[] = [];
  out.push(await check("Secure context and Web Crypto", async () => {
    if (!window.isSecureContext) throw new Error("Page is not in a secure (HTTPS) context");
    if (!crypto?.subtle) throw new Error("Web Crypto is not available");
    return { detail: "Available" };
  }));

  out.push(await check("Device key cannot be exported", async () => {
    const d = await generateDeviceKeys();
    if (d.privateKey.extractable) throw new Error("Private key is extractable");
    if ("d" in d.publicKeyJwk) throw new Error("Public key contains private part");
    let blocked = false;
    try { await crypto.subtle.exportKey("jwk", d.privateKey); } catch { blocked = true; }
    if (!blocked) throw new Error("Private key export was allowed");
    return { detail: "ECDH P-256, non-extractable" };
  }));

  out.push(await check("Encrypt → AES-KW licence → decrypt (1 MB)", async () => {
    const dev = await generateDeviceKeys();
    const raw = crypto.getRandomValues(new Uint8Array(32));
    const content = await crypto.subtle.importKey("raw", raw, "AES-GCM", true, ["encrypt"]);
    const plain = new Uint8Array(MB);
    for (let i = 0; i < MB; i += 65536) crypto.getRandomValues(plain.subarray(i, i + 65536));
    const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv: chunkIv(0), additionalData: chunkAad("selftest", 0) }, content, plain);
    // Server side of the licence, done locally for the test.
    const pub = await crypto.subtle.importKey("jwk", dev.publicKeyJwk, { name: "ECDH", namedCurve: "P-256" }, false, []);
    const eph = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
    const bits = await crypto.subtle.deriveBits({ name: "ECDH", public: pub }, eph.privateKey, 256);
    const base = await crypto.subtle.importKey("raw", bits, "HKDF", false, ["deriveKey"]);
    const kek = await crypto.subtle.deriveKey({ name: "HKDF", hash: "SHA-256", salt: enc.encode("lmk-offline-licence-v2"), info: enc.encode("lic-selftest") }, base, { name: "AES-KW", length: 256 }, false, ["wrapKey"]);
    const wrapped = new Uint8Array(await crypto.subtle.wrapKey("raw", content, kek, "AES-KW"));
    let s = ""; wrapped.forEach((b) => { s += String.fromCharCode(b); });
    const key = await unwrapContentKey(dev.privateKey, "selftest", {
      alg: "A256KW", licenceId: "lic-selftest", ephemeralPublicKey: await crypto.subtle.exportKey("jwk", eph.publicKey),
      iv: "", wrappedKey: btoa(s), expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });
    const back = new Uint8Array(await decryptChunk(key, "selftest", 0, ct));
    if (back.length !== MB || !back.every((b, i) => b === plain[i])) throw new Error("Bytes differ after decrypting");
    const tampered = new Uint8Array(ct); tampered[10] ^= 1;
    let rejected = false;
    try { await decryptChunk(key, "selftest", 0, tampered.buffer); } catch { rejected = true; }
    if (!rejected) throw new Error("A changed chunk was accepted");
    return { detail: "Byte-identical; tampered chunk rejected" };
  }));

  out.push(await check("Encrypted storage (IndexedDB)", async () => {
    await store.getItems();
    return { detail: "Open" };
  }));

  out.push(await check("Private file storage (OPFS)", async () => {
    const has = typeof (navigator.storage as any)?.getDirectory === "function";
    return { status: "skip", detail: has ? "Supported by this browser — downloads currently use encrypted IndexedDB" : "Not supported — encrypted IndexedDB is used" };
  }));

  out.push(await check("Storage space", async () => {
    const est = await navigator.storage?.estimate?.();
    const persisted = await navigator.storage?.persisted?.().catch(() => false);
    if (!est) return { status: "skip", detail: "Not reported by this browser" };
    const free = Math.max(0, (est.quota ?? 0) - (est.usage ?? 0));
    return { detail: `${(free / MB).toFixed(0)} MB free · ${persisted ? "protected from automatic clean-up" : "not yet protected from clean-up"}` };
  }));

  let streaming = false;
  out.push(await check("Streaming helper (service worker)", async () => {
    const sw = navigator.serviceWorker?.controller;
    if (!sw) return { status: "skip", detail: "Not active here (preview, iOS or app wrapper) — in-memory playback is used" };
    streaming = await new Promise<boolean>((resolve) => {
      const ch = new MessageChannel();
      const t = setTimeout(() => resolve(false), 800);
      ch.port1.onmessage = (e) => { clearTimeout(t); resolve(e.data?.type === "LMK_OFFLINE_STREAM_PONG"); };
      sw.postMessage({ type: "LMK_OFFLINE_STREAM_PING" }, [ch.port2]);
    });
    if (!streaming) throw new Error("Service worker did not answer");
    return { detail: "Active" };
  }));

  const device = await store.getDevice().catch(() => null);
  out.push(await check("This device is registered", async () => {
    if (!device) return { status: "skip", detail: "No download yet on this device" };
    if (!navigator.onLine) return { status: "skip", detail: "Offline — cannot confirm with the account" };
    const r = await offlineApi<{ active: boolean }>("touch_device", { deviceId: device.deviceId });
    if (!r.active) throw new Error("This device was removed from the account");
    return { detail: "Active on your account" };
  }));

  const items = (await store.getItems().catch(() => [])).filter((i) => i.status === "ready");
  out.push(await check("Saved downloads and licences", async () => {
    if (!items.length) return { status: "skip", detail: "No saved downloads on this device" };
    const valid = items.filter((i) => isLicenceValid(i.packages.find((p) => p.kind === "audio")?.licence?.expiresAt));
    const earliest = valid.map((i) => i.packages.find((p) => p.kind === "audio")!.licence!.expiresAt).sort()[0];
    const kw = items.flatMap((i) => i.packages).filter((p) => p.licence?.alg === "A256KW").length;
    return {
      status: valid.length === items.length ? "pass" : "fail",
      detail: `${valid.length}/${items.length} playable · ${kw} AES-KW licences${earliest ? ` · next expiry ${new Date(earliest).toLocaleDateString()}` : ""}`,
    };
  }));

  const sample = items.find((i) => i.packages.some((p) => p.kind === "audio" && p.licence && isLicenceValid(p.licence.expiresAt)));
  const pkg = sample?.packages.find((p) => p.kind === "audio");
  out.push(await check("Stored chunk is encrypted and intact", async () => {
    if (!sample || !pkg || !device) return { status: "skip", detail: "No saved download to check" };
    const data = await store.getChunk(pkg.packageId, 0);
    if (!data) throw new Error("First chunk missing");
    const expected = plainChunkLength(0, pkg.chunkSize, pkg.chunkCount, pkg.byteLength) + GCM_TAG_BYTES;
    if (data.byteLength !== expected) throw new Error(`Unexpected size ${data.byteLength}`);
    const have = await store.storedChunkIndices(pkg.packageId);
    if (have.size !== pkg.chunkCount) throw new Error(`${have.size}/${pkg.chunkCount} chunks stored`);
    for (const p of sample.packages) {
      const first = await store.getChunk(p.packageId, 0);
      const sig = first && mediaSignature(new Uint8Array(first.slice(0, 16)));
      if (sig) throw new Error(`Stored ${p.kind} starts with a ${sig} signature — plain media on disk`);
    }
    const key = await unwrapContentKey(device.privateKey, pkg.packageId, pkg.licence!);
    const plain = new Uint8Array(await decryptChunk(key, pkg.packageId, 0, data));
    const sig = mediaSignature(plain.subarray(0, 16));
    if (!sig) throw new Error("Decrypted bytes are not a recognised media file");
    return { detail: `“${sample.meta.title}”: all ${pkg.chunkCount} chunks stored as ciphertext; decrypts to ${sig}` };
  }));

  out.push(await check("Seeking (byte-range playback)", async () => {
    if (!sample || !pkg) return { status: "skip", detail: "No saved download to check" };
    if (!streaming) return { status: "skip", detail: "Streaming helper not active — in-memory playback is used" };
    const start = Math.min(pkg.byteLength - 1024, pkg.chunkSize - 100);
    const res = await fetch(`/__offline/${sample.songId}`, { headers: { Range: `bytes=${start}-${start + 1023}` } });
    const body = await res.arrayBuffer();
    if (res.status !== 206) throw new Error(`Status ${res.status}`);
    if (body.byteLength !== 1024) throw new Error(`Got ${body.byteLength} bytes`);
    const head = await fetch(`/__offline/${sample.songId}`, { headers: { Range: "bytes=0-15" } });
    const sig = mediaSignature(new Uint8Array(await head.arrayBuffer()));
    if (head.status !== 206 || !sig) throw new Error("Start of the stream is not a recognised media file");
    return { detail: `206 · ${res.headers.get("content-range")} (crosses a chunk boundary) · starts with ${sig}` };
  }));

  out.push(await check("Live sync with your other devices", async () => {
    const st = liveSyncStatus();
    if (!navigator.onLine) return { status: "skip", detail: "Offline" };
    if (st !== "SUBSCRIBED") throw new Error(`Not connected (${st})`);
    return { detail: "Connected — changes on other devices arrive within seconds" };
  }));

  out.push(await check("Renewal reachable", async () => {
    if (!sample) return { status: "skip", detail: "No saved download to renew" };
    if (!navigator.onLine) return { status: "skip", detail: "Offline" };
    const r = await renewSongLicence(sample.songId);
    if (r !== "renewed") throw new Error(`Renewal result: ${r}`);
    const fresh = await store.getItem(sample.songId);
    const exp = fresh?.packages.find((p) => p.kind === "audio")?.licence?.expiresAt;
    return { detail: `Renewed · now valid until ${exp ? new Date(exp).toLocaleDateString() : "?"}` };
  }));

  return out;
}

const Icon = ({ s }: { s: Status }) =>
  s === "pass" ? <CheckCircle2 className="w-5 h-5 text-primary shrink-0" aria-label="Passed" />
  : s === "fail" ? <XCircle className="w-5 h-5 text-destructive shrink-0" aria-label="Failed" />
  : <MinusCircle className="w-5 h-5 text-muted-foreground shrink-0" aria-label="Skipped" />;

const OfflineSelfTest = () => {
  const [results, setResults] = useState<Result[] | null>(null);
  const [running, setRunning] = useState(false);

  const run = useCallback(async () => {
    setRunning(true);
    try { setResults(await runAll()); } finally { setRunning(false); }
  }, []);

  const copy = () => {
    if (!results) return;
    const text = [`Offline self-test — ${new Date().toISOString()}`, navigator.userAgent, "",
      ...results.map((r) => `[${r.status.toUpperCase()}] ${r.name}: ${r.detail}`)].join("\n");
    navigator.clipboard.writeText(text).then(() => toast.success("Report copied")).catch(() => toast.error("Could not copy"));
  };

  const fails = results?.filter((r) => r.status === "fail").length ?? 0;

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <header>
          <h1 className="text-xl font-bold text-foreground">Offline downloads self-test</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Checks encryption, storage and playback on this device. Nothing secret is shown or sent.
          </p>
        </header>
        <div className="flex gap-2">
          <Button onClick={run} disabled={running} className="gap-2">
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} {results ? "Run again" : "Run all checks"}
          </Button>
          {results && <Button variant="outline" onClick={copy} className="gap-2"><Copy className="w-4 h-4" /> Copy report</Button>}
        </div>
        <div className="rounded-2xl border border-border bg-card/60 p-3 space-y-2">
          <p className="text-sm font-semibold text-foreground">Testing tools</p>
          <p className="text-xs text-muted-foreground">
            “Expire now” makes saved songs on this device behave as if 30 days have passed, so you can check the
            offline message. “Renew now” brings them back while online.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => devExpireLicences().then(() => toast.success("Saved songs on this device now look expired"))}>Expire now</Button>
            <Button size="sm" variant="outline" onClick={() => renewAllNow().then((r) => toast.success(`${r.filter((x) => x === "renewed").length} of ${r.length} renewed`))}>Renew now</Button>
          </div>
        </div>
        {results && (
          <p role="status" className="text-sm text-foreground">
            {fails ? `${fails} check${fails === 1 ? "" : "s"} failed` : "No failures"} · {results.filter((r) => r.status === "pass").length} passed · {results.filter((r) => r.status === "skip").length} skipped
          </p>
        )}
        <ul className="space-y-2">
          {results?.map((r) => (
            <li key={r.name} className="flex items-start gap-3 rounded-2xl border border-border bg-card/60 p-3">
              <Icon s={r.status} />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{r.name}</p>
                <p className="text-xs text-muted-foreground break-words">{r.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </AppLayout>
  );
};

export default OfflineSelfTest;
