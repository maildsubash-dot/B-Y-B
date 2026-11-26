import { useEffect, useRef, useState } from "react";
import type { AppData, ChatMsg, PlanDay } from "./store";
import { SMART_KEY } from "./store";
import { think, type Memory } from "./coachBrain";
import { classify, loadSmartModel } from "./semantic";
import { useFoodDb } from "./fooddb";
import { estimateMinutes } from "./train";
import { useApp } from "./nav";
import { RootHeader } from "./kit";
import { Btn, Card, Chip, Note } from "./ui";

/* ==========================================================
   BYB Coach: a chat that understands normal messages, changes
   your plan (with Undo), logs food and habits, and answers
   questions. Runs on your phone for free.
   ========================================================== */

type Smart = "off" | "loading" | "on" | "error";
type Pending = { day: PlanDay; planIndex: number | null };

// Kept while you move around the app
const keep: { undo: { label: string; before: AppData } | null; quick: string[]; memory: Memory } = {
  undo: null,
  quick: [],
  memory: {},
};

const SUGGESTIONS = [
  "What should I train today?",
  "Add more biceps work to my plan",
  "Replace bench press",
  "Make my workouts 30 minutes",
  "What weight should I use for goblet squats?",
  "I ate 3 idli and 1 katori sambar",
  "Drank 2 glasses of water",
  "How much protein should I eat?",
  "Biceps workout for every head",
  "Show my plan",
];

function readSmart() {
  try {
    return localStorage.getItem(SMART_KEY) === "1";
  } catch {
    return false;
  }
}
function writeSmart(on: boolean) {
  try {
    localStorage.setItem(SMART_KEY, on ? "1" : "0");
  } catch {
    /* storage blocked */
  }
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

export default function CoachScreen() {
  const { profile, data, setData, startWorkout } = useApp();
  const db = useFoodDb();
  const [text, setText] = useState("");
  const [quick, setQuick] = useState<string[]>(keep.quick);
  const [workout, setWorkout] = useState<Pending | null>(null);
  const [undo, setUndo] = useState(keep.undo);
  const [smart, setSmart] = useState<Smart>(() => (readSmart() ? "loading" : "off"));
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [data.chat.length, workout, quick]);

  // Load the smart-mode model when it's turned on
  useEffect(() => {
    if (smart !== "loading") return;
    let alive = true;
    loadSmartModel()
      .then(() => {
        if (alive) setSmart("on");
      })
      .catch(() => {
        if (alive) setSmart("error");
      });
    return () => {
      alive = false;
    };
  }, [smart]);

  const ask = async (input: string) => {
    const question = input.trim();
    if (!question || busy) return;
    setText("");
    setBusy(true);
    const ctx = { profile, data, foods: db.foods, memory: keep.memory, turn: data.chat.length };
    let reply = think(question, ctx);
    if (reply.intent === "help" && smart === "on") {
      try {
        const hit = await classify(question);
        if (hit) reply = think(question, ctx, hit.intent);
      } catch {
        /* keep the normal reply */
      }
    }
    const r = reply;
    let answer = r.text;
    if (r.undo) {
      if (undo) {
        const before = undo.before;
        setData((d) => ({ ...before, chat: d.chat }));
        answer = `Done, I've undone that (${undo.label}).`;
        keep.undo = null;
        setUndo(null);
      } else {
        answer = "There's nothing to undo right now.";
      }
    }
    if (r.apply) {
      const u = { label: r.change ?? "your last change", before: data };
      keep.undo = u;
      setUndo(u);
      setData(r.apply);
    }
    if (r.intent === "help" && smart !== "on") answer += "\n\nTip: turn on Smart mode above so I understand more ways of asking.";
    const add: ChatMsg[] = [
      { role: "user", text: question },
      { role: "coach", text: answer },
    ];
    setData((d) => ({ ...d, chat: [...d.chat, ...add].slice(-120) }));
    keep.memory = { ...keep.memory, ...r.memory };
    keep.quick = r.quick ?? [];
    setQuick(keep.quick);
    setWorkout(r.workout ? { day: r.workout, planIndex: r.planIndex ?? null } : null);
    setBusy(false);
  };

  const clearChat = () => {
    setData((d) => ({ ...d, chat: [] }));
    setWorkout(null);
    keep.quick = [];
    setQuick([]);
  };

  return (
    <>
      <RootHeader title="Coach" sub="Free, private, on your phone" />

      <Card title="Smart mode">
        {smart === "off" && (
          <>
            <p className="text-sm text-white/70">
              Downloads a small language model once (roughly 30–40 MB) so I understand more ways of asking. After that it works
              offline, and nothing you type leaves your phone.
            </p>
            <div className="mt-3">
              <Btn small onClick={() => { writeSmart(true); setSmart("loading"); }}>Turn on smart mode</Btn>
            </div>
          </>
        )}
        {smart === "loading" && <p className="text-sm text-white/70">Downloading and preparing the model. The first time can take a minute…</p>}
        {smart === "on" && (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-neon">✓ Smart mode is on</p>
            <Btn small kind="soft" onClick={() => { writeSmart(false); setSmart("off"); }}>Turn off</Btn>
          </div>
        )}
        {smart === "error" && (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-yellow-200">Couldn't load smart mode. Check your internet.</p>
            <Btn small kind="soft" onClick={() => setSmart("loading")}>Try again</Btn>
          </div>
        )}
      </Card>

      <div className="mt-4 space-y-3">
        {data.chat.length === 0 && (
          <Bubble
            role="coach"
            text={`Hi ${profile.name}! Talk to me like you would to a trainer. For example: "replace squats with lunges", "I ate 2 dosa for breakfast", or "what should I train today?"`}
          />
        )}
        {data.chat.map((m, i) => <Bubble key={i} role={m.role} text={m.text} />)}
        {busy && <p className="text-xs text-white/45">Coach is thinking…</p>}
      </div>

      {undo && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-neon/30 bg-neon/10 px-3 py-2 text-xs">
          <span className="text-white/80">Changed: {undo.label}</span>
          <Btn small kind="soft" onClick={() => void ask("Undo")}>Undo</Btn>
        </div>
      )}

      {workout && workout.day.exercises.length > 0 && (
        <Card title="Workout from your coach">
          <p className="font-semibold">{workout.day.title}</p>
          <p className="text-xs text-white/50">About {estimateMinutes(workout.day)} min including warm-up</p>
          <div className="mt-3 flex gap-2">
            <Btn onClick={() => startWorkout(workout.day, workout.planIndex)}>▶ Start</Btn>
            <Btn kind="soft" onClick={() => setWorkout(null)}>Dismiss</Btn>
          </div>
        </Card>
      )}
      <div ref={endRef} />

      <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {(quick.length ? quick : SUGGESTIONS).map((s) => <Chip key={s} label={s} on={false} onClick={() => void ask(s)} />)}
      </div>

      <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); void ask(text); }}>
        <input
          className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-white outline-none placeholder:text-white/30 focus:border-neon"
          value={text}
          maxLength={400}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message your coach…"
          aria-label="Message to your coach"
        />
        <button type="submit" disabled={!text.trim() || busy} className="rounded-xl bg-neon px-4 font-bold text-black disabled:opacity-30">
          Send
        </button>
      </form>

      <details className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
        <summary className="cursor-pointer font-semibold text-white">What can I ask?</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Change your plan: "swap deadlifts for RDLs", "remove lunges", "add hammer curls to pull day", "make bench press 4 sets of 8"</li>
          <li>Plan settings: "switch to upper lower", "I can only train Mon, Wed, Fri", "make my workouts 45 minutes", "focus my plan on strength"</li>
          <li>Weights: "what weight should I use for dumbbell rows?", "I don't have a bench"</li>
          <li>Logging: "had 2 chapati and dal for dinner", "drank a bottle of water", "slept 6 hours", "I weigh 68 kg", "I'm sore"</li>
          <li>Workouts: "20 minute home workout", "rear delt workout", "triceps workout for every head"</li>
          <li>Questions: "how do I improve my squat?", "what muscles does the face pull work?", "how much protein should I eat?"</li>
          <li>Changed your mind? Say "undo" or tap Undo.</li>
        </ul>
      </details>

      {data.chat.length > 0 && (
        <div className="mt-3">
          <Btn small kind="soft" onClick={clearChat}>Clear chat</Btn>
        </div>
      )}
      <Note>General fitness information, not medical advice.</Note>
    </>
  );
}