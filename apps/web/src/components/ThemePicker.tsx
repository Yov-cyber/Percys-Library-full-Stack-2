import { useMemo, useState } from "react";
import { THEMES, THEME_GROUPS, type ThemeGroup, type ThemePreset } from "../lib/themes";

interface Props {
  value: string;
  onChange: (id: string) => void;
}

/**
 * Grid picker showing every theme as a small swatch (bg + surface + accent).
 * Click selects. Group filter at the top trims the grid by category.
 */
import { useSettingsStore } from "../stores/settings";

export function ThemePicker({ value, onChange }: Props) {
  const settings = useSettingsStore((s) => s.settings);
  const [group, setGroup] = useState<ThemeGroup | "custom" | "all">("all");
  const customThemes = useMemo<ThemePreset[]>(() => {
    try {
      return JSON.parse(settings?.customThemes || "[]");
    } catch (error) {
      console.warn("No se pudieron leer los temas personalizados", error);
      return [];
    }
  }, [settings?.customThemes]);
  
  const visible = useMemo(() => {
    const allThemes = [...THEMES, ...customThemes];
    
    if (group === "all") return allThemes;
    if (group === "custom") return customThemes;
    return THEMES.filter((t) => t.group === group);
  }, [customThemes, group]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        <FilterChip
          active={group === "all"}
          onClick={() => setGroup("all")}
          label={`Todos (${THEMES.length + customThemes.length})`}
        />
        <FilterChip
          active={group === "custom"}
          onClick={() => setGroup("custom")}
          label="Personalizados"
        />
        {THEME_GROUPS.map((g) => (
          <FilterChip
            key={g.id}
            active={group === g.id}
            onClick={() => setGroup(g.id)}
            label={g.label}
          />
        ))}
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
        {visible.map((t) => (
          <ThemeSwatch
            key={t.id}
            theme={t}
            active={value === t.id}
            onClick={() => onChange(t.id)}
          />
        ))}
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs transition ${
        active
          ? "bg-accent/30 text-accent ring-1 ring-accent/40"
          : "bg-ink-800 text-ink-300 hover:bg-ink-700"
      }`}
    >
      {label}
    </button>
  );
}

function ThemeSwatch({
  theme,
  active,
  onClick,
}: {
  theme: ThemePreset;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={theme.name}
      aria-label={theme.name}
      aria-pressed={active}
      className={`group rounded-lg overflow-hidden border transition ${
        active
          ? "border-accent ring-2 ring-accent/50"
          : "border-ink-700/60 hover:border-ink-600"
      }`}
    >
      <div
        className="h-12 w-full flex items-center justify-center relative"
        style={{ backgroundColor: theme.bg }}
      >
        <div className="flex gap-1.5">
          <span
            className="h-5 w-5 rounded-full ring-1 ring-black/20"
            style={{ backgroundColor: theme.surface1 }}
          />
          <span
            className="h-5 w-5 rounded-full ring-1 ring-black/20"
            style={{ backgroundColor: theme.surface2 }}
          />
          <span
            className="h-5 w-5 rounded-full ring-1 ring-black/20"
            style={{ backgroundColor: theme.accent }}
          />
        </div>
      </div>
      <div
        className="px-1.5 py-1 text-[10px] truncate text-center"
        style={{ backgroundColor: theme.surface1, color: theme.text1 }}
      >
        {theme.name}
      </div>
    </button>
  );
}
