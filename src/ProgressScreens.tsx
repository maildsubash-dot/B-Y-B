import { useState, type ComponentType } from "react";
import { Bar as RBar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MeasureEntry } from "./store";
import { addDays, dateKey, parseKey, prettyDate, weekStart } from "./store";
import { UNIT_LABEL, byId } from "./exercises";
import { bestsFrom, fromUnit, historyFor, isTrainingDay, latestWeightKg, profileWeightKg, showWeight, toUnit, weightUnit } from "./train";
import { badges, dailyChallenge, logStreak, recordCount, report, setWeight, weekStreak, weeklyChallenge, type Challenge } from "./stats";
import { useApp } from "./nav";
import { Header, IconBtn, RootHeader, Row, SectionTitle } from "./kit";
import { Icon } from "./icons";
import { Btn, Card, Chip, Note, Stat, Stepper, inputClass } from "./ui";

/* ==========================================================
   Progress: summary, challenges, reports, calendar, weight,
   strength, personal records, measurements and badges.
   ========================================================== */

const TIP = { background: "#151515", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, fontSize: 12 };
const TICK = { fill: "rgba(255,255,255,0.5)", fontSize: 11 };

function monthRange(today: string, offset: number) {
  const d = parseKey(today);
  const first = new Date(d.getFullYear(), d.getMonth() - offset, 1);
  const last = new Date(d.getFullYear(), d.getMonth() - offset + 1, 0);
  return { from: dateKey(first), to: dateKey(last) };
}
const monthName = (key: string) => parseKey(key).toLocaleDateString(undefined, { month: "long", year: "numeric" });

function Chart({ points, name, bars = false }: { points: { label: string; value: number }[]; name: string; bars?: boolean }) {
  if (!bars && points.length < 2) return <Note>Log at least 2 entries to see a chart.</Note>;
  return (
    <div className="mt-3 h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        {bars ? (
          <BarChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
            <XAxis dataKey="label" tick={TICK} tickLine={false} axisLine={false} />
            <YAxis allowDecimals={false} tick={TICK} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={TIP} cursor={{ fill: "rgba(255,255,255,0.05)" }} />
            <RBar dataKey="value" name={name} fill="#b6ff3c" radius={[6, 6, 0, 0]} />
          </BarChart>
        ) : (
          <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
            <XAxis dataKey="label" tick={TICK} tickLine={false} axisLine={false} minTickGap={16} />
            <YAxis domain={["auto", "auto"]} tick={TICK} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={TIP} />
            <Line type="monotone" dataKey="value" name={name} stroke="#b6ff3c" strokeWidth={2} dot={{ r: 3, fill: "#b6ff3c" }} />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

function ChallengeRow({ label, c }: { label: string; c: Challenge }) {
  return (
    <div className="flex items-start gap-3">
      <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full ${c.done ? "bg-neon text-black" : "bg-white/10 text-white/40"}`}>
        <Icon name={c.done ? "check" : "zap"} size={14} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-wide text-white/40">{label}</p>
        <p className="text-sm font-semibold">{c.title}</p>
        <p className="text-xs text-white/50">{c.detail} · {c.progress}</p>
      </div>
    </div>
  );
}

/* ---------- Progress tab ---------- */
function ProgressHome() {
  const { profile, data, nav } = useApp();
  const today = dateKey();
  const ws = weekStart(today);
  const week = data.sessions.filter((s) => s.date >= ws).length;
  const month = data.sessions.filter((s) => s.date > addDays(today, -30)).length;
  const planned = data.plan?.weekdays.length ?? 0;
  const now = latestWeightKg(profile, data);
  const change = now - profileWeightKg(profile);
  const allBadges = badges(profile, data);
  const earned = allBadges.filter((b) => b.earned).length;
  return (
    <>
      <RootHeader title="Progress" sub="How you're doing" />
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Stat label="This week" value={`${week}${planned ? ` / ${planned}` : ""} workouts`} />
        <Stat label="Last 30 days" value={`${month} workouts`} />
        <Stat label="Logging streak" value={`${logStreak(data)} days`} />
        <Stat label="Training streak" value={`${weekStreak(data)} weeks`} />
      </div>

      <button type="button" onClick={() => nav.push({ name: "weight" })} className="mt-4 block w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-left">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-neon">Body weight</p>
          <Icon name="chevron" size={18} className="text-white/30" />
        </div>
        <p className="mt-1 text-2xl font-bold">{showWeight(now, profile)}</p>
        <p className="text-xs text-white/50">
          {Math.abs(change) < 0.05 ? "Same as when you started" : `${change > 0 ? "+" : "−"}${showWeight(Math.abs(change), profile)} since you started`}
        </p>
      </button>

      <Card title="Challenges">
        <div className="space-y-4">
          <ChallengeRow label="Today" c={dailyChallenge(profile, data)} />
          <ChallengeRow label="This week" c={weeklyChallenge(profile, data)} />
        </div>
      </Card>

      <div className="mt-4 space-y-2">
        <Row icon="list" title="Reports" sub="Weekly and monthly summaries" onClick={() => nav.push({ name: "reports" })} />
        <Row icon="calendar" title="Calendar" sub="The days you trained" onClick={() => nav.push({ name: "calendar" })} />
        <Row icon="chart" title="Strength" sub="Your lifts over time" onClick={() => nav.push({ name: "strength" })} />
        <Row icon="award" title="Personal records" sub={`${recordCount(data)} records set`} onClick={() => nav.push({ name: "records" })} />
        <Row icon="user" title="Body measurements" sub={`${data.measures.length} entries`} onClick={() => nav.push({ name: "measures" })} />
        <Row icon="award" title="Badges" sub={`${earned} of ${allBadges.length} earned`} onClick={() => nav.push({ name: "badges" })} />
        <Row icon="history" title="Workout history" sub={`${data.sessions.length} workouts`} onClick={() => nav.push({ name: "history" })} />
      </div>
    </>
  );
}

/* ---------- Reports ---------- */
function Reports() {
  const { profile, data } = useApp();
  const [mode, setMode] = useState<"week" | "month">("week");
  const [offset, setOffset] = useState(0);
  const today = dateKey();
  const range = mode === "week"
    ? { from: addDays(weekStart(today), -7 * offset), to: addDays(weekStart(today), -7 * offset + 6) }
    : monthRange(today, offset);
  const r = report(profile, data, range.from, range.to);
  const title = mode === "week" ? `${prettyDate(range.from)} – ${prettyDate(range.to)}` : monthName(range.from);
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const start = addDays(weekStart(today), -7 * (7 - i));
    const end = addDays(start, 6);
    return { label: prettyDate(start), value: data.sessions.filter((s) => s.date >= start && s.date <= end).length };
  });
  const unit = weightUnit(profile);
  const switchMode = (m: "week" | "month") => {
    setMode(m);
    setOffset(0);
  };
  return (
    <>
      <Header title="Reports" sub={title}
        right={
          <div className="flex gap-1 pr-1">
            <IconBtn icon="back" label="Earlier" onClick={() => setOffset((o) => o + 1)} />
            <IconBtn icon="chevron" label="Later" disabled={offset === 0} onClick={() => setOffset((o) => Math.max(0, o - 1))} />
          </div>
        } />
      <div className="mt-3 flex gap-2">
        <Chip label="Week" on={mode === "week"} onClick={() => switchMode("week")} />
        <Chip label="Month" on={mode === "month"} onClick={() => switchMode("month")} />
      </div>
      <SectionTitle>Training</SectionTitle>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Stat label="Workouts" value={`${r.workouts}${r.planned ? ` of ${r.planned}` : ""}`} />
        <Stat label="Minutes" value={r.minutes} />
        <Stat label="Sets" value={r.sets} />
        <Stat label="Volume" value={`${Math.round(toUnit(r.volume, profile))} ${unit}`} />
        <Stat label="Rest days" value={r.recoveryDays} />
        <Stat label="Steps" value={r.steps.toLocaleString()} />
      </div>
      <SectionTitle>Food and habits</SectionTitle>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Stat label="Avg calories" value={r.avgKcal !== null ? `${r.avgKcal} kcal` : "–"} />
        <Stat label="Avg protein" value={r.avgProtein !== null ? `${r.avgProtein} g` : "–"} />
        <Stat label="Days food logged" value={r.foodDays} />
        <Stat label="Water goal days" value={r.waterDays} />
        <Stat label="Avg sleep" value={r.avgSleep !== null ? `${r.avgSleep} h` : "–"} />
        <Stat label="Weight change"
          value={r.weightChange !== null ? `${r.weightChange > 0 ? "+" : ""}${toUnit(r.weightChange, profile)} ${unit}` : "–"} />
      </div>
      <Card title="Workouts per week">
        <Chart points={weeks} name="Workouts" bars />
      </Card>
    </>
  );
}

/* ---------- Calendar ---------- */
function CalendarScreen() {
  const { data, nav } = useApp();
  const [offset, setOffset] = useState(0);
  const today = dateKey();
  const { from, to } = monthRange(today, offset);
  const days: string[] = [];
  for (let k = from; k <= to; k = addDays(k, 1)) days.push(k);
  const lead = (parseKey(from).getDay() + 6) % 7;
  const trained = data.sessions.filter((s) => s.date >= from && s.date <= to).length;
  return (
    <>
      <Header title="Calendar" sub={monthName(from)}
        right={
          <div className="flex gap-1 pr-1">
            <IconBtn icon="back" label="Previous month" onClick={() => setOffset((o) => o + 1)} />
            <IconBtn icon="chevron" label="Next month" disabled={offset === 0} onClick={() => setOffset((o) => Math.max(0, o - 1))} />
          </div>
        } />
      <Card>
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-white/40">
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <span key={i}>{d}</span>)}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-1">
          {Array.from({ length: lead }, (_, i) => <span key={`x${i}`} />)}
          {days.map((k) => {
            const session = data.sessions.find((s) => s.date === k);
            const planned = !!data.plan && isTrainingDay(data.plan, k);
            return (
              <button key={k} type="button" disabled={!session} onClick={() => session && nav.push({ name: "session", id: session.id })}
                className={`grid aspect-square place-items-center rounded-xl text-sm ${
                  session ? "bg-neon font-bold text-black" : planned && k <= today ? "border border-white/15 text-white/60" : "text-white/40"
                } ${k === today ? "ring-2 ring-neon/60" : ""}`}>
                {Number(k.slice(8))}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-white/50">{trained} workout{trained === 1 ? "" : "s"} this month · tap a green day to see it</p>
      </Card>
    </>
  );
}

/* ---------- Weight ---------- */
function WeightScreen() {
  const { profile, data, setData } = useApp();
  const [value, setValue] = useState(() => toUnit(latestWeightKg(profile, data), profile));
  const [saved, setSaved] = useState(false);
  const today = dateKey();
  const unit = weightUnit(profile);
  const list = [...data.weights].sort((a, b) => a.date.localeCompare(b.date));
  const points = list.slice(-60).map((w) => ({ label: prettyDate(w.date), value: toUnit(w.kg, profile) }));
  const avg = (from: string, to: string) => {
    const xs = list.filter((w) => w.date > from && w.date <= to).map((w) => w.kg);
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
  };
  const thisWeek = avg(addDays(today, -7), today);
  const lastWeek = avg(addDays(today, -14), addDays(today, -7));
  const save = () => {
    const kg = fromUnit(value, profile);
    if (kg < 30 || kg > 300) return;
    setData((d) => setWeight(d, today, Math.round(kg * 10) / 10));
    setSaved(true);
  };
  return (
    <>
      <Header title="Body weight" sub={`Now ${showWeight(latestWeightKg(profile, data), profile)}`} />
      <Card title="Log today's weight">
        <div className="flex items-center justify-between gap-3">
          <Stepper value={value} step={0.1} min={20} suffix={` ${unit}`} onChange={(v) => { setValue(v); setSaved(false); }} />
          <Btn onClick={save}>{saved ? "Saved ✓" : "Save"}</Btn>
        </div>
        <p className="mt-2 text-xs text-white/50">Weigh yourself at the same time each day, ideally in the morning.</p>
      </Card>
      <Card title="Your weight">
        <Chart points={points} name={unit} />
        {thisWeek !== null && lastWeek !== null && (
          <p className="mt-3 text-xs text-white/60">
            7-day average: {showWeight(thisWeek, profile)} ({thisWeek - lastWeek >= 0 ? "+" : "−"}{showWeight(Math.abs(thisWeek - lastWeek), profile)} vs the week before).
            The weekly trend matters more than any single day.
          </p>
        )}
      </Card>
      {list.length > 0 && (
        <>
          <SectionTitle>Entries</SectionTitle>
          <div className="mt-2 space-y-1">
            {[...list].reverse().slice(0, 30).map((w) => (
              <div key={w.date} className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2 text-sm">
                <span className="text-white/60">{prettyDate(w.date)}</span>
                <span className="flex items-center gap-3">
                  {showWeight(w.kg, profile)}
                  <IconBtn icon="trash" label="Delete entry" onClick={() => setData((d) => ({ ...d, weights: d.weights.filter((x) => x.date !== w.date) }))} />
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

/* ---------- Strength and records ---------- */
function Strength() {
  const { profile, data, nav } = useApp();
  const bests = bestsFrom(data.sessions);
  const ids = Object.keys(bests).filter((id) => byId(id)).sort((a, b) => bests[b].date.localeCompare(bests[a].date));
  return (
    <>
      <Header title="Strength" sub="Tap an exercise to see your progress" />
      {!ids.length && <Note>Finish a workout and your lifts appear here.</Note>}
      <div className="mt-3 space-y-2">
        {ids.map((id) => {
          const b = bests[id];
          const ex = byId(id);
          return (
            <Row key={id} icon="chart" title={ex?.name ?? id}
              sub={b.weight > 0 ? `Best ${showWeight(b.weight, profile)} · est. 1-rep max ${showWeight(b.e1rm, profile)}` : `Best ${b.reps} ${ex ? UNIT_LABEL[ex.unit] : ""}`}
              onClick={() => nav.push({ name: "strengthEx", id })} />
          );
        })}
      </div>
    </>
  );
}

function StrengthEx() {
  const { profile, data, nav } = useApp();
  const id = nav.screen.id ?? "";
  const ex = byId(id);
  const h = historyFor(id, data.sessions);
  const weighted = h.some((x) => x.weight > 0);
  const points = h.map((x) => ({ label: prettyDate(x.date), value: weighted ? toUnit(x.e1rm, profile) : x.reps }));
  const unit = ex ? UNIT_LABEL[ex.unit] : "reps";
  return (
    <>
      <Header title={ex?.name ?? "Exercise"} sub={`${h.length} workout${h.length === 1 ? "" : "s"}`} />
      <Card title={weighted ? "Estimated 1-rep max" : `Best ${unit}`}>
        <Chart points={points} name={weighted ? weightUnit(profile) : unit} />
        {weighted && (
          <p className="mt-3 text-xs text-white/50">
            An estimate of the most you could lift once, worked out from your best set. You don't need to test it.
          </p>
        )}
      </Card>
      <SectionTitle>History</SectionTitle>
      <div className="mt-2 space-y-1">
        {[...h].reverse().map((x) => (
          <div key={x.date} className="flex justify-between rounded-xl bg-white/5 px-3 py-2 text-sm">
            <span className="text-white/60">{prettyDate(x.date)}</span>
            <span>{x.weight > 0 ? `${showWeight(x.weight, profile)} × ` : ""}{x.reps} {unit}</span>
          </div>
        ))}
      </div>
      {ex && <div className="mt-4"><Btn kind="soft" onClick={() => nav.push({ name: "exercise", id })}>About this exercise</Btn></div>}
    </>
  );
}

function Records() {
  const { profile, data, nav } = useApp();
  const bests = bestsFrom(data.sessions);
  const ids = Object.keys(bests).filter((id) => byId(id)).sort((a, b) => bests[b].date.localeCompare(bests[a].date));
  return (
    <>
      <Header title="Personal records" sub={`${recordCount(data)} records set so far`} />
      {!ids.length && <Note>Your best lifts appear here after your first workouts.</Note>}
      <div className="mt-3 space-y-2">
        {ids.map((id) => {
          const b = bests[id];
          const ex = byId(id);
          return (
            <Row key={id} icon="award" title={ex?.name ?? id}
              sub={`${b.weight > 0 ? `${showWeight(b.weight, profile)} heaviest · ${b.reps} reps most` : `${b.reps} ${ex ? UNIT_LABEL[ex.unit] : ""}`} · ${prettyDate(b.date)}`}
              onClick={() => nav.push({ name: "strengthEx", id })} />
          );
        })}
      </div>
    </>
  );
}

/* ---------- Body measurements ---------- */
const FIELDS = ["waist", "chest", "hips", "arm", "thigh"] as const;
type Field = (typeof FIELDS)[number];

function Measures() {
  const { profile, data, setData } = useApp();
  const imperial = profile.units === "imperial";
  const unit = imperial ? "in" : "cm";
  const show = (cm: number) => Math.round((imperial ? cm / 2.54 : cm) * 10) / 10;
  const list = [...data.measures].sort((a, b) => a.date.localeCompare(b.date));
  const last = list.length ? list[list.length - 1] : undefined;
  const [vals, setVals] = useState<Record<Field, string>>(() => ({
    waist: last?.waist ? String(show(last.waist)) : "", chest: last?.chest ? String(show(last.chest)) : "",
    hips: last?.hips ? String(show(last.hips)) : "", arm: last?.arm ? String(show(last.arm)) : "", thigh: last?.thigh ? String(show(last.thigh)) : "",
  }));
  const [field, setField] = useState<Field>("waist");
  const [saved, setSaved] = useState(false);
  const today = dateKey();
  const save = () => {
    const entry: MeasureEntry = { date: today };
    FIELDS.forEach((f) => {
      const v = Number(vals[f]);
      if (v > 0) entry[f] = Math.round((imperial ? v * 2.54 : v) * 10) / 10;
    });
    setData((d) => ({ ...d, measures: [...d.measures.filter((m) => m.date !== today), entry] }));
    setSaved(true);
  };
  const points = list.filter((m) => m[field] !== undefined).map((m) => ({ label: prettyDate(m.date), value: show(m[field] ?? 0) }));
  const first = list.find((m) => m[field] !== undefined)?.[field];
  const latest = [...list].reverse().find((m) => m[field] !== undefined)?.[field];
  return (
    <>
      <Header title="Body measurements" sub={`In ${unit}`} />
      <Card title="Measure today">
        <div className="grid grid-cols-2 gap-3">
          {FIELDS.map((f) => (
            <label key={f} className="block text-sm">
              <span className="mb-1 block capitalize text-white/60">{f}</span>
              <input className={inputClass} inputMode="decimal" value={vals[f]}
                onChange={(e) => { setVals((v) => ({ ...v, [f]: e.target.value.replace(/[^\d.]/g, "") })); setSaved(false); }} />
            </label>
          ))}
        </div>
        <div className="mt-4"><Btn onClick={save}>{saved ? "Saved ✓" : "Save"}</Btn></div>
        <p className="mt-2 text-xs text-white/50">Measure at the same spot each time, with a relaxed tape, every 2–4 weeks.</p>
      </Card>
      <Card title="Changes">
        <div className="-mx-1 flex flex-wrap gap-2">
          {FIELDS.map((f) => <Chip key={f} label={f[0].toUpperCase() + f.slice(1)} on={field === f} onClick={() => setField(f)} />)}
        </div>
        <Chart points={points} name={unit} />
        {first !== undefined && latest !== undefined && points.length >= 2 && (
          <p className="mt-2 text-xs text-white/60">
            {show(latest)} {unit} now · {show(latest) - show(first) >= 0 ? "+" : ""}{Math.round((show(latest) - show(first)) * 10) / 10} {unit} since your first entry
          </p>
        )}
      </Card>
    </>
  );
}

/* ---------- Badges ---------- */
function Badges() {
  const { profile, data } = useApp();
  const list = badges(profile, data);
  return (
    <>
      <Header title="Badges" sub={`${list.filter((b) => b.earned).length} of ${list.length} earned`} />
      <div className="mt-3 grid grid-cols-2 gap-2">
        {list.map((b) => (
          <div key={b.name} className={`rounded-2xl border p-3 ${b.earned ? "border-neon/40 bg-neon/10" : "border-white/10 bg-white/5"}`}>
            <span className={`grid h-9 w-9 place-items-center rounded-full ${b.earned ? "bg-neon text-black" : "bg-white/10 text-white/40"}`}>
              <Icon name="award" size={18} />
            </span>
            <p className="mt-2 text-sm font-semibold">{b.name}</p>
            <p className="text-xs text-white/50">{b.desc}</p>
            <p className="mt-1 text-[11px] text-white/40">{b.earned ? "Earned" : b.progress}</p>
          </div>
        ))}
      </div>
    </>
  );
}

/* ---------- Every progress screen, by name ---------- */
export const PROGRESS_SCREENS: Record<string, ComponentType> = {
  progress: ProgressHome, reports: Reports, calendar: CalendarScreen, weight: WeightScreen, strength: Strength,
  strengthEx: StrengthEx, records: Records, measures: Measures, badges: Badges,
};