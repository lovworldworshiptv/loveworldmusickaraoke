import { act, fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminSongs from "./AdminSongs";

const state = vi.hoisted(() => ({
  admin: false, editor: true,
  update: vi.fn(),
  insert: vi.fn(),
  song: { id: "song-1", title: "Faithful And Just", artist: "Loveworld Singers", album: "Praise Night 20", album_id: "album-20", category_id: null, duration_seconds: 240, is_featured: false, is_top: false, is_free_download: false, audio_url: "https://cdn.example/faithful.mp3", instrumental_url: null, cover_url: "https://cdn.example/old-cover.jpg", lyrics_lrc: "[00:01.00]Faithful", has_video: true },
  albums: [
    { id: "album-20", title: "Praise Night 20", cover_url: "https://cdn.example/pn20.jpg" },
    { id: "album-28", title: "Praise Night 28", cover_url: "https://cdn.example/pn28.jpg" },
  ],
  video: { video_url: "https://youtu.be/abcdefghijk", video_type: "official", language_code: "en", offset_ms: 0 },
}));
vi.mock("@/hooks/useIsAdmin", () => ({ useIsAdmin: () => ({ isAdmin: state.admin, loading: false }) }));
vi.mock("@/hooks/useIsEditor", () => ({ useIsEditor: () => ({ isEditor: state.editor, loading: false }) }));
vi.mock("@/components/layout/AppLayout", () => ({ default: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("@/components/admin/ImageUploadPicker", () => ({
  default: ({ disabled, value }: { disabled?: boolean; value: string }) => (
    <div data-testid="cover-picker" data-disabled={String(!!disabled)} data-value={value} />
  ),
}));
vi.mock("@/components/admin/StemStudio", () => ({ default: () => null, callStemAdmin: vi.fn() }));
vi.mock("@/components/admin/AdminLyricsManager", () => ({ default: () => null }));
vi.mock("@/components/admin/SongVideosManager", () => ({ default: () => null }));
vi.mock("@/integrations/supabase/client", () => {
  const query = (table: string) => {
    const result = () => ({ data: table === "songs" ? [state.song] : table === "albums" ? state.albums : [] });
    const q: any = {
      eq: () => q, order: () => q, limit: () => q, in: () => q, range: () => q,
      maybeSingle: async () => ({ data: table === "song_videos" ? state.video : null }),
      then: (res: any, rej: any) => Promise.resolve(result()).then(res, rej),
    };
    return q;
  };
  return {
    supabase: {
      from: (table: string) => ({
        select: () => query(table),
        update: (values: unknown) => ({ eq: async (column: string, id: string) => { state.update(table, values, column, id); return { error: null }; } }),
        insert: (values: unknown) => {
          state.insert(table, values);
          const done = { data: { id: "new-song" }, error: null };
          return { select: () => ({ single: async () => done }), then: (res: any) => Promise.resolve({ error: null }).then(res) };
        },
      }),
      storage: { from: () => ({ list: async () => ({ data: [] }) }) },
      functions: { invoke: async (_name: string, { body }: { body: { url: string } }) => ({ data: { url: body.url, source: "youtube" }, error: null }) },
    },
  };
});

const openAddForm = async () => {
  render(<AdminSongs />);
  fireEvent.click(await screen.findByRole("button", { name: "Add Song" }));
};

describe("Manage Songs editor permissions", () => {
  beforeEach(() => { state.admin = false; state.editor = true; state.update.mockClear(); state.insert.mockClear(); });
  afterEach(cleanup);

  it("allows an editor to save changed song details", async () => {
    render(<AdminSongs />);
    fireEvent.click(await screen.findByRole("button", { name: "Edit details for Faithful And Just" }));
    fireEvent.change(screen.getByPlaceholderText("Title"), { target: { value: "Faithful And Just Updated" } });
    fireEvent.change(screen.getByPlaceholderText("Artist"), { target: { value: "Loveworld Singers Updated" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    await waitFor(() => expect(state.update).toHaveBeenCalledWith("songs", expect.objectContaining({ title: "Faithful And Just Updated", artist: "Loveworld Singers Updated" }), "id", "song-1"));
  });

  it("does not grant song-management access to regular users", async () => {
    state.editor = false;
    await act(async () => { render(<AdminSongs />); });
    expect(screen.queryByRole("button", { name: "Edit details for Faithful And Just" })).toBeNull();
    expect(state.update).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Add Song" })).toBeNull();
    expect(state.insert).not.toHaveBeenCalled();
  });

  it("allows an editor to add a new song", async () => {
    await openAddForm();
    fireEvent.change(screen.getByPlaceholderText("Title"), { target: { value: "New Worship Song" } });
    fireEvent.click(screen.getByRole("button", { name: "Create Song" }));
    await waitFor(() => expect(state.insert).toHaveBeenCalledWith("songs", expect.objectContaining({ title: "New Worship Song", artist: "Loveworld Singers" })));
  });

  it("keeps deletion unavailable to editors", async () => {
    render(<AdminSongs />);
    await screen.findByRole("button", { name: "Edit details for Faithful And Just" });
    expect(screen.getByTitle("Delete")).toBeDisabled();
  });
});

describe("Adding a song whose title already exists", () => {
  beforeEach(() => { state.admin = false; state.editor = true; state.update.mockClear(); state.insert.mockClear(); });
  afterEach(cleanup);

  it("lists existing songs as the title is typed and offers Cancel, Create copy and Edit existing", async () => {
    await openAddForm();
    fireEvent.change(screen.getByPlaceholderText("Title"), { target: { value: "faith" } });
    fireEvent.click(await screen.findByRole("option", { name: /Faithful And Just/ }));
    expect(await screen.findByRole("button", { name: "Cancel" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Create copy" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Edit existing" })).toBeTruthy();
  });

  it("Edit existing opens the original song for editing", async () => {
    await openAddForm();
    fireEvent.change(screen.getByPlaceholderText("Title"), { target: { value: "Faithful" } });
    fireEvent.click(await screen.findByRole("option", { name: /Faithful And Just/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Edit existing" }));
    expect(await screen.findByRole("button", { name: "Save Changes" })).toBeTruthy();
    expect((screen.getByPlaceholderText("Title") as HTMLInputElement).value).toBe("Faithful And Just");
  });

  it("Create copy makes a new song for another album with that album's artwork and the original's video, leaving the original untouched", async () => {
    await openAddForm();
    fireEvent.change(screen.getByPlaceholderText("Title"), { target: { value: "Faithful" } });
    fireEvent.click(await screen.findByRole("option", { name: /Faithful And Just/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Create copy" }));
    await waitFor(() => expect((screen.getByPlaceholderText(/https:\/\/ video link/) as HTMLInputElement).value).toBe(state.video.video_url));
    fireEvent.change(screen.getByLabelText("Album"), { target: { value: "album-28" } });
    fireEvent.click(screen.getByRole("button", { name: "Create Song" }));
    await waitFor(() => expect(state.insert).toHaveBeenCalledWith("songs", expect.objectContaining({
      title: "Faithful And Just", album_id: "album-28", album: "Praise Night 28",
      audio_url: "https://cdn.example/faithful.mp3", cover_url: "https://cdn.example/pn28.jpg", has_video: true,
    })), { timeout: 4000 });
    await waitFor(() => expect(state.insert).toHaveBeenCalledWith("song_videos", expect.objectContaining({ song_id: "new-song", video_url: state.video.video_url })));
    expect(state.update).not.toHaveBeenCalledWith("songs", expect.anything(), "id", "song-1");
  });

  it("selecting an album imports its artwork and greys out the artwork field", async () => {
    await openAddForm();
    expect(screen.getByTestId("cover-picker").dataset.disabled).toBe("false");
    fireEvent.change(screen.getByLabelText("Album"), { target: { value: "album-28" } });
    const picker = screen.getByTestId("cover-picker");
    expect(picker.dataset.disabled).toBe("true");
    expect(picker.dataset.value).toBe("https://cdn.example/pn28.jpg");
    fireEvent.change(screen.getByLabelText("Album"), { target: { value: "" } });
    expect(screen.getByTestId("cover-picker").dataset.disabled).toBe("false");
    expect(screen.getByTestId("cover-picker").dataset.value).toBe("");
  });

  it("auto-imports the video when the title exactly matches an existing copy", async () => {
    await openAddForm();
    fireEvent.change(screen.getByPlaceholderText("Title"), { target: { value: "Faithful and just" } });
    await waitFor(() => expect((screen.getByPlaceholderText(/https:\/\/ video link/) as HTMLInputElement).value).toBe(state.video.video_url));
  });
});
