import type { AppData, Gear, PlanExercise, Profile, Session } from "./store";
import { byId, type Exercise } from "./exercises";
import { bottomOf, hasHealthFlag, latestWeightKg, rankOf, showWeight, topOf } from "./train";

/* ==========================================================
   BYB weights: the weights you own, a safe starting guess from
   your body weight and level, and what to lift next time based
   on your last workouts (double progression). Band and
   bodyweight exercises progress with reps, holds, stronger
   bands or harder versions.
   ========================================================== */

const LB = 2.20462;
const r2 = (n: number) => Math.round(n * 100) / 100;
function range(min: number, max: number, step: number) {
  const out: number[] = [];
  if (step <= 0) return out;
  for (let v = min; v <= max + 1e-6 && out.length < 300; v += step) out.push(r2(v));
  return out;
}
const fromLb = (list: number[]) => list.map((lb) => lb / LB);

export const DB_OPTIONS = {
  kg: [1, 2, 2.5, 3, 4, 5, 6, 7, 7.5, 8, 9, 10, 12, 12.5, 15, 17.5, 20, 22.5, 25, 30],
  lb: [3, 5, 8, 10, 12, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60],
};
export const KB_OPTIONS = [4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32];

export type LoadKind = "dumbbell" | "barbell" | "kettlebell" | "machine" | "none";

export function loadKind(ex: Exercise): LoadKind {
  if (ex.unit === "min") return "none";
  const e = ex.equipment;
  if (e.includes("barbell")) return "barbell";
  if (e.includes("dumbbell")) return "dumbbell";
  if (e.includes("kettlebell")) return "kettlebell";
  if (e.includes("machine") || e.includes("cable")) return "machine";
  return "none";
}

// Every weight you could use for this kind of exercise (kg)
export function ownedWeights(kind: LoadKind, p: Profile, gear: Gear): number[] {
  const gym = p.place === "Gym";
  const imperial = p.units === "imperial";
  switch (kind) {
    case "dumbbell": {
      if (gym) return imperial ? fromLb(range(5, 100, 5)) : [1, 2, ...range(2.5, 50, 2.5)];
      const list = [...gear.dumbbells];
      if (gear.adjustable) list.push(...range(gear.adjustable.min, gear.adjustable.max, gear.adjustable.step));
      return [...new Set(list.map(r2))].filter((n) => n > 0).sort((a, b) => a - b);
    }
    case "barbell":
      return imperial ? fromLb(range(25, 405, 5)) : range(10, 200, 2.5);
    case "kettlebell":
      return !gym && gear.kettlebells.length ? [...gear.kettlebells].sort((a, b) => a - b) : KB_OPTIONS;
    case "machine":
      return imperial ? fromLb(range(10, 300, 10)) : range(5, 150, 5);
    default:
      return [];
  }
}

export function pickOwned(list: number[], target: number): number | null {
  if (!list.length) return null;
  let best = list[0];
  for (const w of list) if (w <= target + 0.01) best = w;
  return best;
}
export function nearestOwned(list: number[], kg: number): number | null {
  if (!list.length) return null;
  return list.reduce((a, b) => (Math.abs(b - kg) < Math.abs(a - kg) ? b : a));
}
export function stepOwned(list: number[], kg: number, dir: 1 | -1): number | null {
  if (dir > 0) return list.find((w) => w > kg + 0.01) ?? null;
  for (let i = list.length - 1; i >= 0; i--) if (list[i] < kg - 0.01) return list[i];
  return null;
}

/* ---------- Starting guess (only used before you have history) ---------- */
const UPPER = ["hpush", "vpush", "hpull", "vpull", "chestIso", "shoulderIso", "rearDelt", "biceps", "triceps", "forearm"];
// Share of body weight for a set of 8–12 at a moderate effort (per dumbbell for dumbbells)
const RATIO: Record<LoadKind, Record<string, number>> = {
  dumbbell: {
    squat: 0.2, hinge: 0.15, lunge: 0.08, hpush: 0.12, vpush: 0.08, hpull: 0.14, vpull: 0.1, chestIso: 0.05, shoulderIso: 0.03,
    rearDelt: 0.03, biceps: 0.06, triceps: 0.05, forearm: 0.22, glute: 0.12, calves: 0.12, core: 0.06, quadIso: 0.1, hamIso: 0.08,
  },
  barbell: { squat: 0.5, hinge: 0.55, lunge: 0.25, hpush: 0.45, vpush: 0.3, hpull: 0.4, biceps: 0.2, triceps: 0.2, glute: 0.6, calves: 0.4, forearm: 0.2, core: 0.2, shoulderIso: 0.2, rearDelt: 0.2 },
  kettlebell: { hinge: 0.2, squat: 0.2, lunge: 0.1, vpush: 0.1, hpull: 0.15, core: 0.1, forearm: 0.2, glute: 0.15 },
  machine: {
    squat: 1.0, hpush: 0.35, vpush: 0.25, hpull: 0.4, vpull: 0.45, chestIso: 0.25, shoulderIso: 0.08, rearDelt: 0.12,
    biceps: 0.15, triceps: 0.2, quadIso: 0.3, hamIso: 0.25, glute: 0.15, calves: 0.6, core: 0.2,
  },
  none: {},
};
const LEVEL_FACTOR = [0.55, 0.75, 1, 1.2, 1.35];

export function startGuess(ex: Exercise, kind: LoadKind, p: Profile, data: AppData) {
  const bw = latestWeightKg(p, data) || 65;
  let ratio = RATIO[kind][ex.pattern] ?? 0.08;
  if (kind === "barbell" && /deadlift/i.test(ex.name) && !/romanian|stiff/i.test(ex.name)) ratio = 0.7;
  const upper = UPPER.includes(ex.pattern);
  let f = LEVEL_FACTOR[rankOf(p.level)] ?? 0.75;
  if (p.sex === "Female") f *= upper ? 0.6 : 0.75;
  else if (p.sex !== "Male") f *= 0.8;
  const age = Number(p.age) || 30;
  if (age >= 60) f *= 0.8;
  else if (age >= 50) f *= 0.9;
  if (hasHealthFlag(p)) f *= 0.8;
  if (upper && (p.pushups === "0" || p.pushups === "1–5")) f *= 0.8;
  return bw * ratio * f;
}

/* ---------- What to lift today ---------- */
export type Suggestion = {
  kind: LoadKind;
  kg: number | null;
  reps: string;
  note: string;
  basis: "last" | "chosen" | "guess" | "none";
  last: { kg: number; reps: number[] } | null;
  needsGear: boolean;
};

const doneSetsOf = (s: Session, id: string) => s.exercises.find((l) => l.id === id)?.sets.filter((x) => x.done) ?? [];

export function suggest(px: PlanExercise, p: Profile, data: AppData): Suggestion {
  const ex = byId(px.id);
  const out: Suggestion = { kind: "none", kg: null, reps: px.reps, note: "", basis: "none", last: null, needsGear: false };
  if (!ex) return out;
  out.kind = loadKind(ex);
  const recent = data.sessions.filter((s) => doneSetsOf(s, px.id).length > 0).slice(-2);
  const lastS = recent[recent.length - 1];
  const lastDone = lastS ? doneSetsOf(lastS, px.id) : [];
  if (lastDone.length) out.last = { kg: Math.max(...lastDone.map((x) => x.weight)), reps: lastDone.map((x) => x.reps) };
  const top = topOf(px.reps);
  const bottom = bottomOf(px.reps);
  const hitTop = (s: Session) => {
    const d = doneSetsOf(s, px.id);
    return d.length >= px.sets && d.every((x) => x.reps >= top);
  };
  const missed = (s: Session) => doneSetsOf(s, px.id).some((x) => x.reps < bottom);
  const effort = lastS?.effort ?? "";

  // Band, bodyweight and cardio exercises
  if (out.kind === "none") {
    const band = ex.equipment.includes("band");
    if (!out.last || !lastS) {
      out.note =
        ex.unit === "min" ? "Go at a pace where you can still talk in short sentences."
          : band ? "Pick a band that lets you finish every rep with 2–3 to spare."
            : "Move slowly and with control.";
      return out;
    }
    out.basis = "last";
    if (hitTop(lastS) && effort !== "Hard" && effort !== "Too hard") {
      const harder = ex.harder ? byId(ex.harder) : undefined;
      if (ex.unit === "sec") out.note = `You held every set for ${top}+ seconds. Add 5–10 seconds today.`;
      else if (band) out.note = `You hit ${top} reps on every set. Use a stronger band, or stand further from the anchor for more tension.`;
      else if (harder) out.note = `You hit ${top} reps on every set. Try ${harder.name}, or add 2 reps per set.`;
      else {
        out.reps = `${top}–${top + 3}`;
        out.note = `You hit ${top} reps on every set. Add 1–2 reps per set today.`;
      }
    } else {
      out.note = `Last time: ${out.last.reps.join(", ")} ${ex.unit === "sec" ? "seconds" : "reps"}. Try to match or beat it.`;
    }
    return out;
  }

  const owned = ownedWeights(out.kind, p, data.gear);
  if (!owned.length) {
    out.needsGear = true;
    out.note = "Add the weights you own in Equipment & weights to see a suggested weight.";
    return out;
  }
  const w = (kg: number) => showWeight(kg, p);

  // You have done this exercise before: progress from your last workout
  if (out.last && out.last.kg > 0 && lastS) {
    out.basis = "last";
    const cur = nearestOwned(owned, out.last.kg) ?? out.last.kg;
    if (effort === "Too hard") {
      const down = missed(lastS) ? stepOwned(owned, cur, -1) : null;
      out.kg = down ?? cur;
      out.note = down
        ? `Last workout felt too hard and you missed reps. Drop to ${w(down)} and build back up.`
        : `Last workout felt too hard. Stay at ${w(cur)} until it feels manageable.`;
    } else if (hitTop(lastS) && effort !== "Hard") {
      const up = stepOwned(owned, cur, 1);
      const worst = Math.min(...out.last.reps);
      const smallJump = up !== null && ((up - cur) / cur <= 0.15 || (out.kind !== "dumbbell" && out.kind !== "kettlebell"));
      if (up === null) {
        out.kg = cur;
        out.reps = `${top}–${top + 5}`;
        out.note = `${w(cur)} is your heaviest. Add reps (up to ${top + 5}), lower each rep over 3 seconds, or add a set.`;
      } else if (smallJump) {
        out.kg = up;
        out.note = `You hit ${top} reps on every set. Move up to ${w(up)}.`;
      } else if (worst >= top + 3) {
        out.kg = up;
        out.reps = `${Math.max(3, bottom - 2)}–${bottom}`;
        out.note = `Move up to ${w(up)}. It's a big jump, so aim for fewer reps and build back up.`;
      } else {
        out.kg = cur;
        out.reps = `${top}–${top + 3}`;
        out.note = `Your next weight (${w(up)}) is a big jump. Stay at ${w(cur)} and build to ${top + 3} reps first.`;
      }
    } else if (recent.length === 2 && recent.every(missed)) {
      const down = stepOwned(owned, cur, -1);
      out.kg = down ?? cur;
      out.note = down
        ? `You missed the target reps twice. Drop to ${w(down)} and build back up.`
        : "You missed the target reps twice. Use slower, cleaner reps at this weight.";
    } else {
      out.kg = cur;
      out.note = `Same weight as last time. Try to beat ${out.last.reps.join(", ")} reps.`;
    }
    return out;
  }

  // A weight you picked yourself
  if (px.kg) {
    out.basis = "chosen";
    out.kg = nearestOwned(owned, px.kg);
    out.note = "The weight you chose for this exercise.";
    return out;
  }

  // First time: a safe guess from your body weight and level
  const guess = startGuess(ex, out.kind, p, data);
  out.kg = pickOwned(owned, guess);
  out.basis = "guess";
  out.note =
    out.kg !== null && out.kg > guess * 1.4
      ? "Your lightest weight may be heavy for this. Do fewer, slower reps, or try the easier version."
      : "Starting guess for your body weight and level. If the first set feels easy (3+ reps left), go up a weight; if you can't finish, go down one.";
  return out;
}

const ONE_DB = /goblet|one.?arm|single.?arm|overhead dumbbell triceps|pullover|concentration/i;

export function loadText(ex: Exercise, s: Suggestion, p: Profile): string {
  if (s.kind === "none") {
    if (ex.unit === "min") return "";
    return ex.equipment.includes("band") ? "Resistance band" : "Bodyweight";
  }
  if (s.kg === null) return "Add your weights";
  const w = showWeight(s.kg, p);
  switch (s.kind) {
    case "dumbbell":
      return ONE_DB.test(ex.name) ? `1 × ${w} dumbbell` : `${w} dumbbells`;
    case "barbell":
      return `${w} barbell (bar + plates)`;
    case "kettlebell":
      return `${w} kettlebell`;
    default:
      return `about ${w} on the machine`;
  }
}

const MAX_SETS = [12, 16, 20, 24, 26];
export const setCap = (p: Profile) => MAX_SETS[rankOf(p.level)] - (hasHealthFlag(p) ? 4 : 0);

export const needsGearSetup = (p: Profile, gear: Gear) =>
  p.place !== "Gym" && p.place !== "Bodyweight only" &&
  (p.equipment.includes("Dumbbells") || p.equipment.includes("Kettlebell")) && !gear.set;