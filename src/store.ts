import { useEffect, useState } from "react";

/* ===== Types ===== */
// Profile saved by Onboarding.tsx
export type Profile = {
  name: string; age: string; sex: string; country: string; units: "metric" | "imperial";
  heightCm: string; heightFt: string; heightIn: string; weight: string;
  waist: string; chest: string; hips: string; arm: string; thigh: string;
  goals: string[]; level: string; trainedBefore: string[]; history: string;
  pushups: string; cardio: string; place: string; equipment: string[];
  activity: string; shift: string; sleep: string; days: string[]; minutes: string; timeOfDay: string;
  diet: string; foodTracking: string; cuisines: string[]; allergies: string[]; otherAllergy: string; budget: string;
  health: string[]; painAreas: string[]; healthNote: string; consent: boolean;
};

export type SetLog = { reps: number; weight: number; done: boolean }; // weight always saved in kg
export type ExerciseLog = { id: string; sets: SetLog[]; skipped: boolean };
export type Session = { id: string; date: string; title: string; seconds: number; effort: string; exercises: ExerciseLog[] };
export type PlanExercise = { id: string; sets: number; reps: string; rest: number };
export type PlanDay = { title: string; focus: string; exercises: PlanExercise[] };
export type Plan = { choice: string; split: string; minutes: number; weekdays: string[]; days: PlanDay[]; why: string[]; seed: number };
export type Food = {
  name: string; serving: string; kcal: number; protein: number; carbs: number; fat: number; fibre: number;
  diet: "vegan" | "veg" | "egg" | "nonveg"; meals: string; region: string; jain: boolean; cost: number; allergens: string[];
};
export type FoodEntry = {
  id: string; date: string; meal: string; name: string; qty: number;
  kcal: number; protein: number; carbs: number; fat: number; fibre: number;
};
export type DayLog = { water: number; sleep?: number; steps?: number; feel?: string; habits: string[] };
export type WeightEntry = { date: string; kg: number };
export type MeasureEntry = { date: string; waist?: number; chest?: number; hips?: number; arm?: number; thigh?: number }; // cm
export type ChatMsg = { role: "user" | "coach"; text: string };
export type Routine = { name: string; plan: Plan };

export type AppData = {
  plan: Plan | null; sessions: Session[]; food: FoodEntry[]; customFoods: Food[];
  days: Record<string, DayLog>; weights: WeightEntry[]; measures: MeasureEntry[];
  favourites: string[]; routines: Routine[]; chat: ChatMsg[];
};

export type Tab = "home" | "train" | "library" | "food" | "coach" | "progress" | "me";
export type SetData = (fn: (d: AppData) => AppData) => void;
export type PageProps = { profile: Profile; data: AppData; setData: SetData; go: (tab: Tab) => void };

/* ===== Saving on this device ===== */
export const PROFILE_KEY = "byb-profile-v2";
export const DRAFT_KEY = "byb-draft-v2";
const DATA_KEY = "byb-data-v1";

export const EMPTY_DATA: AppData = {
  plan: null, sessions: [], food: [], customFoods: [], days: {}, weights: [], measures: [],
  favourites: [], routines: [], chat: [],
};

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
export function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked */
  }
}
export function remove(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
export const loadProfile = () => read<Profile>(PROFILE_KEY);
export const clearAll = () => [PROFILE_KEY, DRAFT_KEY, DATA_KEY].forEach(remove);

export function useAppData() {
  const [data, setData] = useState<AppData>(() => ({ ...EMPTY_DATA, ...(read<Partial<AppData>>(DATA_KEY) ?? {}) }));
  useEffect(() => write(DATA_KEY, data), [data]);
  return [data, setData] as const;
}

/* ===== Dates (saved as YYYY-MM-DD) ===== */
export const WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const WEEK_MON = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const pad = (n: number) => String(n).padStart(2, "0");
export const dateKey = (d: Date = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export function parseKey(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}
export function addDays(key: string, n: number) {
  const d = parseKey(key);
  d.setDate(d.getDate() + n);
  return dateKey(d);
}
export const weekdayOf = (key: string) => WEEK[parseKey(key).getDay()];
export const weekStart = (key: string) => addDays(key, -((parseKey(key).getDay() + 6) % 7));
export const prettyDate = (key: string) =>
  parseKey(key).toLocaleDateString(undefined, { day: "numeric", month: "short" });
export const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
export const dayLog = (data: AppData, key: string): DayLog => data.days[key] ?? { water: 0, habits: [] };