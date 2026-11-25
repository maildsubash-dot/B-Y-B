import { useState } from "react";
import type { AppData, DayLog, PageProps, PlanDay, Profile, SetData } from "./store";
import { WEEK_MON, addDays, dateKey, dayLog, prettyDate, weekStart, weekdayOf } from "./store";
import { UNIT_LABEL, byId } from "./exercises";
import { Bar, Btn, Card, Chip, Modal, Note, Stat, inputClass } from "./ui";
import {
  FEELINGS, doneSets, estimateMinutes, fromUnit, generatePlan, insights, latestWeightKg, profileWeightKg,
  showWeight, toUnit, todaysIndex, trainedOn, upcoming, weightUnit,
} from "./train";
import {
  HABITS, badges, dailyChallenge, foodOn, logStreak, nutritionTargets, setWeight, totalsOf, updateDay,
  weekStreak, weeklyChallenge, type Challenge,
} from "./stats";

type HomeProps = PageProps & { start: (day: PlanDay) => void };

const ICON: Record<string, string> = { rest: "😴", schedule: "📅", progress: "📈", tip: "💡", warn: "⚠️" };

const toNum = (v: string, max: number, whole = false) => {
  if (v === "") return undefined;
  const n = Math.min(max, Math.max(0, Number(v) || 0));
  return whole ? Math.round(n) : n;
};

export default function Home({ profile, data, setData, go, start }: HomeProps) {
  const [weighing, setWeighing] = useState(false);
  const today = dateKey();
  const log = dayLog(data, today);
  const targets = nutritionTargets(profile, data);
  const todaysFood = foodOn(data, today);
  const eaten = totalsOf(todaysFood);
  const showNumbers = profile.foodTracking !== "Keep it simple";
  const plan = data.plan;
  const hour = new Date().getHours();
  const hello = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const doneToday = trainedOn(data.sessions, today);
  const todayIdx = plan ? todaysIndex(plan, data.sessions) : -1;
  const next = plan ? upcoming(plan, data.sessions, 4) : [];
  const nextDay = plan && next.length ? plan.days[next[0].index] : undefined;
  const tips = insights(profile, data, today).slice(0, 4);
  const ws = weekStart(today);
  const weekSessions = data.sessions.filter((s) => s.date >= ws && s.date <= addDays(ws, 6));
  const allBadges = badges(profile, data);
  const earned = allBadges.filter((b) => b.earned);
  const weightNow = latestWeightKg(profile, data);
  const change = weightNow - profileWeightKg(profile);
  const setDay = (patch: Partial<DayLog>) => setData((d) => updateDay(d, today, patch));

  const startMain = () => {
    if (doneToday || !plan) return go("train");
    if (todayIdx >= 0) return start(plan.days[todayIdx]);
    if (nextDay) return start(nextDay);
    go("train");
  };

  const actions: [string, string, () => void][] = [
    ["▶", "Start workout", startMain],
    ["✨", "New workout", () => go("train")],
    ["💬", "Ask coach", () => go("coach")],
    ["🍛", "Log food", () => go("food")],
    ["⚖️", "Log weight", () => setWeighing(true)],
    ["📊", "Progress", () => go("progress")],
  ];

  return (
    <div className="pb-6">
      {/* Welcome */}
      <div className="mt-6">
        <p className="text-sm text-white/50">{hello},</p>
        <h1 className="text-3xl font-bold">{profile.name}</h1>
        <div className="mt-3 flex flex-wrap gap-2">
          {profile.goals.map((g, i) => (
            <span
              key={g}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${i === 0 ? "bg-neon text-black" : "bg-white/10 text-white/70"}`}
            >
              {i === 0 ? `Main goal: ${g}` : g}
            </span>
          ))}
        </div>
      </div>

      {/* How do you feel */}
      <Card title="How do you feel today?">
        <div className="flex flex-wrap gap-2">
          {FEELINGS.map((f) => (
            <Chip key={f} label={f} on={log.feel === f} onClick={() => setDay({ feel: log.feel === f ? undefined : f })} />
          ))}
        </div>
      </Card>

      {/* Today's workout */}
      <Card
        title="Today's workout"
        right={
          plan ? (
            <button type="button" className="text-xs text-white/60 underline" onClick={() => go("train")}>
              Full plan
            </button>
          ) : undefined
        }
      >
        {!plan ? (
          <>
            <p className="text-sm text-white/70">You don't have a workout plan yet.</p>
            <div className="mt-3">
              <Btn onClick={() => setData((d) => ({ ...d, plan: generatePlan(profile) }))}>Create my plan</Btn>
            </div>
          </>
        ) : doneToday ? (
          <>
            <p className="text-xl font-bold">✓ Workout done today</p>
            <p className="mt-1 text-sm text-white/60">Great work. Eat well, drink water and rest.</p>
            {nextDay && next[0] && (
              <p className="mt-2 text-sm">
                Next: <b>{nextDay.title}</b> on {weekdayOf(next[0].date)}, {prettyDate(next[0].date)}
              </p>
            )}
          </>
        ) : todayIdx >= 0 ? (
          <WorkoutPreview day={plan.days[todayIdx]} onStart={() => start(plan.days[todayIdx])} />
        ) : (
          <>
            <p className="text-xl font-bold">Rest day</p>
            <p className="mt-1 text-sm text-white/60">Recovery is when your body gets stronger. A walk or some stretching is perfect today.</p>
            {nextDay && next[0] && (
              <p className="mt-2 text-sm">
                Next: <b>{nextDay.title}</b> on {weekdayOf(next[0].date)}, {prettyDate(next[0].date)}
              </p>
            )}
            {nextDay && (
              <div className="mt-3">
                <Btn kind="soft" onClick={() => start(nextDay)}>
                  Train today anyway
                </Btn>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Smart suggestions */}
      {tips.length > 0 && (
        <Card title="Smart suggestions">
          <ul className="space-y-3">
            {tips.map((tip) => (
              <li key={tip.title + tip.text} className="flex gap-3">
                <span aria-hidden="true">{ICON[tip.kind]}</span>
                <div>
                  <p className="text-sm font-semibold">{tip.title}</p>
                  <p className="text-sm text-white/65">{tip.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Quick actions */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        {actions.map(([icon, label, fn]) => (
          <button
            key={label}
            type="button"
            onClick={fn}
            className="rounded-2xl border border-white/10 bg-white/5 p-3 text-center transition hover:border-white/30 active:scale-[0.97]"
          >
            <span className="block text-xl" aria-hidden="true">
              {icon}
            </span>
            <span className="mt-1 block text-xs font-semibold">{label}</span>
          </button>
        ))}
      </div>

      {/* Today */}
      <Card title="Today">
        <Bar label="💧 Water" value={log.water} max={targets.water} right={`${log.water} / ${targets.water} glasses`} />
        <div className="mt-2 flex gap-2">
          <Btn small kind="soft" onClick={() => setDay({ water: Math.max(0, log.water - 1) })}>
            − Glass
          </Btn>
          <Btn small onClick={() => setDay({ water: log.water + 1 })}>
            + Glass
          </Btn>
        </div>
        {showNumbers ? (
          <>
            <Bar label="🔥 Calories" value={eaten.kcal} max={targets.kcal} right={`${Math.round(eaten.kcal)} / ${targets.kcal} kcal`} />
            <Bar label="🥚 Protein" value={eaten.protein} max={targets.protein} right={`${Math.round(eaten.protein)} / ${targets.protein} g`} />
          </>
        ) : (
          <p className="mt-3 text-sm text-white/60">Meals logged today: {new Set(todaysFood.map((f) => f.meal)).size}</p>
        )}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="block text-xs text-white/60">
            😴 Sleep last night (hours)
            <input
              className={`${inputClass} mt-1`}
              type="number"
              inputMode="decimal"
              step={0.5}
              value={log.sleep ?? ""}
              onChange={(e) => setDay({ sleep: toNum(e.target.value, 24) })}
              placeholder="e.g. 7.5"
            />
          </label>
          <label className="block text-xs text-white/60">
            👟 Steps today
            <input
              className={`${inputClass} mt-1`}
              type="number"
              inputMode="numeric"
              value={log.steps ?? ""}
              onChange={(e) => setDay({ steps: toNum(e.target.value, 100000, true) })}
              placeholder="e.g. 6000"
            />
          </label>
        </div>
        <p className="mt-2 text-[11px] text-white/40">Type your steps in from your phone's step counter.</p>
      </Card>

      {/* Habits */}
      <Card title="Healthy habits today">
        <div className="flex flex-wrap gap-2">
          {HABITS.map((h) => (
            <Chip
              key={h}
              label={h}
              on={log.habits.includes(h)}
              onClick={() => setDay({ habits: log.habits.includes(h) ? log.habits.filter((x) => x !== h) : [...log.habits, h] })}
            />
          ))}
        </div>
      </Card>

      {/* This week */}
      <Card title="This week">
        <div className="grid grid-cols-7 gap-1 text-center">
          {WEEK_MON.map((d, i) => {
            const key = addDays(ws, i);
            const trained = trainedOn(data.sessions, key);
            const planned = !!plan && plan.weekdays.includes(d);
            return (
              <div key={d}>
                <p className={`text-[11px] ${key === today ? "font-bold text-neon" : "text-white/50"}`}>{d}</p>
                <div
                  className={`mx-auto mt-1 flex h-8 w-8 items-center justify-center rounded-full border text-xs text-black ${
                    trained ? "border-neon bg-neon" : planned ? "border-white/40" : "border-white/10"
                  }`}
                >
                  {trained ? "✓" : ""}
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-white/40">Outlined circles are your planned training days.</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Stat label="Workouts" value={`${weekSessions.length} / ${plan?.weekdays.length ?? 0}`} />
          <Stat label="Sets" value={weekSessions.reduce((a, s) => a + doneSets(s), 0)} />
          <Stat label="Minutes" value={Math.round(weekSessions.reduce((a, s) => a + s.seconds, 0) / 60)} />
        </div>
      </Card>

      {/* Weight */}
      <Card title="Weight" right={<Btn small onClick={() => setWeighing(true)}>Log weight</Btn>}>
        <p className="text-3xl font-bold">{showWeight(weightNow, profile)}</p>
        <p className="mt-1 text-sm text-white/60">
          {Math.abs(change) < 0.05
            ? "Same as when you started"
            : `${change > 0 ? "▲" : "▼"} ${showWeight(Math.abs(change), profile)} since you started`}
        </p>
        <button type="button" className="mt-2 text-xs text-white/60 underline" onClick={() => go("progress")}>
          See your weight trend
        </button>
      </Card>

      {/* Challenges */}
      <Card title="Challenges">
        <ChallengeRow label="Today" c={dailyChallenge(profile, data, today)} />
        <ChallengeRow label="This week" c={weeklyChallenge(profile, data, today)} />
      </Card>

      {/* Achievements */}
      <Card
        title="Achievements"
        right={
          <button type="button" className="text-xs text-white/60 underline" onClick={() => go("progress")}>
            See all
          </button>
        }
      >
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Badges" value={`${earned.length} / ${allBadges.length}`} />
          <Stat label="Day streak" value={logStreak(data, today)} />
          <Stat label="Week streak" value={weekStreak(data, today)} />
        </div>
        {earned.length > 0 && (
          <p className="mt-3 text-sm text-white/70">Latest: {earned.slice(-3).map((b) => `🏅 ${b.name}`).join("   ")}</p>
        )}
      </Card>

      {/* Coming up */}
      {plan && next.length > 0 && (
        <Card title="Coming up">
          <ul className="divide-y divide-white/10">
            {next.map((u) => (
              <li key={u.date} className="flex justify-between gap-3 py-2 text-sm">
                <span className="text-white/60">{u.date === today ? "Today" : `${weekdayOf(u.date)} ${prettyDate(u.date)}`}</span>
                <span className="font-semibold">{plan.days[u.index].title}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Note>BYB gives general fitness information, not medical advice. Stop any exercise that causes pain.</Note>

      {weighing && <WeightLogger profile={profile} data={data} setData={setData} onClose={() => setWeighing(false)} />}
    </div>
  );
}

function WorkoutPreview({ day, onStart }: { day: PlanDay; onStart: () => void }) {
  return (
    <div>
      <p className="text-xl font-bold">{day.title}</p>
      <p className="text-sm text-white/60">
        {day.focus} · {day.exercises.length} exercises · about {estimateMinutes(day)} min
      </p>
      <ul className="mt-3 space-y-1 text-sm text-white/80">
        {day.exercises.map((x) => {
          const ex = byId(x.id);
          return (
            <li key={x.id}>
              • {ex?.name ?? x.id}{" "}
              <span className="text-white/45">
                {x.sets} × {x.reps} {ex ? UNIT_LABEL[ex.unit] : ""}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="mt-4">
        <Btn onClick={onStart}>▶ Start workout</Btn>
      </div>
    </div>
  );
}

function ChallengeRow({ label, c }: { label: string; c: Challenge }) {
  return (
    <div className="flex items-start gap-3 border-b border-white/10 py-3 last:border-0">
      <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${c.done ? "bg-neon text-black" : "border border-white/30"}`}>
        {c.done ? "✓" : ""}
      </span>
      <div className="flex-1">
        <p className="text-[11px] uppercase tracking-wide text-white/45">{label}</p>
        <p className="text-sm font-semibold">{c.title}</p>
        <p className="text-xs text-white/55">{c.detail}</p>
      </div>
      <span className="text-xs text-white/60">{c.progress}</span>
    </div>
  );
}

export function WeightLogger({
  profile,
  data,
  setData,
  onClose,
}: {
  profile: Profile;
  data: AppData;
  setData: SetData;
  onClose: () => void;
}) {
  const [value, setValue] = useState(String(toUnit(latestWeightKg(profile, data), profile)));
  const [date, setDate] = useState(dateKey());
  const kg = fromUnit(Number(value), profile);
  const ok = kg >= 30 && kg <= 300 && date <= dateKey();
  return (
    <Modal title="Log your weight" onClose={onClose}>
      <label className="mt-4 block text-sm text-white/70">
        Date
        <input className={`${inputClass} mt-1`} type="date" max={dateKey()} value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      <label className="mt-3 block text-sm text-white/70">
        Weight ({weightUnit(profile)})
        <input
          className={`${inputClass} mt-1`}
          type="number"
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </label>
      <Note>Weigh yourself at the same time of day, ideally in the morning. Daily weight goes up and down; the weekly trend matters more.</Note>
      <div className="mt-4 flex gap-2">
        <Btn
          disabled={!ok}
          onClick={() => {
            setData((d) => setWeight(d, date, Math.round(kg * 10) / 10));
            onClose();
          }}
        >
          Save
        </Btn>
        <Btn kind="soft" onClick={onClose}>
          Cancel
        </Btn>
      </div>
    </Modal>
  );
}