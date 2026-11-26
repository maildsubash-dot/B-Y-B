import { useEffect, useState } from "react";
import type { FoodEntry, FoodItem, Profile } from "./store";
import { uid } from "./store";
import { placeIndian } from "./indianStates";

/* ==========================================================
   BYB food database: loading, search, "type what you ate",
   diet checks, suggestions and online packaged-food search.
   All values are per 100 g.
   ========================================================== */

export const r1 = (n: number) => Math.round(n * 10) / 10;
const num = (v: unknown) => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
};
export const norm = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9\u0900-\u097f]+/g, " ").replace(/\s+/g, " ").trim();

/* ---------- Loading the database files from public/data ---------- */
let cache: Promise<FoodItem[]> | null = null;

async function getJson(file: string): Promise<FoodItem[]> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/${file}`);
  if (!res.ok) throw new Error(`Could not load ${file}. Run: node scripts/import-data.mjs`);
  return (await res.json()) as FoodItem[];
}

export function loadFoods(): Promise<FoodItem[]> {
  if (!cache) {
    cache = Promise.all([getJson("foods-india.json"), getJson("foods-world.json")]).then(([india, world]) => {
      for (const f of india) {
        const place = placeIndian(`${f.n} ${f.al.join(" ")}`);
        f.st = place.st;
        f.zn = place.zn;
      }
      for (const f of world) f.zn = "World";
      return [...india, ...world];
    });
    cache.catch(() => {
      cache = null; // allow a retry next time
    });
  }
  return cache;
}

export function useFoodDb() {
  const [state, setState] = useState<{ foods: FoodItem[] | null; error: string }>({ foods: null, error: "" });
  useEffect(() => {
    let alive = true;
    loadFoods()
      .then((foods) => {
        if (alive) setState({ foods, error: "" });
      })
      .catch((e: unknown) => {
        if (alive) setState({ foods: null, error: e instanceof Error ? e.message : String(e) });
      });
    return () => {
      alive = false;
    };
  }, []);
  return state;
}

/* ---------- Search ---------- */
type Indexed = { name: string; all: string; tokens: string[] };
const itemIndex = new WeakMap<FoodItem, Indexed>();
function idx(f: FoodItem): Indexed {
  let v = itemIndex.get(f);
  if (!v) {
    const name = norm(f.n);
    const all = norm([f.n, ...f.al].join(" "));
    v = { name, all, tokens: all.split(" ") };
    itemIndex.set(f, v);
  }
  return v;
}

function lev(a: string, b: string): number {
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur.push(Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)));
    }
    prev = cur;
  }
  return prev[b.length];
}
// Is the start of token t within 1–2 typos of word w?
function close(t: string, w: string) {
  const max = w.length >= 7 ? 2 : 1;
  return [w.length - 1, w.length, w.length + 1].some((len) => len > 0 && lev(t.slice(0, len), w) <= max);
}

function scoreFood(f: FoodItem, q: string, words: string[], fuzzy: boolean, zones: string[]) {
  const ix = idx(f);
  let s: number;
  if (ix.name === q) s = 100;
  else if (ix.name.startsWith(q)) s = 85;
  else if (ix.all.includes(q)) s = 70;
  else {
    let hits = 0;
    for (const w of words) {
      const stem = w.length > 3 ? w.replace(/(es|s)$/, "") : w;
      if (ix.tokens.some((t) => t.startsWith(w) || t.startsWith(stem))) hits += 1;
      else if (fuzzy && w.length >= 4 && ix.tokens.some((t) => close(t, w))) hits += 0.6;
      else return 0;
    }
    s = 35 + (hits / words.length) * 25;
  }
  s -= Math.min(20, ix.name.length / 6); // prefer short, simple names
  if (f.src === "ONE") s += 8; // Indian dishes first
  if (f.src === "Mine" || f.src === "Recipe") s += 10;
  if (f.zn && zones.includes(f.zn)) s += 4;
  if (/\b(raw|dry|uncooked)\b/.test(ix.name)) s -= 3;
  return s;
}

export function searchFoods(foods: FoodItem[], query: string, opts: { limit?: number; zones?: string[] } = {}): FoodItem[] {
  const q = norm(query);
  if (!q) return [];
  const words = q.split(" ");
  const limit = opts.limit ?? 40;
  const zones = opts.zones ?? [];
  const run = (fuzzy: boolean) => {
    const scored: [number, FoodItem][] = [];
    for (const f of foods) {
      const s = scoreFood(f, q, words, fuzzy, zones);
      if (s > 0) scored.push([s, f]);
    }
    return scored.sort((a, b) => b[0] - a[0]).slice(0, limit).map(([, f]) => f);
  };
  const exact = run(false);
  if (exact.length >= 5) return exact;
  const ids = new Set(exact.map((f) => f.id));
  return [...exact, ...run(true).filter((f) => !ids.has(f.id))].slice(0, limit);
}

/* ---------- Diet and allergy checks ---------- */
const ROOTS = /\b(onion|garlic|potato|aloo|carrot|beet|radish|mooli|ginger|adrak|yam|arbi|taro|turnip|leek|shallot|scallion|honey)/;
const DIET_ALLOWS: Record<string, FoodItem["d"][]> = {
  Vegan: ["vegan"],
  Vegetarian: ["vegan", "veg"],
  Jain: ["vegan", "veg"],
  Eggetarian: ["vegan", "veg", "egg"],
  "Non-vegetarian": ["vegan", "veg", "egg", "nonveg"],
};

export function fitsProfile(f: FoodItem, p: Profile) {
  const allowed = DIET_ALLOWS[p.diet] ?? DIET_ALLOWS["Non-vegetarian"];
  if (!allowed.includes(f.d)) return false;
  const text = idx(f).all;
  if (p.diet === "Jain" && ROOTS.test(text)) return false;
  if (f.a.some((a) => p.allergies.includes(a))) return false;
  const avoid = p.otherAllergy
    .toLowerCase()
    .split(/,|;| and /)
    .map((s) => norm(s).replace(/s$/, ""))
    .filter((s) => s.length > 2);
  return !avoid.some((w) => text.includes(w));
}

export function preferredZones(p: Profile): string[] {
  const map: Record<string, string> = { "South Indian": "South", "North Indian": "North", "East Indian": "East", "West Indian": "West" };
  return p.cuisines.map((c) => map[c]).filter((z): z is string => !!z);
}

const MEAT = /\b(chicken|mutton|lamb|goat|beef|pork|ham|bacon|sausage|fish|tuna|salmon|prawn|shrimp|crab|meat|keema)/;
const EGG = /\begg(?!plant)/;
const DAIRY = /\b(milk|cheese|butter|cream|yogurt|yoghurt|curd|paneer|ghee|whey)/;
export function dietGuess(name: string): FoodItem["d"] {
  const n = name.toLowerCase();
  if (MEAT.test(n)) return "nonveg";
  if (EGG.test(n)) return "egg";
  if (DAIRY.test(n)) return "veg";
  return "vegan";
}

/* ---------- Amounts and entries ---------- */
export type Nutrients = { kcal: number; protein: number; carbs: number; fat: number; fibre: number };

export function nutrientsFor(f: FoodItem, grams: number): Nutrients {
  const x = grams / 100;
  return { kcal: r1(f.k * x), protein: r1(f.p * x), carbs: r1(f.c * x), fat: r1(f.f * x), fibre: r1(f.fb * x) };
}

export function entryFrom(f: FoodItem, grams: number, meal: string, date: string): FoodEntry {
  const n = nutrientsFor(f, grams);
  return {
    id: uid(), date, meal, name: f.n, qty: grams, grams, fid: f.id,
    kcal: n.kcal, protein: n.protein, carbs: n.carbs, fat: n.fat, fibre: n.fibre,
  };
}

export function mealForNow() {
  const d = new Date();
  const h = d.getHours() + d.getMinutes() / 60;
  if (h < 10.5) return "Breakfast";
  if (h < 15) return "Lunch";
  if (h < 18.5) return "Snack";
  return "Dinner";
}

export const sourceLabel = (src: string) =>
  ({ ONE: "open-nutrition-engine", USDA: "USDA", OFF: "Open Food Facts", Mine: "My food", Recipe: "My recipe" })[src] ?? src;

export function recentFoods(entries: FoodEntry[], all: FoodItem[]) {
  const byId = new Map(all.map((f) => [f.id, f]));
  const out: { food: FoodItem; grams: number }[] = [];
  const seen = new Set<string>();
  for (let i = entries.length - 1; i >= 0 && out.length < 8; i--) {
    const e = entries[i];
    if (!e.fid || seen.has(e.fid)) continue;
    const food = byId.get(e.fid);
    if (!food) continue;
    seen.add(e.fid);
    out.push({ food, grams: e.grams ?? 100 });
  }
  return out;
}

/* ---------- "Type what you ate" ---------- */
const UNITS: Record<string, string> = {
  g: "g", gm: "g", gms: "g", gram: "g", grams: "g", kg: "kg", ml: "ml", l: "l", litre: "l", liter: "l",
  cup: "cup", cups: "cup", katori: "katori", katoris: "katori", bowl: "bowl", bowls: "bowl", plate: "plate", plates: "plate",
  piece: "piece", pieces: "piece", pc: "piece", pcs: "piece", nos: "piece",
  slice: "slice", slices: "slice", glass: "glass", glasses: "glass",
  tbsp: "tbsp", tablespoon: "tbsp", tablespoons: "tbsp", tsp: "tsp", teaspoon: "tsp", teaspoons: "tsp",
  spoon: "spoon", spoons: "spoon", ladle: "ladle", ladles: "ladle", handful: "handful",
  serving: "serving", servings: "serving", scoop: "scoop", scoops: "scoop",
};
const UNIT_WORDS: Record<string, string[]> = {
  katori: ["katori", "bowl"], bowl: ["bowl", "katori"], cup: ["cup"], plate: ["plate"],
  piece: ["piece", "pc", "nos", "whole", "medium", "large", "small"], slice: ["slice"], glass: ["glass", "cup"],
  tbsp: ["tbsp", "tablespoon"], tsp: ["tsp", "teaspoon"], spoon: ["spoon", "tbsp"], ladle: ["ladle"],
  handful: ["handful"], serving: ["serving"], scoop: ["scoop"],
};
// Typical sizes, only used when the food has no matching portion
const DEFAULT_GRAMS: Record<string, number> = {
  cup: 200, katori: 150, bowl: 200, plate: 300, glass: 250, tbsp: 15, tsp: 5, spoon: 10, ladle: 60, slice: 30, handful: 30, scoop: 30,
};
const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  half: 0.5, quarter: 0.25, couple: 2,
};

function toNumber(w: string): number | null {
  if (/^\d+(\.\d+)?$/.test(w)) return Number(w);
  const frac = w.match(/^(\d+)\/(\d+)$/);
  if (frac) return Number(frac[2]) ? Number(frac[1]) / Number(frac[2]) : null;
  return Object.hasOwn(NUMBER_WORDS, w) ? NUMBER_WORDS[w] : null;
}

function readAmount(part: string): { count: number; unit: string; rest: string } {
  let t = part
    .toLowerCase()
    .replace(/½/g, " 0.5 ")
    .replace(/¼/g, " 0.25 ")
    .replace(/(\d)(g|gm|gms|grams?|ml|kg)\b/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
  const tail = t.match(/^(.*\D)\s(\d+(?:\.\d+)?)\s?(g|gm|gms|grams?|ml|kg)$/);
  if (tail) return { count: Number(tail[2]), unit: UNITS[tail[3]] ?? "g", rest: tail[1].replace(/^(of|the)\s+/, "").trim() };
  let count = 0;
  let unit = "";
  const first = t.split(" ")[0];
  const n = toNumber(first);
  if (n !== null && t.includes(" ")) {
    count = n;
    t = t.slice(first.length).trim();
  }
  const next = t.split(" ")[0];
  if (UNITS[next] && t.includes(" ")) {
    unit = UNITS[next];
    t = t.slice(next.length).trim();
  }
  return { count, unit, rest: t.replace(/^(of|the)\s+/, "").trim() };
}

const leadingCount = (label: string) => {
  const m = label.match(/^(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) || 1 : 1;
};
function perUnit(f: FoodItem, words: string[]): { grams: number; label: string } | null {
  for (const [label, g] of f.pt) {
    const l = label.toLowerCase();
    if (words.some((w) => new RegExp(`\\b${w}`).test(l))) return { grams: g / leadingCount(l), label };
  }
  return null;
}

export function amountFor(f: FoodItem, count: number, unit: string): { grams: number; how: string } {
  const n = count || 1;
  if (unit === "g") return { grams: n, how: `${n} g` };
  if (unit === "kg") return { grams: n * 1000, how: `${n} kg` };
  if (unit === "ml") return { grams: n, how: `${n} ml (counted as ${n} g)` };
  if (unit === "l") return { grams: n * 1000, how: `${n} litre (counted as ${n * 1000} g)` };
  if (unit) {
    const match = perUnit(f, UNIT_WORDS[unit] ?? [unit]);
    if (match) return { grams: r1(match.grams * n), how: `${n} × ${unit}, using "${match.label}"` };
    if (DEFAULT_GRAMS[unit]) return { grams: DEFAULT_GRAMS[unit] * n, how: `${n} ${unit} ≈ ${DEFAULT_GRAMS[unit]} g each (estimate, edit if needed)` };
  }
  const piece = perUnit(f, UNIT_WORDS.piece) ?? (f.pt[0] ? { grams: f.pt[0][1] / leadingCount(f.pt[0][0]), label: f.pt[0][0] } : null);
  if (piece) return { grams: r1(piece.grams * n), how: `${n} × ${piece.label}` };
  return { grams: 100 * n, how: `${n} × 100 g (no portion size known, edit if needed)` };
}

export type ParsedItem = { text: string; count: number; unit: string; grams: number; food: FoodItem | null; options: FoodItem[]; how: string };

export function parseMeal(text: string, foods: FoodItem[], zones: string[]): ParsedItem[] {
  return text
    .split(/\s*(?:,|\+|;|&|\n|\band\b|\bwith\b)\s*/i)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 15)
    .map((part) => {
      const { count, unit, rest } = readAmount(part);
      const options = rest ? searchFoods(foods, rest, { limit: 6, zones }) : [];
      const food = options[0] ?? null;
      const amount = food ? amountFor(food, count, unit) : { grams: 0, how: "" };
      return { text: part, count, unit, grams: amount.grams, food, options, how: amount.how };
    });
}

/* ---------- Suggestions: protein-rich foods that fit you ---------- */
export type Pick = { food: FoodItem; label: string; grams: number; protein: number; kcal: number };

export function proteinPicks(foods: FoodItem[], p: Profile, zones: string[], count = 10): Pick[] {
  const candidates = foods.filter(
    (f) =>
      f.k > 0 && f.p >= 7 && (f.p * 4) / f.k >= 0.22 && f.pt.length > 0 &&
      !/\b(raw|dry|dried|uncooked|powder|flour|mix|concentrate|isolate)\b/.test(idx(f).name) &&
      fitsProfile(f, p),
  );
  const scored = candidates
    .map((f) => {
      let s = ((f.p * 4) / f.k) * 100 + f.p;
      if (f.src === "ONE") s += 15;
      if (f.zn && zones.includes(f.zn)) s += 10;
      return { s, f };
    })
    .sort((a, b) => b.s - a.s);
  const out: Pick[] = [];
  const seen = new Set<string>();
  for (const { f } of scored) {
    const key = idx(f).name.split(" ")[0];
    if (seen.has(key)) continue;
    seen.add(key);
    const [label, grams] = f.pt[0];
    out.push({ food: f, label, grams, protein: r1((f.p * grams) / 100), kcal: Math.round((f.k * grams) / 100) });
    if (out.length >= count) break;
  }
  return out;
}

/* ---------- Online packaged foods (Open Food Facts, ODbL) ---------- */
type OffProduct = {
  code?: string;
  product_name?: string;
  brands?: string;
  serving_size?: string;
  serving_quantity?: number | string;
  nutriments?: Record<string, number | string>;
  allergens_tags?: string[];
  ingredients_analysis_tags?: string[];
};
const OFF_ALLERGENS: Record<string, string> = {
  "en:milk": "Milk / lactose", "en:peanuts": "Peanuts", "en:nuts": "Tree nuts", "en:gluten": "Gluten / wheat",
  "en:eggs": "Eggs", "en:soybeans": "Soy", "en:fish": "Fish", "en:crustaceans": "Shellfish", "en:molluscs": "Shellfish",
};

export async function searchOnline(query: string): Promise<FoodItem[]> {
  const fields = "code,product_name,brands,serving_size,serving_quantity,nutriments,allergens_tags,ingredients_analysis_tags";
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=24&fields=${fields}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open Food Facts returned ${res.status}`);
  const json = (await res.json()) as { products?: OffProduct[] };
  return (json.products ?? [])
    .map((pr): FoodItem => {
      const n = pr.nutriments ?? {};
      const kcal = num(n["energy-kcal_100g"]) || num(n["energy_100g"]) / 4.184;
      const name = `${pr.product_name || "Unnamed product"}${pr.brands ? ` (${pr.brands.split(",")[0].trim()})` : ""}`;
      const tags = pr.ingredients_analysis_tags ?? [];
      const d: FoodItem["d"] = tags.includes("en:non-vegetarian")
        ? "nonveg"
        : tags.includes("en:vegan")
          ? "vegan"
          : tags.includes("en:vegetarian")
            ? dietGuess(name) === "vegan" ? "veg" : dietGuess(name)
            : dietGuess(name);
      const sq = num(pr.serving_quantity);
      return {
        id: `off-${pr.code ?? uid()}`, n: name, g: "Packaged", rg: "World", zn: "World", st: "",
        k: r1(kcal), p: r1(num(n.proteins_100g)), c: r1(num(n.carbohydrates_100g)), f: r1(num(n.fat_100g)),
        fb: r1(num(n.fiber_100g)), s: r1(num(n.sugars_100g)), na: r1(num(n.sodium_100g) * 1000),
        pt: sq > 0 ? [[`1 serving (${pr.serving_size ?? `${sq} g`})`, r1(sq)]] : [],
        al: [], d, j: false,
        a: [...new Set((pr.allergens_tags ?? []).map((t) => OFF_ALLERGENS[t]).filter((x): x is string => !!x))],
        src: "OFF",
      };
    })
    .filter((f) => f.k > 0);
}