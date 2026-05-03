import { useEffect } from "react";
import { useSettingsStore } from "../stores/settings";
import { getTheme, type ThemePreset } from "../lib/themes";

/**
 * Applies the active theme + accent colour to the document root.
 *
 * Strategy:
 *  - The catalog (lib/themes.ts) has every preset with concrete colours.
 *  - On change we set CSS variables on <html> so any consumer that reads
 *    `var(--pl-*)` reflects the live palette.
 *  - We also inject a <style id="pl-theme-runtime"> that overrides the
 *    few hard-coded Tailwind ink-* utility classes the app uses for
 *    surfaces. Generating this at runtime means we get 50+ themes
 *    without writing 50 selector blocks in styles.css.
 *  - Accent is still customisable independently of the theme so users
 *    keep the existing per-user accent colour.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const settings = useSettingsStore((s) => s.settings);

  useEffect(() => {
    const themeId = settings?.theme ?? "dark";
    let customThemes: ThemePreset[] = [];
    try {
      customThemes = JSON.parse(settings?.customThemes || "[]");
    } catch (error) {
      console.warn("No se pudieron leer los temas personalizados", error);
    }
    
    let theme = customThemes.find(t => t.id === themeId);
    if (!theme) {
      theme = getTheme(themeId);
    }
    
    const accent = settings?.accentColor ?? theme.accent;
    applyTheme(theme, accent);
  }, [settings?.theme, settings?.accentColor, settings?.customThemes]);

  // ---------------------------------------------------------------
  // Animation toggles. Drive every animation knob through HTML data
  // attributes on <html> so styles.css can target them with simple
  // attribute selectors (no JS-dependent class state).
  // ---------------------------------------------------------------
  useEffect(() => {
    const root = document.documentElement;
    const animOn = settings?.animationsEnabled ?? true;
    root.setAttribute("data-anim", animOn ? "1" : "0");
    root.setAttribute(
      "data-reduce-motion",
      settings?.reduceMotion ? "1" : "0",
    );
    root.setAttribute(
      "data-anim-page",
      animOn && (settings?.animPageTransitions ?? true) ? "1" : "0",
    );
    root.setAttribute(
      "data-anim-hover",
      animOn && (settings?.animHoverParallax ?? true) ? "1" : "0",
    );
    root.setAttribute(
      "data-anim-hud",
      animOn && (settings?.animHudFades ?? true) ? "1" : "0",
    );
    root.setAttribute(
      "data-anim-micro",
      animOn && (settings?.animMicroInteractions ?? true) ? "1" : "0",
    );
    root.setAttribute(
      "data-anim-shimmer",
      animOn && (settings?.animBrandShimmer ?? true) ? "1" : "0",
    );
    const intensity = Math.max(0, Math.min(100, settings?.animIntensity ?? 100));
    root.style.setProperty("--pl-anim-scale", String(intensity / 100));
    const fontScale = Math.max(80, Math.min(130, settings?.fontScale ?? 100));
    root.style.setProperty("font-size", `${fontScale}%`);
  }, [
    settings?.animationsEnabled,
    settings?.animPageTransitions,
    settings?.animHoverParallax,
    settings?.animHudFades,
    settings?.animMicroInteractions,
    settings?.animBrandShimmer,
    settings?.animIntensity,
    settings?.reduceMotion,
    settings?.fontScale,
  ]);

  // ---------------------------------------------------------------
  // Custom CSS sandbox. We replace the contents of a single dedicated
  // <style> tag rather than appending so successive edits don't
  // accumulate dead rules. The tag lives at the end of <head> so it
  // wins specificity ties without resorting to !important.
  // ---------------------------------------------------------------
  useEffect(() => {
    const css = (settings?.customCss ?? "").slice(0, 20_000);
    let style = document.getElementById("pl-custom-css") as HTMLStyleElement | null;
    if (!css.trim()) {
      style?.remove();
      return;
    }
    if (!style) {
      style = document.createElement("style");
      style.id = "pl-custom-css";
      document.head.appendChild(style);
    }
    style.textContent = css;
  }, [settings?.customCss]);

  // ---------------------------------------------------------------
  // Background image with adjustable dim overlay. Uses a fixed-position
  // pseudo layer so the image stays put while content scrolls.
  // ---------------------------------------------------------------
  useEffect(() => {
    const url = settings?.backgroundImage;
    const dim = Math.max(0, Math.min(100, settings?.backgroundDim ?? 60));
    const root = document.documentElement;
    if (!url) {
      root.style.setProperty("--pl-bg-image", "none");
      root.style.setProperty("--pl-bg-dim", "0");
      root.removeAttribute("data-bg-image");
      return;
    }
    root.style.setProperty("--pl-bg-image", `url(${JSON.stringify(url)})`);
    root.style.setProperty("--pl-bg-dim", String(dim / 100));
    root.setAttribute("data-bg-image", "1");
  }, [settings?.backgroundImage, settings?.backgroundDim]);

  return <>{children}</>;
}

function applyTheme(theme: ThemePreset, accent: string) {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme.id);
  root.setAttribute("data-theme-dark", theme.dark ? "1" : "0");
  root.style.setProperty("color-scheme", theme.dark ? "dark" : "light");

  // Surface tokens
  root.style.setProperty("--pl-bg", theme.bg);
  root.style.setProperty("--pl-fg", theme.fg);
  root.style.setProperty("--pl-surface-1", theme.surface1);
  root.style.setProperty("--pl-surface-2", theme.surface2);
  root.style.setProperty("--pl-surface-3", theme.surface3);
  root.style.setProperty("--pl-text-1", theme.text1);
  root.style.setProperty("--pl-text-2", theme.text2);
  root.style.setProperty("--pl-text-3", theme.text3);
  root.style.setProperty("--pl-border", theme.border);
  root.style.setProperty("--pl-reader-bg", theme.readerBg);

  // Accent tokens (kept compatible with previous shape)
  const hover = shade(accent, theme.dark ? -8 : 8);
  root.style.setProperty("--pl-accent", accent);
  root.style.setProperty("--pl-accent-hover", hover);
  root.style.setProperty("--pl-accent-rgb", hexToRgbChannels(accent));
  root.style.setProperty("--pl-accent-hover-rgb", hexToRgbChannels(hover));

  // Generate runtime overrides so existing Tailwind ink-* classes
  // adopt the active palette. Order: appended to <head> so it wins over
  // the bundled stylesheet without needing !important.
  let style = document.getElementById("pl-theme-runtime") as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = "pl-theme-runtime";
    document.head.appendChild(style);
  }
  const b = theme;
  style.textContent = `
    body { background: ${b.bg}; color: ${b.fg}; }
    .reader-shell { background: ${b.readerBg}; }
    .bg-ink-900 { background-color: ${b.bg}; }
    .bg-ink-800 { background-color: ${b.surface1}; }
    .bg-ink-800\\/70 { background-color: ${rgba(b.surface1, 0.7)}; }
    .bg-ink-800\\/95 { background-color: ${rgba(b.surface1, 0.95)}; }
    .bg-ink-700 { background-color: ${b.surface2}; }
    .bg-ink-700\\/70 { background-color: ${rgba(b.surface2, 0.7)}; }
    .bg-ink-700\\/60 { background-color: ${rgba(b.surface2, 0.6)}; }
    .bg-ink-700\\/40 { background-color: ${rgba(b.surface2, 0.4)}; }
    .bg-ink-600 { background-color: ${b.surface3}; }
    .hover\\:bg-ink-700:hover { background-color: ${b.surface2}; }
    .hover\\:bg-ink-600:hover { background-color: ${b.surface3}; }
    .text-ink-50 { color: ${b.fg}; }
    .text-ink-100 { color: ${b.fg}; }
    .text-ink-200 { color: ${b.text1}; }
    .text-ink-300 { color: ${b.text2}; }
    .text-ink-400 { color: ${b.text3}; }
    .text-ink-500 { color: ${b.text3}; }
    .placeholder\\:text-ink-400::placeholder { color: ${b.text3}; }
    .border-ink-700 { border-color: ${b.border}; }
    .border-ink-700\\/60 { border-color: ${rgba(b.border, 0.6)}; }
    .border-ink-700\\/40 { border-color: ${rgba(b.border, 0.4)}; }
    .ring-ink-700 { --tw-ring-color: ${b.border}; }
    .ring-ink-700\\/60 { --tw-ring-color: ${rgba(b.border, 0.6)}; }
    ::-webkit-scrollbar-thumb { background: ${rgba(b.fg, 0.12)}; }
    ::-webkit-scrollbar-thumb:hover { background: ${rgba(b.fg, 0.24)}; }
    
    .text-blue-500 { color: var(--pl-accent); }
    .text-blue-400 { color: var(--pl-accent-hover); }
    .bg-blue-600 { background-color: var(--pl-accent); }
    .bg-blue-500 { background-color: var(--pl-accent-hover); }
    
    .bg-blue-600\\/5 { background-color: rgba(var(--pl-accent-rgb) / 0.05); }
    .bg-blue-600\\/10 { background-color: rgba(var(--pl-accent-rgb) / 0.1); }
    .bg-blue-600\\/20 { background-color: rgba(var(--pl-accent-rgb) / 0.2); }
    .bg-blue-500\\/10 { background-color: rgba(var(--pl-accent-rgb) / 0.1); }
    .bg-blue-500\\/20 { background-color: rgba(var(--pl-accent-rgb) / 0.2); }
    
    .border-blue-500\\/10 { border-color: rgba(var(--pl-accent-rgb) / 0.1); }
    .border-blue-500\\/20 { border-color: rgba(var(--pl-accent-rgb) / 0.2); }
    .border-blue-500\\/30 { border-color: rgba(var(--pl-accent-rgb) / 0.3); }
    .border-blue-500\\/40 { border-color: rgba(var(--pl-accent-rgb) / 0.4); }
    .border-blue-500\\/50 { border-color: rgba(var(--pl-accent-rgb) / 0.5); }
    
    .shadow-blue-500\\/5 { --tw-shadow-color: rgba(var(--pl-accent-rgb) / 0.05); --tw-shadow: var(--tw-shadow-colored); }
    .shadow-blue-600\\/5 { --tw-shadow-color: rgba(var(--pl-accent-rgb) / 0.05); --tw-shadow: var(--tw-shadow-colored); }
    .shadow-blue-500\\/10 { --tw-shadow-color: rgba(var(--pl-accent-rgb) / 0.1); --tw-shadow: var(--tw-shadow-colored); }
    .shadow-blue-500\\/20 { --tw-shadow-color: rgba(var(--pl-accent-rgb) / 0.2); --tw-shadow: var(--tw-shadow-colored); }
    .shadow-blue-600\\/20 { --tw-shadow-color: rgba(var(--pl-accent-rgb) / 0.2); --tw-shadow: var(--tw-shadow-colored); }
    
    .ring-blue-500 { --tw-ring-color: var(--pl-accent); }
    .ring-blue-500\\/40 { --tw-ring-color: rgba(var(--pl-accent-rgb) / 0.4); }
    .accent-blue-500 { accent-color: var(--pl-accent); }
    
    .focus\\:border-blue-500\\/50:focus { border-color: rgba(var(--pl-accent-rgb) / 0.5); }
    .group-focus-within\\:text-blue-400:focus-within { color: var(--pl-accent-hover); }
    .hover\\:text-blue-400:hover { color: var(--pl-accent-hover); }
    .hover\\:border-blue-500\\/30:hover { border-color: rgba(var(--pl-accent-rgb) / 0.3); }
    .hover\\:bg-blue-600\\/5:hover { background-color: rgba(var(--pl-accent-rgb) / 0.05); }
    
    .group-hover\\:ring-blue-500\\/40:hover { --tw-ring-color: rgba(var(--pl-accent-rgb) / 0.4); }
    .group-hover\\:shadow-blue-500\\/10:hover { --tw-shadow-color: rgba(var(--pl-accent-rgb) / 0.1); --tw-shadow: var(--tw-shadow-colored); }
    
    .from-blue-600 { --tw-gradient-from: var(--pl-accent) var(--tw-gradient-from-position); --tw-gradient-to: rgba(var(--pl-accent-rgb) / 0) var(--tw-gradient-to-position); --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to); }
    .from-blue-600\\/10 { --tw-gradient-from: rgba(var(--pl-accent-rgb) / 0.1) var(--tw-gradient-from-position); --tw-gradient-to: rgba(var(--pl-accent-rgb) / 0) var(--tw-gradient-to-position); --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to); }
    .from-blue-600\\/5 { --tw-gradient-from: rgba(var(--pl-accent-rgb) / 0.05) var(--tw-gradient-from-position); --tw-gradient-to: rgba(var(--pl-accent-rgb) / 0) var(--tw-gradient-to-position); --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to); }
    .to-blue-400 { --tw-gradient-to: var(--pl-accent-hover) var(--tw-gradient-to-position); }
    
    .text-white { color: ${b.fg} !important; }
    .text-slate-200 { color: ${b.text1} !important; }
    .text-slate-300 { color: ${b.text1} !important; }
    .text-slate-400 { color: ${b.text2} !important; }
    .text-slate-500 { color: ${b.text2} !important; }
    .text-slate-600 { color: ${b.text3} !important; }
    
    .hover\\:text-white:hover { color: ${b.fg} !important; }
    .hover\\:text-slate-200:hover { color: ${b.text1} !important; }
    .hover\\:text-slate-300:hover { color: ${b.text1} !important; }
    
    .border-white\\/5 { border-color: ${rgba(b.border, 0.4)} !important; }
    .border-white\\/10 { border-color: ${rgba(b.border, 0.8)} !important; }
    .hover\\:border-white\\/10:hover { border-color: ${rgba(b.border, 0.8)} !important; }
    .border-white\\/\\[0\\.05\\] { border-color: ${rgba(b.border, 0.4)} !important; }
    .border-white\\/\\[0\\.08\\] { border-color: ${rgba(b.border, 0.6)} !important; }
    
    .bg-white\\/5 { background-color: ${rgba(b.fg, 0.05)} !important; }
    .bg-white\\/10 { background-color: ${rgba(b.fg, 0.1)} !important; }
    .hover\\:bg-white\\/5:hover { background-color: ${rgba(b.fg, 0.08)} !important; }
    .hover\\:bg-white\\/10:hover { background-color: ${rgba(b.fg, 0.15)} !important; }
    
    .bg-white\\/\\[0\\.01\\] { background-color: ${rgba(b.fg, 0.01)} !important; }
    .bg-white\\/\\[0\\.02\\] { background-color: ${rgba(b.fg, 0.02)} !important; }
    .bg-white\\/\\[0\\.03\\] { background-color: ${rgba(b.fg, 0.03)} !important; }
    .bg-white\\/\\[0\\.05\\] { background-color: ${rgba(b.fg, 0.05)} !important; }
  `;
}

/** Convert "#rrggbb" → "r g b" for `rgb(var(--x) / <alpha>)` consumers. */
function hexToRgbChannels(hex: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return "124 92 255";
  const num = parseInt(m[1], 16);
  return `${(num >> 16) & 0xff} ${(num >> 8) & 0xff} ${num & 0xff}`;
}

/** Lighten/darken a #rrggbb hex by `pct` percentage points. */
function shade(hex: string, pct: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const num = parseInt(m[1], 16);
  let r = (num >> 16) & 0xff;
  let g = (num >> 8) & 0xff;
  let b = num & 0xff;
  const adj = Math.round((pct / 100) * 255);
  r = clampByte(r + adj);
  g = clampByte(g + adj);
  b = clampByte(b + adj);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function clampByte(n: number) {
  return Math.max(0, Math.min(255, n));
}

/** "#rrggbb" → "rgba(r,g,b,a)". Used by the runtime stylesheet for partial-opacity surfaces. */
function rgba(hex: string, alpha: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return `rgba(0,0,0,${alpha})`;
  const num = parseInt(m[1], 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  return `rgba(${r},${g},${b},${alpha})`;
}
