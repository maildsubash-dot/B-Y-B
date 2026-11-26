import { useEffect, useState, type ReactNode } from "react";
import type { Gear, Profile } from "./store";
import { DRAFT_KEY, EMPTY_GEAR, WEEK_MON, read, write } from "./store";
import { useBackHandler } from "./nav";
import { Icon } from "./icons";
import GearEditor from "./GearEditor";
import { Chip, Note, inputClass } from "./ui";

/* ==========================================================
   Setup questions, one topic per screen. Also used for
   "Edit my answers" in Profile.
   ========================================================== */

type Opt = string | [string, string];

const BLANK: Profile = {
  name: "", age: "", sex: "", country: "India", units: "metric", heightCm: "", heightFt: "", heightIn: "", weight: "",
  waist: "", chest: "", hips: "", arm: "", thigh: "", goals: [], level: "", trainedBefore: [], history: "",
  pushups: "", cardio: "", place: "", equipment: [], activity: "", shift: "", sleep: "", days: [], minutes: "45", timeOfDay: "",
  diet: "", foodTracking: "", cuisines: [], allergies: [], otherAllergy: "", budget: "", health: [], painAreas: [], healthNote: "", consent: false,
};

const SEXES = ["Male", "Female", "Prefer not to say"];
const GOALS = [
  "Lose weight", "Reduce body fat", "Build muscle", "Improve strength", "Gain healthy weight", "Improve endurance",
  "Improve cardiovascular fitness", "Improve general health", "Improve flexibility", "Improve posture",
];
const LEVELS: Opt[] = [
  ["Absolute beginner", "Never trained, or not for years"],
  ["Beginner", "Less than 6 months of regular training"],
  ["Intermediate", "6 months to 2 years"],
  ["Advanced", "More than 2 years, with good technique"],
  ["Professional athlete", "Training is part of your job"],
];
const TRAINED = ["Gym", "Home workouts", "Running", "Sports", "Yoga", "Swimming", "None"];
const HISTORY = ["Training now", "Stopped less than 6 months ago", "Stopped more than 6 months ago", "Never trained regularly"];
const PUSHUPS = ["0", "1–5", "6–15", "16–30", "More than 30"];
const CARDIO = ["Under 10 min", "10–20 min", "20–40 min", "Over 40 min"];
const PLACES: Opt[] = [
  ["Gym", "Machines, barbells and dumbbells"],
  ["Home", "With some equipment"],
  ["Outdoors", "Park, ground or terrace"],
  ["Bodyweight only", "No equipment at all"],
];
const EQUIPMENT = [
  "Dumbbells", "Resistance bands", "Pull-up bar", "Bench", "Barbell and plates", "Squat rack", "Kettlebell",
  "Skipping rope", "Treadmill or exercise bike", "Park bars or dip bars", "Stairs or steps",
];
const ACTIVITY: Opt[] = [
  ["Mostly sitting", "Desk job, little walking"],
  ["Lightly active", "Some walking most days"],
  ["Active", "On your feet a lot"],
  ["Very active", "Physical job or lots of sport"],
];
const SHIFTS = ["Day", "Night", "Rotating shifts", "Student / not working"];
const SLEEP = ["Under 6 hours", "6–7 hours", "7–8 hours", "Over 8 hours"];
const TIMES = ["Morning", "Afternoon", "Evening", "It varies"];
const MINUTES = ["20", "30", "45", "60", "75", "90"];
const DIETS: Opt[] = [
  ["Vegetarian", "No meat, fish or eggs"],
  ["Eggetarian", "Vegetarian plus eggs"],
  ["Non-vegetarian", "Everything"],
  ["Vegan", "No animal products"],
  ["Jain", "Vegetarian, no root vegetables"],
];
const TRACKING: Opt[] = [
  ["Track calories and macros", "Calories, protein, carbs and fat"],
  ["Protein only", "Just make sure I eat enough protein"],
  ["Keep it simple", "No numbers, just healthy food ideas"],
];
const CUISINES = ["South Indian", "North Indian", "East Indian", "West Indian", "A bit of everything"];
const ALLERGIES = ["Milk / lactose", "Peanuts", "Tree nuts", "Gluten / wheat", "Eggs", "Soy", "Fish", "Shellfish"];
const BUDGETS = ["Budget-friendly", "Moderate", "Flexible"];
const HEALTH = [
  "None of these", "Heart condition", "High blood pressure", "Diabetes", "Asthma",
  "Pregnant or recently gave birth", "Recent surgery", "Joint or bone problems", "Other condition",
];
const PAIN = ["Neck", "Shoulder", "Elbow or wrist", "Upper back", "Lower back", "Hip", "Knee", "Ankle or foot"];
const MEASURES = ["waist", "chest", "hips", "arm", "thigh"] as const;

const ALL_STEPS = ["welcome", "about", "body", "goals", "experience", "check", "place", "weights", "day", "schedule", "food", "health", "review"] as const;
type StepId = (typeof ALL_STEPS)[number];
const META: Record<StepId, [string, string]> = {
  welcome: ["Welcome to BuildYourBody", "A free coach for training, food and habits. Answer a few questions and your plan is ready."],
  about: ["About you", "So we can personalise your plan."],
  body: ["Your body", "Used for food targets and starting weights. Measurements are optional."],
  goals: ["Your goals", "Pick all that apply. Your first pick is your main goal."],
  experience: ["Your experience", "This sets how hard your plan starts."],
  check: ["Quick fitness check", "Be honest; it keeps your first workouts safe."],
  place: ["Where you train", "Your plan only uses equipment you have."],
  weights: ["Your weights", "BYB will only suggest weights you actually own."],
  day: ["Your day", "Helps with food targets and recovery."],
  schedule: ["Your schedule", "Pick the days you can train and how long you have."],
  food: ["Food", "So food suggestions fit you."],
  health: ["Health and safety", "Your plan leaves out exercises that could make these worse."],
  review: ["Check your answers", "Tap any line to change it."],
};

const usesWeights = (p: Profile) =>
  p.place !== "Gym" && p.place !== "Bodyweight only" && (p.equipment.includes("Dumbbells") || p.equipment.includes("Kettlebell"));

function fromDraft(): Profile {
  const d = read<Record<string, unknown>>(DRAFT_KEY) ?? {};
  const out: Record<string, unknown> = { ...BLANK };
  for (const k of Object.keys(BLANK)) {
    if (k in d && Array.isArray(d[k]) === Array.isArray(out[k]) && typeof d[k] === typeof out[k]) out[k] = d[k];
  }
  return out as Profile;
}

function problem(id: StepId, p: Profile, gear: Gear): string {
  const n = (s: string) => Number(s);
  const metric = p.units === "metric";
  switch (id) {
    case "welcome":
      return p.consent ? "" : "Please tick the box to confirm you're 18 or over.";
    case "about":
      if (!p.name.trim()) return "Please enter your name.";
      if (!(n(p.age) >= 18 && n(p.age) <= 100)) return "BYB is for adults aged 18 and over. Please enter your age (18–100).";
      return p.sex ? "" : "Please choose an option for sex.";
    case "body": {
      const h = metric ? n(p.heightCm) : n(p.heightFt) * 30.48 + n(p.heightIn) * 2.54;
      if (!(h >= 120 && h <= 230)) return "Please enter a height between 120 and 230 cm (about 4 ft to 7 ft 6 in).";
      const kg = metric ? n(p.weight) : n(p.weight) / 2.20462;
      return kg >= 30 && kg <= 250 ? "" : `Please enter a weight between ${metric ? "30 and 250 kg" : "66 and 550 lb"}.`;
    }
    case "goals":
      return p.goals.length ? "" : "Pick at least one goal.";
    case "experience":
      return p.level ? "" : "Please choose your level.";
    case "check":
      return p.pushups && p.cardio ? "" : "Please answer both questions.";
    case "place":
      return p.place ? "" : "Please choose where you train.";
    case "weights":
      if (p.equipment.includes("Dumbbells") && !gear.adjustable && !gear.dumbbells.length)
        return "Tap the dumbbell weights you own, or choose Adjustable set.";
      if (gear.adjustable && !(gear.adjustable.max > gear.adjustable.min && gear.adjustable.step > 0))
        return "Your heaviest weight must be more than your lightest.";
      return "";
    case "day":
      return p.activity ? "" : "Please choose how active your day is.";
    case "schedule":
      return p.days.length ? "" : "Pick at least one day.";
    case "food":
      return p.diet ? "" : "Please choose your diet.";
    case "health":
      return p.health.length ? "" : "Pick “None of these” if nothing applies.";
    default:
      return "";
  }
}

/* ---------- Answer controls ---------- */
function Options({ options, value, onPick }: { options: Opt[]; value: string; onPick: (v: string) => void }) {
  return (
    <div className="space-y-2">
      {options.map((o) => {
        const [label, desc] = typeof o === "string" ? [o, ""] : o;
        const on = value === label;
        return (
          <button key={label} type="button" onClick={() => onPick(label)}
            className={`w-full rounded-2xl border p-3.5 text-left transition ${on ? "border-neon bg-neon/10" : "border-white/10 bg-white/5"}`}>
            <span className="flex items-center justify-between gap-2">
              <span className="font-semibold">{label}</span>
              {on && <Icon name="check" size={18} className="text-neon" />}
            </span>
            {desc && <span className="mt-0.5 block text-xs text-white/50">{desc}</span>}
          </button>
        );
      })}
    </div>
  );
}
function OneChips({ options, value, onPick, suffix = "" }: { options: string[]; value: string; onPick: (v: string) => void; suffix?: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => <Chip key={o} label={`${o}${suffix}`} on={value === o} onClick={() => onPick(o)} />)}
    </div>
  );
}
function ManyChips({ options, values, onChange }: { options: string[]; values: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <Chip key={o} label={o} on={values.includes(o)} onClick={() => onChange(values.includes(o) ? values.filter((x) => x !== o) : [...values, o])} />
      ))}
    </div>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm text-white/70">{label}</span>
      {children}
    </label>
  );
}
function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-white/85">{title}</p>
      {children}
    </div>
  );
}

export default function Onboarding({ initial, initialGear, onDone, onCancel }: {
  initial?: Profile; initialGear?: Gear; onDone: (p: Profile, gear: Gear) => void; onCancel?: () => void;
}) {
  const [p, setP] = useState<Profile>(() => initial ?? fromDraft());
  const [gear, setGear] = useState<Gear>(initialGear ?? EMPTY_GEAR);
  const first = initial ? 1 : 0; // editing skips the welcome screen
  const [i, setI] = useState(first);
  const [error, setError] = useState("");
  const steps = ALL_STEPS.filter((s) => s !== "weights" || usesWeights(p));
  const index = Math.min(i, steps.length - 1);
  const id = steps[index];
  const [title, sub] = META[id];
  const metric = p.units === "metric";

  useEffect(() => {
    if (!initial) write(DRAFT_KEY, p);
  }, [p, initial]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [index]);

  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setP((x) => ({ ...x, [k]: v }));
  const back = () => {
    setError("");
    if (index > first) setI(index - 1);
    else onCancel?.();
  };
  useBackHandler(index > first || !!onCancel, back);
  const next = () => {
    const msg = problem(id, p, gear);
    if (msg) {
      setError(msg);
      return;
    }
    setError("");
    if (id === "review") {
      onDone({ ...p, name: p.name.trim(), consent: true }, { ...gear, set: gear.set || usesWeights(p) });
      return;
    }
    setI(index + 1);
  };
  const jump = (s: StepId) => {
    const k = steps.indexOf(s);
    if (k >= 0) {
      setError("");
      setI(k);
    }
  };
  const setHealth = (v: string[]) => {
    const added = v.find((x) => !p.health.includes(x));
    set("health", added === "None of these" ? ["None of these"] : v.filter((x) => x !== "None of these"));
  };
  const num = (s: string) => s.replace(/[^\d.]/g, "");

  const height = metric ? `${p.heightCm} cm` : `${p.heightFt} ft ${p.heightIn || 0} in`;
  const gearText = gear.adjustable ? "Adjustable dumbbells" : gear.dumbbells.length ? `${gear.dumbbells.length} pairs of dumbbells` : "None";
  const rows: [string, string, StepId][] = [
    ["About you", `${p.name}, ${p.age}, ${p.sex}`, "about"],
    ["Body", `${height}, ${p.weight} ${metric ? "kg" : "lb"}`, "body"],
    ["Goals", p.goals.join(", "), "goals"],
    ["Level", p.level, "experience"],
    ["Fitness check", `${p.pushups} push-ups · ${p.cardio}`, "check"],
    ["Where you train", p.equipment.length ? `${p.place}: ${p.equipment.join(", ")}` : p.place, "place"],
    ...(steps.includes("weights") ? ([["Your weights", gearText, "weights"]] as [string, string, StepId][]) : []),
    ["Your day", p.activity, "day"],
    ["Schedule", `${p.days.join(", ")} · ${p.minutes} min`, "schedule"],
    ["Food", [p.diet, p.foodTracking, ...p.cuisines].filter(Boolean).join(", "), "food"],
    ["Health", [...p.health, ...p.painAreas.map((a) => `${a} pain`)].join(", ") || "None", "health"],
  ];

  let body: ReactNode = null;
  switch (id) {
    case "welcome":
      body = (
        <>
          <div className="rounded-3xl border border-neon/30 bg-gradient-to-br from-neon/15 to-white/5 p-5">
            <p className="text-4xl font-black text-neon">BYB</p>
            <ul className="mt-3 space-y-2 text-sm text-white/80">
              <li>• A workout plan built around your goals, schedule and equipment</li>
              <li>• Suggested weights for the dumbbells you own</li>
              <li>• Indian and world foods, with protein-rich suggestions</li>
              <li>• Free, and everything stays on your phone</li>
            </ul>
          </div>
          <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
            <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-[#b6ff3c]" checked={p.consent} onChange={(e) => set("consent", e.target.checked)} />
            <span>I'm 18 or over. I understand BYB gives general fitness information, not medical advice, and I'll check with a doctor if I have a health condition.</span>
          </label>
        </>
      );
      break;
    case "about":
      body = (
        <>
          <Field label="Your name"><input className={inputClass} value={p.name} autoComplete="given-name" onChange={(e) => set("name", e.target.value)} /></Field>
          <Field label="Age"><input className={inputClass} inputMode="numeric" value={p.age} onChange={(e) => set("age", e.target.value.replace(/\D/g, "").slice(0, 3))} /></Field>
          <Group title="Sex"><OneChips options={SEXES} value={p.sex} onPick={(v) => set("sex", v)} /></Group>
          <Field label="Country"><input className={inputClass} value={p.country} onChange={(e) => set("country", e.target.value)} /></Field>
        </>
      );
      break;
    case "body":
      body = (
        <>
          <Group title="Units">
            <div className="flex gap-2">
              <Chip label="cm and kg" on={metric} onClick={() => set("units", "metric")} />
              <Chip label="ft and lb" on={!metric} onClick={() => set("units", "imperial")} />
            </div>
          </Group>
          {metric ? (
            <Field label="Height (cm)"><input className={inputClass} inputMode="decimal" value={p.heightCm} onChange={(e) => set("heightCm", num(e.target.value))} /></Field>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Height (feet)"><input className={inputClass} inputMode="numeric" value={p.heightFt} onChange={(e) => set("heightFt", num(e.target.value))} /></Field>
              <Field label="and inches"><input className={inputClass} inputMode="numeric" value={p.heightIn} onChange={(e) => set("heightIn", num(e.target.value))} /></Field>
            </div>
          )}
          <Field label={`Weight (${metric ? "kg" : "lb"})`}><input className={inputClass} inputMode="decimal" value={p.weight} onChange={(e) => set("weight", num(e.target.value))} /></Field>
          <details className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <summary className="cursor-pointer text-sm font-semibold">Body measurements (optional)</summary>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {MEASURES.map((k) => (
                <Field key={k} label={`${k[0].toUpperCase()}${k.slice(1)} (${metric ? "cm" : "in"})`}>
                  <input className={inputClass} inputMode="decimal" value={p[k]} onChange={(e) => set(k, num(e.target.value))} />
                </Field>
              ))}
            </div>
          </details>
        </>
      );
      break;
    case "goals":
      body = (
        <>
          <ManyChips options={GOALS} values={p.goals} onChange={(v) => set("goals", v)} />
          {p.goals.length > 0 && <Note>Your main goal: <b>{p.goals[0]}</b></Note>}
        </>
      );
      break;
    case "experience":
      body = (
        <>
          <Options options={LEVELS} value={p.level} onPick={(v) => set("level", v)} />
          <Group title="What have you done before? (optional)"><ManyChips options={TRAINED} values={p.trainedBefore} onChange={(v) => set("trainedBefore", v)} /></Group>
          <Group title="Right now (optional)"><OneChips options={HISTORY} value={p.history} onPick={(v) => set("history", v)} /></Group>
        </>
      );
      break;
    case "check":
      body = (
        <>
          <Group title="How many push-ups can you do in a row, from your toes?"><OneChips options={PUSHUPS} value={p.pushups} onPick={(v) => set("pushups", v)} /></Group>
          <Group title="How long can you walk briskly or jog without stopping?"><OneChips options={CARDIO} value={p.cardio} onPick={(v) => set("cardio", v)} /></Group>
        </>
      );
      break;
    case "place":
      body = (
        <>
          <Options options={PLACES} value={p.place}
            onPick={(v) => setP((x) => ({ ...x, place: v, equipment: v === "Bodyweight only" || v === "Gym" ? [] : x.equipment }))} />
          {(p.place === "Home" || p.place === "Outdoors") && (
            <Group title="What equipment do you have?"><ManyChips options={EQUIPMENT} values={p.equipment} onChange={(v) => set("equipment", v)} /></Group>
          )}
        </>
      );
      break;
    case "weights":
      body = (
        <GearEditor gear={gear} onChange={setGear} imperial={!metric}
          dumbbells={p.equipment.includes("Dumbbells")} kettlebells={p.equipment.includes("Kettlebell")} />
      );
      break;
    case "day":
      body = (
        <>
          <Options options={ACTIVITY} value={p.activity} onPick={(v) => set("activity", v)} />
          <Group title="Your work hours (optional)"><OneChips options={SHIFTS} value={p.shift} onPick={(v) => set("shift", v)} /></Group>
          <Group title="How much do you usually sleep? (optional)"><OneChips options={SLEEP} value={p.sleep} onPick={(v) => set("sleep", v)} /></Group>
        </>
      );
      break;
    case "schedule":
      body = (
        <>
          <Group title="Days you can train">
            <ManyChips options={WEEK_MON} values={p.days} onChange={(v) => set("days", WEEK_MON.filter((d) => v.includes(d)))} />
          </Group>
          <Group title="Minutes per workout"><OneChips options={MINUTES} value={p.minutes} onPick={(v) => set("minutes", v)} suffix=" min" /></Group>
          <Group title="Best time to train (optional)"><OneChips options={TIMES} value={p.timeOfDay} onPick={(v) => set("timeOfDay", v)} /></Group>
          <Note>Don't worry about picking too many days. BYB plans rest days for your level and uses the extra days for walking or stretching.</Note>
        </>
      );
      break;
    case "food":
      body = (
        <>
          <Options options={DIETS} value={p.diet} onPick={(v) => set("diet", v)} />
          <Group title="How much detail do you want?"><Options options={TRACKING} value={p.foodTracking} onPick={(v) => set("foodTracking", v)} /></Group>
          <Group title="Food you like (optional)"><ManyChips options={CUISINES} values={p.cuisines} onChange={(v) => set("cuisines", v)} /></Group>
          <Group title="Allergies or intolerances"><ManyChips options={ALLERGIES} values={p.allergies} onChange={(v) => set("allergies", v)} /></Group>
          <Field label="Anything else you avoid? (optional)">
            <input className={inputClass} value={p.otherAllergy} placeholder="For example: mushrooms, brinjal" onChange={(e) => set("otherAllergy", e.target.value)} />
          </Field>
          <Group title="Food budget (optional)"><OneChips options={BUDGETS} value={p.budget} onPick={(v) => set("budget", v)} /></Group>
        </>
      );
      break;
    case "health":
      body = (
        <>
          <Group title="Do any of these apply to you?"><ManyChips options={HEALTH} values={p.health} onChange={setHealth} /></Group>
          {p.health.some((h) => h !== "None of these") && (
            <Note tone="warn">Please get your doctor's OK before starting. BYB will keep your plan gentler.</Note>
          )}
          <Group title="Any pain right now? (optional)"><ManyChips options={PAIN} values={p.painAreas} onChange={(v) => set("painAreas", v)} /></Group>
          <Field label="Anything else we should know? (optional)">
            <textarea className={`${inputClass} min-h-20`} value={p.healthNote} onChange={(e) => set("healthNote", e.target.value)} />
          </Field>
        </>
      );
      break;
    case "review":
      body = (
        <div className="space-y-2">
          {rows.map(([label, value, step]) => (
            <button key={label} type="button" onClick={() => jump(step)}
              className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-left">
              <span className="min-w-0 flex-1">
                <span className="block text-xs text-white/50">{label}</span>
                <span className="block truncate text-sm">{value || "—"}</span>
              </span>
              <Icon name="edit" size={16} className="text-white/40" />
            </button>
          ))}
        </div>
      );
      break;
  }

  return (
    <div className="min-h-dvh bg-[#0a0a0a] text-white">
      <div className="mx-auto max-w-md px-4 pb-36">
        <div className="sticky top-0 z-20 -mx-4 bg-[#0a0a0a]/95 px-4 pb-3 pt-3 backdrop-blur">
          <div className="flex items-center gap-2">
            {(index > first || onCancel) && (
              <button type="button" aria-label="Back" onClick={back} className="rounded-full p-1.5 text-white/80">
                <Icon name="back" />
              </button>
            )}
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-neon transition-all" style={{ width: `${((index + 1) / steps.length) * 100}%` }} />
            </div>
            <span className="text-xs text-white/50">{index + 1}/{steps.length}</span>
          </div>
        </div>
        <h1 className="mt-4 text-2xl font-bold">{title}</h1>
        <p className="mt-1 text-sm text-white/55">{sub}</p>
        <div className="mt-5 space-y-5">{body}</div>
        {error && <Note tone="warn">{error}</Note>}
      </div>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[#0a0a0a]/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-md">
          <button type="button" onClick={next} className="w-full rounded-2xl bg-neon py-3.5 font-bold text-black active:scale-[0.99]">
            {id === "review" ? (initial ? "Save changes" : "Create my plan") : id === "welcome" ? "Let's start" : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}