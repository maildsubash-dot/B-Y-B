import { useEffect, useRef, useState } from "react";
import type { AppData, ChatMsg, PageProps, PlanDay, Profile } from "./store";
import { addDays, dateKey, prettyDate, weekStart, weekdayOf } from "./store";
import { EXERCISES, LEVEL_NAME, UNIT_LABEL, byId, kindOf, type Exercise } from "./exercises";
import {
  alternatives, availableEquip, canDo, estimateMinutes, isSafeFor, latestWeightKg, missedCount, plateauTips,
  profileWeightKg, quickWorkout, showWeight, todaysIndex, trainedOn, upcoming, warmUp,
} from "./train";
import { foodsFor, logStreak, mealIdeas, nutritionTargets, recordCount, weekStreak } from "./stats";
import { Btn, Card, Chip, Note, PageTitle, inputClass } from "./ui";

/* ==========================================================
   BYB Coach: a rule-based coach that runs on the device.
   It uses the person's profile, plan and history.
   ========================================================== */

type CoachProps = PageProps & { start: (day: PlanDay) => void };
type Reply = { text: string; workout?: PlanDay };

const SUGGESTIONS = [
  "What should I train today?",
  "Create a chest workout",
  "How can I improve my squat?",
  "How much protein should I eat?",
  "What should I eat after training?",
  "Alternative to push-ups",
  "I missed two workouts",
  "My strength has stopped improving",
  "Make a beginner-friendly workout",
  "Create a home workout",
];

// Match words at the start of a word ("leg" matches "legs"). whole = exact word only.
function has(q: string, list: string[], whole = false) {
  return list.some((w) => new RegExp(`\\b${w}${whole ? "\\b" : ""}`).test(q));
}

const CRISIS = ["kill myself", "suicide", "suicidal", "self harm", "self-harm", "hurt myself", "end my life", "want to die", "don't want to live", "dont want to live"];
const EMERGENCY = ["chest pain", "chest hurts", "can't breathe", "cant breathe", "cannot breathe", "faint", "passed out", "blacked out", "heart attack", "dizzy", "numb"];
const DISORDERED = ["starve", "starving", "stop eating", "not eating", "eat nothing", "skip all meals", "purge", "purging", "make myself sick", "throw up after", "vomit after", "laxative", "diet pills"];
const MEDICAL = ["pain", "hurt", "injur", "sprain", "strain", "torn", "swelling", "swollen", "pregnan", "diabet", "blood pressure", "heart condition", "heart problem", "asthma", "medicine", "medication", "tablet", "surgery", "operation", "physio", "steroid", "sarm"];
const TARGETS: [string, string[]][] = [
  ["Upper body", ["upper body", "upper-body"]],
  ["Lower body", ["lower body", "lower-body"]],
  ["Full body", ["full body", "full-body", "whole body"]],
  ["Chest", ["chest", "pec"]],
  ["Back", ["back", "lats"]],
  ["Shoulders", ["shoulder", "delt"]],
  ["Arms", ["arm", "bicep", "tricep"]],
  ["Legs", ["leg", "quad", "hamstring", "glute"]],
  ["Core", ["core", "abs", "six pack", "stomach"]],
  ["Cardio", ["cardio", "stamina", "conditioning"]],
];
const EXERCISE_WORDS = [
  "squat", "deadlift", "bench", "push-up", "pull-up", "chin-up", "plank", "lunge", "row", "curl", "dip", "bridge",
  "thrust", "overhead press", "shoulder press", "lateral raise", "crunch", "calf", "swing", "pulldown", "fly",
  "extension", "carry", "hang", "step-up", "burpee", "jog", "skipping",
];
const POST_IDEAS: Record<string, string> = {
  Vegan: "rice with dal or rajma, or tofu or soya chunks curry with roti",
  Vegetarian: "curd rice, idli with sambar and a glass of milk, or chapati with paneer",
  Jain: "moong dal with rice, or chapati with paneer and curd",
  Eggetarian: "boiled eggs with idli or toast, or egg curry with rice",
  "Non-vegetarian": "chicken or fish curry with rice, or boiled eggs with idli",
};

function lowCalorie(q: string) {
  return /\b[1-9]\d{2}\s*(kcal|calories|cals?)\b/.test(q) && /(a|per|each|every)\s+day|daily/.test(q);
}

function findExercise(q: string, p: Profile, data: AppData): Exercise | undefined {
  const norm = q
    .replace(/push ?ups?/g, "push-up")
    .replace(/pull ?ups?/g, "pull-up")
    .replace(/chin ?ups?/g, "chin-up")
    .replace(/step ?ups?/g, "step-up");
  const exact = EXERCISES.filter((e) => norm.includes(e.name.toLowerCase())).sort((a, b) => b.name.length - a.name.length)[0];
  if (exact) return exact;
  const word = EXERCISE_WORDS.find((w) => has(norm, [w]));
  if (!word) return undefined;
  const planIds = new Set(data.plan?.days.flatMap((d) => d.exercises.map((x) => x.id)) ?? []);
  const equip = availableEquip(p);
  return EXERCISES.filter((e) => e.name.toLowerCase().includes(word)).sort(
    (a, b) =>
      Number(planIds.has(b.id)) - Number(planIds.has(a.id)) ||
      Number(canDo(b, equip)) - Number(canDo(a, equip)) ||
      a.level - b.level,
  )[0];
}

function medicalReply(q: string): string {
  if (has(q, ["pregnan"])) {
    return "Thanks for telling me. Exercise during and after pregnancy should be guided by your doctor, because what's safe depends on you and your pregnancy. BYB can't give pregnancy-specific advice. Gentle walking is often recommended, but please check with your doctor first, and update your health answers in Me so BYB keeps your plan gentle.";
  }
  if (has(q, ["steroid", "sarm"])) {
    return "BYB doesn't give advice on steroids, SARMs or other performance-enhancing drugs. They carry serious health risks, including to your heart, liver and hormones. If you're thinking about them, please talk to a doctor first. Good training, food and sleep build real, lasting progress.";
  }
  if (has(q, ["pain", "hurt", "injur", "sprain", "strain", "torn", "swelling", "swollen", "physio", "surgery", "operation"])) {
    return "I can't diagnose injuries, but here's general safety advice:\n• Stop any exercise that causes sharp or worsening pain.\n• See a doctor or physiotherapist if pain is severe, lasts more than a few days, or comes with swelling, numbness, weakness, or a pop at the time of injury.\n• Keep moving gently in ways that don't hurt, like walking.\n• Add the area in Me → Edit my answers → Health and safety, and your plan will leave out exercises that load it.";
  }
  return "For health conditions and medicines, please follow your doctor's advice about exercise. BYB gives general fitness information only and can't tell you what's safe for your condition. If you add it to your health answers (Me → Edit my answers), your plan uses gentler training and lower volume.";
}

function coachReply(raw: string, p: Profile, data: AppData): Reply {
  const q = raw.toLowerCase().replace(/[’`]/g, "'");
  const today = dateKey();
  const plan = data.plan;
  const t = nutritionTargets(p, data);
  const numbers = p.foodTracking !== "Keep it simple";
  const asked = Number(q.match(/(\d{2,3})\s*(min|minute)/)?.[1]);
  const minutes = asked >= 10 && asked <= 120 ? asked : Number(p.minutes) || 30;
  const bodyweight = has(q, ["home", "bodyweight", "body weight", "no equipment", "without equipment", "hostel", "room"]);
  const listDay = (day: PlanDay) =>
    day.exercises
      .map((x, i) => {
        const ex = byId(x.id);
        return `${i + 1}. ${ex?.name ?? x.id}: ${x.sets} × ${x.reps} ${ex ? UNIT_LABEL[ex.unit] : ""}`;
      })
      .join("\n");

  /* ---- Safety first ---- */
  if (has(q, CRISIS)) {
    return { text: "I'm really sorry you're feeling this way, and I'm glad you said something. You deserve support right now. Please reach out to someone you trust, or call Tele-MANAS on 14416 (free, 24/7 in India). If you're in immediate danger, call 112. If you're outside India, please contact your local emergency number." };
  }
  if (has(q, EMERGENCY)) {
    return { text: "Please stop exercising now. Chest pain, trouble breathing, fainting, sudden dizziness or numbness can be serious. If it's happening now, call 112 (India) or your local emergency number, or go to the nearest hospital. Please don't train again until a doctor has checked you." };
  }
  if (has(q, DISORDERED) || lowCalorie(q)) {
    return { text: "It sounds like you might be thinking about eating very little. I can't help with plans that cut food that much: very low intakes can harm your health, energy, mood and training. If food or your body has been feeling stressful, please talk to a doctor or someone you trust. In India you can call Tele-MANAS on 14416 for free support. Regular meals with protein, carbs and vegetables are what fuel your training." };
  }
  if (has(q, MEDICAL)) return { text: medicalReply(q) };

  /* ---- Greetings ---- */
  if (q.split(/\s+/).length <= 4 && has(q, ["hi", "hello", "hey", "namaste", "vanakkam"], true)) {
    return { text: `Hi ${p.name}! I'm your BYB coach. Ask me about workouts, food, recovery or your progress, or tap a suggestion below.` };
  }
  if (q.split(/\s+/).length <= 4 && has(q, ["thanks", "thank you", "thx"], true)) {
    return { text: "You're welcome! Keep going 💪" };
  }

  /* ---- Missed workouts ---- */
  if (has(q, ["missed", "miss ", "skipped", "couldn't train", "could not train", "didn't train", "didnt train"])) {
    if (!plan) return { text: "No problem. Create a plan on the Train page and BYB will keep track of your schedule for you." };
    const missed = missedCount(plan, data.sessions, today);
    const nx = upcoming(plan, data.sessions, 1)[0];
    const nextDay = nx ? plan.days[nx.index] : undefined;
    return {
      text: `No problem, it happens to everyone.${missed ? ` I count ${missed} missed this week.` : ""}\n\nHere's how to adjust:\n• Don't try to catch up by doubling up workouts.\n• Your plan rotates, so the missed workout simply comes next: ${nextDay ? `${nextDay.title}${nx ? ` (${weekdayOf(nx.date)})` : ""}` : "your next session"}.\n• If you've had more than a week off, use about 20% lighter weights for your first session back.\n• If your schedule has changed, update your training days in Train → Customise.`,
      workout: nextDay,
    };
  }

  /* ---- Today's training ---- */
  if (has(q, ["train today", "workout today", "do today", "today's workout", "todays workout", "what should i train", "what do i train", "what workout"])) {
    if (!plan) return { text: "You don't have a plan yet. Open Train and tap Create my plan, and I'll take it from there." };
    const feel = data.days[today]?.feel;
    if (trainedOn(data.sessions, today)) {
      const nx = upcoming(plan, data.sessions, 1)[0];
      return { text: `You've already trained today, nice work. Rest, eat well and drink water.${nx ? ` Next up: ${plan.days[nx.index].title} on ${weekdayOf(nx.date)}.` : ""}` };
    }
    const feelNote =
      feel === "Unwell"
        ? "\n\nYou said you feel unwell, so I'd rest today instead."
        : feel === "Tired" || feel === "Sore"
          ? `\n\nYou said you feel ${feel.toLowerCase()}, so do 1 fewer set per exercise and keep it light.`
          : "";
    const idx = todaysIndex(plan, data.sessions);
    if (idx >= 0) {
      const day = plan.days[idx];
      return {
        text: `Today is ${day.title} (${day.focus}), about ${estimateMinutes(day)} min:\n${listDay(day)}${feelNote}\n\nTap Start below when you're ready.`,
        workout: feel === "Unwell" ? undefined : day,
      };
    }
    const nx = upcoming(plan, data.sessions, 1)[0];
    const nextDay = nx ? plan.days[nx.index] : undefined;
    return {
      text: `Today is a rest day in your plan. A walk or 10 minutes of stretching is perfect.${nextDay && nx ? `\n\nYour next workout is ${nextDay.title} on ${weekdayOf(nx.date)}, ${prettyDate(nx.date)}. If you'd like to train today anyway, tap Start below.` : ""}`,
      workout: nextDay,
    };
  }

  /* ---- Warm-up ---- */
  if (has(q, ["warm up", "warm-up", "warmup", "warming up"])) {
    const idx = plan ? todaysIndex(plan, data.sessions) : -1;
    const nx = plan ? upcoming(plan, data.sessions, 1)[0] : undefined;
    const day = plan && idx >= 0 ? plan.days[idx] : plan && nx ? plan.days[nx.index] : quickWorkout(p, "Full body", 30);
    return { text: `A good warm-up before ${day.title}:\n• ${warmUp(day).join("\n• ")}\n\nIt takes about 5–8 minutes and helps you move better and stay safe.` };
  }

  /* ---- Replace an exercise ---- */
  if (has(q, ["replace", "swap", "alternative", "instead of", "substitute"])) {
    const ex = findExercise(q, p, data);
    if (!ex) {
      return { text: "Tell me which exercise, for example \"replace bench press\" or \"alternative to push-ups\". You can also tap ⇄ Swap next to any exercise in your plan on the Train page." };
    }
    const alts = alternatives(ex.id, p).slice(0, 5);
    if (!alts.length) return { text: `I couldn't find an alternative to ${ex.name} that fits your equipment. Browse the Library for ideas, or add equipment in Me → Edit my answers.` };
    return {
      text: `Instead of ${ex.name}, try:\n${alts.map((a) => `• ${a.name} (${LEVEL_NAME[a.level]}, ${kindOf(a)})`).join("\n")}\n\nAll of these train the same movement and fit your equipment and pain areas. To swap it in your plan, open Train, tap the workout and press ⇄ Swap.`,
    };
  }

  /* ---- Technique ---- */
  if (has(q, ["how do i", "how to", "how can i improve", "improve my", "form", "technique", "proper way", "how should i"])) {
    const ex = findExercise(q, p, data);
    if (ex) {
      const easier = ex.easier ? byId(ex.easier) : undefined;
      const warn = !isSafeFor(ex, p) ? `\n\n⚠ You mentioned pain in an area this exercise loads. Please check with a doctor or physiotherapist before doing it.` : "";
      return {
        text: `${ex.name} (${LEVEL_NAME[ex.level]})\n\nHow to do it:\n${ex.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\nCommon mistakes:\n${ex.mistakes.map((m) => `• ${m}`).join("\n")}\n\nSafety: ${ex.safety}\n\nTo improve it:\n• Practise with a light weight and film yourself from the side.\n• Add reps before adding weight, then add weight in small steps.\n• Train it about twice a week.${easier ? `\n• If it feels too hard, build up with ${easier.name} first.` : ""}${warn}\n\nThe Library has a demo video link for this exercise.`,
      };
    }
  }

  /* ---- Make a workout ---- */
  const target = TARGETS.find(([, list]) => has(q, list))?.[0];
  const wantsWorkout = has(q, ["workout", "routine", "session", "exercises", "plan for", "train my", "make me", "create", "give me", "build me"]);
  const beginner = has(q, ["beginner", "first time", "easy", "simple", "new to"]);
  if (wantsWorkout && (target || bodyweight || beginner)) {
    const focus = target ?? "Full body";
    const who: Profile = beginner ? { ...p, level: "Absolute beginner" } : p;
    const w = quickWorkout(who, focus, minutes, bodyweight);
    if (!w.exercises.length) {
      return { text: `I couldn't build a ${focus.toLowerCase()} workout with your equipment and health answers. Try "full body workout at home", or add equipment in Me → Edit my answers.` };
    }
    return {
      text: `Here's a ${focus.toLowerCase()} workout for you, about ${estimateMinutes(w)} min${bodyweight ? " with no equipment" : ""}:\n${listDay(w)}\n\nWhy: it matches your ${beginner ? "beginner" : p.level.toLowerCase()} level${bodyweight ? "" : " and your equipment"}${p.painAreas.length ? `, and leaves out moves that load your ${p.painAreas.join(", ").toLowerCase()}` : ""}. Warm up first and stop any exercise that hurts.\n\nTap Start below, or ask me for another one.`,
      workout: w,
    };
  }

  /* ---- Plateau ---- */
  if (has(q, ["plateau", "stopped improving", "not improving", "stuck", "stall", "no progress", "not getting stronger"])) {
    const tips = plateauTips(data);
    return {
      text: `When progress stalls, check these:\n• Sleep: are you getting 7–9 hours?\n• Food: enough protein (about ${t.protein} g a day) and enough total food?\n• Progressive overload: are you adding a rep or a little weight over time?\n• Recovery: if you always feel tired, take one lighter week (about half the sets), then build back up.\n• Consistency: are you completing most planned workouts?\n• Variety: after 8–12 weeks, swapping a few exercises can help.${tips.length ? `\n\nFrom your history:\n• ${tips.join("\n• ")}` : ""}`,
    };
  }

  /* ---- Food ---- */
  if (has(q, ["protein"]) && !has(q, ["powder", "shake", "whey"])) {
    const kg = latestWeightKg(p, data) || 60;
    const sources = foodsFor(p, data)
      .filter((f) => f.protein >= 6)
      .sort((a, b) => b.protein / b.kcal - a.protein / a.kcal)
      .slice(0, 6)
      .map((f) => `• ${f.name} (${f.serving}): about ${f.protein} g`)
      .join("\n");
    return {
      text: `A good target for you is about ${t.protein} g of protein a day (around ${Math.round((t.protein / kg) * 10) / 10} g per kg of body weight), based on your goals. That's roughly ${Math.round(t.protein / 4)} g at each of 4 meals or snacks.\n\nGood sources that fit your diet:\n${sources || "• Add foods you eat on the Food page."}\n\nSpread it across the day. If you have kidney problems, check with your doctor first.`,
    };
  }
  if (has(q, ["after training", "after workout", "after the gym", "after gym", "post workout", "post-workout", "after exercise"])) {
    const idea = mealIdeas(p, data, Number(today.replace(/-/g, ""))).find((m) => m.meal === "Post-workout");
    return {
      text: `After training, have a meal or snack with protein and carbs within a couple of hours. It helps your muscles recover.\n\nIdeas for your diet:\n• ${POST_IDEAS[p.diet] ?? "rice with dal, or eggs with idli"}${idea ? `\n• Quick option: ${idea.items.map((i) => `${i.qty} × ${i.food.name}`).join(" + ")}` : ""}\n\nDrink water too, because you lose fluid when you sweat.`,
    };
  }
  if (has(q, ["before training", "before workout", "before the gym", "before gym", "pre workout", "pre-workout", "before exercise"])) {
    return { text: "1–2 hours before training, eat something light with carbs: a banana, 2–3 dates, idli, poha or oats. Avoid heavy or oily food right before you train. If you train early in the morning, a banana or a few dates is enough." };
  }
  if (has(q, ["calorie", "kcal", "how much should i eat", "how much to eat", "diet plan", "meal plan"])) {
    if (!numbers) {
      return { text: "You chose to keep food simple, so here's a plate guide instead of numbers:\n• Half your plate: vegetables or salad.\n• A quarter: protein (dal, paneer, tofu, eggs, fish or chicken, whatever fits your diet).\n• A quarter: rice, roti or millets.\nEat slowly and stop when you're comfortably full. The Food page has meal ideas for you." };
    }
    return {
      text: `Your estimated daily target is about ${t.kcal} kcal (maintenance is roughly ${t.maintenance} kcal), with about ${t.protein} g protein, ${t.carbs} g carbs and ${t.fat} g fat.\n\n${t.notes.join("\n")}\n\nThe Food page has meal ideas sized for you.`,
    };
  }
  if (has(q, ["lose weight", "weight loss", "lose fat", "fat loss", "belly", "burn fat", "slim"])) {
    return { text: "For steady fat loss:\n• Eat in a small calorie deficit. BYB's food targets include one if weight loss is your main goal.\n• Keep protein high to protect your muscle.\n• Keep strength training; it helps you keep muscle while you lose fat.\n• Walk more, because steps add up.\n• Sleep 7–9 hours.\n\nYou can't choose where fat comes off first (like the belly), and progress is rarely a straight line. Losing about 0.25–0.75 kg a week is a sensible pace." };
  }
  if (has(q, ["gain muscle", "build muscle", "bulk", "gain weight", "get bigger", "mass"])) {
    return { text: `To build muscle:\n• Follow your plan and add reps or weight gradually (progressive overload).\n• Eat enough. A small surplus helps, and BYB adds one if building muscle is your main goal.\n• Protein: about ${t.protein} g a day.\n• Sleep 7–9 hours.\n• Be patient: visible change usually takes months, not weeks.` };
  }

  /* ---- Recovery ---- */
  if (has(q, ["sleep", "tired", "fatigue", "exhausted", "no energy", "low energy"])) {
    const sleeps = Object.entries(data.days)
      .filter(([k, d]) => k > addDays(today, -7) && typeof d.sleep === "number")
      .map(([, d]) => d.sleep ?? 0);
    const avg = sleeps.length ? Math.round((sleeps.reduce((a, b) => a + b, 0) / sleeps.length) * 10) / 10 : null;
    return {
      text: `${avg !== null ? `You've averaged ${avg} hours of sleep this week. ` : ""}For better recovery and energy:\n• Aim for 7–9 hours.\n• Keep a regular bed and wake-up time.\n• Screens off 30 minutes before bed.\n• Avoid caffeine late in the day.\n\nIf you feel tired today, do a lighter session (1 fewer set, lighter weights) or take a walk instead. If you're tired all the time, please see a doctor.`,
    };
  }
  if (has(q, ["water", "hydrat", "drink"])) {
    return { text: `Aim for about ${t.water} glasses (250 ml each) a day, more on hot days and training days. Tap + Glass on the dashboard to track it.` };
  }
  if (has(q, ["sore", "doms", "stiff"])) {
    return { text: "Muscle soreness 1–3 days after a new or harder workout is normal (it's called DOMS). Gentle movement, walking, sleep and good food help, and you can train other muscles meanwhile. Sharp pain, swelling, or pain that doesn't get better after a few days is different: please see a doctor or physiotherapist." };
  }

  /* ---- Progress ---- */
  if (has(q, ["progress", "how am i doing", "my stats", "how far", "results"])) {
    const ws = weekStart(today);
    const weekCount = data.sessions.filter((s) => s.date >= ws).length;
    const monthCount = data.sessions.filter((s) => s.date > addDays(today, -30)).length;
    const now = latestWeightKg(p, data);
    const change = now - profileWeightKg(p);
    return {
      text: `Here's how you're doing, ${p.name}:\n• This week: ${weekCount} of ${plan?.weekdays.length ?? 0} planned workouts\n• Last 30 days: ${monthCount} workouts\n• Logging streak: ${logStreak(data)} days · Training streak: ${weekStreak(data)} weeks\n• Personal records set: ${recordCount(data)}\n• Weight: ${showWeight(now, p)} (${change >= 0 ? "+" : "−"}${showWeight(Math.abs(change), p)} since you started)\n\nOpen Progress for charts and reports.`,
    };
  }

  /* ---- Supplements ---- */
  if (has(q, ["fat burner", "fat-burner"])) {
    return { text: "BYB doesn't recommend fat burners. Many have little evidence behind them, and some contain stimulants that can raise your heart rate and blood pressure. Food, training, steps and sleep do the real work." };
  }
  if (has(q, ["creatine"])) {
    return { text: "Creatine is one of the best-researched supplements for strength training. It's optional, not required. Many adults use 3–5 g a day with water. Talk to a doctor first if you have kidney problems, take regular medicines, or are under 18." };
  }
  if (has(q, ["whey", "protein powder", "protein shake", "supplement"])) {
    return { text: "Supplements are optional. Whey or plant protein powder is just a convenient way to get protein; regular food works too. If you buy one, choose a brand that is third-party tested. Avoid whey if you're allergic to milk." };
  }
  if (has(q, ["steps", "walk"])) {
    return { text: "Pick a daily step goal you can keep. If you're at about 3,000 now, aim for 4,000–5,000 first, then add about 1,000 every week or two. 7,000–10,000 a day is a great long-term goal. Log your steps on the dashboard." };
  }

  /* ---- Fallback ---- */
  return {
    text: "I'm not sure I understood that. I can help with:\n• Today's workout, or a new one (try \"30 minute chest workout at home\")\n• Exercise technique (\"how do I improve my squat?\")\n• Replacing an exercise (\"alternative to bench press\")\n• Protein, calories, and pre- and post-workout food\n• Missed workouts, plateaus, sleep, soreness and your progress",
  };
}

function Bubble({ role, text }: { role: ChatMsg["role"]; text: string }) {
  const mine = role === "user";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] whitespace-pre-line rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          mine ? "rounded-br-sm bg-neon text-black" : "rounded-bl-sm border border-white/10 bg-white/5 text-white/90"
        }`}
      >
        {text}
      </div>
    </div>
  );
}

export default function Coach({ profile, data, setData, start }: CoachProps) {
  const [text, setText] = useState("");
  const [workout, setWorkout] = useState<PlanDay | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [data.chat.length, workout]);

  const ask = (q: string) => {
    const question = q.trim();
    if (!question) return;
    const reply = coachReply(question, profile, data);
    const add: ChatMsg[] = [
      { role: "user", text: question },
      { role: "coach", text: reply.text },
    ];
    setData((d) => ({ ...d, chat: [...d.chat, ...add].slice(-100) }));
    setWorkout(reply.workout ?? null);
    setText("");
  };

  return (
    <div className="pb-6">
      <PageTitle title="BYB Coach" sub="Ask about training, food, recovery or your progress." />
      <Note>
        BYB Coach runs on your phone using your profile and history. It's not an online AI, so it's free, private and works offline.
        It gives general fitness information, not medical advice.
      </Note>

      <div className="mt-4 space-y-3">
        {data.chat.length === 0 && (
          <Bubble role="coach" text={`Hi ${profile.name}! I'm your BYB coach. Ask me anything about your training, food or recovery, or tap a suggestion below.`} />
        )}
        {data.chat.map((m, i) => (
          <Bubble key={i} role={m.role} text={m.text} />
        ))}
      </div>

      {workout && workout.exercises.length > 0 && (
        <Card title="Workout from your coach">
          <p className="font-semibold">{workout.title}</p>
          <p className="text-xs text-white/50">About {estimateMinutes(workout)} min including warm-up</p>
          <div className="mt-3 flex gap-2">
            <Btn onClick={() => start(workout)}>▶ Start</Btn>
            <Btn kind="soft" onClick={() => setWorkout(null)}>
              Dismiss
            </Btn>
          </div>
        </Card>
      )}
      <div ref={endRef} />

      <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {SUGGESTIONS.map((s) => (
          <Chip key={s} label={s} on={false} onClick={() => ask(s)} />
        ))}
      </div>

      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          ask(text);
        }}
      >
        <input
          className={inputClass}
          value={text}
          maxLength={300}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ask your coach…"
          aria-label="Message to your coach"
        />
        <button type="submit" disabled={!text.trim()} className="rounded-xl bg-neon px-4 font-bold text-black disabled:opacity-30">
          Send
        </button>
      </form>

      {data.chat.length > 0 && (
        <div className="mt-3">
          <Btn
            small
            kind="soft"
            onClick={() => {
              setData((d) => ({ ...d, chat: [] }));
              setWorkout(null);
            }}
          >
            Clear chat
          </Btn>
        </div>
      )}
    </div>
  );
}