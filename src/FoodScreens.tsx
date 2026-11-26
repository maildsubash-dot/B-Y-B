import { useMemo, useState, type ComponentType } from "react";
import type { FoodEntry, FoodItem } from "./store";
import { addDays, dateKey, prettyDate, uid, weekdayOf } from "./store";
import { MEALS, foodOn, nutritionTargets, totalsOf } from "./stats";
import {
  amountFor, entryFrom, fitsProfile, mealForNow, nutrientsFor, parseMeal, preferredZones, proteinPicks, r1,
  recentFoods, searchFoods, searchOnline, sourceLabel, useFoodDb,
} from "./fooddb";
import { useApp } from "./nav";
import { Header, IconBtn, RootHeader, Row, SearchBox, SectionTitle, Sheet, Tile, Toggle } from "./kit";
import { Icon } from "./icons";
import { Bar, Btn, Card, Chip, Note, Stat, Stepper, inputBase, inputClass } from "./ui";

/* ==========================================================
   Food: today's numbers, log food (search or type what you
   ate), diary, suggested high-protein foods, Indian foods by
   region and state, world foods, packaged foods online, and
   your own foods and recipes. All values are per 100 g.
   ========================================================== */

const online = new Map<string, FoodItem>(); // packaged foods found online
const memo: { q: string; meal: string; off: string; offList: FoodItem[] } = { q: "", meal: "", off: "", offList: [] };

const DIET_DOT: Record<FoodItem["d"], string> = { vegan: "bg-green-500", veg: "bg-green-500", egg: "bg-yellow-400", nonveg: "bg-red-500" };
const DIET_NAME: Record<FoodItem["d"], string> = { vegan: "Vegan", veg: "Vegetarian", egg: "Contains egg", nonveg: "Non-vegetarian" };
const DIET_RANK: FoodItem["d"][] = ["vegan", "veg", "egg", "nonveg"];
const ZONE_ORDER = ["All-India", "South", "North", "East", "West", "North-East", "Central"];
const zoneRank = (z: string) => (ZONE_ORDER.includes(z) ? ZONE_ORDER.indexOf(z) : 99);
const zoneName = (z: string) => (z === "All-India" ? "All-India" : `${z} India`);

function placeOf(f: FoodItem) {
  if (f.src === "Mine") return "My food";
  if (f.src === "Recipe") return "My recipe";
  if (f.src === "OFF") return "Packaged";
  if (f.st) return f.st;
  if (f.zn && f.zn !== "World") return zoneName(f.zn);
  return f.g || "World";
}

function useFoods() {
  const { data } = useApp();
  const db = useFoodDb();
  const all = useMemo(() => (db.foods ? [...data.myFoods, ...db.foods] : null), [db.foods, data.myFoods]);
  return { all, error: db.error };
}

function Loading({ error }: { error: string }) {
  if (error) return <Note tone="warn">Couldn't load the food database. {error}</Note>;
  return <p className="mt-8 text-center text-sm text-white/50">Loading foods…</p>;
}

function FoodRow({ f, sub, onClick }: { f: FoodItem; sub?: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-left active:bg-white/10">
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${DIET_DOT[f.d]}`} title={DIET_NAME[f.d]} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{f.n}</span>
        <span className="block truncate text-xs text-white/50">
          {sub ?? `${Math.round(f.k)} kcal · ${r1(f.p)} g protein per 100 g · ${placeOf(f)}`}
        </span>
      </span>
      <Icon name="chevron" size={18} className="shrink-0 text-white/30" />
    </button>
  );
}

function EntryRow({ e, onClick }: { e: FoodEntry; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center justify-between gap-3 rounded-xl bg-white/5 p-3 text-left active:bg-white/10">
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold">{e.name}</span>
        <span className="block text-xs text-white/50">
          {e.grams !== undefined ? `${Math.round(e.grams)} g` : `${e.qty} serving${e.qty === 1 ? "" : "s"}`}
        </span>
      </span>
      <span className="shrink-0 text-right text-xs">
        <span className="block font-semibold">{Math.round(e.kcal)} kcal</span>
        <span className="block text-white/50">{r1(e.protein)} g protein</span>
      </span>
    </button>
  );
}

/* ---------- Food tab ---------- */
function FoodHome() {
  const { profile, data, nav } = useApp();
  useFoodDb(); // starts loading the food database early
  const today = dateKey();
  const entries = foodOn(data, today);
  const tot = totalsOf(entries);
  const t = nutritionTargets(profile, data);
  const simple = profile.foodTracking === "Keep it simple";
  const proteinOnly = profile.foodTracking === "Protein only";
  const byMeal = MEALS.map((m) => ({ meal: m, list: entries.filter((e) => e.meal === m) })).filter((x) => x.list.length);
  const openLog = () => {
    memo.q = "";
    memo.meal = "";
    nav.push({ name: "logFood" });
  };
  return (
    <>
      <RootHeader title="Food" sub="Today" />
      <Card>
        {simple ? (
          <p className="text-sm text-white/70">{entries.length} items logged today. Aim for protein and vegetables at every meal.</p>
        ) : (
          <>
            <div className="flex items-end justify-between">
              {!proteinOnly && (
                <div>
                  <p className="text-3xl font-bold">{Math.max(0, Math.round(t.kcal - tot.kcal))}</p>
                  <p className="text-xs text-white/50">kcal left of {t.kcal}</p>
                </div>
              )}
              <div className={proteinOnly ? "" : "text-right"}>
                <p className="text-2xl font-bold text-neon">{Math.round(tot.protein)} g</p>
                <p className="text-xs text-white/50">protein of {t.protein} g</p>
              </div>
            </div>
            {!proteinOnly && <Bar label="Calories" value={tot.kcal} max={t.kcal} right={`${Math.round(tot.kcal)} / ${t.kcal} kcal`} />}
            <Bar label="Protein" value={tot.protein} max={t.protein} right={`${Math.round(tot.protein)} / ${t.protein} g`} />
            {!proteinOnly && (
              <>
                <Bar label="Carbs" value={tot.carbs} max={t.carbs} right={`${Math.round(tot.carbs)} / ${t.carbs} g`} />
                <Bar label="Fat" value={tot.fat} max={t.fat} right={`${Math.round(tot.fat)} / ${t.fat} g`} />
              </>
            )}
          </>
        )}
        <div className="mt-4"><Btn onClick={openLog}>+ Log food</Btn></div>
      </Card>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Tile icon="list" title="Food diary" sub="What you ate" onClick={() => nav.push({ name: "diary", q: today })} />
        <Tile icon="zap" title="Suggested foods" sub="High-protein picks" onClick={() => nav.push({ name: "suggested" })} />
        <Tile icon="book" title="Browse foods" sub="Indian by state, world" onClick={() => nav.push({ name: "browse" })} />
        <Tile icon="search" title="Packaged foods" sub="Search online" onClick={() => nav.push({ name: "packaged" })} />
      </div>
      <div className="mt-3">
        <Row icon="bookmark" title="My foods & recipes" sub={`${data.myFoods.length} saved`} onClick={() => nav.push({ name: "myFoods" })} />
      </div>
      {byMeal.length > 0 && (
        <>
          <SectionTitle>Today's meals</SectionTitle>
          <div className="mt-2 space-y-2">
            {byMeal.map(({ meal, list }) => {
              const mt = totalsOf(list);
              return (
                <Row key={meal} title={meal} sub={`${list.length} item${list.length === 1 ? "" : "s"} · ${Math.round(mt.kcal)} kcal · ${Math.round(mt.protein)} g protein`}
                  onClick={() => nav.push({ name: "diary", q: today })} />
              );
            })}
          </div>
        </>
      )}
    </>
  );
}

/* ---------- Log food ---------- */
function LogFood() {
  const { profile, data, nav } = useApp();
  const { all, error } = useFoods();
  const [meal, setMeal0] = useState(nav.screen.q || memo.meal || mealForNow());
  const [q, setQ0] = useState(memo.q);
  const [typed, setTyped] = useState("");
  const [mine, setMine] = useState(true);
  const setMeal = (m: string) => {
    memo.meal = m;
    setMeal0(m);
  };
  const setQ = (v: string) => {
    memo.q = v;
    setQ0(v);
  };
  const zones = preferredZones(profile);
  const inMeal = foodOn(data, dateKey()).filter((e) => e.meal === meal);
  const results = all && q.trim() ? searchFoods(all, q, { limit: 80, zones }).filter((f) => !mine || fitsProfile(f, profile)).slice(0, 40) : [];
  const recent = all ? recentFoods(data.food, all) : [];
  const open = (f: FoodItem) => nav.push({ name: "foodItem", id: f.id, q: meal });
  return (
    <>
      <Header title="Log food"
        sub={inMeal.length ? `${meal} so far: ${inMeal.length} item${inMeal.length === 1 ? "" : "s"}, ${Math.round(totalsOf(inMeal).kcal)} kcal` : `Adding to ${meal}`} />
      <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
        {MEALS.map((m) => <Chip key={m} label={m} on={meal === m} onClick={() => setMeal(m)} />)}
      </div>
      <SearchBox value={q} onChange={setQ} placeholder="Search Indian or world foods" />
      {!all ? (
        <Loading error={error} />
      ) : q.trim() ? (
        <>
          <Card><Toggle label="Only foods that fit my diet and allergies" on={mine} onChange={setMine} /></Card>
          <div className="mt-3 space-y-2">
            {results.map((f) => <FoodRow key={f.id} f={f} onClick={() => open(f)} />)}
            {!results.length && <Note>No foods found. Try another spelling, or search Packaged foods online.</Note>}
          </div>
        </>
      ) : (
        <>
          <Card title="Type what you ate">
            <textarea className={`${inputClass} min-h-20`} value={typed} onChange={(e) => setTyped(e.target.value)}
              placeholder="For example: 3 idli, 1 katori sambar and a glass of milk" />
            <div className="mt-3">
              <Btn disabled={!typed.trim()} onClick={() => nav.push({ name: "quickAdd", q: `${meal}|${typed}` })}>Find these foods</Btn>
            </div>
          </Card>
          {recent.length > 0 && (
            <>
              <SectionTitle>Recent</SectionTitle>
              <div className="mt-2 space-y-2">
                {recent.map(({ food, grams }) => (
                  <FoodRow key={food.id} f={food} sub={`Last time ${Math.round(grams)} g · ${Math.round((food.k * grams) / 100)} kcal`} onClick={() => open(food)} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}

type Edit = { id?: string; grams?: number; on?: boolean };

function QuickAdd() {
  const { profile, setData, nav } = useApp();
  const { all, error } = useFoods();
  const raw = nav.screen.q ?? "";
  const cut = raw.indexOf("|");
  const meal = cut >= 0 ? raw.slice(0, cut) : mealForNow();
  const text = cut >= 0 ? raw.slice(cut + 1) : raw;
  const parsed = useMemo(() => (all ? parseMeal(text, all, preferredZones(profile)) : null), [all, text, profile]);
  const [edits, setEdits] = useState<Record<number, Edit>>({});
  if (!parsed) return (<><Header title="Type what you ate" /><Loading error={error} /></>);

  const setEdit = (i: number, patch: Edit) => setEdits((e) => ({ ...e, [i]: { ...e[i], ...patch } }));
  const lines = parsed.map((it, i) => {
    const e = edits[i] ?? {};
    const food = (e.id ? it.options.find((o) => o.id === e.id) : undefined) ?? it.food;
    const grams = e.grams ?? (e.id && food ? amountFor(food, it.count, it.unit).grams : it.grams);
    return { it, food, grams, on: e.on ?? !!it.food, changed: !!e.id || e.grams !== undefined };
  });
  const chosen = lines.flatMap((l) => (l.on && l.food && l.grams > 0 ? [{ food: l.food, grams: l.grams }] : []));
  const total = chosen.reduce(
    (a, c) => {
      const n = nutrientsFor(c.food, c.grams);
      return { kcal: a.kcal + n.kcal, protein: a.protein + n.protein };
    },
    { kcal: 0, protein: 0 },
  );
  const add = () => {
    const date = dateKey();
    const entries = chosen.map((c) => entryFrom(c.food, c.grams, meal, date));
    if (!entries.length) return;
    setData((d) => ({ ...d, food: [...d.food, ...entries] }));
    nav.toRoot();
  };

  return (
    <>
      <Header title="Check your meal" sub={`Adding to ${meal}`} />
      <p className="mt-3 text-xs text-white/50">Check each food and the grams. Change anything that's wrong.</p>
      {lines.map((l, i) => (
        <Card key={i}>
          <div className="flex items-start justify-between gap-3">
            <p className="text-xs text-white/50">You typed: “{l.it.text}”</p>
            {l.food && (
              <input type="checkbox" aria-label="Include this food" checked={l.on} onChange={(e) => setEdit(i, { on: e.target.checked })}
                className="h-5 w-5 shrink-0 accent-[#b6ff3c]" />
            )}
          </div>
          {l.it.options.length > 0 ? (
            <select value={l.food?.id ?? ""} onChange={(e) => setEdit(i, { id: e.target.value, grams: undefined })} className={`${inputClass} mt-2 bg-[#151515]`}>
              {l.it.options.map((o) => <option key={o.id} value={o.id}>{o.n}</option>)}
            </select>
          ) : (
            <Note tone="warn">No matching food found. Use the search on the Log food screen instead.</Note>
          )}
          {l.food && (
            <div className="mt-3 flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="number" inputMode="decimal" min={0} className={`${inputBase} w-24`} value={Math.round(l.grams)}
                  onChange={(e) => setEdit(i, { grams: Math.max(0, Number(e.target.value) || 0) })} />
                g
              </label>
              <p className="text-right text-xs">
                <span className="block font-semibold">{Math.round(nutrientsFor(l.food, l.grams).kcal)} kcal</span>
                <span className="text-white/50">{r1(nutrientsFor(l.food, l.grams).protein)} g protein</span>
              </p>
            </div>
          )}
          {l.food && !l.changed && l.it.how && <p className="mt-1 text-[11px] text-white/40">{l.it.how}</p>}
        </Card>
      ))}
      <Card>
        <p className="text-sm">Total: <b>{Math.round(total.kcal)} kcal</b> · <b>{r1(total.protein)} g protein</b></p>
        <div className="mt-3"><Btn disabled={!chosen.length} onClick={add}>Add {chosen.length} food{chosen.length === 1 ? "" : "s"} to {meal.toLowerCase()}</Btn></div>
      </Card>
    </>
  );
}

/* ---------- One food ---------- */
function FoodItemScreen() {
  const { profile, setData, nav } = useApp();
  const { all, error } = useFoods();
  const [meal, setMeal] = useState(nav.screen.q || memo.meal || mealForNow());
  const [grams, setGrams] = useState<number | null>(null);
  const [confirm, setConfirm] = useState(false);
  const id = nav.screen.id ?? "";
  const f = (all ?? []).find((x) => x.id === id) ?? online.get(id);
  if (!f) return (<><Header title="Food" />{all ? <Note>Food not found.</Note> : <Loading error={error} />}</>);

  const g = grams ?? (f.pt[0] ? Math.round(f.pt[0][1]) : 100);
  const n = nutrientsFor(f, g);
  const bad = f.a.filter((a) => profile.allergies.includes(a));
  const fits = fitsProfile(f, profile);
  const mine = f.src === "Mine" || f.src === "Recipe";
  const add = () => {
    setData((d) => ({ ...d, food: [...d.food, entryFrom(f, g, meal, dateKey())] }));
    nav.back();
  };
  const del = () => {
    setData((d) => ({ ...d, myFoods: d.myFoods.filter((x) => x.id !== f.id) }));
    setConfirm(false);
    nav.back();
  };
  const per100: [string, string][] = [
    ["Calories", `${Math.round(f.k)} kcal`], ["Protein", `${r1(f.p)} g`], ["Carbs", `${r1(f.c)} g`], ["Fat", `${r1(f.f)} g`],
    ["Fibre", `${r1(f.fb)} g`], ["Sugar", `${r1(f.s)} g`], ["Sodium", `${Math.round(f.na)} mg`],
  ];

  return (
    <>
      <Header title={f.n} sub={`${placeOf(f)} · ${sourceLabel(f.src)}`} />
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1">
          <span className={`h-2 w-2 rounded-full ${DIET_DOT[f.d]}`} />
          {DIET_NAME[f.d]}
        </span>
        {f.j && <span className="rounded-full bg-white/10 px-2.5 py-1">Jain-friendly</span>}
        {f.g && <span className="rounded-full bg-white/10 px-2.5 py-1">{f.g}</span>}
      </div>
      {bad.length > 0 && <Note tone="warn">Contains {bad.join(", ").toLowerCase()}, which you said you avoid.</Note>}
      {!fits && !bad.length && <Note tone="warn">This doesn't fit your diet or the foods you avoid.</Note>}

      <Card title="How much?">
        <div className="flex flex-wrap gap-2">
          {f.pt.map(([label, gr], i) => (
            <Chip key={`${label}-${i}`} label={`${label} · ${Math.round(gr)} g`} on={Math.abs(g - gr) < 0.5} onClick={() => setGrams(Math.round(gr))} />
          ))}
          <Chip label="100 g" on={g === 100} onClick={() => setGrams(100)} />
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="number" inputMode="decimal" min={0} className={`${inputBase} w-24`} value={g}
              onChange={(e) => setGrams(Math.max(0, Number(e.target.value) || 0))} />
            grams
          </label>
          <Stepper value={g} step={10} min={5} onChange={setGrams} />
        </div>
      </Card>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Stat label="Calories" value={`${Math.round(n.kcal)} kcal`} />
        <Stat label="Protein" value={`${r1(n.protein)} g`} />
        <Stat label="Carbs" value={`${r1(n.carbs)} g`} />
        <Stat label="Fat" value={`${r1(n.fat)} g`} />
      </div>

      <SectionTitle>Add to</SectionTitle>
      <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1">
        {MEALS.map((m) => <Chip key={m} label={m} on={meal === m} onClick={() => setMeal(m)} />)}
      </div>
      <div className="mt-4"><Btn disabled={g <= 0} onClick={add}>Add {g} g to {meal.toLowerCase()}</Btn></div>

      <details className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
        <summary className="cursor-pointer text-sm font-semibold">Nutrition per 100 g</summary>
        <ul className="mt-2 space-y-1 text-sm">
          {per100.map(([k, v]) => (
            <li key={k} className="flex justify-between"><span className="text-white/60">{k}</span><span>{v}</span></li>
          ))}
        </ul>
      </details>
      {f.ing && f.ing.length > 0 && (
        <Card title="Ingredients">
          <ul className="space-y-1 text-sm">{f.ing.map((x) => <li key={x.id} className="flex justify-between"><span>{x.n}</span><span className="text-white/60">{x.grams} g</span></li>)}</ul>
        </Card>
      )}
      {mine && (
        <div className="mt-4 flex gap-2">
          <Btn kind="soft" onClick={() => nav.push({ name: f.src === "Recipe" ? "recipeForm" : "myFoodForm", id: f.id })}>Edit</Btn>
          <Btn kind="danger" onClick={() => setConfirm(true)}>Delete</Btn>
        </div>
      )}
      {f.src === "OFF" && (
        <p className="mt-4 text-[11px] text-white/40">Data from Open Food Facts, available under the Open Database Licence (ODbL). Check the packet for exact values.</p>
      )}
      {confirm && (
        <Sheet title={`Delete ${f.n}?`} onClose={() => setConfirm(false)}>
          <p className="text-sm text-white/70">Foods you already logged stay in your diary.</p>
          <div className="mt-4"><Btn kind="danger" onClick={del}>Delete</Btn></div>
        </Sheet>
      )}
    </>
  );
}

/* ---------- Diary ---------- */
function EditEntry({ entry, onClose }: { entry: FoodEntry; onClose: () => void }) {
  const { setData } = useApp();
  const byGrams = entry.grams !== undefined;
  const base = byGrams ? (entry.grams ?? 100) : entry.qty || 1;
  const [amount, setAmount] = useState(base);
  const [meal, setMeal] = useState(entry.meal);
  const k = base > 0 ? amount / base : 1;
  const save = () => {
    setData((d) => ({
      ...d,
      food: d.food.map((e) =>
        e.id !== entry.id ? e : {
          ...e, meal, qty: amount, grams: byGrams ? amount : e.grams,
          kcal: r1(e.kcal * k), protein: r1(e.protein * k), carbs: r1(e.carbs * k), fat: r1(e.fat * k), fibre: r1(e.fibre * k),
        }),
    }));
    onClose();
  };
  const del = () => {
    setData((d) => ({ ...d, food: d.food.filter((e) => e.id !== entry.id) }));
    onClose();
  };
  return (
    <Sheet title={entry.name} onClose={onClose}>
      <div className="flex items-center justify-between text-sm">
        <span>{byGrams ? "Grams" : "Servings"}</span>
        <Stepper value={amount} step={byGrams ? 10 : 0.5} min={byGrams ? 5 : 0.5} onChange={setAmount} />
      </div>
      <p className="mt-2 text-xs text-white/50">{Math.round(entry.kcal * k)} kcal · {r1(entry.protein * k)} g protein</p>
      <p className="mt-4 text-sm">Meal</p>
      <div className="mt-2 flex flex-wrap gap-2">{MEALS.map((m) => <Chip key={m} label={m} on={meal === m} onClick={() => setMeal(m)} />)}</div>
      <div className="mt-5 flex gap-2">
        <Btn onClick={save}>Save</Btn>
        <Btn kind="danger" onClick={del}>Delete</Btn>
      </div>
    </Sheet>
  );
}

function Diary() {
  const { profile, data, nav } = useApp();
  const [edit, setEdit] = useState<FoodEntry | null>(null);
  const today = dateKey();
  const date = nav.screen.q || today;
  const entries = foodOn(data, date);
  const tot = totalsOf(entries);
  const t = nutritionTargets(profile, data);
  const meals = [...MEALS, ...new Set(entries.map((e) => e.meal).filter((m) => !MEALS.includes(m)))];
  const go = (n: number) => nav.replace({ name: "diary", q: addDays(date, n) });
  return (
    <>
      <Header title="Food diary" sub={date === today ? "Today" : `${weekdayOf(date)}, ${prettyDate(date)}`}
        right={
          <div className="flex gap-1 pr-1">
            <IconBtn icon="back" label="Previous day" onClick={() => go(-1)} />
            <IconBtn icon="chevron" label="Next day" disabled={date >= today} onClick={() => go(1)} />
          </div>
        } />
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Stat label="Calories" value={`${Math.round(tot.kcal)} kcal`} />
        <Stat label="Protein" value={`${Math.round(tot.protein)} g`} />
        <Stat label="Carbs" value={`${Math.round(tot.carbs)} g`} />
        <Stat label="Fat" value={`${Math.round(tot.fat)} g`} />
      </div>
      {profile.foodTracking !== "Keep it simple" && (
        <Bar label="Calories vs target" value={tot.kcal} max={t.kcal} right={`${Math.round(tot.kcal)} / ${t.kcal} kcal`} />
      )}
      {!entries.length && <Note>Nothing logged {date === today ? "yet today" : "on this day"}.</Note>}
      {meals.map((m) => {
        const list = entries.filter((e) => e.meal === m);
        if (!list.length) return null;
        const mt = totalsOf(list);
        return (
          <div key={m}>
            <SectionTitle>{m} · {Math.round(mt.kcal)} kcal · {Math.round(mt.protein)} g protein</SectionTitle>
            <div className="mt-2 space-y-2">{list.map((e) => <EntryRow key={e.id} e={e} onClick={() => setEdit(e)} />)}</div>
          </div>
        );
      })}
      {date === today && <div className="mt-5"><Btn onClick={() => nav.push({ name: "logFood" })}>+ Log food</Btn></div>}
      <p className="mt-3 text-xs text-white/40">Tap a food to change the amount or meal, or to delete it.</p>
      {edit && <EditEntry entry={edit} onClose={() => setEdit(null)} />}
    </>
  );
}

/* ---------- Suggested foods ---------- */
function Suggested() {
  const { profile, data, nav } = useApp();
  const { all, error } = useFoods();
  const [where, setWhere] = useState<"all" | "india" | "world">("all");
  const picks = useMemo(() => {
    if (!all) return [];
    const pool = where === "india" ? all.filter((f) => f.src === "ONE") : where === "world" ? all.filter((f) => f.zn === "World") : all;
    return proteinPicks(pool, profile, preferredZones(profile), 25);
  }, [all, where, profile]);
  const t = nutritionTargets(profile, data);
  const eaten = totalsOf(foodOn(data, dateKey()));
  const left = Math.max(0, Math.round(t.protein - eaten.protein));
  return (
    <>
      <Header title="Suggested foods" sub="High-protein foods that fit you" />
      <Card>
        <p className="text-2xl font-bold text-neon">{left} g</p>
        <p className="text-xs text-white/50">protein left for today (target {t.protein} g)</p>
      </Card>
      <Note>
        These foods are rich in protein for their calories and match your diet{profile.diet ? ` (${profile.diet.toLowerCase()})` : ""} and allergies.
        Low-protein dishes are left out.
      </Note>
      <div className="mt-3 flex gap-2">
        <Chip label="All" on={where === "all"} onClick={() => setWhere("all")} />
        <Chip label="Indian" on={where === "india"} onClick={() => setWhere("india")} />
        <Chip label="World" on={where === "world"} onClick={() => setWhere("world")} />
      </div>
      {!all ? (
        <Loading error={error} />
      ) : (
        <div className="mt-3 space-y-2">
          {picks.map((pk) => (
            <FoodRow key={pk.food.id} f={pk.food} sub={`${pk.label}: ${pk.protein} g protein · ${pk.kcal} kcal`}
              onClick={() => nav.push({ name: "foodItem", id: pk.food.id })} />
          ))}
          {!picks.length && <Note>No suggestions found here for your diet.</Note>}
        </div>
      )}
    </>
  );
}

/* ---------- Browse ---------- */
function Browse() {
  const { data, nav } = useApp();
  const { all, error } = useFoods();
  return (
    <>
      <Header title="Browse foods" />
      {!all ? (
        <Loading error={error} />
      ) : (
        <div className="mt-3 space-y-2">
          <Row icon="food" title="Indian foods" sub={`${all.filter((f) => f.src === "ONE").length} dishes, by region and state`} onClick={() => nav.push({ name: "browseIndia" })} />
          <Row icon="book" title="World foods" sub={`${all.filter((f) => f.zn === "World").length} foods, by category`} onClick={() => nav.push({ name: "browseWorld" })} />
          <Row icon="bookmark" title="My foods & recipes" sub={`${data.myFoods.length} saved`} onClick={() => nav.push({ name: "myFoods" })} />
        </div>
      )}
    </>
  );
}

function BrowseIndia() {
  const { nav } = useApp();
  const { all, error } = useFoods();
  if (!all) return (<><Header title="Indian foods" /><Loading error={error} /></>);
  const indian = all.filter((f) => f.src === "ONE");
  const zones = [...new Set(indian.map((f) => f.zn ?? "All-India"))].sort((a, b) => zoneRank(a) - zoneRank(b));
  return (
    <>
      <Header title="Indian foods" sub="Pick a region" />
      <div className="mt-3 space-y-2">
        {zones.map((z) => (
          <Row key={z} icon="food" title={z === "All-India" ? "All-India (common everywhere)" : zoneName(z)}
            sub={`${indian.filter((f) => (f.zn ?? "All-India") === z).length} dishes`} onClick={() => nav.push({ name: "browseZone", q: z })} />
        ))}
      </div>
    </>
  );
}

function BrowseZone() {
  const { nav } = useApp();
  const { all, error } = useFoods();
  const zone = nav.screen.q ?? "All-India";
  if (!all) return (<><Header title={zoneName(zone)} /><Loading error={error} /></>);
  const foods = all.filter((f) => f.src === "ONE" && (f.zn ?? "All-India") === zone);
  const states = [...new Set(foods.map((f) => f.st ?? "").filter(Boolean))].sort();
  return (
    <>
      <Header title={zoneName(zone)} sub="Pick a state" />
      <div className="mt-3 space-y-2">
        <Row icon="list" title="All dishes from this region" sub={`${foods.length} dishes`} onClick={() => nav.push({ name: "browseList", q: zone, id: "" })} />
        {states.map((s) => (
          <Row key={s} icon="food" title={s} sub={`${foods.filter((f) => f.st === s).length} dishes`} onClick={() => nav.push({ name: "browseList", q: zone, id: s })} />
        ))}
      </div>
    </>
  );
}

function BrowseWorld() {
  const { nav } = useApp();
  const { all, error } = useFoods();
  if (!all) return (<><Header title="World foods" /><Loading error={error} /></>);
  const world = all.filter((f) => f.zn === "World");
  const cats = [...new Set(world.map((f) => f.g || "Other"))].sort();
  return (
    <>
      <Header title="World foods" sub="Pick a category" />
      <div className="mt-3 space-y-2">
        {cats.map((c) => (
          <Row key={c} icon="food" title={c} sub={`${world.filter((f) => (f.g || "Other") === c).length} foods`} onClick={() => nav.push({ name: "browseList", q: "World", id: c })} />
        ))}
      </div>
    </>
  );
}

function BrowseList() {
  const { profile, nav } = useApp();
  const { all, error } = useFoods();
  const [q, setQ] = useState("");
  const [mine, setMine] = useState(true);
  const zone = nav.screen.q ?? "";
  const key = nav.screen.id ?? "";
  const title = key || (zone === "World" ? "World foods" : zoneName(zone));
  if (!all) return (<><Header title={title} /><Loading error={error} /></>);
  const base = zone === "World"
    ? all.filter((f) => f.zn === "World" && (!key || (f.g || "Other") === key))
    : all.filter((f) => f.src === "ONE" && (f.zn ?? "All-India") === zone && (!key || f.st === key));
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const list = base
    .filter((f) => (!mine || fitsProfile(f, profile)) && words.every((w) => f.n.toLowerCase().includes(w) || f.al.some((a) => a.toLowerCase().includes(w))))
    .sort((a, b) => a.n.localeCompare(b.n));
  return (
    <>
      <Header title={title} sub={`${list.length} foods`} />
      <SearchBox value={q} onChange={setQ} placeholder="Search in this list" />
      <Card><Toggle label="Only foods that fit my diet and allergies" on={mine} onChange={setMine} /></Card>
      <div className="mt-3 space-y-2">
        {list.slice(0, 150).map((f) => <FoodRow key={f.id} f={f} onClick={() => nav.push({ name: "foodItem", id: f.id })} />)}
        {!list.length && <Note>No foods here{mine ? " that fit your diet. Turn off the switch to see all." : "."}</Note>}
        {list.length > 150 && <p className="text-center text-xs text-white/40">Showing 150 of {list.length}. Search to narrow the list.</p>}
      </div>
    </>
  );
}

/* ---------- Packaged foods (online) ---------- */
function Packaged() {
  const { profile, nav } = useApp();
  const [q, setQ] = useState(memo.off);
  const [list, setList] = useState<FoodItem[]>(memo.offList);
  const [status, setStatus] = useState<"" | "loading" | "error" | "empty">("");
  const run = async () => {
    const query = q.trim();
    if (!query) return;
    setStatus("loading");
    try {
      const found = await searchOnline(query);
      found.forEach((f) => online.set(f.id, f));
      memo.off = query;
      memo.offList = found;
      setList(found);
      setStatus(found.length ? "" : "empty");
    } catch {
      setStatus("error");
    }
  };
  return (
    <>
      <Header title="Packaged foods" sub="Search by product or brand" />
      <form onSubmit={(e) => { e.preventDefault(); void run(); }}>
        <SearchBox value={q} onChange={setQ} placeholder="For example: Amul protein lassi" />
        <div className="mt-3"><Btn disabled={!q.trim() || status === "loading"} onClick={() => void run()}>Search</Btn></div>
      </form>
      <Note>Needs internet. Data from Open Food Facts (ODbL), a free database built by volunteers, so always check the packet.</Note>
      {status === "loading" && <p className="mt-6 text-center text-sm text-white/50">Searching…</p>}
      {status === "error" && <Note tone="warn">Couldn't search right now. Check your internet and try again.</Note>}
      {status === "empty" && <Note>No products found. Try the brand name, or add it yourself in My foods.</Note>}
      <div className="mt-3 space-y-2">
        {list.map((f) => (
          <FoodRow key={f.id} f={f} onClick={() => nav.push({ name: "foodItem", id: f.id })}
            sub={`${Math.round(f.k)} kcal · ${r1(f.p)} g protein per 100 g${fitsProfile(f, profile) ? "" : " · not for your diet"}`} />
        ))}
      </div>
    </>
  );
}

/* ---------- My foods and recipes ---------- */
function MyFoods() {
  const { data, nav } = useApp();
  return (
    <>
      <Header title="My foods & recipes" />
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Tile icon="plus" title="New food" sub="From a packet label" onClick={() => nav.push({ name: "myFoodForm" })} />
        <Tile icon="list" title="New recipe" sub="Mix ingredients" onClick={() => nav.push({ name: "recipeForm" })} />
      </div>
      {!data.myFoods.length && <Note>Nothing saved yet.</Note>}
      <div className="mt-3 space-y-2">
        {data.myFoods.map((f) => <FoodRow key={f.id} f={f} onClick={() => nav.push({ name: "foodItem", id: f.id })} />)}
      </div>
    </>
  );
}

type FoodForm = { name: string; k: string; p: string; c: string; f: string; fb: string; serving: string; grams: string; d: FoodItem["d"] };
const NUM_FIELDS: [keyof FoodForm, string][] = [["k", "Calories (kcal)"], ["p", "Protein (g)"], ["c", "Carbs (g)"], ["f", "Fat (g)"], ["fb", "Fibre (g)"]];

function MyFoodForm() {
  const { data, setData, nav } = useApp();
  const existing = data.myFoods.find((x) => x.id === nav.screen.id && x.src === "Mine");
  const str = (n?: number) => (n !== undefined && n > 0 ? String(n) : "");
  const [v, setV] = useState<FoodForm>(() => ({
    name: existing?.n ?? "", k: str(existing?.k), p: str(existing?.p), c: str(existing?.c), f: str(existing?.f), fb: str(existing?.fb),
    serving: existing?.pt[0]?.[0] ?? "", grams: str(existing?.pt[0]?.[1]), d: existing?.d ?? "veg",
  }));
  const [err, setErr] = useState("");
  const set = (k: keyof FoodForm, val: string) => setV((x) => ({ ...x, [k]: val }));
  const num = (s: string) => Math.max(0, Number(s) || 0);
  const save = () => {
    if (!v.name.trim() || num(v.k) <= 0) {
      setErr("Add a name and the calories per 100 g.");
      return;
    }
    const item: FoodItem = {
      id: existing?.id ?? `mine-${uid()}`, n: v.name.trim(), g: "My foods", rg: "",
      k: num(v.k), p: num(v.p), c: num(v.c), f: num(v.f), fb: num(v.fb), s: 0, na: 0,
      pt: num(v.grams) > 0 ? [[v.serving.trim() || "1 serving", num(v.grams)]] : [],
      al: [], d: v.d, j: false, a: [], src: "Mine",
    };
    setData((d) => ({ ...d, myFoods: existing ? d.myFoods.map((x) => (x.id === item.id ? item : x)) : [...d.myFoods, item] }));
    nav.back();
  };
  return (
    <>
      <Header title={existing ? "Edit food" : "New food"} sub="Copy the values from the packet label" />
      <div className="mt-4 space-y-4">
        <label className="block text-sm">
          <span className="mb-1.5 block text-white/70">Name</span>
          <input className={inputClass} value={v.name} onChange={(e) => set("name", e.target.value)} />
        </label>
        <p className="text-sm font-semibold">Per 100 g</p>
        <div className="grid grid-cols-2 gap-3">
          {NUM_FIELDS.map(([k, label]) => (
            <label key={k} className="block text-sm">
              <span className="mb-1.5 block text-white/70">{label}</span>
              <input className={inputClass} inputMode="decimal" value={v[k]} onChange={(e) => set(k, e.target.value.replace(/[^\d.]/g, ""))} />
            </label>
          ))}
        </div>
        <p className="text-sm font-semibold">Serving size (optional)</p>
        <div className="grid grid-cols-2 gap-3">
          <input className={inputClass} placeholder="For example: 1 bar" value={v.serving} onChange={(e) => set("serving", e.target.value)} />
          <input className={inputClass} placeholder="Grams" inputMode="decimal" value={v.grams} onChange={(e) => set("grams", e.target.value.replace(/[^\d.]/g, ""))} />
        </div>
        <p className="text-sm font-semibold">Diet</p>
        <div className="flex flex-wrap gap-2">
          {DIET_RANK.map((d) => <Chip key={d} label={DIET_NAME[d]} on={v.d === d} onClick={() => setV((x) => ({ ...x, d }))} />)}
        </div>
        {err && <Note tone="warn">{err}</Note>}
        <Btn onClick={save}>Save food</Btn>
      </div>
    </>
  );
}

type Ing = { id: string; n: string; grams: number };

function RecipeForm() {
  const { data, setData, nav } = useApp();
  const { all, error } = useFoods();
  const existing = data.myFoods.find((x) => x.id === nav.screen.id && x.src === "Recipe");
  const [name, setName] = useState(existing?.n ?? "");
  const [ings, setIngs] = useState<Ing[]>(existing?.ing ?? []);
  const [servings, setServings] = useState(() => {
    const m = existing?.pt[0]?.[0].match(/of (\d+)/);
    return m ? Number(m[1]) : 2;
  });
  const [cooked, setCooked] = useState("");
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");
  const byId = useMemo(() => new Map((all ?? []).map((f) => [f.id, f] as const)), [all]);
  if (!all) return (<><Header title="Recipe" /><Loading error={error} /></>);

  const results = q.trim() ? searchFoods(all.filter((f) => f.src !== "Recipe"), q, { limit: 8 }) : [];
  const foods = ings.flatMap((x) => {
    const food = byId.get(x.id);
    return food ? [{ food, grams: x.grams }] : [];
  });
  const raw = ings.reduce((a, x) => a + x.grams, 0);
  const weight = Number(cooked) > 0 ? Number(cooked) : raw;
  const sum = foods.reduce(
    (a, x) => {
      const n = nutrientsFor(x.food, x.grams);
      return {
        kcal: a.kcal + n.kcal, protein: a.protein + n.protein, carbs: a.carbs + n.carbs, fat: a.fat + n.fat, fibre: a.fibre + n.fibre,
        sugar: a.sugar + (x.food.s * x.grams) / 100, sodium: a.sodium + (x.food.na * x.grams) / 100,
      };
    },
    { kcal: 0, protein: 0, carbs: 0, fat: 0, fibre: 0, sugar: 0, sodium: 0 },
  );
  const per = (val: number) => (weight > 0 ? r1((val / weight) * 100) : 0);
  const serving = weight / Math.max(1, servings);
  const addIng = (f: FoodItem) => {
    setIngs((list) => [...list, { id: f.id, n: f.n, grams: f.pt[0] ? Math.round(f.pt[0][1]) : 100 }]);
    setQ("");
  };
  const save = () => {
    if (!name.trim() || !foods.length) {
      setErr("Add a name and at least one ingredient.");
      return;
    }
    const d = foods.reduce<FoodItem["d"]>((acc, x) => (DIET_RANK.indexOf(x.food.d) > DIET_RANK.indexOf(acc) ? x.food.d : acc), "vegan");
    const item: FoodItem = {
      id: existing?.id ?? `recipe-${uid()}`, n: name.trim(), g: "My recipes", rg: "",
      k: per(sum.kcal), p: per(sum.protein), c: per(sum.carbs), f: per(sum.fat), fb: per(sum.fibre), s: per(sum.sugar), na: per(sum.sodium),
      pt: [[`1 serving (of ${servings})`, r1(serving)]], al: [], d, j: foods.every((x) => x.food.j),
      a: [...new Set(foods.flatMap((x) => x.food.a))], src: "Recipe", ing: ings,
    };
    setData((dd) => ({ ...dd, myFoods: existing ? dd.myFoods.map((x) => (x.id === item.id ? item : x)) : [...dd.myFoods, item] }));
    nav.back();
  };

  return (
    <>
      <Header title={existing ? "Edit recipe" : "New recipe"} />
      <label className="mt-4 block text-sm">
        <span className="mb-1.5 block text-white/70">Recipe name</span>
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="For example: Mum's chicken curry" />
      </label>
      <SectionTitle>Ingredients (raw weight)</SectionTitle>
      <div className="mt-2 space-y-2">
        {ings.map((x, i) => (
          <div key={`${x.id}-${i}`} className="flex items-center gap-2 rounded-xl bg-white/5 p-2.5">
            <span className="min-w-0 flex-1 truncate text-sm">{x.n}</span>
            <input type="number" inputMode="decimal" min={0} aria-label={`${x.n} grams`} className={`${inputBase} w-20`} value={x.grams}
              onChange={(e) => setIngs((list) => list.map((y, j) => (j === i ? { ...y, grams: Math.max(0, Number(e.target.value) || 0) } : y)))} />
            <span className="text-xs text-white/50">g</span>
            <IconBtn icon="trash" label="Remove" onClick={() => setIngs((list) => list.filter((_, j) => j !== i))} />
          </div>
        ))}
      </div>
      <SearchBox value={q} onChange={setQ} placeholder="Add an ingredient" />
      {results.length > 0 && (
        <div className="mt-2 space-y-2">
          {results.map((f) => <FoodRow key={f.id} f={f} onClick={() => addIng(f)} />)}
        </div>
      )}
      <SectionTitle>Servings</SectionTitle>
      <div className="mt-2 flex items-center justify-between text-sm">
        <span>The recipe makes</span>
        <Stepper value={servings} min={1} suffix=" servings" onChange={(val) => setServings(Math.max(1, Math.round(val)))} />
      </div>
      <label className="mt-3 block text-sm">
        <span className="mb-1.5 block text-white/70">Cooked weight in grams (optional, makes it more accurate)</span>
        <input className={inputClass} inputMode="decimal" value={cooked} placeholder={raw ? `Raw total is ${Math.round(raw)} g` : ""}
          onChange={(e) => setCooked(e.target.value.replace(/[^\d.]/g, ""))} />
      </label>
      {foods.length > 0 && (
        <Card title="Per serving">
          <p className="text-sm">
            About {Math.round(serving)} g · <b>{Math.round(sum.kcal / Math.max(1, servings))} kcal</b> · <b>{r1(sum.protein / Math.max(1, servings))} g protein</b>
          </p>
        </Card>
      )}
      {err && <Note tone="warn">{err}</Note>}
      <div className="mt-4"><Btn onClick={save}>Save recipe</Btn></div>
    </>
  );
}

/* ---------- Every food screen, by name ---------- */
export const FOOD_SCREENS: Record<string, ComponentType> = {
  food: FoodHome, logFood: LogFood, quickAdd: QuickAdd, foodItem: FoodItemScreen, diary: Diary, suggested: Suggested,
  browse: Browse, browseIndia: BrowseIndia, browseZone: BrowseZone, browseWorld: BrowseWorld, browseList: BrowseList,
  packaged: Packaged, myFoods: MyFoods, myFoodForm: MyFoodForm, recipeForm: RecipeForm,
};