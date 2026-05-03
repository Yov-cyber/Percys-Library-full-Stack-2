import { create } from "zustand";
import { api, type BulkOp, type ComicSummary } from "../lib/api";

interface LibraryState {
  comics: ComicSummary[];
  loading: boolean;
  uploading: boolean;
  query: string;
  filter: "all" | "favorites" | "in-progress" | "completed";
  load: () => Promise<void>;
  scan: () => Promise<{ added: number; removed: number; total: number }>;
  upload: (files: File[]) => Promise<{
    uploaded: { name: string; size: number }[];
    skipped: { name: string; reason: "already-exists" | "duplicated-in-batch" }[];
    added: number;
    removed: number;
    total: number;
  }>;
  setQuery: (q: string) => void;
  setFilter: (f: LibraryState["filter"]) => void;
  toggleFavorite: (id: string) => Promise<void>;
  bulk: (
    ids: string[],
    op: BulkOp,
    category?: string | null,
  ) => Promise<{ affected: number }>;
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  comics: [],
  loading: false,
  uploading: false,
  query: "",
  filter: "all",
  async load() {
    set({ loading: true });
    try {
      const comics = await api.library();
      set({ comics });
    } finally {
      set({ loading: false });
    }
  },
  async scan() {
    const result = await api.scan();
    await get().load();
    return result;
  },
  async upload(files) {
    set({ uploading: true });
    try {
      const result = await api.uploadComics(files);
      await get().load();
      return result;
    } finally {
      set({ uploading: false });
    }
  },
  setQuery(query) {
    set({ query });
  },
  setFilter(filter) {
    set({ filter });
  },
  async toggleFavorite(id) {
    const comic = get().comics.find((c) => c.id === id);
    if (!comic) return;
    const next = !comic.isFavorite;
    set({ comics: get().comics.map((c) => (c.id === id ? { ...c, isFavorite: next } : c)) });
    await api.setFavorite(id, next);
  },
  async bulk(ids, op, category) {
    const r = await api.bulk(ids, op, category);
    // Refresh from the server so completed/currentPage/category etc. all
    // come back consistent with whatever updateMany / cascade did.
    await get().load();
    return { affected: r.affected };
  },
}));
