import { useEffect, useState, type ReactNode } from "react";

/* ==========================================================
   BuildYourBody (BYB) - onboarding and fitness profile
   Answers are saved only on this device (localStorage).
   ========================================================== */

/* ---------- Screens ---------- */
const S_WELCOME = 0;
const S_ABOUT = 1;
const S_BODY = 2;
const S_GOALS = 3;
const S_EXPERIENCE = 4;
const S_CHECK = 5;
const S_PLACE = 6;
const S_DAY = 7;
const S_SCHEDULE = 8;
const S_FOOD = 9;
const S_HEALTH = 10;
const S_REVIEW = 11;

const STEP_TITLES = [
  "Welcome",
  "About you",
  "Your body",
  "Your goals",
  "Your experience",
  "Quick fitness check",
  "Where you train",
  "Your day",
  "Your schedule",
  "Your food",
  "Health and safety",
  "Check your answers",
];

const STEP_SUBTITLES = [
  "",
  "The basics, so BYB can talk to you properly.",
  "Your starting point. Only you can see this.",
  "Pick up to 3.",
  "So we start you at the right level.",
  "Be honest. There are no wrong answers.",
  "We'll only pick exercises you can actually do.",
  "Your daily routine affects your energy and recovery.",
  "When can you train?",
  "So food tips match what you actually eat.",
  "Optional, but it helps keep your training safe. BYB never diagnoses conditions.",
  "Tap Edit to change anything.",
];

/* ---------- Profile ---------- */
type Units = "metric" | "imperial";
type MeasureKey = "waist" | "chest" | "hips" | "arm" | "thigh";

type Profile = {
  name: string;
  age: string;
  sex: string;
  country: string;
  units: Units;
  heightCm: string;
  heightFt: string;
  heightIn: string;
  weight: string;
  waist: string;
  chest: string;
  hips: string;
  arm: string;
  thigh: string;
  goals: string[];
  level: string;
  trainedBefore: string[];
  history: string;
  pushups: string;
  cardio: string;
  place: string;
  equipment: string[];
  activity: string;
  shift: string;
  sleep: string;
  days: string[];
  minutes: string;
  timeOfDay: string;
  diet: string;
  foodTracking: string;
  cuisines: string[];
  allergies: string[];
  otherAllergy: string;
  budget: string;
  health: string[];
  painAreas: string[];
  healthNote: string;
  consent: boolean;
};

const EMPTY: Profile = {
  name: "", age: "", sex: "", country: "India",
  units: "metric", heightCm: "", heightFt: "", heightIn: "", weight: "",
  waist: "", chest: "", hips: "", arm: "", thigh: "",
  goals: [],
  level: "", trainedBefore: [], history: "",
  pushups: "", cardio: "",
  place: "", equipment: [],
  activity: "", shift: "", sleep: "",
  days: [], minutes: "", timeOfDay: "",
  diet: "", foodTracking: "", cuisines: [], allergies: [], otherAllergy: "", budget: "",
  health: [], painAreas: [], healthNote: "",
  consent: false,
};

const PROFILE_KEY = "byb-profile-v2";
const DRAFT_KEY = "byb-draft-v2";

/* ---------- Answer options ---------- */
type Option = { label: string; sub?: string };

const SEXES = ["Male", "Female", "Prefer not to say"];
const COUNTRIES = [
  "India", "Sri Lanka", "Bangladesh", "Nepal", "Pakistan", "United Arab Emirates",
  "Saudi Arabia", "Qatar", "Singapore", "Malaysia", "United Kingdom",
  "United States", "Canada", "Australia", "Other",
];
const MEASURE_FIELDS: [MeasureKey, string][] = [
  ["waist", "Waist"],
  ["chest", "Chest"],
  ["hips", "Hips"],
  ["arm", "Upper arm"],
  ["thigh", "Thigh"],
];

const GOALS = [
  "Lose weight", "Reduce body fat", "Build muscle", "Gain healthy weight",
  "Improve strength", "Improve endurance", "Improve cardiovascular fitness",
  "Improve flexibility", "Maintain current fitness", "Improve general health",
];
const OPPOSITE_GOAL: Record<string, string> = {
  "Lose weight": "Gain healthy weight",
  "Gain healthy weight": "Lose weight",
};
const MAX_GOALS = 3;

const LEVELS: Option[] = [
  { label: "Absolute beginner", sub: "I've never exercised regularly" },
  { label: "Beginner", sub: "Less than 6 months of regular training" },
  { label: "Intermediate", sub: "6 months to 2 years of regular training" },
  { label: "Advanced", sub: "2+ years, confident with most exercises" },
  { label: "Professional athlete", sub: "I train or compete at a high level" },
];
const LEVEL_RANK: Record<string, number> = {
  "Absolute beginner": 0, Beginner: 1, Intermediate: 2, Advanced: 3, "Professional athlete": 4,
};
const MAX_DAYS = [3, 4, 5, 6, 6]; // most training days per week for each level

const NOTHING_YET = "Nothing yet";
const TRAINED_BEFORE = [
  "Gym / weights", "Home workouts", "Running or walking", "Sports",
  "Yoga", "Swimming or cycling", "Dance or aerobics", NOTHING_YET,
];

const PUSHUPS = ["0", "1–5", "6–15", "16–30", "More than 30", "Not sure"];
const CARDIO = ["Under 10 min", "10–20 min", "20–40 min", "More than 40 min", "Not sure"];

const PLACES: Option[] = [
  { label: "Gym", sub: "Commercial gym with machines and weights" },
  { label: "Home", sub: "At home or in a home gym" },
  { label: "Outdoors", sub: "Park, ground or terrace" },
  { label: "Bodyweight only", sub: "No equipment, anywhere" },
];
const NO_KIT = "Nothing, just my body";
const EQUIPMENT = [
  NO_KIT, "Dumbbells", "Resistance bands", "Pull-up bar", "Bench",
  "Barbell and plates", "Squat rack", "Kettlebell", "Skipping rope", "Yoga mat",
  "Treadmill or exercise bike", "Park bars or dip bars", "Stairs or steps",
];

const ACTIVITY: Option[] = [
  { label: "Mostly sitting", sub: "Desk job, studying, driving" },
  { label: "Lightly active", sub: "Some walking, teaching, shop work" },
  { label: "Active", sub: "On your feet most of the day" },
  { label: "Very active", sub: "Physical work like building or farming" },
];
const SHIFTS = ["Regular day hours", "Night or rotating shifts", "Flexible / not working"];
const SLEEP = ["Less than 5 hours", "5–6 hours", "6–7 hours", "7–8 hours", "More than 8 hours"];

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MINUTES = ["15", "20", "30", "45", "60", "90"];
const TIMES = ["Early morning", "Morning", "Afternoon", "Evening", "Night", "It varies"];

const DIETS = ["Vegetarian", "Eggetarian", "Non-vegetarian", "Vegan", "Jain"];
const FOOD_TRACKING: Option[] = [
  { label: "Show calories and protein", sub: "Numbers for each meal" },
  { label: "Keep it simple", sub: "Healthy-eating tips, no calorie counting" },
];
const CUISINES = [
  "South Indian", "North Indian", "East Indian", "West Indian",
  "Continental", "Chinese / Asian", "A bit of everything",
];
const ALLERGIES = [
  "Milk / lactose", "Peanuts", "Tree nuts", "Gluten / wheat",
  "Eggs", "Soy", "Fish", "Shellfish",
];
const BUDGETS = ["Budget-friendly", "Moderate", "Flexible"];

const NONE_HEALTH = "None of these";
const CHEST = "Chest pain, dizziness or fainting during activity";
const HEALTH = [
  "Heart condition or high blood pressure",
  CHEST,
  "Diabetes",
  "Asthma or breathing problems",
  "Pregnant or gave birth in the last 6 months",
  "Surgery or serious injury in the last 6 months",
  "Medicine that a doctor said affects exercise",
  "Other long-term condition",
  NONE_HEALTH,
];
const PAIN_AREAS = [
  "Neck", "Shoulder", "Elbow or wrist", "Upper back",
  "Lower back", "Hip", "Knee", "Ankle or foot",
];

/* ---------- Saving on the device ---------- */
function loadJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function saveJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage not available */
  }
}
function removeKey(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* storage not available */
  }
}
function loadProfile(): Profile | null {
  const s = loadJSON<Partial<Profile>>(PROFILE_KEY);
  return s ? { ...EMPTY, ...s } : null;
}
function loadDraft(): { p: Profile; step: number } {
  const d = loadJSON<{ p?: Partial<Profile>; step?: number }>(DRAFT_KEY);
  const step = typeof d?.step === "number" ? Math.min(Math.max(d.step, 0), S_REVIEW) : 0;
  return { p: { ...EMPTY, ...(d?.p ?? {}) }, step };
}

/* ---------- Small helpers ---------- */
const LB_PER_KG = 2.20462;
const CM_PER_IN = 2.54;
const num = (s: string) => (s.trim() === "" ? NaN : Number(s));
const fmt = (n: number, dp = 0) => (Number.isFinite(n) ? String(Number(n.toFixed(dp))) : "");
const listText = (items: string[], none = "None") => (items.length ? items.join(", ") : none);
const orDash = (s: string) => (s.trim() ? s : "—");

function toggle(list: string[], item: string) {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}
// For lists with a "none" option that can't be combined with others.
function toggleExclusive(list: string[], item: string, exclusive: string) {
  if (item === exclusive) return list.includes(item) ? [] : [item];
  return toggle(list.filter((x) => x !== exclusive), item);
}

function heightCmOf(p: Profile) {
  if (p.units === "metric") return num(p.heightCm);
  const ft = num(p.heightFt);
  const inch = num(p.heightIn);
  return ((Number.isFinite(ft) ? ft : 0) * 12 + (Number.isFinite(inch) ? inch : 0)) * CM_PER_IN;
}
function weightKgOf(p: Profile) {
  const w = num(p.weight);
  return p.units === "metric" ? w : w / LB_PER_KG;
}

// Switching kg/cm <-> lb/ft converts what was already typed.
function convertUnits(p: Profile, to: Units): Profile {
  if (p.units === to) return p;
  const out: Profile = { ...p, units: to };
  for (const [key] of MEASURE_FIELDS) {
    const v = num(p[key]);
    out[key] = fmt(to === "imperial" ? v / CM_PER_IN : v * CM_PER_IN, 1);
  }
  if (to === "imperial") {
    const totalIn = num(p.heightCm) / CM_PER_IN;
    if (Number.isFinite(totalIn)) {
      let ft = Math.floor(totalIn / 12);
      let inch = Math.round(totalIn - ft * 12);
      if (inch === 12) {
        ft += 1;
        inch = 0;
      }
      out.heightFt = String(ft);
      out.heightIn = String(inch);
    } else {
      out.heightFt = "";
      out.heightIn = "";
    }
    out.weight = fmt(num(p.weight) * LB_PER_KG, 1);
  } else {
    const cm = heightCmOf(p);
    out.heightCm = cm > 0 ? fmt(cm) : "";
    out.weight = fmt(num(p.weight) / LB_PER_KG, 1);
  }
  return out;
}

function heightText(p: Profile) {
  return p.units === "metric" ? `${p.heightCm} cm` : `${p.heightFt || 0} ft ${p.heightIn || 0} in`;
}
function weightText(p: Profile) {
  return `${p.weight} ${p.units === "metric" ? "kg" : "lb"}`;
}
function measurementsText(p: Profile) {
  const u = p.units === "metric" ? "cm" : "in";
  const parts = MEASURE_FIELDS.filter(([k]) => p[k].trim() !== "").map(([k, label]) => `${label} ${p[k]} ${u}`);
  return listText(parts, "Not added");
}
function equipmentText(p: Profile) {
  if (p.place === "Gym") return "Full gym";
  if (p.place === "Bodyweight only") return "None (bodyweight)";
  return listText(p.equipment);
}
function allergiesText(p: Profile) {
  const other = p.otherAllergy.trim();
  return listText(other ? [...p.allergies, other] : p.allergies);
}
const hasHealthFlag = (p: Profile) => p.health.some((h) => h !== NONE_HEALTH);
const rankOf = (level: string) => (level in LEVEL_RANK ? LEVEL_RANK[level] : 0);

function ageGroup(age: number) {
  if (age < 30) return "18–29";
  if (age < 45) return "30–44";
  if (age < 60) return "45–59";
  return "60+";
}

/* ---------- Starting training style (rule-based, explained) ---------- */
type Plan = { split: string; days: number; style: string; cardio: string; mobility: string; why: string[] };

function recommend(p: Profile): Plan {
  const rank = rankOf(p.level);
  const picked = p.days.length;
  const medical = hasHealthFlag(p);
  const maxDays = medical ? Math.min(MAX_DAYS[rank], 3) : MAX_DAYS[rank];
  const days = Math.max(1, Math.min(picked, maxDays));
  const bodyweight = p.place === "Bodyweight only" || p.equipment.includes(NO_KIT);
  const main = p.goals[0] ?? "";
  const why: string[] = [];

  let split = "Full body";
  if (days <= 3) {
    why.push(`With ${days} training day${days === 1 ? "" : "s"} a week, working your whole body each session trains every muscle often enough to improve.`);
  } else if (days === 4) {
    split = "Upper / lower";
    why.push("Four days fits an upper-body / lower-body split, so each muscle is trained twice a week with time to recover.");
  } else {
    split = "Push / pull / legs";
    why.push(`${days} days suits push / pull / legs, which spreads the work so each muscle group gets time to recover.`);
  }
  if (bodyweight) split += " (bodyweight)";

  if (picked > days) why.push(`You picked ${picked} days. We'll train on ${days} and keep the rest for recovery or light walking.`);
  if (medical) why.push("Because of your health answers, we're starting gently. Please check with a doctor first.");
  if (rank <= 1) why.push("As you're starting out, we'll focus on good technique with light loads before adding weight.");
  if (p.pushups === PUSHUPS[0] || p.pushups === PUSHUPS[1]) why.push("We'll begin with easier versions of moves, like wall or knee push-ups, and build up.");
  if (p.cardio === CARDIO[0]) why.push("Cardio will start with short walks and build up slowly.");
  if (p.sleep === SLEEP[0] || p.sleep === SLEEP[1]) why.push("Short sleep slows recovery, so we'll keep the workload moderate.");
  if (num(p.minutes) <= 20) why.push("With short sessions, we'll pair exercises back to back to save time.");

  let style = "Balanced: 8–12 reps, 60–90 sec rest";
  if (main === "Improve strength") {
    style = rank <= 1 ? "Strength basics: 6–10 reps with good technique, 2 min rest" : "Strength: 3–6 reps on main lifts, 2–3 min rest";
  } else if (main === "Build muscle" || main === "Gain healthy weight") {
    style = "Muscle building: 8–12 reps, 60–120 sec rest";
  } else if (main === "Lose weight" || main === "Reduce body fat") {
    style = "Strength training to keep muscle: 10–15 reps, shorter rests";
    why.push("For fat loss, food matters most. Strength training helps you keep muscle while you lose fat.");
  } else if (main === "Improve endurance" || main === "Improve cardiovascular fitness") {
    style = "Endurance: 12–20 reps and circuits";
  } else if (main === "Improve flexibility") {
    style = "Mobility focus: slow, controlled reps through full range";
  }

  const cardioGoals = ["Lose weight", "Reduce body fat", "Improve endurance", "Improve cardiovascular fitness", "Improve general health"];
  const cardio = p.goals.some((g) => cardioGoals.includes(g)) ? "2–3 short sessions a week, plus daily walking" : "Optional light cardio for heart health";
  const mobility = p.goals.includes("Improve flexibility") ? "Stretching and mobility every session" : "Warm-up and cool-down each session";

  return { split, days, style, cardio, mobility, why };
}

/* ---------- Answer summary (used on review and profile) ---------- */
type Section = { title: string; step: number; rows: [string, string][] };

function summary(p: Profile): Section[] {
  return [
    { title: "About you", step: S_ABOUT, rows: [["Name", p.name], ["Age", p.age], ["Sex", orDash(p.sex)], ["Country", p.country]] },
    { title: "Your body", step: S_BODY, rows: [["Height", heightText(p)], ["Weight", weightText(p)], ["Measurements", measurementsText(p)]] },
    { title: "Goals", step: S_GOALS, rows: [["Main goal", p.goals[0] ?? "—"], ["Other goals", listText(p.goals.slice(1))]] },
    { title: "Experience", step: S_EXPERIENCE, rows: [["Level", p.level], ["Done before", listText(p.trainedBefore)], ["Notes", orDash(p.history)]] },
    { title: "Fitness check", step: S_CHECK, rows: [["Push-ups in a row", p.pushups], ["Walk or jog non-stop", p.cardio]] },
    { title: "Where you train", step: S_PLACE, rows: [["Place", p.place], ["Equipment", equipmentText(p)]] },
    { title: "Your day", step: S_DAY, rows: [["Daily activity", p.activity], ["Work hours", orDash(p.shift)], ["Sleep", p.sleep]] },
    { title: "Schedule", step: S_SCHEDULE, rows: [["Days", listText(p.days)], ["Workout length", `${p.minutes} min`], ["Preferred time", p.timeOfDay]] },
    {
      title: "Food",
      step: S_FOOD,
      rows: [
        ["Diet", p.diet],
        ["Food tracking", p.foodTracking],
        ["Usually eat", listText(p.cuisines, "Not set")],
        ["Allergies / avoid", allergiesText(p)],
        ["Budget", orDash(p.budget)],
      ],
    },
    {
      title: "Health and safety",
      step: S_HEALTH,
      rows: [["Health", listText(p.health, "Skipped")], ["Pain or injury areas", listText(p.painAreas)], ["Notes", orDash(p.healthNote)]],
    },
  ];
}

/* ---------- UI pieces ---------- */
const inputClass =
  "w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white placeholder:text-white/30 outline-none focus:border-neon";

function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[#0d0d0d] text-white">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 pt-8">{children}</div>
    </main>
  );
}

function Logo() {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-3xl font-black tracking-tight text-neon">BYB</span>
      <span className="text-xs uppercase tracking-widest text-white/50">BuildYourBody</span>
    </div>
  );
}

function Chip({
  label,
  sub,
  on,
  onClick,
  disabled = false,
  badge,
}: {
  label: string;
  sub?: string;
  on: boolean;
  onClick: () => void;
  disabled?: boolean;
  badge?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-xl border px-4 py-3 text-left transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-30 ${
        on ? "border-neon bg-neon text-black" : "border-white/15 bg-white/5 text-white hover:border-white/40"
      }`}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">{label}</span>
        {badge && (
          <span className="shrink-0 rounded-full bg-black px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-neon">
            {badge}
          </span>
        )}
      </span>
      {sub && <span className={`mt-0.5 block text-xs ${on ? "text-black/70" : "text-white/50"}`}>{sub}</span>}
    </button>
  );
}

function Group({
  title,
  optional,
  note,
  cols = 2,
  children,
}: {
  title?: string;
  optional?: boolean;
  note?: string;
  cols?: 1 | 2 | 3 | 4;
  children: ReactNode;
}) {
  const grid = { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4" }[cols];
  return (
    <div className="mt-6">
      {title && (
        <p className="text-sm font-medium text-white/80">
          {title}
          {optional && <span className="font-normal text-white/40"> (optional)</span>}
        </p>
      )}
      {note && <p className="mt-1 text-xs text-white/45">{note}</p>}
      <div className={`mt-3 grid gap-2 ${grid}`}>{children}</div>
    </div>
  );
}

function Field({ label, optional, children }: { label: string; optional?: boolean; children: ReactNode }) {
  return (
    <label className="mt-6 block">
      <span className="mb-2 block text-sm font-medium text-white/80">
        {label}
        {optional && <span className="font-normal text-white/40"> (optional)</span>}
      </span>
      {children}
    </label>
  );
}

function Note({ tone = "info", children }: { tone?: "info" | "warn" | "alert"; children: ReactNode }) {
  const styles = {
    info: "border-white/15 bg-white/5 text-white/70",
    warn: "border-yellow-400/40 bg-yellow-400/10 text-yellow-100",
    alert: "border-red-400/50 bg-red-400/10 text-red-100",
  }[tone];
  return <p className={`mt-4 rounded-xl border p-3 text-sm ${styles}`}>{children}</p>;
}

function Rows({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="divide-y divide-white/10">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-4 py-2.5 text-sm">
          <dt className="text-white/50">{k}</dt>
          <dd className="text-right">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-neon">{title}</h2>
      {children}
    </section>
  );
}

/* ---------- Welcome screen ---------- */
function WelcomeScreen() {
  return (
    <section className="flex flex-1 flex-col justify-center py-10">
      <Logo />
      <h1 className="mt-8 text-4xl font-black leading-tight">
        Your body. Your goals.
        <span className="block text-neon">Your plan.</span>
      </h1>
      <p className="mt-4 text-white/70">
        Answer a few quick questions and BYB will shape your training around your body, goals, equipment and time.
      </p>
      <ul className="mt-6 space-y-2 text-sm text-white/60">
        <li>✓ Takes about 3 minutes</li>
        <li>✓ Skip anything marked optional</li>
        <li>✓ Free, no account needed</li>
        <li>✓ Your answers stay on this device</li>
      </ul>
    </section>
  );
}

/* ---------- Profile screen (after onboarding) ---------- */
function ProfileScreen({ profile, onEdit, onDelete }: { profile: Profile; onEdit: () => void; onDelete: () => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const plan = recommend(profile);
  const chest = profile.health.includes(CHEST);
  const flagged = hasHealthFlag(profile);

  const profileRows: [string, string][] = [
    ["Age group", ageGroup(num(profile.age))],
    ["Experience", profile.level],
    ["Main goal", profile.goals[0] ?? "—"],
    ["Other goals", listText(profile.goals.slice(1))],
    ["Training place", profile.place],
    ["Equipment", equipmentText(profile)],
    ["Daily activity", profile.activity],
    ["Training frequency", `${plan.days} day${plan.days === 1 ? "" : "s"} a week`],
    ["Diet", profile.diet],
  ];

  const planRows: [string, string][] = [
    ["Split", plan.split],
    ["Session length", `${profile.minutes} min`],
    ["Training style", plan.style],
    ["Cardio", plan.cardio],
    ["Mobility", plan.mobility],
  ];

  return (
    <Shell>
      <Logo />
      <h1 className="mt-8 text-3xl font-bold leading-tight">You're all set, {profile.name}</h1>
      <p className="mt-2 text-white/60">Here's your fitness profile and the training style BYB will start you with.</p>

      {chest && (
        <Note tone="alert">
          You told us you get chest pain, dizziness or fainting during activity. Please see a doctor before starting any
          exercise. If this is happening right now, get medical help immediately.
        </Note>
      )}
      {flagged && !chest && (
        <Note tone="warn">
          Because of your health answers, please check with a doctor before starting a new exercise programme. BYB gives
          general fitness information, not medical advice.
        </Note>
      )}
      {profile.painAreas.length > 0 && (
        <Note>
          We'll avoid exercises that strain your {profile.painAreas.join(", ").toLowerCase()}. Stop any exercise that
          causes pain.
        </Note>
      )}

      <Card title="Your fitness profile">
        <Rows rows={profileRows} />
      </Card>

      <Card title="Your starting training style">
        <Rows rows={planRows} />
        <p className="mt-4 text-sm font-semibold">Why this suits you</p>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-white/70">
          {plan.why.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-white/45">Your full day-by-day workout plan is the next feature being added to BYB.</p>
      </Card>

      <details className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
        <summary className="cursor-pointer text-sm font-semibold">See all your answers</summary>
        {summary(profile).map((s) => (
          <div key={s.title} className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-neon">{s.title}</p>
            <Rows rows={s.rows} />
          </div>
        ))}
      </details>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <button type="button" onClick={onEdit} className="rounded-xl border border-white/20 px-4 py-3 font-semibold">
          Edit answers
        </button>
        {confirmDelete ? (
          <button type="button" onClick={onDelete} className="rounded-xl bg-red-500 px-4 py-3 font-semibold text-white">
            Tap again to delete
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="rounded-xl border border-red-400/40 px-4 py-3 font-semibold text-red-300"
          >
            Delete my data
          </button>
        )}
      </div>
      <p className="mt-4 pb-10 text-xs text-white/40">
        Your answers are saved only on this device. BYB gives general fitness information and does not replace advice
        from a doctor.
      </p>
    </Shell>
  );
}

/* ---------- Main app ---------- */
export default function Onboarding({ onDone }: { onDone: () => void }) {
  const [saved, setSaved] = useState<Profile | null>(loadProfile);
  const [p, setP] = useState<Profile>(() => loadDraft().p);
  const [step, setStep] = useState<number>(() => loadDraft().step);
  const [fromReview, setFromReview] = useState(false);

  // Save progress as the person goes, so they can close the app and come back.
  useEffect(() => {
    if (!saved) saveJSON(DRAFT_KEY, { p, step });
  }, [p, step, saved]);

  // Start each screen at the top.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step, saved]);

  const set = (patch: Partial<Profile>) => setP((prev) => ({ ...prev, ...patch }));
  const setMeasure = (key: MeasureKey, value: string) =>
    setP((prev) => {
      const next = { ...prev };
      next[key] = value;
      return next;
    });

  const finish = () => {
    saveJSON(PROFILE_KEY, p);
    removeKey(DRAFT_KEY);
    setFromReview(false);
    setSaved(p);
    onDone();
  };

  const editProfile = () => {
    if (!saved) return;
    setP(saved);
    setStep(S_REVIEW);
    setSaved(null);
  };

  const deleteAll = () => {
    removeKey(PROFILE_KEY);
    removeKey(DRAFT_KEY);
    setP(EMPTY);
    setStep(S_WELCOME);
    setFromReview(false);
    setSaved(null);
  };

  if (saved) return <ProfileScreen profile={saved} onEdit={editProfile} onDelete={deleteAll} />;

  /* ----- Values used for checking answers ----- */
  const age = num(p.age);
  const hcm = heightCmOf(p);
  const wkg = weightKgOf(p);
  const needsKit = p.place === "Home" || p.place === "Outdoors";
  const maxDays = p.level in LEVEL_RANK ? MAX_DAYS[LEVEL_RANK[p.level]] : 7;
  const healthFlag = hasHealthFlag(p);
  const chestFlag = p.health.includes(CHEST);
  const mu = p.units === "metric" ? "cm" : "in";
  const wu = p.units === "metric" ? "kg" : "lb";
  const bodyFilled = (p.units === "metric" ? p.heightCm : p.heightFt) !== "" && p.weight !== "";

  const valid = [
    true,
    p.name.trim() !== "" && age >= 18 && age <= 100,
    hcm >= 100 && hcm <= 250 && wkg >= 30 && wkg <= 300,
    p.goals.length > 0,
    p.level !== "" && p.trainedBefore.length > 0,
    p.pushups !== "" && p.cardio !== "",
    p.place !== "" && (!needsKit || p.equipment.length > 0),
    p.activity !== "" && p.sleep !== "",
    p.days.length > 0 && p.minutes !== "" && p.timeOfDay !== "",
    p.diet !== "" && p.foodTracking !== "",
    true,
    p.consent,
  ];

  const hints = [
    "",
    p.name.trim() === "" ? "Enter your name." : age > 0 && age < 18 ? "BYB is for people 18 and over." : "Enter your age (18–100).",
    bodyFilled ? "Please check your height and weight. They look outside the normal range." : "Enter your height and weight.",
    "Pick at least one goal.",
    "Choose your level and what you've done before.",
    "Answer both questions. Not sure is fine.",
    p.place === "" ? "Pick where you train." : "Pick the equipment you have, or Nothing, just my body.",
    "Choose your typical day and how much you sleep.",
    "Pick your days, workout length and preferred time.",
    "Choose your diet and how you'd like food tracking.",
    "",
    "Tick the box to agree before finishing.",
  ];

  const healthEmpty = p.health.length === 0 && p.painAreas.length === 0 && p.healthNote.trim() === "";
  let nextLabel = "Next";
  if (step === S_WELCOME) nextLabel = "Let's start";
  else if (step === S_REVIEW) nextLabel = "Finish";
  else if (fromReview) nextLabel = "Save and review";
  else if (step === S_HEALTH && healthEmpty) nextLabel = "Skip for now";

  const goNext = () => {
    if (!valid[step]) return;
    if (step === S_REVIEW) {
      finish();
      return;
    }
    if (fromReview) {
      setFromReview(false);
      setStep(S_REVIEW);
      return;
    }
    setStep(step + 1);
  };

  const pickGoal = (g: string) => {
    if (p.goals.includes(g)) {
      set({ goals: p.goals.filter((x) => x !== g) });
      return;
    }
    const rest = p.goals.filter((x) => x !== OPPOSITE_GOAL[g]);
    if (rest.length >= MAX_GOALS) return;
    set({ goals: [...rest, g] });
  };
  const makeMain = (g: string) => set({ goals: [g, ...p.goals.filter((x) => x !== g)] });

  /* ----- Content of each screen ----- */
  function stepContent(): ReactNode {
    switch (step) {
      case S_ABOUT:
        return (
          <>
            <Field label="What should we call you?">
              <input
                className={inputClass}
                value={p.name}
                onChange={(e) => set({ name: e.target.value })}
                placeholder="Your name"
                autoComplete="given-name"
                maxLength={40}
              />
            </Field>
            <Field label="Your age">
              <input
                className={inputClass}
                type="number"
                inputMode="numeric"
                value={p.age}
                onChange={(e) => set({ age: e.target.value })}
                placeholder="Years"
              />
            </Field>
            {age > 0 && age < 18 && (
              <Note tone="warn">
                BYB is for people aged 18 and over for now. Please talk to a parent, PE teacher or doctor about exercise
                that suits your age.
              </Note>
            )}
            <Group title="Sex" optional note="Only used to estimate your energy needs." cols={3}>
              {SEXES.map((s) => (
                <Chip key={s} label={s} on={p.sex === s} onClick={() => set({ sex: p.sex === s ? "" : s })} />
              ))}
            </Group>
            <Field label="Country">
              <select className={inputClass} value={p.country} onChange={(e) => set({ country: e.target.value })}>
                {COUNTRIES.map((c) => (
                  <option key={c} value={c} className="bg-neutral-900">
                    {c}
                  </option>
                ))}
              </select>
            </Field>
          </>
        );

      case S_BODY:
        return (
          <>
            <Group title="Units">
              <Chip label="Metric" sub="kg, cm" on={p.units === "metric"} onClick={() => setP((prev) => convertUnits(prev, "metric"))} />
              <Chip label="Imperial" sub="lb, ft" on={p.units === "imperial"} onClick={() => setP((prev) => convertUnits(prev, "imperial"))} />
            </Group>

            {p.units === "metric" ? (
              <Field label="Height (cm)">
                <input
                  className={inputClass}
                  type="number"
                  inputMode="numeric"
                  value={p.heightCm}
                  onChange={(e) => set({ heightCm: e.target.value })}
                  placeholder="e.g. 170"
                />
              </Field>
            ) : (
              <div className="mt-6">
                <p className="mb-2 text-sm font-medium text-white/80">Height</p>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="mb-1 block text-xs text-white/50">Feet</span>
                    <input
                      className={inputClass}
                      type="number"
                      inputMode="numeric"
                      value={p.heightFt}
                      onChange={(e) => set({ heightFt: e.target.value })}
                      placeholder="5"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-white/50">Inches</span>
                    <input
                      className={inputClass}
                      type="number"
                      inputMode="numeric"
                      value={p.heightIn}
                      onChange={(e) => set({ heightIn: e.target.value })}
                      placeholder="7"
                    />
                  </label>
                </div>
              </div>
            )}

            <Field label={`Current weight (${wu})`}>
              <input
                className={inputClass}
                type="number"
                inputMode="decimal"
                value={p.weight}
                onChange={(e) => set({ weight: e.target.value })}
                placeholder={p.units === "metric" ? "e.g. 70" : "e.g. 154"}
              />
            </Field>

            <details className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4">
              <summary className="cursor-pointer text-sm font-medium text-white/80">
                Add body measurements <span className="font-normal text-white/40">(optional)</span>
              </summary>
              <p className="mt-2 text-xs text-white/45">
                Useful for tracking progress later. Measure relaxed, around the widest part, in {mu}.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {MEASURE_FIELDS.map(([key, label]) => (
                  <label key={key} className="block">
                    <span className="mb-1 block text-xs text-white/60">
                      {label} ({mu})
                    </span>
                    <input
                      className={inputClass}
                      type="number"
                      inputMode="decimal"
                      value={p[key]}
                      onChange={(e) => setMeasure(key, e.target.value)}
                    />
                  </label>
                ))}
              </div>
            </details>
          </>
        );

      case S_GOALS:
        return (
          <>
            <div className="mt-6 grid grid-cols-2 gap-2">
              {GOALS.map((g) => {
                const on = p.goals.includes(g);
                const replaces = p.goals.includes(OPPOSITE_GOAL[g]);
                return (
                  <Chip
                    key={g}
                    label={g}
                    on={on}
                    badge={on && p.goals.length > 1 && p.goals[0] === g ? "Main" : undefined}
                    disabled={!on && !replaces && p.goals.length >= MAX_GOALS}
                    onClick={() => pickGoal(g)}
                  />
                );
              })}
            </div>
            <p className="mt-3 text-xs text-white/45">Lose weight and Gain healthy weight can't both be picked.</p>
            {p.goals.length > 1 && (
              <Group title="Which one matters most?" note="This becomes your main goal." cols={1}>
                {p.goals.map((g) => (
                  <Chip key={g} label={g} on={p.goals[0] === g} onClick={() => makeMain(g)} />
                ))}
              </Group>
            )}
          </>
        );

      case S_EXPERIENCE:
        return (
          <>
            <Group title="Your current level" cols={1}>
              {LEVELS.map((o) => (
                <Chip key={o.label} label={o.label} sub={o.sub} on={p.level === o.label} onClick={() => set({ level: o.label })} />
              ))}
            </Group>
            <Group title="What have you done before?" note="Pick all that apply.">
              {TRAINED_BEFORE.map((t) => (
                <Chip
                  key={t}
                  label={t}
                  on={p.trainedBefore.includes(t)}
                  onClick={() => set({ trainedBefore: toggleExclusive(p.trainedBefore, t, NOTHING_YET) })}
                />
              ))}
            </Group>
            <Field label="Anything else about your training?" optional>
              <textarea
                className={`${inputClass} min-h-24`}
                value={p.history}
                onChange={(e) => set({ history: e.target.value })}
                placeholder="e.g. Played cricket in college, stopped going to the gym 2 years ago"
                maxLength={500}
              />
            </Field>
          </>
        );

      case S_CHECK:
        return (
          <>
            <Group title="How many push-ups can you do in a row with good form?" cols={3}>
              {PUSHUPS.map((o) => (
                <Chip key={o} label={o} on={p.pushups === o} onClick={() => set({ pushups: o })} />
              ))}
            </Group>
            <Group title="How long can you walk briskly or jog without stopping?">
              {CARDIO.map((o) => (
                <Chip key={o} label={o} on={p.cardio === o} onClick={() => set({ cardio: o })} />
              ))}
            </Group>
          </>
        );

      case S_PLACE:
        return (
          <>
            <Group cols={1}>
              {PLACES.map((o) => (
                <Chip
                  key={o.label}
                  label={o.label}
                  sub={o.sub}
                  on={p.place === o.label}
                  onClick={() =>
                    set({ place: o.label, equipment: o.label === "Home" || o.label === "Outdoors" ? p.equipment : [] })
                  }
                />
              ))}
            </Group>
            {p.place === "Gym" && <Note>Great, we'll assume you have a full gym.</Note>}
            {p.place === "Bodyweight only" && <Note>No problem. Every exercise will use just your body weight.</Note>}
            {needsKit && (
              <Group title="What equipment do you have?" note="Pick all that apply.">
                {EQUIPMENT.map((eq) => (
                  <Chip
                    key={eq}
                    label={eq}
                    on={p.equipment.includes(eq)}
                    onClick={() => set({ equipment: toggleExclusive(p.equipment, eq, NO_KIT) })}
                  />
                ))}
              </Group>
            )}
          </>
        );

      case S_DAY:
        return (
          <>
            <Group title="What's a normal day like for you?" cols={1}>
              {ACTIVITY.map((o) => (
                <Chip key={o.label} label={o.label} sub={o.sub} on={p.activity === o.label} onClick={() => set({ activity: o.label })} />
              ))}
            </Group>
            <Group title="Work hours" optional cols={1}>
              {SHIFTS.map((o) => (
                <Chip key={o} label={o} on={p.shift === o} onClick={() => set({ shift: p.shift === o ? "" : o })} />
              ))}
            </Group>
            <Group title="How much do you usually sleep?">
              {SLEEP.map((o) => (
                <Chip key={o} label={o} on={p.sleep === o} onClick={() => set({ sleep: o })} />
              ))}
            </Group>
            {(p.sleep === SLEEP[0] || p.sleep === SLEEP[1]) && (
              <Note>Sleep is when your body recovers. Even 30 more minutes a night can help your progress.</Note>
            )}
          </>
        );

      case S_SCHEDULE:
        return (
          <>
            <Group title="Which days can you train?" cols={4}>
              {DAYS.map((d) => (
                <Chip key={d} label={d} on={p.days.includes(d)} onClick={() => set({ days: toggle(p.days, d) })} />
              ))}
            </Group>
            {p.days.length > 0 && (
              <p className="mt-2 text-xs text-white/45">
                {p.days.length} day{p.days.length === 1 ? "" : "s"} a week
              </p>
            )}
            {p.days.length > maxDays && (
              <Note>
                For your level, we suggest up to {maxDays} training days a week. We'll use your other days for rest or
                light walking so your body can recover.
              </Note>
            )}
            <Group title="How long can each workout be? (minutes)" cols={3}>
              {MINUTES.map((m) => (
                <Chip key={m} label={m} on={p.minutes === m} onClick={() => set({ minutes: m })} />
              ))}
            </Group>
            <Group title="When do you prefer to train?">
              {TIMES.map((t) => (
                <Chip key={t} label={t} on={p.timeOfDay === t} onClick={() => set({ timeOfDay: t })} />
              ))}
            </Group>
          </>
        );

      case S_FOOD:
        return (
          <>
            <Group title="Your diet">
              {DIETS.map((d) => (
                <Chip key={d} label={d} on={p.diet === d} onClick={() => set({ diet: d })} />
              ))}
            </Group>
            <Group title="How would you like food tracking?" cols={1}>
              {FOOD_TRACKING.map((o) => (
                <Chip key={o.label} label={o.label} sub={o.sub} on={p.foodTracking === o.label} onClick={() => set({ foodTracking: o.label })} />
              ))}
            </Group>
            <Group title="Foods you usually eat" optional>
              {CUISINES.map((c) => (
                <Chip key={c} label={c} on={p.cuisines.includes(c)} onClick={() => set({ cuisines: toggle(p.cuisines, c) })} />
              ))}
            </Group>
            <Group title="Allergies" optional>
              {ALLERGIES.map((a) => (
                <Chip key={a} label={a} on={p.allergies.includes(a)} onClick={() => set({ allergies: toggle(p.allergies, a) })} />
              ))}
            </Group>
            <Field label="Anything else you don't eat?" optional>
              <input
                className={inputClass}
                value={p.otherAllergy}
                onChange={(e) => set({ otherAllergy: e.target.value })}
                placeholder="e.g. mushrooms, onion and garlic"
                maxLength={100}
              />
            </Field>
            <Group title="Food budget" optional cols={3}>
              {BUDGETS.map((b) => (
                <Chip key={b} label={b} on={p.budget === b} onClick={() => set({ budget: p.budget === b ? "" : b })} />
              ))}
            </Group>
          </>
        );

      case S_HEALTH:
        return (
          <>
            <Group title="Do any of these apply to you?" optional cols={1}>
              {HEALTH.map((h) => (
                <Chip key={h} label={h} on={p.health.includes(h)} onClick={() => set({ health: toggleExclusive(p.health, h, NONE_HEALTH) })} />
              ))}
            </Group>
            {chestFlag && (
              <Note tone="alert">
                Please see a doctor before starting any exercise. If you have chest pain or feel faint right now, get
                medical help immediately.
              </Note>
            )}
            {healthFlag && !chestFlag && (
              <Note tone="warn">
                Please check with a doctor before starting a new exercise programme. BYB gives general fitness
                information, not medical advice.
              </Note>
            )}
            <Group title="Any pain or injury in these areas?" optional>
              {PAIN_AREAS.map((a) => (
                <Chip key={a} label={a} on={p.painAreas.includes(a)} onClick={() => set({ painAreas: toggle(p.painAreas, a) })} />
              ))}
            </Group>
            {p.painAreas.length > 0 && (
              <Note>We'll avoid exercises that strain these areas. Always stop an exercise if it causes pain.</Note>
            )}
            <Field label="Anything else we should know?" optional>
              <textarea
                className={`${inputClass} min-h-24`}
                value={p.healthNote}
                onChange={(e) => set({ healthNote: e.target.value })}
                placeholder="e.g. Old ankle sprain, doctor said no heavy lifting"
                maxLength={500}
              />
            </Field>
          </>
        );

      case S_REVIEW:
        return (
          <>
            {summary(p).map((s) => (
              <div key={s.title} className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-neon">{s.title}</p>
                  <button
                    type="button"
                    className="text-sm font-semibold text-white/70 underline underline-offset-4"
                    onClick={() => {
                      setFromReview(true);
                      setStep(s.step);
                    }}
                  >
                    Edit
                  </button>
                </div>
                <Rows rows={s.rows} />
              </div>
            ))}
            <label className="mt-6 flex items-start gap-3 rounded-2xl border border-white/10 p-4 text-sm text-white/80">
              <input
                type="checkbox"
                className="mt-0.5 h-5 w-5 shrink-0 accent-neon"
                checked={p.consent}
                onChange={(e) => set({ consent: e.target.checked })}
              />
              <span>
                I'm 18 or older. I agree that BYB saves my answers on this device to personalise my training. I
                understand BYB gives general fitness information, not medical advice.
              </span>
            </label>
          </>
        );

      default:
        return null;
    }
  }

  return (
    <Shell>
      {step === S_WELCOME ? (
        <WelcomeScreen />
      ) : (
        <>
          <header>
            <Logo />
            <div className="mt-6 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-neon transition-all duration-300"
                style={{ width: `${(step / S_REVIEW) * 100}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-white/40">
              Step {step} of {S_REVIEW}
            </p>
          </header>
          <section className="flex-1">
            <h1 className="mt-4 text-2xl font-bold">{STEP_TITLES[step]}</h1>
            {STEP_SUBTITLES[step] && <p className="mt-1 text-sm text-white/55">{STEP_SUBTITLES[step]}</p>}
            {stepContent()}
          </section>
        </>
      )}

      <footer className="sticky bottom-0 -mx-5 mt-8 border-t border-white/10 bg-[#0d0d0d] px-5 pb-6 pt-4">
        {!valid[step] && hints[step] && <p className="mb-3 text-center text-xs text-white/50">{hints[step]}</p>}
        <div className="flex gap-3">
          {step > S_WELCOME && !fromReview && (
            <button
              type="button"
              className="rounded-xl border border-white/20 px-5 py-3 font-semibold"
              onClick={() => setStep(step - 1)}
            >
              Back
            </button>
          )}
          <button
            type="button"
            className="flex-1 rounded-xl bg-neon px-5 py-3 font-bold text-black transition disabled:opacity-30"
            disabled={!valid[step]}
            onClick={goNext}
          >
            {nextLabel}
          </button>
        </div>
      </footer>
    </Shell>
  );
}