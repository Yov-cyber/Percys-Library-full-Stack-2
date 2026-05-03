import { create } from "zustand";
import { api, type SettingsDto } from "../lib/api";

interface SettingsState {
  settings: SettingsDto | null;
  /** Last error from a load() call, surfaced to the UI so we don't get
   *  stuck on a blank loading screen forever when the server is down. */
  error: string | null;
  load: () => Promise<void>;
  update: (patch: Partial<SettingsDto>) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: null,
  error: null,
  async load() {
    try {
      const settings = await api.settings();
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
      set({ settings: updated, error: null });
    } catch (err) {
      // Roll back the optimistic patch and re-fetch to recover canonical state.
      if (current) set({ settings: current });
      const message = err instanceof Error ? err.message : "No se pudieron guardar los cambios";
      set({ error: message });
      throw err;
    }
  },
}));
