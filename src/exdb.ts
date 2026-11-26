import { useEffect, useState } from "react";
import { registerExercises, type Equip, type Exercise, type Muscle, type Pattern } from "./exercises";
import { EXTRA_EXERCISES } from "./extraExercises";

/* ==========================================================
   Loads the full exercise library (Free Exercise DB, public
   domain) and labels every exercise with the exact muscle
   head or region it trains.
   ========================================================== */

registerExercises(EXTRA_EXERCISES);

type Raw = {
  id: string; n: string; cat: string; lvl: number; mech: string; force: string; eq: string;
  pm: string[]; sm: string[]; steps: string[]; img: string[];
};

const IMG_BASE = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/";
const images = new Map<string, string[]>();
const categories = new Map<string, string>();
const equipLabels = new Map<string, string>();
const rawMuscles = new Map<string, string>();
const regionCache = new Map<string, string>();

export const CATEGORIES = ["strength", "stretching", "cardio", "plyometrics", "powerlifting", "olympic weightlifting", "strongman"];
export const isImported = (ex: Exercise) => ex.id.startsWith("fx-");
export const imagesOf = (id: string) => (images.get(id) ?? []).map((p) => IMG_BASE + p);
export const categoryOf = (ex: Exercise) => categories.get(ex.id) ?? (ex.type === "Cardio" ? "cardio" : "strength");
export const equipLabelOf = (id: string) => equipLabels.get(id);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/* ---------- Muscle heads and regions ---------- */
export const REGIONS: Record<string, string[]> = {
  Biceps: ["Long head", "Short head", "Both heads", "Brachialis & brachioradialis"],
  Triceps: ["Long head", "Lateral head", "Medial head", "All three heads"],
  Shoulders: ["Front delts", "Side delts", "Rear delts"],
  Chest: ["Upper chest", "Middle chest", "Lower chest"],
  Back: ["Lats", "Upper back", "Traps", "Lower back", "Neck"],
  "Abs and core": ["Upper abs", "Lower abs", "Obliques", "Deep core"],
  Glutes: ["Glutes", "Outer hip (abductors)", "Inner thigh (adductors)"],
  Calves: ["Calves (standing)", "Soleus (seated)"],
  Forearms: ["Forearm flexors", "Forearm extensors", "Grip"],
};

function computeRegion(ex: Exercise): string {
  const n = ex.name.toLowerCase();
  const raw = rawMuscles.get(ex.id) ?? "";
  switch (ex.muscle) {
    case "Biceps":
      if (/hammer|reverse.*curl|reverse-grip|zottman|cross.?body|pinwheel|rope.*curl/.test(n)) return "Brachialis & brachioradialis";
      if (/incline.*curl|drag curl|bayesian|behind.*back|lying.*curl/.test(n)) return "Long head";
      if (/preacher|concentration|spider|scott|wide.?grip|machine curl|prone/.test(n)) return "Short head";
      return "Both heads";
    case "Triceps":
      if (/reverse.?grip|underhand|supinated/.test(n)) return "Medial head";
      if (/overhead|french|skull|lying.*extension|tate|behind.*head|incline.*extension|pullover/.test(n)) return "Long head";
      if (/pushdown|press.?down|kickback/.test(n)) return "Lateral head";
      return "All three heads";
    case "Shoulders":
      if (/rear|reverse fl|reverse pec|face pull|bent.?over|pull.?apart|external rotation|prone/.test(n)) return "Rear delts";
      if (/lateral|side|upright|y.?raise|wall slide/.test(n)) return "Side delts";
      return "Front delts";
    case "Chest":
      if (/decline push|feet.?elevated|incline|low.?to.?high|reverse.?grip bench|landmine/.test(n)) return "Upper chest";
      if (/decline|\bdips?\b|high.?to.?low/.test(n)) return "Lower chest";
      return "Middle chest";
    case "Back":
      if (raw === "neck" || /neck/.test(n)) return "Neck";
      if (raw === "traps" || /shrug/.test(n)) return "Traps";
      if (raw === "lower back" || /hyperextension|back extension|good morning|superman|deadlift/.test(n)) return "Lower back";
      if (raw === "lats" || /pull-?up|chin-?up|pulldown|pullover|scapular/.test(n)) return "Lats";
      return "Upper back";
    case "Abs and core":
      if (/oblique|side|twist|woodchop|wood chop|russian|bicycle|windmill|pallof/.test(n)) return "Obliques";
      if (/leg raise|knee raise|reverse crunch|hip raise|flutter|scissor|toes|hanging/.test(n)) return "Lower abs";
      if (/plank|dead bug|bird dog|hollow|vacuum|stir|rollout|ab roller|ab wheel/.test(n)) return "Deep core";
      return "Upper abs";
    case "Glutes":
      if (raw === "adductors" || /adduct|copenhagen|inner thigh/.test(n)) return "Inner thigh (adductors)";
      if (raw === "abductors" || /abduct|clamshell|side walk|lateral walk|side-lying|fire hydrant/.test(n)) return "Outer hip (abductors)";
      return "Glutes";
    case "Calves":
      return /seated/.test(n) ? "Soleus (seated)" : "Calves (standing)";
    case "Forearms":
      if (/reverse wrist|extensor/.test(n)) return "Forearm extensors";
      if (/wrist curl|flexor/.test(n)) return "Forearm flexors";
      return "Grip";
    case "Quadriceps":
      return "Quads";
    case "Hamstrings":
      return "Hamstrings";
    default:
      return cap(categoryOf(ex));
  }
}

export function regionOf(ex: Exercise): string {
  let r = regionCache.get(ex.id);
  if (!r) {
    r = computeRegion(ex);
    regionCache.set(ex.id, r);
  }
  return r;
}

/* ---------- Converting the downloaded exercises ---------- */
const MUSCLE_MAP: Record<string, Muscle> = {
  abdominals: "Abs and core", abductors: "Glutes", adductors: "Glutes", biceps: "Biceps", calves: "Calves", chest: "Chest",
  forearms: "Forearms", glutes: "Glutes", hamstrings: "Hamstrings", lats: "Back", "lower back": "Back", "middle back": "Back",
  neck: "Back", quadriceps: "Quadriceps", shoulders: "Shoulders", traps: "Back", triceps: "Triceps",
};

function equipFor(eq: string, name: string): Equip[] {
  if (/pull-?up|chin-?up|hanging|muscle.?up|toes.?to.?bar/.test(name)) return ["pullup"];
  if (/\bdips?\b/.test(name) && !/bench dip/.test(name)) return ["bars"];
  switch (eq) {
    case "dumbbell":
      return ["dumbbell"];
    case "barbell":
    case "e-z curl bar":
      return ["barbell"];
    case "kettlebells":
      return ["kettlebell"];
    case "cable":
      return ["cable"];
    case "machine":
      return ["machine"];
    case "bands":
      return ["band"];
    case "body only":
      return /bench/.test(name) ? ["bench"] : [];
    default:
      return ["machine"]; // medicine ball, exercise ball, foam roller, other: treated as gym equipment
  }
}

function patternFor(r: Raw, muscle: Muscle, name: string): Pattern {
  if (r.cat === "cardio") return "cardio";
  switch (r.pm[0] ?? "") {
    case "chest":
      return /fly|flye|crossover|pec deck|butterfly|squeeze/.test(name) ? "chestIso" : "hpush";
    case "shoulders":
      if (/rear|reverse fl|face pull|bent.?over.*(raise|lateral|fly)|pull.?apart|external rotation/.test(name)) return "rearDelt";
      if (/press|push.?press|arnold|jerk|handstand|pike/.test(name)) return "vpush";
      return r.mech === "compound" ? "vpush" : "shoulderIso";
    case "biceps":
      return "biceps";
    case "triceps":
      return "triceps";
    case "forearms":
      return "forearm";
    case "lats":
      return /row/.test(name) ? "hpull" : "vpull";
    case "middle back":
      return /pull-?up|chin|pulldown/.test(name) ? "vpull" : "hpull";
    case "lower back":
      return "hinge";
    case "traps":
    case "neck":
      return "rearDelt";
    case "quadriceps":
      if (/extension/.test(name)) return "quadIso";
      return /lunge|split|step.?up|single.?leg|pistol|bulgarian/.test(name) ? "lunge" : "squat";
    case "hamstrings":
      return /curl/.test(name) ? "hamIso" : "hinge";
    case "glutes":
    case "abductors":
    case "adductors":
      if (/deadlift|good morning|swing/.test(name)) return "hinge";
      return /lunge|step.?up|split/.test(name) ? "lunge" : "glute";
    case "calves":
      return "calves";
    case "abdominals":
      return "core";
    default:
      return muscle === "Full body" ? "cardio" : "core";
  }
}

function avoidFor(name: string, r: Raw): string[] {
  const out: string[] = [];
  const add = (area: string, re: RegExp) => {
    if (re.test(name) && !out.includes(area)) out.push(area);
  };
  add("Knee", /squat|lunge|jump|leg extension|leg press|step.?up|pistol|sissy|bound|hop|skater|burpee|box/);
  if (r.cat === "plyometrics" && !out.includes("Knee")) out.push("Knee");
  add("Lower back", /deadlift|good morning|hyperextension|back extension|bent.?over|clean|snatch|jerk|swing|atlas|stone|tire|yoke|sled/);
  add("Shoulder", /overhead|military|shoulder press|behind.?(the )?neck|upright row|\bdips?\b|handstand|snatch|jerk|arnold|pullover|bench press/);
  add("Elbow or wrist", /push.?up|handstand|clean|front squat|wrist|skull|plank/);
  add("Neck", /neck|crunch|sit.?up|headstand/);
  add("Hip", /pistol|sumo|split squat|cossack|adduct/);
  add("Ankle or foot", /jump|hop|bound|skip|sprint|calf raise|running|\brun\b/);
  if (r.pm[0] === "lower back" && !out.includes("Lower back")) out.push("Lower back");
  return out;
}

const SAFETY: Record<string, string> = {
  strength: "Use a weight you can control for every rep. Stop if you feel sharp pain.",
  stretching: "Stretch gently to mild tension, never pain, and breathe slowly.",
  cardio: "Start easy and build up slowly. Stop if you feel chest pain, dizziness or unusual breathlessness.",
  plyometrics: "Land softly with bent knees. Only do jumps if you have no joint pain and good basic strength.",
  powerlifting: "Use safety bars or a spotter and increase weight gradually.",
  "olympic weightlifting": "A technical lift. Learn it from a qualified coach with light weights first.",
  strongman: "An advanced strongman event. Learn it with a qualified coach before trying.",
};

function convert(r: Raw): Exercise {
  const lower = r.n.toLowerCase();
  const primary = r.pm[0] ?? "";
  const cardio = r.cat === "cardio";
  const muscle: Muscle = cardio ? "Full body" : (MUSCLE_MAP[primary] ?? "Full body");
  const id = `fx-${r.id}`;
  images.set(id, r.img);
  categories.set(id, r.cat);
  equipLabels.set(id, r.eq);
  rawMuscles.set(id, primary);
  const level: 1 | 2 | 3 = r.lvl === 1 ? 1 : r.lvl === 2 ? 2 : 3;
  return {
    id,
    name: r.n,
    muscle,
    secondary: [...new Set(r.sm.filter((m) => m !== primary).map(cap))],
    type: cardio ? "Cardio" : r.mech === "isolation" ? "Isolation" : "Compound",
    equipment: equipFor(r.eq, lower),
    level,
    pattern: patternFor(r, muscle, lower),
    unit: cardio ? "min" : r.cat === "stretching" || /plank|hold|hang\b|wall sit|isometric/.test(lower) ? "sec" : "reps",
    steps: r.steps.length ? r.steps : ["Follow the photos and move slowly and with control."],
    mistakes: [],
    safety: SAFETY[r.cat] ?? SAFETY.strength,
    avoid: avoidFor(lower, r),
  };
}

/* ---------- Loading ---------- */
let status: "loading" | "ready" | "error" = "loading";
let loading: Promise<void> | null = null;
export const exerciseDbStatus = () => status;

export function loadExerciseDb(): Promise<void> {
  if (!loading) {
    loading = fetch(`${import.meta.env.BASE_URL}data/exercises.json`)
      .then((res) => {
        if (!res.ok) throw new Error("exercises.json not found");
        return res.json() as Promise<Raw[]>;
      })
      .then((list) => {
        registerExercises(list.map(convert));
        status = "ready";
      })
      .catch(() => {
        status = "error";
      });
  }
  return loading;
}

export function useExerciseDb() {
  const [state, setState] = useState(status);
  useEffect(() => {
    let alive = true;
    void loadExerciseDb().then(() => {
      if (alive) setState(status);
    });
    return () => {
      alive = false;
    };
  }, []);
  return state;
}