import { useEffect, useState } from "react";
import type { AppData, ExerciseLog, PlanDay, PlanExercise, Profile, Session, SetLog } from "./store";
import { LIVE_KEY, dateKey, read, remove, uid, write } from "./store";
import { UNIT_LABEL, byId, demoUrl } from "./exercises";
import { EFFORTS, alternatives, newRecords, showWeight, swapIn, toUnit, topOf, warmUp, weightUnit } from "./train";
import { imagesOf, regionOf } from "./exdb";
import { loadKind, loadText, ownedWeights, stepOwned, suggest } from "./weights";
import { useApp, useBackHandler } from "./nav";
import { Sheet } from "./kit";
import { Icon } from "./icons";
import { Btn, Card, Chip, Note, Stat } from "./ui";

/* ==========================================================
   Live workout: warm-up, one exercise at a time, suggested
   weights, a rest timer, then a summary. Progress is saved
   on the phone, so you can leave and resume later.
   ========================================================== */

export type LiveState = {
  day: PlanDay;
  planIndex: number | null;
  started: number;
  pausedAt: number | null;
  pausedMs: number;
  phase: "warmup" | "work" | "summary";
  current: number;
  logs: ExerciseLog[];
  restUntil: number | null;
  restTotal: number;
  effort: string;
  seconds: number;
};

function logFor(px: PlanExercise, p: Profile, data: AppData): ExerciseLog {
  const s = suggest(px, p, data);
  const target = topOf(s.reps);
  return {
    id: px.id,
    skipped: false,
    sets: Array.from({ length: px.sets }, () => ({ reps: target, weight: s.kg ?? 0, done: false })),
  };
}

export function newLive(day: PlanDay, planIndex: number | null, p: Profile, data: AppData): LiveState {
  return {
    day, planIndex, started: Date.now(), pausedAt: null, pausedMs: 0, phase: "warmup", current: 0,
    logs: day.exercises.map((px) => logFor(px, p, data)), restUntil: null, restTotal: 0, effort: "", seconds: 0,
  };
}

const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
const elapsedOf = (s: LiveState, now: number) => Math.max(0, Math.floor(((s.pausedAt ?? now) - s.started - s.pausedMs) / 1000));

function beep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.value = 0.15;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
    osc.onended = () => void ctx.close();
  } catch {
    /* sound not available */
  }
  try {
    navigator.vibrate?.([200, 100, 200]);
  } catch {
    /* vibration not available */
  }
}

export default function LiveWorkout() {
  const { profile, data, setData, nav } = useApp();
  const [st, setSt] = useState<LiveState | null>(() => read<LiveState>(LIVE_KEY));
  const [now, setNow] = useState(() => Date.now());
  const [sheet, setSheet] = useState<"" | "leave" | "info" | "swap">("");
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  useEffect(() => {
    if (st && !closed) write(LIVE_KEY, st);
  }, [st, closed]);
  const restUntil = st?.restUntil ?? null;
  useEffect(() => {
    if (restUntil !== null && now >= restUntil) {
      beep();
      setSt((s) => (s ? { ...s, restUntil: null } : s));
    }
  }, [now, restUntil]);
  useBackHandler(true, () => setSheet("leave"), 10);

  if (!st) {
    return (
      <div className="pt-10">
        <Note>No workout in progress.</Note>
        <div className="mt-4"><Btn onClick={nav.back}>Go back</Btn></div>
      </div>
    );
  }

  const update = (fn: (s: LiveState) => LiveState) => setSt((s) => (s ? fn(s) : s));
  const elapsed = elapsedOf(st, now);
  const px = st.day.exercises[st.current] as PlanExercise | undefined;
  const log = st.logs[st.current] as ExerciseLog | undefined;
  const ex = px ? byId(px.id) : undefined;
  const sug = px ? suggest(px, profile, data) : null;
  const kind = ex ? loadKind(ex) : "none";
  const owned = ownedWeights(kind, profile, data.gear);
  const restLeft = st.restUntil ? Math.max(0, Math.ceil((st.restUntil - now) / 1000)) : 0;
  const loadLine = ex && sug ? loadText(ex, sug, profile) : "";
  const photo = ex ? imagesOf(ex.id)[0] : undefined;

  /* ---------- Changes ---------- */
  const editSets = (fn: (sets: SetLog[]) => SetLog[]) =>
    update((s) => ({ ...s, logs: s.logs.map((l, i) => (i === s.current ? { ...l, sets: fn(l.sets) } : l)) }));
  const stepW = (kg: number, dir: 1 | -1) => {
    if (owned.length) return stepOwned(owned, kg, dir) ?? kg;
    const inc = profile.units === "imperial" ? 5 / 2.20462 : 2.5;
    return Math.max(0, kg + dir * inc);
  };
  // Changing a set's weight also updates the sets after it that aren't done yet
  const setWeight = (k: number, kg: number) =>
    editSets((sets) => sets.map((x, j) => (j === k || (j > k && !x.done) ? { ...x, weight: kg } : x)));
  const repStep = ex?.unit === "sec" ? 5 : 1;
  const setReps = (k: number, reps: number) =>
    editSets((sets) => sets.map((x, j) => (j === k ? { ...x, reps: Math.max(0, reps) } : x)));
  const toggleDone = (k: number) =>
    update((s) => {
      const nowDone = !s.logs[s.current].sets[k].done;
      const logs = s.logs.map((l, i) =>
        i === s.current ? { ...l, sets: l.sets.map((x, j) => (j === k ? { ...x, done: nowDone } : x)) } : l);
      const rest = s.day.exercises[s.current]?.rest ?? 0;
      const allDone = s.current === s.logs.length - 1 && logs[s.current].sets.every((x) => x.done);
      if (!nowDone || rest <= 0 || allDone) return { ...s, logs };
      return { ...s, logs, restUntil: Date.now() + rest * 1000, restTotal: rest };
    });
  const addSet = () => editSets((sets) => [...sets, { ...(sets[sets.length - 1] ?? { reps: 10, weight: 0 }), done: false }]);
  const removeSet = () => editSets((sets) => (sets.length > 1 ? sets.slice(0, -1) : sets));
  const go = (i: number) => update((s) => ({ ...s, current: Math.max(0, Math.min(s.logs.length - 1, i)) }));
  const skipExercise = () =>
    update((s) => ({
      ...s,
      logs: s.logs.map((l, i) => (i === s.current ? { ...l, skipped: true } : l)),
      current: Math.min(s.logs.length - 1, s.current + 1),
    }));
  const swapTo = (newId: string) =>
    update((s) => {
      const npx = swapIn(s.day.exercises[s.current], newId, profile);
      return {
        ...s,
        day: { ...s.day, exercises: s.day.exercises.map((x, i) => (i === s.current ? npx : x)) },
        logs: s.logs.map((l, i) => (i === s.current ? logFor(npx, profile, data) : l)),
      };
    });
  const togglePause = () =>
    update((s) => (s.pausedAt ? { ...s, pausedMs: s.pausedMs + (Date.now() - s.pausedAt), pausedAt: null } : { ...s, pausedAt: Date.now() }));
  const finish = () => update((s) => ({ ...s, phase: "summary", seconds: elapsedOf(s, Date.now()), restUntil: null }));

  /* ---------- Saving ---------- */
  const session: Session = {
    id: "new",
    date: dateKey(),
    title: st.day.title,
    seconds: st.seconds || elapsed,
    effort: st.effort,
    exercises: st.logs.map((l) => {
      const sets = l.sets.filter((x) => x.done);
      return { ...l, sets, skipped: l.skipped || sets.length === 0 };
    }),
  };
  const anyDone = session.exercises.some((l) => l.sets.length > 0);
  const close = () => {
    setClosed(true);
    remove(LIVE_KEY);
    nav.toRoot();
  };
  const save = () => {
    const done = { ...session, id: uid() };
    setData((d) => ({ ...d, sessions: [...d.sessions, done] }));
    close();
  };

  /* ---------- Pieces ---------- */
  const top = (
    <div className="sticky top-0 z-20 -mx-4 flex items-center gap-1 border-b border-white/10 bg-[#0a0a0a]/95 px-2 py-2 backdrop-blur">
      <button type="button" aria-label="Close workout" onClick={() => setSheet("leave")} className="rounded-full p-2 text-white/80">
        <Icon name="x" />
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{st.day.title}</p>
        <p className="text-xs tabular-nums text-white/50">{clock(elapsed)}{st.pausedAt ? " · paused" : ""}</p>
      </div>
      <button type="button" aria-label={st.pausedAt ? "Resume" : "Pause"} onClick={togglePause} className="rounded-full p-2 text-white/80">
        <Icon name={st.pausedAt ? "play" : "pause"} />
      </button>
    </div>
  );

  const sheets = (
    <>
      {sheet === "leave" && (
        <Sheet title="Leave this workout?" onClose={() => setSheet("")}>
          <div className="flex flex-col gap-2">
            <Btn onClick={() => setSheet("")}>Keep going</Btn>
            {st.phase !== "summary" && <Btn kind="soft" onClick={() => { setSheet(""); finish(); }}>Finish and save</Btn>}
            <Btn kind="soft" onClick={() => { setSheet(""); nav.back(); }}>Leave and resume later</Btn>
            <Btn kind="danger" onClick={close}>Discard workout</Btn>
          </div>
        </Sheet>
      )}
      {sheet === "info" && ex && (
        <Sheet title={ex.name} onClose={() => setSheet("")}>
          {imagesOf(ex.id).length > 0 && (
            <div className="flex gap-2 overflow-x-auto">
              {imagesOf(ex.id).map((src) => <img key={src} src={src} alt="" className="h-36 w-48 shrink-0 rounded-xl bg-white object-contain" />)}
            </div>
          )}
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-white/80">{ex.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
          {ex.mistakes.length > 0 && (
            <>
              <p className="mt-4 text-sm font-semibold">Common mistakes</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-white/70">{ex.mistakes.map((m) => <li key={m}>{m}</li>)}</ul>
            </>
          )}
          <p className="mt-4 text-sm text-white/70"><b>Safety:</b> {ex.safety}</p>
          <a href={demoUrl(ex)} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm text-neon">
            <Icon name="play" size={14} /> Watch a demo video
          </a>
        </Sheet>
      )}
      {sheet === "swap" && px && ex && (
        <Sheet title={`Swap ${ex.name}`} onClose={() => setSheet("")}>
          <p className="text-xs text-white/50">This only changes today's workout, not your plan.</p>
          <div className="mt-3 space-y-2">
            {alternatives(px.id, profile).slice(0, 12).map((o) => (
              <button key={o.id} type="button" onClick={() => { swapTo(o.id); setSheet(""); }}
                className="block w-full rounded-xl border border-white/10 bg-white/5 p-3 text-left">
                <span className="block font-semibold">{o.name}</span>
                <span className="block text-xs text-white/50">{regionOf(o)}</span>
              </button>
            ))}
          </div>
        </Sheet>
      )}
    </>
  );

  /* ---------- Warm-up ---------- */
  if (st.phase === "warmup") {
    const start = () => update((s) => ({ ...s, phase: "work" }));
    return (
      <div className="pb-10">
        {top}
        <h1 className="mt-6 text-2xl font-bold">Warm up first</h1>
        <p className="text-sm text-white/55">About 5–8 minutes. It helps you move better and stay safe.</p>
        <ol className="mt-4 space-y-3">
          {warmUp(st.day).map((w, i) => (
            <li key={i} className="flex gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-sm">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-neon text-xs font-bold text-black">{i + 1}</span>
              {w}
            </li>
          ))}
        </ol>
        <div className="mt-6 flex gap-2">
          <Btn onClick={start}>I'm warmed up</Btn>
          <Btn kind="soft" onClick={start}>Skip warm-up</Btn>
        </div>
        {sheets}
      </div>
    );
  }

  /* ---------- Summary ---------- */
  if (st.phase === "summary") {
    const prs = newRecords(session, data.sessions, profile);
    const sets = session.exercises.reduce((a, l) => a + l.sets.length, 0);
    const volume = session.exercises.reduce((a, l) => a + l.sets.reduce((b, x) => b + x.weight * x.reps, 0), 0);
    return (
      <div className="pb-10 pt-6">
        <h1 className="text-2xl font-bold">Workout complete 🎉</h1>
        <p className="text-sm text-white/55">{st.day.title}</p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Stat label="Minutes" value={Math.round(st.seconds / 60)} />
          <Stat label="Sets" value={sets} />
          <Stat label="Volume" value={`${Math.round(toUnit(volume, profile))} ${weightUnit(profile)}`} />
        </div>
        {prs.length > 0 && (
          <Card title="New personal records 🏆">
            <ul className="space-y-1 text-sm">{prs.map((r) => <li key={r}>• {r}</li>)}</ul>
          </Card>
        )}
        <p className="mt-6 font-semibold">How did it feel?</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {EFFORTS.map((e) => <Chip key={e} label={e} on={st.effort === e} onClick={() => update((s) => ({ ...s, effort: e }))} />)}
        </div>
        <p className="mt-2 text-xs text-white/50">BYB uses this to choose your next weights.</p>
        <div className="mt-6 flex flex-col gap-2">
          {anyDone ? <Btn onClick={save}>Save workout</Btn> : <Note>No sets were ticked, so there's nothing to save.</Note>}
          <Btn kind="soft" onClick={() => update((s) => ({ ...s, phase: "work" }))}>Back to workout</Btn>
          <Btn kind="danger" onClick={close}>Discard</Btn>
        </div>
        {sheets}
      </div>
    );
  }

  /* ---------- Exercises ---------- */
  return (
    <div className={restLeft > 0 ? "pb-44" : "pb-10"}>
      {top}
      <div className="mt-3 flex gap-1">
        {st.logs.map((l, i) => (
          <button key={i} type="button" aria-label={`Exercise ${i + 1}`} onClick={() => go(i)}
            className={`h-1.5 flex-1 rounded-full ${i === st.current ? "bg-neon" : l.sets.every((x) => x.done) ? "bg-neon/50" : l.skipped ? "bg-white/30" : "bg-white/10"}`} />
        ))}
      </div>

      {ex && px && log ? (
        <>
          <p className="mt-4 text-xs text-white/50">Exercise {st.current + 1} of {st.logs.length}</p>
          <div className="mt-1 flex items-start gap-3">
            {photo && <img src={photo} alt="" className="h-16 w-16 shrink-0 rounded-xl bg-white object-cover" />}
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold leading-tight">{ex.name}</h1>
              <p className="text-xs text-white/50">{ex.muscle} · {regionOf(ex)}</p>
            </div>
            <button type="button" onClick={() => setSheet("info")}
              className="flex shrink-0 items-center gap-1 rounded-full border border-white/15 px-3 py-1.5 text-xs">
              <Icon name="info" size={14} /> How to
            </button>
          </div>

          <div className="mt-3 rounded-2xl bg-white/5 p-3">
            <p className="text-sm font-semibold">
              Target: {px.sets} × {sug?.reps ?? px.reps} {UNIT_LABEL[ex.unit]}
              {loadLine && <span className="text-neon"> · {loadLine}</span>}
            </p>
            {sug?.note && <p className="mt-1 text-xs text-white/55">{sug.note}</p>}
          </div>

          <div className="mt-3 space-y-2">
            {log.sets.map((x, k) => (
              <div key={k} className={`flex items-center gap-2 rounded-2xl border p-2 ${x.done ? "border-neon/40 bg-neon/10" : "border-white/10 bg-white/5"}`}>
                <span className="w-10 shrink-0 text-center text-xs text-white/50">Set {k + 1}</span>
                {kind !== "none" && (
                  <div className="flex flex-1 items-center justify-center gap-1">
                    <button type="button" aria-label="Lighter" onClick={() => setWeight(k, stepW(x.weight, -1))} className="grid h-9 w-9 place-items-center rounded-xl border border-white/15">
                      <Icon name="minus" size={16} />
                    </button>
                    <span className="min-w-16 text-center text-sm font-semibold tabular-nums">{x.weight > 0 ? showWeight(x.weight, profile) : "–"}</span>
                    <button type="button" aria-label="Heavier" onClick={() => setWeight(k, stepW(x.weight, 1))} className="grid h-9 w-9 place-items-center rounded-xl border border-white/15">
                      <Icon name="plus" size={16} />
                    </button>
                  </div>
                )}
                <div className="flex flex-1 items-center justify-center gap-1">
                  <button type="button" aria-label="Fewer" onClick={() => setReps(k, x.reps - repStep)} className="grid h-9 w-9 place-items-center rounded-xl border border-white/15">
                    <Icon name="minus" size={16} />
                  </button>
                  <span className="min-w-12 text-center text-sm font-semibold tabular-nums">{x.reps} {UNIT_LABEL[ex.unit]}</span>
                  <button type="button" aria-label="More" onClick={() => setReps(k, x.reps + repStep)} className="grid h-9 w-9 place-items-center rounded-xl border border-white/15">
                    <Icon name="plus" size={16} />
                  </button>
                </div>
                <button type="button" aria-label={x.done ? "Mark not done" : "Mark done"} onClick={() => toggleDone(k)}
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${x.done ? "bg-neon text-black" : "border border-white/20 text-white/50"}`}>
                  <Icon name="check" size={20} />
                </button>
              </div>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Btn small kind="soft" onClick={addSet}>+ Add set</Btn>
            {log.sets.length > 1 && <Btn small kind="soft" onClick={removeSet}>− Remove set</Btn>}
            <Btn small kind="soft" onClick={() => setSheet("swap")}>Swap</Btn>
            <Btn small kind="soft" onClick={skipExercise}>Skip exercise</Btn>
          </div>

          <div className="mt-6 flex gap-2">
            {st.current > 0 && <Btn kind="soft" onClick={() => go(st.current - 1)}>Previous</Btn>}
            {st.current < st.logs.length - 1 ? (
              <Btn onClick={() => go(st.current + 1)}>Next exercise</Btn>
            ) : (
              <Btn onClick={finish}>Finish workout</Btn>
            )}
          </div>
          {st.current < st.logs.length - 1 && (
            <button type="button" onClick={finish} className="mt-4 text-xs text-white/40 underline">Finish workout early</button>
          )}
        </>
      ) : (
        <Note>This workout has no exercises.</Note>
      )}

      {restLeft > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-neon/30 bg-[#101010] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div className="mx-auto max-w-md">
            <div className="flex items-center justify-between">
              <p className="text-sm text-white/60">Rest</p>
              <p className="text-3xl font-bold tabular-nums">{clock(restLeft)}</p>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full bg-neon transition-all" style={{ width: `${(restLeft / Math.max(1, st.restTotal)) * 100}%` }} />
            </div>
            <div className="mt-3 flex gap-2">
              <Btn small kind="soft" onClick={() => update((s) => ({ ...s, restUntil: (s.restUntil ?? Date.now()) + 15000, restTotal: s.restTotal + 15 }))}>+15 s</Btn>
              <Btn small onClick={() => update((s) => ({ ...s, restUntil: null }))}>Skip rest</Btn>
            </div>
          </div>
        </div>
      )}
      {sheets}
    </div>
  );
}