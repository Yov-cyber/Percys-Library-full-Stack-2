export type ShortcutAction =
  | "next"
  | "prev"
  | "toggleFs"
  | "toggleStrip"
  | "toggleBookmarks"
  | "goto"
  | "toggleHelp"
  | "exit";

export type ShortcutMap = Record<ShortcutAction, string>;

export const DEFAULT_SHORTCUTS: ShortcutMap = {
  next: "ArrowRight",
  prev: "ArrowLeft",
  toggleFs: "f",
  toggleStrip: "t",
  toggleBookmarks: "b",
  goto: "g",
  toggleHelp: "?",
  exit: "Escape",
};

const ACTIONS: ShortcutAction[] = [
  "next",
  "prev",
  "toggleFs",
  "toggleStrip",
  "toggleBookmarks",
  "goto",
  "toggleHelp",
  "exit",
];

export function parseShortcutMap(raw: string | null | undefined): ShortcutMap {
  let parsed: unknown = {};
  try {
    parsed = JSON.parse(raw || "{}");
  } catch {
    parsed = {};
  }
  const input = (parsed && typeof parsed === "object" ? parsed : {}) as Record<string, unknown>;
  const out = { ...DEFAULT_SHORTCUTS };
  for (const action of ACTIONS) {
    const v = input[action];
    if (typeof v === "string" && v.trim()) out[action] = normalizeShortcutKey(v);
  }
  return out;
}

export function normalizeShortcutKey(key: string): string {
  const k = key.trim();
  if (k.length === 1) return k.toLowerCase();
  return k;
}

export function formatShortcutKey(key: string): string {
  switch (key) {
    case " ":
      return "Espacio";
    case "Escape":
      return "Esc";
    case "ArrowRight":
      return "→";
    case "ArrowLeft":
      return "←";
    case "ArrowUp":
      return "↑";
    case "ArrowDown":
      return "↓";
    default:
      return key.length === 1 ? key.toUpperCase() : key;
  }
}

