import { useState } from "react";
import type { AppData, Food, FoodEntry, PageProps, Profile, SetData } from "./store";
import { addDays, dateKey, dayLog, prettyDate, uid } from "./store";
import { FOODS } from "./foods";
import { MEALS, foodOn, foodsFor, isSuitable, mealIdeas, nutritionTargets, totalsOf, updateDay } from "./stats";
import { Bar, Btn, Card, Chip, Modal, Note, PageTitle, Stepper, inputClass } from "./ui";

/* ==========================================================
   Food page: targets, water, meal log, food search,
   custom foods and meal ideas. All values are estimates.
   ========================================================== */

const round1 = (n: number) => Math.round(n * 10) / 10;
const DIET_TYPES: Food["diet"][] = ["vegan", "veg", "egg", "nonveg"];
const DIET_LABEL: Record<Food["diet"], string> = { vegan: "Vegan", veg: "Vegetarian", egg: "Contains egg", nonveg: "Non-vegetarian" };

function entryFrom(food: Food, qty: number, meal: string, date: string): FoodEntry {
  return {
    id: uid(),
    date,
    meal,
    name: `${food.name} (${food.serving})`,
    qty,
    kcal: round1(food.kcal * qty),
    protein: round1(food.protein * qty),
    carbs: round1(food.carbs * qty),
    fat: round1(food.fat * qty),
    fibre: round1(food.fibre * qty),
  };
}

export default function FoodPage({ profile, data, setData }: PageProps) {
  const today = dateKey();
  const [date, setDate] = useState(today);
  const [adding, setAdding] = useState<string | null>(null);
  const [seed, setSeed] = useState(() => Math.floor(Date.now() / 86400000));

  const t = nutritionTargets(profile, data);
  const entries = foodOn(data, date);
  const totals = totalsOf(entries);
  const log = dayLog(data, date);
  const showNumbers = profile.foodTracking !== "Keep it simple";
  const ideas = mealIdeas(profile, data, seed);

  const addEntries = (list: FoodEntry[]) => setData((d) => ({ ...d, food: [...d.food, ...list] }));
  const removeEntry = (id: string) => setData((d) => ({ ...d, food: d.food.filter((f) => f.id !== id) }));
  const setWater = (fn: (n: number) => number) => setData((d) => updateDay(d, date, { water: Math.max(0, fn(dayLog(d, date).water)) }));

  return (
    <div className="pb-6">
      <PageTitle title="Food" sub="Log meals, track water and get meal ideas." />

      {/* Date picker */}
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
          <details className="mt-3 text-xs text-white/55">
            <summary className="cursor-pointer">How these targets are worked out</summary>
            <p className="mt-2">
              Your estimated maintenance is about {t.maintenance} kcal a day, based on your age, height, weight, sex, daily
              activity and training days.
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

      {/* Meals */}
      {MEALS.map((meal) => {
        const list = entries.filter((e) => e.meal === meal);
        const sub = totalsOf(list);
        return (
          <Card key={meal} title={meal} right={<Btn small onClick={() => setAdding(meal)}>+ Add</Btn>}>
            {list.length === 0 ? (
              <p className="text-sm text-white/40">Nothing logged yet.</p>
            ) : (
              <ul className="divide-y divide-white/10">
                {list.map((e) => (
                  <li key={e.id} className="flex items-center gap-3 py-2 text-sm">
                    <div className="flex-1">
                      <p>{e.name}</p>
                      <p className="text-xs text-white/45">
                        × {e.qty}
                        {showNumbers ? ` · ${Math.round(e.kcal)} kcal · ${round1(e.protein)} g protein` : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label={`Remove ${e.name}`}
                      className="px-2 text-white/40 hover:text-red-300"
                      onClick={() => removeEntry(e.id)}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {showNumbers && list.length > 0 && (
              <p className="mt-2 text-xs text-white/50">
                {Math.round(sub.kcal)} kcal · {Math.round(sub.protein)} g protein
              </p>
            )}
          </Card>
        );
      })}

      {/* Meal ideas */}
      <Card
        title="Meal ideas for you"
        right={
          <Btn small kind="soft" onClick={() => setSeed((s) => s + 1)}>
            ↻ Shuffle
          </Btn>
        }
      >
        <p className="text-xs text-white/55">
          Picked for your diet ({profile.diet || "not set"})
          {profile.allergies.length ? `, avoiding ${profile.allergies.join(", ").toLowerCase()}` : ""}
          {profile.budget ? `, ${profile.budget.toLowerCase()} budget` : ""}
          {showNumbers ? `, sized for about ${t.kcal} kcal a day` : ""}.
        </p>
        {ideas.map((idea) => (
          <div key={idea.meal} className="mt-4 border-t border-white/10 pt-3">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold">{idea.meal}</p>
              <Btn small onClick={() => addEntries(idea.items.map((i) => entryFrom(i.food, i.qty, idea.meal, date)))}>
                Add to log
              </Btn>
            </div>
            <ul className="mt-1 text-sm text-white/75">
              {idea.items.map((i) => (
                <li key={i.food.name}>
                  • {i.qty} × {i.food.name} <span className="text-white/45">({i.food.serving})</span>
                </li>
              ))}
            </ul>
            {showNumbers && (
              <p className="mt-1 text-xs text-white/50">
                About {idea.kcal} kcal · {idea.protein} g protein
              </p>
            )}
          </div>
        ))}
        {ideas.length === 0 && <Note>No suitable foods found for your diet and allergies. Add your own foods with + Add.</Note>}
      </Card>

      <Note>
        Calorie and nutrition values are estimates and vary with recipes and portion sizes. BYB does not replace a registered
        dietitian or doctor.
      </Note>

      {adding && (
        <AddFood
          meal={adding}
          date={date}
          profile={profile}
          data={data}
          setData={setData}
          showNumbers={showNumbers}
          onClose={() => setAdding(null)}
        />
      )}
    </div>
  );
}

function AddFood({
  meal,
  date,
  profile,
  data,
  setData,
  showNumbers,
  onClose,
}: {
  meal: string;
  date: string;
  profile: Profile;
  data: AppData;
  setData: SetData;
  showNumbers: boolean;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [chosen, setChosen] = useState<Food | null>(null);
  const [qty, setQty] = useState(1);
  const [mealSel, setMealSel] = useState(meal);
  const [creating, setCreating] = useState(false);
  const [added, setAdded] = useState("");

  const q = query.trim().toLowerCase();
  const pool = showAll ? [...data.customFoods, ...FOODS] : foodsFor(profile, data);
  const list = pool.filter((f) => !q || f.name.toLowerCase().includes(q));
  const isCustom = (f: Food) => data.customFoods.includes(f);

  const add = () => {
    if (!chosen) return;
    const entry = entryFrom(chosen, qty, mealSel, date);
    setData((d) => ({ ...d, food: [...d.food, entry] }));
    setAdded(`Added ${chosen.name} to ${mealSel.toLowerCase()}.`);
    setChosen(null);
    setQty(1);
  };
  const deleteCustom = (f: Food) => setData((d) => ({ ...d, customFoods: d.customFoods.filter((x) => x !== f) }));

  return (
    <Modal title={creating ? "Create your own food" : `Add to ${mealSel}`} onClose={onClose}>
      {creating ? (
        <CustomFoodForm
          onSave={(f) => {
            setData((d) => ({ ...d, customFoods: [f, ...d.customFoods] }));
            setCreating(false);
            setChosen(f);
          }}
          onCancel={() => setCreating(false)}
        />
      ) : chosen ? (
        <div className="mt-4">
          <p className="text-lg font-semibold">{chosen.name}</p>
          <p className="text-xs text-white/50">1 serving = {chosen.serving}</p>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-sm">Servings</span>
            <Stepper value={qty} step={0.5} min={0.5} onChange={setQty} />
          </div>
          {showNumbers && (
            <p className="mt-3 text-sm text-white/70">
              {Math.round(chosen.kcal * qty)} kcal · {round1(chosen.protein * qty)} g protein · {round1(chosen.carbs * qty)} g carbs ·{" "}
              {round1(chosen.fat * qty)} g fat · {round1(chosen.fibre * qty)} g fibre
            </p>
          )}
          <p className="mt-4 text-xs text-white/50">Meal</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {MEALS.map((m) => (
              <Chip key={m} label={m} on={mealSel === m} onClick={() => setMealSel(m)} />
            ))}
          </div>
          <div className="mt-5 flex gap-2">
            <Btn onClick={add}>Add</Btn>
            <Btn kind="soft" onClick={() => setChosen(null)}>
              Back
            </Btn>
          </div>
        </div>
      ) : (
        <>
          <input
            className={`${inputClass} mt-4`}
            type="search"
            placeholder="Search foods, e.g. idli, dal, paneer"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <Chip label="Show all foods" on={showAll} onClick={() => setShowAll(!showAll)} />
            <Chip label="+ Create your own food" on={false} onClick={() => setCreating(true)} />
          </div>
          {added && <p className="mt-3 rounded-lg bg-neon/15 px-3 py-2 text-xs text-neon">✓ {added}</p>}
          <ul className="mt-3 max-h-[50vh] divide-y divide-white/10 overflow-y-auto">
            {list.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center gap-2">
                <button
                  type="button"
                  className="flex-1 py-2.5 text-left"
                  onClick={() => {
                    setChosen(f);
                    setQty(1);
                    setAdded("");
                  }}
                >
                  <p className="text-sm font-semibold">
                    {f.name}
                    {isCustom(f) && <span className="ml-1 text-[10px] text-neon">YOURS</span>}
                  </p>
                  <p className="text-xs text-white/50">
                    {f.serving}
                    {showNumbers ? ` · ${f.kcal} kcal · ${f.protein} g protein` : ""}
                    {showAll && !isCustom(f) && !isSuitable(f, profile) ? " · ⚠ not in your diet or allergies" : ""}
                  </p>
                </button>
                {isCustom(f) && (
                  <button
                    type="button"
                    aria-label={`Delete ${f.name}`}
                    className="px-2 text-white/40 hover:text-red-300"
                    onClick={() => deleteCustom(f)}
                  >
                    ✕
                  </button>
                )}
              </li>
            ))}
          </ul>
          {list.length === 0 && <Note>No foods found. Try another word, turn on Show all foods, or create your own.</Note>}
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

function CustomFoodForm({ onSave, onCancel }: { onSave: (f: Food) => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [serving, setServing] = useState("1 serving");
  const [vals, setVals] = useState({ kcal: "", protein: "", carbs: "", fat: "", fibre: "" });
  const [diet, setDiet] = useState<Food["diet"]>("veg");
  const num = (s: string) => Math.max(0, Number(s) || 0);
  const ok = name.trim().length > 1 && vals.kcal !== "" && Number(vals.kcal) >= 0;
  const fields: [keyof typeof vals, string][] = [
    ["kcal", "Calories (kcal)"],
    ["protein", "Protein (g)"],
    ["carbs", "Carbs (g)"],
    ["fat", "Fat (g)"],
    ["fibre", "Fibre (g)"],
  ];

  return (
    <div className="mt-4 space-y-3">
      <label className="block text-xs text-white/60">
        Food name
        <input
          className={`${inputClass} mt-1`}
          value={name}
          maxLength={50}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Home-made sambar rice"
        />
      </label>
      <label className="block text-xs text-white/60">
        Serving size
        <input
          className={`${inputClass} mt-1`}
          value={serving}
          maxLength={30}
          onChange={(e) => setServing(e.target.value)}
          placeholder="e.g. 1 plate"
        />
      </label>
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
        {DIET_TYPES.map((d) => (
          <Chip key={d} label={DIET_LABEL[d]} on={diet === d} onClick={() => setDiet(d)} />
        ))}
      </div>
      <p className="text-[11px] text-white/45">Check the food label or a trusted source. Values are per serving.</p>
      <div className="flex gap-2">
        <Btn
          disabled={!ok}
          onClick={() =>
            onSave({
              name: name.trim(),
              serving: serving.trim() || "1 serving",
              kcal: num(vals.kcal),
              protein: num(vals.protein),
              carbs: num(vals.carbs),
              fat: num(vals.fat),
              fibre: num(vals.fibre),
              diet,
              meals: "bcmdspo",
              region: "Any",
              jain: false,
              cost: 1,
              allergens: [],
            })
          }
        >
          Save food
        </Btn>
        <Btn kind="soft" onClick={onCancel}>
          Cancel
        </Btn>
      </div>
    </div>
  );
}