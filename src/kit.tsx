import type { ReactNode } from "react";
import { Icon } from "./icons";
import { useApp, useBackHandler } from "./nav";

/* Building blocks for app screens */

export function Header({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  const { nav } = useApp();
  return (
    <header className="sticky top-0 z-30 -mx-4 flex items-center gap-1 border-b border-white/10 bg-[#0a0a0a]/95 px-2 py-2 backdrop-blur">
      <button type="button" aria-label="Back" onClick={nav.back} className="rounded-full p-2 text-white/80 active:bg-white/10">
        <Icon name="back" />
      </button>
      <div className="min-w-0 flex-1 px-1">
        <h1 className="truncate text-lg font-bold">{title}</h1>
        {sub && <p className="truncate text-xs text-white/50">{sub}</p>}
      </div>
      {right}
    </header>
  );
}

export function RootHeader({ title, sub }: { title: string; sub?: string }) {
  const { profile, nav } = useApp();
  return (
    <header className="flex items-center gap-3 pt-5">
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-2xl font-bold">{title}</h1>
        {sub && <p className="truncate text-sm text-white/50">{sub}</p>}
      </div>
      <button type="button" aria-label="Profile" onClick={() => nav.push({ name: "profile" })}
        className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-neon font-bold text-black">
        {(profile.name.trim()[0] ?? "B").toUpperCase()}
      </button>
    </header>
  );
}

export function Row({ icon, title, sub, right, onClick }: { icon?: string; title: string; sub?: string; right?: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-left active:bg-white/10">
      {icon && (
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-neon/15 text-neon">
          <Icon name={icon} size={20} />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{title}</span>
        {sub && <span className="block truncate text-xs text-white/50">{sub}</span>}
      </span>
      {right}
      <Icon name="chevron" size={18} className="shrink-0 text-white/30" />
    </button>
  );
}

export function Tile({ icon, title, sub, onClick }: { icon: string; title: string; sub?: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex flex-col items-start gap-2 rounded-2xl border border-white/10 bg-white/5 p-4 text-left active:bg-white/10">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-neon/15 text-neon">
        <Icon name={icon} size={20} />
      </span>
      <span className="font-semibold">{title}</span>
      {sub && <span className="text-xs text-white/50">{sub}</span>}
    </button>
  );
}

export function IconBtn({ icon, label, onClick, disabled = false }: { icon: string; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick}
      className="grid h-8 w-8 place-items-center rounded-lg border border-white/15 text-white/70 active:bg-white/10 disabled:opacity-25">
      <Icon name={icon} size={16} />
    </button>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mt-6 text-xs font-semibold uppercase tracking-wider text-white/50">{children}</h2>;
}

export function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className="flex w-full items-center justify-between gap-3 py-1 text-left text-sm">
      <span>{label}</span>
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? "bg-neon" : "bg-white/15"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${on ? "left-5" : "left-0.5"}`} />
      </span>
    </button>
  );
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="mt-3 flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-3 py-2.5">
      <Icon name="search" size={18} className="text-white/40" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-white outline-none placeholder:text-white/30" />
      {value && (
        <button type="button" aria-label="Clear" onClick={() => onChange("")} className="text-white/50">
          <Icon name="x" size={16} />
        </button>
      )}
    </label>
  );
}

// A panel that slides up from the bottom. The phone's back button closes it.
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useBackHandler(true, onClose, 10);
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/70" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="mx-auto max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-white/10 bg-[#151515] p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold">{title}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded-full p-1 text-white/60">
            <Icon name="x" />
          </button>
        </div>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  );
}
