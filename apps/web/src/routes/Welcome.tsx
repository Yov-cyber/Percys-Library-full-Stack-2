import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import clsx from "clsx";
import { useSettingsStore } from "../stores/settings";
import { useToasts } from "../stores/toasts";
import { Avatar, AvatarPresetGrid } from "../components/AvatarPresets";
import { THEMES } from "../lib/themes";
import type { ReadingMode, SettingsDto } from "../lib/api";
import { getDisplayName, getInitials } from "../lib/profile";

const READING_MODES: { id: ReadingMode; label: string; hint: string }[] = [
  { id: "paged-h", label: "Paginado", hint: "Una página a la vez" },
  { id: "paged-h-2", label: "Doble página", hint: "Como un libro abierto" },
  { id: "paged-v", label: "Paginado vertical", hint: "Página a página, hacia abajo" },
  { id: "scroll-v", label: "Scroll", hint: "Desplazamiento continuo" },
  { id: "webtoon", label: "Webtoon", hint: "Tira larga estilo manhwa" },
];

const ACCENT_PALETTE = [
  "#7c5cff",
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#22d3ee",
  "#84cc16",
] as const;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  });
}

type Step = 0 | 1 | 2;

export function Welcome() {
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  const load = useSettingsStore((s) => s.load);
  const push = useToasts((s) => s.push);
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [step, setStep] = useState<Step>(0);
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [themeId, setThemeId] = useState("dark");
  const [accentColor, setAccentColor] = useState<string>("#7c5cff");
  const [readingMode, setReadingMode] = useState<ReadingMode>("paged-h");
  const [direction, setDirection] = useState<"ltr" | "rtl">("ltr");
  const [coverSize, setCoverSize] = useState<"sm" | "md" | "lg">("md");
  const [saving, setSaving] = useState(false);
  const [showFirstError, setShowFirstError] = useState(false);
  const [readerPageGap, setReaderPageGap] = useState(8);
  const [readerSidePadding, setReaderSidePadding] = useState(0);

  useEffect(() => {
    if (settings?.hasOnboarded) {
      navigate("/", { replace: true });
    }
  }, [settings?.hasOnboarded, navigate]);

  const hydrated = useRef(false);
  useEffect(() => {
    if (!settings || hydrated.current) return;
    hydrated.current = true;
    setThemeId(settings.theme || "dark");
    setAccentColor(settings.accentColor || "#7c5cff");
    setReadingMode(settings.readingMode || "paged-h");
    setDirection(settings.direction || "ltr");
    setCoverSize(settings.coverSize || "md");
    if (settings.userName) setFirst(settings.userName);
    if (settings.userLastName) setLast(settings.userLastName);
    setAvatar(settings.avatar ?? null);
    setReaderPageGap(settings.readerPageGap ?? 8);
    setReaderSidePadding(settings.readerSidePadding ?? 0);
  }, [settings]);

  const chosenTheme = useMemo(
    () => THEMES.find((t) => t.id === themeId) ?? THEMES[0],
    [themeId],
  );
  const initials = getInitials(first, last);
  const previewName = getDisplayName(first, last) || "Tu nombre";

  async function finish(skip = false) {
    if (saving) return;
    setSaving(true);
    try {
      const firstName = skip ? "" : first.trim();
      const lastName = skip ? null : last.trim() || null;
      const patch: Partial<SettingsDto> = {
        userName: firstName || "Lector",
        userLastName: lastName,
        avatar,
        theme: themeId,
        accentColor,
        readingMode,
        direction,
        coverSize,
        readerPageGap,
        readerSidePadding,
        hasOnboarded: true,
      };
      await update(patch);
      await load();
      const greeting = firstName ? `Listo, ${firstName}` : "Listo";
      push(`${greeting} · Tu biblioteca te espera`, "success");
      navigate("/", { replace: true });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "No se pudo completar la bienvenida";
      push(msg, "error");
    } finally {
      setSaving(false);
    }
  }

  if (settings?.hasOnboarded) return null;

  const canAdvanceFromStep0 = first.trim().length > 0;

  return (
    <div className="welcome-shell relative h-[100dvh] w-full overflow-hidden bg-[#04050b] text-white">
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(circle at 12% 18%, rgba(124,92,255,0.28), transparent 55%), radial-gradient(circle at 92% 12%, rgba(34,211,238,0.18), transparent 55%), radial-gradient(circle at 50% 100%, rgba(236,72,153,0.18), transparent 55%)",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-40"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
        aria-hidden
      />

      <div className="flex h-full flex-col px-4 py-5 md:px-6 md:py-6 lg:px-10">
        <header className="flex shrink-0 items-center justify-between gap-3">
          <div>
            <div className="pl-brand text-xl font-black tracking-tight md:text-2xl lg:text-3xl">
              Percy&apos;s Library
            </div>
            <div className="pl-brand-sub text-[9px] font-bold uppercase tracking-[0.2em] md:text-[10px]">
              Tu archivo digital
            </div>
          </div>
          <div className="hidden items-center gap-2 text-[10px] font-semibold text-slate-400 md:flex">
            <span className={clsx("h-1.5 w-1.5 rounded-full", step >= 0 ? "bg-violet-400" : "bg-slate-700")} />
            <span className={clsx("h-1.5 w-1.5 rounded-full", step >= 1 ? "bg-violet-400" : "bg-slate-700")} />
            <span className={clsx("h-1.5 w-1.5 rounded-full", step >= 2 ? "bg-violet-400" : "bg-slate-700")} />
            <span className="ml-2 uppercase tracking-widest text-slate-500">Paso {step + 1}/3</span>
          </div>
        </header>

        <main className="flex flex-1 gap-5 overflow-hidden py-5 lg:gap-8 lg:py-6">
          <section className="hidden w-full flex-col gap-4 overflow-y-auto lg:flex lg:w-[45%]">
            <div className="space-y-3">
              <span className="inline-flex items-center rounded-full border border-violet-400/30 bg-violet-500/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-violet-200">
                Bienvenida
              </span>
              <h1 className="text-2xl font-black leading-tight md:text-3xl lg:text-4xl">
                Tu colección de cómics,
                <span className="block bg-gradient-to-r from-violet-300 via-fuchsia-200 to-cyan-200 bg-clip-text text-transparent">
                  ordenada y personal.
                </span>
              </h1>
              <p className="text-sm text-slate-300 md:text-base">
                Importa, lee y sigue tu progreso de cómics CBZ, CBR y PDF en un solo lugar.
              </p>
            </div>

            <div
              className="w-full max-w-xs rounded-[1.25rem] border border-white/10 p-3.5 shadow-xl shadow-black/40 backdrop-blur-md"
              style={{ backgroundColor: chosenTheme.surface1 }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="rounded-lg border"
                  style={{ borderColor: chosenTheme.border, backgroundColor: chosenTheme.bg }}
                >
                  <Avatar value={avatar} size={40} className="rounded-lg" fallbackText={initials} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[9px] font-black uppercase" style={{ color: chosenTheme.text2 }}>
                    Vista previa
                  </div>
                  <div className="text-lg font-black truncate" style={{ color: chosenTheme.fg }}>
                    {previewName}
                  </div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-1.5">
                {[1, 2, 3].map((n) => (
                  <div
                    key={n}
                    className="aspect-[2/3] rounded-lg border"
                    style={{
                      borderColor: chosenTheme.border,
                      background: `linear-gradient(135deg, ${accentColor}33, ${chosenTheme.surface2})`,
                    }}
                  />
                ))}
              </div>
            </div>

            <ul className="grid grid-cols-3 gap-2">
              {[
                ["Importa", "CBZ/CBR/PDF"],
                ["Lee", "5 modos"],
                ["Sigue", "Estadísticas"],
              ].map(([title, desc]) => (
                <li
                  key={title}
                  className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5 text-xs"
                >
                  <div className="text-[9px] font-bold uppercase tracking-wider text-violet-200">{title}</div>
                  <div className="text-slate-400">{desc}</div>
                </li>
              ))}
            </ul>
          </section>

          <section className="w-full overflow-y-auto lg:w-[55%]">
            <div className="mx-auto w-full max-w-md rounded-xl border border-white/10 bg-white/[0.04] p-4 shadow-xl shadow-black/30 backdrop-blur-md md:p-5">
              <div className="mb-4 flex items-center justify-between gap-2">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-wider text-violet-200">
                    {step === 0 ? "Tu perfil" : step === 1 ? "Estilo" : "Lectura"}
                  </div>
                  <h2 className="text-lg font-black md:text-xl">
                    {step === 0 ? "Cuéntanos de ti" : step === 1 ? "Elige el aspecto" : "Tu experiencia"}
                  </h2>
                </div>
                <div className="flex items-center gap-1 md:hidden">
                  {[0, 1, 2].map((n) => (
                    <span key={n} className={clsx("h-1.5 w-1.5 rounded-full", step >= n ? "bg-violet-400" : "bg-slate-700")} />
                  ))}
                </div>
              </div>

              {step === 0 && (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Nombre</span>
                      <input
                        autoFocus
                        value={first}
                        onChange={(e) => {
                          setFirst(e.target.value);
                          if (showFirstError && e.target.value.trim()) setShowFirstError(false);
                        }}
                        placeholder="¿Cómo te llamas?"
                        maxLength={40}
                        aria-invalid={showFirstError}
                        className={clsx(
                          "w-full rounded-xl border bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2",
                          showFirstError
                            ? "border-rose-400/70 focus:border-rose-400/80"
                            : "border-white/10 focus:border-violet-400/60",
                        )}
                      />
                      {showFirstError && (
                        <span className="text-[10px] font-bold text-rose-300">Se requiere un nombre</span>
                      )}
                    </label>
                    <label className="space-y-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        Apellido <span className="font-normal text-slate-600">(opc)</span>
                      </span>
                      <input
                        value={last}
                        onChange={(e) => setLast(e.target.value)}
                        placeholder="Tu apellido"
                        maxLength={40}
                        className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-violet-400/60 focus:outline-none"
                      />
                    </label>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Avatar</div>
                      <button
                        type="button"
                        className={clsx(
                          "rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wider transition-all",
                          !avatar
                            ? "border-violet-400/60 bg-violet-500/20 text-white"
                            : "border-white/10 bg-white/[0.03] text-slate-400 hover:text-white",
                        )}
                        onClick={() => setAvatar(null)}
                      >
                        Iniciales automáticas
                      </button>
                    </div>
                    <AvatarPresetGrid value={avatar} onChange={setAvatar} />
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" className="pl-btn text-xs" onClick={() => fileInputRef.current?.click()}>
                        Subir foto
                      </button>
                      {avatar && (
                        <button type="button" className="pl-btn text-xs" onClick={() => setAvatar(null)}>
                          Usar iniciales
                        </button>
                      )}
                      <span className="text-[9px] text-slate-500">
                        {initials ? `Vista: ${initials}` : "Se genera con nombre y apellido"} · PNG/JPG/WEBP · máx 250KB
                      </span>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 250_000) {
                          push("Imagen muy grande (máx 250KB)", "error");
                          e.target.value = "";
                          return;
                        }
                        try {
                          const data = await fileToDataUrl(file);
                          setAvatar(data);
                        } catch {
                          push("No se pudo leer", "error");
                        } finally {
                          e.target.value = "";
                        }
                      }}
                    />
                  </div>
                </div>
              )}

              {step === 1 && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Tema</div>
                    <div className="grid grid-cols-3 gap-2">
                      {THEMES.slice(0, 6).map((theme) => (
                        <button
                          key={theme.id}
                          type="button"
                          onClick={() => setThemeId(theme.id)}
                          className={clsx(
                            "rounded-lg border p-2 text-left transition-all",
                            themeId === theme.id ? "border-violet-400/60 ring-1 ring-violet-400/40" : "border-white/10 hover:border-white/20",
                          )}
                          style={{ backgroundColor: theme.bg }}
                        >
                          <div className="text-xs font-bold" style={{ color: theme.fg }}>{theme.name}</div>
                          <div className="mt-1.5 flex gap-1">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: theme.surface1 }} />
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: theme.accent }} />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Color</div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {ACCENT_PALETTE.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setAccentColor(color)}
                          className={clsx(
                            "h-8 w-8 rounded-lg ring-2 ring-offset-1 ring-offset-[#04050b] transition-transform hover:scale-110",
                            accentColor === color ? "ring-white" : "ring-transparent",
                          )}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                      <label className="ml-1 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-[10px] font-bold text-slate-300">
                        Custom
                        <input
                          type="color"
                          value={accentColor}
                          onChange={(e) => setAccentColor(e.target.value.toLowerCase())}
                          className="h-5 w-8 cursor-pointer rounded border border-white/10 bg-transparent"
                        />
                      </label>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Portadas</div>
                    <div className="flex flex-wrap gap-1.5">
                      {(["sm", "md", "lg"] as const).map((id) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setCoverSize(id)}
                          className={clsx("pl-btn text-[10px] px-3 py-1.5", coverSize === id && "!bg-violet-600 !text-white")}
                        >
                          {id === "sm" ? "Pequeñas" : id === "md" ? "Medianas" : "Grandes"}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Modo</div>
                    <div className="grid gap-1.5 sm:grid-cols-2">
                      {READING_MODES.map((mode) => (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() => setReadingMode(mode.id)}
                          className={clsx(
                            "rounded-lg border px-3 py-2 text-left text-xs transition-all",
                            readingMode === mode.id
                              ? "border-violet-400/60 bg-violet-500/15 text-white"
                              : "border-white/10 bg-white/[0.02] text-slate-300 hover:border-white/20",
                          )}
                        >
                          <div className="font-bold">{mode.label}</div>
                          <div className="text-[10px] text-slate-400">{mode.hint}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Dirección</div>
                    <div className="flex flex-wrap gap-1.5">
                      {(["ltr", "rtl"] as const).map((id) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setDirection(id)}
                          className={clsx("pl-btn text-[10px] px-3 py-1.5", direction === id && "!bg-violet-600 !text-white")}
                        >
                          {id === "ltr" ? "Izq → Der" : "Der → Izq"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1.5 rounded-lg border border-white/10 bg-white/[0.02] p-3">
                      <span className="text-[10px] font-bold uppercase text-slate-400">Espacio</span>
                      <input
                        type="range"
                        min={0}
                        max={48}
                        step={4}
                        value={readerPageGap}
                        onChange={(e) => setReaderPageGap(parseInt(e.target.value, 10))}
                        className="w-full accent-violet-400"
                      />
                      <div className="flex justify-between text-[9px] font-bold text-slate-500">
                        <span>{readerPageGap}px</span>
                      </div>
                    </label>
                    <label className="space-y-1.5 rounded-lg border border-white/10 bg-white/[0.02] p-3">
                      <span className="text-[10px] font-bold uppercase text-slate-400">Márgenes</span>
                      <input
                        type="range"
                        min={0}
                        max={80}
                        step={4}
                        value={readerSidePadding}
                        onChange={(e) => setReaderSidePadding(parseInt(e.target.value, 10))}
                        className="w-full accent-violet-400"
                      />
                      <div className="flex justify-between text-[9px] font-bold text-slate-500">
                        <span>{readerSidePadding}px</span>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-4">
                <button
                  type="button"
                  onClick={() => void finish(true)}
                  disabled={saving}
                  className="text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-slate-300 disabled:opacity-50"
                >
                  Saltar
                </button>
                <div className="flex items-center gap-2">
                  {step > 0 && (
                    <button type="button" onClick={() => setStep((s) => (s > 0 ? (s - 1) as Step : s))} disabled={saving} className="pl-btn text-xs">
                      Atrás
                    </button>
                  )}
                  {step < 2 ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (step === 0 && !canAdvanceFromStep0) {
                          setShowFirstError(true);
                          return;
                        }
                        setShowFirstError(false);
                        setStep((s) => (s + 1) as Step);
                      }}
                      disabled={saving}
                      className="pl-btn-primary text-xs"
                    >
                      Continuar
                    </button>
                  ) : (
                    <button type="button" onClick={() => void finish(false)} disabled={saving} className="pl-btn-primary text-xs">
                      {saving ? "..." : "Entrar"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </section>
        </main>

        <footer className="shrink-0 text-center text-[9px] font-bold uppercase tracking-widest text-slate-600">
          Percy&apos;s Library
        </footer>
      </div>
    </div>
  );
}