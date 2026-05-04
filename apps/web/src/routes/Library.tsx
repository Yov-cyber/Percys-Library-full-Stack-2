import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import clsx from "clsx";
import { useLibraryStore } from "../stores/library";
import { useSettingsStore } from "../stores/settings";
import { useToasts } from "../stores/toasts";
import { CoverCard } from "../components/CoverCard";
import { Avatar } from "../components/AvatarPresets";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { getDisplayName, getInitials } from "../lib/profile";

const ACCEPTED_EXTENSIONS = [".cbz", ".cbr", ".pdf", ".zip", ".rar"] as const;
const ACCEPTED_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".avif", ".heic", ".heif", ".tif", ".tiff"] as const;
const RETURNING_BANNER_KEY_PREFIX = "pl_returning_banner_seen_";

function greeting(name: string): string {
  const h = new Date().getHours();
  const part = h < 6 ? "Buenas noches" : h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
  return `${part}, ${name}`;
}

interface Props {
  scope?: "all" | "favorites";
}

export function Library({ scope = "all" }: Props) {
  const {
    comics,
    loading,
    uploading,
    query,
    filter,
    load,
    scan,
    upload,
    setQuery,
    setFilter,
    toggleFavorite,
    bulk,
  } = useLibraryStore();
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.update);
  const push = useToasts((s) => s.push);
  const [dragOver, setDragOver] = useState(false);
  const [showReturningBanner, setShowReturningBanner] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  // Multi-select mode + selection set. Both reset whenever scope changes
  // so switching from "Library" → "Favoritos" can't leak a stale selection.
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  useEffect(() => {
    setSelectMode(false);
      setDeleteTargets([]);
      setDeleteConfirmOpen(false);
      setCategoryEditorOpen(false);
      setCategoryValue("");
    setSelected(new Set());
  }, [scope]);

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const el = folderInputRef.current;
    if (!el) return;
    // Non-standard but widely supported in Chromium-based browsers.
    el.setAttribute("webkitdirectory", "");
    el.setAttribute("directory", "");
  }, []);

  useEffect(() => {
    if (!settings?.ownerId || !settings.hasOnboarded) return;
    const key = `${RETURNING_BANNER_KEY_PREFIX}${settings.ownerId}`;
    const alreadySeen = localStorage.getItem(key) === "1";
    setShowReturningBanner(!alreadySeen);
  }, [settings?.ownerId, settings?.hasOnboarded]);

  // Filter dropped/picked items down to formats we accept. Browsers don't
  // always populate `file.type` for CBR (it's a renamed RAR), so we fall
  // back to extension matching to be safe.
  function acceptedFiles(list: FileList | File[] | null | undefined): File[] {
    if (!list) return [];
    const arr = Array.from(list);
    return arr.filter((f) => {
      const lower = f.name.toLowerCase();
      return ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext)) ||
        ACCEPTED_IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext));
    });
  }

  const handleUpload = useCallback(async (files: File[]) => {
    if (files.length === 0) {
      push("No se reconocieron archivos compatibles (.cbz, .cbr, .pdf, .zip, .rar o imágenes)", "error");
      return;
    }
    try {
      const r = await upload(files);
      const registered = r.registered ?? r.added;
      const unreadable = r.unreadable ?? Math.max(0, r.uploaded.length - registered);
      const noun = r.added === 1 ? "cómic" : "cómics";
      const head = `Importado${r.added === 1 ? "" : "s"} ${r.added} ${noun}`;
      const skippedTotal = r.skipped.length + unreadable;
      const tail =
        skippedTotal > 0
          ? ` · ${skippedTotal} omitido${skippedTotal === 1 ? "" : "s"}`
          : "";
      const tone = r.added === 0 ? "warn" : "success";
      push(`${head}${tail}`, tone);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error subiendo archivos";
      push(msg, "error");
    }
  }, [upload, push]);

  const sortMode = settings?.librarySort ?? "lastReadAt";
  const viewMode = settings?.libraryView ?? "grid";

  const visible = useMemo(() => {
    const filtered = comics.filter((c) => {
      if (scope === "favorites" && !c.isFavorite) return false;
      if (filter === "favorites" && !c.isFavorite) return false;
      if (filter === "in-progress" && (c.completed || c.currentPage === 0)) return false;
      if (filter === "completed" && !c.completed) return false;
      if (query.trim() && !c.title.toLowerCase().includes(query.trim().toLowerCase())) return false;
      return true;
    });
    // Sort copies the array so React doesn't re-render the same identity.
    const sorted = [...filtered];
    switch (sortMode) {
      case "title":
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "progress": {
        // Highest progress (% read) first; completed sit at the bottom so
        // "show me what I've started" stays glanceable. Use the same
        // (pageCount-1) denominator as CoverCard / ListView so the sort
        // order matches what the user sees on each tile.
        const pct = (c: typeof sorted[number]) =>
          c.pageCount > 1 ? c.currentPage / (c.pageCount - 1) : 0;
        sorted.sort((a, b) => {
          if (a.completed !== b.completed) return a.completed ? 1 : -1;
          return pct(b) - pct(a);
        });
        break;
      }
      case "addedAt":
        sorted.sort((a, b) => b.addedAt.localeCompare(a.addedAt));
        break;
      case "lastReadAt":
      default:
        // Most-recently-read first; never-opened items fall to the end.
        sorted.sort((a, b) => {
          const av = a.lastReadAt ?? "";
          const bv = b.lastReadAt ?? "";
          if (!av && !bv) return a.title.localeCompare(b.title);
          if (!av) return 1;
          if (!bv) return -1;
          return bv.localeCompare(av);
        });
    }
    return sorted;
  }, [comics, query, filter, scope, sortMode]);

  async function onScan() {
    try {
      const r = await scan();
      // Quiet success when nothing changed; otherwise summarise the
      // delta tightly without three separate counters.
      if (r.added === 0 && r.removed === 0) {
        push("Biblioteca al día", "info");
      } else {
        const parts: string[] = [];
        if (r.added) parts.push(`+${r.added}`);
        if (r.removed) parts.push(`-${r.removed}`);
        push(`Biblioteca actualizada · ${parts.join(" · ")}`, "success");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al escanear";
      push(msg, "error");
    }
  }

  async function runBulk(op: import("../lib/api").BulkOp, category?: string | null) {
    const ids = deleteTargets.length > 0 ? deleteTargets : Array.from(selected);
    if (ids.length === 0) {
      setDeleteConfirmOpen(false);
      setCategoryEditorOpen(false);
      push("Selecciona al menos un cómic", "warn");
      return;
    }
    setBulkBusy(true);
    try {
      const r = await bulk(ids, op, category);
      // Bulk feedback is intentionally low-noise: a single toast per
      // user action, never one per affected row.
      const verb =
        op === "delete"
          ? `Eliminado${r.affected === 1 ? "" : "s"}`
          : `Actualizado${r.affected === 1 ? "" : "s"}`;
      push(`${verb} · ${r.affected}`, "success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error en operación masiva";
      push(msg, "error");
    } finally {
      // Always tear down the modals + selection regardless of success or
      // failure — leaving the confirm dialog stuck open after the user
      // pressed "Confirmar" was the most common complaint.
      setSelected(new Set());
      setSelectMode(false);
      setDeleteConfirmOpen(false);
      setDeleteTargets([]);
      setCategoryEditorOpen(false);
      setCategoryValue("");
      setBulkBusy(false);
    }
  }

  function requestSingleDelete(id: string) {
    setDeleteTargets([id]);
    setDeleteConfirmOpen(true);
  }

  // Home-page lanes — shown only when we're at the "all" scope with no
  // active filter or query, so the user sees a tidy split between
  // "what was I reading?" and "what's new?".
  const showHomeLanes =
    scope === "all" && filter === "all" && !query.trim() && comics.length > 0;
  const continueReading = useMemo(() => {
    return [...comics]
      .filter((c) => !c.completed && c.currentPage > 0 && c.lastReadAt)
      .sort((a, b) => (b.lastReadAt ?? "").localeCompare(a.lastReadAt ?? ""))
      .slice(0, 8);
  }, [comics]);
  const recentlyAdded = useMemo(() => {
    return [...comics]
      .sort((a, b) => b.addedAt.localeCompare(a.addedAt))
      .slice(0, 8);
  }, [comics]);

  const userName = getDisplayName(settings?.userName, settings?.userLastName) || "Lector";
  const coverSize = settings?.coverSize ?? "md";

  const heroComic = continueReading[0] || recentlyAdded[0];
  const isEmpty = comics.length === 0;
  const noResults = !loading && visible.length === 0 && !isEmpty;
  const totalEmpty = !loading && isEmpty;

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [categoryEditorOpen, setCategoryEditorOpen] = useState(false);
  const [categoryValue, setCategoryValue] = useState("");
  const [deleteTargets, setDeleteTargets] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const onScroll = () => setShowScrollTop(el.scrollTop > 600);
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // Keyboard shortcuts active while the user is in "Gestionar" mode:
  //   Esc           — exit select mode
  //   Delete/Backsp — open the delete confirmation for the current selection
  //   Ctrl/⌘ + A    — select every visible comic
  // We bail out when focus is in an input/textarea or when a confirm
  // dialog is already open so we never steal real keystrokes.
  useEffect(() => {
    if (!selectMode) return;
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
      if (deleteConfirmOpen || categoryEditorOpen) return;
      if (e.key === "Escape") {
        e.preventDefault();
        setSelectMode(false);
        setSelected(new Set());
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selected.size > 0) {
        e.preventDefault();
        setDeleteConfirmOpen(true);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
        e.preventDefault();
        setSelected(new Set(visible.map((c) => c.id)));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectMode, selected, visible, deleteConfirmOpen, categoryEditorOpen]);

  return (
    <div
      className="relative flex h-full flex-col overflow-hidden pl-gradient-bg"
      onDragEnter={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setDragOver(true);
        }
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setDragOver(false);
      }}
      onDrop={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setDragOver(false);
        void handleUpload(acceptedFiles(e.dataTransfer.files));
      }}
    >
      <header className="flex items-center justify-between gap-4 px-8 pt-8 pb-6 relative z-10">
        <div className="flex items-center gap-4">
          <Avatar value={settings?.avatar ?? null} size={56} className="rounded-2xl shadow-xl shadow-black/50 border border-white/5 shrink-0" fallbackText={getInitials(settings?.userName, settings?.userLastName)} />
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">{greeting(userName)}</h1>
            <p className="text-sm text-slate-400 font-medium mt-0.5">
              {scope === "favorites" ? "Tus tesoros guardados" : `${comics.length} obras en tu colección`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative group">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition-colors" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar en la biblioteca..."
              className="w-72 rounded-xl bg-white/[0.03] border border-white/10 pl-10 pr-4 py-2.5 text-sm placeholder:text-slate-500 focus:outline-none focus:border-blue-500/50 focus:bg-white/[0.05] transition-all"
            />
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".cbz,.cbr,.pdf,.zip,.rar,application/pdf"
            className="sr-only"
            onChange={(e) => {
              const files = acceptedFiles(e.target.files);
              if (e.target) e.target.value = "";
              void handleUpload(files);
            }}
          />
          <input
            ref={folderInputRef}
            type="file"
            multiple
            accept=".cbz,.cbr,.pdf,.zip,.rar,.jpg,.jpeg,.png,.webp,.gif,.bmp,.avif,.heic,.heif,.tif,.tiff,application/pdf,image/*"
            className="sr-only"
            onChange={(e) => {
              const files = acceptedFiles(e.target.files);
              if (e.target) e.target.value = "";
              void handleUpload(files);
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="pl-btn border border-white/5"
          >
            {uploading ? "Subiendo…" : "Importar archivos"}
          </button>
          <button
            onClick={() => folderInputRef.current?.click()}
            disabled={uploading}
            className="pl-btn border border-white/5"
            title="Importar una carpeta completa de cómics"
          >
            Importar carpeta
          </button>
          <button
            onClick={() => {
              setSelectMode((v) => !v);
              if (selectMode) setSelected(new Set());
            }}
            className={clsx("pl-btn border transition-all", selectMode ? "bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-600/20" : "border-white/5")}
          >
            {selectMode ? "Finalizar" : "Gestionar"}
          </button>
          <button onClick={onScan} className="pl-btn-primary">
            Escanear
          </button>
        </div>
      </header>

      {showReturningBanner && settings?.hasOnboarded && (
        <div className="mx-8 mb-4 rounded-2xl border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-100">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-semibold">Bienvenido de vuelta, {userName}</div>
              <div className="text-xs text-blue-100/80">Tu perfil y biblioteca se conservarán durante la navegación.</div>
            </div>
            <button
              type="button"
              onClick={() => {
                if (settings?.ownerId) {
                  localStorage.setItem(`${RETURNING_BANNER_KEY_PREFIX}${settings.ownerId}`, "1");
                }
                setShowReturningBanner(false);
              }}
              className="rounded-lg border border-blue-300/40 px-3 py-1.5 text-xs font-semibold text-blue-100 hover:bg-blue-500/20"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      <div className="px-8 pb-6 flex flex-wrap items-center gap-3 relative z-10">
        {scope !== "favorites" && (
          <div className="flex gap-1.5 p-1 rounded-xl bg-white/[0.02] border border-white/5">
            {(["all", "in-progress", "completed", "favorites"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={clsx(
                  "px-4 py-1.5 rounded-lg text-xs font-semibold transition-all",
                  filter === f ? "bg-white/10 text-white shadow-sm" : "text-slate-500 hover:text-slate-300"
                )}
              >
                {f === "all" ? "Todos" : f === "in-progress" ? "Leyendo" : f === "completed" ? "Leídos" : "Favoritos"}
              </button>
            ))}
          </div>
        )}

        <div className="ml-auto flex items-center gap-3">
          <select
            value={sortMode}
            onChange={(e) => void updateSettings({ librarySort: e.target.value as typeof sortMode })}
            className="rounded-xl bg-white/[0.03] border border-white/10 px-3 py-2 text-xs font-medium text-slate-300 focus:outline-none focus:border-blue-500/50 transition-all"
          >
            <option value="lastReadAt">Vistos recientemente</option>
            <option value="title">Orden alfabético</option>
            <option value="progress">Por progreso</option>
            <option value="addedAt">Añadidos últimos</option>
          </select>
          
          <div className="flex p-1 rounded-xl bg-white/[0.02] border border-white/5">
            <button
              onClick={() => void updateSettings({ libraryView: "grid" })}
              className={clsx("p-1.5 rounded-lg transition-all", viewMode === "grid" ? "bg-white/10 text-white" : "text-slate-500 hover:text-slate-300")}
              title="Cuadrícula"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>
            </button>
            <button
              onClick={() => void updateSettings({ libraryView: "list" })}
              className={clsx("p-1.5 rounded-lg transition-all", viewMode === "list" ? "bg-white/10 text-white" : "text-slate-500 hover:text-slate-300")}
              title="Lista"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
            </button>
          </div>
        </div>
      </div>

      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-8 pb-16 space-y-12 no-scrollbar scroll-smooth">
        {!loading && showHomeLanes && !selectMode && (
          <>
            {heroComic && (
              <section className="animate-fade-in">
                <Link to={`/read/${heroComic.id}`} className="group relative block overflow-hidden rounded-3xl border border-white/10 bg-ink-800 shadow-2xl transition-all hover:border-blue-500/30">
                  <div className="absolute inset-0 z-0">
                    <img
                      src={`/api/comics/${heroComic.id}/cover`}
                      alt=""
                      className="h-full w-full object-cover opacity-20 blur-xl scale-110 transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#030408] via-transparent to-transparent" />
                  </div>
                  
                  <div className="relative z-10 flex flex-col md:flex-row items-center gap-8 p-8 md:p-12">
                    <div className="relative shrink-0">
                      <img
                        src={`/api/comics/${heroComic.id}/cover`}
                        alt={heroComic.title}
                        className="w-40 md:w-56 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/5 transition-transform duration-500 group-hover:scale-[1.02]"
                      />
                      <div className="absolute -bottom-2 -right-2 h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center text-white shadow-xl">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                      </div>
                    </div>
                    
                    <div className="flex-1 text-center md:text-left space-y-4">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-500 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">
                          {heroComic.currentPage > 0 ? "Continuar leyendo" : "Empezar lectura"}
                        </span>
                        <h2 className="mt-4 text-3xl md:text-5xl font-black text-white leading-tight tracking-tighter">
                          {heroComic.title}
                        </h2>
                      </div>
                      
                      <div className="space-y-4 max-w-md">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-widest">
                          <span>Progreso</span>
                          <span className="text-blue-400">
                            {heroComic.currentPage + 1} / {heroComic.pageCount} pág
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-white/5 border border-white/5 overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-blue-600 to-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.3)] transition-all duration-1000" 
                            style={{ width: `${(heroComic.currentPage / Math.max(1, heroComic.pageCount - 1)) * 100}%` }} 
                          />
                        </div>
                      </div>
                      
                      <button className="pl-btn-primary !px-10 !py-4 shadow-xl shadow-blue-600/20">
                        {heroComic.currentPage > 0 ? "Continuar aventura" : "Abrir ahora"}
                      </button>
                    </div>
                  </div>
                </Link>
              </section>
            )}

            {continueReading.length > 1 && (
              <Lane title="Sigue explorando" subtitle="Basado en tu actividad reciente">
                {continueReading.slice(1).map((c) => (
                  <CoverCard key={c.id} comic={c} size="sm" onToggleFavorite={toggleFavorite} />
                ))}
              </Lane>
            )}
            {recentlyAdded.length > 0 && (
              <Lane title="Novedades" subtitle="Agregados recientemente">
                {recentlyAdded.map((c) => (
                  <CoverCard key={c.id} comic={c} size="sm" onToggleFavorite={toggleFavorite} />
                ))}
              </Lane>
            )}
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <h2 className="text-lg font-bold text-white">Tu Colección</h2>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{comics.length} cómics totales</span>
            </div>
          </>
        )}
        
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-4 animate-pulse">
            <div className="h-12 w-12 rounded-2xl bg-white/5 border border-white/10" />
            <p className="text-sm font-medium text-slate-500">Organizando biblioteca...</p>
          </div>
        )}

        {totalEmpty && (
          <div className="flex flex-col items-center justify-center py-32 text-center animate-fade-in">
            <div className="h-24 w-24 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center text-4xl mb-6 shadow-2xl">
              📚
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Tu biblioteca está vacía</h3>
            <p className="text-slate-500 max-w-xs mx-auto mb-8 font-medium">
              Importa archivos CBZ, CBR, PDF o carpetas de imágenes para empezar tu aventura de lectura.
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="pl-btn-primary"
            >
              {uploading ? "Subiendo…" : "Elegir archivos"}
            </button>
            <button
              onClick={() => folderInputRef.current?.click()}
              className="mt-3 pl-btn"
              disabled={uploading}
            >
              Importar carpeta de imágenes
            </button>
          </div>
        )}

        {noResults && (
          <div className="flex flex-col items-center justify-center py-32 text-center animate-fade-in">
            <div className="text-4xl mb-6">🔍</div>
            <h3 className="text-xl font-bold text-white mb-2">Sin resultados</h3>
            <p className="text-slate-500 font-medium">
              No hemos encontrado cómics que coincidan con &quot;{query}&quot;.
            </p>
            <button 
              onClick={() => { setQuery(""); setFilter("all"); }}
              className="mt-6 pl-btn"
            >
              Limpiar búsqueda
            </button>
          </div>
        )}

        {viewMode === "grid" ? (
          <div className="flex flex-wrap gap-x-6 gap-y-8">
            {visible.map((c) => (
              <CoverCard
                key={c.id}
                comic={c}
                size={coverSize}
                onToggleFavorite={toggleFavorite}
                onDelete={requestSingleDelete}
                selectable={selectMode}
                selected={selected.has(c.id)}
                onToggleSelect={(id) => toggleSelect(id)}
              />
            ))}
          </div>
        ) : (
          <ListView comics={visible} onToggleFavorite={toggleFavorite} onDelete={requestSingleDelete} />
        )}
      </div>

      {showScrollTop && (
        <button
          onClick={() => scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-8 right-8 z-40 h-12 w-12 rounded-2xl bg-blue-600 text-white shadow-2xl shadow-blue-600/30 flex items-center justify-center animate-in fade-in zoom-in slide-in-from-bottom-4 duration-300 hover:scale-110 active:scale-95 transition-all border border-blue-400/30"
          title="Volver arriba"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 15l-6-6-6 6"/></svg>
        </button>
      )}

      {selectMode && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 w-full max-w-4xl px-6 animate-fade-in">
          <div className="pl-glass rounded-3xl p-4 shadow-2xl shadow-black/50 border-white/10 flex items-center gap-6">
            <div className="shrink-0 flex items-center gap-3 border-r border-white/10 pr-6 mr-2">
              <div className="h-10 w-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white font-black text-sm shadow-lg">
                {selected.size}
              </div>
              <div className="hidden md:block">
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">Seleccionados</div>
                <div className="text-xs font-bold text-white mt-1">Cómics listos</div>
              </div>
            </div>
            
            <div className="flex-1 flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
              <ActionBtn onClick={() => void runBulk("favorite")} icon="★" label="Favorito" disabled={selected.size === 0 || bulkBusy} />
              <ActionBtn onClick={() => void runBulk("unfavorite")} icon="☆" label="Quitar fav" disabled={selected.size === 0 || bulkBusy} />
              <ActionBtn onClick={() => void runBulk("markCompleted")} icon="✅" label="Leído" disabled={selected.size === 0 || bulkBusy} />
              <ActionBtn onClick={() => void runBulk("markUnread")} icon="📖" label="Pendiente" disabled={selected.size === 0 || bulkBusy} />
              <ActionBtn onClick={() => setCategoryEditorOpen(true)} icon="📁" label="Categoría" disabled={selected.size === 0 || bulkBusy} />
              <ActionBtn onClick={() => setDeleteConfirmOpen(true)} icon="🗑️" label="Eliminar" danger disabled={selected.size === 0 || bulkBusy} />
            </div>

            <button 
              onClick={() => { setSelectMode(false); setSelected(new Set()); }}
              className="shrink-0 p-2 rounded-xl hover:bg-white/5 text-slate-500 transition-colors"
              title="Cancelar selección"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={deleteConfirmOpen}
        title="Eliminar de biblioteca"
        description={`Se eliminarán ${deleteTargets.length || selected.size} cómic${(deleteTargets.length || selected.size) === 1 ? "" : "s"} de la biblioteca y sus archivos locales. Esta acción no se puede deshacer.`}
        confirmLabel="Confirmar eliminación"
        tone="danger"
        busy={bulkBusy}
        onConfirm={() => void runBulk("delete")}
        onCancel={() => {
          if (bulkBusy) return;
          setDeleteConfirmOpen(false);
          setDeleteTargets([]);
        }}
      />
      <ConfirmDialog
        open={categoryEditorOpen}
        title="Asignar categoría"
        description="Escribe la categoría para los cómics seleccionados. Déjalo vacío para limpiar."
        confirmLabel="Aplicar"
        busy={bulkBusy}
        // Let the inner <input autoFocus /> own focus so the user can
        // start typing immediately.
        autoFocusConfirm={false}
        onConfirm={() => void runBulk("category", categoryValue.trim() || null)}
        onCancel={() => {
          if (bulkBusy) return;
          setCategoryEditorOpen(false);
          setCategoryValue("");
        }}
      >
        <input
          autoFocus
          value={categoryValue}
          onChange={(e) => setCategoryValue(e.target.value)}
          placeholder="Ejemplo: Shonen, DC, Pendientes..."
          className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50"
        />
      </ConfirmDialog>
      {(dragOver || uploading) && (
        <div
          className="pointer-events-auto fixed inset-0 z-[100] flex items-center justify-center bg-[#030408]/90 backdrop-blur-xl animate-fade-in"
          aria-live="polite"
        >
          <div className="flex flex-col items-center gap-8 max-w-sm text-center">
            <div className="relative">
              <div className="h-32 w-32 rounded-[40px] bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-5xl shadow-2xl animate-bounce">
                {uploading ? "⏳" : "📦"}
              </div>
              <div className="absolute -inset-4 bg-blue-500/20 blur-3xl -z-10 animate-pulse" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-2xl font-black text-white">
                {uploading ? "Importando contenido" : "Suelta tus archivos"}
              </h3>
              <p className="text-slate-500 font-medium leading-relaxed">
                {uploading 
                  ? "Estamos procesando tus cómics para que puedas leerlos de inmediato." 
                  : "Arrastra tus archivos CBZ, CBR o PDF aquí para añadirlos a la biblioteca."}
              </p>
            </div>
            
            {uploading && (
              <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
                <div className="h-full w-[32%] bg-blue-500/90" style={{ animation: "loading-indeterminate 1.35s ease-in-out infinite" }} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Horizontal lane of covers with a label. Used for "Continuar leyendo" /
// "Recién añadidos" home shelves.
function Lane({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <h2 className="text-xl font-bold text-white tracking-tight">{title}</h2>
          {subtitle && <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{subtitle}</p>}
        </div>
      </div>
      <div className="grid grid-flow-col auto-cols-[140px] gap-6 overflow-x-auto pb-6 -mx-8 px-8 no-scrollbar scroll-smooth">
        {children}
      </div>
    </section>
  );
}

function ListView({
  comics,
  onToggleFavorite,
  onDelete,
}: {
  comics: import("../lib/api").ComicSummary[];
  onToggleFavorite: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="grid gap-3">
      {comics.map((c) => {
        const pct = c.pageCount > 0 ? Math.round((c.currentPage / Math.max(1, c.pageCount - 1)) * 100) : 0;
        return (
          <div key={c.id} className="group pl-card p-3 flex items-center gap-4 hover:border-blue-500/30">
            <Link to={`/read/${c.id}`} className="flex flex-1 items-center gap-4 min-w-0">
              <img
                src={`/api/comics/${c.id}/cover`}
                alt=""
                className="h-16 w-12 shrink-0 rounded-lg object-cover bg-white/5 border border-white/5 shadow-lg group-hover:scale-105 transition-transform"
                loading="lazy"
              />
              <div className="min-w-0 flex-1">
                    <div className="truncate font-bold text-white">{c.title}</div>
                <div className="flex items-center gap-3 mt-1.5">
                  <div className="h-1 w-20 rounded-full bg-white/5 overflow-hidden">
                    <div className="h-full bg-blue-500" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    {c.completed ? "Completado" : `${pct}%`}
                  </span>
                </div>
              </div>
            </Link>
            <div className="flex items-center gap-4 px-4 border-l border-white/5">
              <div className="hidden sm:block text-right">
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Formato</div>
                <div className="text-xs font-bold text-white uppercase">{c.format}</div>
              </div>
              <button
                onClick={() => onToggleFavorite(c.id)}
                className={clsx(
                  "p-2 rounded-xl transition-all",
                  c.isFavorite ? "text-amber-400 bg-amber-400/10" : "text-slate-500 hover:text-white"
                )}
              >
                {c.isFavorite ? "★" : "☆"}
              </button>
              <button
                onClick={() => onDelete(c.id)}
                className="p-2 rounded-xl text-slate-500 transition-all hover:bg-red-500/20 hover:text-red-400"
                title="Eliminar de biblioteca"
                aria-label="Eliminar de biblioteca"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ActionBtn({ onClick, icon, label, danger, disabled }: { onClick: () => void; icon: string; label: string; danger?: boolean; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "flex flex-col items-center justify-center min-w-[70px] h-14 rounded-2xl transition-all disabled:opacity-40 disabled:cursor-not-allowed",
        danger 
          ? "text-red-400 hover:bg-red-400/10" 
          : "text-slate-400 hover:bg-white/5 hover:text-white"
      )}
    >
      <span className="text-lg">{icon}</span>
      <span className="text-[9px] font-black uppercase tracking-tighter mt-1">{label}</span>
    </button>
  );
}


// PageModal was replaced by the shared <ConfirmDialog> in components/.
