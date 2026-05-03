import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { api, type StatsDto, type TopComic, type BreakdownEntry } from "../lib/api";
import { useSettingsStore } from "../stores/settings";
import { Link } from "react-router-dom";

type Range = "7d" | "30d" | "90d" | "1y" | "all";

const RANGE_LABEL: Record<Range, string> = {
  "7d": "Últimos 7 días",
  "30d": "Últimos 30 días",
  "90d": "Últimos 90 días",
  "1y": "Último año",
  all: "Histórico",
};

const RANGE_DAYS: Record<Range, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "1y": 365,
  all: 730,
};

export function Stats() {
  const [stats, setStats] = useState<StatsDto | null>(null);
  const goal = useSettingsStore((s) => s.settings?.dailyGoalPages ?? 0);
  const range = useSettingsStore((s) => (s.settings?.statsRange ?? "30d") as Range);
  const updateSettings = useSettingsStore((s) => s.update);

  useEffect(() => {
    void api.stats().then(setStats);
  }, []);

  if (!stats) {
    return <div className="p-12 text-slate-500 animate-pulse">Analizando actividad...</div>;
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 md:px-8 py-10 pl-gradient-bg">
      <div className="max-w-6xl mx-auto space-y-10 animate-fade-in">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white">
              Estadísticas
            </h1>
            <p className="text-slate-400 mt-2 font-medium">
              Tu viaje a través de las páginas — un mapa completo.
            </p>
          </div>
          <RangePicker
            value={range}
            onChange={(r) => void updateSettings({ statsRange: r })}
          />
        </header>

        {/* TOP HERO -------------------------------------------------------- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 pl-card p-8 flex items-center gap-10 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <GoalRing pages={stats.todayPages} goal={goal} />
            <div className="flex-1 space-y-2 relative z-10">
              <h3 className="text-xl font-bold text-white">Meta Diaria</h3>
              <p className="text-slate-400 text-sm font-medium">
                {goal > 0
                  ? stats.todayPages >= goal
                    ? "¡Felicidades! Has completado tu objetivo hoy."
                    : `Te faltan ${goal - stats.todayPages} páginas para alcanzar tu meta.`
                  : "Establece una meta en configuración para medir tu progreso diario."}
              </p>
              {goal > 0 && (
                <div className="pt-4 flex gap-6">
                  <Mini label="Hoy" value={`${stats.todayPages}`} sub="pág" />
                  <Mini label="Objetivo" value={`${goal}`} sub="pág" tone="blue" />
                  <Mini label="Mejor día" value={`${stats.bestDayPages}`} sub="pág" />
                </div>
              )}
            </div>
          </div>

          <div className="pl-card p-8 flex flex-col justify-center items-center text-center bg-gradient-to-br from-blue-600/10 to-transparent border-blue-500/20 shadow-lg shadow-blue-500/5">
            <div className="text-4xl mb-2">🔥</div>
            <div className="text-3xl font-black text-white">{stats.currentStreak} Días</div>
            <div className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mt-1">
              Racha actual
            </div>
            <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-slate-400 w-full">
              <span className="text-left">Récord</span>
              <span className="text-right text-white font-bold">
                {stats.longestStreak}d
              </span>
              <span className="text-left">Activo 7d</span>
              <span className="text-right text-white font-bold">
                {stats.daysActive7}
              </span>
              <span className="text-left">Activo 30d</span>
              <span className="text-right text-white font-bold">
                {stats.daysActive30}
              </span>
            </div>
          </div>
        </div>

        {/* PRIMARY KPIS ---------------------------------------------------- */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon="📚" label="Colección" value={stats.totalComics} sub="cómics" />
          <StatCard
            icon="✅"
            label="Completados"
            value={stats.completedComics}
            sub={completionLabel(stats)}
          />
          <StatCard
            icon="📖"
            label="En curso"
            value={stats.inProgressComics}
            sub="iniciados"
          />
          <StatCard
            icon="📄"
            label="Páginas leídas"
            value={stats.pagesRead.toLocaleString()}
            sub={`prom ${stats.averagePagesPerActiveDay}/día`}
          />
        </div>

        {/* HEATMAP --------------------------------------------------------- */}
        <Section
          title="Actividad por día"
          aside={`${RANGE_LABEL[range]} · ${stats.totalReadingDays} días registrados`}
        >
          <Heatmap days={stats.days} range={range} />
          <ActivityLegend />
        </Section>

        {/* BARS ------------------------------------------------------------ */}
        <Section title="Páginas por día" aside={`${RANGE_LABEL[range]}`}>
          <BarChart
            days={stats.days}
            count={Math.min(RANGE_DAYS[range], 90)}
            goal={goal}
          />
        </Section>

        {/* DISTRIBUTION ---------------------------------------------------- */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Section title="Distribución por formato" aside={`${stats.formats.length} formatos`}>
            <Breakdown
              entries={stats.formats}
              total={Math.max(1, stats.formats.reduce((a, b) => a + b.count, 0))}
              palette={["#7c5cff", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#22d3ee"]}
            />
          </Section>
          <Section
            title="Distribución por categoría"
            aside={`${stats.categories.length} categorías`}
          >
            <Breakdown
              entries={stats.categories.slice(0, 8)}
              total={Math.max(1, stats.categories.reduce((a, b) => a + b.count, 0))}
              palette={["#ec4899", "#22d3ee", "#84cc16", "#f59e0b", "#3b82f6", "#7c5cff"]}
            />
          </Section>
        </div>

        {/* RANKINGS -------------------------------------------------------- */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Section title="Top leídos" aside="Por progreso acumulado">
            <ComicRanking comics={stats.topRead} emptyHint="Aún no has empezado nada." />
          </Section>
          <Section title="Casi terminados" aside="≥ 70% de progreso">
            <ComicRanking
              comics={stats.almostDone}
              emptyHint="Nada en la recta final. ¡Empieza algo nuevo!"
              showRemaining
            />
          </Section>
        </div>

        {/* MISC ------------------------------------------------------------ */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard
            icon="💾"
            label="Tamaño total"
            value={formatBytes(stats.totalBytes)}
            sub="en disco"
          />
          <StatCard
            icon="🏁"
            label="Último completado"
            value={stats.lastCompleted ? truncate(stats.lastCompleted.title, 16) : "—"}
            sub={stats.lastCompleted ? "Ver detalle" : "Sin terminados"}
          />
          <StatCard
            icon="📈"
            label="Tasa de completado"
            value={`${completionRate(stats)}%`}
            sub="de la colección"
          />
        </div>
      </div>
    </div>
  );
}

function completionLabel(stats: StatsDto): string {
  if (stats.totalComics === 0) return "Sin colección";
  return `${completionRate(stats)}% de la colección`;
}

function completionRate(stats: StatsDto): number {
  if (stats.totalComics === 0) return 0;
  return Math.round((stats.completedComics / stats.totalComics) * 100);
}

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function RangePicker({
  value,
  onChange,
}: {
  value: Range;
  onChange: (r: Range) => void;
}) {
  const ranges: Range[] = ["7d", "30d", "90d", "1y", "all"];
  return (
    <div className="inline-flex flex-wrap gap-1.5 p-1.5 rounded-2xl bg-white/[0.03] border border-white/10 shadow-inner">
      {ranges.map((r) => (
        <button
          key={r}
          onClick={() => onChange(r)}
          className={clsx(
            "px-4 py-2 rounded-xl text-xs font-bold transition-all",
            value === r
              ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
              : "text-slate-400 hover:text-slate-200 hover:bg-white/5",
          )}
        >
          {RANGE_LABEL[r]}
        </button>
      ))}
    </div>
  );
}

function Section({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="pl-card p-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-lg font-bold text-white">{title}</h3>
        {aside && (
          <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
            {aside}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function Mini({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone?: "blue";
}) {
  return (
    <div>
      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
        {label}
      </div>
      <div
        className={clsx(
          "text-xl font-bold",
          tone === "blue" ? "text-blue-500" : "text-white",
        )}
      >
        {value} <span className="text-xs text-slate-500">{sub}</span>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: string;
  label: string;
  value: number | string;
  sub: string;
}) {
  return (
    <div className="pl-card p-6 group hover:border-blue-500/30 transition-colors">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">{icon}</span>
        <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-500">
          {label}
        </div>
      </div>
      <div className="flex items-baseline gap-1.5">
        <div className="text-2xl font-bold text-white">{value}</div>
      </div>
      <div className="text-[10px] font-bold text-slate-600 uppercase mt-1">{sub}</div>
    </div>
  );
}

function GoalRing({ pages, goal }: { pages: number; goal: number }) {
  const ratio = goal > 0 ? Math.min(1, pages / goal) : 0;
  const r = 36;
  const circ = 2 * Math.PI * r;
  const dash = ratio * circ;
  return (
    <div className="relative h-32 w-32 shrink-0">
      <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
        <circle
          cx="40"
          cy="40"
          r={r}
          stroke="currentColor"
          className="text-white/5"
          strokeWidth="6"
          fill="none"
        />
        <circle
          cx="40"
          cy="40"
          r={r}
          stroke="currentColor"
          className="text-blue-500 drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]"
          strokeWidth="6"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ - dash}`}
          style={{ transition: "stroke-dasharray 1s ease-out" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center leading-none">
        <span className="text-2xl font-black text-white">{Math.round(ratio * 100)}%</span>
        <span className="text-[10px] text-slate-500 font-bold mt-1 uppercase tracking-tighter">
          Progreso
        </span>
      </div>
    </div>
  );
}

/* HEATMAP ---------------------------------------------------------------- */

function Heatmap({
  days,
  range,
}: {
  days: { date: string; pagesRead: number }[];
  range: Range;
}) {
  // We render a fixed 7×N grid (week-by-week), GitHub-style. The leftmost
  // column is the oldest week. Empty cells render as a faint placeholder.
  const cells = useMemo(() => {
    const map = new Map(days.map((d) => [d.date, d.pagesRead]));
    const dayCount = RANGE_DAYS[range];
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const out: { date: string; pages: number }[] = [];
    for (let i = dayCount - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - i);
      const iso = d.toISOString().slice(0, 10);
      out.push({ date: iso, pages: map.get(iso) ?? 0 });
    }
    return out;
  }, [days, range]);

  const max = Math.max(1, ...cells.map((c) => c.pages));
  const cols = Math.ceil(cells.length / 7);

  return (
    <div className="overflow-x-auto">
      <div
        className="grid gap-1 min-w-fit"
        style={{
          gridTemplateRows: "repeat(7, 14px)",
          gridTemplateColumns: `repeat(${cols}, 14px)`,
          gridAutoFlow: "column",
        }}
      >
        {cells.map((c) => {
          const intensity = c.pages === 0 ? 0 : Math.min(4, Math.ceil((c.pages / max) * 4));
          return (
            <div
              key={c.date}
              className={clsx(
                "h-3.5 w-3.5 rounded-sm transition-transform hover:scale-125",
                heatColor(intensity),
              )}
              title={`${c.date}: ${c.pages} pág`}
            />
          );
        })}
      </div>
    </div>
  );
}

function heatColor(intensity: number): string {
  switch (intensity) {
    case 0:
      return "bg-white/[0.04] border border-white/[0.06]";
    case 1:
      return "bg-blue-900/60";
    case 2:
      return "bg-blue-700/70";
    case 3:
      return "bg-blue-500/80";
    case 4:
      return "bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.5)]";
    default:
      return "bg-white/5";
  }
}

function ActivityLegend() {
  return (
    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
      <span>Menos</span>
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} className={clsx("h-3 w-3 rounded-sm", heatColor(i))} />
      ))}
      <span>Más</span>
    </div>
  );
}

/* BAR CHART -------------------------------------------------------------- */

function BarChart({
  days,
  count,
  goal,
}: {
  days: { date: string; pagesRead: number }[];
  count: number;
  goal: number;
}) {
  const series = useMemo(() => {
    const map = new Map(days.map((d) => [d.date, d.pagesRead]));
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const out: { date: string; pagesRead: number }[] = [];
    for (let i = count - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - i);
      const iso = d.toISOString().slice(0, 10);
      out.push({ date: iso, pagesRead: map.get(iso) ?? 0 });
    }
    return out;
  }, [days, count]);

  const max = Math.max(1, ...series.map((d) => d.pagesRead), goal);

  return (
    <div className="space-y-2">
      <div className="relative">
        <div className="flex h-44 items-end gap-1 px-2 relative">
          {goal > 0 && (
            <div
              className="absolute left-2 right-2 border-t border-amber-400/40 border-dashed"
              style={{ bottom: `${(goal / max) * 100}%` }}
            >
              <span className="absolute -top-4 right-0 text-[10px] font-bold text-amber-400 uppercase tracking-widest">
                Meta {goal}p
              </span>
            </div>
          )}
          {series.map((d) => {
            const h = Math.round((d.pagesRead / max) * 100);
            return (
              <div key={d.date} className="group relative flex-1">
                <div
                  className={clsx(
                    "w-full rounded-t-md transition-all duration-500 ease-out min-h-[4px]",
                    d.pagesRead === 0
                      ? "bg-white/5"
                      : goal > 0 && d.pagesRead >= goal
                        ? "bg-gradient-to-t from-emerald-600 to-emerald-400"
                        : "bg-gradient-to-t from-blue-600 to-blue-400",
                  )}
                  style={{ height: `${h}%` }}
                />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-white text-black text-[10px] font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-xl z-50">
                  {new Date(d.date).toLocaleDateString("es-ES", {
                    day: "numeric",
                    month: "short",
                  })}
                  : {d.pagesRead} pág
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex justify-between px-2 text-[10px] font-bold text-slate-600 uppercase tracking-widest">
        <span>Hace {count} días</span>
        <span>Hoy</span>
      </div>
    </div>
  );
}

/* BREAKDOWNS ------------------------------------------------------------- */

function Breakdown({
  entries,
  total,
  palette,
}: {
  entries: BreakdownEntry[];
  total: number;
  palette: string[];
}) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No hay nada todavía. Importa contenido para verlo aquí.
      </p>
    );
  }
  return (
    <div className="space-y-3">
      {entries.map((e, i) => {
        const pct = Math.round((e.count / total) * 100);
        const color = palette[i % palette.length];
        return (
          <div key={e.key} className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="flex items-center gap-2 text-slate-200">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-sm"
                  style={{ background: color }}
                />
                {e.key}
              </span>
              <span className="text-slate-400">
                {e.count} <span className="text-slate-600">·</span> {pct}%
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, background: color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ComicRanking({
  comics,
  emptyHint,
  showRemaining,
}: {
  comics: TopComic[];
  emptyHint: string;
  showRemaining?: boolean;
}) {
  if (comics.length === 0) {
    return <p className="text-sm text-slate-500">{emptyHint}</p>;
  }
  return (
    <ol className="space-y-2">
      {comics.map((c, i) => {
        // currentPage is 0-indexed, so we use the server-computed
        // pagesEstimated which already accounts for that and for completion.
        const pct =
          c.pageCount > 0
            ? Math.min(100, Math.round((c.pagesEstimated / c.pageCount) * 100))
            : 0;
        return (
          <li key={c.id}>
            <Link
              to={`/read/${c.id}`}
              className="group flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.02] p-3 hover:bg-white/[0.05] hover:border-blue-500/30 transition-all"
            >
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-600/20 text-sm font-black text-blue-300 border border-blue-500/30 shrink-0">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-white truncate group-hover:text-blue-300 transition-colors">
                  {c.title}
                </div>
                <div className="text-[11px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">
                  {c.format} · {c.currentPage + 1}/{c.pageCount}
                  {showRemaining && (
                    <> · faltan {Math.max(0, c.pageCount - c.currentPage - 1)}</>
                  )}
                </div>
                <div className="mt-2 h-1 w-full rounded-full bg-white/5 overflow-hidden">
                  <div
                    className={clsx(
                      "h-full rounded-full",
                      c.completed
                        ? "bg-emerald-500"
                        : pct >= 70
                          ? "bg-amber-400"
                          : "bg-blue-500",
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
              <span className="text-xs font-black text-white shrink-0">
                {pct}%
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
