import { useMemo, useState } from "react";
import type { AppData, FoodEntry, FoodItem, PageProps, Profile, SetData } from "./store";
import { addDays, dateKey, dayLog, prettyDate, uid } from "./store";
import { MEALS, foodOn, nutritionTargets, totalsOf, updateDay } from "./stats";
import { ZONES, statesIn } from "./indianStates";
import {
  amountFor, entryFrom, fitsProfile, mealForNow, nutrientsFor, parseMeal, preferredZones, proteinPicks, r1,
  recentFoods, searchFoods, searchOnline, sourceLabel, useFoodDb, type Nutrients, type ParsedItem,
} from "./fooddb";
import { Bar, Btn, Card, Chip, Modal, Note, PageTitle, Stepper, inputBase, inputClass } from "./ui";

/* ==========================================================
   Food page: targets, water, type-what-you-ate, meal log,
   food finder (Region → State → Dish), my foods and recipes,
   and protein suggestions. Values are estimates.
   ========================================================== */

const DIETS: [FoodItem["d"], string][] = [
  ["vegan", "Vegan"],
  ["veg", "Vegetarian"],
  ["egg", "Contains egg"],
  ["nonveg", "Non-vegetarian"],
];

function MacroGrid({ n }: { n: Nutrients }) {
  const items: [string, string][] = [
    ["Calories", `${Math.round(n.kcal)}`],
    ["Protein", `${n.protein} g`],
    ["Carbs", `${n.carbs} g`],
    ["Fat", `${n.fat} g`],
    ["Fibre", n.fibre > 0 ? `${n.fibre} g` : "—"],
  ];
  return (
    <div className="mt-3 grid grid-cols-5 gap-1 text-center">
      {items.map(([k, v]) => (
        <div key={k} className="rounded-lg bg-white/5 px-1 py-2">
          <p className="text-[10px] text-white/45">{k}</p>
          <p className="text-xs font-semibold">{v}</p>
        </div>
      ))}
    </div>
  );
}

export default function FoodPage({ profile, data, setData }: PageProps) {
  const today = dateKey();
  const [date, setDate] = useState(today);
  const [finder, setFinder] = useState<{ meal: string; food?: FoodItem } | null>(null);
  const [editor, setEditor] = useState<"food" | "recipe" | null>(null);
  const db = useFoodDb();
  const all = useMemo(() => [...data.myFoods, ...(db.foods ?? [])], [db.foods, data.myFoods]);
  const recent = useMemo(() => recentFoods(data.food, all), [data.food, all]);

  const t = nutritionTargets(profile, data);
  const entries = foodOn(data, date);
  const totals = totalsOf(entries);
  const log = dayLog(data, date);
  const showNumbers = profile.foodTracking !== "Keep it simple";

  const addEntries = (list: FoodEntry[]) => setData((d) => ({ ...d, food: [...d.food, ...list] }));
  const removeEntry = (id: string) => setData((d) => ({ ...d, food: d.food.filter((f) => f.id !== id) }));
  const setWater = (fn: (n: number) => number) => setData((d) => updateDay(d, date, { water: Math.max(0, fn(dayLog(d, date).water)) }));
  const saveMyFood = (f: FoodItem) => setData((d) => ({ ...d, myFoods: [f, ...d.myFoods] }));

  return (
    <div className="pb-6">
      <PageTitle title="Food" sub="Log what you eat. BYB works out the calories and nutrients." />

      {/* Date */}
      <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-2">
        <Btn small kind="soft" onClick={() => setDate(addDays(date, -1))}>
          ‹ Prev
        </Btn>
        <span className="text-sm font-semibold">{date === today ? "Today" : prettyDate(date)}</span>
        <Btn small kind="soft" disabled={date >= today} onClick={() => setDate(addDays(date, 1))}>
          Next ›
        </Btn>
      </div>

      {/* Targets */}
      {showNumbers ? (
        <Card title="Daily targets">
          <Bar label="Calories" value={totals.kcal} max={t.kcal} right={`${Math.round(totals.kcal)} / ${t.kcal} kcal`} />
          <Bar label="Protein" value={totals.protein} max={t.protein} right={`${Math.round(totals.protein)} / ${t.protein} g`} />
          <Bar label="Carbs" value={totals.carbs} max={t.carbs} right={`${Math.round(totals.carbs)} / ${t.carbs} g`} />
          <Bar label="Fat" value={totals.fat} max={t.fat} right={`${Math.round(totals.fat)} / ${t.fat} g`} />
          <Bar label="Fibre" value={totals.fibre} max={t.fibre} right={`${Math.round(totals.fibre)} / ${t.fibre} g`} />
          <p className="mt-2 text-[11px] text-white/40">Many Indian dishes in the database have no fibre value yet, so fibre may read low.</p>
          <details className="mt-2 text-xs text-white/55">
            <summary className="cursor-pointer">How these targets are worked out</summary>
            <p className="mt-2">
              Estimated maintenance: about {t.maintenance} kcal a day, from your age, height, weight, sex, daily activity and training days.
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {t.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </details>
        </Card>
      ) : (
        <Card title="Simple eating guide">
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-white/75">
            <li>Fill half your plate with vegetables or salad.</li>
            <li>Add a palm-sized protein: dal, paneer, tofu, eggs, fish or chicken (whatever fits your diet).</li>
            <li>Add a fist-sized portion of rice, roti or millets.</li>
            <li>Eat slowly and stop when you feel comfortably full.</li>
          </ul>
        </Card>
      )}

      {/* Water */}
      <Card title="Water">
        <Bar label="Glasses (250 ml)" value={log.water} max={t.water} right={`${log.water} / ${t.water}`} />
        <div className="mt-2 flex gap-2">
          <Btn small kind="soft" onClick={() => setWater((n) => n - 1)}>
            − Glass
          </Btn>
          <Btn small onClick={() => setWater((n) => n + 1)}>
            + Glass
          </Btn>
        </div>
      </Card>

      {db.error && <Note tone="warn">{db.error}</Note>}
      {!db.foods && !db.error && <Note>Loading the food database…</Note>}

      {/* Type what you ate */}
      {db.foods && <QuickAdd foods={all} profile={profile} date={date} showNumbers={showNumbers} onAdd={addEntries} />}

      {/* Recent */}
      {recent.length > 0 && (
        <Card title="Recent: tap to add again">
          <div className="flex flex-wrap gap-2">
            {recent.map(({ food, grams }) => (
              <Chip
                key={food.id}
                label={`${food.n.length > 28 ? `${food.n.slice(0, 26)}…` : food.n} · ${grams} g`}
                on={false}
                onClick={() => addEntries([entryFrom(food, grams, mealForNow(), date)])}
              />
            ))}
          </div>
          <p className="mt-2 text-[11px] text-white/40">Adds to {mealForNow().toLowerCase()}. Long-press isn't needed; delete from the meal below if wrong.</p>
        </Card>
      )}

      {/* Meals */}
      {MEALS.map((meal) => {
        const list = entries.filter((e) => e.meal === meal);
        const sub = totalsOf(list);
        return (
          <Card key={meal} title={meal} right={<Btn small onClick={() => setFinder({ meal })}>+ Add</Btn>}>
            {list.length === 0 ? (
              <p className="text-sm text-white/40">Nothing logged yet.</p>
            ) : (
              <ul className="divide-y divide-white/10">
                {list.map((e) => (
                  <li key={e.id} className="flex items-center gap-3 py-2 text-sm">
                    <div className="flex-1">
                      <p>{e.name}</p>
                      <p className="text-xs text-white/45">
                        {e.grams !== undefined ? `${e.grams} g` : `× ${e.qty}`}
                        {showNumbers ? ` · ${Math.round(e.kcal)} kcal · ${r1(e.protein)} g protein` : ""}
                      </p>
                    </div>
                    <button type="button" aria-label={`Remove ${e.name}`} className="px-2 text-white/40 hover:text-red-300" onClick={() => removeEntry(e.id)}>
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {showNumbers && list.length > 0 && (
              <p className="mt-2 text-xs text-white/50">
                {Math.round(sub.kcal)} kcal · {Math.round(sub.protein)} g protein · {Math.round(sub.carbs)} g carbs · {Math.round(sub.fat)} g fat
              </p>
            )}
          </Card>
        );
      })}

      {/* Suggestions */}
      {db.foods && (
        <Suggestions
          foods={db.foods}
          profile={profile}
          remaining={t.protein - totals.protein}
          showNumbers={showNumbers}
          onPick={(food) => setFinder({ meal: mealForNow(), food })}
        />
      )}

      {/* My foods and recipes */}
      <Card title="My foods and recipes">
        {data.myFoods.length === 0 ? (
          <p className="text-sm text-white/45">Add foods that aren't in the database, or build a recipe from its ingredients.</p>
        ) : (
          <ul className="divide-y divide-white/10">
            {data.myFoods.map((f) => (
              <li key={f.id} className="flex items-center gap-3 py-2 text-sm">
                <button type="button" className="flex-1 text-left" onClick={() => setFinder({ meal: mealForNow(), food: f })}>
                  <p>{f.n}</p>
                  <p className="text-xs text-white/45">
                    {sourceLabel(f.src)}
                    {showNumbers ? ` · ${f.k} kcal, ${f.p} g protein per 100 g` : ""}
                    {f.pt[0] ? ` · ${f.pt[0][0]}` : ""}
                  </p>
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${f.n}`}
                  className="px-2 text-white/40 hover:text-red-300"
                  onClick={() => setData((d) => ({ ...d, myFoods: d.myFoods.filter((x) => x.id !== f.id) }))}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <Btn small onClick={() => setEditor("food")}>+ New food</Btn>
          <Btn small kind="soft" disabled={!db.foods} onClick={() => setEditor("recipe")}>
            + New recipe
          </Btn>
        </div>
      </Card>

      <Note>
        Food data: open-nutrition-engine by TheBarbellCrew (MIT licence), USDA FoodData Central (public domain) and Open Food Facts
        (Open Database Licence) for packaged foods. Values are estimates; recipes, oil and portion sizes vary. Weighing food gives the
        most accurate numbers. BYB does not replace a registered dietitian or doctor.
      </Note>

      {finder && db.foods && (
        <Finder
          meal={finder.meal}
          date={date}
          initialFood={finder.food}
          foods={db.foods}
          profile={profile}
          data={data}
          setData={setData}
          showNumbers={showNumbers}
          onClose={() => setFinder(null)}
        />
      )}
      {editor === "food" && (
        <MyFoodForm
          onClose={() => setEditor(null)}
          onSave={(f) => {
            saveMyFood(f);
            setEditor(null);
          }}
        />
      )}
      {editor === "recipe" && db.foods && (
        <RecipeForm
          foods={all}
          onClose={() => setEditor(null)}
          onSave={(f) => {
            saveMyFood(f);
            setEditor(null);
          }}
        />
      )}
    </div>
  );
}

/* ---------- Type what you ate ---------- */
function QuickAdd({
  foods,
  profile,
  date,
  showNumbers,
  onAdd,
}: {
  foods: FoodItem[];
  profile: Profile;
  date: string;
  showNumbers: boolean;
  onAdd: (list: FoodEntry[]) => void;
}) {
  const [text, setText] = useState("");
  const [items, setItems] = useState<ParsedItem[] | null>(null);
  const [meal, setMeal] = useState(mealForNow());
  const [done, setDone] = useState("");
  const zones = preferredZones(profile);

  const update = (i: number, patch: Partial<ParsedItem>) =>
    setItems((list) => (list ? list.map((it, j) => (j === i ? { ...it, ...patch } : it)) : list));
  const ready = (items ?? []).flatMap((it) => (it.food && it.grams > 0 ? [{ food: it.food, grams: it.grams }] : []));
  const sum = ready.reduce(
    (acc, { food, grams }) => {
      const n = nutrientsFor(food, grams);
      return { kcal: acc.kcal + n.kcal, protein: acc.protein + n.protein, carbs: acc.carbs + n.carbs, fat: acc.fat + n.fat, fibre: acc.fibre + n.fibre };
    },
    { kcal: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 },
  );

  return (
    <Card title="Type what you ate">
      <textarea
        className={`${inputClass} min-h-20`}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setDone("");
        }}
        placeholder="e.g. 3 idli, 1 katori sambar, 150 g chicken curry"
        maxLength={400}
      />
      <div className="mt-2 flex gap-2">
        <Btn disabled={!text.trim()} onClick={() => setItems(parseMeal(text, foods, zones))}>
          Calculate
        </Btn>
        {items && (
          <Btn kind="soft" onClick={() => setItems(null)}>
            Clear
          </Btn>
        )}
      </div>
      {done && <p className="mt-3 rounded-lg bg-neon/15 px-3 py-2 text-xs text-neon">✓ {done}</p>}

      {items && (
        <div className="mt-3">
          {items.map((it, i) => (
            <div key={`${it.text}-${i}`} className="mt-2 rounded-xl border border-white/10 p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs text-white/45">“{it.text}”</p>
                <button type="button" className="text-xs text-white/40 hover:text-red-300" onClick={() => setItems((l) => (l ? l.filter((_, j) => j !== i) : l))}>
                  Remove
                </button>
              </div>
              {it.food ? (
                <>
                  <select
                    className={`${inputBase} mt-1 w-full py-2 text-sm`}
                    value={it.food.id}
                    aria-label="Matched food"
                    onChange={(e) => {
                      const food = it.options.find((o) => o.id === e.target.value);
                      if (food) {
                        const amount = amountFor(food, it.count, it.unit);
                        update(i, { food, grams: amount.grams, how: amount.how });
                      }
                    }}
                  >
                    {it.options.map((o) => (
                      <option key={o.id} value={o.id} className="bg-neutral-900">
                        {o.n}
                      </option>
                    ))}
                  </select>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                    <input
                      type="number"
                      inputMode="decimal"
                      aria-label="Grams"
                      className={`${inputBase} w-24 py-1.5`}
                      value={it.grams}
                      onChange={(e) => update(i, { grams: Math.max(0, Number(e.target.value) || 0) })}
                    />
                    <span>g</span>
                    {showNumbers && (
                      <span className="text-white/60">
                        = {Math.round(nutrientsFor(it.food, it.grams).kcal)} kcal · {nutrientsFor(it.food, it.grams).protein} g protein
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[11px] text-white/40">{it.how}</p>
                </>
              ) : (
                <p className="mt-1 text-sm text-yellow-200">No match found. Try another name, or use + Add in a meal below.</p>
              )}
            </div>
          ))}

          {ready.length > 0 && (
            <>
              {showNumbers && <MacroGrid n={{ kcal: sum.kcal, protein: r1(sum.protein), carbs: r1(sum.carbs), fat: r1(sum.fat), fibre: r1(sum.fibre) }} />}
              <p className="mt-3 text-xs text-white/50">Add to</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {MEALS.map((m) => (
                  <Chip key={m} label={m} on={meal === m} onClick={() => setMeal(m)} />
                ))}
              </div>
              <div className="mt-3">
                <Btn
                  onClick={() => {
                    onAdd(ready.map(({ food, grams }) => entryFrom(food, grams, meal, date)));
                    setDone(`Added ${ready.length} item${ready.length === 1 ? "" : "s"} to ${meal.toLowerCase()}.`);
                    setItems(null);
                    setText("");
                  }}
                >
                  Add all to {meal.toLowerCase()}
                </Btn>
              </div>
            </>
          )}
        </div>
      )}
    </Card>
  );
}

/* ---------- Food finder ---------- */
type Scope = "Indian" | "World" | "Mine" | "Online";

function Finder({
  meal,
  date,
  initialFood,
  foods,
  profile,
  data,
  setData,
  showNumbers,
  onClose,
}: {
  meal: string;
  date: string;
  initialFood?: FoodItem;
  foods: FoodItem[];
  profile: Profile;
  data: AppData;
  setData: SetData;
  showNumbers: boolean;
  onClose: () => void;
}) {
  const zones = preferredZones(profile);
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<Scope>(profile.country === "India" || zones.length ? "Indian" : "World");
  const [zone, setZone] = useState(zones[0] ?? "All-India");
  const [stateName, setStateName] = useState("All");
  const [category, setCategory] = useState("All");
  const [onlyFits, setOnlyFits] = useState(true);
  const [picked, setPicked] = useState<FoodItem | null>(initialFood ?? null);
  const [online, setOnline] = useState<FoodItem[]>([]);
  const [status, setStatus] = useState("");
  const [added, setAdded] = useState("");

  const indian = useMemo(() => foods.filter((f) => f.src === "ONE"), [foods]);
  const world = useMemo(() => foods.filter((f) => f.src === "USDA"), [foods]);
  const worldCats = useMemo(() => [...new Set(world.map((f) => f.g))].sort(), [world]);
  const fits = (f: FoodItem) => !onlyFits || fitsProfile(f, profile);
  const byName = (a: FoodItem, b: FoodItem) => a.n.localeCompare(b.n);

  let list: FoodItem[];
  if (scope === "Online") list = online;
  else if (scope === "Mine") list = query.trim() ? searchFoods(data.myFoods, query, { limit: 60 }) : data.myFoods;
  else if (query.trim()) list = searchFoods(scope === "Indian" ? indian : world, query, { limit: 60, zones }).filter(fits);
  else if (scope === "Indian")
    list = indian
      .filter((f) => f.zn === zone && (stateName === "All" || f.st === stateName))
      .filter(fits)
      .sort(byName)
      .slice(0, 300);
  else list = world.filter((f) => category === "All" || f.g === category).filter(fits).sort(byName).slice(0, 300);

  const add = (food: FoodItem, grams: number, chosenMeal: string) => {
    const entry = entryFrom(food, grams, chosenMeal, date);
    setData((d) => ({
      ...d,
      food: [...d.food, entry],
      myFoods: food.src === "OFF" && !d.myFoods.some((m) => m.id === food.id) ? [food, ...d.myFoods] : d.myFoods,
    }));
    setAdded(`Added ${grams} g ${food.n} to ${chosenMeal.toLowerCase()}.`);
    setPicked(null);
  };

  const runOnline = () => {
    const q = query.trim();
    if (!q) return;
    setStatus("Searching Open Food Facts…");
    searchOnline(q)
      .then((res) => {
        setOnline(res);
        setStatus(res.length ? "" : "No products found. Try adding the brand name.");
      })
      .catch(() => setStatus("Couldn't reach Open Food Facts. Check your internet and try again."));
  };

  return (
    <Modal title={picked ? "Add food" : `Add to ${meal}`} onClose={onClose}>
      {picked ? (
        <FoodDetail
          food={picked}
          profile={profile}
          showNumbers={showNumbers}
          initialMeal={meal}
          onAdd={(grams, m) => add(picked, grams, m)}
          onBack={() => setPicked(null)}
        />
      ) : (
        <>
          <input
            className={`${inputClass} mt-4`}
            type="search"
            placeholder={scope === "Online" ? "Packaged food or brand, e.g. Maggi, Amul" : "Search, e.g. dosa, paneer, chicken"}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && scope === "Online") runOnline();
            }}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {(["Indian", "World", "Mine", "Online"] as Scope[]).map((s) => (
              <Chip
                key={s}
                label={s === "Mine" ? "My foods" : s === "Online" ? "Packaged (online)" : `${s} foods`}
                on={scope === s}
                onClick={() => setScope(s)}
              />
            ))}
          </div>

          {scope === "Indian" && !query.trim() && (
            <>
              <p className="mt-3 text-[11px] uppercase tracking-wide text-white/45">Region</p>
              <div className="-mx-5 mt-1 flex gap-2 overflow-x-auto px-5 pb-1">
                {ZONES.map((z) => (
                  <Chip
                    key={z}
                    label={z}
                    on={zone === z}
                    onClick={() => {
                      setZone(z);
                      setStateName("All");
                    }}
                  />
                ))}
              </div>
              {zone !== "All-India" && (
                <>
                  <p className="mt-2 text-[11px] uppercase tracking-wide text-white/45">State</p>
                  <div className="-mx-5 mt-1 flex gap-2 overflow-x-auto px-5 pb-1">
                    {["All", ...statesIn(zone)].map((s) => (
                      <Chip key={s} label={s} on={stateName === s} onClick={() => setStateName(s)} />
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {scope === "World" && !query.trim() && (
            <>
              <p className="mt-3 text-[11px] uppercase tracking-wide text-white/45">Category</p>
              <div className="-mx-5 mt-1 flex gap-2 overflow-x-auto px-5 pb-1">
                {["All", ...worldCats].map((c) => (
                  <Chip key={c} label={c} on={category === c} onClick={() => setCategory(c)} />
                ))}
              </div>
            </>
          )}

          {scope === "Online" && (
            <div className="mt-3">
              <Btn small disabled={!query.trim()} onClick={runOnline}>
                Search online
              </Btn>
              <p className="mt-2 text-[11px] text-white/40">
                Results from Open Food Facts, a free community database. Check the pack label; entries can be incomplete.
              </p>
            </div>
          )}

          {(scope === "Indian" || scope === "World") && (
            <div className="mt-3">
              <Chip label="Only foods that fit my diet and allergies" on={onlyFits} onClick={() => setOnlyFits(!onlyFits)} />
            </div>
          )}

          {added && <p className="mt-3 rounded-lg bg-neon/15 px-3 py-2 text-xs text-neon">✓ {added}</p>}
          {status && <p className="mt-3 text-sm text-white/60">{status}</p>}

          <p className="mt-3 text-xs text-white/45">
            {list.length} food{list.length === 1 ? "" : "s"}
            {list.length >= 300 ? " (search to narrow down)" : ""}
          </p>
          <ul className="mt-1 max-h-[50vh] divide-y divide-white/10 overflow-y-auto">
            {list.map((f) => (
              <li key={f.id}>
                <button type="button" className="w-full py-2.5 text-left" onClick={() => setPicked(f)}>
                  <p className="text-sm font-semibold">{f.n}</p>
                  <p className="text-xs text-white/50">
                    {[f.st, f.zn && f.zn !== "World" && f.zn !== "Mine" ? f.zn : "", f.g].filter(Boolean).join(" · ")}
                    {showNumbers ? ` · ${f.k} kcal, ${f.p} g protein /100 g` : ""}
                  </p>
                </button>
              </li>
            ))}
          </ul>
          {list.length === 0 && scope === "Indian" && !query.trim() && zone !== "All-India" && (
            <Note>No dishes matched to this state yet. Try searching by name, or check All-India.</Note>
          )}
          {list.length === 0 && scope === "Mine" && <Note>You haven't added any foods yet. Use "+ New food" or "+ New recipe" on the Food page.</Note>}
          <div className="mt-4">
            <Btn kind="soft" onClick={onClose}>
              Done
            </Btn>
          </div>
        </>
      )}
    </Modal>
  );
}

function FoodDetail({
  food,
  profile,
  showNumbers,
  initialMeal,
  onAdd,
  onBack,
}: {
  food: FoodItem;
  profile: Profile;
  showNumbers: boolean;
  initialMeal: string;
  onAdd: (grams: number, meal: string) => void;
  onBack: () => void;
}) {
  const [grams, setGrams] = useState(food.pt[0]?.[1] ?? 100);
  const [meal, setMeal] = useState(initialMeal);
  const n = nutrientsFor(food, grams);
  const tags = [food.st, food.zn && !["World", "Mine"].includes(food.zn) ? food.zn : "", food.g, sourceLabel(food.src)].filter(Boolean);

  return (
    <div className="mt-4">
      <p className="text-lg font-semibold">{food.n}</p>
      <p className="text-xs text-white/50">{tags.join(" · ")}</p>
      {food.al.length > 0 && <p className="mt-1 text-xs text-white/40">Also called: {food.al.slice(0, 3).join(", ")}</p>}
      {!fitsProfile(food, profile) && <Note tone="warn">This may not fit your diet or allergies. Please check before eating it.</Note>}
      {food.ing && (
        <p className="mt-2 text-xs text-white/50">Ingredients: {food.ing.map((i) => `${i.n} (${i.grams} g)`).join(", ")}</p>
      )}

      <p className="mt-4 text-xs text-white/50">How much?</p>
      <div className="mt-1 flex flex-wrap gap-2">
        {food.pt.map(([label, g], i) => (
          <Chip key={`${label}-${i}`} label={label} on={grams === g} onClick={() => setGrams(g)} />
        ))}
        <Chip label="100 g" on={grams === 100} onClick={() => setGrams(100)} />
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm">
        Grams
        <input
          type="number"
          inputMode="decimal"
          className={`${inputBase} w-28 py-1.5`}
          value={grams}
          onChange={(e) => setGrams(Math.max(0, Number(e.target.value) || 0))}
        />
      </label>

      {showNumbers && (
        <>
          <MacroGrid n={n} />
          <p className="mt-2 text-[11px] text-white/40">
            Per 100 g: {food.k} kcal · {food.p} g protein · {food.c} g carbs · {food.f} g fat
            {food.fb > 0 ? ` · ${food.fb} g fibre` : ""}
          </p>
        </>
      )}

      <p className="mt-4 text-xs text-white/50">Meal</p>
      <div className="mt-1 flex flex-wrap gap-2">
        {MEALS.map((m) => (
          <Chip key={m} label={m} on={meal === m} onClick={() => setMeal(m)} />
        ))}
      </div>
      <div className="mt-5 flex gap-2">
        <Btn disabled={!(grams > 0)} onClick={() => onAdd(r1(grams), meal)}>
          Add {r1(grams)} g
        </Btn>
        <Btn kind="soft" onClick={onBack}>
          Back
        </Btn>
      </div>
    </div>
  );
}

/* ---------- Suggestions ---------- */
function Suggestions({
  foods,
  profile,
  remaining,
  showNumbers,
  onPick,
}: {
  foods: FoodItem[];
  profile: Profile;
  remaining: number;
  showNumbers: boolean;
  onPick: (f: FoodItem) => void;
}) {
  const picks = useMemo(() => proteinPicks(foods, profile, preferredZones(profile)), [foods, profile]);
  if (!picks.length) return null;
  return (
    <Card title="Suggested: protein-rich foods for you">
      <p className="text-sm text-white/65">
        {showNumbers
          ? remaining > 1
            ? `You need about ${Math.round(remaining)} g more protein today. These fit your diet and allergies:`
            : "You've reached your protein target today. Good options for next time:"
          : "Protein-rich foods that fit your diet and allergies:"}
      </p>
      <ul className="mt-2 divide-y divide-white/10">
        {picks.map((pk) => (
          <li key={pk.food.id}>
            <button type="button" className="w-full py-2.5 text-left" onClick={() => onPick(pk.food)}>
              <p className="text-sm font-semibold">{pk.food.n}</p>
              <p className="text-xs text-white/50">
                {pk.label}
                {showNumbers ? ` · ${pk.protein} g protein · ${pk.kcal} kcal` : ""}
                {pk.food.st ? ` · ${pk.food.st}` : ""}
              </p>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-white/40">Tap a food to choose the amount and add it.</p>
    </Card>
  );
}

/* ---------- My food ---------- */
function MyFoodForm({ onSave, onClose }: { onSave: (f: FoodItem) => void; onClose: () => void }) {
  const [name, setName] = useState("");
  const [basis, setBasis] = useState<"100 g" | "serving">("serving");
  const [servingGrams, setServingGrams] = useState("");
  const [vals, setVals] = useState({ kcal: "", protein: "", carbs: "", fat: "", fibre: "" });
  const [diet, setDiet] = useState<FoodItem["d"]>("veg");
  const sg = Number(servingGrams);
  const ok = name.trim().length > 1 && vals.kcal !== "" && (basis === "100 g" || sg > 0);
  const fields: [keyof typeof vals, string][] = [
    ["kcal", "Calories (kcal)"],
    ["protein", "Protein (g)"],
    ["carbs", "Carbs (g)"],
    ["fat", "Fat (g)"],
    ["fibre", "Fibre (g)"],
  ];

  const save = () => {
    const factor = basis === "100 g" ? 1 : 100 / sg;
    const v = (s: string) => r1(Math.max(0, Number(s) || 0) * factor);
    onSave({
      id: `mine-${uid()}`, n: name.trim(), g: "My foods", rg: "Mine", zn: "Mine", st: "",
      k: v(vals.kcal), p: v(vals.protein), c: v(vals.carbs), f: v(vals.fat), fb: v(vals.fibre), s: 0, na: 0,
      pt: basis === "serving" ? [[`1 serving (${sg} g)`, sg]] : [],
      al: [], d: diet, j: false, a: [], src: "Mine",
    });
  };

  return (
    <Modal title="New food" onClose={onClose}>
      <div className="mt-4 space-y-3">
        <label className="block text-xs text-white/60">
          Food name
          <input className={`${inputClass} mt-1`} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="e.g. Amma's sambar rice" />
        </label>
        <div>
          <p className="text-xs text-white/60">The values below are for</p>
          <div className="mt-1 flex gap-2">
            <Chip label="1 serving" on={basis === "serving"} onClick={() => setBasis("serving")} />
            <Chip label="100 g" on={basis === "100 g"} onClick={() => setBasis("100 g")} />
          </div>
        </div>
        {basis === "serving" && (
          <label className="block text-xs text-white/60">
            How many grams is 1 serving?
            <input className={`${inputClass} mt-1`} type="number" inputMode="decimal" value={servingGrams} onChange={(e) => setServingGrams(e.target.value)} placeholder="e.g. 250" />
          </label>
        )}
        <div className="grid grid-cols-2 gap-2">
          {fields.map(([k, label]) => (
            <label key={k} className="block text-xs text-white/60">
              {label}
              <input
                className={`${inputClass} mt-1`}
                type="number"
                inputMode="decimal"
                value={vals[k]}
                onChange={(e) => setVals({ ...vals, [k]: e.target.value })}
              />
            </label>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {DIETS.map(([d, label]) => (
            <Chip key={d} label={label} on={diet === d} onClick={() => setDiet(d)} />
          ))}
        </div>
        <p className="text-[11px] text-white/45">Use the pack label or a trusted source.</p>
        <div className="flex gap-2">
          <Btn disabled={!ok} onClick={save}>
            Save food
          </Btn>
          <Btn kind="soft" onClick={onClose}>
            Cancel
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

/* ---------- Recipe builder ---------- */
function RecipeForm({ foods, onSave, onClose }: { foods: FoodItem[]; onSave: (f: FoodItem) => void; onClose: () => void }) {
  const [name, setName] = useState("");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<{ food: FoodItem; grams: number }[]>([]);
  const [cooked, setCooked] = useState("");
  const [servings, setServings] = useState(2);

  const results = q.trim() ? searchFoods(foods, q, { limit: 6 }) : [];
  const rawWeight = items.reduce((a, i) => a + i.grams, 0);
  const cookedWeight = Number(cooked) > 0 ? Number(cooked) : rawWeight;
  const totals = items.reduce(
    (acc, i) => {
      const n = nutrientsFor(i.food, i.grams);
      return { kcal: acc.kcal + n.kcal, protein: acc.protein + n.protein, carbs: acc.carbs + n.carbs, fat: acc.fat + n.fat, fibre: acc.fibre + n.fibre };
    },
    { kcal: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 },
  );
  const perServing: Nutrients = {
    kcal: r1(totals.kcal / servings), protein: r1(totals.protein / servings), carbs: r1(totals.carbs / servings),
    fat: r1(totals.fat / servings), fibre: r1(totals.fibre / servings),
  };
  const ok = name.trim().length > 1 && items.length > 0 && cookedWeight > 0;

  const save = () => {
    const per = (v: number) => r1((v / cookedWeight) * 100);
    const rank = ["vegan", "veg", "egg", "nonveg"] as const;
    const d = items.reduce<FoodItem["d"]>((acc, i) => (rank.indexOf(i.food.d) > rank.indexOf(acc) ? i.food.d : acc), "vegan");
    onSave({
      id: `recipe-${uid()}`, n: name.trim(), g: "My recipes", rg: "Mine", zn: "Mine", st: "",
      k: per(totals.kcal), p: per(totals.protein), c: per(totals.carbs), f: per(totals.fat), fb: per(totals.fibre), s: 0, na: 0,
      pt: [[`1 serving (${r1(cookedWeight / servings)} g)`, r1(cookedWeight / servings)]],
      al: [], d, j: false, a: [...new Set(items.flatMap((i) => i.food.a))], src: "Recipe",
      ing: items.map((i) => ({ id: i.food.id, n: i.food.n, grams: i.grams })),
    });
  };

  return (
    <Modal title="New recipe" onClose={onClose}>
      <div className="mt-4 space-y-3">
        <label className="block text-xs text-white/60">
          Recipe name
          <input className={`${inputClass} mt-1`} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="e.g. Home chicken curry" />
        </label>

        <div>
          <p className="text-xs text-white/60">Add ingredients (raw weights in grams)</p>
          <input className={`${inputClass} mt-1`} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search ingredient, e.g. rice raw, toor dal, oil" />
          {results.length > 0 && (
            <ul className="mt-1 divide-y divide-white/10 rounded-xl border border-white/10">
              {results.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm"
                    onClick={() => {
                      setItems([...items, { food: f, grams: 100 }]);
                      setQ("");
                    }}
                  >
                    {f.n} <span className="text-xs text-white/40">· {f.k} kcal /100 g</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {items.length > 0 && (
          <ul className="space-y-2">
            {items.map((it, i) => (
              <li key={`${it.food.id}-${i}`} className="flex items-center gap-2 text-sm">
                <span className="flex-1">{it.food.n}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  aria-label={`Grams of ${it.food.n}`}
                  className={`${inputBase} w-20 py-1.5`}
                  value={it.grams}
                  onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, grams: Math.max(0, Number(e.target.value) || 0) } : x)))}
                />
                <span className="text-xs text-white/50">g</span>
                <button type="button" aria-label="Remove ingredient" className="px-1 text-white/40 hover:text-red-300" onClick={() => setItems(items.filter((_, j) => j !== i))}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}

        <label className="block text-xs text-white/60">
          Total weight after cooking, in grams (optional)
          <input
            className={`${inputClass} mt-1`}
            type="number"
            inputMode="decimal"
            value={cooked}
            onChange={(e) => setCooked(e.target.value)}
            placeholder={rawWeight ? `Leave empty to use ${r1(rawWeight)} g` : "Weigh the pot contents for best accuracy"}
          />
        </label>
        <div className="flex items-center justify-between text-sm">
          <span>Servings</span>
          <Stepper value={servings} min={1} onChange={(v) => setServings(Math.max(1, Math.round(v)))} />
        </div>

        {items.length > 0 && (
          <>
            <p className="text-xs text-white/50">Per serving ({r1(cookedWeight / servings)} g):</p>
            <MacroGrid n={perServing} />
          </>
        )}

        <div className="flex gap-2">
          <Btn disabled={!ok} onClick={save}>
            Save recipe
          </Btn>
          <Btn kind="soft" onClick={onClose}>
            Cancel
          </Btn>
        </div>
      </div>
    </Modal>
  );
}