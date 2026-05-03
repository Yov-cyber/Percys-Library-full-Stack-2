/**
 * Theme catalog. Each preset is a complete palette so the UI can switch
 * looks without reloading. Adding a theme is just appending an entry —
 * the ThemeProvider applies all the colors via CSS variables and a
 * generated stylesheet that overrides the few Tailwind ink-* classes
 * the app uses for surfaces.
 *
 * Convention: id is kebab-case and stable (it's what we persist in
 * Settings.theme). Name is the user-facing label.
 */
export interface ThemePreset {
  id: string;
  name: string;
  /** "dark" tells the browser to colour-scheme native UI (form controls,
   *  scrollbars, selection) appropriately. */
  dark: boolean;
  /** Body background. */
  bg: string;
  /** Body foreground (default text). */
  fg: string;
  /** Cards / panels (Tailwind .bg-ink-800 surface). */
  surface1: string;
  /** Hover / inset surfaces (Tailwind .bg-ink-700 surface). */
  surface2: string;
  /** Stronger separators (.bg-ink-600). */
  surface3: string;
  /** Accent for buttons, highlights, progress. */
  accent: string;
  /** Secondary text. Falls back to text1 if omitted. */
  text1: string;
  /** Tertiary / muted text. */
  text2: string;
  /** Quaternary / placeholder. */
  text3: string;
  /** Border colour (used for ink-700/60 etc.). */
  border: string;
  /** Reader shell background (immersive area). */
  readerBg: string;
  /** Optional: scrollbar thumb (defaults to fg-mixed). */
  scrollbar?: string;
  /** Tag for grouping in the picker UI. */
  group: ThemeGroup;
}

export type ThemeGroup =
  | "classic"
  | "vibrant"
  | "neon"
  | "earthy"
  | "mono"
  | "pastel"
  | "contrast"
  | "special";

/**
 * Helper to keep entries terse.
 */
function t(
  id: string,
  name: string,
  group: ThemeGroup,
  dark: boolean,
  c: {
    bg: string;
    fg: string;
    surface1: string;
    surface2: string;
    surface3: string;
    accent: string;
    text1: string;
    text2: string;
    text3: string;
    border: string;
    readerBg?: string;
  },
): ThemePreset {
  return {
    id,
    name,
    group,
    dark,
    ...c,
    readerBg: c.readerBg ?? (dark ? "#050507" : c.bg),
  };
}

export const THEMES: ThemePreset[] = [
  // --- CLASSIC -----------------------------------------------------------
  t("dark", "Oscuro", "classic", true, {
    bg: "#0a0a10", fg: "#e8e8ec",
    surface1: "#15151c", surface2: "#1f1f29", surface3: "#2a2a36",
    accent: "#7c5cff",
    text1: "#dcdce4", text2: "#a8a8b3", text3: "#787884",
    border: "#3a3a47",
  }),
  t("light", "Claro", "classic", false, {
    bg: "#f6f6f9", fg: "#0a0a10",
    surface1: "#ececf2", surface2: "#dcdce4", surface3: "#c4c4ce",
    accent: "#5a3dff",
    text1: "#1c1c22", text2: "#4a4a55", text3: "#787884",
    border: "#9c9caa",
  }),
  t("manga", "Manga", "classic", true, {
    bg: "#1d1612", fg: "#f1e3c7",
    surface1: "#261d18", surface2: "#322620", surface3: "#3f2f27",
    accent: "#e0b56a",
    text1: "#d8c8a8", text2: "#a8967a", text3: "#7a6c54",
    border: "#594537",
  }),
  t("dim", "Atenuado", "classic", true, {
    bg: "#16161e", fg: "#d6d6dc",
    surface1: "#1d1d27", surface2: "#262631", surface3: "#30303c",
    accent: "#9b8cff",
    text1: "#cbcbd2", text2: "#9494a0", text3: "#666673",
    border: "#3d3d4a",
  }),
  t("slate", "Pizarra", "classic", true, {
    bg: "#0f172a", fg: "#e2e8f0",
    surface1: "#1e293b", surface2: "#334155", surface3: "#475569",
    accent: "#38bdf8",
    text1: "#cbd5e1", text2: "#94a3b8", text3: "#64748b",
    border: "#475569",
  }),
  t("midnight", "Medianoche", "classic", true, {
    bg: "#04060f", fg: "#dee3f0",
    surface1: "#0a0f1f", surface2: "#121a30", surface3: "#1c2645",
    accent: "#5b8def",
    text1: "#c8d0e2", text2: "#8794ad", text3: "#5e6a82",
    border: "#283454",
  }),

  // --- VIBRANT -----------------------------------------------------------
  t("sunset", "Atardecer", "vibrant", true, {
    bg: "#1a0f1d", fg: "#fbe7d2",
    surface1: "#26142b", surface2: "#34193b", surface3: "#451f4d",
    accent: "#ff6b6b",
    text1: "#f3d5b5", text2: "#c9a48a", text3: "#937060",
    border: "#523058",
  }),
  t("ocean", "Océano", "vibrant", true, {
    bg: "#031827", fg: "#cbe7f5",
    surface1: "#0a2438", surface2: "#13334d", surface3: "#1d4767",
    accent: "#22d3ee",
    text1: "#b1d8ed", text2: "#7cabc7", text3: "#527d97",
    border: "#1f4e72",
  }),
  t("forest", "Bosque", "vibrant", true, {
    bg: "#0c1a12", fg: "#d3e6cf",
    surface1: "#15261b", surface2: "#1d3526", surface3: "#284a35",
    accent: "#65d97c",
    text1: "#bcd6b6", text2: "#83a283", text3: "#5a7560",
    border: "#2f5840",
  }),
  t("lavender", "Lavanda", "vibrant", true, {
    bg: "#15101e", fg: "#e7defc",
    surface1: "#1f1830", surface2: "#2b2143", surface3: "#3a2c5a",
    accent: "#c084fc",
    text1: "#d8cdf2", text2: "#a496c4", text3: "#766a93",
    border: "#473466",
  }),
  t("rose", "Rosa", "vibrant", true, {
    bg: "#1a0d12", fg: "#f5d6dd",
    surface1: "#27121a", surface2: "#341822", surface3: "#46202d",
    accent: "#fb7185",
    text1: "#e0bbc4", text2: "#a98995", text3: "#7c6168",
    border: "#552732",
  }),
  t("amber", "Ámbar", "vibrant", true, {
    bg: "#1a1306", fg: "#f8e6c2",
    surface1: "#241a08", surface2: "#33240b", surface3: "#48330f",
    accent: "#fbbf24",
    text1: "#e0cd9d", text2: "#a89673", text3: "#796b53",
    border: "#5c3f10",
  }),

  // --- NEON --------------------------------------------------------------
  t("synthwave", "Synthwave", "neon", true, {
    bg: "#0e0226", fg: "#f3e7ff",
    surface1: "#180838", surface2: "#241050", surface3: "#311a6f",
    accent: "#ff5cf2",
    text1: "#dcccf2", text2: "#9c8ec3", text3: "#6e6597",
    border: "#3b1f7d",
  }),
  t("cyberpunk", "Cyberpunk", "neon", true, {
    bg: "#0c0c1a", fg: "#fff04d",
    surface1: "#15152a", surface2: "#1e1e3f", surface3: "#2a2a55",
    accent: "#ff2bd6",
    text1: "#fbe79e", text2: "#bba56b", text3: "#83734b",
    border: "#3b3b6e",
  }),
  t("tron", "Tron", "neon", true, {
    bg: "#000814", fg: "#a8ecff",
    surface1: "#001324", surface2: "#001f3a", surface3: "#002d54",
    accent: "#00d9ff",
    text1: "#9ad9ee", text2: "#5d99af", text3: "#3e6878",
    border: "#003d6e",
  }),
  t("miami", "Miami", "neon", true, {
    bg: "#1a0928", fg: "#ffe0f0",
    surface1: "#241036", surface2: "#311949", surface3: "#412565",
    accent: "#ff007a",
    text1: "#f6c4dc", text2: "#bd8ca7", text3: "#876377",
    border: "#562c7a",
  }),
  t("electric", "Eléctrico", "neon", true, {
    bg: "#020317", fg: "#dcf3ff",
    surface1: "#0b0c25", surface2: "#131638", surface3: "#1e2452",
    accent: "#3b82f6",
    text1: "#bfd7ee", text2: "#8295b1", text3: "#576683",
    border: "#22335e",
  }),
  t("neon-night", "Noche neón", "neon", true, {
    bg: "#08001a", fg: "#d3ffd1",
    surface1: "#11062a", surface2: "#1c0d3f", surface3: "#291557",
    accent: "#39ff14",
    text1: "#bdd9bb", text2: "#7fa07d", text3: "#577057",
    border: "#321967",
  }),

  // --- EARTHY ------------------------------------------------------------
  t("clay", "Arcilla", "earthy", true, {
    bg: "#1d1813", fg: "#f0e0cd",
    surface1: "#2a221a", surface2: "#3a2d22", surface3: "#4d3b2d",
    accent: "#d97757",
    text1: "#d4c2a8", text2: "#a08d77", text3: "#766656",
    border: "#5b4738",
  }),
  t("terracotta", "Terracota", "earthy", false, {
    bg: "#f4e9dd", fg: "#3a221a",
    surface1: "#ecdcc9", surface2: "#dec5a8", surface3: "#cdaa83",
    accent: "#c2410c",
    text1: "#5a3225", text2: "#7a4c3a", text3: "#9c6a4f",
    border: "#b08766",
  }),
  t("sage", "Salvia", "earthy", false, {
    bg: "#eef2e8", fg: "#1f2a1c",
    surface1: "#e0e8d8", surface2: "#cdd9c0", surface3: "#b0c0a1",
    accent: "#4d7c0f",
    text1: "#384830", text2: "#56684e", text3: "#7a8c70",
    border: "#9aa68e",
  }),
  t("mocha", "Moca", "earthy", true, {
    bg: "#1c1612", fg: "#e6d9ca",
    surface1: "#28201a", surface2: "#382c24", surface3: "#4a3a30",
    accent: "#a78360",
    text1: "#c8b89f", text2: "#94846f", text3: "#695b4b",
    border: "#54433a",
  }),
  t("cream", "Crema", "earthy", false, {
    bg: "#fbf5e9", fg: "#3a311e",
    surface1: "#f4ead4", surface2: "#e9dcb6", surface3: "#d6c388",
    accent: "#a16207",
    text1: "#574a30", text2: "#7a6a48", text3: "#a4906c",
    border: "#bba972",
  }),
  t("parchment", "Pergamino", "earthy", false, {
    bg: "#f5ecd2", fg: "#3a2f17",
    surface1: "#ebe0c0", surface2: "#dccea0", surface3: "#c8b67d",
    accent: "#854d0e",
    text1: "#574830", text2: "#7a6948", text3: "#a48c66",
    border: "#b69d6a",
  }),

  // --- MONO --------------------------------------------------------------
  t("graphite", "Grafito", "mono", true, {
    bg: "#101012", fg: "#dcdcde",
    surface1: "#19191c", surface2: "#232328", surface3: "#2e2e34",
    accent: "#a3a3ae",
    text1: "#c8c8cc", text2: "#94949c", text3: "#5e5e68",
    border: "#3a3a40",
  }),
  t("paper", "Papel", "mono", false, {
    bg: "#ffffff", fg: "#0a0a0a",
    surface1: "#f3f3f3", surface2: "#e5e5e5", surface3: "#d4d4d4",
    accent: "#262626",
    text1: "#171717", text2: "#525252", text3: "#a3a3a3",
    border: "#a3a3a3",
  }),
  t("charcoal", "Carbón", "mono", true, {
    bg: "#0c0c0d", fg: "#cfcfd1",
    surface1: "#161618", surface2: "#202024", surface3: "#2c2c31",
    accent: "#94949c",
    text1: "#bababd", text2: "#828289", text3: "#52525a",
    border: "#34343a",
  }),
  t("ash", "Ceniza", "mono", true, {
    bg: "#1a1a1c", fg: "#d6d6d8",
    surface1: "#222226", surface2: "#2c2c31", surface3: "#3a3a40",
    accent: "#71717a",
    text1: "#bdbdc0", text2: "#878789", text3: "#5d5d62",
    border: "#42424a",
  }),
  t("ink", "Tinta", "mono", true, {
    bg: "#050507", fg: "#bcbcc0",
    surface1: "#0c0c10", surface2: "#15151a", surface3: "#1f1f24",
    accent: "#737380",
    text1: "#a8a8ac", text2: "#73737a", text3: "#46464c",
    border: "#262630",
  }),
  t("snow", "Nieve", "mono", false, {
    bg: "#f8fafc", fg: "#0f172a",
    surface1: "#eff2f7", surface2: "#e1e6ee", surface3: "#cbd2dc",
    accent: "#0f172a",
    text1: "#1e293b", text2: "#475569", text3: "#94a3b8",
    border: "#cbd5e1",
  }),

  // --- PASTEL ------------------------------------------------------------
  t("cotton", "Algodón", "pastel", false, {
    bg: "#f5f3ff", fg: "#1e1b4b",
    surface1: "#ebe7fb", surface2: "#dcd5f5", surface3: "#c5bbeb",
    accent: "#7c3aed",
    text1: "#312e6d", text2: "#5b58a8", text3: "#8c89c9",
    border: "#b8b1dd",
  }),
  t("peach", "Durazno", "pastel", false, {
    bg: "#fff1ec", fg: "#3d1f0f",
    surface1: "#fde4d8", surface2: "#fbd2bd", surface3: "#f6b896",
    accent: "#ea580c",
    text1: "#5a3520", text2: "#82533a", text3: "#b07c60",
    border: "#dc9974",
  }),
  t("mint", "Menta", "pastel", false, {
    bg: "#ecfdf5", fg: "#022c22",
    surface1: "#d1fae5", surface2: "#a7f3d0", surface3: "#6ee7b7",
    accent: "#059669",
    text1: "#064e3b", text2: "#0f7560", text3: "#3ba288",
    border: "#86d3b4",
  }),
  t("lilac", "Lila", "pastel", false, {
    bg: "#faf5ff", fg: "#3b0764",
    surface1: "#f3e8ff", surface2: "#e9d5ff", surface3: "#d8b4fe",
    accent: "#9333ea",
    text1: "#581c87", text2: "#7e3eb0", text3: "#a778cd",
    border: "#cda9e3",
  }),
  t("sky", "Cielo", "pastel", false, {
    bg: "#f0f9ff", fg: "#082f49",
    surface1: "#dcefff", surface2: "#bae0fd", surface3: "#7cc8fa",
    accent: "#0284c7",
    text1: "#0c4a6e", text2: "#216892", text3: "#4f8bb0",
    border: "#8ac6e5",
  }),
  t("blossom", "Flor", "pastel", false, {
    bg: "#fdf2f8", fg: "#500724",
    surface1: "#fce7f3", surface2: "#fbcfe8", surface3: "#f9a8d4",
    accent: "#db2777",
    text1: "#831843", text2: "#a83a64", text3: "#cf7099",
    border: "#e0a4be",
  }),

  // --- CONTRAST ----------------------------------------------------------
  t("mono-light", "Alto contraste claro", "contrast", false, {
    bg: "#ffffff", fg: "#000000",
    surface1: "#f0f0f0", surface2: "#e0e0e0", surface3: "#c8c8c8",
    accent: "#000000",
    text1: "#0a0a0a", text2: "#3a3a3a", text3: "#6a6a6a",
    border: "#000000",
  }),
  t("mono-dark", "Alto contraste oscuro", "contrast", true, {
    bg: "#000000", fg: "#ffffff",
    surface1: "#0a0a0a", surface2: "#1a1a1a", surface3: "#2a2a2a",
    accent: "#ffffff",
    text1: "#f4f4f4", text2: "#c4c4c4", text3: "#949494",
    border: "#ffffff",
  }),
  t("blackboard", "Pizarra negra", "contrast", true, {
    bg: "#0d1f1f", fg: "#f0fff0",
    surface1: "#142929", surface2: "#1d3737", surface3: "#274545",
    accent: "#ffffff",
    text1: "#dceadc", text2: "#9ab1a4", text3: "#6e8377",
    border: "#345555",
  }),
  t("blueprint", "Plano azul", "contrast", true, {
    bg: "#0a2342", fg: "#e0eaff",
    surface1: "#102e54", surface2: "#163c6a", surface3: "#1d4d85",
    accent: "#ffffff",
    text1: "#c9d6f0", text2: "#88a0c8", text3: "#5d7297",
    border: "#264e87",
  }),
  t("sepia-high", "Sepia alto contraste", "contrast", false, {
    bg: "#f8efd5", fg: "#1c1108",
    surface1: "#ede2bf", surface2: "#dcceaa", surface3: "#c4b283",
    accent: "#1c1108",
    text1: "#33210f", text2: "#574228", text3: "#7a6648",
    border: "#9c8454",
  }),

  // --- SPECIAL -----------------------------------------------------------
  t("matrix", "Matrix", "special", true, {
    bg: "#000800", fg: "#39ff14",
    surface1: "#031703", surface2: "#062506", surface3: "#0a3d0a",
    accent: "#39ff14",
    text1: "#9affa0", text2: "#5cc060", text3: "#338a37",
    border: "#0a4d0a",
  }),
  t("gameboy", "Game Boy", "special", false, {
    bg: "#9bbc0f", fg: "#0f380f",
    surface1: "#8bac0f", surface2: "#7a9c0f", surface3: "#5e7a0d",
    accent: "#0f380f",
    text1: "#1e480f", text2: "#345b1f", text3: "#4e7028",
    border: "#406b13",
  }),
  t("terminal", "Terminal", "special", true, {
    bg: "#0c0c0c", fg: "#33ff33",
    surface1: "#141414", surface2: "#1c1c1c", surface3: "#262626",
    accent: "#ffaf00",
    text1: "#a4f4a4", text2: "#6ec56e", text3: "#458045",
    border: "#2e2e2e",
  }),
  t("vampire", "Vampiro", "special", true, {
    bg: "#0e0309", fg: "#f5d6df",
    surface1: "#1a0610", surface2: "#270a18", surface3: "#370f22",
    accent: "#dc2626",
    text1: "#e0bbc4", text2: "#a98995", text3: "#7c6168",
    border: "#451527",
  }),
  t("ice", "Hielo", "special", false, {
    bg: "#f0fafe", fg: "#082f49",
    surface1: "#dbeefa", surface2: "#bce0f5", surface3: "#8acae8",
    accent: "#0369a1",
    text1: "#0c4a6e", text2: "#216c93", text3: "#4f8eb0",
    border: "#7cb4d4",
  }),
  t("lava", "Lava", "special", true, {
    bg: "#170604", fg: "#ffe6d6",
    surface1: "#240a07", surface2: "#33110b", surface3: "#481b12",
    accent: "#f97316",
    text1: "#f0c8b4", text2: "#a98575", text3: "#7c5e52",
    border: "#5a261b",
  }),
  t("nord", "Nord", "special", true, {
    bg: "#2e3440", fg: "#eceff4",
    surface1: "#3b4252", surface2: "#434c5e", surface3: "#4c566a",
    accent: "#88c0d0",
    text1: "#d8dee9", text2: "#a4adba", text3: "#7a8493",
    border: "#4c566a",
  }),
  t("dracula", "Drácula", "special", true, {
    bg: "#282a36", fg: "#f8f8f2",
    surface1: "#343746", surface2: "#44475a", surface3: "#525469",
    accent: "#bd93f9",
    text1: "#e0e0d8", text2: "#a8aab2", text3: "#6c6f86",
    border: "#525469",
  }),
  t("solarized-dark", "Solarized oscuro", "special", true, {
    bg: "#002b36", fg: "#93a1a1",
    surface1: "#073642", surface2: "#0e4451", surface3: "#155060",
    accent: "#268bd2",
    text1: "#eee8d5", text2: "#93a1a1", text3: "#586e75",
    border: "#1f5b6c",
  }),
  t("solarized-light", "Solarized claro", "special", false, {
    bg: "#fdf6e3", fg: "#586e75",
    surface1: "#eee8d5", surface2: "#dccfaa", surface3: "#c4b690",
    accent: "#268bd2",
    text1: "#073642", text2: "#586e75", text3: "#93a1a1",
    border: "#b8a777",
  }),
  t("rose-gold", "Oro rosa", "special", false, {
    bg: "#fbe9e3", fg: "#3a1a14",
    surface1: "#f5d8cd", surface2: "#edbfae", surface3: "#dea18a",
    accent: "#b91c1c",
    text1: "#5a2820", text2: "#83483a", text3: "#a87060",
    border: "#c98c75",
  }),
  t("aurora", "Aurora", "special", true, {
    bg: "#0a1a2a", fg: "#e6f4ff",
    surface1: "#142944", surface2: "#1d3a5e", surface3: "#264e7c",
    accent: "#a3e635",
    text1: "#c8dcef", text2: "#85a0bd", text3: "#5b748d",
    border: "#2c5586",
  }),
  t("desert", "Desierto", "special", false, {
    bg: "#fdf3e3", fg: "#3a2306",
    surface1: "#f7e7c4", surface2: "#eed59a", surface3: "#dfba65",
    accent: "#a16207",
    text1: "#574020", text2: "#7a5e35", text3: "#a48259",
    border: "#c19858",
  }),
  t("ember", "Brasa", "special", true, {
    bg: "#1a0904", fg: "#ffd9c2",
    surface1: "#280f08", surface2: "#3a170d", surface3: "#522316",
    accent: "#ef4444",
    text1: "#f0bca0", text2: "#a98370", text3: "#785a4d",
    border: "#621d12",
  }),
];

/** Lookup a theme by id with a safe fallback to the dark default. */
export function getTheme(id: string | undefined | null): ThemePreset {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

/** Group themes for the picker UI. Order matches the section order in the picker. */
export const THEME_GROUPS: { id: ThemeGroup; label: string }[] = [
  { id: "classic", label: "Clásicos" },
  { id: "vibrant", label: "Vibrantes" },
  { id: "neon", label: "Neón" },
  { id: "earthy", label: "Tierra" },
  { id: "mono", label: "Monocromo" },
  { id: "pastel", label: "Pastel" },
  { id: "contrast", label: "Alto contraste" },
  { id: "special", label: "Especiales" },
];
