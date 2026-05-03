import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useSettingsStore } from "../stores/settings";
import clsx from "clsx";
import { useToasts } from "../stores/toasts";
import type { SettingsDto } from "../lib/api";
import { Avatar, AvatarPresetGrid } from "../components/AvatarPresets";
import { ThemePicker } from "../components/ThemePicker";
import { THEMES, type ThemePreset } from "../lib/themes";
import {
  DEFAULT_SHORTCUTS,
  formatShortcutKey,
  normalizeShortcutKey,
  parseShortcutMap,
  type ShortcutAction,
  type ShortcutMap,
} from "../lib/shortcuts";
import { api } from "../lib/api";

const ACCENT_PALETTE = [
  "#7c5cff",
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#22d3ee",
  "#84cc16",
];

const SECTIONS: { id: string; label: string; hint: string; icon: string }[] = [
  { id: "profile", label: "Perfil", hint: "Avatar, nombre y bienvenida", icon: "👤" },
  { id: "appearance", label: "Apariencia", hint: "Tema, acento y tipografía", icon: "🎨" },
  { id: "animations", label: "Animaciones", hint: "Movimiento y transiciones", icon: "✨" },
  { id: "library", label: "Biblioteca", hint: "Vista, orden y portadas", icon: "📚" },
  { id: "reading", label: "Lectura", hint: "Modo, ajuste y comportamientos", icon: "📖" },
  { id: "performance", label: "Rendimiento", hint: "Calidad y precarga del lector", icon: "⚡" },
  { id: "advanced", label: "Avanzado", hint: "Fondo, CSS y datos", icon: "🛠️" },
  { id: "shortcuts", label: "Atajos", hint: "Reasignar teclas del lector", icon: "⌨️" },
];
const SECTION_IDS = SECTIONS.map((s) => s.id);

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  });
}

export function Settings() {
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  const push = useToasts((s) => s.push);
  const location = useLocation();
  const navigate = useNavigate();

  const activeSection = useMemo(() => {
    const section = location.pathname.split("/")[2] || "profile";
    return SECTION_IDS.includes(section) ? section : "profile";
  }, [location.pathname]);

  const [isCreatingTheme, setIsCreatingTheme] = useState(false);
  const [newThemeName, setNewThemeName] = useState("");
  const [newThemeDraft, setNewThemeDraft] = useState<ThemePreset | null>(null);
  const [pendingPatch, setPendingPatch] = useState<Partial<SettingsDto>>({});
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [wipeConfirmOpen, setWipeConfirmOpen] = useState(false);
  const settingsView = useMemo(
    () => ({ ...settings, ...pendingPatch } as SettingsDto),
    [settings, pendingPatch],
  );
  const shortcutMap = useMemo(
    () => parseShortcutMap(settingsView?.keyboardShortcuts),
    [settingsView?.keyboardShortcuts],
  );

  const customThemesList: ThemePreset[] = useMemo(() => {
    try {
      return JSON.parse(settingsView.customThemes || "[]");
    } catch (error) {
      console.warn("No se pudieron leer los temas personalizados", error);
      return [];
    }
  }, [settingsView.customThemes]);
  const activeCustomTheme = customThemesList.find((t) => t.id === settingsView.theme);

  const baseTheme =
    activeCustomTheme || THEMES.find((t) => t.id === settingsView.theme) || THEMES[0];

  useEffect(() => {
    if (location.pathname === "/settings") {
      navigate("/settings/profile", { replace: true });
    }
  }, [location.pathname, navigate]);

  useEffect(() => {
    if (!isCreatingTheme || !settings) return;
    setNewThemeDraft((prev) => prev ?? { ...baseTheme });
  }, [baseTheme, isCreatingTheme, settings]);

  const pendingRef = useRef({
    pending: pendingPatch,
    autoApply: settingsView.autoApplySettings,
  });
  useEffect(() => {
    pendingRef.current = {
      pending: pendingPatch,
      autoApply: settingsView.autoApplySettings,
    };
  }, [pendingPatch, settingsView.autoApplySettings]);
  useEffect(() => {
    return () => {
      const { pending, autoApply } = pendingRef.current;
      if (!autoApply && Object.keys(pending).length > 0) {
        push("Saliste sin aplicar cambios pendientes", "warn");
      }
    };
  }, [push]);

  const patch = useCallback(
    async <K extends keyof SettingsDto>(key: K, value: SettingsDto[K]) => {
      // Auto-apply mode is read from the latest settings state, not the
      // captured closure, so toggling auto/manual mid-session takes effect
      // immediately for the next change.
      if (!pendingRef.current.autoApply) {
        setPendingPatch((p) => ({ ...p, [key]: value }));
        return;
      }
      await update({ [key]: value } as Partial<SettingsDto>);
    },
    [update],
  );

  async function applyPendingChanges() {
    const patchData: Partial<SettingsDto> = { ...pendingPatch };
    if (Object.keys(patchData).length === 0) {
      push("No hay cambios pendientes", "info");
      return;
    }
    await update(patchData);
    setPendingPatch({});
    push("Cambios aplicados", "success");
  }

  function cancelPendingChanges() {
    if (Object.keys(pendingPatch).length === 0) return;
    setPendingPatch({});
    push("Cambios descartados", "warn");
  }

  if (!settings) return <div className="p-12 text-slate-500 animate-pulse">Cargando perfil...</div>;

  async function createCustomTheme() {
    const name = newThemeName.trim();
    if (!name) return;
    const id = "custom-" + Date.now();
    const source = newThemeDraft ?? baseTheme;
    const newTheme: ThemePreset = { ...source, id, name };
    const nextList = [...customThemesList, newTheme];
    await update({ customThemes: JSON.stringify(nextList), theme: id });
    setIsCreatingTheme(false);
    setNewThemeName("");
    setNewThemeDraft(null);
    push("Tema creado", "success");
  }

  async function deleteCustomTheme() {
    if (!activeCustomTheme) return;
    const nextList = customThemesList.filter((t) => t.id !== activeCustomTheme.id);
    await update({ customThemes: JSON.stringify(nextList), theme: "dark" });
    push("Tema eliminado", "success");
  }

  async function patchCustomTheme(key: keyof ThemePreset, value: string | boolean) {
    if (!activeCustomTheme) return;
    const nextList = customThemesList.map((t) =>
      t.id === activeCustomTheme.id ? { ...t, [key]: value } : t,
    );
    await update({ customThemes: JSON.stringify(nextList) });
  }
  async function patchCustomThemeBatch(nextTheme: ThemePreset) {
    if (!activeCustomTheme) return;
    const nextList = customThemesList.map((t) =>
      t.id === activeCustomTheme.id ? nextTheme : t,
    );
    await update({ customThemes: JSON.stringify(nextList) });
    push("Tema autoajustado para mejor legibilidad", "success");
  }

  function improveThemeContrast(theme: ThemePreset): ThemePreset {
    const onDark = isDark(theme.bg);
    const fg = ensureContrast(theme.fg, theme.bg, 4.5, onDark);
    const text1 = ensureContrast(theme.text1, theme.bg, 4.5, onDark);
    const text2 = ensureContrast(theme.text2, theme.bg, 3.2, onDark);
    const text3 = ensureContrast(theme.text3, theme.bg, 2.4, onDark);
    const border = ensureContrast(theme.border, theme.bg, 1.6, onDark);
    return { ...theme, fg, text1, text2, text3, border };
  }

  async function onPickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 250_000) {
      push("La imagen es demasiado grande (máx. 250KB)", "error");
      return;
    }
    try {
      const url = await fileToDataUrl(file);
      await update({ avatar: url });
      push("Avatar actualizado", "success");
    } catch {
      push("No se pudo leer la imagen", "error");
    } finally {
      e.target.value = "";
    }
  }

  async function onPickBackground(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Server caps the data URL at 1.5 MB. Base64 inflates ~33%, so the
    // raw file must stay under ~1 MB to fit. Be a bit conservative.
    if (file.size > 1_050_000) {
      push("El fondo es demasiado grande (máx. 1 MB)", "error");
      return;
    }
    try {
      const url = await fileToDataUrl(file);
      await patch("backgroundImage", url);
      push("Fondo actualizado", "success");
    } catch {
      push("No se pudo leer la imagen", "error");
    } finally {
      e.target.value = "";
    }
  }

  async function patchShortcut(action: ShortcutAction, key: string) {
    const next: ShortcutMap = { ...shortcutMap, [action]: normalizeShortcutKey(key) };
    await patch("keyboardShortcuts", JSON.stringify(next));
  }

  async function resetShortcuts() {
    await patch("keyboardShortcuts", JSON.stringify(DEFAULT_SHORTCUTS));
  }

  async function resetDefaults() {
    await api.resetDefaults();
    await update({});
    setPendingPatch({});
    setResetConfirmOpen(false);
    push("Configuración restablecida", "success");
  }

  const pendingCount = Object.keys(pendingPatch).length;
  const manualMode = !settingsView.autoApplySettings;

  return (
    <div className="flex-1 overflow-y-auto px-4 md:px-8 py-10 pl-gradient-bg">
      <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
        <header className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-6 md:p-8 shadow-2xl shadow-black/20">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl space-y-3">
              <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-slate-300">
                Centro de control
              </span>
              <div>
                <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white">
                  Configuración
                </h1>
                <p className="mt-3 max-w-2xl text-slate-400 font-medium leading-relaxed">
                  Tu perfil, tu lector y tu biblioteca — cada cosa con su propia sección y su
                  propio tiempo de aplicación.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 min-w-[min(100%,34rem)]">
              <SummaryCard
                label="Perfil"
                value={settingsView.userName || "Lector"}
                hint={settingsView.userLastName ? `${settingsView.userLastName}` : "Sin apellido"}
              />
              <SummaryCard
                label="Tema"
                value={settingsView.theme}
                hint={settingsView.autoApplySettings ? "Modo automático" : "Modo manual"}
              />
              <SummaryCard
                label="Lector"
                value={settingsView.readingMode}
                hint={`${settingsView.imageQuality} · ${settingsView.uiHideDelayMs}ms`}
              />
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 rounded-2xl border border-white/10 bg-black/30 p-4">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.25em] text-slate-400">
                Modo de guardado
              </div>
              <p className="mt-1 text-sm text-slate-300">
                {settingsView.autoApplySettings
                  ? "Automático — cada cambio se guarda al instante."
                  : "Manual — confirma con Aplicar / Cancelar dentro de cada sección."}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => void patch("autoApplySettings", true)}
                className={clsx(
                  "px-4 py-2 rounded-xl text-xs font-black transition-all",
                  settingsView.autoApplySettings
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                    : "bg-white/[0.05] text-slate-400 hover:bg-white/[0.1] hover:text-white",
                )}
              >
                Automático
              </button>
              <button
                onClick={() => void patch("autoApplySettings", false)}
                className={clsx(
                  "px-4 py-2 rounded-xl text-xs font-black transition-all",
                  !settingsView.autoApplySettings
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                    : "bg-white/[0.05] text-slate-400 hover:bg-white/[0.1] hover:text-white",
                )}
              >
                Manual
              </button>
            </div>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <aside className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-4 lg:sticky lg:top-6 h-fit">
            <div className="mb-4 px-2">
              <div className="text-[11px] font-black uppercase tracking-[0.25em] text-slate-500">
                Secciones
              </div>
            </div>
            <nav className="grid gap-2">
              {SECTIONS.map(({ id, label, hint, icon }) => (
                <NavLink
                  key={id}
                  to={`/settings/${id}`}
                  className={({ isActive }) =>
                    clsx(
                      "rounded-2xl border px-4 py-3 text-left transition-all flex items-center gap-3",
                      isActive
                        ? "border-blue-500/30 bg-blue-600/10 text-white shadow-lg shadow-blue-500/10"
                        : "border-white/5 bg-white/[0.02] text-slate-400 hover:border-white/10 hover:bg-white/[0.04] hover:text-slate-200",
                    )
                  }
                >
                  <span className="text-lg" aria-hidden>
                    {icon}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-bold">{label}</div>
                    <div className="text-[10px] text-slate-500 truncate">{hint}</div>
                  </div>
                </NavLink>
              ))}
            </nav>
            <div className="mt-4 rounded-2xl border border-white/5 bg-black/20 p-4 space-y-2">
              <div className="text-xs font-bold text-slate-300">¿Reiniciar todo?</div>
              <p className="text-[11px] leading-relaxed text-slate-500">
                Restaura los valores por defecto. Tu biblioteca y progresos se conservan.
              </p>
              <button
                onClick={() => setResetConfirmOpen(true)}
                className="pl-btn text-xs w-full justify-center"
              >
                Restablecer
              </button>
            </div>
          </aside>

          <main className="space-y-8">
            {/* PROFILE ----------------------------------------------------------------- */}
            <Section id="profile" active={activeSection} title="Perfil de Usuario" icon="👤">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <Field label="Avatar de usuario">
                  <div className="flex items-start gap-6">
                    <Avatar
                      value={settingsView.avatar}
                      size={80}
                      className="rounded-2xl shadow-2xl border border-white/10"
                      fallbackText={`${settingsView.userName?.[0] ?? ""}${settingsView.userLastName?.[0] ?? ""}`}
                    />
                    <div className="flex-1 space-y-4">
                      <AvatarPresetGrid
                        value={settingsView.avatar}
                        onChange={(v) => patch("avatar", v)}
                      />
                      <div className="flex items-center gap-4">
                        <label className="pl-btn !bg-white/5 border border-white/10 cursor-pointer text-xs font-bold hover:!bg-white/10">
                          Subir personalizado
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/svg+xml"
                            className="hidden"
                            onChange={onPickAvatar}
                          />
                        </label>
                        {settingsView.avatar && (
                          <button
                            onClick={() => patch("avatar", null)}
                            className="text-xs font-bold text-slate-500 hover:text-red-400 transition-colors"
                          >
                            Eliminar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </Field>

                <Field label="Nombre para mostrar">
                  <input
                    value={settingsView.userName ?? ""}
                    onChange={(e) => void patch("userName", e.target.value)}
                    placeholder="¿Cómo te llamas?"
                    maxLength={40}
                    className="w-full rounded-xl bg-white/[0.03] border border-white/10 px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-all shadow-inner"
                  />
                </Field>

                <Field label="Apellido (opcional)">
                  <input
                    value={settingsView.userLastName ?? ""}
                    onChange={(e) => void patch("userLastName", e.target.value || null)}
                    placeholder="Tu apellido"
                    maxLength={40}
                    className="w-full rounded-xl bg-white/[0.03] border border-white/10 px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-all shadow-inner"
                  />
                </Field>

                <Field label="Pantalla de bienvenida">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={async () => {
                        await update({ hasOnboarded: false });
                        push("Te llevaremos a la bienvenida en un momento", "info");
                        setTimeout(() => navigate("/welcome", { replace: true }), 250);
                      }}
                      className="pl-btn text-xs"
                    >
                      Volver a verla
                    </button>
                    <span className="text-xs text-slate-500">
                      Vuelve a abrir la bienvenida sin perder tu biblioteca.
                    </span>
                  </div>
                </Field>
              </div>
              {manualMode && (
                <SectionActions
                  pendingCount={pendingCount}
                  onApply={() => void applyPendingChanges()}
                  onCancel={cancelPendingChanges}
                />
              )}
            </Section>

            {/* APPEARANCE -------------------------------------------------------------- */}
            <Section
              id="appearance"
              active={activeSection}
              title="Apariencia y Estilo"
              icon="🎨"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Field label="Tema de la interfaz">
                  <ThemePicker
                    value={settingsView.theme}
                    onChange={(v) => patch("theme", v)}
                  />
                </Field>

                <Field label="Color de acento">
                  <div className="flex flex-wrap items-center gap-3">
                    {ACCENT_PALETTE.map((c) => (
                      <button
                        key={c}
                        onClick={() => patch("accentColor", c)}
                        className={clsx(
                          "h-8 w-8 rounded-xl ring-2 ring-offset-4 ring-offset-black transition-all transform hover:scale-110",
                          settingsView.accentColor.toLowerCase() === c.toLowerCase()
                            ? "ring-white"
                            : "ring-transparent",
                        )}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                    <label className="ml-2 inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-300 cursor-pointer">
                      Custom
                      <input
                        type="color"
                        value={settingsView.accentColor}
                        onChange={(e) => patch("accentColor", e.target.value.toLowerCase())}
                        className="h-8 w-10 cursor-pointer rounded-lg border border-white/10 bg-transparent p-0"
                      />
                    </label>
                  </div>
                </Field>

                <Field label={`Tamaño de fuente: ${settingsView.fontScale}%`}>
                  <input
                    type="range"
                    min={80}
                    max={130}
                    step={5}
                    value={settingsView.fontScale}
                    onChange={(e) => patch("fontScale", parseInt(e.target.value, 10))}
                    className="w-full accent-blue-500"
                  />
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                    Escala global · 80–130%
                  </p>
                </Field>

                <Field label="Filtro de imagen del lector">
                  <Group
                    value={settingsView.imageFilter}
                    onChange={(v) =>
                      patch("imageFilter", v as SettingsDto["imageFilter"])
                    }
                    options={[
                      ["none", "Ninguno"],
                      ["sepia", "Sepia"],
                      ["night", "Noche"],
                      ["high-contrast", "Alto contraste"],
                    ]}
                  />
                </Field>

                <div className="col-span-1 md:col-span-2 pt-2 flex flex-col gap-3">
                  {isCreatingTheme ? (
                    <div className="space-y-4 rounded-2xl bg-white/[0.02] border border-white/5 p-4">
                      <div className="flex flex-wrap gap-2">
                        <input
                          value={newThemeName}
                          onChange={(e) => setNewThemeName(e.target.value)}
                          placeholder="Nombre del nuevo tema..."
                          autoFocus
                          className="flex-1 rounded-xl bg-white/[0.03] border border-white/10 px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") createCustomTheme();
                            if (e.key === "Escape") {
                              setIsCreatingTheme(false);
                              setNewThemeDraft(null);
                            }
                          }}
                        />
                        <button
                          onClick={() => createCustomTheme()}
                          className="pl-btn-primary px-4 py-2"
                        >
                          Guardar
                        </button>
                        <button
                          onClick={() => {
                            setIsCreatingTheme(false);
                            setNewThemeDraft(null);
                          }}
                          className="pl-btn px-4 py-2"
                        >
                          Cancelar
                        </button>
                      </div>
                      {newThemeDraft && (
                        <div className="space-y-3">
                          <ContrastAlert
                            theme={newThemeDraft}
                            onAutoFix={() =>
                              setNewThemeDraft((prev) =>
                                prev ? improveThemeContrast(prev) : prev,
                              )
                            }
                          />
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                            <ColorField
                              label="Fondo (bg)"
                              value={newThemeDraft.bg}
                              onChange={(v) =>
                                setNewThemeDraft((prev) => (prev ? { ...prev, bg: v } : prev))
                              }
                            />
                            <ColorField
                              label="Texto (fg)"
                              value={newThemeDraft.fg}
                              onChange={(v) =>
                                setNewThemeDraft((prev) => (prev ? { ...prev, fg: v } : prev))
                              }
                            />
                            <ColorField
                              label="Superficie 1"
                              value={newThemeDraft.surface1}
                              onChange={(v) =>
                                setNewThemeDraft((prev) =>
                                  prev ? { ...prev, surface1: v } : prev,
                                )
                              }
                            />
                            <ColorField
                              label="Superficie 2"
                              value={newThemeDraft.surface2}
                              onChange={(v) =>
                                setNewThemeDraft((prev) =>
                                  prev ? { ...prev, surface2: v } : prev,
                                )
                              }
                            />
                            <ColorField
                              label="Superficie 3"
                              value={newThemeDraft.surface3}
                              onChange={(v) =>
                                setNewThemeDraft((prev) =>
                                  prev ? { ...prev, surface3: v } : prev,
                                )
                              }
                            />
                            <ColorField
                              label="Acento"
                              value={newThemeDraft.accent}
                              onChange={(v) =>
                                setNewThemeDraft((prev) =>
                                  prev ? { ...prev, accent: v } : prev,
                                )
                              }
                            />
                            <ColorField
                              label="Texto 1"
                              value={newThemeDraft.text1}
                              onChange={(v) =>
                                setNewThemeDraft((prev) => (prev ? { ...prev, text1: v } : prev))
                              }
                            />
                            <ColorField
                              label="Texto 2"
                              value={newThemeDraft.text2}
                              onChange={(v) =>
                                setNewThemeDraft((prev) => (prev ? { ...prev, text2: v } : prev))
                              }
                            />
                            <ColorField
                              label="Texto 3"
                              value={newThemeDraft.text3}
                              onChange={(v) =>
                                setNewThemeDraft((prev) => (prev ? { ...prev, text3: v } : prev))
                              }
                            />
                            <ColorField
                              label="Bordes"
                              value={newThemeDraft.border}
                              onChange={(v) =>
                                setNewThemeDraft((prev) =>
                                  prev ? { ...prev, border: v } : prev,
                                )
                              }
                            />
                            <ColorField
                              label="Fondo Lector"
                              value={newThemeDraft.readerBg}
                              onChange={(v) =>
                                setNewThemeDraft((prev) =>
                                  prev ? { ...prev, readerBg: v } : prev,
                                )
                              }
                            />
                            <Field label="Modo Oscuro">
                              <button
                                onClick={() =>
                                  setNewThemeDraft((prev) =>
                                    prev ? { ...prev, dark: !prev.dark } : prev,
                                  )
                                }
                                className="w-full text-xs font-bold bg-white/5 py-1.5 rounded-lg hover:bg-white/10"
                              >
                                {newThemeDraft.dark ? "Sí (Oscuro)" : "No (Claro)"}
                              </button>
                            </Field>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setIsCreatingTheme(true);
                        setNewThemeDraft({ ...baseTheme });
                      }}
                      className="pl-btn text-xs w-max"
                    >
                      + Clonar como Tema Personalizado
                    </button>
                  )}
                </div>

                {activeCustomTheme && (
                  <div className="col-span-1 md:col-span-2 mt-4 p-6 rounded-2xl bg-white/[0.02] border border-white/5 space-y-6">
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <span aria-hidden>✏️</span>
                        Editar &quot;{activeCustomTheme.name}&quot;
                      </h3>
                      <button
                        onClick={deleteCustomTheme}
                        className="text-xs font-bold text-red-400 hover:text-red-300 transition-colors"
                      >
                        Eliminar Tema
                      </button>
                    </div>
                    <ContrastAlert
                      theme={activeCustomTheme}
                      onAutoFix={() =>
                        void patchCustomThemeBatch(improveThemeContrast(activeCustomTheme))
                      }
                    />
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                      <ColorField
                        label="Fondo (bg)"
                        value={activeCustomTheme.bg}
                        onChange={(v) => patchCustomTheme("bg", v)}
                      />
                      <ColorField
                        label="Texto (fg)"
                        value={activeCustomTheme.fg}
                        onChange={(v) => patchCustomTheme("fg", v)}
                      />
                      <ColorField
                        label="Superficie 1"
                        value={activeCustomTheme.surface1}
                        onChange={(v) => patchCustomTheme("surface1", v)}
                      />
                      <ColorField
                        label="Superficie 2"
                        value={activeCustomTheme.surface2}
                        onChange={(v) => patchCustomTheme("surface2", v)}
                      />
                      <ColorField
                        label="Texto 1"
                        value={activeCustomTheme.text1}
                        onChange={(v) => patchCustomTheme("text1", v)}
                      />
                      <ColorField
                        label="Texto 2"
                        value={activeCustomTheme.text2}
                        onChange={(v) => patchCustomTheme("text2", v)}
                      />
                      <ColorField
                        label="Texto 3"
                        value={activeCustomTheme.text3}
                        onChange={(v) => patchCustomTheme("text3", v)}
                      />
                      <ColorField
                        label="Bordes"
                        value={activeCustomTheme.border}
                        onChange={(v) => patchCustomTheme("border", v)}
                      />
                      <ColorField
                        label="Fondo Lector"
                        value={activeCustomTheme.readerBg}
                        onChange={(v) => patchCustomTheme("readerBg", v)}
                      />
                      <Field label="Modo Oscuro">
                        <button
                          onClick={() =>
                            patchCustomTheme("dark", !activeCustomTheme.dark)
                          }
                          className="w-full text-xs font-bold bg-white/5 py-1.5 rounded-lg hover:bg-white/10"
                        >
                          {activeCustomTheme.dark ? "Sí (Oscuro)" : "No (Claro)"}
                        </button>
                      </Field>
                    </div>
                  </div>
                )}
              </div>
              {manualMode && (
                <SectionActions
                  pendingCount={pendingCount}
                  onApply={() => void applyPendingChanges()}
                  onCancel={cancelPendingChanges}
                />
              )}
            </Section>

            {/* ANIMATIONS -------------------------------------------------------------- */}
            <Section
              id="animations"
              active={activeSection}
              title="Animaciones y Movimiento"
              icon="✨"
              description="Toda la fluidez que da vida a la app, en un solo lugar. Activa, desactiva o suaviza el movimiento al gusto."
            >
              <div className="rounded-2xl border border-white/10 bg-black/20 p-5 mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                    Maestro
                  </div>
                  <div className="text-sm text-slate-300 mt-1">
                    Apaga todo el movimiento de la app con un solo interruptor.
                  </div>
                </div>
                <Toggle
                  value={settingsView.animationsEnabled}
                  onChange={(v) => patch("animationsEnabled", v)}
                  labelOn="Activadas"
                  labelOff="Desactivadas"
                />
              </div>

              <div
                className={clsx(
                  "grid grid-cols-1 md:grid-cols-2 gap-6 transition-opacity",
                  !settingsView.animationsEnabled && "opacity-40 pointer-events-none",
                )}
              >
                <ToggleRow
                  title="Transiciones de página"
                  hint="Fundido al cambiar de ruta o sección."
                  value={settingsView.animPageTransitions}
                  onChange={(v) => patch("animPageTransitions", v)}
                />
                <ToggleRow
                  title="Hover y micro-paralax"
                  hint="Inclinación y elevación al pasar el cursor en cards."
                  value={settingsView.animHoverParallax}
                  onChange={(v) => patch("animHoverParallax", v)}
                />
                <ToggleRow
                  title="HUD del lector"
                  hint="Aparición y desaparición suave de la barra del lector."
                  value={settingsView.animHudFades}
                  onChange={(v) => patch("animHudFades", v)}
                />
                <ToggleRow
                  title="Microinteracciones"
                  hint="Pequeños rebotes y resplandores al pulsar botones."
                  value={settingsView.animMicroInteractions}
                  onChange={(v) => patch("animMicroInteractions", v)}
                />
                <ToggleRow
                  title="Brillo del logo"
                  hint="Resplandor animado en el título “Percy's Library”."
                  value={settingsView.animBrandShimmer}
                  onChange={(v) => patch("animBrandShimmer", v)}
                />
                <Field label={`Intensidad: ${settingsView.animIntensity}%`}>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={settingsView.animIntensity}
                    onChange={(e) => patch("animIntensity", parseInt(e.target.value, 10))}
                    className="w-full accent-blue-500"
                  />
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                    Escala la duración de todas las animaciones (0% = casi instantáneo).
                  </p>
                </Field>
              </div>

              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <ToggleRow
                  title="Reducir movimiento"
                  hint="Respeta prefers-reduced-motion. Recomendado para sensibilidad al movimiento."
                  value={settingsView.reduceMotion}
                  onChange={(v) => patch("reduceMotion", v)}
                />
                <Field label={`Ocultar UI del lector: ${settingsView.uiHideDelayMs}ms`}>
                  <input
                    type="range"
                    min={1000}
                    max={8000}
                    step={250}
                    value={settingsView.uiHideDelayMs}
                    onChange={(e) =>
                      patch("uiHideDelayMs", parseInt(e.target.value, 10))
                    }
                    className="w-full accent-blue-500"
                  />
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                    Tiempo en milisegundos para ocultar controles del lector.
                  </p>
                </Field>
              </div>
              {manualMode && (
                <SectionActions
                  pendingCount={pendingCount}
                  onApply={() => void applyPendingChanges()}
                  onCancel={cancelPendingChanges}
                />
              )}
            </Section>

            {/* LIBRARY ----------------------------------------------------------------- */}
            <Section id="library" active={activeSection} title="Biblioteca" icon="📚">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <Field label="Vista inicial">
                  <Group
                    value={settingsView.libraryView}
                    onChange={(v) =>
                      patch("libraryView", v as SettingsDto["libraryView"])
                    }
                    options={[
                      ["grid", "Cuadrícula"],
                      ["list", "Lista"],
                    ]}
                  />
                </Field>
                <Field label="Orden de catálogo">
                  <Group
                    value={settingsView.librarySort}
                    onChange={(v) =>
                      patch("librarySort", v as SettingsDto["librarySort"])
                    }
                    options={[
                      ["lastReadAt", "Última lectura"],
                      ["progress", "Progreso"],
                      ["addedAt", "Agregado"],
                      ["title", "Título"],
                    ]}
                  />
                </Field>
                <Field label="Tamaño de portadas">
                  <Group
                    value={settingsView.coverSize}
                    onChange={(v) => patch("coverSize", v as SettingsDto["coverSize"])}
                    options={[
                      ["sm", "Mini"],
                      ["md", "Estándar"],
                      ["lg", "Grande"],
                    ]}
                  />
                </Field>

                <Field label={`Meta diaria: ${settingsView.dailyGoalPages || "off"} páginas`}>
                  <input
                    type="range"
                    min={0}
                    max={200}
                    step={5}
                    value={settingsView.dailyGoalPages}
                    onChange={(e) =>
                      patch("dailyGoalPages", parseInt(e.target.value, 10))
                    }
                    className="w-full accent-blue-500"
                  />
                </Field>
              </div>
              {manualMode && (
                <SectionActions
                  pendingCount={pendingCount}
                  onApply={() => void applyPendingChanges()}
                  onCancel={cancelPendingChanges}
                />
              )}
            </Section>

            {/* READING ----------------------------------------------------------------- */}
            <Section id="reading" active={activeSection} title="Preferencias de Lectura" icon="📖">
              <div className="grid grid-cols-1 gap-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <Field label="Modo de lectura preferido">
                    <Group
                      value={settingsView.readingMode}
                      onChange={(v) =>
                        patch("readingMode", v as SettingsDto["readingMode"])
                      }
                      options={[
                        ["scroll-v", "Scroll vertical"],
                        ["paged-h", "Paginado"],
                        ["paged-h-2", "Doble página"],
                        ["paged-v", "Vertical"],
                        ["webtoon", "Webtoon"],
                      ]}
                    />
                  </Field>
                  <Field label="Ajuste de imagen">
                    <Group
                      value={settingsView.fitMode}
                      onChange={(v) => patch("fitMode", v as SettingsDto["fitMode"])}
                      options={[
                        ["fit-width", "Ancho"],
                        ["fit-height", "Alto"],
                        ["original", "Original"],
                      ]}
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <Field label="Dirección de lectura">
                    <Group
                      value={settingsView.direction}
                      onChange={(v) => patch("direction", v as SettingsDto["direction"])}
                      options={[
                        ["ltr", "Izquierda → Derecha"],
                        ["rtl", "Derecha → Izquierda"],
                      ]}
                    />
                  </Field>
                  <Field label={`Auto-scroll: ${settingsView.autoScrollSpeed} px/s`}>
                    <input
                      type="range"
                      min={20}
                      max={300}
                      step={5}
                      value={settingsView.autoScrollSpeed}
                      onChange={(e) =>
                        patch("autoScrollSpeed", parseInt(e.target.value, 10))
                      }
                      className="w-full accent-blue-500"
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <Field label="Recorte automático">
                    <Group
                      value={String(settingsView.autoCropMargins)}
                      onChange={(v) => patch("autoCropMargins", v === "true")}
                      options={[
                        ["false", "Off"],
                        ["true", "On"],
                      ]}
                    />
                  </Field>
                  <Field label="Auto-avance">
                    <Group
                      value={String(settingsView.autoAdvanceToNext)}
                      onChange={(v) => patch("autoAdvanceToNext", v === "true")}
                      options={[
                        ["false", "Off"],
                        ["true", "On"],
                      ]}
                    />
                  </Field>
                  <Field label="Barra de progreso">
                    <Group
                      value={String(settingsView.showTopProgress)}
                      onChange={(v) => patch("showTopProgress", v === "true")}
                      options={[
                        ["true", "On"],
                        ["false", "Off"],
                      ]}
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <Field label={`Espacio entre páginas: ${settingsView.readerPageGap}px`}>
                    <input
                      type="range"
                      min={0}
                      max={48}
                      step={2}
                      value={settingsView.readerPageGap}
                      onChange={(e) =>
                        patch("readerPageGap", parseInt(e.target.value, 10))
                      }
                      className="w-full accent-blue-500"
                    />
                  </Field>
                  <Field
                    label={`Ancho máximo: ${settingsView.readerMaxWidth === 0 ? "Sin límite" : `${settingsView.readerMaxWidth}px`}`}
                  >
                    <input
                      type="range"
                      min={0}
                      max={2000}
                      step={50}
                      value={settingsView.readerMaxWidth}
                      onChange={(e) =>
                        patch("readerMaxWidth", parseInt(e.target.value, 10))
                      }
                      className="w-full accent-blue-500"
                    />
                  </Field>
                  <Field label={`Margen lateral: ${settingsView.readerSidePadding}px`}>
                    <input
                      type="range"
                      min={0}
                      max={80}
                      step={2}
                      value={settingsView.readerSidePadding}
                      onChange={(e) =>
                        patch("readerSidePadding", parseInt(e.target.value, 10))
                      }
                      className="w-full accent-blue-500"
                    />
                  </Field>
                </div>
              </div>
              {manualMode && (
                <SectionActions
                  pendingCount={pendingCount}
                  onApply={() => void applyPendingChanges()}
                  onCancel={cancelPendingChanges}
                />
              )}
            </Section>

            {/* PERFORMANCE ------------------------------------------------------------- */}
            <Section
              id="performance"
              active={activeSection}
              title="Rendimiento del lector"
              icon="⚡"
              description="Ajustes pensados para mangas, manhwas y PDFs gigantes. Bájalos si tu equipo va lento; súbelos si quieres calidad máxima."
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Field label="Calidad de imagen">
                  <Group
                    value={settingsView.imageQuality}
                    onChange={(v) =>
                      patch("imageQuality", v as SettingsDto["imageQuality"])
                    }
                    options={[
                      ["high", "Alta"],
                      ["balanced", "Equilibrada"],
                      ["fast", "Rápida"],
                    ]}
                  />
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-2">
                    Alta = original · Equilibrada = WebP 1600px · Rápida = WebP 1100px
                  </p>
                </Field>

                <Field
                  label={`Páginas precargadas: ${settingsView.readerPagePreload}`}
                >
                  <input
                    type="range"
                    min={0}
                    max={10}
                    step={1}
                    value={settingsView.readerPagePreload}
                    onChange={(e) =>
                      patch("readerPagePreload", parseInt(e.target.value, 10))
                    }
                    className="w-full accent-blue-500"
                  />
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-2">
                    Cuántas páginas alrededor de la actual decodificar por adelantado.
                  </p>
                </Field>

                <Field label="Mostrar miniaturas">
                  <Group
                    value={String(settingsView.showThumbStrip)}
                    onChange={(v) => patch("showThumbStrip", v === "true")}
                    options={[
                      ["true", "On"],
                      ["false", "Off"],
                    ]}
                  />
                </Field>
              </div>
              {manualMode && (
                <SectionActions
                  pendingCount={pendingCount}
                  onApply={() => void applyPendingChanges()}
                  onCancel={cancelPendingChanges}
                />
              )}
            </Section>

            {/* ADVANCED --------------------------------------------------------------- */}
            <Section
              id="advanced"
              active={activeSection}
              title="Personalización Avanzada"
              icon="🛠️"
              description="Para usuarios curiosos: añade tu propio CSS, usa una imagen de fondo o reinicia datos del perfil."
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Field label="Imagen de fondo">
                  <div className="space-y-3">
                    <div
                      className="aspect-video w-full rounded-2xl border border-white/10 overflow-hidden bg-black/40 grid place-items-center"
                      style={
                        settingsView.backgroundImage
                          ? {
                              backgroundImage: `url(${settingsView.backgroundImage})`,
                              backgroundSize: "cover",
                              backgroundPosition: "center",
                            }
                          : undefined
                      }
                    >
                      {!settingsView.backgroundImage && (
                        <span className="text-xs text-slate-500">
                          Sin imagen — usando degradado por defecto
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="pl-btn !bg-white/5 border border-white/10 cursor-pointer text-xs font-bold hover:!bg-white/10">
                        Subir imagen
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="hidden"
                          onChange={onPickBackground}
                        />
                      </label>
                      {settingsView.backgroundImage && (
                        <button
                          onClick={() => patch("backgroundImage", null)}
                          className="text-xs font-bold text-slate-500 hover:text-red-400 transition-colors"
                        >
                          Quitar fondo
                        </button>
                      )}
                    </div>
                  </div>
                </Field>

                <Field
                  label={`Oscurecer fondo: ${settingsView.backgroundDim}%`}
                >
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={settingsView.backgroundDim}
                    onChange={(e) =>
                      patch("backgroundDim", parseInt(e.target.value, 10))
                    }
                    className="w-full accent-blue-500"
                  />
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-2">
                    Solo aplica cuando hay imagen de fondo.
                  </p>
                </Field>

                <div className="md:col-span-2">
                  <Field label="CSS personalizado">
                    <textarea
                      value={settingsView.customCss}
                      onChange={(e) => patch("customCss", e.target.value)}
                      placeholder=":root { --pl-accent: #ff007f; }"
                      rows={6}
                      className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-xs font-mono text-white focus:outline-none focus:border-blue-500/50 transition-all"
                    />
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-2">
                      Inyectado al final de la hoja de estilos. Úsalo bajo tu responsabilidad.
                    </p>
                  </Field>
                </div>

                <Field label="Borrar todo y empezar de cero">
                  <button
                    onClick={() => setWipeConfirmOpen(true)}
                    className="rounded-xl bg-red-600/20 border border-red-500/40 text-red-300 hover:bg-red-600/30 hover:text-red-200 px-4 py-2 text-xs font-bold transition-all"
                  >
                    Borrar perfil + biblioteca + progresos
                  </button>
                  <p className="text-[10px] text-red-300/70 font-bold uppercase tracking-widest mt-2">
                    Acción irreversible. Te llevará a la pantalla de bienvenida.
                  </p>
                </Field>
              </div>
              {manualMode && (
                <SectionActions
                  pendingCount={pendingCount}
                  onApply={() => void applyPendingChanges()}
                  onCancel={cancelPendingChanges}
                />
              )}
            </Section>

            {/* SHORTCUTS --------------------------------------------------------------- */}
            <Section
              id="shortcuts"
              active={activeSection}
              title="Atajos de Teclado"
              icon="⌨️"
              description="Pulsa una tecla en el cuadro para reasignar. Las teclas de navegación pueden combinarse con las flechas o letras."
            >
              <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <ShortcutField
                    label="Siguiente página"
                    value={shortcutMap.next}
                    onCapture={(k) => void patchShortcut("next", k)}
                  />
                  <ShortcutField
                    label="Página anterior"
                    value={shortcutMap.prev}
                    onCapture={(k) => void patchShortcut("prev", k)}
                  />
                  <ShortcutField
                    label="Pantalla completa"
                    value={shortcutMap.toggleFs}
                    onCapture={(k) => void patchShortcut("toggleFs", k)}
                  />
                  <ShortcutField
                    label="Miniaturas"
                    value={shortcutMap.toggleStrip}
                    onCapture={(k) => void patchShortcut("toggleStrip", k)}
                  />
                  <ShortcutField
                    label="Marcadores"
                    value={shortcutMap.toggleBookmarks}
                    onCapture={(k) => void patchShortcut("toggleBookmarks", k)}
                  />
                  <ShortcutField
                    label="Ir a página"
                    value={shortcutMap.goto}
                    onCapture={(k) => void patchShortcut("goto", k)}
                  />
                  <ShortcutField
                    label="Ayuda"
                    value={shortcutMap.toggleHelp}
                    onCapture={(k) => void patchShortcut("toggleHelp", k)}
                  />
                  <ShortcutField
                    label="Salir lector"
                    value={shortcutMap.exit}
                    onCapture={(k) => void patchShortcut("exit", k)}
                  />
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-white/5">
                  <p className="text-xs text-slate-500">
                    Las teclas reservadas (Tab, Ctrl, Alt, Shift solas) son ignoradas.
                  </p>
                  <button onClick={() => void resetShortcuts()} className="pl-btn text-xs">
                    Restaurar por defecto
                  </button>
                </div>
              </div>
              {manualMode && (
                <SectionActions
                  pendingCount={pendingCount}
                  onApply={() => void applyPendingChanges()}
                  onCancel={cancelPendingChanges}
                />
              )}
            </Section>
          </main>
        </div>
      </div>

      {resetConfirmOpen && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-ink-900 p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white">Restablecer configuración</h3>
            <p className="mt-2 text-sm text-slate-300">
              Se restaurarán los valores por defecto de toda la configuración. Tu biblioteca y tus
              progresos se conservan.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setResetConfirmOpen(false)} className="pl-btn">
                Cancelar
              </button>
              <button
                onClick={() => void resetDefaults()}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-500"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {wipeConfirmOpen && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-red-500/30 bg-ink-900 p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-red-300">Borrar perfil y biblioteca</h3>
            <p className="mt-2 text-sm text-slate-300">
              Esta acción <strong className="text-red-300">elimina todos tus cómics, marcadores,
              días de lectura y logros</strong>, además de borrar tu nombre, avatar y
              configuración personalizada. Volverás a la pantalla de bienvenida.
            </p>
            <p className="mt-3 text-xs text-slate-400">No se puede deshacer.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setWipeConfirmOpen(false)} className="pl-btn">
                Cancelar
              </button>
              <button
                onClick={async () => {
                  try {
                    await api.resetProfile();
                    await update({});
                    setWipeConfirmOpen(false);
                    push("Perfil y biblioteca borrados", "success");
                    setTimeout(() => navigate("/welcome", { replace: true }), 250);
                  } catch {
                    push("No se pudo borrar el perfil", "error");
                  }
                }}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-500"
              >
                Sí, borrar todo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({
  id,
  active,
  title,
  icon,
  description,
  children,
}: {
  id: string;
  active: string;
  title: string;
  icon: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={clsx(
        "space-y-6 rounded-[2rem] border border-white/10 bg-white/[0.02] p-6 md:p-8 shadow-2xl shadow-black/20",
        active !== id && "hidden",
      )}
    >
      <div className="flex items-start gap-3 border-b border-white/5 pb-4">
        <span className="text-2xl" aria-hidden>
          {icon}
        </span>
        <div>
          <h2 className="text-xl font-bold text-white">{title}</h2>
          {description && (
            <p className="text-sm text-slate-400 mt-1 leading-relaxed">{description}</p>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}

function SectionActions({
  pendingCount,
  onApply,
  onCancel,
}: {
  pendingCount: number;
  onApply: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className={clsx(
        "mt-6 pt-4 border-t border-white/5 flex items-center justify-between gap-3 transition-opacity",
        pendingCount === 0 ? "opacity-50" : "opacity-100",
      )}
    >
      <div className="text-xs text-slate-300 font-bold">
        {pendingCount === 0
          ? "Sin cambios pendientes en esta sección"
          : `Cambios pendientes: ${pendingCount}`}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onCancel}
          disabled={pendingCount === 0}
          className="pl-btn text-xs disabled:opacity-40"
        >
          Cancelar
        </button>
        <button
          onClick={onApply}
          disabled={pendingCount === 0}
          className="pl-btn-primary text-xs disabled:opacity-40"
        >
          Aplicar
        </button>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4 shadow-lg shadow-black/10">
      <div className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">
        {label}
      </div>
      <div className="mt-2 text-sm font-bold text-white truncate">{value}</div>
      <div className="mt-1 text-[11px] text-slate-500">{hint}</div>
    </div>
  );
}

function ShortcutField({
  label,
  value,
  onCapture,
}: {
  label: string;
  value: string;
  onCapture: (key: string) => void;
}) {
  return (
    <label className="rounded-xl border border-white/5 bg-white/[0.01] p-3 flex items-center justify-between gap-3">
      <span className="text-xs font-semibold text-slate-300">{label}</span>
      <input
        readOnly
        value={formatShortcutKey(value)}
        onKeyDown={(e) => {
          e.preventDefault();
          if (e.key === "Tab") return;
          if (e.key === "Control" || e.key === "Alt" || e.key === "Shift" || e.key === "Meta") return;
          onCapture(e.key);
        }}
        className="w-24 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-center text-xs font-black text-white focus:outline-none focus:border-blue-500/50"
      />
    </label>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-500">
        {label}
      </div>
      <div className="bg-white/[0.01] rounded-2xl p-1">{children}</div>
    </div>
  );
}

function Group({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <div className="flex flex-wrap gap-1.5 p-1.5 rounded-2xl bg-white/[0.03] border border-white/10 shadow-inner">
      {options.map(([v, l]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={clsx(
            "flex-1 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap",
            value === v
              ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
              : "text-slate-400 hover:text-slate-200 hover:bg-white/5",
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="text-[10px] uppercase tracking-[0.1em] font-bold text-slate-500 truncate">
        {label}
      </div>
      <label className="flex items-center gap-2 cursor-pointer group bg-white/[0.02] p-1.5 rounded-xl border border-white/5 hover:bg-white/5 transition-colors">
        <div
          className="h-6 w-6 rounded border border-white/10 shadow-inner group-hover:scale-110 transition-transform"
          style={{ backgroundColor: value }}
        />
        <span className="text-xs text-slate-300 font-mono">{value}</span>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="hidden"
        />
      </label>
    </div>
  );
}

function Toggle({
  value,
  onChange,
  labelOn,
  labelOff,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  labelOn: string;
  labelOff: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className={clsx(
        "relative inline-flex h-9 w-44 items-center rounded-full border transition-all",
        value
          ? "bg-blue-600/20 border-blue-500/50"
          : "bg-white/5 border-white/10",
      )}
    >
      <span
        className={clsx(
          "absolute inset-y-1 w-1/2 rounded-full transition-transform shadow-lg",
          value
            ? "translate-x-full bg-blue-600"
            : "translate-x-0 bg-slate-600",
        )}
      />
      <span
        className={clsx(
          "relative z-10 flex-1 text-xs font-black uppercase tracking-wider transition-colors",
          !value ? "text-white" : "text-slate-500",
        )}
      >
        {labelOff}
      </span>
      <span
        className={clsx(
          "relative z-10 flex-1 text-xs font-black uppercase tracking-wider transition-colors",
          value ? "text-white" : "text-slate-500",
        )}
      >
        {labelOn}
      </span>
    </button>
  );
}

function ToggleRow({
  title,
  hint,
  value,
  onChange,
}: {
  title: string;
  hint: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/5 bg-white/[0.02] p-4">
      <div className="min-w-0">
        <div className="text-sm font-bold text-white">{title}</div>
        <div className="text-[11px] text-slate-500 mt-1 leading-relaxed">{hint}</div>
      </div>
      <button
        role="switch"
        aria-checked={value}
        aria-label={title}
        onClick={() => onChange(!value)}
        className={clsx(
          "shrink-0 relative h-7 w-14 rounded-full border transition-all",
          value ? "bg-blue-600/40 border-blue-500/60" : "bg-white/5 border-white/10",
        )}
      >
        <span
          className={clsx(
            "absolute top-0.5 left-0.5 h-6 w-6 rounded-full transition-transform shadow",
            value ? "translate-x-7 bg-blue-500" : "translate-x-0 bg-slate-500",
          )}
        />
      </button>
    </div>
  );
}

function ContrastAlert({
  theme,
  onAutoFix,
}: {
  theme: ThemePreset;
  onAutoFix: () => void;
}) {
  const base = contrastRatio(theme.fg, theme.bg);
  const secondary = contrastRatio(theme.text2, theme.bg);
  const isBad = base < 4.5 || secondary < 3;
  if (!isBad) return null;
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200 flex items-center justify-between gap-3">
      <span>
        Contraste bajo detectado (texto principal {base.toFixed(2)}:1, secundario{" "}
        {secondary.toFixed(2)}:1).
      </span>
      <button
        onClick={onAutoFix}
        className="pl-btn !px-3 !py-1.5 !text-[11px] !bg-amber-500/20 hover:!bg-amber-500/30"
      >
        Autoajustar
      </button>
    </div>
  );
}

function normalizeHex(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  return m ? `#${m[1].toLowerCase()}` : "#000000";
}

function toRgb(hex: string): [number, number, number] {
  const h = normalizeHex(hex);
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a: string, b: string): number {
  const l1 = luminance(a);
  const l2 = luminance(b);
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

function isDark(hex: string): boolean {
  return luminance(hex) < 0.35;
}

function ensureContrast(
  fg: string,
  bg: string,
  min: number,
  preferLight: boolean,
): string {
  if (contrastRatio(fg, bg) >= min) return normalizeHex(fg);
  const white = "#ffffff";
  const black = "#000000";
  const goodWhite = contrastRatio(white, bg) >= min;
  const goodBlack = contrastRatio(black, bg) >= min;
  if (preferLight && goodWhite) return white;
  if (!preferLight && goodBlack) return black;
  if (goodWhite) return white;
  if (goodBlack) return black;
  return preferLight ? white : black;
}
