import clsx from "clsx";
import { NavLink } from "react-router-dom";
import { Avatar } from "./AvatarPresets";
import { useSettingsStore } from "../stores/settings";

const items = [
  { to: "/", label: "Biblioteca", icon: "library" },
  { to: "/favorites", label: "Favoritos", icon: "star" },
  { to: "/stats", label: "Estadísticas", icon: "chart" },
  { to: "/achievements", label: "Logros", icon: "trophy" },
  { to: "/settings", label: "Configuración", icon: "gear" },
];

function Icon({ name }: { name: string }) {
  switch (name) {
    case "library":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M4 5h6v14H4zM14 7h6v12h-6z" />
        </svg>
      );
    case "star":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M12 2.5l3 6.5 7 .9-5.2 4.7 1.5 7-6.3-3.6-6.3 3.6 1.5-7L2 9.9l7-.9z" />
        </svg>
      );
    case "chart":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M4 19h16M6 16V9m6 7V5m6 11v-6" />
        </svg>
      );
    case "trophy":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M8 4h8v4a4 4 0 1 1-8 0V4zM8 6H4v2a4 4 0 0 0 4 4M16 6h4v2a4 4 0 0 1-4 4M9 18h6v2H9z" />
        </svg>
      );
    case "gear":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <circle cx="12" cy="12" r="3" />
          <path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4.8a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.4a7 7 0 0 0-2 1.2L5 5.8l-2 3.4 2 1.6a7 7 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-.8a7 7 0 0 0 2 1.2L10 21h4l.5-2.4a7 7 0 0 0 2-1.2l2.4.8 2-3.4-2-1.6c.06-.39.1-.79.1-1.2z" />
        </svg>
      );
    default:
      return null;
  }
}

export function Sidebar() {
  const settings = useSettingsStore((s) => s.settings);
  return (
    <aside className="w-64 shrink-0 border-r border-white/[0.05] bg-ink-800/70 backdrop-blur-md px-4 py-6 hidden md:flex md:flex-col relative z-50">
      <div className="px-2 pb-8">
        <div className="pl-brand text-xl font-bold tracking-tight">
          Percy&apos;s Library
        </div>
        <div className="pl-brand-sub text-[10px] uppercase tracking-[0.2em] mt-1 font-semibold">
          Digital Archive
        </div>
      </div>
      
      <nav className="flex flex-1 flex-col gap-1.5">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              clsx(
                "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all group",
                isActive 
                  ? "bg-blue-600/10 text-blue-400 border border-blue-500/20 shadow-lg shadow-blue-500/5" 
                  : "text-slate-400 hover:bg-white/[0.03] hover:text-white border border-transparent"
              )
            }
          >
            <span className="opacity-70 group-hover:opacity-100 transition-opacity">
              <Icon name={item.icon} />
            </span>
            {item.label}
          </NavLink>
        ))}

        <div className="mt-4 px-2">
          <button
            onClick={() => {
              // We'll use a custom event or a shared store method
              window.dispatchEvent(new CustomEvent("pl-scan"));
            }}
            className="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-blue-400 hover:bg-blue-600/5 transition-all border border-dashed border-white/5 hover:border-blue-500/30"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
            Sincronizar
          </button>
        </div>
      </nav>

      <div className="mt-auto pt-6 border-t border-white/5">
        <NavLink
          to="/settings/profile"
          className="flex items-center gap-3 rounded-xl bg-white/[0.02] p-3 text-sm text-slate-300 hover:bg-white/[0.05] border border-white/5 transition-all"
        >
          <Avatar value={settings?.avatar ?? null} size={32} className="rounded-lg shadow-md shadow-black/50" fallbackText={`${settings?.userName?.[0] ?? ""}${settings?.userLastName?.[0] ?? ""}`} />
          <div className="flex flex-col min-w-0">
            <span className="truncate font-semibold">{settings?.userName?.trim() || "Lector"}</span>
            <span className="text-[10px] text-slate-500 truncate">Socio de lectura</span>
          </div>
        </NavLink>
      </div>
    </aside>
  );
}
