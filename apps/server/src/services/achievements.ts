import { prisma } from "../db";

/**
 * Catalog: the user-facing description + an unlock predicate evaluated
 * against the global reader context. Predicates are deliberately
 * idempotent and based on retroactive metrics (longestStreak, totalRead,
 * etc.) so re-evaluating the catalog never "downgrades" an unlocked
 * achievement.
 */
export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  /** Optional category for grouping in the UI. */
  group: AchievementGroup;
  /** Optional difficulty hint for the UI (1=easy, 5=ultra). */
  tier?: 1 | 2 | 3 | 4 | 5;
  /** Whether the achievement is hidden from the list until unlocked. */
  secret?: boolean;
  check: (ctx: AchievementCtx) => boolean;
}

export type AchievementGroup =
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

export interface AchievementCtx {
  /** Comics fully completed. */
  totalRead: number;
  /** Sum of pages read across the library (completed comics + currentPage+1 of in-progress). */
  totalPages: number;
  /** Days streak ending today/yesterday. */
  currentStreak: number;
  /** Best streak ever recorded. */
  longestStreak: number;
  /** Comics flagged as favourite. */
  favorites: number;
  /** Total comics in the library (regardless of progress). */
  libraryComics: number;
  /** Distinct categories among completed comics. */
  categoriesCompleted: number;
  /** Distinct formats among completed comics (cbz/cbr/pdf/folder). */
  formatsCompleted: number;
  /** Set of formats the user has completed at least one comic in. */
  completedFormats: Set<string>;
  /** Total reading days recorded (all-time). */
  totalReadingDays: number;
  /** Reading days within the last 7 / 30 calendar days. */
  daysActive7: number;
  daysActive30: number;
  /** Page count of the longest comic the user has completed. */
  longestComicCompleted: number;
  /** Highest single-day pagesRead value across all readingDays. */
  bestDayPages: number;
  /** Total pages read on the most recent day. */
  todayPages: number;
}

const PAGE_TIERS = [25, 50, 100, 250, 500, 750, 1_000, 2_500, 5_000, 10_000, 25_000, 50_000, 100_000];
const COMIC_TIERS = [1, 2, 3, 5, 7, 10, 15, 25, 50, 75, 100, 250, 500, 1_000];
const STREAK_TIERS = [3, 7, 14, 30, 60, 100, 180, 365];
const CURRENT_STREAK_TIERS = [7, 30, 100, 365];
const FAVORITE_TIERS = [1, 5, 10, 25, 50, 100];
const LIBRARY_TIERS = [10, 50, 100, 250, 500, 1_000];
const CATEGORY_TIERS = [1, 3, 5, 10];
const FORMAT_TIERS = [1, 2, 3, 4];
const READING_DAYS_TIERS = [1, 7, 30, 90, 180, 365];
const ACTIVE7_TIERS = [3, 5, 7];
const ACTIVE30_TIERS = [10, 20, 30];
const LONGEST_COMIC_TIERS = [50, 100, 200, 500, 1_000];
const BEST_DAY_TIERS = [50, 100, 250, 500, 1_000];

function tier(idx: number): 1 | 2 | 3 | 4 | 5 {
  if (idx <= 0) return 1;
  if (idx === 1) return 2;
  if (idx === 2) return 3;
  if (idx === 3) return 4;
  return 5;
}

function buildCatalog(): AchievementDef[] {
  const items: AchievementDef[] = [];

  // Milestones: comics completed
  const COMIC_TITLES: Record<number, string> = {
    1: "Primer cómic",
    2: "Pareja de lectura",
    3: "Triple jugada",
    5: "Coleccionista",
    7: "Lucky seven",
    10: "Decena",
    15: "Quinceañero",
    25: "Veteranía",
    50: "Medio centenar",
    75: "Setenta y cinco",
    100: "Centurión",
    250: "Bibliotecario",
    500: "Erudito",
    1_000: "Maestro lector",
  };
  COMIC_TIERS.forEach((n, i) => {
    items.push({
      id: `comics-${n}`,
      title: COMIC_TITLES[n] ?? `${n} cómics`,
      description: `Completa ${n} cómic${n === 1 ? "" : "s"}.`,
      group: "milestones",
      tier: tier(Math.min(i, 4)),
      check: (c) => c.totalRead >= n,
    });
  });

  // Pages read
  const PAGE_TITLES: Record<number, string> = {
    25: "Veinticinco páginas",
    50: "Cincuenta páginas",
    100: "Cien páginas",
    250: "Cuarto de millar",
    500: "Quinientas páginas",
    750: "Setecientas cincuenta",
    1_000: "Mil páginas",
    2_500: "Dos mil quinientas",
    5_000: "Maratonista",
    10_000: "Diez mil",
    25_000: "Devorador de páginas",
    50_000: "Bibliófilo",
    100_000: "Cien mil",
  };
  PAGE_TIERS.forEach((n, i) => {
    items.push({
      id: `pages-${n}`,
      title: PAGE_TITLES[n] ?? `${n} páginas`,
      description: `Lee ${n.toLocaleString("es")} páginas en total.`,
      group: "pages",
      tier: tier(Math.min(Math.floor(i / 2), 4)),
      check: (c) => c.totalPages >= n,
    });
  });

  // Longest streak
  STREAK_TIERS.forEach((n, i) => {
    items.push({
      id: `streak-${n}`,
      title:
        n === 3 ? "Constancia"
        : n === 7 ? "Una semana"
        : n === 14 ? "Quincena"
        : n === 30 ? "Un mes"
        : n === 60 ? "Dos meses"
        : n === 100 ? "Cien días"
        : n === 180 ? "Medio año"
        : "Un año entero",
      description: `Mantén una racha de ${n} día${n === 1 ? "" : "s"} leyendo.`,
      group: "streaks",
      tier: tier(Math.min(Math.floor(i / 2), 4)),
      check: (c) => c.longestStreak >= n,
    });
  });

  // Current streak (in-progress)
  CURRENT_STREAK_TIERS.forEach((n, i) => {
    items.push({
      id: `current-streak-${n}`,
      title:
        n === 7 ? "Siete actuales"
        : n === 30 ? "Mes activo"
        : n === 100 ? "Cien activos"
        : "Año activo",
      description: `Lleva ${n} días seguidos leyendo (racha actual).`,
      group: "streaks",
      tier: tier(Math.min(i, 4)),
      check: (c) => c.currentStreak >= n,
    });
  });

  // Favorites
  FAVORITE_TIERS.forEach((n, i) => {
    items.push({
      id: `fav-${n}`,
      title:
        n === 1 ? "Favorito"
        : n === 5 ? "Estantería preferida"
        : n === 10 ? "Top diez"
        : n === 25 ? "Caprichoso"
        : n === 50 ? "Devoto"
        : "Cien favoritos",
      description: `Marca ${n} cómic${n === 1 ? "" : "s"} como favorito${n === 1 ? "" : "s"}.`,
      group: "favorites",
      tier: tier(Math.min(i, 4)),
      check: (c) => c.favorites >= n,
    });
  });

  // Library size
  LIBRARY_TIERS.forEach((n, i) => {
    items.push({
      id: `library-${n}`,
      title: `Biblioteca de ${n}`,
      description: `Tu biblioteca alcanza los ${n} cómics.`,
      group: "library",
      tier: tier(Math.min(i, 4)),
      check: (c) => c.libraryComics >= n,
    });
  });

  // Categories explored
  CATEGORY_TIERS.forEach((n, i) => {
    items.push({
      id: `cat-${n}`,
      title:
        n === 1 ? "Primera categoría"
        : n === 3 ? "Variedad"
        : n === 5 ? "Curador"
        : "Explorador completo",
      description: `Completa cómics de ${n} categoría${n === 1 ? "" : "s"} distinta${n === 1 ? "" : "s"}.`,
      group: "categories",
      tier: tier(Math.min(i, 4)),
      check: (c) => c.categoriesCompleted >= n,
    });
  });

  // Formats
  FORMAT_TIERS.forEach((n, i) => {
    items.push({
      id: `fmt-${n}`,
      title:
        n === 1 ? "Primer formato"
        : n === 2 ? "Compatibilidad doble"
        : n === 3 ? "Triple formato"
        : "CBZ, CBR, PDF y carpeta",
      description: `Completa cómics en ${n} formato${n === 1 ? "" : "s"} distinto${n === 1 ? "" : "s"}.`,
      group: "formats",
      tier: tier(Math.min(i, 4)),
      check: (c) => c.formatsCompleted >= n,
    });
  });

  // Reading days totals
  READING_DAYS_TIERS.forEach((n, i) => {
    items.push({
      id: `days-${n}`,
      title:
        n === 1 ? "Primer día"
        : n === 7 ? "Una semana de lectura"
        : n === 30 ? "Un mes de lectura"
        : n === 90 ? "Trimestre"
        : n === 180 ? "Semestre"
        : "Un año en la biblioteca",
      description: `Acumula ${n} día${n === 1 ? "" : "s"} de lectura totales.`,
      group: "milestones",
      tier: tier(Math.min(i, 4)),
      check: (c) => c.totalReadingDays >= n,
    });
  });

  // Activity windows
  ACTIVE7_TIERS.forEach((n, i) => {
    items.push({
      id: `active7-${n}`,
      title: `Activo ${n}/7`,
      description: `Lee ${n} día${n === 1 ? "" : "s"} en los últimos 7.`,
      group: "streaks",
      tier: tier(Math.min(i, 4)),
      check: (c) => c.daysActive7 >= n,
    });
  });
  ACTIVE30_TIERS.forEach((n, i) => {
    items.push({
      id: `active30-${n}`,
      title: `Activo ${n}/30`,
      description: `Lee ${n} días en los últimos 30.`,
      group: "streaks",
      tier: tier(Math.min(i, 4)),
      check: (c) => c.daysActive30 >= n,
    });
  });

  // Long comics
  LONGEST_COMIC_TIERS.forEach((n, i) => {
    items.push({
      id: `longcomic-${n}`,
      title:
        n === 50 ? "Volumen entero"
        : n === 100 ? "Cien páginas de un tirón"
        : n === 200 ? "Tomo grueso"
        : n === 500 ? "Compendio"
        : "Mil páginas en uno",
      description: `Completa un cómic de al menos ${n} páginas.`,
      group: "milestones",
      tier: tier(Math.min(i, 4)),
      check: (c) => c.longestComicCompleted >= n,
    });
  });

  // Best single day
  BEST_DAY_TIERS.forEach((n, i) => {
    items.push({
      id: `bestday-${n}`,
      title:
        n === 50 ? "Sesión seria"
        : n === 100 ? "Cien en un día"
        : n === 250 ? "Maratón diaria"
        : n === 500 ? "Día épico"
        : "Mil en 24 horas",
      description: `Lee ${n} páginas en un solo día.`,
      group: "milestones",
      tier: tier(Math.min(i, 4)),
      check: (c) => c.bestDayPages >= n,
    });
  });

  // Hand-curated extras (raise count, add personality, mix metrics).
  const extras: AchievementDef[] = [
    {
      id: "first-favorite",
      title: "Primera estrella",
      description: "Marca tu primer cómic favorito.",
      group: "favorites",
      tier: 1,
      check: (c) => c.favorites >= 1,
    },
    {
      id: "first-streak",
      title: "Empieza la racha",
      description: "Lee dos días seguidos.",
      group: "streaks",
      tier: 1,
      check: (c) => c.longestStreak >= 2,
    },
    {
      id: "consistent-reader",
      title: "Lector consistente",
      description: "5 días activos en una semana.",
      group: "streaks",
      tier: 2,
      check: (c) => c.daysActive7 >= 5,
    },
    {
      id: "perfect-week",
      title: "Semana perfecta",
      description: "Los 7 días de la semana con lectura.",
      group: "streaks",
      tier: 3,
      check: (c) => c.daysActive7 >= 7,
    },
    {
      id: "perfect-month",
      title: "Mes perfecto",
      description: "30 días con lectura en el último mes.",
      group: "streaks",
      tier: 4,
      check: (c) => c.daysActive30 >= 30,
    },
    {
      id: "ten-favorites-of-fifty",
      title: "Selectivo",
      description: "Marca 10 favoritos teniendo al menos 50 cómics.",
      group: "favorites",
      tier: 3,
      check: (c) => c.favorites >= 10 && c.libraryComics >= 50,
    },
    {
      id: "library-curator",
      title: "Curador",
      description: "10 % de tu biblioteca como favorito (mínimo 20 cómics).",
      group: "favorites",
      tier: 4,
      check: (c) => c.libraryComics >= 20 && c.favorites >= Math.ceil(c.libraryComics * 0.1),
    },
    {
      id: "completionist-25",
      title: "Coleccionista completo",
      description: "Completa el 25 % de tu biblioteca (mínimo 10 cómics).",
      group: "milestones",
      tier: 3,
      check: (c) => c.libraryComics >= 10 && c.totalRead >= Math.ceil(c.libraryComics * 0.25),
    },
    {
      id: "completionist-50",
      title: "Mitad y mitad",
      description: "Completa el 50 % de tu biblioteca (mínimo 20 cómics).",
      group: "milestones",
      tier: 4,
      check: (c) => c.libraryComics >= 20 && c.totalRead >= Math.ceil(c.libraryComics * 0.5),
    },
    {
      id: "completionist-100",
      title: "Sin pendientes",
      description: "Completa toda tu biblioteca (mínimo 30 cómics).",
      group: "milestones",
      tier: 5,
      check: (c) => c.libraryComics >= 30 && c.totalRead === c.libraryComics,
    },
    {
      id: "format-cbz",
      title: "Lector de CBZ",
      description: "Completa al menos un cómic en formato CBZ.",
      group: "formats",
      tier: 1,
      check: (c) => c.completedFormats.has("cbz"),
    },
    {
      id: "format-cbr",
      title: "Lector de CBR",
      description: "Completa al menos un cómic en formato CBR.",
      group: "formats",
      tier: 1,
      check: (c) => c.completedFormats.has("cbr"),
    },
    {
      id: "format-pdf",
      title: "Lector de PDFs",
      description: "Completa al menos un cómic en formato PDF.",
      group: "formats",
      tier: 1,
      check: (c) => c.completedFormats.has("pdf"),
    },
    {
      id: "format-folder",
      title: "Lector de carpetas",
      description: "Completa al menos un cómic en formato carpeta de imágenes.",
      group: "formats",
      tier: 1,
      check: (c) => c.completedFormats.has("folder"),
    },
    {
      id: "all-formats",
      title: "Todos los formatos",
      description: "Completa cómics en CBZ, CBR, PDF y carpeta.",
      group: "formats",
      tier: 4,
      check: (c) => c.formatsCompleted >= 4,
    },
    {
      id: "binge-day",
      title: "Atracón",
      description: "Lee 200 páginas en un día.",
      group: "milestones",
      tier: 3,
      check: (c) => c.bestDayPages >= 200,
    },
    {
      id: "midnight-reader",
      title: "Lector nocturno",
      description: "Acumula 1000 páginas leídas.",
      group: "milestones",
      tier: 3,
      check: (c) => c.totalPages >= 1000,
    },
    {
      id: "page-turner",
      title: "Pasapáginas",
      description: "Lee 50 páginas hoy.",
      group: "milestones",
      tier: 1,
      check: (c) => c.todayPages >= 50,
    },
    {
      id: "marathoner-today",
      title: "Maratón del día",
      description: "Lee 200 páginas hoy.",
      group: "milestones",
      tier: 3,
      check: (c) => c.todayPages >= 200,
    },
    {
      id: "secret-double-streak",
      title: "Doble dedicación",
      description: "100 días de racha y 100 cómics completados.",
      group: "secret",
      tier: 5,
      secret: true,
      check: (c) => c.longestStreak >= 100 && c.totalRead >= 100,
    },
    {
      id: "secret-renaissance",
      title: "Renacentista",
      description: "Completa cómics de 5 categorías distintas y 4 formatos.",
      group: "secret",
      tier: 5,
      secret: true,
      check: (c) => c.categoriesCompleted >= 5 && c.formatsCompleted >= 4,
    },
    {
      id: "secret-time-traveler",
      title: "Viajero del tiempo",
      description: "365 días con lectura registrados.",
      group: "secret",
      tier: 5,
      secret: true,
      check: (c) => c.totalReadingDays >= 365,
    },
    {
      id: "secret-percy-disciple",
      title: "Discípulo de Percy",
      description: "1000 cómics completados. La biblioteca es tuya.",
      group: "secret",
      tier: 5,
      secret: true,
      check: (c) => c.totalRead >= 1000,
    },
  ];

  return [...items, ...extras];
}

export const ACHIEVEMENTS: AchievementDef[] = buildCatalog();

export async function computeContext(ownerId = "default"): Promise<AchievementCtx> {
  const totalRead = await prisma.comic.count({ where: { ownerId, completed: true } });
  type MinimalComic = {
    currentPage: number;
    completed: boolean;
    pageCount: number;
    format: string;
    category: string | null;
  };
  const allComics = (await prisma.comic.findMany({
    where: { ownerId },
    select: { currentPage: true, completed: true, pageCount: true, format: true, category: true },
  })) as MinimalComic[];
  // Completed cómics cuentan todas las páginas; en progreso cuenta currentPage + 1
  // (currentPage es 0-indexed, así que el lector ha visto currentPage + 1 páginas).
  const totalPages = allComics.reduce(
    (acc: number, c: MinimalComic) =>
      acc + (c.completed ? c.pageCount : Math.min(c.currentPage + 1, c.pageCount)),
    0,
  );
  const favorites = await prisma.comic.count({ where: { ownerId, isFavorite: true } });
  const libraryComics = allComics.length;

  // Distinct formats / categories among completed comics.
  const completed = allComics.filter((c: MinimalComic) => c.completed);
  const completedFormats = new Set<string>(completed.map((c: MinimalComic) => c.format));
  const formatsCompleted = completedFormats.size;
  const categoriesCompleted = new Set(
    completed
      .map((c: MinimalComic) => c.category)
      .filter((c: string | null): c is string => !!c && c.trim().length > 0),
  ).size;
  const longestComicCompleted = completed.reduce(
    (acc: number, c: MinimalComic) => Math.max(acc, c.pageCount),
    0,
  );

  // Reading-day metrics (streaks and activity windows).
  const days = await prisma.readingDay.findMany({ where: { ownerId }, orderBy: { date: "asc" } });
  let currentStreak = 0;
  let longestStreak = 0;
  let prev: Date | null = null;
  let running = 0;
  let bestDayPages = 0;
  for (const d of days) {
    const date = new Date(d.date + "T00:00:00Z");
    if (!prev || (date.getTime() - prev.getTime()) / 86400000 === 1) {
      running += 1;
    } else {
      running = 1;
    }
    longestStreak = Math.max(longestStreak, running);
    bestDayPages = Math.max(bestDayPages, d.pagesRead);
    prev = date;
  }
  if (prev) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const diff = (today.getTime() - prev.getTime()) / 86400000;
    if (diff <= 1) currentStreak = running;
  }

  // Activity in last N calendar days.
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const todayIso = today.toISOString().slice(0, 10);
  const ms = today.getTime();
  let daysActive7 = 0;
  let daysActive30 = 0;
  let todayPages = 0;
  for (const d of days) {
    const date = new Date(d.date + "T00:00:00Z");
    const ageDays = (ms - date.getTime()) / 86400000;
    if (ageDays >= 0 && ageDays < 7) daysActive7 += 1;
    if (ageDays >= 0 && ageDays < 30) daysActive30 += 1;
    if (d.date === todayIso) todayPages = d.pagesRead;
  }

  return {
    totalRead,
    totalPages,
    currentStreak,
    longestStreak,
    favorites,
    libraryComics,
    categoriesCompleted,
    formatsCompleted,
    completedFormats,
    totalReadingDays: days.length,
    daysActive7,
    daysActive30,
    longestComicCompleted,
    bestDayPages,
    todayPages,
  };
}

export async function evaluateAchievements(ownerId = "default"): Promise<{ id: string; unlocked: boolean }[]> {
  const ctx = await computeContext(ownerId);
  const rows = (await prisma.achievement.findMany({ where: { ownerId } })) as Array<{ id: string }>;
  const existing = new Set<string>(rows.map((a: { id: string }) => a.id));
  const results: { id: string; unlocked: boolean }[] = [];
  for (const def of ACHIEVEMENTS) {
    const unlocked = def.check(ctx);
    if (unlocked && !existing.has(def.id)) {
      await prisma.achievement.create({ data: { ownerId, id: def.id } });
    }
    results.push({ id: def.id, unlocked });
  }
  return results;
}

export async function recordReadingDay(ownerId = "default"): Promise<void> {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const iso = today.toISOString().slice(0, 10);
  await prisma.readingDay.upsert({
    where: { ownerId_date: { ownerId, date: iso } },
    update: { pagesRead: { increment: 1 } },
    create: { ownerId, date: iso, pagesRead: 1 },
  });
}
