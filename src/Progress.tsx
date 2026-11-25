import { useState } from "react";
import { Bar as RBar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MeasureEntry, PageProps, Profile } from "./store";
import { WEEK_MON, addDays, dateKey, parseKey, prettyDate, weekStart, weekdayOf } from "./store";
import { UNIT_LABEL, byId } from "./exercises";
import { bestsFrom, doneSets, historyFor, showWeight, toUnit, weightUnit } from "./train";
import { badges, logStreak, report, weekStreak } from "./stats";
import { Bar, Btn, Card, Chip, Modal, Note, PageTitle, Stat, inputClass } from "./ui";
import { WeightLogger } from "./Home";

/* ==========================================================
   Progress: reports, charts, calendar, records, measurements
   and badges.
   ========================================================== */

type MKey = "waist" | "chest" | "hips" | "arm" | "thigh";
const MEASURES: [MKey, string][] = [
  ["waist", "Waist"],
  ["chest", "Chest"],
  ["hips", "Hips"],
  ["arm", "Upper arm"],
  ["thigh", "Thigh"],
];
const PERIODS = ["This week", "Last week", "This month", "Last month"];
const RANGES = ["30 days", "90 days", "All"];
const NEON = "#b6ff3c";
const AXIS = { fill: "rgba(255,255,255,0.5)", fontSize: 11 };
const TOOLTIP = { background: "#141414", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 12, color: "#fff" };
const GRID = "rgba(255,255,255,0.06)";

function periodRange(period: string, today: string): [string, string] {
  const ws = weekStart(today);
  const d = parseKey(today);
  const monthStart = dateKey(new Date(d.getFullYear(), d.getMonth(), 1));
  if (period === "Last week") return [addDays(ws, -7), addDays(ws, -1)];
  if (period === "This month") return [monthStart, today];
  if (period === "Last month") return [dateKey(new Date(d.getFullYear(), d.getMonth() - 1, 1)), addDays(monthStart, -1)];
  return [ws, addDays(ws, 6)];
}

export default function Progress({ profile, data, setData }: PageProps) {
  const today = dateKey();
  const [period, setPeriod] = useState(PERIODS[0]);
  const [range, setRange] = useState(RANGES[1]);
  const [weighing, setWeighing] = useState(false);
  const [measuring, setMeasuring] = useState(false);
  const [exId, setExId] = useState("");
  const [month, setMonth] = useState(today.slice(0, 7));
  const [dayOpen, setDayOpen] = useState<string | null>(null);
  const showNumbers = profile.foodTracking !== "Keep it simple";
  const wu = weightUnit(profile);
  const lu = profile.units === "imperial" ? "in" : "cm";
  const toLen = (cm: number) => Math.round((profile.units === "imperial" ? cm / 2.54 : cm) * 10) / 10;

  /* Report */
  const [from, to] = periodRange(period, today);
  const r = report(profile, data, from, to);
  const cardioMin = data.sessions
    .filter((s) => s.date >= from && s.date <= to)
    .reduce(
      (a, s) =>
        a + s.exercises.reduce((b, e) => b + (byId(e.id)?.unit === "min" ? e.sets.filter((x) => x.done).reduce((c, x) => c + x.reps, 0) : 0), 0),
      0,
    );
  const completion = r.planned ? Math.round((r.workouts / r.planned) * 100) : 0;

  /* Weight chart */
  const since = range === "30 days" ? addDays(today, -30) : range === "90 days" ? addDays(today, -90) : "0000";
  const weightData = data.weights.filter((w) => w.date >= since).map((w) => ({ date: prettyDate(w.date), value: toUnit(w.kg, profile) }));

  /* Strength chart */
  const trainedIds = [...new Set(data.sessions.flatMap((s) => s.exercises.filter((e) => e.sets.some((x) => x.done)).map((e) => e.id)))];
  const selected = trainedIds.includes(exId) ? exId : (trainedIds[0] ?? "");
  const hist = selected ? historyFor(selected, data.sessions) : [];
  const weighted = hist.some((h) => h.weight > 0);
  const selEx = byId(selected);
  const strengthData = hist.map((h) => ({ date: prettyDate(h.date), value: weighted ? toUnit(h.e1rm, profile) : h.reps }));
  const strengthUnit = weighted ? wu : selEx ? UNIT_LABEL[selEx.unit] : "";

  /* Workouts per week (last 8 weeks) */
  const thisWeek = weekStart(today);
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const ws = addDays(thisWeek, -7 * (7 - i));
    const list = data.sessions.filter((s) => s.date >= ws && s.date <= addDays(ws, 6));
    return { week: prettyDate(ws), workouts: list.length, sets: list.reduce((a, s) => a + doneSets(s), 0) };
  });

  /* Calendar */
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7)) - 1;
  const first = new Date(y, m, 1);
  const offset = (first.getDay() + 6) % 7;
  const daysIn = new Date(y, m + 1, 0).getDate();
  const cells: (string | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: daysIn }, (_, i) => dateKey(new Date(y, m, i + 1))),
  ];
  const shiftMonth = (n: number) => setMonth(dateKey(new Date(y, m + n, 1)).slice(0, 7));

  /* Records */
  const prs = Object.entries(bestsFrom(data.sessions))
    .map(([id, b]) => ({ id, ...b }))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 12);

  /* Measurements */
  const conv = (s: string) => {
    const n = Number(s);
    return s.trim() && n > 0 ? (profile.units === "imperial" ? n * 2.54 : n) : undefined;
  };
  const startEntry: MeasureEntry = {
    date: "start",
    waist: conv(profile.waist), chest: conv(profile.chest), hips: conv(profile.hips), arm: conv(profile.arm), thigh: conv(profile.thigh),
  };
  const measures = [...data.measures].sort((a, b) => a.date.localeCompare(b.date));
  const baseline = MEASURES.some(([k]) => startEntry[k] !== undefined) ? startEntry : measures[0];
  const latest = measures[measures.length - 1];

  const allBadges = badges(profile, data);
  const earnedCount = allBadges.filter((b) => b.earned).length;

  return (
    <div className="pb-6">
      <PageTitle title="Progress" sub="Your reports, trends, records and achievements." />

      {/* Report */}
      <Card title="Report">
        <div className="flex flex-wrap gap-2">
          {PERIODS.map((p) => (
            <Chip key={p} label={p} on={period === p} onClick={() => setPeriod(p)} />
          ))}
        </div>
        <p className="mt-2 text-xs text-white/45">
          {prettyDate(from)} – {prettyDate(to)}
        </p>
        <Bar label="Planned workouts completed" value={r.workouts} max={r.planned} right={`${r.workouts} / ${r.planned} (${completion}%)`} />
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Stat label="Training time" value={`${r.minutes} min`} />
          <Stat label="Sets done" value={r.sets} />
          <Stat label="Weight lifted" value={`${Math.round(toUnit(r.volume, profile)).toLocaleString()} ${wu}`} />
          <Stat label="Cardio" value={`${cardioMin} min`} />
          <Stat label="Avg sleep" value={r.avgSleep !== null ? `${r.avgSleep} h` : "—"} />
          <Stat label="Water goal hit" value={`${r.waterDays} days`} />
          <Stat label="Food logged" value={`${r.foodDays} days`} />
          <Stat label="Steps" value={r.steps.toLocaleString()} />
          {showNumbers && <Stat label="Avg calories" value={r.avgKcal !== null ? `${r.avgKcal} kcal` : "—"} />}
          {showNumbers && <Stat label="Avg protein" value={r.avgProtein !== null ? `${r.avgProtein} g` : "—"} />}
          <Stat label="Rest days" value={r.recoveryDays} />
          <Stat
            label="Weight change"
            value={r.weightChange !== null ? `${r.weightChange > 0 ? "+" : ""}${toUnit(r.weightChange, profile)} ${wu}` : "—"}
          />
        </div>
        <p className="mt-3 text-sm text-white/65">
          {r.planned === 0
            ? "No planned workouts in this period."
            : completion >= 100
              ? "You completed every planned workout. Excellent consistency!"
              : completion >= 60
                ? "Good consistency. Keep showing up."
                : "Every workout counts. Aim for one more than last time."}
        </p>
      </Card>

      {/* Weight */}
      <Card title={`Weight (${wu})`} right={<Btn small onClick={() => setWeighing(true)}>Log weight</Btn>}>
        <div className="flex flex-wrap gap-2">
          {RANGES.map((rg) => (
            <Chip key={rg} label={rg} on={range === rg} onClick={() => setRange(rg)} />
          ))}
        </div>
        {weightData.length >= 2 ? (
          <div className="mt-3 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weightData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="date" tick={AXIS} tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis domain={["auto", "auto"]} tick={AXIS} tickLine={false} axisLine={false} width={44} />
                <Tooltip contentStyle={TOOLTIP} />
                <Line type="monotone" dataKey="value" name="Weight" stroke={NEON} strokeWidth={2.5} dot={{ r: 3, fill: NEON }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <Note>Log your weight at least twice to see a trend.</Note>
        )}
        {weightData.length >= 2 && (
          <p className="mt-2 text-xs text-white/50">
            From {weightData[0].value} to {weightData[weightData.length - 1].value} {wu}. Daily weight moves up and down; the trend over weeks matters most.
          </p>
        )}
      </Card>

      {/* Strength */}
      <Card title="Strength trend">
        {trainedIds.length === 0 ? (
          <Note>Finish a workout to see your strength trends.</Note>
        ) : (
          <>
            <select
              className={inputClass}
              value={selected}
              onChange={(e) => setExId(e.target.value)}
              aria-label="Choose an exercise"
            >
              {trainedIds.map((id) => (
                <option key={id} value={id} className="bg-neutral-900">
                  {byId(id)?.name ?? id}
                </option>
              ))}
            </select>
            {strengthData.length >= 2 ? (
              <div className="mt-3 h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={strengthData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid stroke={GRID} vertical={false} />
                    <XAxis dataKey="date" tick={AXIS} tickLine={false} axisLine={false} minTickGap={24} />
                    <YAxis domain={["auto", "auto"]} tick={AXIS} tickLine={false} axisLine={false} width={44} />
                    <Tooltip contentStyle={TOOLTIP} />
                    <Line type="monotone" dataKey="value" name={weighted ? "Estimated max" : "Best"} stroke={NEON} strokeWidth={2.5} dot={{ r: 3, fill: NEON }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <Note>Do this exercise at least twice to see a trend.</Note>
            )}
            {strengthData.length >= 2 && (
              <p className="mt-2 text-xs text-white/50">
                {weighted ? "Estimated one-rep max" : `Best set (${strengthUnit})`}: {strengthData[0].value} → {strengthData[strengthData.length - 1].value}{" "}
                {weighted ? wu : ""} since {strengthData[0].date}. Estimates are a guide, not a test.
              </p>
            )}
          </>
        )}
      </Card>

      {/* Workouts per week */}
      <Card title="Workouts per week">
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeks} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="week" tick={AXIS} tickLine={false} axisLine={false} minTickGap={8} />
              <YAxis allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} width={36} />
              <Tooltip contentStyle={TOOLTIP} cursor={{ fill: "rgba(255,255,255,0.05)" }} />
              <RBar dataKey="workouts" name="Workouts" fill={NEON} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Calendar */}
      <Card
        title="Workout calendar"
        right={
          <div className="flex items-center gap-1">
            <Btn small kind="soft" onClick={() => shiftMonth(-1)}>
              ‹
            </Btn>
            <Btn small kind="soft" disabled={month >= today.slice(0, 7)} onClick={() => shiftMonth(1)}>
              ›
            </Btn>
          </div>
        }
      >
        <p className="mb-2 text-sm font-semibold">{first.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</p>
        <div className="grid grid-cols-7 gap-1 text-center text-[11px]">
          {WEEK_MON.map((d) => (
            <p key={d} className="text-white/40">
              {d.slice(0, 2)}
            </p>
          ))}
          {cells.map((key, i) => {
            if (!key) return <div key={`blank-${i}`} />;
            const trained = data.sessions.some((s) => s.date === key);
            const planned = !!data.plan && data.plan.weekdays.includes(weekdayOf(key)) && key > today;
            return (
              <button
                key={key}
                type="button"
                disabled={!trained}
                onClick={() => setDayOpen(key)}
                aria-label={`${prettyDate(key)}${trained ? ", workout done" : ""}`}
                className={`flex aspect-square items-center justify-center rounded-lg text-xs ${
                  trained ? "bg-neon font-bold text-black" : planned ? "border border-white/25 text-white/70" : "text-white/40"
                } ${key === today ? "ring-2 ring-neon/60" : ""}`}
              >
                {Number(key.slice(8))}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-white/40">Green = workout done (tap for details). Outlined = planned.</p>
      </Card>

      {/* Records */}
      <Card title="Personal records">
        {prs.length === 0 ? (
          <Note>Your best lifts and reps appear here after your workouts.</Note>
        ) : (
          <ul className="divide-y divide-white/10">
            {prs.map((b) => {
              const ex = byId(b.id);
              return (
                <li key={b.id} className="flex justify-between gap-3 py-2 text-sm">
                  <span>{ex?.name ?? b.id}</span>
                  <span className="text-right text-xs text-white/65">
                    {b.weight > 0 ? showWeight(b.weight, profile) : `${b.reps} ${ex ? UNIT_LABEL[ex.unit] : ""}`}
                    <br />
                    <span className="text-white/40">{prettyDate(b.date)}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Measurements */}
      <Card title={`Body measurements (${lu})`} right={<Btn small onClick={() => setMeasuring(true)}>Add</Btn>}>
        {!baseline && !latest ? (
          <Note>Add your measurements to compare them over time. They often show progress the scale doesn't.</Note>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-white/45">
                <th className="py-1 font-normal">Area</th>
                <th className="py-1 font-normal">{baseline?.date === "start" ? "At start" : baseline ? prettyDate(baseline.date) : ""}</th>
                <th className="py-1 font-normal">{latest ? prettyDate(latest.date) : "Latest"}</th>
                <th className="py-1 font-normal">Change</th>
              </tr>
            </thead>
            <tbody>
              {MEASURES.map(([k, label]) => {
                const a = baseline?.[k];
                const b = latest?.[k];
                return (
                  <tr key={k} className="border-t border-white/10">
                    <td className="py-1.5">{label}</td>
                    <td className="py-1.5 text-white/70">{a !== undefined ? toLen(a) : "—"}</td>
                    <td className="py-1.5 text-white/70">{b !== undefined ? toLen(b) : "—"}</td>
                    <td className="py-1.5 text-white/70">
                      {a !== undefined && b !== undefined && latest !== baseline ? `${b - a > 0 ? "+" : ""}${toLen(b - a)}` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {/* Badges */}
      <Card title={`Badges (${earnedCount} / ${allBadges.length})`}>
        <div className="mb-3 grid grid-cols-2 gap-2">
          <Stat label="Logging streak" value={`${logStreak(data, today)} days`} />
          <Stat label="Training streak" value={`${weekStreak(data, today)} weeks`} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {allBadges.map((b) => (
            <div key={b.name} className={`rounded-xl border p-3 ${b.earned ? "border-neon/50 bg-neon/10" : "border-white/10 opacity-70"}`}>
              <p className="text-sm font-semibold">
                {b.earned ? "🏅" : "🔒"} {b.name}
              </p>
              <p className="text-xs text-white/55">{b.desc}</p>
              <p className="mt-1 text-[11px] text-white/45">{b.progress}</p>
            </div>
          ))}
        </div>
      </Card>

      <Note>
        Progress photos will be added with the Android app, stored privately on your phone. BYB never estimates body fat from
        photos and can't promise specific results; everyone progresses differently.
      </Note>

      {weighing && <WeightLogger profile={profile} data={data} setData={setData} onClose={() => setWeighing(false)} />}
      {measuring && (
        <MeasureModal
          units={profile.units}
          onClose={() => setMeasuring(false)}
          onSave={(entry) => {
            setData((d) => ({
              ...d,
              measures: [...d.measures.filter((x) => x.date !== entry.date), entry].sort((a, b) => a.date.localeCompare(b.date)),
            }));
            setMeasuring(false);
          }}
        />
      )}
      {dayOpen && (
        <Modal title={`Workouts on ${prettyDate(dayOpen)}`} onClose={() => setDayOpen(null)}>
          {data.sessions.filter((s) => s.date === dayOpen).length === 0 && <Note>No workouts on this day.</Note>}
          {data.sessions
            .filter((s) => s.date === dayOpen)
            .map((s) => (
              <div key={s.id} className="mt-4 rounded-xl border border-white/10 p-3">
                <p className="font-semibold">{s.title}</p>
                <p className="text-xs text-white/50">
                  {Math.round(s.seconds / 60)} min · {doneSets(s)} sets · felt {s.effort.toLowerCase()}
                </p>
                <ul className="mt-2 space-y-1 text-sm">
                  {s.exercises.map((e, i) => {
                    const ex = byId(e.id);
                    const done = e.sets.filter((x) => x.done);
                    return (
                      <li key={`${e.id}-${i}`}>
                        <span className="text-white/85">{ex?.name ?? e.id}</span>
                        <span className="text-white/50">
                          {" · "}
                          {done.length
                            ? done
                                .map((x) => `${x.reps} ${ex ? UNIT_LABEL[ex.unit] : ""}${x.weight > 0 ? ` @ ${toUnit(x.weight, profile)} ${wu}` : ""}`)
                                .join(", ")
                            : e.skipped
                              ? "skipped"
                              : "no sets"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <div className="mt-3">
                  <Btn small kind="danger" onClick={() => setData((d) => ({ ...d, sessions: d.sessions.filter((x) => x.id !== s.id) }))}>
                    Delete this workout
                  </Btn>
                </div>
              </div>
            ))}
        </Modal>
      )}
    </div>
  );
}

function MeasureModal({
  units,
  onSave,
  onClose,
}: {
  units: Profile["units"];
  onSave: (m: MeasureEntry) => void;
  onClose: () => void;
}) {
  const [date, setDate] = useState(dateKey());
  const [vals, setVals] = useState<Record<MKey, string>>({ waist: "", chest: "", hips: "", arm: "", thigh: "" });
  const lu = units === "imperial" ? "in" : "cm";
  const toCm = (s: string) => {
    const n = Number(s);
    return s.trim() && n > 0 && n < 300 ? Math.round((units === "imperial" ? n * 2.54 : n) * 10) / 10 : undefined;
  };
  const entry: MeasureEntry = {
    date, waist: toCm(vals.waist), chest: toCm(vals.chest), hips: toCm(vals.hips), arm: toCm(vals.arm), thigh: toCm(vals.thigh),
  };
  const ok = MEASURES.some(([k]) => entry[k] !== undefined) && date <= dateKey();

  return (
    <Modal title="Add measurements" onClose={onClose}>
      <label className="mt-4 block text-sm text-white/70">
        Date
        <input className={`${inputClass} mt-1`} type="date" max={dateKey()} value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {MEASURES.map(([k, label]) => (
          <label key={k} className="block text-xs text-white/60">
            {label} ({lu})
            <input
              className={`${inputClass} mt-1`}
              type="number"
              inputMode="decimal"
              value={vals[k]}
              onChange={(e) => setVals({ ...vals, [k]: e.target.value })}
            />
          </label>
        ))}
      </div>
      <Note>Measure relaxed, around the widest part, at the same time of day each time. Fill in only the ones you want.</Note>
      <div className="mt-4 flex gap-2">
        <Btn disabled={!ok} onClick={() => onSave(entry)}>
          Save
        </Btn>
        <Btn kind="soft" onClick={onClose}>
          Cancel
        </Btn>
      </div>
    </Modal>
  );
}