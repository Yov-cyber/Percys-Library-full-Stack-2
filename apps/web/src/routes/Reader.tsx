import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import clsx from "clsx";
import { api, type ComicSummary, type NextComic } from "../lib/api";
import { useSettingsStore } from "../stores/settings";
import { useToasts } from "../stores/toasts";
import { useFullscreen } from "../hooks/useFullscreen";
import { useKeybinds } from "../hooks/useKeybinds";
import { useImagePreload } from "../hooks/useImagePreload";
import { useAutoScroll } from "../hooks/useAutoScroll";
import { ThumbnailStrip } from "../components/reader/ThumbnailStrip";
import { PagedView } from "../components/reader/PagedHorizontal";
import { ContinuousView } from "../components/reader/Continuous";
import { WebtoonView } from "../components/reader/Webtoon";
import { DoublePage, DOUBLE_PAGE_FALLBACK_QUERY } from "../components/reader/DoublePage";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { QuickSettings } from "../components/reader/QuickSettings";
import { NextComicPrompt } from "../components/reader/NextComicPrompt";
import { ModeSelector } from "../components/reader/ModeSelector";
import { TopProgressBar } from "../components/reader/TopProgressBar";
import { BookmarksPanel } from "../components/reader/BookmarksPanel";
import { ClockEta } from "../components/reader/ClockEta";
import { GotoInput } from "../components/reader/GotoInput";
import { KeyboardHelp } from "../components/reader/KeyboardHelp";
import { useTouchGestures } from "../hooks/useTouchGestures";
import { parseShortcutMap } from "../lib/shortcuts";

export function Reader() {
  const ZOOM_MIN = 0.5;
  const ZOOM_MAX = 4;
  const ZOOM_STEP = 0.1;
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.update);
  const push = useToasts((s) => s.push);
  const { isFs, toggle: toggleFs } = useFullscreen();
  const uiVisible = true;

  const [comic, setComic] = useState<ComicSummary | null>(null);
  const [page, setPage] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [stripVisible, setStripVisible] = useState(true);
  const [quickOpen, setQuickOpen] = useState(false);
  const [nextComic, setNextComic] = useState<NextComic | null>(null);
  const [nextDismissed, setNextDismissed] = useState(false);
  const [autoScrolling, setAutoScrolling] = useState(false);
  const [bookmarksOpen, setBookmarksOpen] = useState(false);
  const [gotoOpen, setGotoOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [showZoomHud, setShowZoomHud] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);
  const scrollableRef = useRef<HTMLDivElement | null>(null);
  const lastSavedPage = useRef(-1);
  const lastSavedCompleted = useRef(false);
  const lastSavedZoom = useRef<number | null>(null);
  const autoAdvanceFired = useRef(false);

  // Load comic + initial progress. If the URL points at a comic that
  // no longer exists (e.g. deleted while open in a tab, then reload),
  // bounce back to the library with a friendly toast instead of leaving
  // the user staring at an empty reader shell forever.
  useEffect(() => {
    if (!id) {
      navigate("/", { replace: true });
      return;
    }
    let cancelled = false;
    setComic(null);
    setPage(0);
    setZoom(1);
    api.comic(id)
      .then((c) => {
        if (cancelled) return;
        setComic(c);
        setPage(Math.min(c.currentPage, Math.max(0, c.pageCount - 1)));
        // Restore the last zoom this comic was read with (if any). The
        // ref is primed too so the persistence effect doesn't immediately
        // re-save the same value back to the server on hydration.
        const z = c.lastZoom ?? 1;
        setZoom(z);
        lastSavedZoom.current = z;
      })
      .catch((err) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "No se pudo abrir el cómic";
        push(msg, "error");
        navigate("/", { replace: true });
      });
    // Reset next-in-series state on comic change.
    setNextComic(null);
    setNextDismissed(false);
    autoAdvanceFired.current = false;
    api.nextComic(id)
      .then((r) => {
        if (cancelled) return;
        setNextComic(r.next);
      })
      .catch(() => {
        // next-in-series is best-effort; ignore failures.
      });
    return () => {
      cancelled = true;
    };
  }, [id, navigate, push]);

  useEffect(() => {
    setStripVisible(settings?.showThumbStrip ?? true);
  }, [settings?.showThumbStrip]);

  const rtl = settings?.direction === "rtl";
  const fitMode = settings?.fitMode ?? "fit-width";
  const mode = settings?.readingMode ?? "paged-h";
  const autoCrop = settings?.autoCropMargins ?? false;
  const imageQuality = settings?.imageQuality ?? "balanced";
  const pageGap = settings?.readerPageGap ?? 8;
  const maxWidth = settings?.readerMaxWidth ?? 900;
  const sidePadding = settings?.readerSidePadding ?? 0;
  const preloadWindow = settings?.readerPagePreload ?? 3;
  const shortcuts = useMemo(() => parseShortcutMap(settings?.keyboardShortcuts), [settings?.keyboardShortcuts]);
  const clampZoom = useCallback((v: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, v)), []);

  // Double-page navigation steps by 2, but DoublePage falls back to a
  // single-page render on portrait/<=700px viewports — in that case the
  // step must drop to 1 so we don't skip every other page on mobile.
  // We listen to the same media query DoublePage uses so the two stay
  // in lockstep.
  const doublePageFallback = useMediaQuery(DOUBLE_PAGE_FALLBACK_QUERY);
  const isDoubleSpread = mode === "paged-h-2" && !doublePageFallback;
  // In double-spread with an even pageCount the last spread starts at
  // pageCount-2 and already shows the final two pages — advancing further
  // would just render page-1 in isolation. We clamp goNext to the last
  // start-of-spread and gate "end of comic" features off the same value.
  const maxStartPage =
    !comic ? 0
    : isDoubleSpread && comic.pageCount > 0 && comic.pageCount % 2 === 0
      ? Math.max(0, comic.pageCount - 2)
      : Math.max(0, comic.pageCount - 1);
  const isAtEnd = !!comic && page >= maxStartPage;
  const overlayVisible = uiVisible;

  // Clamp page when maxStartPage shrinks (mode switch from single→double on
  // an odd page, or device rotation that re-engages the single-page
  // fallback). Without this the slider, progressPct, and goNext can all
  // produce nonsense values (>100%, backward navigation, OOB input value).
  // Also snap to even in double-spread so the spread alignment is preserved
  // after the switch.
  useEffect(() => {
    if (!comic) return;
    let target = page;
    if (target > maxStartPage) target = maxStartPage;
    if (isDoubleSpread && target % 2 !== 0) target = Math.max(0, target - 1);
    if (target !== page) setPage(target);
  }, [comic, page, maxStartPage, isDoubleSpread]);

  // Persist progress (debounced). "completed" must use isAtEnd so that the
  // last spread of an even-pageCount comic in double-page mode marks the
  // book as finished without forcing the user to click one extra page.
  // We track the last saved completed flag alongside the page so that a
  // mode switch which only changes maxStartPage (e.g. single→double on an
  // even page) still re-saves and propagates the completion to the server.
  useEffect(() => {
    if (!comic) return;
    const completed = page >= maxStartPage;
    if (lastSavedPage.current === page && lastSavedCompleted.current === completed) return;
    const t = window.setTimeout(() => {
      void api.setProgress(comic.id, page, completed).then((r) => {
        if (
          r.completed &&
          (lastSavedPage.current !== page || !lastSavedCompleted.current)
        ) {
          push("Cómic completado", "success");
        }
        lastSavedPage.current = page;
        lastSavedCompleted.current = r.completed;
      });
    }, 350);
    return () => window.clearTimeout(t);
  }, [page, comic, push, maxStartPage]);

  // Persist zoom per comic (debounced). Routed through the dedicated
  // /zoom endpoint so a user who is just zooming in/out doesn't churn
  // lastReadAt, doesn't bump pagesRead, and can't accidentally race the
  // page-progress effect into overwriting `completed` back to false.
  useEffect(() => {
    if (!comic) return;
    if (lastSavedZoom.current !== null && Math.abs(zoom - lastSavedZoom.current) < 0.005) return;
    const t = window.setTimeout(() => {
      void api.setZoom(comic.id, zoom).then(() => {
        lastSavedZoom.current = zoom;
      });
    }, 600);
    return () => window.clearTimeout(t);
  }, [zoom, comic]);

  // Preload nearby pages (paged modes)
  const preloadUrls = useMemo(() => {
    if (!comic) return [];
    const win = [-2, -1, 1, 2, 3];
    return win
      .map((d) => page + d)
      .filter((p) => p >= 0 && p < comic.pageCount)
      .map((p) => api.pageUrl(comic.id, p, autoCrop, imageQuality));
  }, [comic, page, autoCrop, imageQuality]);
  useImagePreload(preloadUrls);

  const goNext = useCallback(() => {
    if (!comic || comic.pageCount === 0) return;
    const step = isDoubleSpread ? 2 : 1;
    setPage((p) => Math.min(p + step, maxStartPage));
  }, [comic, isDoubleSpread, maxStartPage]);
  const goPrev = useCallback(() => {
    const step = isDoubleSpread ? 2 : 1;
    setPage((p) => Math.max(p - step, 0));
  }, [isDoubleSpread]);

  const scrollStep = useCallback((dir: 1 | -1) => {
    const el = scrollableRef.current;
    if (!el) return false;
    const delta = dir * Math.max(120, Math.round(el.clientHeight * 0.85));
    if (dir > 0) {
      const remaining = el.scrollHeight - (el.scrollTop + el.clientHeight);
      if (remaining > 6) {
        el.scrollBy({ top: delta, behavior: "smooth" });
        return true;
      }
      return false;
    }
    if (el.scrollTop > 6) {
      el.scrollBy({ top: delta, behavior: "smooth" });
      return true;
    }
    return false;
  }, []);

  useKeybinds(
    {
      next: goNext,
      prev: goPrev,
      toggleFs: () => toggleFs(shellRef.current),
      toggleStrip: () => setStripVisible((v) => !v),
      exit: () => navigate("/"),
      toggleBookmarks: () => setBookmarksOpen((v) => !v),
      jumpFraction: (f) => {
        if (!comic) return;
        // Map the digit to a fraction of the navigable range, then clamp
        // to maxStartPage so a digit jump in double-spread can't land
        // past the last spread (which would be a redundant single page
        // and also cause goNext to step backward).
        let target = Math.round(f * maxStartPage);
        if (isDoubleSpread) target = target - (target % 2);
        setPage(Math.max(0, Math.min(target, maxStartPage)));
      },
      jumpHome: () => setPage(0),
      jumpEnd: () => comic && setPage(maxStartPage),
      goto: () => setGotoOpen((v) => !v),
      resetZoom: () => setZoom(1),
      toggleHelp: () => setHelpOpen((v) => !v),
      allowVerticalArrowPaging: false,
      onArrowDown: () => {
        if (mode === "webtoon" || mode === "scroll-v") {
          void scrollStep(1);
          return;
        }
        if (!scrollStep(1)) goNext();
      },
      onArrowUp: () => {
        if (mode === "webtoon" || mode === "scroll-v") {
          void scrollStep(-1);
          return;
        }
        if (!scrollStep(-1)) goPrev();
      },
      shortcuts,
    },
    !!comic,
  );

  // Touch gestures: swipe horizontally to turn pages, double-tap to
  // toggle fit-width / original. RTL inverts the swipe direction so
  // "going forward" is the natural reading-direction swipe.
  useTouchGestures(() => shellRef.current, {
    onSwipeLeft: () => (rtl ? goPrev() : goNext()),
    onSwipeRight: () => (rtl ? goNext() : goPrev()),
    onDoubleTap: () => {
      const next = fitMode === "fit-width" ? "original" : "fit-width";
      void updateSettings({ fitMode: next });
    },
    // Pinch: scale is the ratio between consecutive frames, so we
    // multiply it into the current zoom rather than treating it as an
    // absolute factor. Clamp matches the wheel handler AND the server's
    // zod schema (0.5..4) so a pinch-out can never produce a value the
    // backend would reject.
    onPinch: (scale) =>
      setZoom((z) => clampZoom(z * scale)),
  });

  // Wheel + Ctrl zoom
  useEffect(() => {
    function onWheel(e: WheelEvent) {
      if (!e.ctrlKey) return;
      e.preventDefault();
      // Smooth exponential zoom so trackpads/wheels feel natural.
      const factor = Math.exp(-e.deltaY * 0.0015);
      setZoom((z) => clampZoom(z * factor));
    }
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, [clampZoom]);

  // Reader-centric keyboard zoom for convenience (+ / - / 0).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target;
      if (target instanceof HTMLTextAreaElement) return;
      if (target instanceof HTMLInputElement && (target.type === "text" || target.type === "search" || target.type === "number" || target.type === "email" || target.type === "url" || target.type === "tel")) return;
      if (target instanceof HTMLElement && target.isContentEditable) return;
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        setZoom((z) => clampZoom(z + ZOOM_STEP));
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        setZoom((z) => clampZoom(z - ZOOM_STEP));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clampZoom]);

  useEffect(() => {
    setShowZoomHud(true);
    const t = window.setTimeout(() => setShowZoomHud(false), 800);
    return () => window.clearTimeout(t);
  }, [zoom]);

  // Auto-advance to next comic. Fires once when (a) the user is on the last
  // page, (b) the setting is enabled, (c) we resolved a next-in-series, and
  // (d) the user hasn't dismissed the prompt for this comic. The ref guard
  // prevents re-firing if React re-renders.
  const openNext = useCallback(() => {
    if (!nextComic) return;
    navigate(`/read/${nextComic.id}`);
  }, [nextComic, navigate]);

  useEffect(() => {
    if (!comic || !nextComic) return;
    if (!settings?.autoAdvanceToNext) return;
    if (nextDismissed) return;
    if (!isAtEnd) return;
    if (autoAdvanceFired.current) return;
    autoAdvanceFired.current = true;
    push(`Siguiente: ${nextComic.title}`, "success");
    const t = window.setTimeout(() => navigate(`/read/${nextComic.id}`), 300);
    return () => window.clearTimeout(t);
  }, [comic, nextComic, isAtEnd, settings?.autoAdvanceToNext, nextDismissed, push, navigate]);

  // Auto-scroll only makes sense in vertical scroll modes; pause it
  // automatically when the user switches to a paged mode so the toggle
  // doesn't quietly stay armed.
  const isVerticalScrollMode = mode === "webtoon" || mode === "scroll-v";
  useEffect(() => {
    if (!isVerticalScrollMode && autoScrolling) setAutoScrolling(false);
  }, [isVerticalScrollMode, autoScrolling]);
  useAutoScroll(
    () => scrollableRef.current,
    autoScrolling && isVerticalScrollMode,
    settings?.autoScrollSpeed ?? 80,
  );

  if (!comic) {
    return (
      <div className="grid h-full w-full place-items-center bg-black text-ink-400 text-sm">Cargando…</div>
    );
  }

  if (comic.pageCount === 0) {
    return (
      <div className="grid h-full w-full place-items-center bg-[#030408] text-center p-8">
        <div className="space-y-4">
          <div className="text-4xl">⚠️</div>
          <h2 className="text-xl font-bold text-white">Este cómic no tiene páginas</h2>
          <p className="text-slate-500 max-w-xs mx-auto">
            El archivo podría estar dañado o no contiene imágenes compatibles.
          </p>
          <button onClick={() => navigate("/")} className="pl-btn-primary mt-4">
            Volver a la biblioteca
          </button>
        </div>
      </div>
    );
  }

  // Denominator is the last navigable start-of-view, so progress reaches
  // 100% on the final spread of an even-pageCount comic in paged-h-2 mode.
  const progressPct = maxStartPage > 0 ? (page / maxStartPage) * 100 : 100;

  return (
    <div
      ref={shellRef}
      data-image-filter={settings?.imageFilter ?? "none"}
      data-reduce-motion={settings?.reduceMotion ? "1" : "0"}
      className="reader-shell relative h-screen w-screen overflow-hidden"
    >
      {/* Reading area */}
      {mode === "webtoon" ? (
        <WebtoonView
          comicId={comic.id}
          pageCount={comic.pageCount}
          current={page}
          autoCrop={autoCrop}
          zoom={zoom}
          onPageChange={setPage}
          scrollRef={scrollableRef}
          pageGap={pageGap}
          maxWidth={maxWidth}
          imageQuality={imageQuality}
        />
      ) : mode === "scroll-v" ? (
        <ContinuousView
          comicId={comic.id}
          pageCount={comic.pageCount}
          current={page}
          fitMode={fitMode}
          axis="vertical"
          autoCrop={autoCrop}
          zoom={zoom}
          onPageChange={setPage}
          scrollRef={scrollableRef}
          pageGap={pageGap}
          maxWidth={maxWidth}
          sidePadding={sidePadding}
          preloadWindow={preloadWindow}
          imageQuality={imageQuality}
        />
      ) : mode === "paged-h-2" ? (
        <DoublePage
          comicId={comic.id}
          page={page}
          pageCount={comic.pageCount}
          fitMode={fitMode}
          zoom={zoom}
          rtl={rtl}
          autoCrop={autoCrop}
          scrollRef={scrollableRef}
          imageQuality={imageQuality}
          pageGap={pageGap}
          onClickZone={(zone) => {
            if (zone === "prev") goPrev();
            else if (zone === "next") goNext();
          }}
        />
      ) : (
        <PagedView
          comicId={comic.id}
          page={page}
          fitMode={fitMode}
          zoom={zoom}
          rtl={rtl}
          autoCrop={autoCrop}
          axis={mode === "paged-v" ? "vertical" : "horizontal"}
          scrollRef={scrollableRef}
          imageQuality={imageQuality}
          onClickZone={(zone) => {
            if (zone === "prev") goPrev();
            else if (zone === "next") goNext();
          }}
        />
      )}

      {/* Thin progress bar at the very top — opt-out via Settings. */}
      <TopProgressBar progressPct={progressPct} visible={settings?.showTopProgress ?? true} />

      {/* Keyboard shortcuts overlay — toggled with `?`. Lives outside the
          UI-overlay tree so it stays visible regardless of idle state. */}
      <KeyboardHelp open={helpOpen} onClose={() => setHelpOpen(false)} shortcuts={shortcuts} />

      {/* Goto-page popover — anchored to the top bar. The component owns
          its own focus and dismiss behavior. */}
      <GotoInput
        open={gotoOpen}
        pageCount={comic.pageCount}
        onSubmit={(p) => {
          // In double-spread, snap to the start of a spread so the
          // user lands on a "page 1" of the pair instead of an
          // orphaned right-page. Then clamp to maxStartPage.
          let target = p;
          if (isDoubleSpread) target = target - (target % 2);
          setPage(Math.max(0, Math.min(target, maxStartPage)));
        }}
        onClose={() => setGotoOpen(false)}
      />

      {/* Next-in-series prompt (shown only on the last page; single-comic
          libraries with no next produce nothing). */}
      <NextComicPrompt
        next={nextComic}
        visible={!!comic && !nextDismissed && isAtEnd}
        uiVisible={uiVisible}
        onOpen={openNext}
        onDismiss={() => setNextDismissed(true)}
      />

      {/* Top bar */}
      <div
        className={clsx(
          "reader-overlay pointer-events-none absolute left-0 right-0 top-0 z-20 flex items-center justify-between gap-3 px-4 py-3",
          overlayVisible ? "opacity-100" : "opacity-0",
        )}
      >
        <div className="pointer-events-auto flex items-center gap-2">
          <button onClick={() => navigate("/")} className="pl-btn !bg-ink-800/80">
            ← Salir
          </button>
          <span className="ml-2 max-w-[40vw] truncate text-sm text-ink-100">{comic.title}</span>
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          {/* Mode selector — quick visual switch without opening the panel. */}
          <ModeSelector
            value={mode}
            onChange={(m) => void updateSettings({ readingMode: m })}
          />
          {/* Auto-scroll play/pause, only for vertical scroll modes. */}
          {isVerticalScrollMode && (
            <button
              onClick={() => setAutoScrolling((v) => !v)}
              className="pl-btn !bg-ink-800/80"
              aria-label={autoScrolling ? "Pausar auto-scroll" : "Iniciar auto-scroll"}
              title={autoScrolling ? "Pausar auto-scroll" : "Iniciar auto-scroll"}
            >
              {autoScrolling ? "❚❚" : "▶"}
            </button>
          )}
          <button
            className="pl-pill cursor-pointer hover:bg-ink-700/80"
            // While the popover is open, its input has focus; without
            // preventDefault on mousedown the input would blur first
            // (closing the popover) and our click would then re-open it,
            // making the pill incapable of dismissing what it opened.
            onMouseDown={(e) => { if (gotoOpen) e.preventDefault(); }}
            onClick={() => setGotoOpen((v) => !v)}
            // Double-click resets zoom — handy when you've panned/zoomed
            // way off and want to snap back without reaching for Ctrl+0.
            onDoubleClick={(e) => { e.preventDefault(); setZoom(1); setGotoOpen(false); }}
            aria-label="Saltar a página"
            title="Ir a página (G) · doble click: reset zoom"
          >
            {page + 1} / {comic.pageCount}
          </button>
          <div className="flex items-center gap-1.5 rounded-xl bg-ink-800/80 px-2 py-1">
            <button onClick={() => setZoom((z) => clampZoom(z - ZOOM_STEP))} className="pl-btn !px-2 !py-1 !text-xs !bg-transparent hover:!bg-ink-700/80" title="Alejar (-)">−</button>
            <input
              type="range"
              min={ZOOM_MIN}
              max={ZOOM_MAX}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(clampZoom(parseFloat(e.target.value)))}
              onPointerUp={(e) => (e.currentTarget as HTMLInputElement).blur()}
              aria-label="Nivel de zoom"
              className="w-20 accent-accent"
              title="Nivel de zoom"
            />
            <button onClick={() => setZoom((z) => clampZoom(z + ZOOM_STEP))} className="pl-btn !px-2 !py-1 !text-xs !bg-transparent hover:!bg-ink-700/80" title="Acercar (+)">+</button>
            <button onClick={() => setZoom(1)} className="pl-btn !px-2 !py-1 !text-[10px] !bg-transparent hover:!bg-ink-700/80" title="Reset (Ctrl+0)">1:1</button>
          </div>
          <ClockEta
            page={page}
            pageCount={comic.pageCount}
            pagesPerMinute={mode === "webtoon" ? 20 : isDoubleSpread ? 15 : 7.5}
          />
          <button
            onClick={() => setBookmarksOpen((v) => !v)}
            className="pl-btn !bg-ink-800/80"
            aria-label="Marcadores"
            title="Marcadores (B)"
          >
            ☰
          </button>
          <button
            onClick={() => setHelpOpen((v) => !v)}
            className="pl-btn !bg-ink-800/80"
            aria-label="Atajos de teclado"
            title="Atajos de teclado (?)"
          >
            ?
          </button>
          <button onClick={() => setQuickOpen((v) => !v)} className="pl-btn !bg-ink-800/80" aria-label="Configuración">
            ⚙
          </button>
          <button onClick={() => toggleFs(shellRef.current)} className="pl-btn !bg-ink-800/80" aria-label="Pantalla completa">
            {isFs ? "⤢" : "⛶"}
          </button>
        </div>
      </div>

      <QuickSettings open={quickOpen} onClose={() => setQuickOpen(false)} />

      <div
        className={clsx(
          "pointer-events-none absolute right-4 bottom-28 z-30 rounded-xl bg-ink-800/80 px-3 py-1.5 text-xs font-bold text-ink-100 transition-all",
          showZoomHud ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2",
        )}
      >
        Zoom {Math.round(zoom * 100)}%
      </div>

      <BookmarksPanel
        comicId={comic.id}
        open={bookmarksOpen}
        currentPage={page}
        pageCount={comic.pageCount}
        onClose={() => setBookmarksOpen(false)}
        onJump={(p) => {
          setPage(p);
          setBookmarksOpen(false);
        }}
      />

      {/* Bottom bar */}
      <div
        className={clsx(
          "reader-overlay absolute left-0 right-0 bottom-0 z-20 flex flex-col gap-1 bg-gradient-to-t from-black/80 to-transparent px-4 pb-2 pt-6",
          overlayVisible ? "opacity-100" : "opacity-0",
        )}
      >
        <div className="mx-2 flex items-center gap-2">
          <input
            type="range"
            min={0}
            max={maxStartPage}
            step={isDoubleSpread ? 2 : 1}
            value={page}
            onChange={(e) => {
              // Clamp to maxStartPage so dragging the slider past the
              // last spread can't put goNext into a backward step.
              const v = parseInt(e.target.value, 10);
              setPage(Math.max(0, Math.min(v, maxStartPage)));
            }}
            // After a click/drag, drop focus so the slider stops eating
            // ArrowUp/Down and the user's next keypress flows into the
            // global reader shortcuts (scroll / page turn) instead.
            onPointerUp={(e) => (e.currentTarget as HTMLInputElement).blur()}
            aria-label="Página actual"
            className="flex-1 accent-accent"
          />
          <span className="text-xs text-ink-200">{Math.round(progressPct)}%</span>
          <button
            onClick={() => updateSettings({ showThumbStrip: !stripVisible })}
            className="rounded-md bg-ink-800/80 px-2 py-1 text-xs text-ink-200 hover:bg-ink-700"
          >
            {stripVisible ? "Ocultar miniaturas" : "Mostrar miniaturas"}
          </button>
        </div>
        {stripVisible && (
          <ThumbnailStrip
            comicId={comic.id}
            pageCount={comic.pageCount}
            current={page}
            rtl={rtl}
            onSelect={setPage}
          />
        )}
      </div>
    </div>
  );
}
