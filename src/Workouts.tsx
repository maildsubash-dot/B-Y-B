import { useState, type ComponentType, type ReactNode } from "react";
import { EQUIP_LABEL, EXERCISES, LEVEL_NAME, MUSCLES, UNIT_LABEL, byId, demoUrl, kindOf, type Exercise } from "./exercises";
import type { AppData, PlanDay, PlanExercise } from "./store";
import { WEEK_MON, dateKey, prettyDate, weekdayOf } from "./store";
import {
  FOCUSES, QUICK_TARGETS, SPLITS, alternatives, availableEquip, canDo, doneSets, estimateMinutes, generatePlan, historyFor,
  isSafeFor, planChoices, prescribe, quickWorkout, sessionVolume, showWeight, swapIn, toUnit, todaysIndex, trainedOn, upcoming,
  warmUp, weightUnit,
} from "./train";
import { REGIONS, imagesOf, regionOf } from "./exdb";
import { loadKind, loadText, needsGearSetup, ownedWeights, setCap, stepOwned, suggest } from "./weights";
import { useApp } from "./nav";
import { Header, IconBtn, RootHeader, Row, SearchBox, SectionTitle, Sheet, Tile, Toggle } from "./kit";
import { Icon } from "./icons";
import GearEditor from "./GearEditor";
import { Btn, Card, Chip, Note, Stat, Stepper, inputClass } from "./ui";

/* ==========================================================
   Workouts: today's workout, your plan, customising it, quick
   workouts, routines, the exercise library (by muscle, muscle
   part or equipment), your weights and your workout history.
   ========================================================== */

/* ---------- Shared pieces ---------- */
const KIND_LIST = ["Barbell", "Dumbbell", "Band", "Kettlebell", "Machine", "Cable", "Bodyweight", "Cardio"];
const KIND_LABEL: Record<string, string> = {
  Barbell: "Barbell", Dumbbell: "Dumbbells", Band: "Resistance bands", Kettlebell: "Kettlebell",
  Machine: "Machines", Cable: "Cable machine", Bodyweight: "Bodyweight", Cardio: "Cardio",
};

function withDay(d: AppData, index: number, fn: (list: PlanExercise[]) => PlanExercise[]): AppData {
  if (!d.plan) return d;
  return { ...d, plan: { ...d.plan, days: d.plan.days.map((dy, i) => (i === index ? { ...dy, exercises: fn(dy.exercises) } : dy)) } };
}

function Thumb({ ex }: { ex?: Exercise }) {
  const img = ex ? imagesOf(ex.id)[0] : undefined;
  if (img) return <img src={img} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded-xl bg-white object-cover" />;
  return (
    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-neon/15 text-neon">
      <Icon name={ex?.type === "Cardio" ? "activity" : "dumbbell"} size={20} />
    </span>
  );
}

function KindChips({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
      <Chip label="Any equipment" on={!value} onClick={() => onChange("")} />
      {KIND_LIST.map((k) => <Chip key={k} label={KIND_LABEL[k]} on={value === k} onClick={() => onChange(k)} />)}
    </div>
  );
}

function ExerciseRow({ px, onClick, extra }: { px: PlanExercise; onClick: () => void; extra?: ReactNode }) {
  const { profile, data } = useApp();
  const ex = byId(px.id);
  const s = suggest(px, profile, data);
  const load = ex ? loadText(ex, s, profile) : "";
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-2.5">
      <button type="button" onClick={onClick} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <Thumb ex={ex} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{ex?.name ?? px.id}</span>
          <span className="block truncate text-xs text-white/70">
            {px.sets} × {s.reps} {ex ? UNIT_LABEL[ex.unit] : ""}
            {load && <span className="text-neon"> · {load}</span>}
          </span>
          {s.last && (
            <span className="block truncate text-[11px] text-white/40">
              Last: {s.last.kg > 0 ? `${showWeight(s.last.kg, profile)} × ` : ""}
              {s.last.reps.join(", ")}
            </span>
          )}
        </span>
        {!extra && <Icon name="chevron" size={18} className="shrink-0 text-white/30" />}
      </button>
      {extra}
    </div>
  );
}

function ExRow({ ex, sub, onClick }: { ex: Exercise; sub?: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-2.5 text-left active:bg-white/10">
      <Thumb ex={ex} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{ex.name}</span>
        <span className="block truncate text-xs text-white/50">{sub ?? `${regionOf(ex)} · ${LEVEL_NAME[ex.level]} · ${KIND_LABEL[kindOf(ex)] ?? kindOf(ex)}`}</span>
      </span>
      <Icon name="chevron" size={18} className="shrink-0 text-white/30" />
    </button>
  );
}

export function GearPrompt() {
  const { nav } = useApp();
  return (
    <button type="button" onClick={() => nav.push({ name: "gear" })}
      className="mt-4 flex w-full items-center gap-3 rounded-2xl border border-yellow-400/40 bg-yellow-400/10 p-3 text-left">
      <Icon name="dumbbell" className="shrink-0 text-yellow-200" />
      <span className="flex-1 text-sm">
        <b>Add your dumbbells</b>
        <span className="block text-xs text-white/60">So BYB can suggest the right weight for every exercise.</span>
      </span>
      <Icon name="chevron" size={18} className="text-white/40" />
    </button>
  );
}

export function TodayCard() {
  const { profile, data, setData, nav, startWorkout } = useApp();
  const plan = data.plan;
  if (!plan || !plan.days.length) {
    return (
      <Card title="Your plan">
        <p className="text-sm text-white/70">You don't have a workout plan yet.</p>
        <div className="mt-3">
          <Btn onClick={() => setData((d) => ({ ...d, plan: generatePlan(profile) }))}>Create my plan</Btn>
        </div>
      </Card>
    );
  }
  const today = dateKey();
  const done = trainedOn(data.sessions, today);
  const idx = todaysIndex(plan, data.sessions);
  const next = upcoming(plan, data.sessions, 1)[0];
  const index = idx >= 0 ? idx : (next?.index ?? 0);
  const day = plan.days[index];
  const label = done ? "Done for today ✓" : idx >= 0 ? "Today's workout" : next ? `Rest day · next on ${weekdayOf(next.date)}` : "Next workout";
  return (
    <section className="mt-4 overflow-hidden rounded-3xl border border-neon/30 bg-gradient-to-br from-neon/15 to-white/5">
      <button type="button" onClick={() => nav.push({ name: "day", index })} className="block w-full p-4 text-left">
        <p className="text-xs font-semibold uppercase tracking-wider text-neon">{label}</p>
        <p className="mt-1 text-xl font-bold">{day.title}</p>
        <p className="text-sm text-white/60">{day.focus}</p>
        <p className="mt-2 flex items-center gap-1 text-xs text-white/50">
          <Icon name="clock" size={14} /> about {estimateMinutes(day)} min · {day.exercises.length} exercises
        </p>
        <ul className="mt-3 space-y-1 text-sm text-white/80">
          {day.exercises.slice(0, 3).map((x, i) => (
            <li key={`${x.id}-${i}`} className="truncate">• {byId(x.id)?.name ?? x.id}</li>
          ))}
          {day.exercises.length > 3 && <li className="text-white/40">+{day.exercises.length - 3} more</li>}
        </ul>
      </button>
      <div className="flex gap-2 px-4 pb-4">
        <Btn onClick={() => startWorkout(day, index)}>{done ? "Train again" : "Start workout"}</Btn>
        <Btn kind="soft" onClick={() => nav.push({ name: "day", index })}>View exercises</Btn>
      </div>
    </section>
  );
}

function WorkoutOverview({ day, planIndex }: { day: PlanDay; planIndex: number | null }) {
  const { profile, data, nav, startWorkout } = useApp();
  const equipment = [...new Set(day.exercises.flatMap((x) => byId(x.id)?.equipment ?? []))].map((e) => EQUIP_LABEL[e]);
  const sets = day.exercises.reduce((a, x) => a + x.sets, 0);
  return (
    <>
      <Card>
        <p className="text-sm text-white/70">{day.focus}</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Stat label="Minutes" value={`~${estimateMinutes(day)}`} />
          <Stat label="Exercises" value={day.exercises.length} />
          <Stat label="Sets" value={sets} />
        </div>
        <p className="mt-3 text-xs text-white/50">Equipment: {equipment.length ? equipment.join(", ") : "none (bodyweight)"}</p>
        <div className="mt-4">
          <Btn onClick={() => startWorkout(day, planIndex)}>▶ Start workout</Btn>
        </div>
      </Card>
      {needsGearSetup(profile, data.gear) && <GearPrompt />}
      <SectionTitle>Exercises</SectionTitle>
      <p className="mt-1 text-xs text-white/40">Tap an exercise to see how to do it.</p>
      <div className="mt-2 space-y-2">
        {day.exercises.map((px, i) => (
          <ExerciseRow key={`${px.id}-${i}`} px={px}
            onClick={() => nav.push({ name: "exercise", id: px.id, index: planIndex ?? -1, pos: i })} />
        ))}
      </div>
      <details className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
        <summary className="cursor-pointer font-semibold">Warm-up (5–8 min)</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-white/70">
          {warmUp(day).map((w) => <li key={w}>{w}</li>)}
        </ul>
      </details>
    </>
  );
}

/* ---------- Workouts tab ---------- */
function WorkoutsHome() {
  const { profile, data, nav } = useApp();
  return (
    <>
      <RootHeader title="Workouts" sub={data.plan ? data.plan.split : "No plan yet"} />
      {needsGearSetup(profile, data.gear) && <GearPrompt />}
      <TodayCard />
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Tile icon="calendar" title="My plan" sub="Your week" onClick={() => nav.push({ name: "plan" })} />
        <Tile icon="sliders" title="Customize" sub="Split, days, exercises" onClick={() => nav.push({ name: "customize" })} />
        <Tile icon="zap" title="Quick workout" sub="Pick a target and time" onClick={() => nav.push({ name: "quick" })} />
        <Tile icon="book" title="Exercise library" sub={`${EXERCISES.length} exercises`} onClick={() => nav.push({ name: "library" })} />
      </div>
      <div className="mt-3 space-y-2">
        <Row icon="bookmark" title="My routines" sub={`${data.routines.length} saved`} onClick={() => nav.push({ name: "routines" })} />
        <Row icon="dumbbell" title="Equipment & weights" sub={profile.place === "Gym" ? "Gym: full range of weights" : "The weights you own"}
          onClick={() => nav.push({ name: "gear" })} />
        <Row icon="history" title="Workout history" sub={`${data.sessions.length} workouts`} onClick={() => nav.push({ name: "history" })} />
      </div>
    </>
  );
}

function DayScreen() {
  const { data, nav } = useApp();
  const index = nav.screen.index ?? 0;
  const plan = data.plan;
  const day = plan?.days[index];
  if (!plan || !day) return (<><Header title="Workout" /><Note>This workout isn't in your plan anymore.</Note></>);
  const when = upcoming(plan, data.sessions, 7).find((u) => u.index === index);
  return (
    <>
      <Header title={day.title}
        sub={when ? `${when.date === dateKey() ? "Today" : weekdayOf(when.date)}, ${prettyDate(when.date)}` : day.focus}
        right={
          <button type="button" aria-label="Edit workout" onClick={() => nav.push({ name: "editDay", index })} className="rounded-full p-2 text-white/80">
            <Icon name="edit" size={20} />
          </button>
        } />
      <WorkoutOverview day={day} planIndex={index} />
    </>
  );
}

function PreviewScreen() {
  const { setData, preview } = useApp();
  const [saved, setSaved] = useState(false);
  if (!preview) return (<><Header title="Workout" /><Note>Nothing to show.</Note></>);
  const save = () => {
    setData((d) => ({
      ...d,
      routines: [...d.routines, {
        name: preview.title,
        plan: { choice: "Auto|Auto", split: "Single workout", minutes: estimateMinutes(preview), weekdays: [], days: [preview], why: [], seed: Date.now() },
      }],
    }));
    setSaved(true);
  };
  return (
    <>
      <Header title={preview.title} sub={preview.focus}
        right={
          <button type="button" aria-label="Save to my routines" disabled={saved} onClick={save} className="rounded-full p-2 text-white/80 disabled:text-neon">
            <Icon name="bookmark" size={20} />
          </button>
        } />
      {saved && <Note>Saved to My routines.</Note>}
      <WorkoutOverview day={preview} planIndex={null} />
    </>
  );
}

/* ---------- One exercise ---------- */
const REPS: Record<string, string[]> = {
  reps: ["5", "6–8", "8–10", "8–12", "10–12", "12–15", "15–20"],
  sec: ["20–30", "30–45", "45–60"],
  min: ["5", "10", "15", "20", "30"],
};
const RESTS = [30, 45, 60, 90, 120, 180];

function EditSheet({ index, pos, px, onClose }: { index: number; pos: number; px: PlanExercise; onClose: () => void }) {
  const { profile, data, setData } = useApp();
  const ex = byId(px.id);
  const s = suggest(px, profile, data);
  const owned = ex ? ownedWeights(loadKind(ex), profile, data.gear) : [];
  const [sets, setSets] = useState(px.sets);
  const [reps, setReps] = useState(px.reps);
  const [rest, setRest] = useState(px.rest);
  const [kg, setKg] = useState<number | null>(px.kg ?? s.kg);
  const day = data.plan?.days[index];
  const total = day ? day.exercises.reduce((a, x, i) => a + (i === pos ? sets : x.sets), 0) : sets;
  const cap = setCap(profile);
  const unit = ex?.unit ?? "reps";
  const save = () => {
    setData((d) => withDay(d, index, (list) =>
      list.map((x, j) => (j === pos ? { ...x, sets, reps: reps.trim() || x.reps, rest, kg: kg ?? undefined } : x))));
    onClose();
  };
  const stepKg = (dir: 1 | -1) => setKg((k) => stepOwned(owned, k ?? 0, dir) ?? k);
  return (
    <Sheet title={ex?.name ?? "Edit"} onClose={onClose}>
      <div className="space-y-5 text-sm">
        <div className="flex items-center justify-between">
          <span>Sets</span>
          <Stepper value={sets} min={1} onChange={(v) => setSets(Math.min(8, Math.max(1, v)))} />
        </div>
        {total > cap && <Note tone="warn">This workout now has {total} sets. BYB suggests up to {cap} for your level so you can recover.</Note>}
        <div>
          <p>{unit === "reps" ? "Reps" : unit === "sec" ? "Seconds" : "Minutes"}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {REPS[unit].map((r) => <Chip key={r} label={r} on={reps === r} onClick={() => setReps(r)} />)}
          </div>
          <input className={`${inputClass} mt-2`} value={reps} onChange={(e) => setReps(e.target.value)} aria-label="Custom reps" />
        </div>
        {owned.length > 0 && (
          <div>
            <div className="flex items-center justify-between">
              <span>Weight</span>
              <div className="flex items-center gap-2">
                <IconBtn icon="minus" label="Lighter" onClick={() => stepKg(-1)} />
                <span className="min-w-20 text-center font-semibold">{kg !== null ? showWeight(kg, profile) : "–"}</span>
                <IconBtn icon="plus" label="Heavier" onClick={() => stepKg(1)} />
              </div>
            </div>
            {s.kg !== null && (
              <p className="mt-1 text-xs text-white/50">
                Suggested: {showWeight(s.kg, profile)}. After you've done this exercise, BYB adjusts the weight from your results.
              </p>
            )}
          </div>
        )}
        <div>
          <p>Rest between sets</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {RESTS.map((r) => <Chip key={r} label={`${r} s`} on={rest === r} onClick={() => setRest(r)} />)}
          </div>
        </div>
        <Btn onClick={save}>Save</Btn>
      </div>
    </Sheet>
  );
}

function AddToPlanSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const { profile, data, setData } = useApp();
  const plan = data.plan;
  if (!plan) return null;
  const focus = planChoices(plan).focus;
  const add = (i: number) => {
    const px = prescribe(id, profile, focus);
    if (px) setData((d) => withDay(d, i, (list) => [...list, px]));
    onClose();
  };
  return (
    <Sheet title="Add to which workout?" onClose={onClose}>
      <div className="space-y-2">
        {plan.days.map((d, i) => (
          <Row key={`${d.title}-${i}`} icon="dumbbell" title={d.title} sub={`${d.exercises.length} exercises`} onClick={() => add(i)} />
        ))}
      </div>
    </Sheet>
  );
}

function ExerciseScreen() {
  const { profile, data, nav } = useApp();
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const id = nav.screen.id ?? "";
  const index = nav.screen.index ?? -1;
  const pos = nav.screen.pos ?? -1;
  const ex = byId(id);
  if (!ex) return (<><Header title="Exercise" /><Note>Exercise not found.</Note></>);
  const planned = index >= 0 ? data.plan?.days[index]?.exercises[pos] : undefined;
  const inPlan = !!planned && planned.id === id;
  const px: PlanExercise = planned && inPlan ? planned : (prescribe(id, profile) ?? { id, sets: 3, reps: "8–12", rest: 60 });
  const s = suggest(px, profile, data);
  const load = loadText(ex, s, profile);
  const photos = imagesOf(id);
  const easier = ex.easier ? byId(ex.easier) : undefined;
  const harder = ex.harder ? byId(ex.harder) : undefined;
  const history = historyFor(id, data.sessions).slice(-6).reverse();
  const tags = [ex.type, LEVEL_NAME[ex.level], ex.equipment.length ? ex.equipment.map((e) => EQUIP_LABEL[e]).join(" + ") : "Bodyweight"];
  return (
    <>
      <Header title={ex.name} sub={`${ex.muscle} · ${regionOf(ex)}`} />
      {photos.length > 0 && (
        <div className="-mx-4 mt-3 flex snap-x gap-2 overflow-x-auto px-4">
          {photos.map((src) => (
            <img key={src} src={src} alt={`${ex.name} demonstration`} loading="lazy" className="h-48 w-64 shrink-0 snap-center rounded-2xl bg-white object-contain" />
          ))}
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
        {tags.map((t) => <span key={t} className="rounded-full bg-white/10 px-2.5 py-1">{t}</span>)}
      </div>
      {!isSafeFor(ex, profile) && (
        <Note tone="warn">You mentioned pain in an area this exercise usually loads. Check with a doctor or physiotherapist first, or pick a swap.</Note>
      )}
      <Card title={inPlan ? "Your target" : "Suggested for you"}>
        <p className="text-lg font-bold">{px.sets} × {s.reps} {UNIT_LABEL[ex.unit]}</p>
        {load && <p className="text-sm text-neon">{load}</p>}
        {s.note && <p className="mt-1 text-xs text-white/60">{s.note}</p>}
        {s.last && (
          <p className="mt-2 text-xs text-white/50">
            Last time: {s.last.kg > 0 ? `${showWeight(s.last.kg, profile)} × ` : ""}{s.last.reps.join(", ")}
          </p>
        )}
        <p className="mt-1 text-xs text-white/40">Rest {px.rest} s between sets</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {inPlan ? (
            <>
              <Btn small onClick={() => setEditing(true)}>Edit sets, reps & weight</Btn>
              <Btn small kind="soft" onClick={() => nav.push({ name: "swap", index, pos, q: "exercise" })}>Swap exercise</Btn>
            </>
          ) : (
            data.plan && <Btn small onClick={() => setAdding(true)}>Add to a workout</Btn>
          )}
        </div>
      </Card>
      <Card title="How to do it">
        <ol className="list-decimal space-y-2 pl-5 text-sm text-white/80">
          {ex.steps.map((st, i) => <li key={i}>{st}</li>)}
        </ol>
        <a href={demoUrl(ex)} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm text-neon">
          <Icon name="play" size={14} /> Watch a demo video
        </a>
      </Card>
      {ex.mistakes.length > 0 && (
        <Card title="Common mistakes">
          <ul className="list-disc space-y-1 pl-5 text-sm text-white/70">{ex.mistakes.map((m) => <li key={m}>{m}</li>)}</ul>
        </Card>
      )}
      <Card title="Safety"><p className="text-sm text-white/70">{ex.safety}</p></Card>
      {(easier || harder) && (
        <>
          <SectionTitle>Other versions</SectionTitle>
          <div className="mt-2 space-y-2">
            {easier && <ExRow ex={easier} sub="Easier version" onClick={() => nav.push({ name: "exercise", id: easier.id })} />}
            {harder && <ExRow ex={harder} sub="Harder version" onClick={() => nav.push({ name: "exercise", id: harder.id })} />}
          </div>
        </>
      )}
      {history.length > 0 && (
        <Card title="Your history">
          <ul className="space-y-1 text-sm">
            {history.map((h) => (
              <li key={h.date} className="flex justify-between">
                <span className="text-white/50">{prettyDate(h.date)}</span>
                <span>{h.weight > 0 ? `${showWeight(h.weight, profile)} × ` : ""}{h.reps}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {editing && inPlan && <EditSheet index={index} pos={pos} px={px} onClose={() => setEditing(false)} />}
      {adding && <AddToPlanSheet id={id} onClose={() => setAdding(false)} />}
    </>
  );
}

function SwapScreen() {
  const { profile, data, setData, nav } = useApp();
  const [all, setAll] = useState(false);
  const [kind, setKind] = useState("");
  const index = nav.screen.index ?? -1;
  const pos = nav.screen.pos ?? -1;
  const plan = data.plan;
  const px = plan?.days[index]?.exercises[pos];
  const ex = px ? byId(px.id) : undefined;
  if (!plan || !px || !ex) return (<><Header title="Swap exercise" /><Note>Nothing to swap here.</Note></>);
  const focus = planChoices(plan).focus;
  const equip = availableEquip(profile, focus);
  const base = all
    ? EXERCISES.filter((o) => o.muscle === ex.muscle && o.id !== ex.id && canDo(o, equip) && isSafeFor(o, profile))
    : alternatives(ex.id, profile, focus);
  const list = base.filter((o) => !kind || kindOf(o) === kind).slice(0, all ? 100 : 30);
  const fromExercise = nav.screen.q === "exercise";
  const choose = (o: Exercise) => {
    setData((d) => withDay(d, index, (l) => l.map((x, j) => (j === pos ? swapIn(x, o.id, profile, focus) : x))));
    nav.back();
    if (fromExercise) nav.replace({ name: "exercise", id: o.id, index, pos });
  };
  return (
    <>
      <Header title={`Swap ${ex.name}`} sub="Fits your equipment and pain areas" />
      <Card><Toggle label={`Show every ${ex.muscle.toLowerCase()} exercise I can do`} on={all} onChange={setAll} /></Card>
      <KindChips value={kind} onChange={setKind} />
      <div className="mt-3 space-y-2">
        {list.map((o) => (
          <ExRow key={o.id} ex={o} onClick={() => choose(o)}
            sub={`${regionOf(o)} · ${LEVEL_NAME[o.level]} · ${KIND_LABEL[kindOf(o)] ?? kindOf(o)}${regionOf(o) === regionOf(ex) ? " · same area" : ""}`} />
        ))}
        {!list.length && <Note>Nothing matches. Try another equipment filter, or turn on the switch above.</Note>}
      </div>
    </>
  );
}

/* ---------- Plan ---------- */
function PlanScreen() {
  const { data, nav } = useApp();
  const plan = data.plan;
  if (!plan) return (<><Header title="My plan" /><TodayCard /></>);
  const today = dateKey();
  const week = upcoming(plan, data.sessions, 7);
  return (
    <>
      <Header title="My plan" sub={plan.split}
        right={
          <button type="button" aria-label="Customize plan" onClick={() => nav.push({ name: "customize" })} className="rounded-full p-2 text-white/80">
            <Icon name="sliders" size={20} />
          </button>
        } />
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Stat label="Days a week" value={plan.weekdays.length} />
        <Stat label="Minutes" value={`~${plan.minutes}`} />
        <Stat label="Workouts" value={plan.days.length} />
      </div>
      <SectionTitle>Coming up</SectionTitle>
      <div className="mt-2 space-y-2">
        {week.map((u) => (
          <Row key={u.date} icon="calendar" title={plan.days[u.index].title}
            sub={`${u.date === today ? "Today" : weekdayOf(u.date)}, ${prettyDate(u.date)} · about ${estimateMinutes(plan.days[u.index])} min`}
            onClick={() => nav.push({ name: "day", index: u.index })} />
        ))}
      </div>
      <SectionTitle>All workouts in your plan</SectionTitle>
      <div className="mt-2 space-y-2">
        {plan.days.map((d, i) => (
          <Row key={`${d.title}-${i}`} icon="list" title={d.title} sub={`${d.exercises.length} exercises · ${d.focus}`}
            onClick={() => nav.push({ name: "day", index: i })} />
        ))}
      </div>
      <details className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
        <summary className="cursor-pointer font-semibold">Why this plan?</summary>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-white/70">{plan.why.map((w) => <li key={w}>{w}</li>)}</ul>
      </details>
    </>
  );
}

function CustomizeScreen() {
  const { profile, data, setData, nav } = useApp();
  const plan = data.plan;
  const c = plan ? planChoices(plan) : { split: "Auto", focus: "Auto" };
  const [split, setSplit] = useState(c.split);
  const [focus, setFocus] = useState(c.focus);
  const [days, setDays] = useState<string[]>(plan?.weekdays ?? profile.days);
  const [minutes, setMinutes] = useState(plan?.minutes ?? (Number(profile.minutes) || 45));
  const [sheet, setSheet] = useState<"" | "rebuild" | "save">("");
  const [name, setName] = useState("");
  const toggleDay = (d: string) =>
    setDays((list) => (list.includes(d) ? list.filter((x) => x !== d) : WEEK_MON.filter((w) => w === d || list.includes(w))));
  const rebuild = () => {
    setData((dd) => ({ ...dd, plan: generatePlan({ ...profile, days }, split, focus, minutes) }));
    setSheet("");
  };
  const saveRoutine = () => {
    if (!plan || !name.trim()) return;
    setData((dd) => ({ ...dd, routines: [...dd.routines, { name: name.trim(), plan }] }));
    setName("");
    setSheet("");
  };
  return (
    <>
      <Header title="Customize plan" />
      <SectionTitle>Split</SectionTitle>
      <div className="mt-2 flex flex-wrap gap-2">{SPLITS.map((s) => <Chip key={s} label={s} on={split === s} onClick={() => setSplit(s)} />)}</div>
      <SectionTitle>Focus</SectionTitle>
      <div className="mt-2 flex flex-wrap gap-2">{FOCUSES.map((f) => <Chip key={f} label={f} on={focus === f} onClick={() => setFocus(f)} />)}</div>
      <SectionTitle>Training days</SectionTitle>
      <div className="mt-2 flex flex-wrap gap-2">{WEEK_MON.map((d) => <Chip key={d} label={d} on={days.includes(d)} onClick={() => toggleDay(d)} />)}</div>
      <SectionTitle>Minutes per workout</SectionTitle>
      <div className="mt-2 flex flex-wrap gap-2">
        {[20, 30, 45, 60, 75, 90].map((m) => <Chip key={m} label={`${m}`} on={minutes === m} onClick={() => setMinutes(m)} />)}
      </div>
      <div className="mt-5"><Btn disabled={!days.length} onClick={() => setSheet("rebuild")}>Rebuild my plan</Btn></div>
      {plan && (
        <>
          <SectionTitle>Edit workouts one by one</SectionTitle>
          <div className="mt-2 space-y-2">
            {plan.days.map((d, i) => (
              <Row key={`${d.title}-${i}`} icon="edit" title={d.title} sub="Add, remove, reorder or swap exercises"
                onClick={() => nav.push({ name: "editDay", index: i })} />
            ))}
          </div>
          <div className="mt-4"><Btn kind="soft" onClick={() => setSheet("save")}>Save current plan as a routine</Btn></div>
        </>
      )}
      {sheet === "rebuild" && (
        <Sheet title="Rebuild your plan?" onClose={() => setSheet("")}>
          <p className="text-sm text-white/70">This replaces your current workouts with a new plan using these settings. Your workout history stays.</p>
          <div className="mt-4"><Btn onClick={rebuild}>Rebuild</Btn></div>
        </Sheet>
      )}
      {sheet === "save" && (
        <Sheet title="Save as a routine" onClose={() => setSheet("")}>
          <input className={inputClass} placeholder="Routine name" value={name} onChange={(e) => setName(e.target.value)} />
          <div className="mt-4"><Btn disabled={!name.trim()} onClick={saveRoutine}>Save</Btn></div>
        </Sheet>
      )}
    </>
  );
}

function EditDayScreen() {
  const { profile, data, setData, nav } = useApp();
  const index = nav.screen.index ?? 0;
  const day = data.plan?.days[index];
  if (!day) return (<><Header title="Edit workout" /><Note>This workout isn't in your plan anymore.</Note></>);
  const update = (fn: (list: PlanExercise[]) => PlanExercise[]) => setData((d) => withDay(d, index, fn));
  const move = (i: number, dir: -1 | 1) =>
    update((list) => {
      const j = i + dir;
      if (j < 0 || j >= list.length) return list;
      const out = [...list];
      [out[i], out[j]] = [out[j], out[i]];
      return out;
    });
  const total = day.exercises.reduce((a, x) => a + x.sets, 0);
  const cap = setCap(profile);
  return (
    <>
      <Header title={`Edit ${day.title}`} sub={`${total} sets · BYB suggests up to ${cap}`} />
      {total > cap && (
        <Note tone="warn">This workout has more sets than BYB recommends for your level. Remove an exercise or lower some sets so you can recover.</Note>
      )}
      <div className="mt-3 space-y-2">
        {day.exercises.map((px, i) => (
          <ExerciseRow key={`${px.id}-${i}`} px={px} onClick={() => nav.push({ name: "exercise", id: px.id, index, pos: i })}
            extra={
              <div className="grid shrink-0 grid-cols-2 gap-1">
                <IconBtn icon="up" label="Move up" disabled={i === 0} onClick={() => move(i, -1)} />
                <IconBtn icon="down" label="Move down" disabled={i === day.exercises.length - 1} onClick={() => move(i, 1)} />
                <IconBtn icon="swap" label="Swap" onClick={() => nav.push({ name: "swap", index, pos: i, q: "day" })} />
                <IconBtn icon="trash" label="Remove" disabled={day.exercises.length <= 1} onClick={() => update((list) => list.filter((_, k) => k !== i))} />
              </div>
            } />
        ))}
      </div>
      <div className="mt-4"><Btn onClick={() => nav.push({ name: "addExercise", index })}>+ Add exercise</Btn></div>
      <p className="mt-3 text-xs text-white/40">Tap an exercise to change its sets, reps and weight.</p>
    </>
  );
}

function AddExerciseScreen() {
  const { profile, data, setData, nav } = useApp();
  const [q, setQ] = useState("");
  const [muscle, setMuscle] = useState("");
  const [kind, setKind] = useState("");
  const [mine, setMine] = useState(true);
  const index = nav.screen.index ?? 0;
  const focus = data.plan ? planChoices(data.plan).focus : "Auto";
  const equip = availableEquip(profile, focus);
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const list = EXERCISES.filter(
    (ex) => (!muscle || ex.muscle === muscle) && (!kind || kindOf(ex) === kind) &&
      (!mine || (canDo(ex, equip) && isSafeFor(ex, profile))) && words.every((w) => ex.name.toLowerCase().includes(w)),
  ).slice(0, 60);
  const add = (ex: Exercise) => {
    const px = prescribe(ex.id, profile, focus);
    if (px) setData((d) => withDay(d, index, (l) => [...l, px]));
    nav.back();
  };
  return (
    <>
      <Header title="Add exercise" sub={data.plan?.days[index]?.title} />
      <SearchBox value={q} onChange={setQ} placeholder="Search, e.g. hammer curl" />
      <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
        <Chip label="All muscles" on={!muscle} onClick={() => setMuscle("")} />
        {MUSCLES.map((m) => <Chip key={m} label={m} on={muscle === m} onClick={() => setMuscle(m)} />)}
      </div>
      <KindChips value={kind} onChange={setKind} />
      <Card><Toggle label="Only exercises I can do" on={mine} onChange={setMine} /></Card>
      <div className="mt-3 space-y-2">
        {list.map((ex) => <ExRow key={ex.id} ex={ex} sub={`${ex.muscle} · ${regionOf(ex)} · ${KIND_LABEL[kindOf(ex)] ?? kindOf(ex)}`} onClick={() => add(ex)} />)}
        {!list.length && <Note>No exercises found. Try another word or filter, or turn off "Only exercises I can do".</Note>}
      </div>
    </>
  );
}

/* ---------- Quick workouts and routines ---------- */
function QuickScreen() {
  const { profile, showWorkout } = useApp();
  const [target, setTarget] = useState("Full body");
  const [minutes, setMinutes] = useState(30);
  const [bodyweight, setBodyweight] = useState(profile.place === "Bodyweight only");
  return (
    <>
      <Header title="Quick workout" sub="A one-off workout, made for you" />
      <SectionTitle>What do you want to train?</SectionTitle>
      <div className="mt-2 flex flex-wrap gap-2">{QUICK_TARGETS.map((t) => <Chip key={t} label={t} on={target === t} onClick={() => setTarget(t)} />)}</div>
      <SectionTitle>How long?</SectionTitle>
      <div className="mt-2 flex flex-wrap gap-2">
        {[15, 20, 30, 45, 60].map((m) => <Chip key={m} label={`${m} min`} on={minutes === m} onClick={() => setMinutes(m)} />)}
      </div>
      <Card><Toggle label="No equipment (bodyweight only)" on={bodyweight} onChange={setBodyweight} /></Card>
      <div className="mt-4"><Btn onClick={() => showWorkout(quickWorkout(profile, target, minutes, bodyweight))}>Make my workout</Btn></div>
    </>
  );
}

function RoutinesScreen() {
  const { data, nav } = useApp();
  return (
    <>
      <Header title="My routines" />
      {data.routines.length === 0 && (
        <Note>No routines yet. Save one from Customize plan, or tap the bookmark on any quick workout.</Note>
      )}
      <div className="mt-3 space-y-2">
        {data.routines.map((r, i) => (
          <Row key={`${r.name}-${i}`} icon="bookmark" title={r.name} sub={`${r.plan.days.length} workout${r.plan.days.length === 1 ? "" : "s"} · ${r.plan.split}`}
            onClick={() => nav.push({ name: "routine", index: i })} />
        ))}
      </div>
    </>
  );
}

function RoutineScreen() {
  const { data, setData, nav, showWorkout } = useApp();
  const [confirm, setConfirm] = useState<"" | "use" | "delete">("");
  const index = nav.screen.index ?? 0;
  const r = data.routines[index];
  if (!r) return (<><Header title="Routine" /><Note>This routine was deleted.</Note></>);
  const use = () => {
    setData((d) => ({ ...d, plan: { ...r.plan, seed: Date.now() } }));
    setConfirm("");
    nav.back();
  };
  const del = () => {
    setData((d) => ({ ...d, routines: d.routines.filter((_, i) => i !== index) }));
    setConfirm("");
    nav.back();
  };
  return (
    <>
      <Header title={r.name} sub={r.plan.split} />
      <div className="mt-3 space-y-2">
        {r.plan.days.map((d, i) => (
          <Row key={`${d.title}-${i}`} icon="dumbbell" title={d.title} sub={`${d.exercises.length} exercises · about ${estimateMinutes(d)} min`}
            onClick={() => showWorkout(d)} />
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {r.plan.weekdays.length > 0 && <Btn onClick={() => setConfirm("use")}>Use as my plan</Btn>}
        <Btn kind="danger" onClick={() => setConfirm("delete")}>Delete</Btn>
      </div>
      {confirm === "use" && (
        <Sheet title="Use this routine as your plan?" onClose={() => setConfirm("")}>
          <p className="text-sm text-white/70">Your current plan will be replaced. Your workout history stays.</p>
          <div className="mt-4"><Btn onClick={use}>Use this plan</Btn></div>
        </Sheet>
      )}
      {confirm === "delete" && (
        <Sheet title="Delete this routine?" onClose={() => setConfirm("")}>
          <Btn kind="danger" onClick={del}>Delete</Btn>
        </Sheet>
      )}
    </>
  );
}

/* ---------- Exercise library ---------- */
const MUSCLE_NOTES: Record<string, string> = {
  Biceps: "Your biceps has two heads, long and short. The brachialis sits underneath it; hammer and reverse curls train it.",
  Triceps: "Your triceps has three heads: long, lateral and medial.",
  Shoulders: "Your shoulder (deltoid) has front, side and rear parts.",
  Chest: "Incline work focuses on the upper chest, flat work on the middle, and decline work or dips on the lower chest.",
};

function LibraryScreen() {
  const { nav } = useApp();
  const [q, setQ] = useState("");
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const results = words.length ? EXERCISES.filter((ex) => words.every((w) => ex.name.toLowerCase().includes(w))).slice(0, 50) : [];
  return (
    <>
      <Header title="Exercise library" sub={`${EXERCISES.length} exercises`} />
      <SearchBox value={q} onChange={setQ} placeholder="Search exercises" />
      {words.length > 0 ? (
        <div className="mt-3 space-y-2">
          {results.map((ex) => (
            <ExRow key={ex.id} ex={ex} sub={`${ex.muscle} · ${regionOf(ex)} · ${KIND_LABEL[kindOf(ex)] ?? kindOf(ex)}`}
              onClick={() => nav.push({ name: "exercise", id: ex.id })} />
          ))}
          {!results.length && <Note>No exercises found.</Note>}
        </div>
      ) : (
        <>
          <SectionTitle>By muscle</SectionTitle>
          <div className="mt-2 space-y-2">
            {MUSCLES.map((m) => (
              <Row key={m} icon={m === "Full body" ? "activity" : "dumbbell"} title={m}
                sub={`${EXERCISES.filter((ex) => ex.muscle === m).length} exercises`} onClick={() => nav.push({ name: "libMuscle", q: m })} />
            ))}
          </div>
          <SectionTitle>By equipment</SectionTitle>
          <div className="mt-2 space-y-2">
            {KIND_LIST.map((k) => (
              <Row key={k} icon={k === "Cardio" ? "activity" : "dumbbell"} title={KIND_LABEL[k]}
                sub={`${EXERCISES.filter((ex) => kindOf(ex) === k).length} exercises`} onClick={() => nav.push({ name: "libList", q: `equip:${k}` })} />
            ))}
          </div>
        </>
      )}
    </>
  );
}

function LibMuscleScreen() {
  const { nav } = useApp();
  const muscle = nav.screen.q ?? "Chest";
  const list = EXERCISES.filter((ex) => ex.muscle === muscle);
  const regions = muscle in REGIONS ? REGIONS[muscle] : [...new Set(list.map((ex) => regionOf(ex)))];
  return (
    <>
      <Header title={muscle} sub={`${list.length} exercises`} />
      {MUSCLE_NOTES[muscle] && <Note>{MUSCLE_NOTES[muscle]}</Note>}
      <div className="mt-3 space-y-2">
        <Row icon="list" title={`All ${muscle.toLowerCase()} exercises`} sub={`${list.length} exercises`}
          onClick={() => nav.push({ name: "libList", q: muscle, id: "" })} />
        {regions.map((r) => {
          const n = list.filter((ex) => regionOf(ex) === r).length;
          return n ? <Row key={r} icon="dumbbell" title={r} sub={`${n} exercises`} onClick={() => nav.push({ name: "libList", q: muscle, id: r })} /> : null;
        })}
      </div>
    </>
  );
}

function LibListScreen() {
  const { profile, nav } = useApp();
  const q = nav.screen.q ?? "";
  const byKind = q.startsWith("equip:");
  const fixedKind = byKind ? q.slice(6) : "";
  const fixedMuscle = byKind ? "" : q;
  const region = nav.screen.id ?? "";
  const [mine, setMine] = useState(!byKind);
  const [level, setLevel] = useState(0);
  const [kind, setKind] = useState("");
  const [muscle, setMuscle] = useState("");
  const equip = availableEquip(profile);
  const list = EXERCISES.filter(
    (ex) =>
      (byKind
        ? kindOf(ex) === fixedKind && (!muscle || ex.muscle === muscle)
        : ex.muscle === fixedMuscle && (!region || regionOf(ex) === region) && (!kind || kindOf(ex) === kind)) &&
      (!level || ex.level === level) &&
      (!mine || (canDo(ex, equip) && isSafeFor(ex, profile))),
  );
  const title = byKind ? (KIND_LABEL[fixedKind] ?? fixedKind) : region || `All ${fixedMuscle.toLowerCase()}`;
  return (
    <>
      <Header title={title} sub={`${list.length} exercises`} />
      <Card>
        <Toggle label="Only exercises I can do" on={mine} onChange={setMine} />
        <div className="mt-3 flex flex-wrap gap-2">
          {["All levels", "Beginner", "Intermediate", "Advanced"].map((l, i) => <Chip key={l} label={l} on={level === i} onClick={() => setLevel(i)} />)}
        </div>
      </Card>
      {byKind ? (
        <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
          <Chip label="All muscles" on={!muscle} onClick={() => setMuscle("")} />
          {MUSCLES.map((m) => <Chip key={m} label={m} on={muscle === m} onClick={() => setMuscle(m)} />)}
        </div>
      ) : (
        <KindChips value={kind} onChange={setKind} />
      )}
      <div className="mt-3 space-y-2">
        {list.slice(0, 150).map((ex) => (
          <ExRow key={ex.id} ex={ex} onClick={() => nav.push({ name: "exercise", id: ex.id })}
            sub={byKind ? `${ex.muscle} · ${regionOf(ex)} · ${LEVEL_NAME[ex.level]}` : undefined} />
        ))}
        {!list.length && <Note>No exercises here{mine ? ' with your equipment. Turn off "Only exercises I can do" to see all.' : "."}</Note>}
        {list.length > 150 && <p className="text-center text-xs text-white/40">Showing 150 of {list.length}. Use the filters to narrow the list.</p>}
      </div>
    </>
  );
}

/* ---------- Equipment and history ---------- */
function GearScreen() {
  const { profile, data, setData, nav } = useApp();
  const [gear, setGear] = useState(data.gear);
  const gym = profile.place === "Gym";
  return (
    <>
      <Header title="Equipment & weights" />
      <Card title="Where you train">
        <p className="font-semibold">{profile.place || "Not set"}</p>
        <p className="mt-1 text-xs text-white/60">
          {gym ? "At the gym, BYB assumes a full range of dumbbells, barbells, kettlebells and machines."
            : profile.equipment.length ? profile.equipment.join(", ") : "No equipment"}
        </p>
        <p className="mt-2 text-xs text-white/40">To change this, open Profile → Edit my answers.</p>
      </Card>
      <Card title={gym ? "Weights at home (optional)" : "Your weights"}>
        <GearEditor gear={gear} onChange={setGear} imperial={profile.units === "imperial"} dumbbells
          kettlebells={gym || profile.equipment.includes("Kettlebell")} />
      </Card>
      <div className="mt-4">
        <Btn onClick={() => { setData((d) => ({ ...d, gear: { ...gear, set: true } })); nav.back(); }}>Save</Btn>
      </div>
    </>
  );
}

function HistoryScreen() {
  const { data, nav } = useApp();
  const list = [...data.sessions].reverse();
  return (
    <>
      <Header title="Workout history" sub={`${list.length} workouts`} />
      {!list.length && <Note>No workouts yet. Finish a workout and it shows up here.</Note>}
      <div className="mt-3 space-y-2">
        {list.map((s) => (
          <Row key={s.id} icon="check" title={s.title}
            sub={`${weekdayOf(s.date)}, ${prettyDate(s.date)} · ${Math.round(s.seconds / 60)} min · ${doneSets(s)} sets${s.effort ? ` · ${s.effort}` : ""}`}
            onClick={() => nav.push({ name: "session", id: s.id })} />
        ))}
      </div>
    </>
  );
}

function SessionScreen() {
  const { profile, data, setData, nav } = useApp();
  const [confirm, setConfirm] = useState(false);
  const s = data.sessions.find((x) => x.id === nav.screen.id);
  if (!s) return (<><Header title="Workout" /><Note>This workout was deleted.</Note></>);
  const del = () => {
    setData((d) => ({ ...d, sessions: d.sessions.filter((x) => x.id !== s.id) }));
    setConfirm(false);
    nav.back();
  };
  return (
    <>
      <Header title={s.title} sub={`${weekdayOf(s.date)}, ${prettyDate(s.date)}`} />
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Stat label="Minutes" value={Math.round(s.seconds / 60)} />
        <Stat label="Sets" value={doneSets(s)} />
        <Stat label="Volume" value={`${Math.round(toUnit(sessionVolume(s), profile))} ${weightUnit(profile)}`} />
      </div>
      {s.exercises.map((l, i) => {
        const ex = byId(l.id);
        const sets = l.sets.filter((x) => x.done);
        return (
          <Card key={`${l.id}-${i}`} title={ex?.name ?? l.id}>
            {sets.length === 0 ? (
              <p className="text-sm text-white/50">Skipped</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {sets.map((x, k) => (
                  <li key={k} className="flex justify-between">
                    <span className="text-white/50">Set {k + 1}</span>
                    <span>{x.weight > 0 ? `${showWeight(x.weight, profile)} × ` : ""}{x.reps} {ex ? UNIT_LABEL[ex.unit] : ""}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        );
      })}
      <div className="mt-4"><Btn kind="danger" onClick={() => setConfirm(true)}>Delete this workout</Btn></div>
      {confirm && (
        <Sheet title="Delete this workout?" onClose={() => setConfirm(false)}>
          <p className="text-sm text-white/70">This can't be undone.</p>
          <div className="mt-4"><Btn kind="danger" onClick={del}>Delete</Btn></div>
        </Sheet>
      )}
    </>
  );
}

/* ---------- Every workout screen, by name ---------- */
export const WORKOUT_SCREENS: Record<string, ComponentType> = {
  workouts: WorkoutsHome, day: DayScreen, workout: PreviewScreen, exercise: ExerciseScreen, swap: SwapScreen,
  plan: PlanScreen, customize: CustomizeScreen, editDay: EditDayScreen, addExercise: AddExerciseScreen,
  quick: QuickScreen, routines: RoutinesScreen, routine: RoutineScreen, library: LibraryScreen,
  libMuscle: LibMuscleScreen, libList: LibListScreen, gear: GearScreen, history: HistoryScreen, session: SessionScreen,
};