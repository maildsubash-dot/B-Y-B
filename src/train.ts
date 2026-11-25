import type { AppData, Plan, PlanDay, PlanExercise, Profile, Session } from "./store";
import { WEEK_MON, addDays, dateKey, weekdayOf } from "./store";
import { ALL_EQUIP, EXERCISES, byId, type Equip, type Exercise, type Pattern } from "./exercises";

/* ==========================================================
   BYB training engine: plan generator, swaps, records and the
   adaptive coach. Every rule is fixed, safe and explainable.
   ========================================================== */

/* ---------- Profile helpers ---------- */
export const LEVEL_RANK: Record<string, number> = {
  "Absolute beginner": 0, Beginner: 1, Intermediate: 2, Advanced: 3, "Professional athlete": 4,
};
export const rankOf = (level: string) => (level in LEVEL_RANK ? LEVEL_RANK[level] : 0);
export const hasHealthFlag = (p: Profile) => p.health.some((h) => h !== "None of these");

const LB = 2.20462;
const round = (n: number, dp = 1) => Math.round(n * 10 ** dp) / 10 ** dp;

export function profileWeightKg(p: Profile) {
  const w = Number(p.weight) || 0;
  return p.units === "imperial" ? w / LB : w;
}
export function heightCm(p: Profile) {
  if (p.units === "metric") return Number(p.heightCm) || 0;
  return ((Number(p.heightFt) || 0) * 12 + (Number(p.heightIn) || 0)) * 2.54;
}
export function latestWeightKg(p: Profile, data: AppData) {
  const list = [...data.weights].sort((a, b) => a.date.localeCompare(b.date));
  return list.length ? list[list.length - 1].kg : profileWeightKg(p);
}
export const weightUnit = (p: Profile) => (p.units === "imperial" ? "lb" : "kg");
export const toUnit = (kg: number, p: Profile) => round(p.units === "imperial" ? kg * LB : kg, 1);
export const fromUnit = (value: number, p: Profile) => (p.units === "imperial" ? value / LB : value);
export const showWeight = (kg: number, p: Profile) => `${toUnit(kg, p)} ${weightUnit(p)}`;

export const EFFORTS = ["Easy", "Just right", "Hard", "Too hard"];
export const FEELINGS = ["Great", "OK", "Tired", "Sore", "Unwell"];
export const SPLITS = ["Auto", "Full body", "Upper / lower", "Push / pull / legs", "Bro split"];
export const FOCUSES = ["Auto", "Strength", "Hypertrophy", "Fat loss", "Endurance", "Beginner-friendly", "Bodyweight"];

const MAX_DAYS = [3, 4, 5, 6, 6]; // most training days per week, by level
const MAX_SETS = [12, 16, 20, 24, 26]; // most sets per session, by level
const CARDIO_GOALS = ["Lose weight", "Reduce body fat", "Improve endurance", "Improve cardiovascular fitness", "Improve general health"];
const LOWER: Pattern[] = ["squat", "hinge", "lunge", "glute", "calves", "quadIso", "hamIso"];
const UPPER_BW: Pattern[] = ["hpush", "vpush", "triceps", "vpull"];

/* ---------- Equipment and safety ---------- */
const EQUIP_MAP: Record<string, Equip[]> = {
  Dumbbells: ["dumbbell"], "Resistance bands": ["band"], "Pull-up bar": ["pullup"], Bench: ["bench"],
  "Barbell and plates": ["barbell"], "Squat rack": ["rack"], Kettlebell: ["kettlebell"], "Skipping rope": ["rope"],
  "Treadmill or exercise bike": ["cardio"], "Park bars or dip bars": ["bars", "pullup"], "Stairs or steps": ["stairs"],
};

export function availableEquip(p: Profile, focusChoice = "Auto"): Set<Equip> {
  if (focusChoice === "Bodyweight" || p.place === "Bodyweight only") return new Set();
  if (p.place === "Gym") return new Set(ALL_EQUIP);
  const set = new Set<Equip>();
  p.equipment.forEach((item) => (EQUIP_MAP[item] ?? []).forEach((e) => set.add(e)));
  return set;
}
export const canDo = (ex: Exercise, equip: Set<Equip>) => ex.equipment.every((e) => equip.has(e));
export const isSafeFor = (ex: Exercise, p: Profile) => !ex.avoid.some((a) => p.painAreas.includes(a));

function maxLevelFor(p: Profile) {
  const r = rankOf(p.level);
  const level = r === 0 ? 1 : r === 1 ? 2 : 3;
  return hasHealthFlag(p) ? Math.min(level, 2) : level;
}

export function resolveFocus(p: Profile, choice: string) {
  if (choice !== "Auto" && choice !== "Bodyweight") return choice;
  if (rankOf(p.level) === 0) return "Beginner-friendly";
  const g = p.goals[0] ?? "";
  if (g === "Improve strength") return "Strength";
  if (g === "Build muscle" || g === "Gain healthy weight") return "Hypertrophy";
  if (g === "Lose weight" || g === "Reduce body fat") return "Fat loss";
  if (g === "Improve endurance" || g === "Improve cardiovascular fitness") return "Endurance";
  return "General";
}

/* ---------- Training days ---------- */
export function trainingWeekdays(p: Profile): string[] {
  const picked = WEEK_MON.filter((d) => p.days.includes(d));
  if (!picked.length) return ["Mon", "Wed", "Fri"];
  const rank = rankOf(p.level);
  const max = hasHealthFlag(p) ? Math.min(MAX_DAYS[rank], 3) : MAX_DAYS[rank];
  if (picked.length <= max) return picked;
  return Array.from({ length: max }, (_, i) => picked[Math.floor((i * picked.length) / max)]);
}

/* ---------- Day templates ---------- */
type Template = { title: string; focus: string; slots: Pattern[] };
const tpl = (title: string, focus: string, slots: Pattern[]): Template => ({ title, focus, slots });

const FULL_A = tpl("Full body A", "Legs, chest, back and core", ["squat", "hpush", "hpull", "hinge", "core", "shoulderIso", "biceps", "calves"]);
const FULL_B = tpl("Full body B", "Hips, shoulders, back and core", ["hinge", "vpush", "vpull", "lunge", "core", "triceps", "glute", "rearDelt"]);
const FULL_C = tpl("Full body C", "Legs, chest, back and arms", ["lunge", "hpush", "hpull", "glute", "core", "biceps", "triceps", "calves"]);
const UPPER_A = tpl("Upper A", "Chest, back, shoulders and arms", ["hpush", "hpull", "vpush", "vpull", "biceps", "triceps", "shoulderIso", "rearDelt"]);
const UPPER_B = tpl("Upper B", "Shoulders, back, chest and arms", ["vpush", "vpull", "hpush", "hpull", "triceps", "biceps", "rearDelt", "chestIso"]);
const LOWER_A = tpl("Lower A", "Quads, hamstrings, glutes and core", ["squat", "hinge", "lunge", "hamIso", "calves", "core", "quadIso", "glute"]);
const LOWER_B = tpl("Lower B", "Hips, legs and core", ["hinge", "lunge", "squat", "glute", "core", "calves", "hamIso", "quadIso"]);
const PUSH_A = tpl("Push A", "Chest, shoulders and triceps", ["hpush", "vpush", "chestIso", "shoulderIso", "triceps", "hpush", "triceps", "core"]);
const PUSH_B = tpl("Push B", "Shoulders, chest and triceps", ["vpush", "hpush", "shoulderIso", "chestIso", "triceps", "triceps", "hpush", "core"]);
const PULL_A = tpl("Pull A", "Back, rear shoulders and biceps", ["vpull", "hpull", "rearDelt", "biceps", "hpull", "biceps", "forearm", "core"]);
const PULL_B = tpl("Pull B", "Back, biceps and grip", ["hpull", "vpull", "biceps", "rearDelt", "vpull", "biceps", "forearm", "core"]);
const LEGS_A = tpl("Legs A", "Quads, hamstrings, glutes and calves", ["squat", "hinge", "lunge", "quadIso", "hamIso", "calves", "glute", "core"]);
const LEGS_B = tpl("Legs B", "Hamstrings, glutes and quads", ["hinge", "squat", "glute", "lunge", "hamIso", "calves", "quadIso", "core"]);
const CHEST_TRI = tpl("Chest and triceps", "Chest and triceps", ["hpush", "hpush", "chestIso", "triceps", "triceps", "hpush", "core"]);
const BACK_BI = tpl("Back and biceps", "Back and biceps", ["vpull", "hpull", "hpull", "biceps", "biceps", "rearDelt", "forearm"]);
const LEGS_SH = tpl("Legs and shoulders", "Legs and shoulders", ["squat", "hinge", "vpush", "lunge", "shoulderIso", "calves", "core"]);
const SH_ARMS = tpl("Shoulders and arms", "Shoulders, biceps and triceps", ["vpush", "shoulderIso", "biceps", "triceps", "rearDelt", "biceps", "triceps"]);
const D_CHEST = tpl("Chest", "Chest", ["hpush", "hpush", "chestIso", "hpush", "chestIso", "core"]);
const D_BACK = tpl("Back", "Back", ["vpull", "hpull", "hpull", "vpull", "rearDelt", "hinge"]);
const D_SHOULDERS = tpl("Shoulders", "Shoulders", ["vpush", "shoulderIso", "rearDelt", "vpush", "shoulderIso", "core"]);
const D_ARMS = tpl("Arms", "Biceps, triceps and forearms", ["biceps", "triceps", "biceps", "triceps", "forearm", "biceps"]);
const D_CORE = tpl("Core", "Abs and core", ["core", "core", "glute", "core", "core"]);
const D_CARDIO = tpl("Cardio", "Heart and lungs", ["cardio", "cardio", "core", "cardio"]);

function sequence(split: string, n: number): Template[] {
  let list: Template[];
  if (split === "Upper / lower") list = [UPPER_A, LOWER_A, UPPER_B, LOWER_B];
  else if (split === "Push / pull / legs") list = [PUSH_A, PULL_A, LEGS_A, PUSH_B, PULL_B, LEGS_B];
  else if (split === "Bro split")
    list = n === 3 ? [CHEST_TRI, BACK_BI, LEGS_SH] : n === 4 ? [CHEST_TRI, BACK_BI, LEGS_A, SH_ARMS] : [D_CHEST, D_BACK, LEGS_A, D_SHOULDERS, D_ARMS, LEGS_B];
  else list = [FULL_A, FULL_B, FULL_C];
  return Array.from({ length: n }, (_, i) => list[i % list.length]);
}

function uniqueTitles(days: PlanDay[]) {
  const seen: Record<string, number> = {};
  days.forEach((d) => {
    seen[d.title] = (seen[d.title] ?? 0) + 1;
    if (seen[d.title] > 1) d.title = `${d.title} (${seen[d.title]})`;
  });
}

/* ---------- Building workouts ---------- */
type Ctx = {
  p: Profile; rank: number; medical: boolean; equip: Set<Equip>; focus: string; minutes: number;
  maxLevel: number; salt: number; usedPlan: Set<string>; cardio: boolean; weakUpper: boolean; weakCardio: boolean;
};

function makeCtx(p: Profile, focusChoice: string, minutes: number, seed: number): Ctx {
  return {
    p, rank: rankOf(p.level), medical: hasHealthFlag(p), equip: availableEquip(p, focusChoice),
    focus: resolveFocus(p, focusChoice), minutes, maxLevel: maxLevelFor(p), salt: Math.floor(seed / 1000),
    usedPlan: new Set(), cardio: p.goals.some((g) => CARDIO_GOALS.includes(g)),
    weakUpper: p.pushups === "0" || p.pushups === "1–5", weakCardio: p.cardio === "Under 10 min",
  };
}

function scheme(ctx: Ctx, ex: Exercise): { reps: string; rest: number } {
  if (ex.unit === "min") return { reps: ctx.focus === "Endurance" || ctx.focus === "Fat loss" ? "10–15" : "8–10", rest: 0 };
  if (ex.unit === "sec") return { reps: ctx.rank <= 1 ? "20–30" : "30–45", rest: 45 };
  const big = ex.type === "Compound";
  switch (ctx.focus) {
    case "Strength":
      if (!big) return { reps: "8–10", rest: 90 };
      return ctx.rank <= 1 ? { reps: "6–8", rest: 120 } : { reps: "4–6", rest: 150 };
    case "Hypertrophy":
      return big ? { reps: "8–10", rest: 90 } : { reps: "10–15", rest: 60 };
    case "Fat loss":
      return big ? { reps: "10–12", rest: 60 } : { reps: "12–15", rest: 45 };
    case "Endurance":
      return { reps: "12–20", rest: 45 };
    case "Beginner-friendly":
      return big ? { reps: "10–12", rest: 75 } : { reps: "12–15", rest: 60 };
    default:
      return big ? { reps: "8–12", rest: 75 } : { reps: "10–15", rest: 60 };
  }
}

function setsFor(ctx: Ctx, ex: Exercise) {
  if (ex.unit === "min") return 1;
  const base = [2, 3, 3, 4, 4][ctx.rank];
  return ctx.medical ? Math.max(2, base - 1) : base;
}

function exerciseCount(ctx: Ctx) {
  let c = Math.round((ctx.minutes - 8) / 7);
  if (ctx.focus === "Strength") c -= 1;
  return Math.max(2, Math.min(ctx.rank <= 1 ? 6 : 8, c));
}

function pick(pattern: Pattern, ctx: Ctx, usedDay: Set<string>, n: number): Exercise | null {
  const options = EXERCISES.filter(
    (ex) =>
      ex.pattern === pattern && !usedDay.has(ex.id) && ex.level <= ctx.maxLevel && canDo(ex, ctx.equip) && isSafeFor(ex, ctx.p) &&
      !(ctx.weakUpper && ex.equipment.length === 0 && ex.level > 1 && UPPER_BW.includes(ex.pattern)) &&
      !(ctx.weakCardio && ex.pattern === "cardio" && ex.level > 1),
  );
  if (!options.length) return null;
  const score = (ex: Exercise) => {
    let s = ctx.rank === 0 ? (ex.level === 1 ? 3 : 0) : ex.level === ctx.maxLevel ? 2 : ex.level === ctx.maxLevel - 1 ? 1 : 0;
    if (ex.equipment.length > 0 && ctx.focus !== "Endurance") s += 1;
    if (ctx.usedPlan.has(ex.id)) s -= 2;
    return s;
  };
  const ranked = [...options].sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id));
  const best = score(ranked[0]);
  const top = ranked.filter((ex) => score(ex) >= best - 1).slice(0, 3);
  return top[(ctx.salt + n) % top.length];
}

// Safety rule: never exceed the set limit for the person's level.
function capVolume(list: PlanExercise[], ctx: Ctx) {
  const max = MAX_SETS[ctx.rank] - (ctx.medical ? 4 : 0);
  let total = list.reduce((s, x) => s + x.sets, 0);
  for (let i = list.length - 1; i >= 0 && total > max; i--) {
    while (list[i].sets > 2 && total > max) {
      list[i].sets -= 1;
      total -= 1;
    }
  }
  while (total > max && list.length > 2) {
    const removed = list.pop();
    total -= removed ? removed.sets : 0;
  }
}

function buildDay(t: Template, ctx: Ctx, dayNo: number): PlanDay {
  const count = exerciseCount(ctx);
  const used = new Set<string>();
  const list: PlanExercise[] = [];
  const add = (ex: Exercise) => {
    used.add(ex.id);
    ctx.usedPlan.add(ex.id);
    const sc = scheme(ctx, ex);
    list.push({ id: ex.id, sets: setsFor(ctx, ex), reps: sc.reps, rest: sc.rest });
  };
  t.slots.forEach((pattern, i) => {
    if (list.length >= count) return;
    const ex = pick(pattern, ctx, used, dayNo * 7 + i * 3);
    if (ex) add(ex);
  });
  if (ctx.cardio && !t.slots.includes("cardio")) {
    const c = pick("cardio", ctx, used, dayNo);
    if (c) {
      if (list.length >= count && list.length > 2) list.pop();
      add(c);
    }
  }
  capVolume(list, ctx);
  return { title: t.title, focus: t.focus, exercises: list };
}

const SPLIT_WHY: Record<string, string> = {
  "Full body": "Full body sessions train every major muscle each time. This suits 1–3 days a week and lets you practise each movement often.",
  "Upper / lower": "An upper / lower split trains each muscle about twice a week with rest in between. It suits 4 days a week.",
  "Push / pull / legs": "Push / pull / legs groups muscles that work together, so each group recovers while you train the others. It suits 5–6 days.",
  "Bro split": "A bro split gives each muscle group its own day. Sessions are focused, but each muscle is trained about once a week.",
};
const FOCUS_WHY: Record<string, string> = {
  Strength: "Strength focus: fewer reps with longer rests on the main lifts, so you can lift heavier safely.",
  Hypertrophy: "Muscle-building focus: moderate reps (8–15), stopping 1–2 reps before failure.",
  "Fat loss": "Fat-loss focus: strength work to keep muscle, shorter rests and some cardio. Food matters most for fat loss.",
  Endurance: "Endurance focus: higher reps, short rests and cardio to build stamina.",
  "Beginner-friendly": "Beginner-friendly: simple moves and moderate reps so you learn good technique first.",
  General: "Balanced training for overall fitness and health.",
};

export function generatePlan(p: Profile, splitChoice = "Auto", focusChoice = "Auto", minutesChoice = 0, seed = Date.now()): Plan {
  const weekdays = trainingWeekdays(p);
  const n = weekdays.length;
  const minutes = minutesChoice || Number(p.minutes) || 45;
  const ctx = makeCtx(p, focusChoice, minutes, seed);
  const why: string[] = [];

  let split = splitChoice;
  if (split === "Auto") split = n <= 3 ? "Full body" : n === 4 ? "Upper / lower" : "Push / pull / legs";
  if (split === "Bro split" && n < 3) {
    split = "Full body";
    why.push("A bro split needs at least 3 training days, so full body is used instead.");
  }

  const days = sequence(split, n).map((t, i) => buildDay(t, ctx, i));
  uniqueTitles(days);

  why.unshift(SPLIT_WHY[split]);
  why.push(FOCUS_WHY[ctx.focus] ?? FOCUS_WHY.General);
  why.push(`Training days: ${weekdays.join(", ")}. Each workout takes about ${minutes} minutes including warm-up and cool-down.`);
  if (p.days.length > n) why.push(`You picked ${p.days.length} days. We planned ${n} so you can recover; use the other days for walking or stretching.`);
  if (split === "Bro split" && ctx.rank <= 1) why.push("Tip: full body or upper / lower usually works better for beginners because each muscle is trained more often.");
  if (ctx.rank === 0) why.push("Exercises start simple, so you can learn good technique with light loads.");
  if (ctx.weakUpper) why.push("Upper-body moves start with easier versions (like wall or knee push-ups), based on your fitness check.");
  if (ctx.medical) why.push("Because of your health answers, harder moves are left out and volume is lower. Please check with a doctor first.");
  if (p.painAreas.length) why.push(`Exercises that load your ${p.painAreas.join(", ").toLowerCase()} are left out.`);
  if (ctx.equip.size === 0) why.push("Every exercise uses only your body weight.");
  else if (p.place !== "Gym") why.push("Every exercise uses only the equipment you said you have.");
  if (ctx.cardio) why.push("Cardio is added at the end of sessions because of your goals.");
  why.push(`Sets are capped at ${MAX_SETS[ctx.rank] - (ctx.medical ? 4 : 0)} per session for your level, so you can recover between workouts.`);

  return { choice: `${splitChoice}|${focusChoice}`, split: `${split} · ${ctx.focus}`, minutes, weekdays, days, why, seed };
}

export function planChoices(plan: Plan) {
  const [split = "Auto", focus = "Auto"] = plan.choice.split("|");
  return { split, focus };
}

/* ---------- Quick workouts (for "Generate new workout" and the coach) ---------- */
export const QUICK_TARGETS = ["Full body", "Upper body", "Lower body", "Chest", "Back", "Shoulders", "Arms", "Legs", "Core", "Cardio"];
const QUICK_TPL: Record<string, Template> = {
  "Full body": FULL_A, "Upper body": UPPER_A, "Lower body": LOWER_A, Chest: D_CHEST, Back: D_BACK,
  Shoulders: D_SHOULDERS, Arms: D_ARMS, Legs: LEGS_A, Core: D_CORE, Cardio: D_CARDIO,
};

export function quickWorkout(p: Profile, target: string, minutes: number, bodyweight = false, seed = Date.now()): PlanDay {
  const ctx = makeCtx(p, bodyweight ? "Bodyweight" : "Auto", minutes, seed);
  ctx.cardio = false;
  const day = buildDay(QUICK_TPL[target] ?? FULL_A, ctx, 0);
  return { ...day, title: `${target} workout` };
}

/* ---------- Swaps, warm-ups and timing ---------- */
export function alternatives(id: string, p: Profile, focusChoice = "Auto"): Exercise[] {
  const ex = byId(id);
  if (!ex) return [];
  const equip = availableEquip(p, focusChoice);
  return EXERCISES.filter((o) => o.id !== id && o.pattern === ex.pattern && canDo(o, equip) && isSafeFor(o, p)).sort(
    (a, b) => a.level - b.level,
  );
}

export function swapIn(old: PlanExercise, newId: string, p: Profile, focusChoice = "Auto"): PlanExercise {
  const ex = byId(newId);
  if (!ex) return old;
  const ctx = makeCtx(p, focusChoice, 45, Date.now());
  const sc = scheme(ctx, ex);
  const oldUnit = byId(old.id)?.unit;
  const sets = ex.unit === "min" ? 1 : oldUnit === "min" ? setsFor(ctx, ex) : old.sets;
  return { id: newId, sets, reps: sc.reps, rest: sc.rest };
}

export const topOf = (reps: string) => {
  const nums = reps.match(/\d+/g);
  return nums ? Number(nums[nums.length - 1]) : 10;
};
export const bottomOf = (reps: string) => {
  const nums = reps.match(/\d+/g);
  return nums ? Number(nums[0]) : 8;
};

export function estimateMinutes(day: PlanDay) {
  let sec = 8 * 60;
  day.exercises.forEach((x) => {
    const ex = byId(x.id);
    if (ex?.unit === "min") {
      sec += topOf(x.reps) * 60;
      return;
    }
    const work = ex?.unit === "sec" ? topOf(x.reps) : topOf(x.reps) * 3.5;
    sec += x.sets * (work + x.rest) + 45;
  });
  return Math.round(sec / 60);
}

export function warmUp(day: PlanDay): string[] {
  const first = day.exercises[0] ? byId(day.exercises[0].id) : undefined;
  const patterns = day.exercises.map((x) => byId(x.id)?.pattern).filter((pt): pt is Pattern => pt !== undefined);
  const out = [
    "3–5 minutes of easy movement: brisk walking, marching on the spot or light cycling.",
    "Gentle circles for your neck, shoulders, hips, knees and ankles (5–10 each way).",
  ];
  if (patterns.some((pt) => LOWER.includes(pt))) out.push("Leg swings (10 each leg) and 10 slow chair or bodyweight squats.");
  if (patterns.some((pt) => !LOWER.includes(pt) && pt !== "core" && pt !== "cardio")) out.push("10 arm circles each way and 10 wall push-ups or band pull-aparts.");
  if (first && first.unit === "reps") out.push(`1–2 light practice sets of ${first.name} before your working sets.`);
  return out;
}

export function coolDown(day: PlanDay): string[] {
  const muscles: string[] = [];
  day.exercises.forEach((x) => {
    const m = byId(x.id)?.muscle;
    if (m && m !== "Full body" && !muscles.includes(m)) muscles.push(m);
  });
  return [
    "2–3 minutes of easy walking until your breathing settles.",
    muscles.length
      ? `Stretch the muscles you trained (${muscles.join(", ").toLowerCase()}), 20–30 seconds each, breathing slowly.`
      : "Stretch your legs, hips and shoulders, 20–30 seconds each.",
    "Drink some water and note how the workout felt.",
  ];
}

/* ---------- Schedule ---------- */
export const planStartKey = (plan: Plan) => dateKey(new Date(plan.seed));
export const dayIndexOf = (plan: Plan, title: string) => plan.days.findIndex((d) => d.title === title);
export const isTrainingDay = (plan: Plan, key: string) => plan.weekdays.includes(weekdayOf(key));
export const trainedOn = (sessions: Session[], key: string) => sessions.some((s) => s.date === key);

// The plan rotates: after you finish a workout, the next one comes up. Missed days are never skipped.
export function nextDayIndex(plan: Plan, sessions: Session[]) {
  const start = planStartKey(plan);
  for (let i = sessions.length - 1; i >= 0; i--) {
    if (sessions[i].date < start) break;
    const idx = dayIndexOf(plan, sessions[i].title);
    if (idx >= 0) return (idx + 1) % plan.days.length;
  }
  return 0;
}

export function upcoming(plan: Plan, sessions: Session[], count = 7, from = dateKey()) {
  const out: { date: string; index: number }[] = [];
  if (!plan.days.length) return out;
  let idx = nextDayIndex(plan, sessions);
  let key = trainedOn(sessions, from) ? addDays(from, 1) : from;
  for (let i = 0; i < 21 && out.length < count; i++) {
    if (isTrainingDay(plan, key)) {
      out.push({ date: key, index: idx });
      idx = (idx + 1) % plan.days.length;
    }
    key = addDays(key, 1);
  }
  return out;
}

export function todaysIndex(plan: Plan, sessions: Session[]) {
  const next = upcoming(plan, sessions, 1);
  return next.length && next[0].date === dateKey() ? next[0].index : -1;
}

export function missedCount(plan: Plan, sessions: Session[], today = dateKey()) {
  const start = planStartKey(plan);
  let planned = 0;
  for (let i = 1; i <= 7; i++) {
    const k = addDays(today, -i);
    if (k < start) break;
    if (isTrainingDay(plan, k)) planned++;
  }
  const from = addDays(today, -7) > start ? addDays(today, -7) : start;
  const done = sessions.filter((s) => s.date >= from && s.date < today).length;
  return Math.max(0, planned - done);
}

/* ---------- Session numbers and personal records ---------- */
export const doneSets = (s: Session) => s.exercises.reduce((n, e) => n + e.sets.filter((x) => x.done).length, 0);
export const totalReps = (s: Session) =>
  s.exercises.reduce(
    (n, e) => n + (byId(e.id)?.unit === "reps" ? e.sets.filter((x) => x.done).reduce((a, x) => a + x.reps, 0) : 0),
    0,
  );
export const sessionVolume = (s: Session) =>
  s.exercises.reduce((v, e) => v + e.sets.filter((x) => x.done).reduce((a, x) => a + x.weight * x.reps, 0), 0);

export const e1rm = (w: number, r: number) => (w > 0 && r > 0 ? round(w * (1 + r / 30), 1) : 0);

export type Best = { weight: number; reps: number; e1rm: number; date: string };
export function bestsFrom(sessions: Session[]): Record<string, Best> {
  const out: Record<string, Best> = {};
  sessions.forEach((s) =>
    s.exercises.forEach((ex) =>
      ex.sets.forEach((set) => {
        if (!set.done) return;
        const b = out[ex.id] ?? { weight: 0, reps: 0, e1rm: 0, date: s.date };
        let better = false;
        if (set.weight > b.weight) {
          b.weight = set.weight;
          better = true;
        }
        if (set.reps > b.reps) {
          b.reps = set.reps;
          better = true;
        }
        const est = e1rm(set.weight, set.reps);
        if (est > b.e1rm) {
          b.e1rm = est;
          better = true;
        }
        if (better) b.date = s.date;
        out[ex.id] = b;
      }),
    ),
  );
  return out;
}

export function newRecords(session: Session, previous: Session[], p: Profile): string[] {
  const before = bestsFrom(previous);
  const now = bestsFrom([session]);
  const out: string[] = [];
  Object.entries(now).forEach(([id, b]) => {
    const prev = before[id];
    const ex = byId(id);
    if (!prev || !ex) return;
    if (b.weight > prev.weight) out.push(`${ex.name}: heaviest weight, ${showWeight(b.weight, p)}`);
    else if (b.e1rm > prev.e1rm) out.push(`${ex.name}: best estimated strength`);
    else if (b.weight === 0 && b.reps > prev.reps) out.push(`${ex.name}: most ${ex.unit === "reps" ? "reps" : ex.unit === "sec" ? "seconds" : "minutes"} (${b.reps})`);
  });
  return out;
}

export function historyFor(id: string, sessions: Session[]) {
  return sessions.flatMap((s) => {
    const log = s.exercises.find((e) => e.id === id);
    const done = log ? log.sets.filter((x) => x.done) : [];
    if (!done.length) return [];
    return [{
      date: s.date,
      weight: Math.max(...done.map((x) => x.weight)),
      reps: Math.max(...done.map((x) => x.reps)),
      e1rm: Math.max(...done.map((x) => e1rm(x.weight, x.reps))),
      volume: done.reduce((a, x) => a + x.weight * x.reps, 0),
    }];
  });
}

export function lastSetsFor(id: string, sessions: Session[]) {
  for (let i = sessions.length - 1; i >= 0; i--) {
    const log = sessions[i].exercises.find((e) => e.id === id && e.sets.some((x) => x.done));
    if (log) return log.sets.filter((x) => x.done);
  }
  return [];
}

/* ---------- Adaptive engine ---------- */
export function progressionTips(p: Profile, data: AppData): string[] {
  const plan = data.plan;
  if (!plan) return [];
  const tips: string[] = [];
  const seen = new Set<string>();
  plan.days.forEach((day) =>
    day.exercises.forEach((px) => {
      if (seen.has(px.id)) return;
      seen.add(px.id);
      const ex = byId(px.id);
      if (!ex || ex.unit === "min") return;
      const recent = data.sessions.filter((s) => s.exercises.some((l) => l.id === px.id && !l.skipped)).slice(-2);
      if (recent.length < 2 || recent.some((s) => s.effort === "Hard" || s.effort === "Too hard")) return;
      const top = topOf(px.reps);
      const hitAll = recent.every((s) => {
        const log = s.exercises.find((l) => l.id === px.id);
        const done = log ? log.sets.filter((x) => x.done) : [];
        return done.length >= px.sets && done.every((x) => x.reps >= top);
      });
      if (!hitAll) return;
      const lastLog = recent[1].exercises.find((l) => l.id === px.id);
      const lastW = lastLog ? Math.max(0, ...lastLog.sets.map((x) => x.weight)) : 0;
      if (lastW > 0) {
        const lower = LOWER.includes(ex.pattern);
        const inc = p.units === "imperial" ? (lower ? 10 : 5) / LB : lower ? 5 : 2.5;
        tips.push(`${ex.name}: you hit ${px.sets} × ${top} at ${showWeight(lastW, p)} twice. Next time try ${showWeight(lastW + inc, p)}, or add 1 rep per set first.`);
      } else if (ex.unit === "sec") {
        tips.push(`${ex.name} is getting easy. Add 5–10 seconds to each hold.`);
      } else {
        const harder = ex.harder ? byId(ex.harder) : undefined;
        tips.push(harder ? `${ex.name} is getting easy. Add a few reps, or try ${harder.name} when you feel ready.` : `${ex.name} is getting easy. Add 1–2 reps per set, or slow each rep down.`);
      }
    }),
  );
  return tips.slice(0, 3);
}

export function plateauTips(data: AppData): string[] {
  const out: string[] = [];
  const ids = new Set(data.sessions.flatMap((s) => s.exercises.map((e) => e.id)));
  ids.forEach((id) => {
    const h = historyFor(id, data.sessions).filter((x) => x.e1rm > 0);
    if (h.length < 4) return;
    const last4 = h.slice(-4);
    const before = Math.max(last4[0].e1rm, last4[1].e1rm);
    const after = Math.max(last4[2].e1rm, last4[3].e1rm);
    const ex = byId(id);
    if (after <= before && ex) {
      out.push(`${ex.name} hasn't improved in your last 4 sessions. Check your sleep and protein, or take one lighter week (fewer sets), then build back up.`);
    }
  });
  return out.slice(0, 2);
}

export type Insight = { kind: "rest" | "schedule" | "progress" | "tip" | "warn"; title: string; text: string };

export function insights(p: Profile, data: AppData, today = dateKey()): Insight[] {
  const out: Insight[] = [];
  const log = data.days[today];
  const sessions = data.sessions;

  if (hasHealthFlag(p) && sessions.length === 0) {
    out.push({ kind: "warn", title: "Check with a doctor first", text: "Because of your health answers, get a doctor's OK before starting. BYB gives general fitness information, not medical advice." });
  }
  if (log?.feel === "Unwell") {
    out.push({ kind: "rest", title: "Rest today", text: "Training while unwell slows recovery. Rest, drink water, and see a doctor if you don't feel better in a few days." });
  } else if (log?.feel === "Tired" || log?.feel === "Sore") {
    out.push({ kind: "rest", title: "Go lighter today", text: `You said you feel ${log.feel.toLowerCase()}. Do 1 fewer set per exercise and stop a few reps short of failure, or swap today for a walk and some stretching.` });
  }

  const last2 = sessions.slice(-2);
  if (last2.length === 2 && last2.every((s) => s.effort === "Too hard")) {
    out.push({ kind: "rest", title: "Your last 2 workouts felt too hard", text: "Use about 10% less weight or 1 fewer set next time. You progress from training you can recover from." });
  } else if (sessions.length && sessions[sessions.length - 1].effort === "Too hard") {
    out.push({ kind: "rest", title: "Last workout felt too hard", text: "Keep the same weights next time, or drop 1 set. Only increase when it feels manageable." });
  }

  if (data.plan) {
    const missed = missedCount(data.plan, sessions, today);
    if (missed > 0) {
      out.push({ kind: "schedule", title: `${missed} missed workout${missed > 1 ? "s" : ""} this week`, text: "Your plan simply continues from the workout you missed, so nothing is skipped. Don't try to fit two workouts into one day." });
    }
    const last = sessions.length ? sessions[sessions.length - 1].date : "";
    if (last && last <= addDays(today, -10)) {
      out.push({ kind: "schedule", title: "Welcome back", text: "It's been a while since your last workout. Use about 20% lighter weights this week, then build back up." });
    }
  }

  const sleeps = Object.entries(data.days)
    .filter(([k, d]) => k <= today && k > addDays(today, -4) && typeof d.sleep === "number")
    .map(([, d]) => d.sleep ?? 0);
  if (sleeps.length >= 2 && sleeps.reduce((a, b) => a + b, 0) / sleeps.length < 6) {
    out.push({ kind: "tip", title: "Low sleep lately", text: "You've averaged under 6 hours. Keep today's session moderate and aim for an earlier night; recovery happens while you sleep." });
  }

  progressionTips(p, data).forEach((t) => out.push({ kind: "progress", title: "Ready to progress", text: t }));
  plateauTips(data).forEach((t) => out.push({ kind: "tip", title: "Progress has stalled", text: t }));

  if (!sessions.length && data.plan) {
    out.push({ kind: "tip", title: "Start with your first workout", text: "Use light weights for your first sessions and focus on technique. You can always add more next time." });
  }
  return out;
}