import clsx from "clsx";

// Eight bundled SVG presets — pure, abstract, single-letter glyphs on a
// gradient. Inline so they ship without extra HTTP requests, and so they
// re-tint with the active accent colour through `currentColor`.
const PRESETS = [
  { id: "p1", glyph: "P", grad: ["#7c5cff", "#3b82f6"] },
  { id: "p2", glyph: "L", grad: ["#10b981", "#06b6d4"] },
  { id: "p3", glyph: "M", grad: ["#f59e0b", "#ef4444"] },
  { id: "p4", glyph: "K", grad: ["#ec4899", "#a855f7"] },
  { id: "p5", glyph: "S", grad: ["#0ea5e9", "#22d3ee"] },
  { id: "p6", glyph: "A", grad: ["#84cc16", "#facc15"] },
  { id: "p7", glyph: "R", grad: ["#f43f5e", "#fb923c"] },
  { id: "p8", glyph: "Y", grad: ["#6366f1", "#8b5cf6"] },
] as const;

export type AvatarPresetId = typeof PRESETS[number]["id"];

export function getPresetById(id: string): typeof PRESETS[number] | null {
  return PRESETS.find((p) => p.id === id) ?? null;
}

interface PresetSvgProps {
  id: string;
  size?: number;
  className?: string;
}

/** Inline SVG renderer for a preset id (e.g. "p3"). Falls back to first preset. */
export function PresetAvatar({ id, size = 40, className }: PresetSvgProps) {
  const preset = getPresetById(id) ?? PRESETS[0];
  const gradId = `g-${preset.id}`;
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={preset.grad[0]} />
          <stop offset="100%" stopColor={preset.grad[1]} />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="32" fill={`url(#${gradId})`} />
      <text
        x="50%"
        y="54%"
        textAnchor="middle"
        dominantBaseline="middle"
        fontFamily="Inter, system-ui, sans-serif"
        fontWeight="600"
        fontSize="28"
        fill="white"
      >
        {preset.glyph}
      </text>
    </svg>
  );
}

interface AvatarProps {
  value: string | null;
  size?: number;
  className?: string;
  fallbackText?: string | null;
}

/** Renders whatever the user has stored: a preset or a data URL. */
export function Avatar({ value, size = 40, className, fallbackText }: AvatarProps) {
  if (!value) {
    const text = (fallbackText || "").trim().toUpperCase().slice(0, 2);
    if (text) {
      return (
        <div
          className={clsx("rounded-full grid place-items-center bg-blue-600 text-white font-black", className)}
          style={{ width: size, height: size, fontSize: Math.max(12, Math.round(size * 0.36)) }}
        >
          {text}
        </div>
      );
    }
    return <PresetAvatar id="p1" size={size} className={className} />;
  }
  if (value.startsWith("preset:")) {
    return <PresetAvatar id={value.slice(7)} size={size} className={className} />;
  }
  // data: URL → just render as <img>
  return (
    <img
      src={value}
      alt=""
      width={size}
      height={size}
      className={clsx("rounded-full object-cover", className)}
      style={{ width: size, height: size }}
    />
  );
}

interface SelectorProps {
  value: string | null;
  onChange: (value: string) => void;
}

export function AvatarPresetGrid({ value, onChange }: SelectorProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {PRESETS.map((p) => {
        const id = `preset:${p.id}`;
        const active = value === id;
        return (
          <button
            key={p.id}
            onClick={() => onChange(id)}
            className={clsx(
              "rounded-full transition-transform",
              active ? "ring-2 ring-accent ring-offset-2 ring-offset-ink-900 scale-105" : "hover:scale-105",
            )}
            aria-label={`Avatar ${p.id}`}
          >
            <PresetAvatar id={p.id} size={44} />
          </button>
        );
      })}
    </div>
  );
}
