import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act, waitFor } from "@testing-library/react";
import { StrictMode } from "react";

const featureState = vi.hoisted(() => ({ karaoke: true, video: true, translations: true }));
vi.mock("@/contexts/FeatureContext", () => ({
  useFeatures: () => ({ enabled: (id: keyof typeof featureState) => featureState[id] !== false }),
}));

// Backend mock: signed-out listener, every query resolves empty.
vi.mock("@/integrations/supabase/client", () => {
  const query: any = new Proxy({}, {
    get: (_t, prop) => {
      if (prop === "then") return (res: any) => Promise.resolve({ data: null, error: null }).then(res);
      return () => query;
    },
  });
  return {
    supabase: {
      auth: {
        getUser: async () => ({ data: { user: null } }),
        getSession: async () => ({ data: { session: null } }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      },
      from: () => query,
      rpc: async () => ({ data: null, error: null }),
    },
  };
});

// Fake audio element that tracks which instances are actually sounding.
const created: FakeAudio[] = [];
class FakeAudio extends EventTarget {
  src: string; paused = true; currentTime = 0; duration = 200; volume = 1;
  onended: (() => void) | null = null;
  constructor(src = "") { super(); this.src = src; created.push(this); queueMicrotask(() => this.dispatchEvent(new Event("loadedmetadata"))); }
  play() { this.paused = false; this.dispatchEvent(new Event("play")); return Promise.resolve(); }
  pause() { if (!this.paused) { this.paused = true; this.dispatchEvent(new Event("pause")); } }
}
const playing = () => created.filter((a) => !a.paused);

import { PlayerProvider, usePlayer } from "./PlayerContext";

let api: ReturnType<typeof usePlayer>;
function Grab() { api = usePlayer(); return null; }

const songA = { id: "a", title: "A", artist: "Loveworld Singers", audioUrl: "https://x/a.mp3", instrumentalUrl: "https://x/a-inst.mp3" };
const songB = { id: "b", title: "B", artist: "Loveworld Singers", audioUrl: "https://x/b.mp3", instrumentalUrl: "https://x/b-inst.mp3" };
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

describe("playback exclusivity", () => {
  beforeEach(() => {
    created.length = 0; localStorage.clear(); vi.stubGlobal("Audio", FakeAudio as any);
    featureState.karaoke = true; featureState.video = true; featureState.translations = true;
  });

  it("keeps only one audio source active across mode switches and track changes", async () => {
    render(<StrictMode><PlayerProvider><Grab /></PlayerProvider></StrictMode>);

    act(() => api.playSong(songA));
    await waitFor(() => expect(playing()).toHaveLength(1));
    expect(playing()[0].src).toContain("a.mp3");

    act(() => api.toggleKaraoke()); await flush();
    expect(playing()).toHaveLength(1);
    expect(playing()[0].src).toContain("a-inst.mp3");

    act(() => api.toggleKaraoke()); await flush();
    expect(playing()).toHaveLength(1);
    expect(playing()[0].src).toMatch(/a\.mp3$/);

    act(() => api.playSong(songB));
    await waitFor(() => expect(playing()[0]?.src).toContain("b.mp3"));
    expect(playing()).toHaveLength(1);
  });

  it("blocks disabled karaoke and video requests without interrupting the song", async () => {
    featureState.karaoke = false;
    featureState.video = false;
    render(<PlayerProvider><Grab /></PlayerProvider>);
    act(() => api.playSong(songA));
    await waitFor(() => expect(playing()).toHaveLength(1));
    act(() => { api.toggleKaraoke(); api.singThis(songB); api.playVideo(songB); });
    await flush();
    expect(api.isKaraoke).toBe(false);
    expect(api.videoModeRequest).toBe(false);
    expect(api.karaokeModeRequest).toBe(false);
    expect(playing()).toHaveLength(1);
    expect(playing()[0].src).toMatch(/a\.mp3$/);
  });
});
