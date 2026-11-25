import { useEffect, useState, type ReactNode } from "react";
import type { AppData, PageProps, Plan, PlanDay, PlanExercise, Profile, Session, SetData, SetLog } from "./store";
import { WEEK_MON, dateKey, prettyDate, remove, uid, weekdayOf, write } from "./store";
import { LEVEL_NAME, UNIT_LABEL, byId, kindOf } from "./exercises";
import {
  EFFORTS, FOCUSES, QUICK_TARGETS, SPLITS, alternatives, bottomOf, coolDown, dayIndexOf, doneSets, estimateMinutes,
  fromUnit, generatePlan, lastSetsFor, newRecords, nextDayIndex, planChoices, quickWorkout, sessionVolume, showWeight,
  swapIn, toUnit, totalReps, trainingWeekdays, warmUp, weightUnit,
} from "./train";
import { ExerciseSheet } from "./Library";
import { Btn, Card, Chip, Modal, Note, PageTitle, Stat, Stepper, inputBase, inputClass } from "./ui";

/* ==========================================================
   Train page + live workout mode
   ========================================================== */

type TrainProps = PageProps & { start: (day: PlanDay) => void };
const MINUTE_OPTIONS = [15, 20, 30, 45, 60, 90];
const WEIGHTED_KINDS = ["Dumbbell", "Barbell", "Kettlebell", "Machine", "Cable"];
const LIVE_KEY = "byb-live-v1";
const PROTEIN_IDEAS: Record<string, string> = {
  Vegan: "dal, chana, tofu or soya chunks",
  Vegetarian: "dal, paneer, curd or sprouts",
  Jain: "dal, paneer or curd",
  Eggetarian: "eggs, dal, paneer or curd",
  "Non-vegetarian": "chicken, fish, eggs, dal or paneer",
};

type LiveItem = { id: string; target: PlanExercise; sets: SetLog[]; skipped: boolean };
type LiveDraft = {
  day: PlanDay;
  items: LiveItem[];
  idx: number;
  phase: "warmup" | "work" | "summary";
  startedAt: number;
  pausedMs: number;
  pausedAt: number | null;
  restEnd: number | null;
  restLeft: number | null;
  endSeconds: number | null;
  effort: string;
  savedAt: number;
};

// An unfinished workout is kept on the device for 12 hours so it can be resumed.
function readLive(): LiveDraft | null {
  try {
    const raw = localStorage.getItem(LIVE_KEY);
    const d = raw ? (JSON.parse(raw) as LiveDraft) : null;
    return d && Date.now() - d.savedAt < 12 * 3600 * 1000 ? d : null;
  } catch {
    return null;
  }
}

function clock(totalSec: number) {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

function beep() {
  try {
    const ctx = new window.AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.value = 0.15;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
    osc.onended = () => void ctx.close();
  } catch {
    /* sound not available */
  }
}

function makeItem(px: PlanExercise, sessions: Session[]): LiveItem {
  const last = lastSetsFor(px.id, sessions);
  const sets: SetLog[] = Array.from({ length: Math.max(1, px.sets) }, (_, i) => {
    const prev = last[i] ?? last[last.length - 1];
    return { reps: prev ? prev.reps : bottomOf(px.reps), weight: prev ? prev.weight : 0, done: false };
  });
  return { id: px.id, target: px, sets, skipped: false };
}

function SubHead({ children }: { children: ReactNode }) {
  return <p className="mb-1.5 mt-4 text-xs font-semibold uppercase tracking-wider text-neon">{children}</p>;
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] uppercase tracking-wide text-white/45">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function SwapModal({
  currentId,
  profile,
  focus,
  onPick,
  onClose,
}: {
  currentId: string;
  profile: Profile;
  focus: string;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const ex = byId(currentId);
  const options = alternatives(currentId, profile, focus);
  return (
    <Modal title={`Replace ${ex?.name ?? "exercise"}`} onClose={onClose}>
      <p className="mt-2 text-sm text-white/60">
        These train the same movement and fit your equipment and any pain areas you told us about.
      </p>
      {options.length === 0 ? (
        <Note>No alternatives fit your equipment. Browse the exercise library for more ideas.</Note>
      ) : (
        <ul className="mt-3 divide-y divide-white/10">
          {options.map((o) => (
            <li key={o.id}>
              <button type="button" className="w-full py-3 text-left" onClick={() => onPick(o.id)}>
                <p className="font-semibold">{o.name}</p>
                <p className="text-xs text-white/50">
                  {LEVEL_NAME[o.level]} · {kindOf(o)} · {o.muscle}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

/* ---------- Train page ---------- */
export default function Train({ profile, data, setData, start }: TrainProps) {
  const plan = data.plan;
  const choices = plan ? planChoices(plan) : { split: "Auto", focus: "Auto" };
  const [split, setSplit] = useState(choices.split);
  const [focus, setFocus] = useState(choices.focus);
  const [minutes, setMinutes] = useState(plan?.minutes ?? (Number(profile.minutes) || 45));
  const [days, setDays] = useState<string[]>(plan?.weekdays ?? profile.days);
  const [showSettings, setShowSettings] = useState(false);
  const [openDay, setOpenDay] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [swap, setSwap] = useState<{ day: number; ex: number } | null>(null);
  const [infoId, setInfoId] = useState<string | null>(null);
  const [routineName, setRoutineName] = useState("");
  const [quickTarget, setQuickTarget] = useState("Full body");
  const [quickMin, setQuickMin] = useState(30);
  const [quickBw, setQuickBw] = useState(false);
  const [quick, setQuick] = useState<PlanDay | null>(null);
  const [draft] = useState(readLive);

  const nextIdx = plan ? nextDayIndex(plan, data.sessions) : 0;
  const capped = trainingWeekdays({ ...profile, days });

  const rebuild = () =>
    setData((d) => ({ ...d, plan: generatePlan({ ...profile, days }, split, focus, minutes, Date.now()) }));
  const updatePlan = (fn: (p: Plan) => Plan) => setData((d) => (d.plan ? { ...d, plan: fn(d.plan) } : d));
  const editExercise = (di: number, ei: number, patch: Partial<PlanExercise>) =>
    updatePlan((p) => ({
      ...p,
      days: p.days.map((day, i) =>
        i !== di ? day : { ...day, exercises: day.exercises.map((x, j) => (j === ei ? { ...x, ...patch } : x)) },
      ),
    }));
  const removeExercise = (di: number, ei: number) =>
    updatePlan((p) => ({
      ...p,
      days: p.days.map((day, i) => (i !== di ? day : { ...day, exercises: day.exercises.filter((_, j) => j !== ei) })),
    }));
  const replaceExercise = (di: number, ei: number, newId: string) =>
    updatePlan((p) => ({
      ...p,
      days: p.days.map((day, i) =>
        i !== di
          ? day
          : { ...day, exercises: day.exercises.map((x, j) => (j === ei ? swapIn(x, newId, profile, choices.focus) : x)) },
      ),
    }));

  const saveRoutine = () => {
    const name = routineName.trim();
    if (!name || !plan) return;
    setData((d) => ({ ...d, routines: [...d.routines, { name, plan: d.plan ?? plan }] }));
    setRoutineName("");
  };

  const saveQuick = () => {
    if (!quick) return;
    const routinePlan: Plan = {
      choice: "Auto|Auto",
      split: "Custom workout",
      minutes: quickMin,
      weekdays: plan?.weekdays ?? trainingWeekdays(profile),
      days: [quick],
      why: ["Saved from a quick workout."],
      seed: Date.now(),
    };
    setData((d) => ({ ...d, routines: [...d.routines, { name: quick.title, plan: routinePlan }] }));
  };

  return (
    <div className="pb-6">
      <PageTitle title="Train" sub="Your plan, quick workouts and saved routines." />

      {draft && (
        <Card title="Unfinished workout">
          <p className="text-sm">
            You have an unfinished <b>{draft.day.title}</b> from earlier.
          </p>
          <div className="mt-3">
            <Btn onClick={() => start(draft.day)}>Resume workout</Btn>
          </div>
        </Card>
      )}

      {!plan ? (
        <Card title="Your plan">
          <p className="text-sm text-white/70">BYB will build a plan from your profile: your goals, level, equipment, days and time.</p>
          <div className="mt-3">
            <Btn onClick={rebuild}>Create my plan</Btn>
          </div>
        </Card>
      ) : (
        <>
          <Card
            title="Your plan"
            right={
              <Btn small kind="soft" onClick={() => setShowSettings(!showSettings)}>
                {showSettings ? "Close" : "Customise"}
              </Btn>
            }
          >
            <p className="text-lg font-bold">{plan.split}</p>
            <p className="text-sm text-white/60">
              {plan.days.length} workout{plan.days.length === 1 ? "" : "s"} a week · {plan.weekdays.join(", ")} · about {plan.minutes} min
            </p>
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-semibold text-neon">Why this plan?</summary>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-white/70">
                {plan.why.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </details>

            {showSettings && (
              <div className="mt-4 space-y-4 border-t border-white/10 pt-4">
                <Group label="Split">
                  {SPLITS.map((s) => (
                    <Chip key={s} label={s} on={split === s} onClick={() => setSplit(s)} />
                  ))}
                </Group>
                <Group label="Focus">
                  {FOCUSES.map((f) => (
                    <Chip key={f} label={f} on={focus === f} onClick={() => setFocus(f)} />
                  ))}
                </Group>
                <Group label="Minutes per workout">
                  {MINUTE_OPTIONS.map((m) => (
                    <Chip key={m} label={`${m}`} on={minutes === m} onClick={() => setMinutes(m)} />
                  ))}
                </Group>
                <Group label="Training days">
                  {WEEK_MON.map((d) => (
                    <Chip
                      key={d}
                      label={d}
                      on={days.includes(d)}
                      onClick={() => setDays(days.includes(d) ? days.filter((x) => x !== d) : [...days, d])}
                    />
                  ))}
                </Group>
                {capped.length < days.length && (
                  <Note>
                    For your level, BYB plans up to {capped.length} training days: {capped.join(", ")}. The other days are for rest or light activity.
                  </Note>
                )}
                <div className="flex flex-wrap gap-2">
                  <Btn
                    disabled={!days.length}
                    onClick={() => {
                      rebuild();
                      setShowSettings(false);
                      setOpenDay(null);
                    }}
                  >
                    Apply and rebuild plan
                  </Btn>
                  <Btn kind="soft" disabled={!days.length} onClick={rebuild}>
                    ↻ Shuffle exercises
                  </Btn>
                </div>
                <p className="text-xs text-white/45">
                  Rebuilding replaces your current plan and any edits. Save it as a routine first if you want to keep it.
                </p>
              </div>
            )}
          </Card>

          {plan.days.map((day, di) => (
            <Card
              key={day.title}
              title={`Workout ${di + 1}`}
              right={
                di === nextIdx ? (
                  <span className="rounded-full bg-neon px-2 py-0.5 text-[10px] font-bold text-black">NEXT UP</span>
                ) : undefined
              }
            >
              <button type="button" className="w-full text-left" onClick={() => setOpenDay(openDay === di ? null : di)}>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-lg font-bold">{day.title}</p>
                    <p className="text-xs text-white/55">
                      {day.focus} · {day.exercises.length} exercises · about {estimateMinutes(day)} min
                    </p>
                  </div>
                  <span className="text-white/50" aria-hidden="true">
                    {openDay === di ? "▲" : "▼"}
                  </span>
                </div>
              </button>

              {openDay === di && (
                <div className="mt-2">
                  <SubHead>Warm-up</SubHead>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-white/70">
                    {warmUp(day).map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>

                  <SubHead>Exercises</SubHead>
                  <ul className="divide-y divide-white/10">
                    {day.exercises.map((x, ei) => {
                      const ex = byId(x.id);
                      return (
                        <li key={`${x.id}-${ei}`} className="py-3">
                          <div className="flex items-start justify-between gap-2">
                            <button type="button" className="text-left" onClick={() => setInfoId(x.id)}>
                              <p className="font-semibold">{ex?.name ?? x.id}</p>
                              <p className="text-xs text-white/50">
                                {ex?.muscle} · {x.sets} × {x.reps} {ex ? UNIT_LABEL[ex.unit] : ""}
                                {x.rest > 0 ? ` · rest ${x.rest}s` : ""}
                              </p>
                              <p className="text-[11px] text-white/35">Tap for how-to, demo video and alternatives</p>
                            </button>
                            <Btn small kind="soft" onClick={() => setSwap({ day: di, ex: ei })}>
                              ⇄ Swap
                            </Btn>
                          </div>
                          {editing && (
                            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-white/60">
                              <span className="flex items-center gap-1">
                                Sets
                                <Stepper value={x.sets} min={1} onChange={(v) => editExercise(di, ei, { sets: Math.min(8, Math.round(v)) })} />
                              </span>
                              <label className="flex items-center gap-1">
                                Reps
                                <input
                                  className={`${inputBase} w-20 py-1 text-xs`}
                                  value={x.reps}
                                  maxLength={9}
                                  onChange={(e) => editExercise(di, ei, { reps: e.target.value })}
                                />
                              </label>
                              <span className="flex items-center gap-1">
                                Rest
                                <Stepper value={x.rest} step={15} min={0} suffix="s" onChange={(v) => editExercise(di, ei, { rest: Math.min(300, v) })} />
                              </span>
                              {day.exercises.length > 1 && (
                                <Btn small kind="danger" onClick={() => removeExercise(di, ei)}>
                                  Remove
                                </Btn>
                              )}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>

                  <SubHead>Cool-down</SubHead>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-white/70">
                    {coolDown(day).map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Btn onClick={() => start(day)} disabled={!day.exercises.length}>
                      ▶ Start this workout
                    </Btn>
                    <Btn kind="soft" onClick={() => setEditing(!editing)}>
                      {editing ? "Done editing" : "✎ Edit sets and reps"}
                    </Btn>
                  </div>
                </div>
              )}
            </Card>
          ))}

          <Card title="Save this plan as a routine">
            <div className="flex gap-2">
              <input
                className={inputClass}
                placeholder="Routine name, e.g. Summer plan"
                value={routineName}
                maxLength={40}
                onChange={(e) => setRoutineName(e.target.value)}
              />
              <Btn disabled={!routineName.trim()} onClick={saveRoutine}>
                Save
              </Btn>
            </div>
          </Card>
        </>
      )}

      {/* Quick workout */}
      <Card title="Generate a quick workout">
        <p className="text-sm text-white/60">Short on time, or want something different today?</p>
        <div className="mt-3 space-y-3">
          <Group label="Focus">
            {QUICK_TARGETS.map((t) => (
              <Chip key={t} label={t} on={quickTarget === t} onClick={() => setQuickTarget(t)} />
            ))}
          </Group>
          <Group label="Minutes">
            {MINUTE_OPTIONS.map((m) => (
              <Chip key={m} label={`${m}`} on={quickMin === m} onClick={() => setQuickMin(m)} />
            ))}
          </Group>
          <Chip label="Bodyweight only" on={quickBw} onClick={() => setQuickBw(!quickBw)} />
        </div>
        <div className="mt-4">
          <Btn onClick={() => setQuick(quickWorkout(profile, quickTarget, quickMin, quickBw))}>✨ Generate workout</Btn>
        </div>
        {quick && (
          <div className="mt-4 rounded-xl border border-white/10 p-3">
            <p className="font-bold">{quick.title}</p>
            {quick.exercises.length === 0 ? (
              <Note>No suitable exercises for this with your equipment and health answers. Try another focus.</Note>
            ) : (
              <>
                <p className="text-xs text-white/50">About {estimateMinutes(quick)} min including warm-up</p>
                <ul className="mt-2 space-y-1 text-sm text-white/80">
                  {quick.exercises.map((x, i) => {
                    const ex = byId(x.id);
                    return (
                      <li key={`${x.id}-${i}`}>
                        • {ex?.name}{" "}
                        <span className="text-white/45">
                          {x.sets} × {x.reps} {ex ? UNIT_LABEL[ex.unit] : ""}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Btn onClick={() => start(quick)}>▶ Start</Btn>
                  <Btn kind="soft" onClick={() => setQuick(quickWorkout(profile, quickTarget, quickMin, quickBw))}>
                    ↻ Another one
                  </Btn>
                  <Btn kind="soft" onClick={saveQuick}>
                    Save as routine
                  </Btn>
                </div>
              </>
            )}
          </div>
        )}
      </Card>

      {/* Saved routines */}
      {data.routines.length > 0 && (
        <Card title="Saved routines">
          <ul className="divide-y divide-white/10">
            {data.routines.map((r, i) => (
              <li key={`${r.name}-${i}`} className="py-3">
                <p className="font-semibold">{r.name}</p>
                <p className="text-xs text-white/50">
                  {r.plan.split} · {r.plan.days.length} workout{r.plan.days.length === 1 ? "" : "s"}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Btn small onClick={() => setData((d) => ({ ...d, plan: { ...r.plan, seed: Date.now() } }))}>
                    Use as my plan
                  </Btn>
                  {r.plan.days.length === 1 && (
                    <Btn small kind="soft" onClick={() => start(r.plan.days[0])}>
                      ▶ Start
                    </Btn>
                  )}
                  <Btn small kind="danger" onClick={() => setData((d) => ({ ...d, routines: d.routines.filter((_, j) => j !== i) }))}>
                    Delete
                  </Btn>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Recent workouts */}
      <Card title="Recent workouts">
        {data.sessions.length === 0 ? (
          <p className="text-sm text-white/45">No workouts yet. Finished workouts appear here.</p>
        ) : (
          <ul className="divide-y divide-white/10">
            {[...data.sessions]
              .slice(-5)
              .reverse()
              .map((s) => (
                <li key={s.id} className="flex justify-between gap-3 py-2 text-sm">
                  <span>
                    <b>{s.title}</b>
                    <span className="block text-xs text-white/45">
                      {weekdayOf(s.date)} {prettyDate(s.date)} · felt {s.effort.toLowerCase()}
                    </span>
                  </span>
                  <span className="text-right text-xs text-white/60">
                    {Math.round(s.seconds / 60)} min
                    <br />
                    {doneSets(s)} sets
                  </span>
                </li>
              ))}
          </ul>
        )}
      </Card>

      {swap && plan && plan.days[swap.day]?.exercises[swap.ex] && (
        <SwapModal
          currentId={plan.days[swap.day].exercises[swap.ex].id}
          profile={profile}
          focus={choices.focus}
          onPick={(id) => {
            replaceExercise(swap.day, swap.ex, id);
            setSwap(null);
          }}
          onClose={() => setSwap(null)}
        />
      )}
      {infoId && <ExerciseSheet id={infoId} profile={profile} data={data} setData={setData} onClose={() => setInfoId(null)} />}
    </div>
  );
}

/* ---------- Live workout mode ---------- */
export function LiveWorkout({
  day,
  profile,
  data,
  setData,
  onExit,
}: {
  day: PlanDay;
  profile: Profile;
  data: AppData;
  setData: SetData;
  onExit: () => void;
}) {
  const [state, setState] = useState<LiveDraft>(() => {
    const saved = readLive();
    if (saved && saved.day.title === day.title) return saved;
    const t = Date.now();
    return {
      day, items: day.exercises.map((px) => makeItem(px, data.sessions)), idx: 0, phase: "warmup",
      startedAt: t, pausedMs: 0, pausedAt: null, restEnd: null, restLeft: null, endSeconds: null, effort: "Just right", savedAt: t,
    };
  });
  const [now, setNow] = useState(() => Date.now());
  const [leaving, setLeaving] = useState(false);
  const [swapOpen, setSwapOpen] = useState(false);
  const [infoId, setInfoId] = useState<string | null>(null);

  // Clock tick
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(t);
  }, []);

  // Keep progress on the device in case the app closes
  useEffect(() => {
    write(LIVE_KEY, { ...state, savedAt: Date.now() });
  }, [state]);

  // Beep and vibrate when rest ends
  const restDone = state.restEnd !== null && now >= state.restEnd;
  useEffect(() => {
    if (!restDone) return;
    beep();
    try {
      navigator.vibrate?.(400);
    } catch {
      /* vibration not supported */
    }
  }, [restDone]);

  const focusChoice = data.plan ? planChoices(data.plan).focus : "Auto";
  const elapsed =
    state.endSeconds ??
    Math.max(0, Math.floor((now - state.startedAt - state.pausedMs - (state.pausedAt ? now - state.pausedAt : 0)) / 1000));
  const restLeft = state.restEnd ? Math.max(0, Math.ceil((state.restEnd - now) / 1000)) : (state.restLeft ?? 0);
  const resting = state.restEnd !== null;
  const item = state.items[state.idx] as LiveItem | undefined;
  const ex = item ? byId(item.id) : undefined;
  const totalSets = state.items.reduce((a, it) => a + it.sets.length, 0);
  const setsDone = state.items.reduce((a, it) => a + it.sets.filter((x) => x.done).length, 0);

  /* Actions */
  const patchItem = (fn: (it: LiveItem) => LiveItem) =>
    setState((s) => ({ ...s, items: s.items.map((it, i) => (i === s.idx ? fn(it) : it)) }));
  const updateSet = (si: number, patch: Partial<SetLog>) =>
    patchItem((it) => ({ ...it, sets: it.sets.map((x, j) => (j === si ? { ...x, ...patch } : x)) }));

  const toggleDone = (si: number) => {
    if (!item) return;
    const nowDone = !item.sets[si].done;
    patchItem((it) => ({ ...it, skipped: false, sets: it.sets.map((x, j) => (j === si ? { ...x, done: nowDone } : x)) }));
    const finishedAll = state.idx === state.items.length - 1 && item.sets.every((x, j) => j === si || x.done);
    if (nowDone && item.target.rest > 0 && !finishedAll) {
      const rest = item.target.rest;
      setState((s) => ({ ...s, restEnd: Date.now() + rest * 1000, restLeft: null }));
    }
  };
  const addSet = () =>
    patchItem((it) => ({ ...it, sets: [...it.sets, { ...(it.sets[it.sets.length - 1] ?? { reps: 10, weight: 0 }), done: false }] }));
  const goTo = (i: number) => setState((s) => ({ ...s, idx: Math.max(0, Math.min(s.items.length - 1, i)) }));
  const skip = () =>
    setState((s) => ({
      ...s,
      items: s.items.map((it, i) => (i === s.idx ? { ...it, skipped: true } : it)),
      idx: Math.min(s.items.length - 1, s.idx + 1),
    }));
  const pause = () =>
    setState((s) =>
      s.pausedAt
        ? s
        : { ...s, pausedAt: Date.now(), restLeft: s.restEnd ? Math.max(0, Math.ceil((s.restEnd - Date.now()) / 1000)) : null, restEnd: null },
    );
  const resume = () =>
    setState((s) =>
      !s.pausedAt
        ? s
        : { ...s, pausedMs: s.pausedMs + (Date.now() - s.pausedAt), pausedAt: null, restEnd: s.restLeft ? Date.now() + s.restLeft * 1000 : null, restLeft: null },
    );
  const adjustRest = (sec: number) => setState((s) => (s.restEnd ? { ...s, restEnd: Math.max(Date.now(), s.restEnd + sec * 1000) } : s));
  const clearRest = () => setState((s) => ({ ...s, restEnd: null, restLeft: null }));
  const finish = () =>
    setState((s) => ({ ...s, phase: "summary", restEnd: null, restLeft: null, pausedAt: null, endSeconds: elapsed }));
  const replace = (newId: string) => {
    patchItem((it) => makeItem(swapIn(it.target, newId, profile, focusChoice), data.sessions));
    setSwapOpen(false);
  };

  /* Summary data */
  const session: Session = {
    id: "",
    date: dateKey(),
    title: day.title,
    seconds: elapsed,
    effort: state.effort,
    exercises: state.items.map((it) => ({ id: it.id, sets: it.sets, skipped: it.skipped })),
  };
  const save = () => {
    const final: Session = { ...session, id: uid() };
    setData((d) => ({ ...d, sessions: [...d.sessions, final].sort((a, b) => a.date.localeCompare(b.date)) }));
    remove(LIVE_KEY);
    onExit();
  };
  const discard = () => {
    remove(LIVE_KEY);
    onExit();
  };

  const summary = state.phase === "summary";
  const prs = summary ? newRecords(session, data.sessions, profile) : [];
  const prev = [...data.sessions].reverse().find((s) => s.title === day.title);
  const completed = state.items.filter((it) => it.sets.some((x) => x.done)).length;
  const volume = sessionVolume(session);
  const prevVolume = prev ? sessionVolume(prev) : 0;
  const lifted = (kg: number) => `${Math.round(toUnit(kg, profile)).toLocaleString()} ${weightUnit(profile)} lifted`;
  const perf = !prev
    ? "This is your first time doing this workout, so today sets your baseline."
    : `Last time: ${doneSets(prev)} sets${prevVolume ? `, ${lifted(prevVolume)}` : ""}. Today: ${doneSets(session)} sets${volume ? `, ${lifted(volume)}` : ""}.`;
  const plan = data.plan;
  const pIdx = plan ? dayIndexOf(plan, day.title) : -1;
  const nextTitle =
    plan && plan.days.length ? plan.days[pIdx >= 0 ? (pIdx + 1) % plan.days.length : nextDayIndex(plan, data.sessions)].title : "";
  const nextSteps = [
    nextTitle ? `Next workout: ${nextTitle}.` : "",
    coolDown(day)[1],
    `Eat a meal with protein in the next couple of hours, such as ${PROTEIN_IDEAS[profile.diet] ?? "dal, paneer, eggs or chicken"}.`,
    "Drink water and aim for 7–9 hours of sleep tonight.",
    state.effort === "Too hard" ? "Next time, use lighter weights or 1 fewer set. BYB will remind you." : "",
    state.effort === "Easy" ? "If this feels easy twice in a row, BYB will suggest when to progress." : "",
    state.items.some((it) => it.skipped) ? "You skipped an exercise. If equipment was the problem, use Swap on the Train page." : "",
  ].filter((s) => s !== "");

  const lastSets = item ? lastSetsFor(item.id, data.sessions) : [];
  const lastMax = lastSets.reduce((m, x) => Math.max(m, x.weight), 0);
  const usesWeight = !!ex && (WEIGHTED_KINDS.includes(kindOf(ex)) || (item?.sets.some((x) => x.weight > 0) ?? false));

  return (
    <main className="min-h-screen bg-[#0d0d0d] text-white">
      <div className="mx-auto max-w-md px-4 pb-56 pt-4">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-2">
          <button type="button" onClick={() => setLeaving(true)} className="rounded-lg px-2 py-1 text-lg text-white/60" aria-label="Leave workout">
            ✕
          </button>
          <div className="text-center">
            <p className="text-xs text-white/50">{day.title}</p>
            <p className="font-mono text-2xl font-bold">{clock(elapsed)}</p>
          </div>
          {!summary ? (
            <Btn small kind="soft" onClick={state.pausedAt ? resume : pause}>
              {state.pausedAt ? "▶ Resume" : "❚❚ Pause"}
            </Btn>
          ) : (
            <span className="w-16" />
          )}
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-neon transition-all" style={{ width: `${totalSets ? (setsDone / totalSets) * 100 : 0}%` }} />
        </div>

        {/* Warm-up */}
        {state.phase === "warmup" && (
          <>
            <Card title="Warm-up first">
              <ul className="list-disc space-y-1.5 pl-5 text-sm text-white/80">
                {warmUp(day).map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
              <div className="mt-4 flex flex-wrap gap-2">
                <Btn onClick={() => setState((s) => ({ ...s, phase: "work" }))}>I'm warmed up</Btn>
                <Btn kind="soft" onClick={() => setState((s) => ({ ...s, phase: "work" }))}>
                  Skip warm-up
                </Btn>
              </div>
            </Card>
            <Card title="Today's exercises">
              <ul className="space-y-1 text-sm text-white/75">
                {state.items.map((it, i) => (
                  <li key={`${it.id}-${i}`}>
                    {i + 1}. {byId(it.id)?.name} · {it.target.sets} × {it.target.reps}
                  </li>
                ))}
              </ul>
            </Card>
          </>
        )}

        {/* Working sets */}
        {state.phase === "work" &&
          (item && ex ? (
            <>
              <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1">
                {state.items.map((it, i) => {
                  const allDone = it.sets.length > 0 && it.sets.every((x) => x.done);
                  return (
                    <button
                      key={`${it.id}-${i}`}
                      type="button"
                      onClick={() => goTo(i)}
                      className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                        i === state.idx
                          ? "border-neon text-neon"
                          : allDone
                            ? "border-neon/40 bg-neon/10 text-white/80"
                            : it.skipped
                              ? "border-white/10 text-white/30 line-through"
                              : "border-white/15 text-white/70"
                      }`}
                    >
                      {allDone ? "✓ " : ""}
                      {byId(it.id)?.name ?? it.id}
                    </button>
                  );
                })}
              </div>

              <Card title={`Exercise ${state.idx + 1} of ${state.items.length}`}>
                <p className="text-2xl font-bold">{ex.name}</p>
                <p className="text-sm text-white/55">
                  {ex.muscle} · target {item.target.sets} × {item.target.reps} {UNIT_LABEL[ex.unit]}
                  {item.target.rest > 0 ? ` · rest ${item.target.rest}s` : ""}
                </p>
                {lastSets.length > 0 && (
                  <p className="mt-1 text-xs text-white/45">
                    Last time: {lastSets.map((x) => x.reps).join(", ")} {UNIT_LABEL[ex.unit]}
                    {lastMax > 0 ? ` · up to ${showWeight(lastMax, profile)}` : ""}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Btn small kind="soft" onClick={() => setInfoId(item.id)}>
                    ⓘ How to
                  </Btn>
                  <Btn small kind="soft" onClick={() => setSwapOpen(true)}>
                    ⇄ Replace
                  </Btn>
                  <Btn small kind="soft" onClick={skip}>
                    ⏭ Skip
                  </Btn>
                </div>
                {item.skipped && <Note>You skipped this exercise. Tick a set to bring it back.</Note>}

                <div className="mt-4 space-y-2">
                  {item.sets.map((st, si) => (
                    <div
                      key={si}
                      className={`flex flex-wrap items-center gap-3 rounded-xl border p-3 ${st.done ? "border-neon/60 bg-neon/10" : "border-white/10"}`}
                    >
                      <span className="w-10 text-xs text-white/50">Set {si + 1}</span>
                      <div className="flex flex-col">
                        <span className="text-[10px] text-white/40">{UNIT_LABEL[ex.unit]}</span>
                        <Stepper value={st.reps} min={0} step={ex.unit === "sec" ? 5 : 1} onChange={(v) => updateSet(si, { reps: Math.round(v) })} />
                      </div>
                      {usesWeight && (
                        <div className="flex flex-col">
                          <span className="text-[10px] text-white/40">{weightUnit(profile)}</span>
                          <Stepper
                            value={toUnit(st.weight, profile)}
                            min={0}
                            step={profile.units === "imperial" ? 5 : 2.5}
                            onChange={(v) => updateSet(si, { weight: Math.round(fromUnit(v, profile) * 100) / 100 })}
                          />
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => toggleDone(si)}
                        aria-label={st.done ? `Undo set ${si + 1}` : `Complete set ${si + 1}`}
                        className={`ml-auto h-11 w-11 rounded-full border text-lg ${st.done ? "border-neon bg-neon text-black" : "border-white/30"}`}
                      >
                        ✓
                      </button>
                    </div>
                  ))}
                </div>
                <div className="mt-3">
                  <Btn small kind="soft" onClick={addSet}>
                    + Add set
                  </Btn>
                </div>
                {!usesWeight && ex.unit === "reps" && (
                  <p className="mt-3 text-[11px] text-white/40">Bodyweight exercise. Log your reps; add weight only if you hold some.</p>
                )}
              </Card>
            </>
          ) : (
            <Note>This workout has no exercises.</Note>
          ))}

        {/* Summary */}
        {summary && (
          <div>
            <h1 className="mt-6 text-3xl font-bold">Workout complete 🎉</h1>
            <p className="text-white/60">{day.title}</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Stat label="Duration" value={clock(elapsed)} />
              <Stat label="Exercises" value={`${completed} / ${state.items.length}`} />
              <Stat label="Sets" value={doneSets(session)} />
              <Stat label="Reps" value={totalReps(session)} />
            </div>
            <Card title="Performance">
              <p className="text-sm text-white/75">{perf}</p>
            </Card>
            {prs.length > 0 && (
              <Card title="New personal records 🏆">
                <ul className="space-y-1 text-sm">
                  {prs.map((r) => (
                    <li key={r}>🏅 {r}</li>
                  ))}
                </ul>
              </Card>
            )}
            <Card title="How hard was it?">
              <div className="flex flex-wrap gap-2">
                {EFFORTS.map((e) => (
                  <Chip key={e} label={e} on={state.effort === e} onClick={() => setState((s) => ({ ...s, effort: e }))} />
                ))}
              </div>
              <p className="mt-2 text-xs text-white/45">This helps BYB adjust your next workouts safely.</p>
            </Card>
            <Card title="Suggested next steps">
              <ul className="list-disc space-y-1.5 pl-5 text-sm text-white/75">
                {nextSteps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </Card>
            {doneSets(session) === 0 && <Note tone="warn">Complete at least one set to save this workout.</Note>}
            <div className="mt-4 flex flex-wrap gap-2">
              <Btn disabled={doneSets(session) === 0} onClick={save}>
                Save workout
              </Btn>
              <Btn kind="soft" onClick={() => setState((s) => ({ ...s, phase: "work", endSeconds: null }))}>
                Back to workout
              </Btn>
              <Btn kind="danger" onClick={discard}>
                Discard
              </Btn>
            </div>
          </div>
        )}
      </div>

      {/* Bottom bar: rest timer and navigation */}
      {state.phase === "work" && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[#0d0d0d] px-4 pb-6 pt-3">
          <div className="mx-auto max-w-md">
            {(resting || restDone) && (
              <div className={`mb-3 rounded-2xl border p-3 text-center ${restDone ? "border-neon bg-neon/15" : "border-white/15 bg-white/5"}`}>
                <p className="text-xs uppercase tracking-wide text-white/50">{restDone ? "Rest over" : "Rest"}</p>
                <p className="font-mono text-4xl font-bold">{restDone ? "Go!" : clock(restLeft)}</p>
                <div className="mt-2 flex justify-center gap-2">
                  {!restDone && (
                    <>
                      <Btn small kind="soft" onClick={() => adjustRest(-15)}>
                        −15s
                      </Btn>
                      <Btn small kind="soft" onClick={() => adjustRest(15)}>
                        +15s
                      </Btn>
                    </>
                  )}
                  <Btn small onClick={clearRest}>
                    {restDone ? "OK" : "Skip rest"}
                  </Btn>
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <div className="flex-1 [&>button]:w-full">
                <Btn kind="soft" disabled={state.idx === 0} onClick={() => goTo(state.idx - 1)}>
                  ← Back
                </Btn>
              </div>
              <div className="flex-1 [&>button]:w-full">
                {state.idx < state.items.length - 1 ? (
                  <Btn onClick={() => goTo(state.idx + 1)}>Next →</Btn>
                ) : (
                  <Btn onClick={finish}>Finish workout</Btn>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pause screen */}
      {state.pausedAt !== null && !summary && (
        <div className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-black/90">
          <p className="text-3xl font-bold">Paused</p>
          <p className="font-mono text-white/60">{clock(elapsed)}</p>
          <Btn onClick={resume}>▶ Resume</Btn>
        </div>
      )}

      {leaving && (
        <Modal title="Leave this workout?" onClose={() => setLeaving(false)}>
          <p className="mt-2 text-sm text-white/65">
            Your progress is kept on this device, so you can also resume it later from the Train page.
          </p>
          <div className="mt-4 flex flex-col gap-2">
            <Btn
              onClick={() => {
                setLeaving(false);
                finish();
              }}
            >
              Finish and review
            </Btn>
            <Btn kind="soft" onClick={onExit}>
              Leave for now (resume later)
            </Btn>
            <Btn kind="danger" onClick={discard}>
              Discard this workout
            </Btn>
          </div>
        </Modal>
      )}
      {swapOpen && item && (
        <SwapModal currentId={item.id} profile={profile} focus={focusChoice} onPick={replace} onClose={() => setSwapOpen(false)} />
      )}
      {infoId && <ExerciseSheet id={infoId} profile={profile} data={data} setData={setData} onClose={() => setInfoId(null)} />}
    </main>
  );
}