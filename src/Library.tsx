import { useState, type ReactNode } from "react";
import type { AppData, PageProps, Profile, SetData } from "./store";
import { EQUIP_LABEL, EXERCISES, KINDS, LEVEL_NAME, MUSCLES, UNIT_LABEL, byId, demoUrl, kindOf } from "./exercises";
import { availableEquip, bestsFrom, canDo, isSafeFor, showWeight } from "./train";
import { Btn, Chip, Modal, Note, PageTitle, inputBase, inputClass } from "./ui";
import { prettyDate } from "./store";

const SORTS = ["A–Z", "Easiest first", "Hardest first"];

export default function Library({ profile, data, setData }: PageProps) {
  const [query, setQuery] = useState("");
  const [muscle, setMuscle] = useState("All");
  const [kind, setKind] = useState("All");
  const [mine, setMine] = useState(true);
  const [favOnly, setFavOnly] = useState(false);
  const [sort, setSort] = useState(SORTS[0]);
  const [openId, setOpenId] = useState<string | null>(null);

  const equip = availableEquip(profile);
  const q = query.trim().toLowerCase();
  const list = EXERCISES.filter(
    (ex) =>
      (!q || ex.name.toLowerCase().includes(q) || ex.muscle.toLowerCase().includes(q) || ex.secondary.some((s) => s.toLowerCase().includes(q))) &&
      (muscle === "All" || ex.muscle === muscle) &&
      (kind === "All" || ex.type === kind || kindOf(ex) === kind) &&
      (!mine || canDo(ex, equip)) &&
      (!favOnly || data.favourites.includes(ex.id)),
  ).sort((a, b) => {
    if (sort === "Easiest first") return a.level - b.level || a.name.localeCompare(b.name);
    if (sort === "Hardest first") return b.level - a.level || a.name.localeCompare(b.name);
    return a.name.localeCompare(b.name);
  });

  const toggleFav = (id: string) =>
    setData((d) => ({
      ...d,
      favourites: d.favourites.includes(id) ? d.favourites.filter((x) => x !== id) : [...d.favourites, id],
    }));

  return (
    <div className="pb-6">
      <PageTitle title="Exercise library" sub={`${EXERCISES.length} exercises with step-by-step instructions.`} />
      <input
        className={`${inputClass} mt-4`}
        type="search"
        placeholder="Search exercises or muscles"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <ChipRow label="Muscle">
        {["All", ...MUSCLES].map((m) => (
          <Chip key={m} label={m} on={muscle === m} onClick={() => setMuscle(m)} />
        ))}
      </ChipRow>
      <ChipRow label="Type">
        {["All", ...KINDS].map((k) => (
          <Chip key={k} label={k} on={kind === k} onClick={() => setKind(k)} />
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
        {list.map((ex) => {
          const fav = data.favourites.includes(ex.id);
          return (
            <li key={ex.id} className="flex items-center gap-3 border-b border-white/10 py-3">
              <button type="button" className="flex-1 text-left" onClick={() => setOpenId(ex.id)}>
                <p className="font-semibold">{ex.name}</p>
                <p className="text-xs text-white/50">
                  {ex.muscle} · {kindOf(ex)} · {LEVEL_NAME[ex.level]}
                  {!isSafeFor(ex, profile) && <span className="text-yellow-300"> · check first</span>}
                </p>
              </button>
              <button
                type="button"
                aria-label={fav ? `Remove ${ex.name} from favourites` : `Add ${ex.name} to favourites`}
                onClick={() => toggleFav(ex.id)}
                className={`px-2 text-xl ${fav ? "text-neon" : "text-white/30"}`}
              >
                {fav ? "★" : "☆"}
              </button>
            </li>
          );
        })}
      </ul>
      {list.length === 0 && (
        <Note>No exercises match. Try clearing a filter{mine ? ", or turn off Only what I can do" : ""}.</Note>
      )}

      {openId && <ExerciseSheet id={openId} profile={profile} data={data} setData={setData} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function ChipRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mt-3">
      <p className="mb-1.5 text-[11px] uppercase tracking-wide text-white/45">{label}</p>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">{children}</div>
    </div>
  );
}

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
}: {
  id: string;
  profile: Profile;
  data: AppData;
  setData: SetData;
  onClose: () => void;
}) {
  const [current, setCurrent] = useState(id);
  const ex = byId(current);
  if (!ex) return null;

  const equip = availableEquip(profile);
  const have = canDo(ex, equip);
  const painHit = ex.avoid.filter((a) => profile.painAreas.includes(a));
  const best = bestsFrom(data.sessions)[ex.id];
  const fav = data.favourites.includes(ex.id);
  const easier = ex.easier ? byId(ex.easier) : undefined;
  const harder = ex.harder ? byId(ex.harder) : undefined;
  const tags = [...new Set([LEVEL_NAME[ex.level], ex.type, kindOf(ex), ex.muscle])];
  const alts = EXERCISES.filter((o) => o.pattern === ex.pattern && o.id !== ex.id && isSafeFor(o, profile))
    .sort((a, b) => Number(canDo(b, equip)) - Number(canDo(a, equip)) || a.level - b.level)
    .slice(0, 6);

  const toggleFav = () =>
    setData((d) => ({
      ...d,
      favourites: d.favourites.includes(ex.id) ? d.favourites.filter((x) => x !== ex.id) : [...d.favourites, ex.id],
    }));

  return (
    <Modal title={ex.name} onClose={onClose}>
      <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
        {tags.map((tag) => (
          <span key={tag} className="rounded-full bg-white/10 px-2 py-0.5 text-white/70">
            {tag}
          </span>
        ))}
      </div>

      {painHit.length > 0 && (
        <Note tone="warn">
          You mentioned {painHit.join(", ").toLowerCase()} pain. This exercise usually loads that area, so BYB leaves it out of
          your plans. Check with a doctor or physiotherapist before trying it.
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
      <p className="mt-1 text-center text-[11px] text-white/40">Opens a YouTube search in your browser.</p>

      <Section title="Target muscles">
        <p>
          {ex.muscle}
          {ex.secondary.length > 0 && <span className="text-white/55"> · also {ex.secondary.join(", ")}</span>}
        </p>
      </Section>

      <Section title="Equipment">
        <p>{ex.equipment.length ? ex.equipment.map((e) => EQUIP_LABEL[e]).join(", ") : "None, just your body"}</p>
        <p className={`mt-1 text-xs ${have ? "text-neon" : "text-white/45"}`}>
          {have ? "✓ You have what you need" : "Not in your equipment list"}
        </p>
      </Section>

      <Section title="How to do it">
        <ol className="list-decimal space-y-1.5 pl-5">
          {ex.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </Section>

      <Section title="Common mistakes">
        <ul className="list-disc space-y-1 pl-5">
          {ex.mistakes.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      </Section>

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
                  {LEVEL_NAME[o.level]}
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

      <div className="mt-6 flex gap-2">
        <Btn onClick={toggleFav}>{fav ? "★ In favourites" : "☆ Add to favourites"}</Btn>
        <Btn kind="soft" onClick={onClose}>
          Close
        </Btn>
      </div>
    </Modal>
  );
}