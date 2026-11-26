import { useState, type ReactNode } from "react";
import type { Gear } from "./store";
import { DB_OPTIONS, KB_OPTIONS } from "./weights";
import { Btn, Chip, Stepper, inputClass } from "./ui";

const LB = 2.20462;
const near = (a: number, b: number) => Math.abs(a - b) < 0.05;

function Line({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-white/70">{label}</span>
      {children}
    </div>
  );
}

export default function GearEditor({ gear, onChange, imperial, dumbbells, kettlebells }: {
  gear: Gear; onChange: (g: Gear) => void; imperial: boolean; dumbbells: boolean; kettlebells: boolean;
}) {
  const [custom, setCustom] = useState("");
  const unit = imperial ? "lb" : "kg";
  const toKg = (v: number) => (imperial ? v / LB : v);
  const show = (kg: number) => Math.round((imperial ? kg * LB : kg) * 10) / 10;
  const toggle = (list: number[], kg: number) =>
    list.some((x) => near(x, kg)) ? list.filter((x) => !near(x, kg)) : [...list, kg].sort((a, b) => a - b);
  const adj = gear.adjustable;
  const step = imperial ? 5 : 0.5;

  const addCustom = () => {
    const v = Number(custom);
    if (!(v > 0 && v < 200)) return;
    const kg = toKg(v);
    onChange({ ...gear, dumbbells: [...gear.dumbbells.filter((x) => !near(x, kg)), kg].sort((a, b) => a - b) });
    setCustom("");
  };

  return (
    <div className="space-y-6">
      {dumbbells && (
        <div>
          <p className="font-semibold">Dumbbells</p>
          <div className="mt-2 flex gap-2">
            <Chip label="Fixed pairs" on={!adj} onClick={() => onChange({ ...gear, adjustable: null })} />
            <Chip label="Adjustable set" on={!!adj}
              onClick={() => onChange({ ...gear, adjustable: adj ?? (imperial ? { min: 5 / LB, max: 50 / LB, step: 5 / LB } : { min: 2, max: 20, step: 2 }) })} />
          </div>
          {adj ? (
            <div className="mt-4 space-y-3 text-sm">
              <Line label="Lightest">
                <Stepper value={show(adj.min)} step={step} min={step} suffix={` ${unit}`} onChange={(v) => onChange({ ...gear, adjustable: { ...adj, min: toKg(v) } })} />
              </Line>
              <Line label="Heaviest">
                <Stepper value={show(adj.max)} step={step} min={step} suffix={` ${unit}`} onChange={(v) => onChange({ ...gear, adjustable: { ...adj, max: toKg(v) } })} />
              </Line>
              <Line label="Goes up in steps of">
                <Stepper value={show(adj.step)} step={step} min={step} suffix={` ${unit}`} onChange={(v) => onChange({ ...gear, adjustable: { ...adj, step: toKg(v) } })} />
              </Line>
              <p className="text-xs text-white/50">
                BYB will suggest weights from {show(adj.min)} to {show(adj.max)} {unit}, in {show(adj.step)} {unit} steps.
              </p>
            </div>
          ) : (
            <>
              <p className="mt-3 text-xs text-white/50">Tap every pair you own ({unit}).</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(imperial ? DB_OPTIONS.lb : DB_OPTIONS.kg).map((v) => (
                  <Chip key={v} label={`${v}`} on={gear.dumbbells.some((x) => near(x, toKg(v)))}
                    onClick={() => onChange({ ...gear, dumbbells: toggle(gear.dumbbells, toKg(v)) })} />
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <input className={inputClass} inputMode="decimal" placeholder={`Other weight (${unit})`} value={custom}
                  onChange={(e) => setCustom(e.target.value.replace(/[^\d.]/g, ""))} />
                <Btn kind="soft" onClick={addCustom}>Add</Btn>
              </div>
              {gear.dumbbells.length > 0 && (
                <p className="mt-2 text-xs text-white/60">You own: {gear.dumbbells.map(show).join(", ")} {unit}</p>
              )}
            </>
          )}
        </div>
      )}
      {kettlebells && (
        <div>
          <p className="font-semibold">Kettlebells</p>
          <p className="mt-1 text-xs text-white/50">Tap every kettlebell you own (kg).</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {KB_OPTIONS.map((v) => (
              <Chip key={v} label={`${v}`} on={gear.kettlebells.some((x) => near(x, v))}
                onClick={() => onChange({ ...gear, kettlebells: toggle(gear.kettlebells, v) })} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}