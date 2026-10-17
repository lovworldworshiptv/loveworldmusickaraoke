import { act, fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminSongs from "./AdminSongs";

const state = vi.hoisted(() => ({
  admin: false, editor: true,
  update: vi.fn(),
  insert: vi.fn(),
  song: { id: "song-1", title: "Faithful And Just", artist: "Loveworld Singers", album: null, album_id: null, category_id: null, duration_seconds: 240, is_featured: false, is_top: false, is_free_download: false, audio_url: null, instrumental_url: null, cover_url: null, lyrics_lrc: null },
}));
vi.mock("@/hooks/useIsAdmin", () => ({ useIsAdmin: () => ({ isAdmin: state.admin, loading: false }) }));
vi.mock("@/hooks/useIsEditor", () => ({ useIsEditor: () => ({ isEditor: state.editor, loading: false }) }));
vi.mock("@/components/layout/AppLayout", () => ({ default: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("@/components/admin/ImageUploadPicker", () => ({ default: () => null }));
vi.mock("@/components/admin/StemStudio", () => ({ default: () => null, callStemAdmin: vi.fn() }));
vi.mock("@/components/admin/AdminLyricsManager", () => ({ default: () => null }));
vi.mock("@/components/admin/SongVideosManager", () => ({ default: () => null }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => ({
      select: () => ({ order: async () => ({ data: table === "songs" ? [state.song] : [] }) }),
      update: (values: unknown) => ({ eq: async (column: string, id: string) => { state.update(values, column, id); return { error: null }; } }),
      insert: (values: unknown) => ({ select: () => ({ single: async () => { state.insert(values); return { data: { id: "new-song" }, error: null }; } }) }),
    }),
    storage: { from: () => ({ list: async () => ({ data: [] }) }) },
  },
}));

describe("Manage Songs editor permissions", () => {
  beforeEach(() => { state.admin = false; state.editor = true; state.update.mockClear(); state.insert.mockClear(); });
  afterEach(cleanup);

  it("allows an editor to save changed song details", async () => {
    render(<AdminSongs />);
    fireEvent.click(await screen.findByRole("button", { name: "Edit details for Faithful And Just" }));
    fireEvent.change(screen.getByPlaceholderText("Title"), { target: { value: "Faithful And Just Updated" } });
    fireEvent.change(screen.getByPlaceholderText("Artist"), { target: { value: "Loveworld Singers Updated" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    await waitFor(() => expect(state.update).toHaveBeenCalledWith(expect.objectContaining({ title: "Faithful And Just Updated", artist: "Loveworld Singers Updated" }), "id", "song-1"));
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
    render(<AdminSongs />);
    fireEvent.click(await screen.findByRole("button", { name: "Add Song" }));
    fireEvent.change(screen.getByPlaceholderText("Title"), { target: { value: "New Worship Song" } });
    fireEvent.click(screen.getByRole("button", { name: "Create Song" }));
    await waitFor(() => expect(state.insert).toHaveBeenCalledWith(expect.objectContaining({ title: "New Worship Song", artist: "Loveworld Singers" })));
  });

  it("keeps deletion unavailable to editors", async () => {
    render(<AdminSongs />);
    await screen.findByRole("button", { name: "Edit details for Faithful And Just" });
    expect(screen.getByTitle("Delete")).toBeDisabled();
  });
});