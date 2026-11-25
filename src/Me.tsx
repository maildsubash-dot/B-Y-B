import { useRef, useState } from "react";
import type { AppData, PageProps, Profile } from "./store";
import { EMPTY_DATA } from "./store";
import { byId } from "./exercises";
import { trainingWeekdays } from "./train";
import { badges } from "./stats";
import { Btn, Card, Note, PageTitle } from "./ui";

/* ==========================================================
   Me: profile, classification, preferences, privacy,
   backup / restore and account deletion.
   ========================================================== */

type MeProps = PageProps & {
  editProfile: () => void;
  resetAll: () => void;
  replaceProfile: (p: Profile) => void;
};

function ageGroup(age: number) {
  if (age < 30) return "18–29";
  if (age < 45) return "30–44";
  if (age < 60) return "45–59";
  return "60+";
}

function Rows({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="divide-y divide-white/10">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-4 py-2 text-sm">
          <dt className="text-white/50">{k}</dt>
          <dd className="text-right">{v || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function Me({ profile, data, setData, go, editProfile, resetAll, replaceProfile }: MeProps) {
  const [confirm, setConfirm] = useState(false);
  const [message, setMessage] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const earned = badges(profile, data).filter((b) => b.earned).length;
  const favs = data.favourites.map((id) => byId(id)?.name).filter((n): n is string => !!n);
  const equipment =
    profile.place === "Gym" ? "Full gym" : profile.place === "Bodyweight only" ? "None (bodyweight)" : profile.equipment.join(", ");

  const classification: [string, string][] = [
    ["Age group", ageGroup(Number(profile.age))],
    ["Experience", profile.level],
    ["Main goal", profile.goals[0] ?? ""],
    ["Other goals", profile.goals.slice(1).join(", ") || "None"],
    ["Training place", profile.place],
    ["Equipment", equipment],
    ["Daily activity", profile.activity],
    ["Training frequency", `${trainingWeekdays(profile).length} days a week`],
    ["Diet", profile.diet],
  ];
  const prefs: [string, string][] = [
    ["Training days", profile.days.join(", ")],
    ["Workout length", `${profile.minutes} min`],
    ["Preferred time", profile.timeOfDay],
    ["Foods you eat", profile.cuisines.join(", ") || "Not set"],
    ["Allergies / avoid", [...profile.allergies, profile.otherAllergy].filter(Boolean).join(", ") || "None"],
    ["Budget", profile.budget || "Not set"],
    ["Food tracking", profile.foodTracking],
    ["Units", profile.units === "metric" ? "kg, cm" : "lb, ft"],
  ];
  const health: [string, string][] = [
    ["Health answers", profile.health.join(", ") || "Skipped"],
    ["Pain areas", profile.painAreas.join(", ") || "None"],
    ["Training history", profile.history || "Not added"],
  ];

  const exportData = async () => {
    const payload = JSON.stringify({ app: "BuildYourBody", version: 1, exportedAt: new Date().toISOString(), profile, data }, null, 2);
    const fileName = `byb-backup-${new Date().toISOString().slice(0, 10)}.json`;
    const file = new File([payload], fileName, { type: "application/json" });
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "BYB backup" });
        setMessage("Backup shared. Keep it somewhere safe; it contains your personal data.");
        return;
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage("Backup downloaded. Keep it somewhere safe; it contains your personal data.");
  };

  const importData = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as { app?: string; profile?: Profile; data?: Partial<AppData> };
      if (parsed.app !== "BuildYourBody" || !parsed.profile || !parsed.data) throw new Error("Not a BYB backup");
      const restored: AppData = { ...EMPTY_DATA, ...parsed.data };
      setData(() => restored);
      replaceProfile(parsed.profile);
      setMessage("Backup restored.");
    } catch {
      setMessage("That file isn't a BYB backup.");
    }
  };

  return (
    <div className="pb-6">
      <PageTitle title={profile.name} sub={`${profile.goals[0] ?? "Your profile"} · ${profile.level}`} />

      <div className="mt-4 flex flex-wrap gap-2">
        <Btn onClick={editProfile}>✎ Edit my answers</Btn>
        <Btn kind="soft" onClick={() => go("progress")}>
          🏅 {earned} badges
        </Btn>
      </div>
      <p className="mt-2 text-xs text-white/45">If you change your goals, level, equipment, days or health answers, your plan is rebuilt automatically.</p>

      <Card title="Your fitness classification">
        <Rows rows={classification} />
      </Card>

      <Card title="Preferences">
        <Rows rows={prefs} />
      </Card>

      <Card title="Health and history">
        <Rows rows={health} />
      </Card>

      <Card title="Saved">
        <p className="text-sm text-white/70">
          {data.routines.length} saved routine{data.routines.length === 1 ? "" : "s"} · {data.sessions.length} workouts logged
        </p>
        <p className="mt-2 text-sm text-white/70">Favourite exercises: {favs.length ? favs.join(", ") : "none yet"}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Btn small kind="soft" onClick={() => go("train")}>
            Routines
          </Btn>
          <Btn small kind="soft" onClick={() => go("library")}>
            Exercise library
          </Btn>
        </div>
      </Card>

      <Card title="Privacy and your data">
        <p className="text-sm text-white/70">
          Everything is stored only on this device. Nothing is uploaded and nothing is shared with anyone.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Btn small onClick={() => void exportData()}>
            ⬇ Back up my data
          </Btn>
          <Btn small kind="soft" onClick={() => fileRef.current?.click()}>
            ⬆ Restore a backup
          </Btn>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importData(f);
            e.target.value = "";
          }}
        />
        <p className="mt-2 text-[11px] text-white/45">Restoring replaces everything currently in the app with the backup.</p>
        {message && <p className="mt-3 rounded-lg bg-neon/15 px-3 py-2 text-xs text-neon">{message}</p>}

        <div className="mt-5 border-t border-white/10 pt-4">
          {!confirm ? (
            <Btn small kind="danger" onClick={() => setConfirm(true)}>
              Delete all my data
            </Btn>
          ) : (
            <>
              <p className="text-sm text-red-200">
                This permanently deletes your profile, workouts, food logs and progress from this device. It can't be undone.
              </p>
              <div className="mt-3 flex gap-2">
                <Btn small kind="danger" onClick={resetAll}>
                  Yes, delete everything
                </Btn>
                <Btn small kind="soft" onClick={() => setConfirm(false)}>
                  Cancel
                </Btn>
              </div>
            </>
          )}
        </div>
      </Card>

      <Card title="Friends and community">
        <p className="text-sm text-white/70">
          Friends, leaderboards and community challenges need online accounts, so they aren't in this version. Your daily and
          weekly challenges and badges are on the dashboard and the Progress page.
        </p>
      </Card>

      <Card title="About">
        <p className="text-sm text-white/70">BuildYourBody (BYB) · version 1.0 · free</p>
        <Note>
          BYB gives general fitness and nutrition information. It does not diagnose conditions, prescribe medicine, or replace a
          doctor, physiotherapist or registered dietitian. Stop any exercise that causes pain, and get medical advice if you have
          a health condition.
        </Note>
      </Card>
    </div>
  );
}