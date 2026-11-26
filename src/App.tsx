import { useEffect, useState, type ComponentType } from "react";
import type { PlanDay, Profile } from "./store";
import { DRAFT_KEY, LIVE_KEY, PROFILE_KEY, loadProfile, read, remove, useAppData, write } from "./store";
import { generatePlan } from "./train";
import { useExerciseDb } from "./exdb";
import { AppContext, useApp, useNav, type AppValue, type TabName } from "./nav";
import { Icon } from "./icons";
import Onboarding from "./Onboarding";
import HomeScreen from "./HomeScreen";
import { WORKOUT_SCREENS } from "./Workouts";
import LiveWorkout, { newLive, type LiveState } from "./LiveWorkout";
import { FOOD_SCREENS } from "./FoodScreens";
import CoachScreen from "./CoachScreen";
import { PROGRESS_SCREENS } from "./ProgressScreens";
import { PROFILE_SCREENS } from "./ProfileScreens";

/* ==========================================================
   BuildYourBody app shell: setup questions, bottom tabs and
   screens that open on top of each other like a phone app.
   ========================================================== */

const TABS: { id: TabName; label: string; icon: string }[] = [
  { id: "home", label: "Home", icon: "home" },
  { id: "workouts", label: "Workouts", icon: "dumbbell" },
  { id: "food", label: "Food", icon: "food" },
  { id: "coach", label: "Coach", icon: "chat" },
  { id: "progress", label: "Progress", icon: "chart" },
];
const FULL_SCREEN = ["live", "editAnswers"];

const SCREENS: Record<string, ComponentType> = {
  home: HomeScreen,
  ...WORKOUT_SCREENS,
  live: LiveWorkout,
  ...FOOD_SCREENS,
  coach: CoachScreen,
  ...PROGRESS_SCREENS,
  ...PROFILE_SCREENS,
};

function TabBar() {
  const { nav } = useApp();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#0d0d0d]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto flex max-w-md">
        {TABS.map((t) => {
          const on = nav.tab === t.id;
          return (
            <button key={t.id} type="button" onClick={() => nav.switchTab(t.id)} aria-current={on ? "page" : undefined}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${on ? "text-neon" : "text-white/50"}`}>
              <Icon name={t.icon} size={22} />
              {t.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function Shell() {
  const { nav } = useApp();
  const Current = SCREENS[nav.screen.name] ?? HomeScreen;
  const full = FULL_SCREEN.includes(nav.screen.name);
  const key = `${nav.depth}-${nav.screen.name}-${nav.screen.id ?? ""}-${nav.screen.index ?? ""}-${nav.screen.pos ?? ""}-${nav.screen.q ?? ""}`;
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [key]);
  return (
    <div className="min-h-dvh bg-[#0a0a0a] text-white">
      <main className={`mx-auto max-w-md px-4 ${full ? "pb-10" : "pb-28"}`}>
        <Current key={key} />
      </main>
      {!full && <TabBar />}
    </div>
  );
}

export default function App() {
  const [profile, setProfileState] = useState<Profile | null>(() => loadProfile());
  const [data, setData] = useAppData();
  const db = useExerciseDb();
  const nav = useNav();
  const [preview, setPreview] = useState<PlanDay | null>(null);

  if (!profile) {
    return (
      <Onboarding onDone={(p, gear) => {
        write(PROFILE_KEY, p);
        remove(DRAFT_KEY);
        setData((d) => ({ ...d, gear, plan: generatePlan(p) }));
        setProfileState(p);
      }} />
    );
  }

  if (db === "loading") {
    return (
      <div className="grid min-h-dvh place-items-center bg-[#0a0a0a] text-white">
        <div className="text-center">
          <p className="text-4xl font-black text-neon">BYB</p>
          <p className="mt-2 text-sm text-white/50">Loading exercises…</p>
        </div>
      </div>
    );
  }

  const value: AppValue = {
    profile,
    setProfile: (p) => {
      write(PROFILE_KEY, p);
      setProfileState(p);
    },
    data,
    setData,
    nav,
    preview,
    showWorkout: (day) => {
      setPreview(day);
      nav.push({ name: "workout" });
    },
    startWorkout: (day, planIndex) => {
      const current = read<LiveState>(LIVE_KEY);
      if (current && !window.confirm(`"${current.day.title}" is still in progress. Start a new workout instead?`)) {
        nav.push({ name: "live" });
        return;
      }
      write(LIVE_KEY, newLive(day, planIndex, profile, data));
      nav.push({ name: "live" });
    },
  };

  return (
    <AppContext.Provider value={value}>
      <Shell />
    </AppContext.Provider>
  );
}