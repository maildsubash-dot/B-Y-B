import { useEffect, useState } from "react";
import Onboarding from "./Onboarding";
import Home from "./Home";
import TrainPage, { LiveWorkout } from "./TrainPage";
import Library from "./Library";
import FoodPage from "./Food";
import Coach from "./Coach";
import Progress from "./Progress";
import Me from "./Me";
import type { PlanDay, Profile, Tab } from "./store";
import { DRAFT_KEY, EMPTY_DATA, PROFILE_KEY, clearAll, loadProfile, remove, useAppData, write } from "./store";
import { generatePlan, planChoices } from "./train";
import { useExerciseDb } from "./exdb";

/* ==========================================================
   BuildYourBody app shell: onboarding, pages and menu.
   ========================================================== */

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "home", label: "Home", icon: "🏠" },
  { id: "train", label: "Train", icon: "🏋️" },
  { id: "food", label: "Food", icon: "🍛" },
  { id: "coach", label: "Coach", icon: "💬" },
  { id: "progress", label: "Progress", icon: "📊" },
];

// If any of these change when someone edits their answers, the plan is rebuilt.
const PLAN_FIELDS: (keyof Profile)[] = ["goals", "level", "place", "equipment", "days", "minutes", "painAreas", "health", "pushups", "cardio", "age"];
const planInputsChanged = (a: Profile, b: Profile) => PLAN_FIELDS.some((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]));

export default function App() {
  const [profile, setProfile] = useState<Profile | null>(loadProfile);
  const [data, setData] = useAppData();
  const [tab, setTab] = useState<Tab>("home");
  const [live, setLive] = useState<PlanDay | null>(null);
  const [editing, setEditing] = useState<Profile | null>(null);
  const exercisesState = useExerciseDb();

  // Make sure there is always a plan once onboarding is done.
  useEffect(() => {
    if (profile && !data.plan) setData((d) => (d.plan ? d : { ...d, plan: generatePlan(profile) }));
  }, [profile, data.plan, setData]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [tab, live]);

  const finishOnboarding = () => {
    const p = loadProfile();
    if (!p) return;
    const before = editing;
    setProfile(p);
    setEditing(null);
    setData((d) => {
      if (!d.plan) return { ...d, plan: generatePlan(p) };
      if (before && planInputsChanged(before, p)) {
        const c = planChoices(d.plan);
        const plan = generatePlan(p, c.split, c.focus);
        plan.why.unshift("Your plan was rebuilt because your profile changed.");
        return { ...d, plan };
      }
      return d;
    });
    setTab("home");
  };

  const editProfile = () => {
    if (!profile) return;
    write(DRAFT_KEY, { p: profile, step: 11 });
    remove(PROFILE_KEY);
    setEditing(profile);
    setProfile(null);
  };

  const cancelEdit = () => {
    if (!editing) return;
    write(PROFILE_KEY, editing);
    remove(DRAFT_KEY);
    setProfile(editing);
    setEditing(null);
  };

  const resetAll = () => {
    clearAll();
    remove("byb-live-v1");
    setData(() => EMPTY_DATA);
    setLive(null);
    setEditing(null);
    setTab("home");
    setProfile(null);
  };

  const replaceProfile = (p: Profile) => {
    write(PROFILE_KEY, p);
    setProfile(p);
  };

  /* Short loading screen while the exercise library loads */
  if (exercisesState === "loading") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#0d0d0d] text-white">
        <span className="text-5xl font-black tracking-tight text-neon">BYB</span>
        <span className="text-xs uppercase tracking-widest text-white/50">Loading exercises…</span>
      </div>
    );
  }

  /* Onboarding (first time, or editing answers) */
  if (!profile) {
    return (
      <>
        {editing && (
          <div className="sticky top-0 z-50 flex items-center justify-between border-b border-white/10 bg-[#0d0d0d] px-4 py-2 text-sm text-white">
            <span className="text-white/60">Editing your answers</span>
            <button type="button" className="font-semibold text-neon" onClick={cancelEdit}>
              Cancel
            </button>
          </div>
        )}
        <Onboarding onDone={finishOnboarding} />
      </>
    );
  }

  /* Live workout takes the whole screen */
  if (live) {
    return <LiveWorkout key={live.title} day={live} profile={profile} data={data} setData={setData} onExit={() => setLive(null)} />;
  }

  const props = { profile, data, setData, go: setTab };

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0d0d0d]/95 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <button type="button" onClick={() => setTab("home")} className="flex items-baseline gap-2" aria-label="Go to home">
            <span className="text-2xl font-black tracking-tight text-neon">BYB</span>
            <span className="text-[10px] uppercase tracking-widest text-white/45">BuildYourBody</span>
          </button>
          <div className="flex gap-1">
            {(
              [
                ["library", "📚", "Library"],
                ["me", "👤", "Me"],
              ] as [Tab, string, string][]
            ).map(([id, icon, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                aria-current={tab === id ? "page" : undefined}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold ${tab === id ? "bg-neon text-black" : "text-white/70 hover:text-white"}`}
              >
                <span aria-hidden="true">{icon}</span> {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 pb-28">
        {tab === "home" && <Home {...props} start={setLive} />}
        {tab === "train" && <TrainPage {...props} start={setLive} />}
        {tab === "library" && <Library {...props} start={setLive} />}
        {tab === "food" && <FoodPage {...props} />}
        {tab === "coach" && <Coach {...props} start={setLive} />}
        {tab === "progress" && <Progress {...props} />}
        {tab === "me" && <Me {...props} editProfile={editProfile} resetAll={resetAll} replaceProfile={replaceProfile} />}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[#0d0d0d]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur" aria-label="Main menu">
        <div className="mx-auto grid max-w-md grid-cols-5">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? "page" : undefined}
              className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold ${tab === t.id ? "text-neon" : "text-white/55"}`}
            >
              <span className="text-lg" aria-hidden="true">
                {t.icon}
              </span>
              {t.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}