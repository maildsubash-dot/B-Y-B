import { FOODS } from "./foods";
import type { AppData, DayLog, Food, FoodEntry, Profile } from "./store";
import { addDays, dateKey, dayLog, parseKey, weekStart, weekdayOf } from "./store";
import { doneSets, e1rm, hasHealthFlag, heightCm, latestWeightKg, sessionVolume, trainingWeekdays } from "./train";

/* ==========================================================
   BYB numbers: nutrition targets, meal ideas, streaks, badges,
   challenges and reports. All nutrition values are estimates.
   ========================================================== */

const round1 = (n: number) => Math.round(n * 10) / 10;
const avg = (list: number[]) => list.reduce((a, b) => a + b, 0) / list.length;

/* ---------- Nutrition targets ---------- */
export type Targets = {
  kcal: number; protein: number; carbs: number; fat: number; fibre: number; water: number; maintenance: number; notes: string[];
};

const ACTIVITY_FACTOR: Record<string, number> = {
  "Mostly sitting": 1.2, "Lightly active": 1.375, Active: 1.55, "Very active": 1.725,
};

export function nutritionTargets(p: Profile, data: AppData): Targets {
  const w = latestWeightKg(p, data) || 60;
  const h = heightCm(p) || 165;
  const age = Number(p.age) || 30;
  const sexAdjust = p.sex === "Male" ? 5 : p.sex === "Female" ? -161 : -78;
  const bmr = 10 * w + 6.25 * h - 5 * age + sexAdjust; // Mifflin-St Jeor estimate
  const factor = (ACTIVITY_FACTOR[p.activity] ?? 1.375) + 0.03 * trainingWeekdays(p).length;
  const maintenance = bmr * factor;
  const goal = p.goals[0] ?? "";
  const pregnant = p.health.some((x) => x.startsWith("Pregnant"));
  const notes = ["These are estimates based on your answers. Adjust them based on how your weight and energy change over 2–3 weeks."];

  let kcal = maintenance;
  if (pregnant) {
    notes.push("Pregnancy changes your needs. Follow your doctor's advice; BYB does not set a calorie deficit for you.");
  } else if (goal === "Lose weight" || goal === "Reduce body fat") {
    kcal = maintenance - Math.min(500, maintenance * 0.15);
    notes.push("A small deficit (no more than about 500 kcal a day) helps you lose fat steadily while keeping muscle.");
  } else if (goal === "Build muscle" || goal === "Gain healthy weight") {
    kcal = maintenance + Math.min(300, maintenance * 0.1);
    notes.push("A small surplus supports muscle gain while limiting fat gain.");
  }
  // Safety floor: never suggest very low intakes.
  const floor = p.sex === "Male" ? 1500 : p.sex === "Female" ? 1200 : 1350;
  kcal = Math.round(Math.max(kcal, floor, bmr) / 10) * 10;

  const trainingGoal = p.goals.some((g) => ["Build muscle", "Gain healthy weight", "Improve strength", "Lose weight", "Reduce body fat"].includes(g));
  const protein = Math.min(200, Math.round(w * (trainingGoal ? 1.6 : 1.2)));
  const fat = Math.round((kcal * 0.25) / 9);
  const carbs = Math.max(50, Math.round((kcal - protein * 4 - fat * 9) / 4));
  const fibre = Math.round((kcal / 1000) * 14);
  const water = Math.min(16, Math.max(8, Math.round((w * 35) / 250)));

  if (hasHealthFlag(p)) notes.push("Because of your health answers, please check these targets with a doctor or registered dietitian.");
  notes.push("BYB does not replace a registered dietitian or doctor.");
  return { kcal, protein, carbs, fat, fibre, water, maintenance: Math.round(maintenance), notes };
}

/* ---------- Food helpers ---------- */
export type Totals = { kcal: number; protein: number; carbs: number; fat: number; fibre: number };

export function totalsOf(entries: FoodEntry[]): Totals {
  return entries.reduce(
    (t, e) => ({ kcal: t.kcal + e.kcal, protein: t.protein + e.protein, carbs: t.carbs + e.carbs, fat: t.fat + e.fat, fibre: t.fibre + e.fibre }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 },
  );
}
export const foodOn = (data: AppData, key: string) => data.food.filter((f) => f.date === key);

const DIET_ALLOWS: Record<string, Food["diet"][]> = {
  Vegan: ["vegan"],
  Vegetarian: ["vegan", "veg"],
  Jain: ["vegan", "veg"],
  Eggetarian: ["vegan", "veg", "egg"],
  "Non-vegetarian": ["vegan", "veg", "egg", "nonveg"],
};

export function isSuitable(f: Food, p: Profile) {
  const diets = DIET_ALLOWS[p.diet] ?? DIET_ALLOWS["Non-vegetarian"];
  const words = p.otherAllergy
    .toLowerCase()
    .split(/,|;| and /)
    .map((s) => s.trim().replace(/s$/, ""))
    .filter((s) => s.length > 2);
  return (
    diets.includes(f.diet) &&
    (p.diet !== "Jain" || f.jain) &&
    !f.allergens.some((a) => p.allergies.includes(a)) &&
    !words.some((word) => f.name.toLowerCase().includes(word))
  );
}

export function foodsFor(p: Profile, data: AppData): Food[] {
  return [...data.customFoods, ...FOODS.filter((f) => isSuitable(f, p))];
}

/* ---------- Meal ideas (rule-based meal assistant) ---------- */
export const MEALS = ["Breakfast", "Lunch", "Dinner", "Snack", "Pre-workout", "Post-workout"];
const SHARE: Record<string, number> = { Breakfast: 0.25, Lunch: 0.3, Dinner: 0.25, Snack: 0.1, "Pre-workout": 0.05, "Post-workout": 0.05 };

export type MealItem = { food: Food; qty: number };
export type MealIdea = { meal: string; items: MealItem[]; kcal: number; protein: number };

export function mealIdeas(p: Profile, data: AppData, seed: number): MealIdea[] {
  const t = nutritionTargets(p, data);
  const maxCost = p.budget === "Budget-friendly" ? 1 : p.budget === "Moderate" ? 2 : 3;
  const south = p.cuisines.includes("South Indian");
  const north = p.cuisines.includes("North Indian");
  const anyRegion = (!south && !north) || p.cuisines.includes("A bit of everything");
  const foods = foodsFor(p, data);

  const pool = (tag: string) => {
    const all = foods.filter((f) => f.meals.includes(tag));
    const cheap = all.filter((f) => f.cost <= maxCost);
    const base = cheap.length ? cheap : all;
    const regional = base.filter(
      (f) => anyRegion || f.region === "Any" || (south && f.region === "South Indian") || (north && f.region === "North Indian"),
    );
    return regional.length ? regional : base;
  };

  let n = 0;
  const choose = (tag: string, exclude: (Food | undefined)[] = []) => {
    n += 1;
    const list = pool(tag).filter((f) => !exclude.includes(f));
    return list.length ? list[Math.abs(seed + n * 7) % list.length] : undefined;
  };

  const build = (meal: string, scaled: Food | undefined, others: (Food | undefined)[]): MealIdea | null => {
    const extras = others.filter((f): f is Food => !!f);
    if (!scaled && !extras.length) return null;
    const target = t.kcal * SHARE[meal];
    const otherKcal = extras.reduce((a, f) => a + f.kcal, 0);
    const items: MealItem[] = extras.map((food) => ({ food, qty: 1 }));
    if (scaled) {
      const qty = Math.min(3, Math.max(0.5, Math.round(((target - otherKcal) / scaled.kcal) * 2) / 2));
      items.unshift({ food: scaled, qty });
    }
    return {
      meal,
      items,
      kcal: Math.round(items.reduce((a, i) => a + i.food.kcal * i.qty, 0)),
      protein: Math.round(items.reduce((a, i) => a + i.food.protein * i.qty, 0)),
    };
  };

  const bMain = choose("b");
  const bSide = choose("b", [bMain]);
  const lBase = choose("c");
  const lMain = choose("m");
  const lSide = choose("d");
  const dBase = choose("c", [lBase]);
  const dMain = choose("m", [lMain]);
  const dSide = choose("d", [lSide]);

  return [
    build("Breakfast", bMain, [bSide]),
    build("Lunch", lBase, [lMain, lSide]),
    build("Dinner", dBase, [dMain, dSide]),
    build("Snack", choose("s"), []),
    build("Pre-workout", choose("p"), []),
    build("Post-workout", choose("o"), []),
  ].filter((m): m is MealIdea => m !== null);
}

/* ---------- Daily log helpers ---------- */
export const HABITS = [
  "Stretched for 10 minutes",
  "Fruit or vegetables with meals",
  "Walked after a meal",
  "No sugary drinks",
  "Screens off 30 min before bed",
  "Got some sunlight",
];

export function updateDay(d: AppData, key: string, patch: Partial<DayLog>): AppData {
  return { ...d, days: { ...d.days, [key]: { ...dayLog(d, key), ...patch } } };
}

export function setWeight(d: AppData, key: string, kg: number): AppData {
  const weights = d.weights
    .filter((w) => w.date !== key)
    .concat({ date: key, kg })
    .sort((a, b) => a.date.localeCompare(b.date));
  return { ...d, weights };
}

/* ---------- Streaks ---------- */
function activeOn(d: AppData, key: string): boolean {
  const log = d.days[key];
  return (
    d.sessions.some((s) => s.date === key) ||
    d.food.some((f) => f.date === key) ||
    d.weights.some((w) => w.date === key) ||
    (!!log && (log.water > 0 || log.habits.length > 0 || (log.steps ?? 0) > 0))
  );
}

// Days in a row with anything logged.
export function logStreak(d: AppData, today = dateKey()) {
  let key = activeOn(d, today) ? today : addDays(today, -1);
  let n = 0;
  while (activeOn(d, key) && n < 3650) {
    n += 1;
    key = addDays(key, -1);
  }
  return n;
}

// Weeks in a row hitting at least 2 workouts (or 1 if your plan has 1 day).
export function weekStreak(d: AppData, today = dateKey()) {
  const need = Math.max(1, Math.min(2, d.plan?.weekdays.length ?? 2));
  const count = (ws: string) => d.sessions.filter((s) => s.date >= ws && s.date < addDays(ws, 7)).length;
  let ws = weekStart(today);
  if (count(ws) < need) ws = addDays(ws, -7);
  let n = 0;
  while (count(ws) >= need && n < 520) {
    n += 1;
    ws = addDays(ws, -7);
  }
  return n;
}

/* ---------- Badges ---------- */
export function recordCount(d: AppData) {
  let count = 0;
  const best: Record<string, { w: number; r: number; e: number }> = {};
  d.sessions.forEach((s) =>
    s.exercises.forEach((ex) => {
      const done = ex.sets.filter((x) => x.done);
      if (!done.length) return;
      const w = Math.max(...done.map((x) => x.weight));
      const r = Math.max(...done.map((x) => x.reps));
      const e = Math.max(...done.map((x) => e1rm(x.weight, x.reps)));
      const prev = best[ex.id];
      if (prev && (w > prev.w || e > prev.e || (w === 0 && r > prev.r))) count += 1;
      best[ex.id] = { w: Math.max(w, prev?.w ?? 0), r: Math.max(r, prev?.r ?? 0), e: Math.max(e, prev?.e ?? 0) };
    }),
  );
  return count;
}

export type Badge = { name: string; desc: string; earned: boolean; progress: string };

export function badges(p: Profile, d: AppData): Badge[] {
  const t = nutritionTargets(p, d);
  const n = d.sessions.length;
  const logs = Object.values(d.days);
  const waterDays = logs.filter((l) => l.water >= t.water).length;
  const foodDays = new Set(d.food.map((f) => f.date)).size;
  const habitDays = logs.filter((l) => l.habits.length >= 3).length;
  const bigSteps = logs.some((l) => (l.steps ?? 0) >= 10000);
  const planned = d.plan?.weekdays.length ?? 3;
  const perWeek = new Map<string, number>();
  d.sessions.forEach((s) => {
    const w = weekStart(s.date);
    perWeek.set(w, (perWeek.get(w) ?? 0) + 1);
  });
  const fullWeek = [...perWeek.values()].some((c) => c >= planned);
  const prs = recordCount(d);
  const ws = weekStreak(d);
  const b = (name: string, desc: string, have: number, need: number): Badge => ({
    name, desc, earned: have >= need, progress: `${Math.min(have, need)} / ${need}`,
  });
  return [
    b("First step", "Finish your first workout", n, 1),
    b("Getting going", "Finish 5 workouts", n, 5),
    b("Consistent", "Finish 20 workouts", n, 20),
    b("Dedicated", "Finish 50 workouts", n, 50),
    b("Week warrior", "Complete every planned workout in one week", fullWeek ? 1 : 0, 1),
    b("On a roll", "Hit your weekly training target 3 weeks in a row", ws, 3),
    b("New record", "Set your first personal record", prs, 1),
    b("Record breaker", "Set 10 personal records", prs, 10),
    b("Hydrated", "Hit your water goal on 7 days", waterDays, 7),
    b("Food logger", "Log your food on 7 days", foodDays, 7),
    b("Weigh-in habit", "Log your weight 4 times", d.weights.length, 4),
    b("Habit hero", "Tick 3 or more healthy habits on 10 days", habitDays, 10),
    b("10K day", "Walk 10,000 steps in one day", bigSteps ? 1 : 0, 1),
  ];
}

/* ---------- Challenges ---------- */
export type Challenge = { title: string; detail: string; done: boolean; progress: string };
const dayNumber = (key: string) => Math.floor(parseKey(key).getTime() / 86400000);
const cycle = <T,>(list: T[], n: number) => list[((n % list.length) + list.length) % list.length];

export function dailyChallenge(p: Profile, d: AppData, key = dateKey()): Challenge {
  const t = nutritionTargets(p, d);
  const log = dayLog(d, key);
  const meals = new Set(foodOn(d, key).map((f) => f.meal));
  const mainMeals = ["Breakfast", "Lunch", "Dinner"].filter((m) => meals.has(m)).length;
  const habit = (h: string, title: string): Challenge => ({
    title, detail: "Tick it in today's habits when you've done it.", done: log.habits.includes(h), progress: log.habits.includes(h) ? "Done" : "Not yet",
  });
  const list: Challenge[] = [
    { title: "Hit your water goal", detail: `Drink ${t.water} glasses of water today.`, done: log.water >= t.water, progress: `${log.water} / ${t.water} glasses` },
    { title: "Walk 7,000 steps", detail: "Type your steps into today's card.", done: (log.steps ?? 0) >= 7000, progress: `${(log.steps ?? 0).toLocaleString()} / 7,000` },
    { title: "Log your three main meals", detail: "Breakfast, lunch and dinner.", done: mainMeals === 3, progress: `${mainMeals} / 3` },
    habit(HABITS[0], "Stretch for 10 minutes"),
    habit(HABITS[1], "Fruit or vegetables with every meal"),
    habit(HABITS[2], "Take a short walk after a meal"),
    { title: "Sleep 7 hours or more", detail: "Log last night's sleep.", done: (log.sleep ?? 0) >= 7, progress: `${log.sleep ?? 0} / 7 hours` },
  ];
  return cycle(list, dayNumber(key));
}

export function weeklyChallenge(p: Profile, d: AppData, key = dateKey()): Challenge {
  const ws = weekStart(key);
  const we = addDays(ws, 6);
  const t = nutritionTargets(p, d);
  const inWeek = (k: string) => k >= ws && k <= we;
  const planned = d.plan?.weekdays.length ?? 3;
  const sessions = d.sessions.filter((s) => inWeek(s.date)).length;
  const entries = Object.entries(d.days).filter(([k]) => inWeek(k));
  const waterDays = entries.filter(([, l]) => l.water >= t.water).length;
  const steps = entries.reduce((a, [, l]) => a + (l.steps ?? 0), 0);
  const foodDays = new Set(d.food.filter((f) => inWeek(f.date)).map((f) => f.date)).size;
  const weighIns = d.weights.filter((w) => inWeek(w.date)).length;
  const list: Challenge[] = [
    { title: "Complete all your planned workouts", detail: `${planned} workouts this week.`, done: sessions >= planned, progress: `${sessions} / ${planned}` },
    { title: "Hit your water goal on 5 days", detail: "Small sips all day add up.", done: waterDays >= 5, progress: `${waterDays} / 5 days` },
    { title: "Walk 50,000 steps this week", detail: "About 7,000 a day.", done: steps >= 50000, progress: `${steps.toLocaleString()} / 50,000` },
    { title: "Log your food on 5 days", detail: "Awareness is the first step.", done: foodDays >= 5, progress: `${foodDays} / 5 days` },
    { title: "Log your weight twice", detail: "Same time of day, ideally in the morning.", done: weighIns >= 2, progress: `${weighIns} / 2` },
  ];
  return cycle(list, Math.floor(dayNumber(ws) / 7));
}

/* ---------- Reports ---------- */
export type Report = {
  days: number; planned: number; workouts: number; minutes: number; sets: number; volume: number;
  avgSleep: number | null; waterDays: number; foodDays: number; avgKcal: number | null; avgProtein: number | null;
  steps: number; weightChange: number | null; recoveryDays: number;
};

export function report(p: Profile, d: AppData, from: string, to: string): Report {
  const t = nutritionTargets(p, d);
  const today = dateKey();
  const inRange = (k: string) => k >= from && k <= to;
  const sessions = d.sessions.filter((s) => inRange(s.date));
  let days = 0;
  let planned = 0;
  let recoveryDays = 0;
  for (let k = from; k <= to && days < 400; k = addDays(k, 1)) {
    days += 1;
    if (d.plan && d.plan.weekdays.includes(weekdayOf(k))) planned += 1;
    if (k <= today && !d.sessions.some((s) => s.date === k)) recoveryDays += 1;
  }
  const logs = Object.entries(d.days).filter(([k]) => inRange(k)).map(([, l]) => l);
  const sleeps = logs.map((l) => l.sleep).filter((s): s is number => typeof s === "number");
  const foodDates = [...new Set(d.food.filter((f) => inRange(f.date)).map((f) => f.date))];
  const dayTotals = foodDates.map((k) => totalsOf(foodOn(d, k)));
  const weights = d.weights.filter((w) => inRange(w.date));
  return {
    days,
    planned,
    recoveryDays,
    workouts: sessions.length,
    minutes: Math.round(sessions.reduce((a, s) => a + s.seconds, 0) / 60),
    sets: sessions.reduce((a, s) => a + doneSets(s), 0),
    volume: Math.round(sessions.reduce((a, s) => a + sessionVolume(s), 0)),
    avgSleep: sleeps.length ? round1(avg(sleeps)) : null,
    waterDays: logs.filter((l) => l.water >= t.water).length,
    foodDays: foodDates.length,
    avgKcal: dayTotals.length ? Math.round(avg(dayTotals.map((x) => x.kcal))) : null,
    avgProtein: dayTotals.length ? Math.round(avg(dayTotals.map((x) => x.protein))) : null,
    steps: logs.reduce((a, l) => a + (l.steps ?? 0), 0),
    weightChange: weights.length >= 2 ? round1(weights[weights.length - 1].kg - weights[0].kg) : null,
  };
}