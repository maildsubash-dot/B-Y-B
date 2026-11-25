import type { ReactNode } from "react";

export const inputBase =
  "rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-white placeholder:text-white/30 outline-none focus:border-neon";
export const inputClass = `w-full ${inputBase}`;

const round1 = (n: number) => Math.round(n * 10) / 10;

export function PageTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mt-6">
      <h1 className="text-2xl font-bold">{title}</h1>
      {sub && <p className="mt-1 text-sm text-white/55">{sub}</p>}
    </div>
  );
}

export function Card({ title, right, children }: { title?: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
      {(title || right) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h2 className="text-xs font-semibold uppercase tracking-wider text-neon">{title}</h2>}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function Btn({
  children,
  onClick,
  kind = "main",
  disabled = false,
  small = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  kind?: "main" | "soft" | "danger";
  disabled?: boolean;
  small?: boolean;
}) {
  const look = {
    main: "bg-neon text-black",
    soft: "border border-white/20 text-white",
    danger: "border border-red-400/50 text-red-300",
  }[kind];
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-xl font-semibold transition active:scale-[0.98] disabled:opacity-30 ${
        small ? "px-3 py-1.5 text-xs" : "px-4 py-2.5 text-sm"
      } ${look}`}
    >
      {children}
    </button>
  );
}

export function Chip({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
        on ? "border-neon bg-neon text-black" : "border-white/15 bg-white/5 text-white/80 hover:border-white/40"
      }`}
    >
      {label}
    </button>
  );
}

export function Bar({ label, value, max, right }: { label: string; value: number; max: number; right: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="mt-3">
      <div className="flex justify-between text-xs">
        <span className="text-white/60">{label}</span>
        <span>{right}</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-neon transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl bg-white/5 p-3">
      <p className="text-[11px] uppercase tracking-wide text-white/50">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}

export function Note({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warn" }) {
  return (
    <p
      className={`mt-3 rounded-xl border p-3 text-xs leading-relaxed ${
        tone === "warn" ? "border-yellow-400/40 bg-yellow-400/10 text-yellow-100" : "border-white/10 bg-white/5 text-white/60"
      }`}
    >
      {children}
    </p>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 px-4 py-8" role="dialog" aria-modal="true">
      <div className="mx-auto max-w-md rounded-2xl border border-white/10 bg-[#141414] p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-xl font-bold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg px-2 py-1 text-white/60 hover:text-white">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Stepper({
  value,
  onChange,
  step = 1,
  min = 0,
  suffix = "",
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  suffix?: string;
}) {
  return (
    <div className="inline-flex items-center gap-2">
      <button type="button" aria-label="Less" className="h-8 w-8 rounded-lg border border-white/20" onClick={() => onChange(Math.max(min, round1(value - step)))}>
        −
      </button>
      <span className="min-w-12 text-center text-sm font-semibold">
        {value}
        {suffix}
      </span>
      <button type="button" aria-label="More" className="h-8 w-8 rounded-lg border border-white/20" onClick={() => onChange(round1(value + step))}>
        +
      </button>
    </div>
  );
}