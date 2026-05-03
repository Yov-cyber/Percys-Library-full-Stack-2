import clsx from "clsx";
import type { ShortcutMap } from "../../lib/shortcuts";
import { formatShortcutKey } from "../../lib/shortcuts";

interface Props {
  open: boolean;
  onClose: () => void;
  shortcuts: ShortcutMap;
}

/**
 * Discoverable keyboard-shortcuts overlay. Toggled with `?` from the
 * reader. Doesn't try to be exhaustive — it lists the shortcuts most
 * users will benefit from finding, not every binding the reader
 * happens to handle.
 */
export function KeyboardHelp({ open, onClose, shortcuts }: Props) {
  const rows: { keys: string[]; label: string }[] = [
    { keys: [formatShortcutKey(shortcuts.prev), formatShortcutKey(shortcuts.next), "Espacio"], label: "Página anterior / siguiente" },
    { keys: ["Inicio", "Fin"], label: "Primera / última página" },
    { keys: ["1", "…", "9", "0"], label: "Saltar al 10–100% del cómic" },
    { keys: [formatShortcutKey(shortcuts.goto)], label: "Saltar a página específica" },
    { keys: [formatShortcutKey(shortcuts.toggleFs)], label: "Pantalla completa" },
    { keys: [formatShortcutKey(shortcuts.toggleStrip)], label: "Mostrar / ocultar miniaturas" },
    { keys: [formatShortcutKey(shortcuts.toggleBookmarks)], label: "Marcadores" },
    { keys: ["Ctrl", "Rueda"], label: "Zoom" },
    { keys: ["Ctrl", "0"], label: "Restablecer zoom" },
    { keys: [formatShortcutKey(shortcuts.toggleHelp)], label: "Esta ayuda" },
    { keys: [formatShortcutKey(shortcuts.exit)], label: "Salir del lector" },
  ];
  if (!open) return null;
  return (
    <div
      className="absolute inset-0 z-40 grid place-items-center bg-black/60"
      onClick={onClose}
      role="dialog"
      aria-label="Atajos de teclado"
    >
      <div
        className="pointer-events-auto w-full max-w-md rounded-xl bg-ink-900 p-5 shadow-2xl ring-1 ring-ink-700"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink-100">Atajos de teclado</h2>
          <button onClick={onClose} className="pl-btn !bg-ink-800 px-2 py-1 text-xs" aria-label="Cerrar ayuda">
            ✕
          </button>
        </div>
        <ul className="space-y-2 text-sm">
          {rows.map((r) => (
            <li key={r.label} className="flex items-center justify-between gap-3">
              <span className="text-ink-300">{r.label}</span>
              <span className="flex flex-wrap items-center gap-1">
                {r.keys.map((k, i) => (
                  <kbd
                    key={i}
                    className={clsx(
                      "rounded-md border border-ink-600 bg-ink-800 px-1.5 py-0.5 text-xs text-ink-100 shadow-sm",
                    )}
                  >
                    {k}
                  </kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-ink-400">
          Toca el centro de la pantalla para mostrar / ocultar la barra superior. En táctil: pellizca para hacer
          zoom y desliza un dedo cuando hay zoom para mover la imagen.
        </p>
      </div>
    </div>
  );
}
