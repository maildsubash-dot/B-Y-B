import { useMemo, useState, type ReactNode } from "react";
import type { AppData, PageProps, Plan, PlanDay, PlanExercise, Profile, SetData } from "./store";
import { prettyDate } from "./store";
import { EQUIP_LABEL, EXERCISES, LEVEL_NAME, MUSCLES, UNIT_LABEL, byId, demoUrl, kindOf, type Exercise } from "./exercises";
import { CATEGORIES, REGIONS, categoryOf, equipLabelOf, exerciseDbStatus, imagesOf, isImported, regionOf } from "./exdb";
import { availableEquip, bestsFrom, canDo, estimateMinutes, isSafeFor, prescribe, showWeight, trainingWeekdays } from "./train";
import { Btn, Chip, Modal, Note, PageTitle, Stepper, inputBase, inputClass } from "./ui";

/* ==========================================================
   Exercise library: ~1,000 exercises by muscle and muscle head,
   type, equipment and level, with photos. Pick exercises to
   build your own workouts.
   ========================================================== */

type LibraryProps = PageProps & { start: (day: PlanDay) => void };

const SORTS = ["A–Z", "Easiest first", "Hardest first"];
const LEVELS = ["All", "Beginner", "Intermediate", "Advanced"];
const EQUIP_FILTERS = ["All", "Bodyweight", "Dumbbell", "Barbell", "Kettlebell", "Cable", "Machine", "Band", "Pull-up bar", "Other"];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function equipGroup(ex: Exercise): string {
  const label = equipLabelOf(ex.id);
  if (label && ["other", "medicine ball", "exercise ball", "foam roll"].includes(label)) return "Other";
  if (ex.equipment.includes("pullup") || ex.equipment.includes("bars")) return "Pull-up bar";
  const k = kindOf(ex);
  if (k === "Cardio") return ex.equipment.length ? "Machine" : "Bodyweight";
  return k;
}

function ChipRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mt-3">
      <p className="mb-1.5 text-[11px] uppercase tracking-wide text-white/45">{label}</p>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">{children}</div>
    </div>
  );
}

export default function Library({ profile, data, setData, start }: LibraryProps) {
  const [query, setQuery] = useState("");
  const [muscle, setMuscle] = useState("All");
  const [region, setRegion] = useState("All");
  const [category, setCategory] = useState("All");
  const [equip, setEquip] = useState("All");
  const [level, setLevel] = useState("All");
  const [mine, setMine] = useState(true);
  const [favOnly, setFavOnly] = useState(false);
  const [sort, setSort] = useState(SORTS[0]);
  const [limit, setLimit] = useState(100);
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PlanExercise[]>([]);
  const [building, setBuilding] = useState(false);

  const available = useMemo(() => availableEquip(profile), [profile]);
  const q = query.trim().toLowerCase();
  const favourites = data.favourites;

  const list = useMemo(() => {
    const words = q.split(/\s+/).filter(Boolean);
    return EXERCISES.filter((ex) => {
      if (words.length) {
        const hay = `${ex.name} ${ex.muscle} ${regionOf(ex)} ${ex.secondary.join(" ")} ${categoryOf(ex)}`.toLowerCase();
        if (!words.every((w) => hay.includes(w))) return false;
      }
      return (
        (muscle === "All" || ex.muscle === muscle) &&
        (region === "All" || regionOf(ex) === region) &&
        (category === "All" || categoryOf(ex) === category) &&
        (equip === "All" || equipGroup(ex) === equip) &&
        (level === "All" || LEVEL_NAME[ex.level] === level) &&
        (!mine || canDo(ex, available)) &&
        (!favOnly || favourites.includes(ex.id))
      );
    }).sort((a, b) => {
      if (sort === "Easiest first") return a.level - b.level || a.name.localeCompare(b.name);
      if (sort === "Hardest first") return b.level - a.level || a.name.localeCompare(b.name);
      return a.name.localeCompare(b.name);
    });
  }, [q, muscle, region, category, equip, level, mine, favOnly, sort, available, favourites]);

  const toggleFav = (id: string) =>
    setData((d) => ({ ...d, favourites: d.favourites.includes(id) ? d.favourites.filter((x) => x !== id) : [...d.favourites, id] }));
  const inDraft = (id: string) => draft.some((x) => x.id === id);
  const toggleDraft = (id: string) =>
    setDraft((list) => (list.some((x) => x.id === id) ? list.filter((x) => x.id !== id) : [...list, prescribe(id, profile) ?? { id, sets: 3, reps: "10–12", rest: 60 }]));

  return (
    <div className={draft.length ? "pb-24" : "pb-6"}>
      <PageTitle title="Exercise library" sub={`${EXERCISES.length} exercises. Tap + to build your own workout.`} />
      {exerciseDbStatus() === "error" && (
        <Note tone="warn">The full exercise list couldn't be loaded, so only BYB's own exercises are shown. Run: node scripts/import-data.mjs</Note>
      )}

      <input
        className={`${inputClass} mt-4`}
        type="search"
        placeholder="Search, e.g. incline curl, rear delt, hamstring"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setLimit(100);
        }}
      />

      <ChipRow label="Muscle">
        {["All", ...MUSCLES].map((m) => (
          <Chip
            key={m}
            label={m}
            on={muscle === m}
            onClick={() => {
              setMuscle(m);
              setRegion("All");
              setLimit(100);
            }}
          />
        ))}
      </ChipRow>
      {REGIONS[muscle] && (
        <ChipRow label="Part / head">
          {["All", ...REGIONS[muscle]].map((r) => (
            <Chip key={r} label={r} on={region === r} onClick={() => setRegion(r)} />
          ))}
        </ChipRow>
      )}
      <ChipRow label="Type">
        {["All", ...CATEGORIES].map((c) => (
          <Chip key={c} label={cap(c)} on={category === c} onClick={() => setCategory(c)} />
        ))}
      </ChipRow>
      <ChipRow label="Equipment">
        {EQUIP_FILTERS.map((e) => (
          <Chip key={e} label={e} on={equip === e} onClick={() => setEquip(e)} />
        ))}
      </ChipRow>
      <ChipRow label="Level">
        {LEVELS.map((l) => (
          <Chip key={l} label={l} on={level === l} onClick={() => setLevel(l)} />
        ))}
      </ChipRow>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Chip label="Only what I can do" on={mine} onClick={() => setMine(!mine)} />
        <Chip label="★ Favourites" on={favOnly} onClick={() => setFavOnly(!favOnly)} />
        <select className={`${inputBase} ml-auto py-1.5 text-xs`} value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
          {SORTS.map((s) => (
            <option key={s} value={s} className="bg-neutral-900">
              {s}
            </option>
          ))}
        </select>
      </div>

      <p className="mt-4 text-xs text-white/45">
        {list.length} exercise{list.length === 1 ? "" : "s"}
      </p>
      <ul>
        {list.slice(0, limit).map((ex) => {
          const fav = favourites.includes(ex.id);
          const added = inDraft(ex.id);
          return (
            <li key={ex.id} className="flex items-center gap-2 border-b border-white/10 py-3">
              <button type="button" className="flex-1 text-left" onClick={() => setOpenId(ex.id)}>
                <p className="font-semibold">{ex.name}</p>
                <p className="text-xs text-white/50">
                  {ex.muscle} · {regionOf(ex)} · {equipGroup(ex)} · {LEVEL_NAME[ex.level]}
                  {!isSafeFor(ex, profile) && <span className="text-yellow-300"> · check first</span>}
                </p>
              </button>
              <button
                type="button"
                aria-label={fav ? `Remove ${ex.name} from favourites` : `Add ${ex.name} to favourites`}
                onClick={() => toggleFav(ex.id)}
                className={`px-1 text-xl ${fav ? "text-neon" : "text-white/30"}`}
              >
                {fav ? "★" : "☆"}
              </button>
              <button
                type="button"
                aria-label={added ? `Remove ${ex.name} from your workout` : `Add ${ex.name} to your workout`}
                onClick={() => toggleDraft(ex.id)}
                className={`h-9 w-9 shrink-0 rounded-full border text-lg font-bold ${added ? "border-neon bg-neon text-black" : "border-white/25 text-white/80"}`}
              >
                {added ? "✓" : "+"}
              </button>
            </li>
          );
        })}
      </ul>
      {list.length > limit && (
        <div className="mt-4">
          <Btn kind="soft" onClick={() => setLimit(limit + 100)}>
            Show more ({list.length - limit} left)
          </Btn>
        </div>
      )}
      {list.length === 0 && <Note>No exercises match. Try clearing a filter{mine ? ", or turn off Only what I can do" : ""}.</Note>}

      {draft.length > 0 && (
        <div className="fixed inset-x-0 bottom-16 z-20 px-4">
          <div className="mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl border border-neon/40 bg-[#141414] p-3 shadow-lg">
            <p className="text-sm">
              <b>{draft.length}</b> exercise{draft.length === 1 ? "" : "s"} in your workout
            </p>
            <Btn small onClick={() => setBuilding(true)}>
              Build workout
            </Btn>
          </div>
        </div>
      )}

      {openId && (
        <ExerciseSheet
          id={openId}
          profile={profile}
          data={data}
          setData={setData}
          onClose={() => setOpenId(null)}
          inWorkout={inDraft}
          onToggleWorkout={toggleDraft}
        />
      )}
      {building && (
        <Builder
          draft={draft}
          setDraft={setDraft}
          profile={profile}
          data={data}
          setData={setData}
          start={start}
          onClose={() => setBuilding(false)}
        />
      )}
    </div>
  );
}

/* ---------- Build your own workout ---------- */
function Builder({
  draft,
  setDraft,
  profile,
  data,
  setData,
  start,
  onClose,
}: {
  draft: PlanExercise[];
  setDraft: (fn: (list: PlanExercise[]) => PlanExercise[]) => void;
  profile: Profile;
  data: AppData;
  setData: SetData;
  start: (day: PlanDay) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("My workout");
  const [msg, setMsg] = useState("");
  const day: PlanDay = { title: name.trim() || "My workout", focus: "Custom workout", exercises: draft };
  const edit = (i: number, patch: Partial<PlanExercise>) => setDraft((list) => list.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const move = (i: number, dir: number) =>
    setDraft((list) => {
      const j = i + dir;
      if (j < 0 || j >= list.length) return list;
      const copy = [...list];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });

  const saveRoutine = () => {
    const plan: Plan = {
      choice: "Auto|Auto",
      split: "Custom workout",
      minutes: estimateMinutes(day),
      weekdays: data.plan?.weekdays ?? trainingWeekdays(profile),
      days: [day],
      why: ["Built by you in the exercise library."],
      seed: Date.now(),
    };
    setData((d) => ({ ...d, routines: [...d.routines, { name: day.title, plan }] }));
    setMsg("Saved. Find it under Saved routines on the Train page.");
  };

  const addToPlan = () => {
    setData((d) => {
      if (!d.plan) return d;
      const taken = new Set(d.plan.days.map((x) => x.title));
      let title = day.title;
      let k = 2;
      while (taken.has(title)) title = `${day.title} (${k++})`;
      return { ...d, plan: { ...d.plan, days: [...d.plan.days, { ...day, title }] } };
    });
    setMsg("Added to your plan as a new workout day.");
  };

  return (
    <Modal title="Your workout" onClose={onClose}>
      <label className="mt-4 block text-xs text-white/60">
        Workout name
        <input className={`${inputClass} mt-1`} value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
      </label>
      <p className="mt-2 text-xs text-white/45">About {estimateMinutes(day)} min including warm-up</p>

      <ul className="mt-3 space-y-3">
        {draft.map((x, i) => {
          const ex = byId(x.id);
          return (
            <li key={x.id} className="rounded-xl border border-white/10 p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">
                    {i + 1}. {ex?.name ?? x.id}
                  </p>
                  {ex && <p className="text-xs text-white/45">{ex.muscle} · {regionOf(ex)}</p>}
                </div>
                <div className="flex gap-1">
                  <button type="button" aria-label="Move up" className="px-1 text-white/50" onClick={() => move(i, -1)}>
                    ↑
                  </button>
                  <button type="button" aria-label="Move down" className="px-1 text-white/50" onClick={() => move(i, 1)}>
                    ↓
                  </button>
                  <button type="button" aria-label="Remove" className="px-1 text-white/40 hover:text-red-300" onClick={() => setDraft((list) => list.filter((_, j) => j !== i))}>
                    ✕
                  </button>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-white/60">
                <span className="flex items-center gap-1">
                  Sets <Stepper value={x.sets} min={1} onChange={(v) => edit(i, { sets: Math.min(8, Math.round(v)) })} />
                </span>
                <label className="flex items-center gap-1">
                  {ex ? cap(UNIT_LABEL[ex.unit]) : "Reps"}
                  <input className={`${inputBase} w-20 py-1 text-xs`} value={x.reps} maxLength={9} onChange={(e) => edit(i, { reps: e.target.value })} />
                </label>
                <span className="flex items-center gap-1">
                  Rest <Stepper value={x.rest} step={15} min={0} suffix="s" onChange={(v) => edit(i, { rest: Math.min(300, v) })} />
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      {msg && <p className="mt-3 rounded-lg bg-neon/15 px-3 py-2 text-xs text-neon">✓ {msg}</p>}

      <div className="mt-4 flex flex-col gap-2">
        <Btn disabled={!draft.length} onClick={() => start(day)}>
          ▶ Start now
        </Btn>
        <Btn kind="soft" disabled={!draft.length} onClick={saveRoutine}>
          Save as a routine
        </Btn>
        <Btn kind="soft" disabled={!draft.length || !data.plan} onClick={addToPlan}>
          Add to my plan as a new day
        </Btn>
        <Btn
          kind="danger"
          onClick={() => {
            setDraft(() => []);
            onClose();
          }}
        >
          Clear and close
        </Btn>
      </div>
    </Modal>
  );
}

/* ---------- Exercise details ---------- */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-5">
      <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-neon">{title}</h3>
      <div className="text-sm leading-relaxed text-white/80">{children}</div>
    </div>
  );
}

export function ExerciseSheet({
  id,
  profile,
  data,
  setData,
  onClose,
  inWorkout,
  onToggleWorkout,
}: {
  id: string;
  profile: Profile;
  data: AppData;
  setData: SetData;
  onClose: () => void;
  inWorkout?: (id: string) => boolean;
  onToggleWorkout?: (id: string) => void;
}) {
  const [current, setCurrent] = useState(id);
  const [msg, setMsg] = useState("");
  const ex = byId(current);
  if (!ex) return null;

  const equip = availableEquip(profile);
  const have = canDo(ex, equip);
  const painHit = ex.avoid.filter((a) => profile.painAreas.includes(a));
  const best = bestsFrom(data.sessions)[ex.id];
  const fav = data.favourites.includes(ex.id);
  const imgs = imagesOf(ex.id);
  const region = regionOf(ex);
  const easier = ex.easier ? byId(ex.easier) : undefined;
  const harder = ex.harder ? byId(ex.harder) : undefined;
  const tags = [...new Set([LEVEL_NAME[ex.level], cap(categoryOf(ex)), ex.type, ex.muscle, region])];
  const equipText = ex.equipment.length
    ? [...new Set(ex.equipment.map((e) => EQUIP_LABEL[e]))].join(", ")
    : "None, just your body";
  const originalEquip = equipLabelOf(ex.id);
  const alts = EXERCISES.filter((o) => o.pattern === ex.pattern && o.id !== ex.id && isSafeFor(o, profile))
    .sort(
      (a, b) =>
        Number(regionOf(b) === region) - Number(regionOf(a) === region) ||
        Number(canDo(b, equip)) - Number(canDo(a, equip)) ||
        Number(isImported(a)) - Number(isImported(b)) ||
        a.level - b.level,
    )
    .slice(0, 8);

  const toggleFav = () =>
    setData((d) => ({
      ...d,
      favourites: d.favourites.includes(ex.id) ? d.favourites.filter((x) => x !== ex.id) : [...d.favourites, ex.id],
    }));

  const addToDay = (index: number) => {
    const px = prescribe(ex.id, profile);
    if (!px) return;
    setData((d) =>
      d.plan
        ? { ...d, plan: { ...d.plan, days: d.plan.days.map((day, i) => (i === index ? { ...day, exercises: [...day.exercises, px] } : day)) } }
        : d,
    );
    setMsg(`Added to ${data.plan?.days[index]?.title ?? "your plan"}.`);
  };

  return (
    <Modal title={ex.name} onClose={onClose}>
      <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
        {tags.map((tag) => (
          <span key={tag} className="rounded-full bg-white/10 px-2 py-0.5 text-white/70">
            {tag}
          </span>
        ))}
      </div>

      {imgs.length > 0 && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {imgs.slice(0, 2).map((src, i) => (
              <img
                key={src}
                src={src}
                alt={`${ex.name}, ${i === 0 ? "start" : "finish"} position`}
                loading="lazy"
                className="aspect-[4/3] w-full rounded-xl bg-white/5 object-cover"
              />
            ))}
          </div>
          <p className="mt-1 text-[11px] text-white/40">Photos: Free Exercise DB (public domain). Needs internet.</p>
        </>
      )}

      {painHit.length > 0 && (
        <Note tone="warn">
          You mentioned {painHit.join(", ").toLowerCase()} pain. This exercise usually loads that area. Check with a doctor or
          physiotherapist before trying it.
        </Note>
      )}

      <a
        href={demoUrl(ex)}
        target="_blank"
        rel="noreferrer"
        className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-white/20 px-4 py-3 text-sm font-semibold hover:border-neon"
      >
        ▶ Watch a demo video
      </a>

      <Section title="Target muscles">
        <p>
          {ex.muscle} · {region}
          {ex.secondary.length > 0 && <span className="text-white/55"> · also {ex.secondary.join(", ")}</span>}
        </p>
      </Section>

      <Section title="Equipment">
        <p>
          {equipText}
          {originalEquip && originalEquip !== "body only" ? <span className="text-white/55"> ({originalEquip})</span> : null}
        </p>
        <p className={`mt-1 text-xs ${have ? "text-neon" : "text-white/45"}`}>{have ? "✓ You have what you need" : "Not in your equipment list"}</p>
      </Section>

      <Section title="How to do it">
        <ol className="list-decimal space-y-1.5 pl-5">
          {ex.steps.map((s, i) => (
            <li key={`${i}-${s.slice(0, 20)}`}>{s}</li>
          ))}
        </ol>
      </Section>

      {ex.mistakes.length > 0 && (
        <Section title="Common mistakes">
          <ul className="list-disc space-y-1 pl-5">
            {ex.mistakes.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Safety tip">
        <p>{ex.safety}</p>
      </Section>

      {(easier || harder) && (
        <Section title="Variations">
          <div className="flex flex-wrap gap-2">
            {easier && (
              <Btn small kind="soft" onClick={() => setCurrent(easier.id)}>
                Easier: {easier.name}
              </Btn>
            )}
            {harder && (
              <Btn small kind="soft" onClick={() => setCurrent(harder.id)}>
                Harder: {harder.name}
              </Btn>
            )}
          </div>
        </Section>
      )}

      {alts.length > 0 && (
        <Section title="Alternatives">
          <ul className="space-y-1">
            {alts.map((o) => (
              <li key={o.id}>
                <button type="button" className="text-left underline-offset-4 hover:underline" onClick={() => setCurrent(o.id)}>
                  {o.name}
                </button>{" "}
                <span className="text-xs text-white/45">
                  {regionOf(o)} · {LEVEL_NAME[o.level]}
                  {canDo(o, equip) ? " · ✓ you can do this" : ""}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {best && (
        <Section title="Your best">
          <p>
            {best.weight > 0 && <>Heaviest: {showWeight(best.weight, profile)} · </>}
            Most {UNIT_LABEL[ex.unit]}: {best.reps}
            <span className="text-white/45"> · last improved {prettyDate(best.date)}</span>
          </p>
        </Section>
      )}

      {data.plan && (
        <Section title="Add to a day in your plan">
          <div className="flex flex-wrap gap-2">
            {data.plan.days.map((day, i) => (
              <Chip key={day.title} label={`+ ${day.title}`} on={false} onClick={() => addToDay(i)} />
            ))}
          </div>
        </Section>
      )}
      {msg && <p className="mt-3 rounded-lg bg-neon/15 px-3 py-2 text-xs text-neon">✓ {msg}</p>}

      <div className="mt-6 flex flex-wrap gap-2">
        {onToggleWorkout && inWorkout && (
          <Btn onClick={() => onToggleWorkout(ex.id)}>{inWorkout(ex.id) ? "✓ In your workout" : "+ Add to my workout"}</Btn>
        )}
        <Btn kind="soft" onClick={toggleFav}>
          {fav ? "★ In favourites" : "☆ Add to favourites"}
        </Btn>
        <Btn kind="soft" onClick={onClose}>
          Close
        </Btn>
      </div>
    </Modal>
  );
}