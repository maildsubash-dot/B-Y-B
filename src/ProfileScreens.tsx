import { useRef, useState, type ComponentType } from "react";
import type { AppData, Profile } from "./store";
import { EMPTY_DATA, EMPTY_GEAR, clearAll, dateKey } from "./store";
import { generatePlan, heightCm, latestWeightKg, planChoices, showWeight } from "./train";
import { useApp } from "./nav";
import { Header, Row, SectionTitle, Sheet } from "./kit";
import { Btn, Card, Note, Stat, inputClass } from "./ui";
import Onboarding from "./Onboarding";

/* ==========================================================
   Profile: your answers, equipment, backup and restore,
   privacy, data sources and credits, about, delete data.
   ========================================================== */

const TRAINING_KEYS: (keyof Profile)[] = ["level", "goals", "place", "equipment", "days", "minutes", "painAreas", "health", "pushups", "cardio"];

function ProfileHome() {
  const { profile, data, nav } = useApp();
  const h = heightCm(profile);
  const height = profile.units === "imperial" ? `${profile.heightFt}′${profile.heightIn || 0}″` : h ? `${Math.round(h)} cm` : "–";
  return (
    <>
      <Header title="Profile" />
      <div className="mt-4 flex items-center gap-3">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-neon text-xl font-bold text-black">
          {(profile.name.trim()[0] ?? "B").toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="truncate text-lg font-bold">{profile.name}</p>
          <p className="truncate text-sm text-white/50">{profile.level} · {profile.goals[0] ?? "No goal set"}</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <Stat label="Age" value={profile.age || "–"} />
        <Stat label="Height" value={height} />
        <Stat label="Weight" value={showWeight(latestWeightKg(profile, data), profile)} />
      </div>

      <SectionTitle>You</SectionTitle>
      <div className="mt-2 space-y-2">
        <Row icon="edit" title="Edit my answers" sub="Body, goals, schedule, food and health" onClick={() => nav.push({ name: "editAnswers" })} />
        <Row icon="dumbbell" title="Equipment & weights" sub="The dumbbells and kettlebells you own" onClick={() => nav.push({ name: "gear" })} />
      </div>

      <SectionTitle>Your data</SectionTitle>
      <div className="mt-2 space-y-2">
        <Row icon="bookmark" title="Backup and restore" sub="Save a copy, or move to a new phone" onClick={() => nav.push({ name: "backup" })} />
        <Row icon="info" title="Privacy" sub="What stays on your phone" onClick={() => nav.push({ name: "privacy" })} />
        <Row icon="trash" title="Delete all my data" sub="Start again from the beginning" onClick={() => nav.push({ name: "deleteAll" })} />
      </div>

      <SectionTitle>About</SectionTitle>
      <div className="mt-2 space-y-2">
        <Row icon="book" title="Data sources and credits" sub="Where the exercises and foods come from" onClick={() => nav.push({ name: "credits" })} />
        <Row icon="info" title="About BuildYourBody" sub="Version 1.0 · safety information" onClick={() => nav.push({ name: "about" })} />
      </div>
    </>
  );
}

function EditAnswers() {
  const { profile, setProfile, data, setData, nav } = useApp();
  return (
    <Onboarding initial={profile} initialGear={data.gear} onCancel={nav.back}
      onDone={(p, gear) => {
        const changed = TRAINING_KEYS.some((k) => JSON.stringify(p[k]) !== JSON.stringify(profile[k]));
        setProfile(p);
        setData((d) => {
          if (!changed || !d.plan) return { ...d, gear };
          const c = planChoices(d.plan);
          return { ...d, gear, plan: generatePlan(p, c.split, c.focus, 0) };
        });
        nav.back();
      }} />
  );
}

/* ---------- Backup and restore ---------- */
type Backup = { profile: Profile; data: Partial<AppData> };

function BackupScreen() {
  const { profile, data, setProfile, setData } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Backup | null>(null);
  const [msg, setMsg] = useState("");

  const exportData = () => {
    const json = JSON.stringify({ app: "BuildYourBody", version: 1, exported: dateKey(), profile, data }, null, 2);
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `byb-backup-${dateKey()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMsg("Backup file saved. Look for it in your Downloads folder.");
  };

  const readFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as Partial<Backup>;
        if (!parsed.profile || !parsed.data || typeof parsed.profile.name !== "string") throw new Error("Not a backup");
        setPending({ profile: parsed.profile, data: parsed.data });
        setMsg("");
      } catch {
        setMsg("That file isn't a BuildYourBody backup.");
      }
    };
    reader.readAsText(file);
  };

  const restore = () => {
    const b = pending;
    if (!b) return;
    setProfile(b.profile);
    setData(() => ({ ...EMPTY_DATA, ...b.data, gear: { ...EMPTY_GEAR, ...(b.data.gear ?? {}) } }));
    setPending(null);
    setMsg("Backup restored.");
  };

  return (
    <>
      <Header title="Backup and restore" />
      <Card title="Save a backup">
        <p className="text-sm text-white/70">
          Saves your profile, plan, workouts, food log and progress as one file. Keep it somewhere safe, like Google Drive, to move to a new phone.
        </p>
        <div className="mt-3"><Btn onClick={exportData}>Save backup file</Btn></div>
      </Card>
      <Card title="Restore from a backup">
        <p className="text-sm text-white/70">Replaces everything in the app with the backup file.</p>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) readFile(f); e.target.value = ""; }} />
        <div className="mt-3"><Btn kind="soft" onClick={() => fileRef.current?.click()}>Choose backup file</Btn></div>
      </Card>
      {msg && <Note>{msg}</Note>}
      {pending && (
        <Sheet title="Restore this backup?" onClose={() => setPending(null)}>
          <p className="text-sm text-white/70">
            Backup for {pending.profile.name} with {pending.data.sessions?.length ?? 0} workouts. Everything currently in the app will be replaced.
          </p>
          <div className="mt-4"><Btn kind="danger" onClick={restore}>Restore</Btn></div>
        </Sheet>
      )}
    </>
  );
}

/* ---------- Information screens ---------- */
function Privacy() {
  return (
    <>
      <Header title="Privacy" />
      <Card title="Your data stays on your phone">
        <ul className="list-disc space-y-2 pl-5 text-sm text-white/75">
          <li>There's no account and no BYB server. Your answers, workouts, food log, weight and chats are saved only on this phone.</li>
          <li>The coach runs on your phone. What you type to it isn't sent anywhere.</li>
          <li>Deleting the app, or using "Delete all my data", removes everything.</li>
        </ul>
      </Card>
      <Card title="When BYB uses the internet">
        <ul className="list-disc space-y-2 pl-5 text-sm text-white/75">
          <li>Exercise photos load from the Free Exercise DB project on GitHub.</li>
          <li>Packaged food search sends only your search words to Open Food Facts.</li>
          <li>Smart mode downloads its language model once from Hugging Face. Your messages are not sent.</li>
          <li>Demo video buttons open YouTube.</li>
        </ul>
      </Card>
    </>
  );
}

const CREDITS: [string, string][] = [
  ["Exercises and photos", "Free Exercise DB (yuhonas/free-exercise-db on GitHub). Released into the public domain under the Unlicense."],
  ["Indian foods", "open-nutrition-engine by TheBarbellCrew. Used under the MIT License."],
  ["World foods", "USDA FoodData Central, SR Legacy. U.S. Department of Agriculture, Agricultural Research Service. Public domain (CC0 1.0)."],
  ["Packaged foods", "Open Food Facts contributors. Database available under the Open Database License (ODbL); contents under the Database Contents License."],
  ["Smart mode", "all-MiniLM-L6-v2 language model (sentence-transformers), run with Transformers.js by Hugging Face. Both under the Apache License 2.0."],
  ["Built with", "React, Vite, Tailwind CSS and Recharts (MIT License). Icons drawn in the style of Feather Icons (MIT License)."],
  ["BYB's own work", "Workout plans, muscle-head labels, Indian region and state groups, weight suggestions and the coach were written for BuildYourBody."],
  ["Estimates", "Food targets use the Mifflin-St Jeor equation. Estimated 1-rep max uses the Epley formula."],
];

function Credits() {
  return (
    <>
      <Header title="Data sources and credits" />
      <div className="mt-3 space-y-2">
        {CREDITS.map(([title, text]) => (
          <div key={title} className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <p className="text-sm font-semibold">{title}</p>
            <p className="mt-1 text-xs leading-relaxed text-white/60">{text}</p>
          </div>
        ))}
      </div>
      <Note>Nutrition values are averages. Home recipes and brands vary, so treat all numbers as estimates.</Note>
    </>
  );
}

function About() {
  return (
    <>
      <Header title="About BuildYourBody" />
      <Card>
        <p className="text-3xl font-black text-neon">BYB</p>
        <p className="mt-1 text-sm text-white/70">BuildYourBody · Version 1.0</p>
        <p className="mt-3 text-sm text-white/70">A free fitness app for training, food and habits, built for adults aged 18 and over.</p>
      </Card>
      <Card title="Safety">
        <ul className="list-disc space-y-2 pl-5 text-sm text-white/75">
          <li>BYB gives general fitness and nutrition information. It isn't medical advice and doesn't replace a doctor, physiotherapist or registered dietitian.</li>
          <li>Check with a doctor before starting if you have a health condition, are pregnant, or take regular medicines.</li>
          <li>Stop exercising and get help if you feel chest pain, faintness, severe breathlessness or sharp pain.</li>
          <li>Emergency in India: call 112. For mental health support, Tele-MANAS: 14416 (free, 24/7).</li>
        </ul>
      </Card>
    </>
  );
}

function DeleteAll() {
  const [text, setText] = useState("");
  const del = () => {
    clearAll();
    window.location.reload();
  };
  return (
    <>
      <Header title="Delete all my data" />
      <Card>
        <p className="text-sm text-white/75">
          This permanently deletes your profile, plan, workouts, food log, progress and chats from this phone. It can't be undone. Save a backup first if you might want it later.
        </p>
        <label className="mt-4 block text-sm">
          <span className="mb-1.5 block text-white/60">Type DELETE to confirm</span>
          <input className={inputClass} value={text} onChange={(e) => setText(e.target.value)} autoCapitalize="characters" />
        </label>
        <div className="mt-4"><Btn kind="danger" disabled={text.trim() !== "DELETE"} onClick={del}>Delete everything</Btn></div>
      </Card>
    </>
  );
}

/* ---------- Every profile screen, by name ---------- */
export const PROFILE_SCREENS: Record<string, ComponentType> = {
  profile: ProfileHome, editAnswers: EditAnswers, backup: BackupScreen, privacy: Privacy, credits: Credits, about: About, deleteAll: DeleteAll,
};