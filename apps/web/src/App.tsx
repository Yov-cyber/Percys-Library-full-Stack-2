import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate, NavLink } from "react-router-dom";
import clsx from "clsx";
import { Sidebar } from "./components/Sidebar";
import { Toaster } from "./components/Toaster";
import { ThemeProvider } from "./components/ThemeProvider";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Library } from "./routes/Library";
import { Reader } from "./routes/Reader";
import { Stats } from "./routes/Stats";
import { Achievements } from "./routes/Achievements";
import { Settings } from "./routes/Settings";
import { Welcome } from "./routes/Welcome";
import { useSettingsStore } from "./stores/settings";
import { useLibraryStore } from "./stores/library";
import { useToasts } from "./stores/toasts";
import { api } from "./lib/api";

export function App() {
  const loadSettings = useSettingsStore((s) => s.load);
  const settings = useSettingsStore((s) => s.settings);
  const scan = useLibraryStore((s) => s.scan);
  const push = useToasts((s) => s.push);
  const location = useLocation();
  const navigate = useNavigate();
  const isReader = location.pathname.startsWith("/read/");
  const isWelcome = location.pathname === "/welcome";
  const animationsEnabled = useSettingsStore((s) => s.settings?.animationsEnabled ?? true);
  const [knownAchievements, setKnownAchievements] = useState<string[]>([]);
  // achievements api will be imported dynamically inside the effect

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  // Onboarding gate: first-time users (no settings or hasOnboarded=false)
  // are routed to the welcome screen. We wait for settings to load so we
  // never bounce a returning user away from a deep link on a slow request.
  useEffect(() => {
    if (!settings) return;
    if (!settings.hasOnboarded && !isWelcome) {
      if (settings.userName.trim() || settings.userLastName?.trim() || settings.avatar) {
        void useSettingsStore.getState().update({ hasOnboarded: true });
        return;
      }
      navigate("/welcome", { replace: true });
    }
  }, [settings, isWelcome, navigate]);

  useEffect(() => {
    if (!settings?.hasOnboarded) return; // don't poke the library before onboarding
    const handler = async () => {
      try {
        const r = await scan();
        if (r.added === 0 && r.removed === 0) return; // no-op scans stay silent
        const parts: string[] = [];
        if (r.added) parts.push(`+${r.added}`);
        if (r.removed) parts.push(`-${r.removed}`);
        push(`Biblioteca sincronizada · ${parts.join(" · ")}`, "success");
      } catch {
        push("Error al sincronizar la biblioteca", "error");
      }
    };
    window.addEventListener("pl-scan", handler);
    return () => window.removeEventListener("pl-scan", handler);
  }, [scan, push, settings?.hasOnboarded]);

  // Poll achievements and show a toast when new ones unlock. Multiple
  // simultaneous unlocks (e.g. on first scan) are merged into a single
  // toast so the user sees one celebratory notification rather than a
  // wall of them. Skipped while the user is still on the welcome screen
  // so the achievements feed doesn't fire under a half-built profile.
  useEffect(() => {
    if (!settings?.hasOnboarded) return;
    let cancelled = false;
    async function fetchOnce() {
      try {
        const list = await api.achievements();
        if (cancelled) return;
        const unlocked = list.filter((a) => a.unlocked).map((a) => a.id);
        if (knownAchievements.length === 0) {
          // First fill — establish baseline silently so reloading the
          // app doesn't fire dozens of "achievement unlocked" toasts.
          setKnownAchievements(unlocked);
          return;
        }
        const known = new Set(knownAchievements);
        const fresh = unlocked.filter((id) => !known.has(id));
        if (fresh.length === 1) {
          const a = list.find((x) => x.id === fresh[0]);
          if (a) push(`Logro · ${a.title}`, "success");
        } else if (fresh.length > 1) {
          push(`${fresh.length} logros desbloqueados`, "success");
        }
        setKnownAchievements(unlocked);
      } catch {
        // ignore polling errors
      }
    }
    void fetchOnce();
    const iv = setInterval(() => void fetchOnce(), 20_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [knownAchievements, push, settings?.hasOnboarded]);

  if (isWelcome && settings?.hasOnboarded) {
    return <Navigate to="/" replace />;
  }

  if (isWelcome) {
    return (
      <ThemeProvider>
        <div data-anim={animationsEnabled ? "1" : "0"} className="h-full w-full">
          <Routes>
            <Route path="/welcome" element={<Welcome />} />
          </Routes>
        </div>
        <Toaster />
      </ThemeProvider>
    );
  }

  if (isReader) {
    return (
      <ThemeProvider>
        <div data-anim={animationsEnabled ? "1" : "0"} className="h-full w-full">
          <Routes>
            <Route path="/read/:id" element={<Reader />} />
          </Routes>
        </div>
        <Toaster />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <div data-anim={animationsEnabled ? "1" : "0"} className="flex h-screen w-screen overflow-hidden bg-transparent text-ink-100">
        <Sidebar />
        <main className="flex-1 overflow-hidden relative pb-16 md:pb-0">
          <ErrorBoundary>
            <div key={location.pathname} className="h-full w-full animate-fade-in overflow-hidden flex flex-col">
              <Routes location={location}>
                <Route path="/" element={<Library />} />
                <Route path="/favorites" element={<Library scope="favorites" />} />
                <Route path="/stats" element={<Stats />} />
                <Route path="/achievements" element={<Achievements />} />
                <Route path="/settings/*" element={<Settings />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </div>
          </ErrorBoundary>
        </main>
        <MobileNav />
        <Toaster />
      </div>
    </ThemeProvider>
  );
}

function MobileNav() {
  const items = [
    { to: "/", label: "Biblioteca", icon: "📚" },
    { to: "/favorites", label: "Favoritos", icon: "⭐" },
    { to: "/stats", label: "Estadísticas", icon: "📊" },
    { to: "/achievements", label: "Logros", icon: "🏆" },
    { to: "/settings/profile", label: "Configuración", icon: "⚙️" },
  ];
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-[100] bg-black/80 backdrop-blur-xl border-t border-white/5 px-6 py-2 flex items-center justify-between pb-safe">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === "/"}
          className={({ isActive }) =>
            clsx(
              "flex flex-col items-center gap-1 p-2 rounded-xl transition-all",
              isActive ? "text-blue-500 scale-110" : "text-slate-500"
            )
          }
        >
          <span className="text-lg">{item.icon}</span>
          <span className="text-[10px] font-black uppercase tracking-tighter">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
