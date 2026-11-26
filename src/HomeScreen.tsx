import type { ReactNode } from "react";
import type { DayLog } from "./store";
import { LIVE_KEY, addDays, dateKey, dayLog, read, weekStart, weekdayOf } from "./store";
import { FEELINGS, insights, isTrainingDay, trainedOn } from "./train";
import { foodOn, nutritionTargets, totalsOf, updateDay } from "./stats";
import { needsGearSetup } from "./weights";
import { useApp } from "./nav";
import { RootHeader, SectionTitle } from "./kit";
import { Icon } from "./icons";
import { Bar, Btn, Card, Chip, Stepper } from "./ui";
import { GearPrompt, TodayCard } from "./Workouts";
import type { LiveState } from "./LiveWorkout";

// Reading the clock happens here, outside the screen
function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}
function todayText() {
  return new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
}

function Line({ icon, label, sub, children }: { icon: string; label: string; sub?: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/5 text-neon">
        <Icon name={icon} size={18} />
      </span>
      <span className="min-w-0 flex-1 text-sm">
        {label}
        {sub && <span className="block text-xs text-white/40">{sub}</span>}
      </span>
      {children}
    </div>
  );
}

export default function HomeScreen() {
  const { profile, data, setData, nav } = useApp();
  const today = dateKey();
  const log = dayLog(data, today);
  const t = nutritionTargets(profile, data);
  const todayFood = foodOn(data, today);
  const eaten = totalsOf(todayFood);
  const live = read<LiveState>(LIVE_KEY);
  const tips = insights(profile, data).slice(0, 3);
  const week = Array.from({ length: 7 }, (_, i) => addDays(weekStart(today), i));
  const plan = data.plan;
  const setDay = (patch: Partial<DayLog>) => setData((d) => updateDay(d, today, patch));
  const openPlan = () => {
    nav.switchTab("workouts");
    nav.push({ name: "plan" });
  };

  return (
    <>
      <RootHeader title={`${greeting()}, ${profile.name.split(" ")[0]}`} sub={todayText()} />

      {live && (
        <Card title="Workout in progress">
          <p className="font-semibold">{live.day.title}</p>
          <div className="mt-3">
            <Btn onClick={() => nav.push({ name: "live" })}>Resume workout</Btn>
          </div>
        </Card>
      )}
      {needsGearSetup(profile, data.gear) && <GearPrompt />}
      <TodayCard />

      <Card title="How do you feel today?">
        <div className="flex flex-wrap gap-2">
          {FEELINGS.map((f) => (
            <Chip key={f} label={f} on={log.feel === f} onClick={() => setDay({ feel: log.feel === f ? undefined : f })} />
          ))}
        </div>
      </Card>

      {tips.length > 0 && (
        <>
          <SectionTitle>For you today</SectionTitle>
          <div className="mt-2 space-y-2">
            {tips.map((tip) => (
              <div
                key={tip.title + tip.text}
                className={`rounded-2xl border p-3 ${
                  tip.kind === "warn" || tip.kind === "rest" ? "border-yellow-400/30 bg-yellow-400/5" : "border-white/10 bg-white/5"
                }`}
              >
                <p className="text-sm font-semibold">{tip.title}</p>
                <p className="mt-0.5 text-xs text-white/60">{tip.text}</p>
              </div>
            ))}
          </div>
        </>
      )}

      <Card title="Today">
        <div className="space-y-3">
          <Line icon="droplet" label="Water" sub={`Goal: ${t.water} glasses`}>
            <Stepper value={log.water} onChange={(v) => setDay({ water: Math.min(30, v) })} />
          </Line>
          <Line icon="moon" label="Sleep last night">
            <Stepper value={log.sleep ?? 0} step={0.5} suffix=" h" onChange={(v) => setDay({ sleep: Math.min(16, v) })} />
          </Line>
          <Line icon="activity" label="Steps">
            <Stepper value={log.steps ?? 0} step={500} onChange={(v) => setDay({ steps: v })} />
          </Line>
        </div>
      </Card>

      <button
        type="button"
        onClick={() => nav.switchTab("food")}
        className="mt-4 block w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-left"
      >
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-neon">Food today</p>
          <Icon name="chevron" size={18} className="text-white/30" />
        </div>
        {profile.foodTracking === "Keep it simple" ? (
          <p className="mt-2 text-sm text-white/70">{todayFood.length} items logged today</p>
        ) : (
          <>
            <Bar label="Calories" value={eaten.kcal} max={t.kcal} right={`${Math.round(eaten.kcal)} / ${t.kcal} kcal`} />
            <Bar label="Protein" value={eaten.protein} max={t.protein} right={`${Math.round(eaten.protein)} / ${t.protein} g`} />
          </>
        )}
      </button>

      <Card title="This week" right={<button type="button" onClick={openPlan} className="text-xs text-neon">My plan</button>}>
        <div className="grid grid-cols-7 gap-1 text-center">
          {week.map((k) => {
            const trained = trainedOn(data.sessions, k);
            const planned = plan ? isTrainingDay(plan, k) : false;
            return (
              <button key={k} type="button" onClick={openPlan} className="flex flex-col items-center gap-1">
                <span className={`text-[11px] ${k === today ? "font-bold text-neon" : "text-white/50"}`}>{weekdayOf(k).slice(0, 1)}</span>
                <span
                  className={`grid h-8 w-8 place-items-center rounded-full text-xs ${
                    trained ? "bg-neon text-black" : planned ? "border border-neon/50 text-white/80" : "bg-white/5 text-white/30"
                  }`}
                >
                  {trained ? <Icon name="check" size={14} /> : Number(k.slice(8))}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-white/40">Filled = trained · Outline = planned</p>
      </Card>
    </>
  );
}