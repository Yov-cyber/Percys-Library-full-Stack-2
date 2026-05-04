import { create } from "zustand";
import { api, type SettingsDto } from "../lib/api";

const CACHE_KEY = "pl_settings_snapshot_v1";

function readCachedSettings(): SettingsDto | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as SettingsDto) : null;
  } catch {
    return null;
  }
}

function cacheSettings(settings: SettingsDto) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(settings));
  } catch {
    // ignore storage quota/private mode failures
  }
}

interface SettingsState {
  settings: SettingsDto | null;
  /** Last error from a load() call, surfaced to the UI so we don't get
   *  stuck on a blank loading screen forever when the server is down. */
  error: string | null;
  load: () => Promise<void>;
  update: (patch: Partial<SettingsDto>) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: readCachedSettings(),
  error: null,
  async load() {
    try {
      const settings = await api.settings();
      cacheSettings(settings);
      set({ settings, error: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo cargar la configuración";
      set({ error: message });
      // Don't blow away cached settings if a refresh fails — the user
      // can keep navigating with their last-known good values.
    }
  },
  async update(patch) {
    const current = get().settings;
    // Optimistic update for snappy UI; if the server rejects we'll roll
    // back to the server's authoritative response below.
    if (current) set({ settings: { ...current, ...patch } });
    try {
      const updated = await api.updateSettings(patch);
      cacheSettings(updated);
      set({ settings: updated, error: null });
    } catch (err) {
      // Roll back the optimistic patch and re-fetch to recover canonical state.
      if (current) {
        cacheSettings(current);
        set({ settings: current });
      }
      const message = err instanceof Error ? err.message : "No se pudieron guardar los cambios";
      set({ error: message });
      throw err;
    }
  },
}));
