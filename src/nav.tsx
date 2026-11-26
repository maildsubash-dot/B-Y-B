import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { AppData, PlanDay, Profile, SetData } from "./store";

/* ==========================================================
   Navigation like a phone app: screens open on top of each
   other and the phone's back button (or back swipe) closes the
   top one. On the Home screen, back leaves the app.
   ========================================================== */

/* ---------- The phone's back button ---------- */
type BackHandler = { fn: () => void; priority: number };
const handlers: BackHandler[] = [];
let armed = false; // is there a history entry waiting to catch "back"?
let skip = 0; // our own history.back() calls to ignore
let timer = 0;

function sync() {
  timer = 0;
  if (skip > 0) return;
  const want = handlers.length > 0;
  if (want && !armed) {
    window.history.pushState({ byb: true }, "");
    armed = true;
  } else if (!want && armed) {
    armed = false;
    skip += 1;
    window.history.back();
  }
}
function scheduleSync() {
  if (!timer) timer = window.setTimeout(sync, 30);
}
window.addEventListener("popstate", () => {
  if (skip > 0) {
    skip -= 1;
    scheduleSync();
    return;
  }
  armed = false;
  let top: BackHandler | undefined;
  for (const h of handlers) if (!top || h.priority >= top.priority) top = h;
  top?.fn();
  scheduleSync();
});

// While enabled, the phone's back button calls onBack instead of leaving.
export function useBackHandler(enabled: boolean, onBack: () => void, priority = 0) {
  const ref = useRef(onBack);
  useEffect(() => {
    ref.current = onBack;
  });
  useEffect(() => {
    if (!enabled) return;
    const entry: BackHandler = { fn: () => ref.current(), priority };
    handlers.push(entry);
    scheduleSync();
    return () => {
      const i = handlers.indexOf(entry);
      if (i >= 0) handlers.splice(i, 1);
      scheduleSync();
    };
  }, [enabled, priority]);
}

/* ---------- Screens ---------- */
export type TabName = "home" | "workouts" | "food" | "coach" | "progress";
export type Screen = { name: string; id?: string; index?: number; pos?: number; q?: string };
export type Nav = {
  tab: TabName; screen: Screen; depth: number;
  push: (s: Screen) => void; back: () => void; replace: (s: Screen) => void;
  switchTab: (t: TabName) => void; toRoot: () => void;
};

const rootOf = (t: TabName): Screen[] => (t === "home" ? [{ name: "home" }] : [{ name: "home" }, { name: t }]);

export function useNav(): Nav {
  const [st, setSt] = useState<{ tab: TabName; stack: Screen[] }>({ tab: "home", stack: rootOf("home") });
  const back = () =>
    setSt((s) => (s.stack.length > 1 ? { tab: s.stack.length === 2 ? "home" : s.tab, stack: s.stack.slice(0, -1) } : s));
  useBackHandler(st.stack.length > 1, back);
  return {
    tab: st.tab,
    screen: st.stack[st.stack.length - 1],
    depth: st.stack.length - 1,
    push: (screen) => setSt((s) => ({ ...s, stack: [...s.stack, screen] })),
    back,
    replace: (screen) => setSt((s) => ({ ...s, stack: [...s.stack.slice(0, -1), screen] })),
    switchTab: (t) => setSt({ tab: t, stack: rootOf(t) }),
    toRoot: () => setSt((s) => ({ ...s, stack: rootOf(s.tab) })),
  };
}

/* ---------- Shared app state ---------- */
export type AppValue = {
  profile: Profile;
  setProfile: (p: Profile) => void;
  data: AppData;
  setData: SetData;
  nav: Nav;
  preview: PlanDay | null; // a one-off workout being looked at
  showWorkout: (day: PlanDay) => void;
  startWorkout: (day: PlanDay, planIndex: number | null) => void;
};

export const AppContext = createContext<AppValue | null>(null);

export function useApp(): AppValue {
  const value = useContext(AppContext);
  if (!value) throw new Error("useApp must be used inside the app");
  return value;
}