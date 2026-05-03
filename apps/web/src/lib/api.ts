export interface ComicSummary {
  id: string;
  title: string;
  format: "cbz" | "cbr" | "pdf" | "folder";
  pageCount: number;
  currentPage: number;
  completed: boolean;
  isFavorite: boolean;
  category: string | null;
  addedAt: string;
  updatedAt: string;
  lastReadAt: string | null;
  sizeBytes: number;
  /** Last zoom factor the user applied to this comic, if any. */
  lastZoom: number | null;
}

export type ReadingMode = "scroll-v" | "paged-h" | "paged-v" | "webtoon" | "paged-h-2";
/** Theme is now a free-form string id matching one of the presets in
 *  `lib/themes.ts`. The legacy values dark/light/manga still exist so old
 *  saved settings continue to load. */
export type Theme = string;

export interface SettingsDto {
  ownerId: string;
  userName: string;
  userLastName: string | null;
  theme: Theme;
  accentColor: string; // "#rrggbb"
  avatar: string | null; // "preset:<id>" or "data:image/...;base64,..."
  coverSize: "sm" | "md" | "lg";
  readingMode: ReadingMode;
  fitMode: "fit-width" | "fit-height" | "original";
  direction: "ltr" | "rtl";
  showThumbStrip: boolean;
  autoCropMargins: boolean;
  uiHideDelayMs: number;
  autoAdvanceToNext: boolean;
  autoScrollSpeed: number; // px per second
  showTopProgress: boolean;
  libraryView: "grid" | "list";
  librarySort: "title" | "lastReadAt" | "progress" | "addedAt";
  reduceMotion: boolean;
  imageFilter: "none" | "sepia" | "night" | "high-contrast";
  libraryPath: string | null;
  /** Daily reading goal in pages. 0 = disabled. */
  dailyGoalPages: number;
  customThemes: string;
  keyboardShortcuts: string;
  hasOnboarded: boolean;
  autoApplySettings: boolean;
  animationsEnabled: boolean;
  animPageTransitions: boolean;
  animHoverParallax: boolean;
  animHudFades: boolean;
  animMicroInteractions: boolean;
  animBrandShimmer: boolean;
  animIntensity: number;
  readerPageGap: number;
  readerMaxWidth: number;
  readerSidePadding: number;
  readerPagePreload: number;
  imageQuality: "high" | "balanced" | "fast";
  customCss: string;
  backgroundImage: string | null;
  backgroundDim: number;
  fontScale: number;
  statsRange: "7d" | "30d" | "90d" | "1y" | "all";
}

export interface BookmarkDto {
  id: string;
  comicId: string;
  page: number;
  note: string | null;
  createdAt: string;
}

export interface NextComic {
  id: string;
  title: string;
  format: ComicSummary["format"];
  pageCount: number;
  currentPage: number;
  completed: boolean;
}

export interface TopComic {
  id: string;
  title: string;
  format: ComicSummary["format"];
  pageCount: number;
  currentPage: number;
  completed: boolean;
  pagesEstimated: number; // for sorting
}

export interface BreakdownEntry {
  key: string;
  count: number;
}

export interface StatsDto {
  totalComics: number;
  completedComics: number;
  inProgressComics: number;
  pagesRead: number;
  favorites: number;
  currentStreak: number;
  longestStreak: number;
  todayPages: number;
  bestDayPages: number;
  /** Calendar-day reading volume rows. */
  days: { date: string; pagesRead: number }[];
  /** Total active reading days (any pagesRead > 0). */
  totalReadingDays: number;
  /** Days active in last 7 / 30 days. */
  daysActive7: number;
  daysActive30: number;
  /** Distribution by format and category (ordered by count desc). */
  formats: BreakdownEntry[];
  categories: BreakdownEntry[];
  /** Top 5 most-read comics by progress. */
  topRead: TopComic[];
  /** "Almost there" — in-progress comics ≥ 70% complete, top 3. */
  almostDone: TopComic[];
  /** Last completed comic, if any. */
  lastCompleted: TopComic | null;
  /** Total bytes managed (BigInt → number; rough). */
  totalBytes: number;
  /** Average pages per active day. */
  averagePagesPerActiveDay: number;
}

export type BulkOp =
  | "favorite"
  | "unfavorite"
  | "markCompleted"
  | "markUnread"
  | "category"
  | "delete";

export interface AchievementDto {
  id: string;
  title: string;
  description: string;
  group:
    | "milestones"
    | "pages"
    | "streaks"
    | "favorites"
    | "library"
    | "modes"
    | "formats"
    | "categories"
    | "series"
    | "exploration"
    | "secret";
  tier: 1 | 2 | 3 | 4 | 5;
  secret: boolean;
  unlocked: boolean;
}

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  try {
    const r = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", "x-owner-id": getOwnerId(), ...(init?.headers ?? {}) },
    });
    if (!r.ok) {
      const body = (await r.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error ?? `${r.status} ${r.statusText}`);
    }
    return r.json() as Promise<T>;
  } catch (err) {
    if (err instanceof TypeError && err.message === "Failed to fetch") {
      throw new Error("No se pudo conectar con el servidor. ¿Está encendido?");
    }
    throw err;
  }
}

export const api = {
  library: () => jsonFetch<ComicSummary[]>("/api/library"),
  scan: () => jsonFetch<{ added: number; removed: number; total: number }>("/api/library/scan", { method: "POST" }),
  // Upload uses multipart/form-data (not JSON) so we hit fetch directly
  // instead of going through jsonFetch which forces a JSON content-type.
  uploadComics: async (files: File[]) => {
    try {
      const fd = new FormData();
      for (const f of files) fd.append("files", f, f.name);
      const r = await fetch("/api/library/upload", { method: "POST", body: fd, headers: { "x-owner-id": getOwnerId() } });
      if (!r.ok) {
        const body = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `${r.status} ${r.statusText}`);
      }
      return r.json() as Promise<{
        uploaded: { name: string; size: number }[];
        skipped: { name: string; reason: "already-exists" | "duplicated-in-batch" }[];
        added: number;
        removed: number;
        total: number;
      }>;
    } catch (err) {
      if (err instanceof TypeError && err.message === "Failed to fetch") {
        throw new Error("No se pudo conectar con el servidor. ¿Está encendido?");
      }
      throw err;
    }
  },
  comic: (id: string) => jsonFetch<ComicSummary>(`/api/comics/${id}`),
  nextComic: (id: string) => jsonFetch<{ next: NextComic | null }>(`/api/comics/${id}/next`),
  setProgress: (id: string, page: number, completed?: boolean) =>
    jsonFetch<{ ok: boolean; completed: boolean }>(`/api/comics/${id}/progress`, {
      method: "POST",
      body: JSON.stringify({ page, completed }),
    }),
  // Dedicated zoom endpoint: does not touch lastReadAt, currentPage,
  // completed, or the reading-day counter. Safe to call repeatedly while
  // the user is pinching/wheel-zooming.
  setZoom: (id: string, zoom: number) =>
    jsonFetch<{ ok: boolean }>(`/api/comics/${id}/zoom`, {
      method: "PATCH",
      body: JSON.stringify({ zoom }),
    }),
  setFavorite: (id: string, favorite: boolean) =>
    jsonFetch<{ ok: boolean }>(`/api/comics/${id}/favorite`, {
      method: "POST",
      body: JSON.stringify({ favorite }),
    }),
  setCategory: (id: string, category: string | null) =>
    jsonFetch<{ ok: boolean }>(`/api/comics/${id}/category`, {
      method: "POST",
      body: JSON.stringify({ category }),
    }),
  bulk: (ids: string[], op: BulkOp, category?: string | null) =>
    jsonFetch<{ ok: boolean; affected: number }>(`/api/comics/bulk`, {
      method: "POST",
      body: JSON.stringify({ ids, op, ...(op === "category" ? { category } : {}) }),
    }),
  settings: () => jsonFetch<SettingsDto>("/api/settings"),
  updateSettings: (patch: Partial<SettingsDto>) =>
    jsonFetch<SettingsDto>("/api/settings", { method: "PUT", body: JSON.stringify(patch) }),
  resetProfile: () => jsonFetch<{ ok: boolean }>("/api/settings/reset-profile", { method: "POST" }),
  resetDefaults: () => jsonFetch<SettingsDto>("/api/settings/reset-defaults", { method: "POST" }),
  stats: () => jsonFetch<StatsDto>("/api/stats"),
  achievements: () => jsonFetch<AchievementDto[]>("/api/achievements"),

  bookmarks: (id: string) => jsonFetch<{ items: BookmarkDto[] }>(`/api/comics/${id}/bookmarks`),
  addBookmark: (id: string, page: number, note?: string) =>
    jsonFetch<{ bookmark: BookmarkDto }>(`/api/comics/${id}/bookmarks`, {
      method: "POST",
      body: JSON.stringify({ page, note }),
    }),
  deleteBookmark: (bid: string) =>
    jsonFetch<{ ok: boolean }>(`/api/bookmarks/${bid}`, { method: "DELETE" }),

  coverUrl: (id: string) => `/api/comics/${id}/cover`,
  pageUrl: (
    id: string,
    n: number,
    autoCrop = false,
    quality?: "high" | "balanced" | "fast",
  ) => {
    const base = `/api/comics/${id}/pages/${n}?crop=${autoCrop ? 1 : 0}`;
    return quality ? `${base}&q=${quality}` : base;
  },
  thumbUrl: (id: string, n: number) => `/api/comics/${id}/thumbs/${n}`,
};
import { getOwnerId } from "./owner";
