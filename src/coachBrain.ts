import type { AppData, FoodItem, Plan, PlanDay, PlanExercise, Profile } from "./store";
import { WEEK_MON, addDays, dateKey, prettyDate, weekStart, weekdayOf } from "./store";
import { EQUIP_LABEL, EXERCISES, LEVEL_NAME, UNIT_LABEL, byId, type Equip, type Exercise } from "./exercises";
import { REGIONS, categoryOf, isImported, regionOf } from "./exdb";
import {
  alternatives, availableEquip, canDo, estimateMinutes, fromUnit, generatePlan, hasHealthFlag, isSafeFor, latestWeightKg,
  missedCount, planChoices, plateauTips, prescribe, profileWeightKg, quickWorkout, rankOf, showWeight, swapIn, todaysIndex,
  trainedOn, trainingWeekdays, upcoming, warmUp, weightUnit,
} from "./train";
import { foodOn, logStreak, nutritionTargets, recordCount, setWeight, totalsOf, updateDay, weekStreak } from "./stats";
import { entryFrom, mealForNow, norm, parseMeal, preferredZones, proteinPicks, r1 } from "./fooddb";
import { loadText, setCap, suggest } from "./weights";

/* ==========================================================
   BYB Coach brain: free language understanding that runs on
   the phone. It works out what you mean, changes your plan
   (with Undo), logs food, water, sleep, steps, weight and how
   you feel, suggests weights, and answers training and food
   questions. Every change goes through BYB's safety rules.
   ========================================================== */

export type Memory = { exerciseId?: string; dayIndex?: number };
export type Reply = {
  text: string;
  quick?: string[]; // suggested next messages
  workout?: PlanDay; // shows a Start button
  planIndex?: number; // which plan day that workout is
  apply?: (d: AppData) => AppData; // the change to make
  change?: string; // short label for Undo
  undo?: boolean;
  memory?: Memory;
  intent?: string;
};
export type BrainCtx = { profile: Profile; data: AppData; foods: FoodItem[] | null; memory: Memory; turn: number };

type Ent = {
  ex?: Exercise; ex2?: Exercise; day?: number; muscle?: string; regions: string[]; allHeads: boolean;
  minutes?: number; split?: string; focus?: string; daysCount?: number; weekdays: string[]; sets?: number; reps?: string;
};
type Handler = (ctx: BrainCtx, q: string, e: Ent, raw: string) => Reply;

/* ---------- Text helpers ---------- */
function lev(a: string, b: string): number {
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur.push(Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)));
    prev = cur;
  }
  return prev[b.length];
}
const tm = (a: string, b: string) => a === b || (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a)));
const singular = (w: string) => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w);
const oneOf = (list: string[], n: number) => list[Math.abs(n) % list.length];
function joinNames(names: string[]) {
  const u = [...new Set(names)];
  return u.length <= 1 ? (u[0] ?? "") : `${u.slice(0, -1).join(", ")} and ${u[u.length - 1]}`;
}
const has = (q: string, list: string[]) => list.some((w) => new RegExp(`\\b${w}`).test(q));
const DONE = ["Done!", "All set.", "Updated.", "Sorted."];
const WEEKDAY: Record<string, string> = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };
const NUMBER: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
const toNum = (s: string) => (/^\d/.test(s) ? Number(s.replace(/,/g, "")) : (NUMBER[s] ?? NaN));

const STOP = new Set(
  "the a an my me i to with for of in on at and or please can you could would some it its this that from instead exercise exercises workout workouts plan routine day days do doing add remove replace swap change switch put drop delete take out more less into make want need use using like just also too any all every today tomorrow is are be by give get have has had so then there what which weight heavy heavier should".split(" "),
);
const WEAK = new Set(
  "dumbbell barbell cable machine band kettlebell bodyweight body weight ez bar smith seated standing lying incline decline flat single one arm leg alternate alternating close wide grip reverse straight bent over chest back shoulder delt bicep tricep forearm ab abs core quad hamstring glute calf calve lat trap upper lower side front rear high low up".split(" "),
);
const COMMON = new Set(
  "what which when where why who how have has had having this that these those with without want wants need needs more most less make makes made much many should would could does doing done good great feel feels feeling work works worked working time times week weeks days today tonight tomorrow help like after before about only just still been being they them their there your yours from into than then also very really because food foods meal meals know tell give some each every next last plan plans eating going come came right left over under here okay sure yeah thanks thank please sorry maybe other another again always never often start started stop stopped keep kept trying tried same different hard easy easier harder body heavy light little long short high best better worse able enough mean said ask asked curd milk rice roti dosa idli sambar paneer chicken mutton fish eggs oats banana apple chapati biryani poha upma rajma chana sprouts tofu water sleep slept steps weigh weight tired sore".split(" "),
);
const KEYWORDS = "replace swap substitute remove delete drop include easier harder shorter longer minutes workout workouts exercise exercises sets reps today tomorrow protein calories water sleep sore tired progress plateau warm stretch biceps triceps shoulders chest back legs glutes hamstrings quadriceps calves forearms abs core obliques delts lats traps split upper lower push pull full strength muscle endurance beginner home gym dumbbell dumbbells barbell bench cable machine kettlebell band bands breakfast lunch dinner snack steps missed stuck creatine whey supplement motivation lazy heavier".split(" ");

let vocab = new Set<string>();
let vocabFor = -1;
function getVocab() {
  if (vocabFor !== EXERCISES.length) {
    vocab = new Set(KEYWORDS);
    for (const ex of EXERCISES) for (const t of norm(ex.name).split(" ")) if (t.length >= 4 && !/\d/.test(t)) vocab.add(t);
    vocabFor = EXERCISES.length;
  }
  return vocab;
}
// Fixes small spelling mistakes ("bicpes" → "biceps")
function fixTypos(q: string): string {
  const v = getVocab();
  return q
    .split(" ")
    .map((w) => {
      if (w.length < 4 || /[^a-z]/.test(w) || v.has(w) || COMMON.has(w)) return w;
      const max = w.length >= 7 ? 2 : 1;
      let best = w;
      let bestD = max + 1;
      for (const c of v) {
        if (c[0] !== w[0] || Math.abs(c.length - w.length) > max) continue;
        const d = lev(c, w);
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      return best;
    })
    .join(" ");
}

function clean(raw: string) {
  return raw
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/[?!.]+/g, " ")
    .replace(/\bpush[\s-]?ups?\b/g, "push up")
    .replace(/\bpull[\s-]?ups?\b/g, "pull up")
    .replace(/\bchin[\s-]?ups?\b/g, "chin up")
    .replace(/\bsit[\s-]?ups?\b/g, "sit up")
    .replace(/\bstep[\s-]?ups?\b/g, "step up")
    .replace(/\brdls?\b/g, "romanian deadlift")
    .replace(/\bohp\b/g, "overhead press")
    .replace(/\bskull ?crushers?\b/g, "skull crusher")
    .replace(/\bpull ?downs?\b/g, "pulldown")
    .replace(/\bflyes\b/g, "fly")
    .replace(/\s+/g, " ")
    .trim();
}

/* ---------- Finding exercises, days and muscles ---------- */
type IxEx = { ex: Exercise; tokens: string[] };
let ixCache: IxEx[] = [];
function exIndex(): IxEx[] {
  if (ixCache.length !== EXERCISES.length) ixCache = EXERCISES.map((ex) => ({ ex, tokens: norm(ex.name).split(" ").map(singular) }));
  return ixCache;
}

function findExercise(text: string, ctx: BrainCtx): Exercise | undefined {
  const t = text.replace(/\bbench\b(?! press| dip| jump)/g, "bench press");
  const words = norm(t).split(" ").map(singular).filter((w) => w && !STOP.has(w));
  if (!words.length) return undefined;
  const planIds = new Set(ctx.data.plan?.days.flatMap((d) => d.exercises.map((x) => x.id)) ?? []);
  const equip = availableEquip(ctx.profile);
  let best: { ex: Exercise; score: number } | undefined;
  for (let i = 0; i < words.length; i++) {
    for (let len = Math.min(5, words.length - i); len >= 1; len--) {
      const win = words.slice(i, i + len);
      if (!win.some((w) => !WEAK.has(w))) continue;
      for (const { ex, tokens } of exIndex()) {
        if (!win.every((w) => tokens.some((tk) => tm(tk, w)))) continue;
        const score = len * 10 - (tokens.length - len) * 2 + (planIds.has(ex.id) ? 15 : 0) + (isImported(ex) ? 0 : 6) + (canDo(ex, equip) ? 3 : 0);
        if (!best || score > best.score) best = { ex, score };
      }
    }
  }
  return best && best.score >= 8 ? best.ex : undefined;
}

const DAY_WORDS: [RegExp, RegExp][] = [
  [/\bpush (day|workout|session)\b/, /push/],
  [/\bpull (day|workout|session)\b/, /pull/],
  [/\blegs? (day|workout|session)\b/, /legs|lower/],
  [/\bupper (day|body day|workout|session)\b/, /upper/],
  [/\blower (day|body day|workout|session)\b/, /lower|legs/],
  [/\bfull body (day|workout|session)\b/, /full body/],
  [/\bchest (day|workout|session)\b/, /chest/],
  [/\barms? (day|workout|session)\b/, /arms/],
  [/\bback (day|workout|session)\b/, /back/],
  [/\bshoulders? (day|workout|session)\b/, /shoulders/],
];

function findDay(q: string, ctx: BrainCtx): number | undefined {
  const plan = ctx.data.plan;
  if (!plan) return undefined;
  const titles = plan.days.map((d) => norm(d.title));
  const exact = titles.findIndex((t) => new RegExp(`\\b${t}\\b`).test(q));
  if (exact >= 0) return exact;
  for (const [re, title] of DAY_WORDS) {
    if (re.test(q)) {
      const i = titles.findIndex((t) => title.test(t));
      if (i >= 0) return i;
    }
  }
  if (/\btoday'?s?\b/.test(q) && /\b(workout|session|training)\b/.test(q)) {
    const i = todaysIndex(plan, ctx.data.sessions);
    if (i >= 0) return i;
  }
  const next = upcoming(plan, ctx.data.sessions, 7);
  if (/\btomorrow'?s?\b/.test(q)) {
    const key = addDays(dateKey(), 1);
    const u = next.find((x) => x.date === key);
    if (u) return u.index;
  }
  const wd = q.match(/\b(mon|tue|wed|thu|fri|sat|sun)[a-z]*'?s? (workout|session|training)\b/);
  if (wd) {
    const u = next.find((x) => weekdayOf(x.date) === WEEKDAY[wd[1]]);
    if (u) return u.index;
  }
  return undefined;
}

function stripDays(q: string, ctx: BrainCtx) {
  let t = q;
  for (const d of ctx.data.plan?.days ?? []) t = t.replace(new RegExp(`\\b(on|to|in|from|for)?\\s*${norm(d.title)}\\b`, "g"), " ");
  for (const [re] of DAY_WORDS) t = t.replace(new RegExp(`(\\b(on|to|in|from|for)\\s+)?(my\\s+)?(${re.source})`, "g"), " ");
  return t.replace(/\b(today|tomorrow)'?s?\b/g, " ");
}

const MUSCLE_RES: [RegExp, string][] = [
  [/\b(chest|pecs?)\b/, "Chest"],
  [/\b(back|lats?|traps?)\b/, "Back"],
  [/\b(shoulders?|delts?)\b/, "Shoulders"],
  [/\b(biceps?|bis)\b/, "Biceps"],
  [/\b(triceps?|tris)\b/, "Triceps"],
  [/\b(forearms?|grip)\b/, "Forearms"],
  [/\b(abs|core|six ?pack|obliques?|stomach)\b/, "Abs and core"],
  [/\b(quads?|quadriceps|thighs?)\b/, "Quadriceps"],
  [/\b(hamstrings?|hammies)\b/, "Hamstrings"],
  [/\b(glutes?|butt|hips?|adductors?|abductors?)\b/, "Glutes"],
  [/\b(calf|calves|soleus)\b/, "Calves"],
];
const REGION_RES: [RegExp, string | null, string][] = [
  [/short head/, "Biceps", "Short head"],
  [/brachialis|brachioradialis/, "Biceps", "Brachialis & brachioradialis"],
  [/lateral head/, "Triceps", "Lateral head"],
  [/medial head/, "Triceps", "Medial head"],
  [/long head/, null, "Long head"],
  [/rear delts?|rear shoulders?/, "Shoulders", "Rear delts"],
  [/side delts?|lateral delts?|side shoulders?/, "Shoulders", "Side delts"],
  [/front delts?|front shoulders?/, "Shoulders", "Front delts"],
  [/upper chest/, "Chest", "Upper chest"],
  [/lower chest/, "Chest", "Lower chest"],
  [/middle chest|mid chest/, "Chest", "Middle chest"],
  [/\blats?\b/, "Back", "Lats"],
  [/upper back|mid back|middle back/, "Back", "Upper back"],
  [/\btraps?\b/, "Back", "Traps"],
  [/lower back/, "Back", "Lower back"],
  [/obliques?/, "Abs and core", "Obliques"],
  [/lower abs/, "Abs and core", "Lower abs"],
  [/upper abs/, "Abs and core", "Upper abs"],
  [/inner thighs?|adductors?/, "Glutes", "Inner thigh (adductors)"],
  [/outer hips?|abductors?|glute med/, "Glutes", "Outer hip (abductors)"],
  [/soleus/, "Calves", "Soleus (seated)"],
];

function entities(q: string, ctx: BrainCtx): Ent {
  const forEx = stripDays(q, ctx);
  let fromPart = forEx;
  let toPart = "";
  let m = forEx.match(/\b(?:replace|swap|switch|substitute|change)\s+(.+?)\s+(?:with|for|to|by|into)\s+(.+)/);
  if (m) {
    fromPart = m[1];
    toPart = m[2];
  } else if ((m = forEx.match(/\b(?:use|do|try|give me|put)\s+(.+?)\s+instead of\s+(.+)/))) {
    toPart = m[1];
    fromPart = m[2];
  } else if ((m = forEx.match(/\binstead of\s+(.+?)\s*,?\s*(?:use|do|try|give me|put)\s+(.+)/))) {
    fromPart = m[1];
    toPart = m[2];
  }
  const ex = findExercise(fromPart, ctx);
  const ex2 = toPart ? findExercise(toPart, ctx) : undefined;

  let muscle = MUSCLE_RES.find(([re]) => re.test(q))?.[1];
  const regions: string[] = [];
  for (const [re, mus, region] of REGION_RES) {
    if (!re.test(q)) continue;
    const owner = mus ?? (muscle === "Triceps" ? "Triceps" : "Biceps");
    if (!muscle) muscle = owner;
    if (owner === muscle && !regions.includes(region)) regions.push(region);
  }

  const min = q.match(/(\d{1,3})\s*(?:min|mins|minutes)\b/);
  const dc = q.match(/\b(\d|one|two|three|four|five|six|seven)\s*(?:days?|times)\b/);
  const weekdays = [...q.matchAll(/\b(mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:rs(?:day)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\b/g)].map(
    (x) => WEEKDAY[x[1].slice(0, 3)],
  );
  const split = /\b(push pull legs?|push ?\/ ?pull|ppl)\b/.test(q)
    ? "Push / pull / legs"
    : /\bupper ?(\/|and)? ?lower\b/.test(q)
      ? "Upper / lower"
      : /\bbro split|body ?part split|one muscle a day\b/.test(q)
        ? "Bro split"
        : /\bfull ?body\b/.test(q) && /\b(split|plan|routine|program|instead)\b/.test(q)
          ? "Full body"
          : undefined;
  const focus = /\b(stronger|strength|powerlifting)\b/.test(q)
    ? "Strength"
    : /\b(hypertrophy|bigger|size|build muscle|gain muscle|muscle growth|bodybuilding)\b/.test(q)
      ? "Hypertrophy"
      : /\b(fat loss|lose fat|lose weight|cutting|leaner|shred)\b/.test(q)
        ? "Fat loss"
        : /\b(endurance|stamina|conditioning)\b/.test(q)
          ? "Endurance"
          : /\b(beginner friendly|beginner|basics)\b/.test(q)
            ? "Beginner-friendly"
            : undefined;

  const sr = q.match(/\b(\d)\s*(?:x|×|sets? of)\s*(\d{1,2}(?:\s*(?:-|–|to)\s*\d{1,2})?)\b/);
  let sets = sr ? Number(sr[1]) : undefined;
  let reps = sr ? sr[2].replace(/\s*(?:-|to)\s*/, "–") : undefined;
  const s1 = q.match(/\b(\d)\s*sets?\b/);
  if (sets === undefined && s1) sets = Number(s1[1]);
  const repsMatch = q.match(/\b(\d{1,2}(?:\s*(?:-|–|to)\s*\d{1,2})?)\s*reps?\b/);
  if (reps === undefined && repsMatch) reps = repsMatch[1].replace(/\s*(?:-|to)\s*/, "–");

  return {
    ex, ex2, day: findDay(q, ctx), muscle, regions,
    allHeads: /\ball (three|3|the|of the)? ?(heads|parts)\b|\bevery (head|part)\b|\beach head\b/.test(q),
    minutes: min ? Number(min[1]) : undefined,
    split, focus,
    daysCount: dc ? toNum(dc[1]) : undefined,
    weekdays: [...new Set(weekdays)],
    sets, reps,
  };
}

/* ---------- Safety (always checked first) ---------- */
const CRISIS = ["kill myself", "suicide", "suicidal", "self harm", "self-harm", "hurt myself", "end my life", "want to die", "don't want to live", "dont want to live"];
const EMERGENCY = ["chest pain", "chest hurts", "can't breathe", "cant breathe", "cannot breathe", "faint", "passed out", "blacked out", "heart attack", "dizzy", "numb"];
const DISORDERED = ["starve", "starving", "stop eating", "not eating", "eat nothing", "skip all meals", "purge", "purging", "make myself sick", "throw up after", "vomit after", "laxative", "diet pills"];
const MEDICAL = ["pain", "hurt", "injur", "sprain", "strain", "torn", "swelling", "swollen", "pregnan", "diabet", "blood pressure", "heart condition", "heart problem", "asthma", "medicine", "medication", "tablet", "surgery", "operation", "physio", "steroid", "sarm"];
const lowCalorie = (q: string) => /\b[1-9]\d{2}\s*(kcal|calories|cals?)\b/.test(q) && /(a|per|each|every)\s+day|daily/.test(q);

function medicalReply(q: string): string {
  if (has(q, ["pregnan"])) {
    return "Thanks for telling me. Exercise during and after pregnancy should be guided by your doctor, because what's safe depends on you and your pregnancy. Gentle walking is often recommended, but please check first, and add it to your health answers (Profile → Edit my answers) so BYB keeps your plan gentle.";
  }
  if (has(q, ["steroid", "sarm"])) {
    return "I don't give advice on steroids, SARMs or other performance-enhancing drugs. They carry serious risks to your heart, liver and hormones. Please talk to a doctor if you're considering them. Training, food and sleep build real, lasting progress.";
  }
  if (has(q, ["pain", "hurt", "injur", "sprain", "strain", "torn", "swelling", "swollen", "physio", "surgery", "operation"])) {
    return "I can't diagnose injuries, but here's general safety advice:\n• Stop any exercise that causes sharp or worsening pain.\n• See a doctor or physiotherapist if pain is severe, lasts more than a few days, or comes with swelling, numbness, weakness or a pop when it happened.\n• Keep moving gently in ways that don't hurt, like walking.\n• Add the area in Profile → Edit my answers → Health and safety, and your plan will leave out exercises that load it.";
  }
  return "For health conditions and medicines, please follow your doctor's advice about exercise. I give general fitness information only and can't tell you what's safe for your condition. If you add it to your health answers (Profile → Edit my answers), your plan uses gentler training and lower volume.";
}

function safety(q: string, ctx: BrainCtx): Reply | null {
  if (has(q, CRISIS)) {
    return { text: "I'm really sorry you're feeling this way, and I'm glad you told me. You deserve support right now. Please reach out to someone you trust, or call Tele-MANAS on 14416 (free, 24/7 in India). If you're in immediate danger, call 112. Outside India, please contact your local emergency number." };
  }
  if (has(q, EMERGENCY)) {
    return { text: "Please stop exercising now. Chest pain, trouble breathing, fainting, sudden dizziness or numbness can be serious. If it's happening now, call 112 (India) or your local emergency number, or go to the nearest hospital. Please don't train again until a doctor has checked you." };
  }
  if (has(q, DISORDERED) || lowCalorie(q)) {
    return { text: "It sounds like you might be thinking about eating very little. I can't help with plans that cut food that much: very low intakes can harm your health, energy, mood and training. If food or your body has been feeling stressful, please talk to a doctor or someone you trust. In India you can call Tele-MANAS on 14416 for free support." };
  }
  if (has(q, MEDICAL)) {
    const ex = findExercise(q, ctx);
    const inPlan = !!ex && !!ctx.data.plan?.days.some((d) => d.exercises.some((x) => x.id === ex.id));
    return {
      text: medicalReply(q) + (ex && inPlan ? `\n\nIf ${ex.name} is causing pain, I can swap it for something gentler.` : ""),
      quick: ex && inPlan ? [`Replace ${ex.name}`] : undefined,
    };
  }
  return null;
}

/* ---------- Food logging ("I ate 3 idli and sambar") ---------- */
const FOOD_VERB = /\b(ate|eaten|eat|had|have had|having|log|logged|add|consumed|finished|drank)\b/;
const NOT_FOOD = /\b(workouts?|training|trained|gym|sessions?|sleep|slept|rest|steps|water|weight|weigh|pain|sets?|reps?|exercises?|plan|routine|day off|should|what|how|which|can i|is it)\b/;
const MEAL_WORDS: [RegExp, string][] = [
  [/breakfast/, "Breakfast"],
  [/lunch/, "Lunch"],
  [/dinner|supper/, "Dinner"],
  [/pre.?workout/, "Pre-workout"],
  [/post.?workout/, "Post-workout"],
  [/snacks?/, "Snack"],
];
const UNIT_WORD = /^(\d+(\.\d+)?|g|gm|gms|gram|grams|kg|ml|cups?|katoris?|bowls?|plates?|pieces?|pcs?|nos|slices?|glass(es)?|tbsp|tsp|spoons?|ladles?|handful|servings?|scoops?|half|quarter|one|two|three|four|five|six|seven|eight|nine|ten|a|an|of|and|with|small|medium|large|big)$/;

function strictMatch(text: string, f: FoodItem) {
  const words = norm(text).split(" ").filter((w) => w && !UNIT_WORD.test(w)).map(singular);
  if (!words.length) return false;
  const tokens = norm([f.n, ...f.al].join(" ")).split(" ").map(singular);
  return words.every((w) => tokens.some((t) => tm(t, w)));
}

function foodLog(raw: string, q: string, ctx: BrainCtx): Reply | null {
  if (!ctx.foods || !FOOD_VERB.test(q) || NOT_FOOD.test(q)) return null;
  const meal = MEAL_WORDS.find(([re]) => re.test(q))?.[1] ?? mealForNow();
  const text = raw
    .replace(/^.*?\b(ate|eaten|eat|had|have had|having|log|logged|add|consumed|finished|drank)\b/i, "")
    .replace(/\b(for|at|in|during|to|as)\s+(my\s+)?(breakfast|lunch|dinner|supper|snacks?|pre.?workout|post.?workout)\b/gi, "")
    .replace(/\b(today|this morning|tonight|just|some)\b/gi, " ");
  const items = parseMeal(text, [...ctx.data.myFoods, ...ctx.foods], preferredZones(ctx.profile));
  const good = items.flatMap((it) => (it.food && it.grams > 0 && strictMatch(it.text, it.food) ? [{ food: it.food, grams: it.grams, text: it.text }] : []));
  if (!good.length) return null;
  const missed = items.filter((it) => !good.some((g) => g.text === it.text)).map((it) => `"${it.text}"`);
  const date = dateKey();
  const entries = good.map((g) => entryFrom(g.food, g.grams, meal, date));
  const showNumbers = ctx.profile.foodTracking !== "Keep it simple";
  const t = nutritionTargets(ctx.profile, ctx.data);
  const sum = totalsOf(entries);
  const today = totalsOf([...foodOn(ctx.data, date), ...entries]);
  const lines = entries.map((en) => `• ${en.name}, ${en.grams} g${showNumbers ? `: ${Math.round(en.kcal)} kcal, ${r1(en.protein)} g protein` : ""}`);
  return {
    text:
      `Logged to ${meal.toLowerCase()}:\n${lines.join("\n")}` +
      (showNumbers
        ? `\n\nThis meal: ${Math.round(sum.kcal)} kcal, ${r1(sum.protein)} g protein.\nToday so far: ${Math.round(today.kcal)} / ${t.kcal} kcal, ${Math.round(today.protein)} / ${t.protein} g protein.`
        : "") +
      (missed.length ? `\n\nI couldn't find ${missed.join(", ")}. You can add it on the Food tab.` : "") +
      "\n\nIf your portion was different, edit the grams in Food → Food diary.",
    apply: (d) => ({ ...d, food: [...d.food, ...entries] }),
    change: `logged ${entries.length} food${entries.length === 1 ? "" : "s"}`,
    quick: ["Undo", "How much protein should I eat?"],
  };
}

/* ---------- Plan helpers ---------- */
const daySets = (day: PlanDay) => day.exercises.reduce((a, x) => a + x.sets, 0);
const focusOf = (d: AppData) => (d.plan ? planChoices(d.plan).focus : "Auto");
function allowedLevel(p: Profile) {
  const r = rankOf(p.level);
  const l = r === 0 ? 1 : r === 1 ? 2 : 3;
  return hasHealthFlag(p) ? Math.min(l, 2) : l;
}
const nameOf = (id: string) => byId(id)?.name ?? id;
const mapDays = (plan: Plan, fn: (day: PlanDay, i: number) => PlanDay): Plan => ({ ...plan, days: plan.days.map(fn) });
const daysWith = (plan: Plan, id: string, only?: number) =>
  plan.days.flatMap((d, i) => ((only === undefined || only === i) && d.exercises.some((x) => x.id === id) ? [i] : []));
const planNames = (plan: Plan) => [...new Set(plan.days.flatMap((d) => d.exercises.map((x) => nameOf(x.id))))];
const NO_PLAN: Reply = { text: "You don't have a workout plan yet. Open Workouts and tap Create my plan, then I can change it for you." };

function equipNote(ex: Exercise, p: Profile) {
  if (canDo(ex, availableEquip(p))) return "";
  return ` Note: it needs ${joinNames(ex.equipment.map((eq) => EQUIP_LABEL[eq].toLowerCase()))}, which isn't in your equipment list.`;
}

function listDay(day: PlanDay) {
  return day.exercises
    .map((x, i) => {
      const ex = byId(x.id);
      return `${i + 1}. ${ex?.name ?? x.id}: ${x.sets} × ${x.reps} ${ex ? UNIT_LABEL[ex.unit] : ""}`;
    })
    .join("\n");
}

function trimDay(day: PlanDay, minutes: number): PlanDay {
  const out: PlanDay = { title: `${day.title} (${minutes} min)`, focus: day.focus, exercises: [] };
  for (const x of day.exercises) {
    const trial = { ...out, exercises: [...out.exercises, x] };
    if (out.exercises.length >= 2 && estimateMinutes(trial) > minutes) break;
    out.exercises.push(x);
  }
  return out;
}

const DAY_HINT: Record<string, RegExp> = {
  Biceps: /pull|arm|back|upper|full/, Triceps: /push|arm|chest|upper|full/, Shoulders: /push|shoulder|upper|full/,
  Chest: /push|chest|upper|full/, Back: /pull|back|upper|full/, Forearms: /pull|arm|back|upper|full/,
  Quadriceps: /leg|lower|full/, Hamstrings: /leg|lower|full/, Glutes: /leg|lower|full/, Calves: /leg|lower|full/,
};
function dayOrder(plan: Plan, muscle: string): number[] {
  const count = plan.days.map((d) => d.exercises.filter((x) => byId(x.id)?.muscle === muscle).length);
  const hint = DAY_HINT[muscle] ?? /./;
  const fits = (i: number) => Number(hint.test(norm(`${plan.days[i].title} ${plan.days[i].focus}`)));
  return plan.days.map((_, i) => i).sort((a, b) => count[b] - count[a] || fits(b) - fits(a));
}

function bestForRegion(ctx: BrainCtx, muscle: string, region: string, exclude: Set<string>): Exercise | undefined {
  const equip = availableEquip(ctx.profile, focusOf(ctx.data));
  const lvl = allowedLevel(ctx.profile);
  return EXERCISES.filter(
    (ex) =>
      ex.muscle === muscle && regionOf(ex) === region && !exclude.has(ex.id) && ex.level <= lvl &&
      canDo(ex, equip) && isSafeFor(ex, ctx.profile) && categoryOf(ex) === "strength",
  ).sort((a, b) => Number(isImported(a)) - Number(isImported(b)) || a.level - b.level || a.name.length - b.name.length)[0];
}

function headWorkout(ctx: BrainCtx, muscle: string, regions: string[], bodyweightOnly: boolean): PlanDay | null {
  const p: Profile = bodyweightOnly ? { ...ctx.profile, place: "Bodyweight only" } : ctx.profile;
  const exclude = new Set<string>();
  const exercises: PlanExercise[] = [];
  for (const region of regions) {
    const ex = bestForRegion({ ...ctx, profile: p }, muscle, region, exclude);
    if (!ex) continue;
    exclude.add(ex.id);
    const px = prescribe(ex.id, p);
    if (px) exercises.push(px);
  }
  return exercises.length ? { title: `${muscle} workout`, focus: regions.join(", "), exercises } : null;
}

function rebuild(ctx: BrainCtx, opts: { split?: string; focus?: string; minutes?: number; days?: string[] }, reason: string): Reply {
  const plan = ctx.data.plan;
  const c = plan ? planChoices(plan) : { split: "Auto", focus: "Auto" };
  const p = { ...ctx.profile, days: opts.days ?? plan?.weekdays ?? ctx.profile.days };
  const next = generatePlan(p, opts.split ?? c.split, opts.focus ?? c.focus, opts.minutes ?? plan?.minutes ?? 0, Date.now());
  next.why.unshift(reason);
  const lines = next.days.map((d) => {
    const names = d.exercises.map((x) => nameOf(x.id));
    return `• ${d.title}: ${names.slice(0, 4).join(", ")}${names.length > 4 ? "…" : ""}`;
  });
  return {
    text: `${oneOf(DONE, ctx.turn)} ${reason}\n\nNew plan: ${next.split}, ${next.days.length} workout${next.days.length === 1 ? "" : "s"} a week (${next.weekdays.join(", ")}), about ${next.minutes} min each.\n${lines.join("\n")}`,
    apply: (d) => ({ ...d, plan: next }),
    change: "rebuilt your plan",
    quick: ["What should I train today?", "Why this plan?", "Undo"],
  };
}

const EQUIP_WORDS: [RegExp, Equip[]][] = [
  [/barbell/, ["barbell", "rack"]],
  [/dumbbells?/, ["dumbbell"]],
  [/\bbench\b/, ["bench"]],
  [/cables?/, ["cable"]],
  [/machines?/, ["machine"]],
  [/kettlebells?/, ["kettlebell"]],
  [/\bbands?\b/, ["band"]],
  [/pull ?up bar/, ["pullup"]],
  [/\brack\b/, ["rack"]],
  [/\bgym\b/, ["machine", "cable", "barbell", "rack", "bench"]],
];

/* ---------- Knowledge ---------- */
const POST_IDEAS: Record<string, string> = {
  Vegan: "rice with dal or rajma, or tofu or soya chunks curry with roti",
  Vegetarian: "curd rice, idli with sambar and a glass of milk, or chapati with paneer",
  Jain: "moong dal with rice, or chapati with paneer and curd",
  Eggetarian: "boiled eggs with idli or toast, or egg curry with rice",
  "Non-vegetarian": "chicken or fish curry with rice, or boiled eggs with idli",
};
const HEAD_TIPS: Record<string, string> = {
  Biceps: "Tip: the long head works hardest with your arms behind you (incline curls), the short head with your arms in front (preacher or concentration curls), and hammer or reverse curls train the brachialis.",
  Triceps: "Tip: overhead extensions stretch the long head, pushdowns hit the lateral head, and reverse-grip pushdowns bias the medial head.",
  Shoulders: "Tip: presses hit the front delts, lateral raises the side delts, and face pulls or reverse flyes the rear delts.",
  Chest: "Tip: incline pressing biases the upper chest, flat pressing the middle, and dips or decline work the lower chest.",
  Back: "Tip: pull-ups and pulldowns build the lats, rows the upper back, shrugs the traps, and hinges the lower back.",
};
const TARGETS: [string, RegExp][] = [
  ["Upper body", /upper body/],
  ["Lower body", /lower body/],
  ["Full body", /full body|whole body/],
  ["Chest", /\b(chest|pecs?)\b/],
  ["Back", /\bback\b|\blats?\b/],
  ["Shoulders", /\b(shoulders?|delts?)\b/],
  ["Arms", /\b(arms?|biceps?|triceps?)\b/],
  ["Legs", /\b(legs?|quads?|hamstrings?|glutes?)\b/],
  ["Core", /\b(core|abs|six ?pack)\b/],
  ["Cardio", /\b(cardio|stamina|conditioning)\b/],
];

/* ---------- Working out what you mean ---------- */
function detectIntent(q: string, e: Ent, ctx: BrainCtx): string {
  const n = q.split(" ").length;
  const hasEx = !!(e.ex || ctx.memory.exerciseId);
  if (/\b(undo|revert)\b|^(go back|change it back|put it back|cancel that)\b/.test(q)) return "undo";
  if (n <= 4 && /\b(hi|hello|hey|namaste|vanakkam|good (morning|evening|afternoon))\b/.test(q)) return "greet";
  if (n <= 5 && /\b(thanks|thank you|thx|ty|awesome|great|nice|cool|perfect)\b/.test(q)) return "thanks";
  if (/\bwater\b/.test(q) && /\b(drank|drink|drunk|had|log|add|logged)\b/.test(q) && !/\b(how much|should|enough)\b/.test(q)) return "log_water";
  if (/\b(i weigh|my weight is|weighed|weight (is|today|now)|log (my )?weight)\b/.test(q) && /\d/.test(q)) return "log_weight";
  if (/\b(slept|sleep was|got|had)\b.*\d+(\.\d+)?\s*(h|hr|hrs|hours?)\b/.test(q)) return "log_sleep";
  if (/\d[\d,]*\s*steps\b/.test(q) && !/\b(how many|should)\b/.test(q)) return "log_steps";
  if (
    n <= 10 && /\b(i'?m|i am|feeling|i feel|feel)\b/.test(q) &&
    /\b(tired|exhausted|sore|great|good|okay|ok|fine|sick|unwell|ill|fever|amazing)\b/.test(q) && !/\b(should|can i|why|how)\b/.test(q)
  ) return "log_feel";
  if (/\b(why|explain)\b/.test(q) && /\b(plan|routine|program)\b/.test(q)) return "explain_plan";
  if (/\b(show|see|view|list|what'?s in)\b/.test(q) && /\b(plan|routine|program|schedule)\b/.test(q)) return "show_plan";
  if (e.split && /\b(switch|change|make|want|use|try|move|convert|give|do|set|prefer|go)\b/.test(q)) return "split";
  if (
    (e.daysCount || e.weekdays.length >= 2) && /\b(train|training|workouts?|days?|week|schedule|available|free|gym)\b/.test(q) &&
    /\b(change|want|only|can|make|set|switch|move|train|available|free|prefer)\b/.test(q) && !/\b(missed|skipped)\b/.test(q)
  ) return "days";
  if (hasEx && (e.sets !== undefined || e.reps !== undefined) && !/\b(add|include)\b/.test(q)) return "setsreps";
  if (hasEx && /\b(what|which|how much|how heavy) (weight|kg|dumbbells?|kettlebell)\b|\bhow heavy\b|\bwhat weight\b|\bgo heavier\b|\bready to go (up|heavier)\b|\bincrease (the )?weight\b/.test(q)) return "weight_advice";
  if (
    (e.minutes && /\b(make|want|only|have|change|set|got)\b/.test(q) && /\b(workouts?|sessions?|training|plan|each|every|today|it)\b/.test(q)) ||
    /\b(shorter|longer|less time|more time)\b/.test(q)
  ) return "minutes";
  if (/\b(replace|swap|substitute|switch out)\b|\binstead of\b/.test(q) || (/\bchange\b/.test(q) && e.ex && e.ex2)) {
    if (/^(what|which|can i|could i|is there|any)\b/.test(q) && !/\b(replace|swap)\b/.test(q)) return "alternatives";
    return "replace";
  }
  if (/\b(remove|delete|drop|take out|get rid of|no more|don'?t want)\b/.test(q) && hasEx) return "remove";
  if (/\b(easier|too hard|lighter|less intense|tone it down|go easy|too difficult|struggling)\b/.test(q)) return "easier";
  if (/\b(harder|too easy|more intense|more challenging|tougher|step it up|level up|challenge me)\b/.test(q)) return "harder";
  if (
    /\b(don'?t|do not|dont|no longer|lost|without|no)\b.*\b(barbell|dumbbells?|bench|cables?|machines?|kettlebells?|bands?|pull ?up bar|rack|gym|equipment)\b/.test(q) ||
    /\b(at home|no gym|gym (is )?closed|travell?ing|hotel)\b/.test(q)
  ) return "equipment";
  if (/\b(shuffle|new exercises|different exercises|mix it up|bored|regenerate|rebuild|new plan|fresh plan)\b/.test(q)) return "shuffle";
  if ((e.regions.length || e.allHeads) && /\b(workout|routine|exercises?|train|hit|target|session|give|make|create|how)\b/.test(q) && !/\b(add|include|put|plan)\b/.test(q)) return "head_workout";
  if (/\b(add|include|put|throw in|more|extra)\b/.test(q) && (e.ex || e.muscle || e.regions.length)) return "add";
  if (e.focus && /\b(plan|training|workouts?|program|routine|focus)\b/.test(q) && /\b(focus|goal|switch|change|make|want|prioriti[sz]e|more)\b/.test(q)) return "focus";
  if (/\b(train today|workout today|do today|today'?s (workout|training|session)|what should i (train|do)|what do i train|what workout|what'?s (my )?(workout|training) (today|for today))\b/.test(q)) return "today";
  const target = TARGETS.some(([, re]) => re.test(q)) || /\b(home|bodyweight|no equipment|beginner)\b/.test(q);
  if (target && /\b(workout|routine|session|exercises|plan for|train my|make me|create|give me|build me)\b/.test(q)) return "workout_request";
  if (/\b(warm ?-?up|warming up)\b/.test(q)) return "warmup";
  if (e.ex && /\b(what|which) muscles?|\bmuscles? (worked|used)|\bwhat does .* (work|target|hit)\b/.test(q)) return "muscles_worked";
  if (e.ex && /\b(alternative|instead|substitute|replacement|similar)\b/.test(q)) return "alternatives";
  if (e.ex && /\b(how do i|how to|how can i|improve my|form|technique|proper way|how should i|tips for|correct way)\b/.test(q)) return "technique";
  if (/\b(missed|skipped|couldn'?t train|didn'?t train|haven'?t trained)\b/.test(q)) return "missed";
  if (/\b(plateau|stopped improving|not improving|stuck|stall|no progress|not getting stronger|not growing)\b/.test(q)) return "plateau";
  if (/\b(creatine|whey|protein powder|protein shake|supplements?|fat burners?)\b/.test(q)) return "supplements";
  if (/\bprotein\b/.test(q)) return "protein";
  if (/\b(after|post)\b.*\b(training|workout|gym|exercise)\b/.test(q) && /\b(eat|food|meal|have)\b/.test(q)) return "post_food";
  if (/\b(before|pre)\b.*\b(training|workout|gym|exercise)\b/.test(q) && /\b(eat|food|meal|have)\b/.test(q)) return "pre_food";
  if (/\b(calories?|kcal|how much should i eat|how much to eat|diet plan|meal plan|macros)\b/.test(q)) return "calories";
  if (/\b(lose weight|weight loss|lose fat|fat loss|belly|burn fat|slim)\b/.test(q)) return "weight_loss";
  if (/\b(gain muscle|build muscle|bulk|gain weight|get bigger|mass)\b/.test(q)) return "muscle_gain";
  if (/\b(sleep|tired|fatigue|exhausted|no energy|low energy)\b/.test(q)) return "sleep";
  if (/\b(water|hydrat\w*)\b/.test(q)) return "water_info";
  if (/\b(sore|doms|stiff)\b/.test(q)) return "sore";
  if (/\b(progress|how am i doing|my stats|how far|results)\b/.test(q)) return "progress";
  if (/\b(rest day|day off|skip today|take a break|recovery day)\b/.test(q)) return "rest";
  if (/\b(motivat\w*|lazy|don'?t feel like|give up|demotivated|no mood)\b/.test(q)) return "motivation";
  if (/\b(stretch\w*|flexib\w*|mobility|tight)\b/.test(q)) return "stretch";
  if (/\b(steps|walk\w*)\b/.test(q)) return "steps_info";
  return "help";
}

/* ---------- What the coach does for each request ---------- */
const HANDLERS: Record<string, Handler> = {
  undo: () => ({ text: "", undo: true }),

  greet: (ctx) => ({
    text: `Hi ${ctx.profile.name}! I'm your BYB coach. I can change your plan, suggest weights, log your food, water and sleep, make workouts and answer questions. What would you like to do?`,
    quick: ["What should I train today?", "Show my plan", "How much protein should I eat?"],
  }),

  thanks: (ctx) => ({ text: oneOf(["You're welcome! Keep it up 💪", "Anytime! You're doing great.", "Happy to help. Stay consistent!"], ctx.turn) }),

  log_water: (ctx, q) => {
    const m = q.match(/(\d+(?:\.\d+)?|a|an|one|two|three|four|five|six)\s*(glass(?:es)?|bottles?|litres?|liters?|ml|cups?)?/);
    const n = m ? toNum(m[1]) : 1;
    const unit = m?.[2] ?? "glass";
    let glasses = /bottle|litre|liter/.test(unit) ? n * 4 : /ml/.test(unit) ? Math.round(n / 250) : n;
    glasses = Number.isFinite(glasses) ? Math.max(1, Math.min(20, Math.round(glasses))) : 1;
    const date = dateKey();
    const now = (ctx.data.days[date]?.water ?? 0) + glasses;
    const goal = nutritionTargets(ctx.profile, ctx.data).water;
    return {
      text: `Logged ${glasses} glass${glasses === 1 ? "" : "es"} of water (250 ml each). You're at ${now} of ${goal} today.${now >= goal ? " Goal reached, nice! 💧" : ""}`,
      apply: (d) => updateDay(d, date, { water: (d.days[date]?.water ?? 0) + glasses }),
      change: `logged ${glasses} glass${glasses === 1 ? "" : "es"} of water`,
      quick: ["Undo"],
    };
  },

  log_weight: (ctx, q) => {
    const m = q.match(/(\d{2,3}(?:\.\d)?)\s*(kg|kgs|kilos?|lb|lbs|pounds?)?/);
    if (!m) return { text: "What's your weight? For example: \"I weigh 70.5 kg\"." };
    const value = Number(m[1]);
    const unit = m[2] ? (/^(lb|lbs|pound)/.test(m[2]) ? "lb" : "kg") : weightUnit(ctx.profile);
    const kg = unit === weightUnit(ctx.profile) ? fromUnit(value, ctx.profile) : unit === "lb" ? value / 2.20462 : value;
    if (kg < 30 || kg > 300) return { text: "That number looks unusual. Please check it and try again." };
    const before = latestWeightKg(ctx.profile, ctx.data);
    const diff = kg - before;
    const date = dateKey();
    return {
      text: `Logged ${showWeight(kg, ctx.profile)} for today.${Math.abs(diff) >= 0.1 ? ` That's ${diff > 0 ? "up" : "down"} ${showWeight(Math.abs(diff), ctx.profile)} from your last entry.` : ""} Daily weight goes up and down; the weekly trend on the Progress tab matters more.`,
      apply: (d) => setWeight(d, date, r1(kg)),
      change: "logged your weight",
      quick: ["Undo", "How am I doing?"],
    };
  },

  log_sleep: (_ctx, q) => {
    const m = q.match(/(\d+(?:\.\d+)?)\s*(h|hr|hrs|hours?)\b/);
    const hours = m ? Math.min(16, Math.max(0, Number(m[1]))) : 0;
    const date = dateKey();
    const tip = hours < 6 ? " That's on the low side, so keep today's training moderate and aim for an earlier night." : hours >= 7 ? " Great, that helps recovery." : "";
    return { text: `Logged ${hours} hours of sleep.${tip}`, apply: (d) => updateDay(d, date, { sleep: hours }), change: "logged your sleep", quick: ["Undo"] };
  },

  log_steps: (_ctx, q) => {
    const m = q.match(/(\d[\d,]*)\s*steps/);
    const steps = m ? Math.min(100000, Number(m[1].replace(/,/g, ""))) : 0;
    const date = dateKey();
    return {
      text: `Logged ${steps.toLocaleString()} steps for today.${steps >= 10000 ? " That's a 10K day! 🎉" : steps >= 7000 ? " Nice and active." : " Every walk counts."}`,
      apply: (d) => updateDay(d, date, { steps }),
      change: "logged your steps",
      quick: ["Undo"],
    };
  },

  log_feel: (ctx, q) => {
    const feel = /\b(sick|unwell|ill|fever)\b/.test(q) ? "Unwell" : /\b(tired|exhausted)\b/.test(q) ? "Tired" : /\bsore\b/.test(q) ? "Sore" : /\b(great|good|amazing)\b/.test(q) ? "Great" : "OK";
    const date = dateKey();
    const plan = ctx.data.plan;
    const idx = plan ? todaysIndex(plan, ctx.data.sessions) : -1;
    const advice: Record<string, string> = {
      Unwell: "Rest today. Training while unwell slows recovery. Drink water, and see a doctor if you don't feel better in a few days.",
      Tired: "Go lighter today: 1 fewer set per exercise and stop a few reps short of failure, or swap the session for a walk and stretching.",
      Sore: "Some soreness is normal. Train other muscles, keep it light, or go for a walk. Sharp pain is different, so stop if anything hurts.",
      Great: plan && idx >= 0 ? `Perfect day for ${plan.days[idx].title}. Want to start?` : "Love that. Make the most of it!",
      OK: "Thanks for letting me know.",
    };
    return {
      text: `Got it, I've noted that you feel ${feel.toLowerCase()} today. ${advice[feel]}`,
      apply: (d) => updateDay(d, date, { feel }),
      change: "noted how you feel",
      workout: feel === "Great" && plan && idx >= 0 ? plan.days[idx] : undefined,
      planIndex: feel === "Great" && idx >= 0 ? idx : undefined,
    };
  },

  explain_plan: (ctx) => {
    const plan = ctx.data.plan;
    if (!plan) return NO_PLAN;
    return { text: `Why your plan (${plan.split}) looks like this:\n${plan.why.map((w) => `• ${w}`).join("\n")}` };
  },

  show_plan: (ctx) => {
    const plan = ctx.data.plan;
    if (!plan) return NO_PLAN;
    const days = plan.days.map((d) => `${d.title} (about ${estimateMinutes(d)} min)\n${d.exercises.map((x) => `  • ${nameOf(x.id)}: ${x.sets} × ${x.reps}`).join("\n")}`);
    return { text: `Your plan: ${plan.split}, on ${plan.weekdays.join(", ")}.\n\n${days.join("\n\n")}`, quick: ["Add more biceps work to my plan", "Make it easier", "Give me new exercises"] };
  },

  split: (ctx, _q, e) => rebuild(ctx, { split: e.split }, `I switched your plan to ${e.split?.toLowerCase()}.`),
  focus: (ctx, _q, e) => rebuild(ctx, { focus: e.focus }, `Your plan now focuses on ${e.focus?.toLowerCase()}.`),
  shuffle: (ctx) => rebuild(ctx, {}, "I picked fresh exercises with the same settings."),

  days: (ctx, _q, e) => {
    let days = e.weekdays;
    if (days.length < 2 && e.daysCount) {
      const SPREAD: Record<number, string[]> = {
        1: ["Wed"], 2: ["Mon", "Thu"], 3: ["Mon", "Wed", "Fri"], 4: ["Mon", "Tue", "Thu", "Fri"],
        5: ["Mon", "Tue", "Wed", "Fri", "Sat"], 6: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], 7: WEEK_MON,
      };
      days = SPREAD[Math.max(1, Math.min(7, e.daysCount))];
    }
    if (!days.length) return { text: "Which days can you train? For example: \"Mon, Wed and Fri\" or \"4 days a week\"." };
    const capped = trainingWeekdays({ ...ctx.profile, days });
    const note = capped.length < days.length ? ` For your level I plan up to ${capped.length} training days; the others are for rest or light activity.` : "";
    return rebuild(ctx, { days }, `I changed your training days to ${days.join(", ")}.${note}`);
  },

  minutes: (ctx, q, e) => {
    const plan = ctx.data.plan;
    const current = plan?.minutes ?? (Number(ctx.profile.minutes) || 45);
    let mins = e.minutes ?? (/\b(shorter|less time)\b/.test(q) ? current - 15 : /\b(longer|more time)\b/.test(q) ? current + 15 : current);
    mins = Math.max(15, Math.min(120, mins));
    if (plan && /\b(today|now|this session)\b/.test(q)) {
      const idx = todaysIndex(plan, ctx.data.sessions);
      const nextIdx = upcoming(plan, ctx.data.sessions, 1)[0]?.index ?? 0;
      const base = plan.days[idx >= 0 ? idx : nextIdx];
      const trimmed = trimDay(base, mins);
      return {
        text: `Here's a ${mins}-minute version of ${base.title} for today, keeping the most important exercises first:\n${listDay(trimmed)}\n\nYour plan stays the same for other days.`,
        workout: trimmed,
      };
    }
    return rebuild(ctx, { minutes: mins }, `Your workouts are now about ${mins} minutes.`);
  },

  replace: (ctx, _q, e) => {
    const plan = ctx.data.plan;
    if (!plan) return NO_PLAN;
    const from = e.ex ?? (ctx.memory.exerciseId ? byId(ctx.memory.exerciseId) : undefined);
    if (!from) return { text: "Which exercise should I replace? For example: \"replace bench press with push-ups\".", quick: planNames(plan).slice(0, 3).map((n) => `Replace ${n}`) };
    const days = daysWith(plan, from.id, e.day);
    if (!days.length) return { text: `${from.name} isn't in ${e.day !== undefined ? plan.days[e.day].title : "your plan"}. Want me to add it instead?`, quick: [`Add ${from.name}`] };
    const to = e.ex2;
    if (!to || to.id === from.id) {
      const options = alternatives(from.id, ctx.profile, focusOf(ctx.data)).slice(0, 4);
      if (!options.length) return { text: `I couldn't find a swap for ${from.name} that fits your equipment and pain areas. I can remove it instead.`, quick: [`Remove ${from.name}`] };
      return {
        text: `Good swaps for ${from.name}. They train the same movement and fit your equipment${ctx.profile.painAreas.length ? " and pain areas" : ""}. Tap one:`,
        quick: options.map((o) => `Replace ${from.name} with ${o.name}`),
        memory: { exerciseId: from.id },
      };
    }
    if (!isSafeFor(to, ctx.profile)) {
      const areas = to.avoid.filter((a) => ctx.profile.painAreas.includes(a));
      const safer = alternatives(from.id, ctx.profile).slice(0, 3);
      return {
        text: `I'd rather not swap in ${to.name}: you mentioned ${areas.join(", ").toLowerCase()} pain, and it usually loads that area.${safer.length ? " These are safer options:" : ""}`,
        quick: safer.map((o) => `Replace ${from.name} with ${o.name}`),
      };
    }
    const focus = focusOf(ctx.data);
    const same = to.muscle === from.muscle && regionOf(to) === regionOf(from);
    return {
      text: `${oneOf(DONE, ctx.turn)} I swapped ${from.name} for ${to.name} in ${joinNames(days.map((i) => plan.days[i].title))}. ${
        same ? `It trains the same area (${to.muscle.toLowerCase()}, ${regionOf(to).toLowerCase()}).` : `Heads up: it trains ${to.muscle.toLowerCase()} (${regionOf(to).toLowerCase()}), which isn't quite the same as ${from.name}.`
      }${equipNote(to, ctx.profile)}`,
      apply: (d) =>
        d.plan ? { ...d, plan: mapDays(d.plan, (day, i) => (days.includes(i) ? { ...day, exercises: day.exercises.map((x) => (x.id === from.id ? swapIn(x, to.id, ctx.profile, focus) : x)) } : day)) } : d,
      change: `swapped ${from.name} for ${to.name}`,
      quick: ["Undo", "Show my plan"],
      memory: { exerciseId: to.id },
    };
  },

  remove: (ctx, _q, e) => {
    const plan = ctx.data.plan;
    if (!plan) return NO_PLAN;
    const ex = e.ex ?? (ctx.memory.exerciseId ? byId(ctx.memory.exerciseId) : undefined);
    if (!ex) return { text: "Which exercise should I remove?" };
    const days = daysWith(plan, ex.id, e.day);
    if (!days.length) return { text: `${ex.name} isn't in ${e.day !== undefined ? plan.days[e.day].title : "your plan"}.` };
    const lonely = days.filter((i) => plan.days[i].exercises.length <= 1);
    if (lonely.length) return { text: `${ex.name} is the only exercise in ${plan.days[lonely[0]].title}, so I can't remove it. Want to replace it instead?`, quick: [`Replace ${ex.name}`] };
    return {
      text: `${oneOf(DONE, ctx.turn)} I removed ${ex.name} from ${joinNames(days.map((i) => plan.days[i].title))}.`,
      apply: (d) => (d.plan ? { ...d, plan: mapDays(d.plan, (day, i) => (days.includes(i) ? { ...day, exercises: day.exercises.filter((x) => x.id !== ex.id) } : day)) } : d),
      change: `removed ${ex.name}`,
      quick: ["Undo", `Add another ${ex.muscle.toLowerCase()} exercise`],
    };
  },

  add: (ctx, _q, e) => {
    const plan = ctx.data.plan;
    if (!plan) return NO_PLAN;
    const cap = setCap(ctx.profile);
    const focus = focusOf(ctx.data);
    const used = new Set(plan.days.flatMap((d) => d.exercises.map((x) => x.id)));
    const extra: Record<number, number> = {};
    const room = (i: number) => cap - daySets(plan.days[i]) - (extra[i] ?? 0);
    const adds: { day: number; px: PlanExercise; ex: Exercise }[] = [];
    const place = (ex: Exercise, preferDay?: number) => {
      const px = prescribe(ex.id, ctx.profile, focus);
      if (!px) return false;
      for (const i of preferDay !== undefined ? [preferDay] : dayOrder(plan, ex.muscle)) {
        if (room(i) >= 2) {
          px.sets = Math.min(px.sets, room(i));
          extra[i] = (extra[i] ?? 0) + px.sets;
          adds.push({ day: i, px, ex });
          return true;
        }
      }
      return false;
    };

    if (e.ex) {
      const ex = e.ex;
      if (!isSafeFor(ex, ctx.profile)) {
        const safer = alternatives(ex.id, ctx.profile).slice(0, 3);
        return { text: `I'd rather not add ${ex.name}, because it usually loads an area you said is painful.${safer.length ? " Safer options:" : ""}`, quick: safer.map((o) => `Add ${o.name}`) };
      }
      if (e.day !== undefined && plan.days[e.day].exercises.some((x) => x.id === ex.id)) return { text: `${ex.name} is already in ${plan.days[e.day].title}.` };
      if (!place(ex, e.day)) {
        return {
          text: `${e.day !== undefined ? plan.days[e.day].title : "Your workouts"} already ${e.day !== undefined ? "has" : "have"} the most sets I recommend for your level (${cap} per session). Want me to replace an exercise instead?`,
          quick: [`Replace ${nameOf(plan.days[e.day ?? 0].exercises[0]?.id ?? "")}`],
        };
      }
    } else {
      const muscle = e.muscle;
      if (!muscle) return { text: "What should I add? For example: \"add hammer curls to pull day\" or \"add more rear delt work\"." };
      const specific = (REGIONS[muscle] ?? []).filter((r) => !/both heads|all three/i.test(r));
      let targets = e.regions.length && !e.allHeads ? e.regions : [];
      if (!targets.length) {
        if (specific.length) {
          const present = new Set(
            plan.days.flatMap((d) => d.exercises.map((x) => byId(x.id)).filter((x): x is Exercise => !!x && x.muscle === muscle).map((x) => regionOf(x))),
          );
          const missing = specific.filter((r) => !present.has(r));
          targets = e.allHeads ? specific : missing.length ? missing : specific.slice(0, 1);
        } else {
          targets = [muscle === "Quadriceps" ? "Quads" : muscle];
        }
      }
      for (const region of targets.slice(0, 4)) {
        const ex = bestForRegion(ctx, muscle, region, used);
        if (ex) {
          used.add(ex.id);
          place(ex, e.day);
        }
      }
      if (!adds.length) return { text: `I couldn't add more ${muscle.toLowerCase()} work: either your sessions are at the set limit for your level (${cap}), or no suitable exercise fits your equipment and pain areas.` };
    }
    return {
      text: `${oneOf(DONE, ctx.turn)} I added:\n${adds.map((a) => `• ${a.ex.name} (${a.px.sets} × ${a.px.reps}) to ${plan.days[a.day].title}, for ${a.ex.muscle.toLowerCase()}: ${regionOf(a.ex).toLowerCase()}`).join("\n")}${adds.length === 1 ? equipNote(adds[0].ex, ctx.profile) : ""}`,
      apply: (d) =>
        d.plan
          ? {
              ...d,
              plan: mapDays(d.plan, (day, i) => {
                const mine = adds.filter((a) => a.day === i).map((a) => a.px);
                return mine.length ? { ...day, exercises: [...day.exercises, ...mine] } : day;
              }),
            }
          : d,
      change: `added ${joinNames(adds.map((a) => a.ex.name))}`,
      quick: ["Undo", "Show my plan"],
    };
  },

  setsreps: (ctx, _q, e) => {
    const plan = ctx.data.plan;
    if (!plan) return NO_PLAN;
    const ex = e.ex ?? (ctx.memory.exerciseId ? byId(ctx.memory.exerciseId) : undefined);
    if (!ex) return { text: "Which exercise? For example: \"make bench press 4 sets of 8\"." };
    const days = daysWith(plan, ex.id, e.day);
    if (!days.length) return { text: `${ex.name} isn't in your plan. Want me to add it?`, quick: [`Add ${ex.name}`] };
    const cap = setCap(ctx.profile);
    let sets = e.sets !== undefined ? Math.max(1, Math.min(8, e.sets)) : undefined;
    let capped = false;
    if (sets !== undefined) {
      for (const i of days) {
        const current = plan.days[i].exercises.find((x) => x.id === ex.id)?.sets ?? 0;
        const roomLeft = cap - daySets(plan.days[i]) + current;
        if (sets > roomLeft) {
          sets = Math.max(1, roomLeft);
          capped = true;
        }
      }
    }
    const finalSets = sets;
    const reps = e.reps;
    const what = [finalSets !== undefined ? `${finalSets} sets` : "", reps ? `${reps} ${UNIT_LABEL[ex.unit]}` : ""].filter(Boolean).join(" of ");
    return {
      text: `${oneOf(DONE, ctx.turn)} ${ex.name} is now ${what} in ${joinNames(days.map((i) => plan.days[i].title))}.${capped ? ` I capped the sets so each day stays within ${cap}, the most I recommend for your level.` : ""}`,
      apply: (d) =>
        d.plan
          ? { ...d, plan: mapDays(d.plan, (day, i) => (days.includes(i) ? { ...day, exercises: day.exercises.map((x) => (x.id === ex.id ? { ...x, sets: finalSets ?? x.sets, reps: reps ?? x.reps } : x)) } : day)) }
          : d,
      change: `changed ${ex.name} to ${what}`,
      quick: ["Undo"],
      memory: { exerciseId: ex.id },
    };
  },

  weight_advice: (ctx, _q, e) => {
    const ex = e.ex ?? (ctx.memory.exerciseId ? byId(ctx.memory.exerciseId) : undefined);
    if (!ex) return { text: "Which exercise? For example: \"what weight should I use for goblet squats?\"" };
    const planned = ctx.data.plan?.days.flatMap((d) => d.exercises).find((x) => x.id === ex.id);
    const px = planned ?? prescribe(ex.id, ctx.profile);
    if (!px) return { text: "I couldn't work that out for this exercise." };
    const s = suggest(px, ctx.profile, ctx.data);
    const load = loadText(ex, s, ctx.profile);
    const last = s.last ? `\nLast time: ${s.last.kg > 0 ? `${showWeight(s.last.kg, ctx.profile)} × ` : ""}${s.last.reps.join(", ")}.` : "";
    return {
      text: `${ex.name}: ${px.sets} × ${s.reps} ${UNIT_LABEL[ex.unit]}${load ? ` with ${load}` : ""}.${last}\n\n${s.note}`,
      memory: { exerciseId: ex.id },
      quick: s.needsGear ? undefined : [`How do I do ${ex.name}?`],
    };
  },

  easier: (ctx, _q, e) => {
    const plan = ctx.data.plan;
    if (!plan) return NO_PLAN;
    const scope = e.day !== undefined ? [e.day] : plan.days.map((_, i) => i);
    const onlyId = e.ex?.id;
    const equip = availableEquip(ctx.profile);
    const changes: string[] = [];
    const next = mapDays(plan, (day, i) =>
      !scope.includes(i)
        ? day
        : {
            ...day,
            exercises: day.exercises.map((x) => {
              if (onlyId && x.id !== onlyId) return x;
              const ex = byId(x.id);
              const easy = ex?.easier ? byId(ex.easier) : undefined;
              if (ex && easy && canDo(easy, equip) && isSafeFor(easy, ctx.profile)) {
                changes.push(`${ex.name} → ${easy.name}`);
                return { ...x, id: easy.id };
              }
              if (x.sets > 2) {
                changes.push(`${ex?.name ?? x.id}: ${x.sets} → ${x.sets - 1} sets`);
                return { ...x, sets: x.sets - 1 };
              }
              return x;
            }),
          },
    );
    if (!changes.length) return { text: "Your plan is already at the easiest setting I'd suggest. Use lighter weights, stop 3–4 reps before failure, or take an extra rest day this week." };
    return {
      text: `${oneOf(DONE, ctx.turn)} I made it easier:\n${changes.slice(0, 8).map((c) => `• ${c}`).join("\n")}${changes.length > 8 ? `\n…and ${changes.length - 8} more` : ""}\n\nAlso use lighter weights and stop 2–3 reps before failure. You still make progress this way.`,
      apply: (d) => ({ ...d, plan: next }),
      change: "made your plan easier",
      quick: ["Undo"],
    };
  },

  harder: (ctx, _q, e) => {
    const plan = ctx.data.plan;
    if (!plan) return NO_PLAN;
    if (hasHealthFlag(ctx.profile)) return { text: "Because of your health answers, I'll keep the intensity where it is. Please check with your doctor before training harder." };
    const feel = ctx.data.days[dateKey()]?.feel;
    if (feel === "Tired" || feel === "Unwell" || feel === "Sore") return { text: `You told me you feel ${feel.toLowerCase()} today, so I'll hold off on making things harder. Ask me again when you feel fresh.` };
    const last = ctx.data.sessions[ctx.data.sessions.length - 1];
    if (last?.effort === "Hard" || last?.effort === "Too hard") return { text: "Your last workout felt hard, so I'd keep the current plan a bit longer. You progress from training you can recover from." };
    const cap = setCap(ctx.profile);
    const lvl = allowedLevel(ctx.profile);
    const equip = availableEquip(ctx.profile);
    const scope = e.day !== undefined ? [e.day] : plan.days.map((_, i) => i);
    const onlyId = e.ex?.id;
    const changes: string[] = [];
    const next = mapDays(plan, (day, i) => {
      if (!scope.includes(i)) return day;
      let total = daySets(day);
      return {
        ...day,
        exercises: day.exercises.map((x) => {
          if (onlyId && x.id !== onlyId) return x;
          const ex = byId(x.id);
          const hard = ex?.harder ? byId(ex.harder) : undefined;
          if (ex && hard && hard.level <= lvl && canDo(hard, equip) && isSafeFor(hard, ctx.profile)) {
            changes.push(`${ex.name} → ${hard.name}`);
            return { ...x, id: hard.id };
          }
          if (total < cap && x.sets < 5 && ex?.unit !== "min") {
            total += 1;
            changes.push(`${ex?.name ?? x.id}: ${x.sets} → ${x.sets + 1} sets`);
            return { ...x, sets: x.sets + 1 };
          }
          return x;
        }),
      };
    });
    if (!changes.length) return { text: `Your plan is already at the most I recommend for your level (${cap} sets per session). To progress, add a little weight or 1 rep when sets feel easy.` };
    return {
      text: `${oneOf(DONE, ctx.turn)} I stepped it up:\n${changes.slice(0, 8).map((c) => `• ${c}`).join("\n")}${changes.length > 8 ? `\n…and ${changes.length - 8} more` : ""}\n\nI stayed within ${cap} sets per session so you can still recover.`,
      apply: (d) => ({ ...d, plan: next }),
      change: "made your plan harder",
      quick: ["Undo"],
    };
  },

  equipment: (ctx, q) => {
    if (/\b(at home|no gym|gym (is )?closed|travell?ing|hotel)\b/.test(q) && !/\b(don'?t|do not|dont|no longer) have\b/.test(q)) {
      const plan = ctx.data.plan;
      const idx = plan ? todaysIndex(plan, ctx.data.sessions) : -1;
      const title = plan && idx >= 0 ? plan.days[idx].title.toLowerCase() : "";
      const target = /push|pull|upper|chest|back|arm|shoulder/.test(title) ? "Upper body" : /leg|lower/.test(title) ? "Lower body" : "Full body";
      const w = quickWorkout(ctx.profile, target, Number(ctx.profile.minutes) || 30, true);
      return {
        text: `No problem. Here's a ${target.toLowerCase()} bodyweight workout you can do anywhere:\n${listDay(w)}\n\nYour plan stays the same. If you'll train at home for a while, change "Where you train" in Profile → Edit my answers and I'll rebuild your plan.`,
        workout: w,
      };
    }
    const plan = ctx.data.plan;
    if (!plan) return NO_PLAN;
    const missing = [...new Set(EQUIP_WORDS.filter(([re]) => re.test(q)).flatMap(([, eq]) => eq))];
    if (!missing.length) return { text: "Which equipment don't you have? For example: \"I don't have a barbell\"." };
    const focus = focusOf(ctx.data);
    const equip = availableEquip(ctx.profile, focus);
    missing.forEach((m) => equip.delete(m));
    const lvl = allowedLevel(ctx.profile);
    const changes: string[] = [];
    const next = mapDays(plan, (day) => {
      const kept: PlanExercise[] = [];
      for (const x of day.exercises) {
        const ex = byId(x.id);
        if (!ex || canDo(ex, equip)) {
          kept.push(x);
          continue;
        }
        const swap = EXERCISES.filter(
          (o) => o.pattern === ex.pattern && o.id !== ex.id && canDo(o, equip) && isSafeFor(o, ctx.profile) && o.level <= lvl && !kept.some((k) => k.id === o.id),
        ).sort(
          (a, b) => Number(regionOf(b) === regionOf(ex)) - Number(regionOf(a) === regionOf(ex)) || Number(isImported(a)) - Number(isImported(b)) || a.level - b.level,
        )[0];
        if (swap) {
          kept.push(swapIn(x, swap.id, ctx.profile, focus));
          changes.push(`${day.title}: ${ex.name} → ${swap.name}`);
        } else {
          changes.push(`${day.title}: removed ${ex.name} (no swap without that equipment)`);
        }
      }
      return { ...day, exercises: kept.length ? kept : day.exercises };
    });
    const gear = joinNames(missing.map((m) => EQUIP_LABEL[m].toLowerCase()));
    if (!changes.length) return { text: `Good news: none of your current exercises need ${gear}.` };
    return {
      text: `${oneOf(DONE, ctx.turn)} I changed the exercises that needed ${gear}:\n${changes.slice(0, 10).map((c) => `• ${c}`).join("\n")}${changes.length > 10 ? `\n…and ${changes.length - 10} more` : ""}\n\nTo keep this for future plans, update your equipment in Profile → Edit my answers.`,
      apply: (d) => ({ ...d, plan: next }),
      change: "replaced exercises that needed missing equipment",
      quick: ["Undo", "Show my plan"],
    };
  },

  today: (ctx) => {
    const plan = ctx.data.plan;
    if (!plan) return NO_PLAN;
    const date = dateKey();
    const feel = ctx.data.days[date]?.feel;
    if (trainedOn(ctx.data.sessions, date)) {
      const nx = upcoming(plan, ctx.data.sessions, 1)[0];
      return { text: `You've already trained today. Nice work! Rest, eat well and drink water.${nx ? ` Next up: ${plan.days[nx.index].title} on ${weekdayOf(nx.date)}.` : ""}` };
    }
    const feelNote =
      feel === "Unwell"
        ? "\n\nYou said you feel unwell, so I'd rest today instead."
        : feel === "Tired" || feel === "Sore"
          ? `\n\nYou said you feel ${feel.toLowerCase()}, so do 1 fewer set per exercise and keep it light.`
          : "";
    const idx = todaysIndex(plan, ctx.data.sessions);
    if (idx >= 0) {
      const day = plan.days[idx];
      return {
        text: `Today is ${day.title} (${day.focus}), about ${estimateMinutes(day)} min:\n${listDay(day)}${feelNote}\n\nTap Start below when you're ready.`,
        workout: feel === "Unwell" ? undefined : day,
        planIndex: idx,
        quick: ["Make it 30 minutes for today", "How should I warm up?", "Swap an exercise"],
        memory: { dayIndex: idx },
      };
    }
    const nx = upcoming(plan, ctx.data.sessions, 1)[0];
    const nextDay = nx ? plan.days[nx.index] : undefined;
    return {
      text: `Today is a rest day in your plan. A walk or 10 minutes of stretching is perfect.${nextDay && nx ? `\n\nNext workout: ${nextDay.title} on ${weekdayOf(nx.date)}, ${prettyDate(nx.date)}. Want to train today anyway? Tap Start below.` : ""}`,
      workout: nextDay,
      planIndex: nx ? nx.index : undefined,
    };
  },

  workout_request: (ctx, q) => {
    const target = TARGETS.find(([, re]) => re.test(q))?.[0] ?? "Full body";
    const bodyweight = /\b(home|bodyweight|body weight|no equipment|without equipment|hostel|room)\b/.test(q);
    const beginner = /\b(beginner|first time|easy|simple|new to)\b/.test(q);
    const m = q.match(/(\d{2,3})\s*(?:min|mins|minutes)\b/);
    const minutes = m ? Math.max(10, Math.min(120, Number(m[1]))) : Number(ctx.profile.minutes) || 30;
    const who: Profile = beginner ? { ...ctx.profile, level: "Absolute beginner" } : ctx.profile;
    const w = quickWorkout(who, target, minutes, bodyweight);
    if (!w.exercises.length) return { text: `I couldn't build a ${target.toLowerCase()} workout with your equipment and health answers. Try "full body workout at home".` };
    return {
      text: `Here's a ${target.toLowerCase()} workout, about ${estimateMinutes(w)} min${bodyweight ? " with no equipment" : ""}:\n${listDay(w)}\n\nIt matches your ${beginner ? "beginner" : ctx.profile.level.toLowerCase()} level${bodyweight ? "" : " and equipment"}${ctx.profile.painAreas.length ? `, and leaves out moves that load your ${ctx.profile.painAreas.join(", ").toLowerCase()}` : ""}. Warm up first, and stop any exercise that hurts.`,
      workout: w,
      quick: [`Give me another ${target.toLowerCase()} workout`, "How should I warm up?"],
    };
  },

  head_workout: (ctx, q, e) => {
    const muscle = e.muscle ?? "Biceps";
    const specific = (REGIONS[muscle] ?? []).filter((r) => !/both heads|all three/i.test(r));
    const targets = e.regions.length && !e.allHeads ? e.regions : specific;
    const day = headWorkout(ctx, muscle, targets, /\b(home|bodyweight|no equipment)\b/.test(q));
    if (!day) return { text: `I couldn't find ${muscle.toLowerCase()} exercises for that with your equipment and pain areas. Try the Exercise library and filter by muscle.` };
    return {
      text: `Here's a ${muscle.toLowerCase()} workout that hits ${joinNames(targets.map((r) => r.toLowerCase()))}:\n${listDay(day)}\n\n${HEAD_TIPS[muscle] ?? ""}`,
      workout: day,
      quick: [`Add more ${muscle.toLowerCase()} work to my plan`],
    };
  },

  technique: (ctx, _q, e) => {
    const ex = e.ex ?? (ctx.memory.exerciseId ? byId(ctx.memory.exerciseId) : undefined);
    if (!ex) return { text: "Which exercise? For example: \"how do I improve my squat?\"" };
    const easier = ex.easier ? byId(ex.easier) : undefined;
    const warn = !isSafeFor(ex, ctx.profile) ? "\n\n⚠ You mentioned pain in an area this exercise loads. Please check with a doctor or physiotherapist first." : "";
    return {
      text: `${ex.name} (${LEVEL_NAME[ex.level]}, works ${ex.muscle.toLowerCase()}: ${regionOf(ex).toLowerCase()})\n\nHow to do it:\n${ex.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}${ex.mistakes.length ? `\n\nCommon mistakes:\n${ex.mistakes.map((m) => `• ${m}`).join("\n")}` : ""}\n\nSafety: ${ex.safety}\n\nTo improve it:\n• Practise with a light weight and film yourself from the side.\n• Add reps before adding weight, then add weight in small steps.\n• Train it about twice a week.${easier ? `\n• If it feels too hard, build up with ${easier.name} first.` : ""}${warn}\n\nThe Exercise library has photos and a demo video link for it.`,
      memory: { exerciseId: ex.id },
    };
  },

  alternatives: (ctx, _q, e) => {
    const ex = e.ex ?? (ctx.memory.exerciseId ? byId(ctx.memory.exerciseId) : undefined);
    if (!ex) return { text: "Which exercise? For example: \"alternative to bench press\"." };
    const alts = alternatives(ex.id, ctx.profile).slice(0, 5);
    if (!alts.length) return { text: `I couldn't find an alternative to ${ex.name} that fits your equipment and pain areas.` };
    const inPlan = !!ctx.data.plan && daysWith(ctx.data.plan, ex.id).length > 0;
    return {
      text: `Instead of ${ex.name}, you could do:\n${alts.map((a) => `• ${a.name} (${regionOf(a).toLowerCase()}, ${LEVEL_NAME[a.level].toLowerCase()})`).join("\n")}\n\nAll of these fit your equipment${ctx.profile.painAreas.length ? " and pain areas" : ""}.${inPlan ? " Tap one to swap it into your plan." : ""}`,
      quick: inPlan ? alts.slice(0, 3).map((a) => `Replace ${ex.name} with ${a.name}`) : undefined,
      memory: { exerciseId: ex.id },
    };
  },

  muscles_worked: (_ctx, _q, e) => {
    const ex = e.ex;
    if (!ex) return { text: "Which exercise?" };
    return {
      text: `${ex.name} mainly works your ${ex.muscle.toLowerCase()} (${regionOf(ex).toLowerCase()})${ex.secondary.length ? `, and also your ${joinNames(ex.secondary.map((s) => s.toLowerCase()))}` : ""}.`,
      memory: { exerciseId: ex.id },
    };
  },

  warmup: (ctx) => {
    const plan = ctx.data.plan;
    const idx = plan ? todaysIndex(plan, ctx.data.sessions) : -1;
    const nx = plan ? upcoming(plan, ctx.data.sessions, 1)[0] : undefined;
    const day = plan && idx >= 0 ? plan.days[idx] : plan && nx ? plan.days[nx.index] : quickWorkout(ctx.profile, "Full body", 30);
    return { text: `A good warm-up before ${day.title}:\n• ${warmUp(day).join("\n• ")}\n\nIt takes about 5–8 minutes and helps you move better and stay safe.` };
  },

  missed: (ctx) => {
    const plan = ctx.data.plan;
    if (!plan) return { text: "No problem. Create a plan in Workouts and BYB will keep track of your schedule for you." };
    const missed = missedCount(plan, ctx.data.sessions);
    const nx = upcoming(plan, ctx.data.sessions, 1)[0];
    const nextDay = nx ? plan.days[nx.index] : undefined;
    return {
      text: `No problem, it happens to everyone.${missed ? ` I count ${missed} missed this week.` : ""}\n\nHere's how to adjust:\n• Don't try to catch up by doubling up workouts.\n• Your plan rotates, so the missed workout simply comes next: ${nextDay ? `${nextDay.title}${nx ? ` (${weekdayOf(nx.date)})` : ""}` : "your next session"}.\n• After more than a week off, use about 20% lighter weights for your first session back.\n• If your schedule has changed, tell me, for example "I can only train Mon, Wed and Fri".`,
      workout: nextDay,
      planIndex: nx ? nx.index : undefined,
    };
  },

  plateau: (ctx) => {
    const t = nutritionTargets(ctx.profile, ctx.data);
    const tips = plateauTips(ctx.data);
    return {
      text: `When progress stalls, check these:\n• Sleep: are you getting 7–9 hours?\n• Food: enough protein (about ${t.protein} g a day) and enough total food?\n• Progressive overload: are you adding a rep or a little weight over time?\n• Recovery: if you always feel tired, take one lighter week (about half the sets), then build back up.\n• Variety: after 8–12 weeks, swapping a few exercises can help.${tips.length ? `\n\nFrom your history:\n• ${tips.join("\n• ")}` : ""}`,
      quick: ["Give me new exercises", "Make it easier"],
    };
  },

  protein: (ctx) => {
    const t = nutritionTargets(ctx.profile, ctx.data);
    const kg = latestWeightKg(ctx.profile, ctx.data) || 60;
    const picks = ctx.foods ? proteinPicks(ctx.foods, ctx.profile, preferredZones(ctx.profile), 6) : [];
    return {
      text: `A good target for you is about ${t.protein} g of protein a day (about ${r1(t.protein / kg)} g per kg of body weight), based on your goals. That's roughly ${Math.round(t.protein / 4)} g at each of 4 meals or snacks.${picks.length ? `\n\nGood options that fit your diet:\n${picks.map((pk) => `• ${pk.food.n}, ${pk.label}: about ${pk.protein} g`).join("\n")}` : ""}\n\nIf you have kidney problems, check with your doctor first.`,
      quick: ["Show suggested foods"],
    };
  },

  post_food: (ctx) => {
    const picks = ctx.foods ? proteinPicks(ctx.foods, ctx.profile, preferredZones(ctx.profile), 3) : [];
    return {
      text: `After training, have a meal with protein and carbs within a couple of hours. It helps your muscles recover.\n\nIdeas for your diet:\n• ${POST_IDEAS[ctx.profile.diet] ?? "rice with dal, or eggs with idli"}${picks.length ? `\n• Protein-rich picks: ${picks.map((pk) => `${pk.food.n} (${pk.protein} g protein per ${pk.label})`).join("; ")}` : ""}\n\nDrink water too, because you lose fluid when you sweat.`,
    };
  },

  pre_food: () => ({
    text: "1–2 hours before training, eat something light with carbs: a banana, 2–3 dates, idli, poha or oats. Avoid heavy or oily food right before. If you train early in the morning, a banana or a few dates is enough.",
  }),

  calories: (ctx) => {
    if (ctx.profile.foodTracking === "Keep it simple") {
      return { text: "You chose to keep food simple, so here's a plate guide instead of numbers:\n• Half your plate: vegetables or salad.\n• A quarter: protein (dal, paneer, tofu, eggs, fish or chicken, whatever fits your diet).\n• A quarter: rice, roti or millets.\nEat slowly and stop when you're comfortably full." };
    }
    const t = nutritionTargets(ctx.profile, ctx.data);
    return { text: `Your estimated daily target is about ${t.kcal} kcal (maintenance is roughly ${t.maintenance} kcal), with about ${t.protein} g protein, ${t.carbs} g carbs and ${t.fat} g fat.\n\n${t.notes.join("\n")}` };
  },

  weight_loss: () => ({
    text: "For steady fat loss:\n• Eat in a small calorie deficit. BYB's food targets include one if weight loss is your main goal.\n• Keep protein high to protect your muscle.\n• Keep strength training; it helps you keep muscle while you lose fat.\n• Walk more, because steps add up.\n• Sleep 7–9 hours.\n\nYou can't choose where fat comes off first (like the belly), and progress is rarely a straight line. About 0.25–0.75 kg a week is a sensible pace.",
  }),

  muscle_gain: (ctx) => ({
    text: `To build muscle:\n• Follow your plan and add reps or weight gradually (progressive overload). BYB suggests your next weights after each workout.\n• Eat enough. A small surplus helps, and BYB adds one if building muscle is your main goal.\n• Protein: about ${nutritionTargets(ctx.profile, ctx.data).protein} g a day.\n• Sleep 7–9 hours.\n• Be patient: visible change usually takes months, not weeks.`,
  }),

  sleep: (ctx) => {
    const today = dateKey();
    const sleeps = Object.entries(ctx.data.days)
      .filter(([k, d]) => k > addDays(today, -7) && typeof d.sleep === "number")
      .map(([, d]) => d.sleep ?? 0);
    const avg = sleeps.length ? r1(sleeps.reduce((a, b) => a + b, 0) / sleeps.length) : null;
    return {
      text: `${avg !== null ? `You've averaged ${avg} hours of sleep this week. ` : ""}For better recovery and energy:\n• Aim for 7–9 hours.\n• Keep a regular bed and wake-up time.\n• Screens off 30 minutes before bed.\n• Avoid caffeine late in the day.\n\nIf you feel tired today, do a lighter session or take a walk instead. If you're tired all the time, please see a doctor.`,
      quick: ["I feel tired", "Make it easier"],
    };
  },

  water_info: (ctx) => ({
    text: `Aim for about ${nutritionTargets(ctx.profile, ctx.data).water} glasses (250 ml each) a day, more on hot days and training days. You can tell me "drank 2 glasses" and I'll log it.`,
  }),

  sore: () => ({
    text: "Muscle soreness 1–3 days after a new or harder workout is normal (it's called DOMS). Gentle movement, walking, sleep and good food help, and you can train other muscles meanwhile. Sharp pain, swelling, or pain that doesn't get better after a few days is different: please see a doctor or physiotherapist.",
  }),

  progress: (ctx) => {
    const today = dateKey();
    const ws = weekStart(today);
    const week = ctx.data.sessions.filter((s) => s.date >= ws).length;
    const month = ctx.data.sessions.filter((s) => s.date > addDays(today, -30)).length;
    const now = latestWeightKg(ctx.profile, ctx.data);
    const change = now - profileWeightKg(ctx.profile);
    return {
      text: `Here's how you're doing, ${ctx.profile.name}:\n• This week: ${week} of ${ctx.data.plan?.weekdays.length ?? 0} planned workouts\n• Last 30 days: ${month} workouts\n• Logging streak: ${logStreak(ctx.data)} days · Training streak: ${weekStreak(ctx.data)} weeks\n• Personal records set: ${recordCount(ctx.data)}\n• Weight: ${showWeight(now, ctx.profile)} (${change >= 0 ? "+" : "−"}${showWeight(Math.abs(change), ctx.profile)} since you started)\n\nOpen the Progress tab for charts and reports.`,
    };
  },

  supplements: (_ctx, q) => {
    if (/fat burner/.test(q)) return { text: "I don't recommend fat burners. Many have little evidence behind them, and some contain stimulants that can raise your heart rate and blood pressure. Food, training, steps and sleep do the real work." };
    if (/creatine/.test(q)) return { text: "Creatine is one of the best-researched supplements for strength training. It's optional, not required. Many adults use 3–5 g a day with water. Talk to a doctor first if you have kidney problems or take regular medicines." };
    return { text: "Supplements are optional. Whey or plant protein powder is just a convenient way to get protein; regular food works too. If you buy one, choose a third-party tested brand. Avoid whey if you're allergic to milk." };
  },

  rest: (ctx) => ({
    text: `Rest days are where your body gets stronger, so yes, take one if you need it. A walk or light stretching is ideal. Your plan simply moves forward, so nothing is skipped.${ctx.data.plan ? " When you're back, just start the next workout." : ""}`,
  }),

  motivation: (ctx) => ({
    text: oneOf(
      [
        `Some days are like that, ${ctx.profile.name}. Try the 10-minute rule: start, and if you still want to stop after 10 minutes, stop. Most days you'll keep going.`,
        "Motivation comes after you start, not before. Put your shoes on and do just the warm-up. That still counts.",
        "Progress isn't about perfect weeks, it's about not quitting. A short, easy session today beats a skipped one.",
      ],
      ctx.turn,
    ),
    quick: ["Make it 20 minutes for today", "What should I train today?"],
  }),

  stretch: (ctx, _q, e) => {
    const list = EXERCISES.filter((x) => categoryOf(x) === "stretching" && (!e.muscle || x.muscle === e.muscle) && isSafeFor(x, ctx.profile)).slice(0, 5);
    return {
      text: `For flexibility, stretch most days for 5–10 minutes, holding each stretch 20–30 seconds without pain.${list.length ? `\n\nTry:\n${list.map((x) => `• ${x.name}`).join("\n")}` : ""}\n\nFind more in the Exercise library.`,
    };
  },

  steps_info: () => ({
    text: "Pick a daily step goal you can keep. If you're at about 3,000 now, aim for 4,000–5,000 first, then add about 1,000 every week or two. 7,000–10,000 a day is a great long-term goal. Tell me \"walked 8000 steps\" and I'll log it.",
  }),

  log_food: (ctx, q, _e, raw) =>
    foodLog(raw, q, ctx) ?? { text: "Tell me what you ate with amounts, for example \"I had 3 idli and 1 katori sambar for breakfast\"." },

  help: () => ({
    text: "I'm not sure I got that. Here's what I can do:\n• Change your plan: \"replace squats with lunges\", \"add more rear delt work\", \"make my workouts 30 minutes\", \"switch to push pull legs\", \"I don't have a barbell\", \"make it easier\"\n• Weights: \"what weight should I use for dumbbell rows?\"\n• Log things: \"I ate 2 dosa and chutney\", \"drank 3 glasses of water\", \"slept 7 hours\", \"I weigh 70 kg\", \"walked 8000 steps\"\n• Workouts: \"what should I train today?\", \"30 minute home workout\", \"biceps workout for every head\"\n• Questions: technique, protein, calories, sleep, soreness, plateaus and more",
    quick: ["What should I train today?", "Show my plan", "How much protein should I eat?"],
  }),
};

/* ---------- Main entry ---------- */
export function think(raw: string, ctx: BrainCtx, hint?: string): Reply {
  const q = fixTypos(clean(raw));
  const safe = safety(q, ctx);
  if (safe) return { ...safe, intent: "safety" };
  if (!hint) {
    const food = foodLog(raw, q, ctx);
    if (food) return { ...food, intent: "log_food" };
  }
  const e = entities(q, ctx);
  const intent = hint && HANDLERS[hint] ? hint : detectIntent(q, e, ctx);
  const reply = (HANDLERS[intent] ?? HANDLERS.help)(ctx, q, e, raw);
  return {
    ...reply,
    intent,
    memory: { ...(e.ex ? { exerciseId: e.ex.id } : {}), ...(e.day !== undefined ? { dayIndex: e.day } : {}), ...reply.memory },
  };
}