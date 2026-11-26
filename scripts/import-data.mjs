/* ==========================================================
   BYB data import
   Downloads free, open datasets (no permission needed) and
   converts them into JSON files in public/data.

   Run from your project folder:
     node scripts/import-data.mjs
   ========================================================== */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import AdmZip from "adm-zip";

const OUT = path.join(process.cwd(), "public", "data");

const URLS = {
  exercises: "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json",
  usda: "https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip",
  usdaSupport: "https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_Supporting_Data_csv_2022-10-28.zip",
};

/* ---------- Helpers ---------- */
const r1 = (n) => Math.round(n * 10) / 10;
const num = (v) => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

async function download(url, label) {
  process.stdout.write(`Downloading ${label}... `);
  const res = await fetch(url, { headers: { "User-Agent": "BuildYourBody-data-import/1.0" } });
  if (!res.ok) throw new Error(`${label}: HTTP ${res.status} from ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  console.log(`${(buf.length / 1e6).toFixed(1)} MB`);
  return buf;
}

async function save(name, data) {
  await mkdir(OUT, { recursive: true });
  const file = path.join(OUT, name);
  await writeFile(file, JSON.stringify(data));
  const count = Array.isArray(data) ? `${data.length} items` : "saved";
  console.log(`  ✓ ${path.relative(process.cwd(), file)} (${count})`);
}

// CSV reader that handles quotes and commas inside fields
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch !== "\r") field += ch;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.length > 1);
}

/* ---------- Diet, allergen and region tags ---------- */
const NONVEG_CATEGORIES = new Set([
  "Poultry Products", "Beef Products", "Pork Products", "Lamb, Veal, and Game Products",
  "Sausages and Luncheon Meats", "Finfish and Shellfish Products",
]);
const MEAT = /\b(chicken|beef|pork|mutton|lamb\b|goat|veal|turkey|duck|bacon|ham\b|sausage|salami|pepperoni|frankfurter|burger|fish|tuna|salmon|sardine|anchov|mackerel|cod\b|tilapia|trout|shrimp|prawn|crab|lobster|clam|oyster|mussel|scallop|squid|octopus|meat|keema|kheema|liver|venison|gelatin|meen\b)/;
const VEGGIE = /\b(veggie|vegetarian|meatless|vegan|imitation|soyburger)/;
const EGG = /\begg(?!plant)|\banda\b|omelet/;
const DAIRY_EXCEPTIONS = /(peanut|nut|almond|cashew|cocoa|apple|shea) butter|butter ?beans?|butternut|(coconut|almond|soy|rice|oat|cashew) (milk|cream)|soymilk|cream of (tartar|wheat)/g;
const DAIRY = /\b(milk|cheese|butter|cream|yogurt|yoghurt|whey|casein|curd|paneer|ghee|dahi|lassi|raita|khoa|khoya|mawa|malai|kheer|payasam|kulfi|rabri|basundi|shrikhand|chaas|custard)/;
const ROOTS = /\b(onion|garlic|potato|aloo|carrot|beet|radish|mooli|ginger|adrak|yam|arbi|taro|turnip|leek|shallot|scallion|honey)/;

function dietOf(name, category = "") {
  const n = name.toLowerCase();
  if (!VEGGIE.test(n) && (NONVEG_CATEGORIES.has(category) || MEAT.test(n))) return "nonveg";
  if (EGG.test(n)) return "egg";
  if (category === "Dairy and Egg Products" || DAIRY.test(n.replace(DAIRY_EXCEPTIONS, ""))) return "veg";
  return "vegan";
}

function allergensOf(name, category = "") {
  const n = name.toLowerCase();
  const out = [];
  if (category === "Dairy and Egg Products" ? !EGG.test(n) : DAIRY.test(n.replace(DAIRY_EXCEPTIONS, ""))) out.push("Milk / lactose");
  if (/peanut|groundnut/.test(n)) out.push("Peanuts");
  if (/\b(almond|cashew|walnut|pistachio|pecan|hazelnut|macadamia|brazil ?nut|pine ?nut)/.test(n)) out.push("Tree nuts");
  if (/\b(wheat|bread|pasta|spaghetti|macaroni|noodle|flour|cracker|cookie|cake|biscuit|bagel|barley|rye|semolina|rava|sooji|couscous|pizza|muffin|pancake|waffle|doughnut|croissant|chapati|roti|phulka|naan|paratha|puri|poori|bhatura|maida)/.test(n)) out.push("Gluten / wheat");
  if (EGG.test(n)) out.push("Eggs");
  if (/\b(soy|soya|tofu|tempeh|edamame|miso|meal maker)/.test(n)) out.push("Soy");
  if (/\b(fish|tuna|salmon|sardine|anchov|mackerel|cod\b|tilapia|trout|halibut|meen\b)/.test(n)) out.push("Fish");
  if (/\b(shrimp|prawn|crab|lobster|clam|oyster|mussel|scallop|squid|octopus|crayfish)/.test(n)) out.push("Shellfish");
  return out;
}

// Rough first sort. Part 2 adds a proper Region → State map.
const SOUTH = /\b(idli|idly|dosa|dosai|uttapam|uthappam|sambar|sambhar|rasam|pongal|upma|uppuma|uppittu|appam|puttu|idiyappam|string hopper|avial|aviyal|kootu|poriyal|thoran|olan|erissery|pachadi|kozhukattai|adai|pesarattu|bisi ?bele|puliyogare|puliyodarai|tamarind rice|lemon rice|chitranna|curd rice|thayir|kuzhambu|kulambu|chettinad|parotta|kothu|ragi|akki roti|neer dosa|kadala|moilee|molee|gojju|sundal|vada|vadai|bonda|bajji|murukku|payasam|kesari|mysore pak|thogayal|thuvaiyal|podi|kanji|paniyaram|paddu|unniyappam|obbattu|holige|pathiri|appalam|pappadam|coconut chutney)/;
const NORTH = /\b(paratha|parantha|naan|kulcha|chole|chhole|rajma|makhani|kadhi|paneer|palak|saag|sarson|makki|aloo gobi|aloo matar|dum aloo|bhatura|tandoori|tikka|rogan josh|kofta|shahi|jeera rice|litti|chokha|baati|dal tadka|dal fry)/;
function regionGuess(name) {
  const n = name.toLowerCase();
  if (SOUTH.test(n)) return "South Indian";
  if (NORTH.test(n)) return "North Indian";
  return "All-India";
}

/* ---------- 1. Exercises (Free Exercise DB, public domain) ---------- */
async function buildExercises() {
  const list = JSON.parse((await download(URLS.exercises, "Free Exercise DB")).toString("utf8"));
  const out = list.map((e) => ({
    id: e.id,
    n: e.name,
    cat: e.category ?? "strength",
    lvl: e.level === "beginner" ? 1 : e.level === "intermediate" ? 2 : 3,
    mech: e.mechanic ?? "",
    force: e.force ?? "",
    eq: e.equipment ?? "body only",
    pm: e.primaryMuscles ?? [],
    sm: e.secondaryMuscles ?? [],
    steps: (e.instructions ?? []).map((s) => String(s).trim()).filter(Boolean),
    img: e.images ?? [],
  }));
  await save("exercises.json", out);
  return out.length;
}

/* ---------- 2. World foods (USDA SR Legacy, public domain) ---------- */
async function buildWorldFoods() {
  const zip = new AdmZip(await download(URLS.usda, "USDA SR Legacy foods"));
  let support = null;
  const getText = async (name) => {
    const find = (z) => z.getEntries().find((e) => path.basename(e.entryName) === name);
    let entry = find(zip);
    if (!entry) {
      support ??= new AdmZip(await download(URLS.usdaSupport, "USDA supporting data"));
      entry = find(support);
    }
    if (!entry) throw new Error(`Could not find ${name} in the USDA files`);
    return entry.getData().toString("utf8");
  };
  const table = async (name) => {
    const [header, ...rows] = parseCSV(await getText(name));
    const col = Object.fromEntries(header.map((h, i) => [h.trim().replace(/^\uFEFF/, ""), i]));
    return { col, rows };
  };

  console.log("  Reading USDA tables (this can take a minute)...");
  const categories = await table("food_category.csv");
  const catName = new Map(categories.rows.map((r) => [r[categories.col.id], r[categories.col.description]]));
  const units = await table("measure_unit.csv").catch(() => null);
  const unitName = new Map(units ? units.rows.map((r) => [r[units.col.id], r[units.col.name]]) : []);

  const foodsTable = await table("food.csv");
  const foods = new Map();
  for (const r of foodsTable.rows) {
    const category = catName.get(r[foodsTable.col.food_category_id]) ?? "Other";
    if (category === "Baby Foods") continue;
    const name = r[foodsTable.col.description];
    const diet = dietOf(name, category);
    foods.set(r[foodsTable.col.fdc_id], {
      id: `us${r[foodsTable.col.fdc_id]}`,
      n: name,
      g: category,
      rg: "World",
      k: 0, p: 0, c: 0, f: 0, fb: 0, s: 0, na: 0,
      pt: [],
      al: [],
      d: diet,
      j: (diet === "vegan" || diet === "veg") && !ROOTS.test(name.toLowerCase()),
      a: allergensOf(name, category),
      src: "USDA",
    });
  }

  // Nutrients per 100 g: energy, protein, carbs, fat, fibre, sugar, sodium
  const KEYS = { 1008: "k", 1003: "p", 1005: "c", 1004: "f", 1079: "fb", 2000: "s", 1093: "na" };
  const fn = await table("food_nutrient.csv");
  for (const r of fn.rows) {
    const food = foods.get(r[fn.col.fdc_id]);
    const key = KEYS[r[fn.col.nutrient_id]];
    if (food && key) food[key] = r1(num(r[fn.col.amount]));
  }

  // Real portion sizes in grams (e.g. "1 cup, chopped")
  const portions = await table("food_portion.csv");
  for (const r of portions.rows) {
    const food = foods.get(r[portions.col.fdc_id]);
    const grams = num(r[portions.col.gram_weight]);
    if (!food || !(grams > 0) || food.pt.length >= 5) continue;
    const unit = unitName.get(r[portions.col.measure_unit_id]);
    const label = [r[portions.col.amount], unit && unit !== "undetermined" ? unit : "", r[portions.col.portion_description] || r[portions.col.modifier]]
      .map((s) => String(s ?? "").trim())
      .filter(Boolean)
      .join(" ")
      .slice(0, 60);
    food.pt.push([label || `${grams} g`, r1(grams)]);
  }

  const list = [...foods.values()].filter((f) => f.k || f.p || f.c || f.f);
  await save("foods-world.json", list);
  return list.length;
}

/* ---------- 3. Indian foods (open-nutrition-engine, MIT) ---------- */
async function buildIndianFoods() {
  console.log("Reading open-nutrition-engine (Indian foods)...");
  const mod = await import("open-nutrition-engine");
  const lib = { ...(mod.default && typeof mod.default === "object" ? mod.default : {}), ...mod };
  const looksLikeFood = (x) => x && typeof x === "object" && typeof x.name === "string" && "calories" in x;

  // Find the full food list in the package, or collect it through its search function
  let foods = Object.values(lib).find((v) => Array.isArray(v) && v.length > 100 && looksLikeFood(v[0]));
  if (!foods && typeof lib.searchFoods === "function") {
    const seen = new Map();
    for (const q of ["", ..."abcdefghijklmnopqrstuvwxyz"]) {
      for (const options of [{ query: q, category: "all", diet: "all" }, { query: q, category: "all" }, { query: q }]) {
        let results = [];
        try {
          results = lib.searchFoods(options) ?? [];
        } catch {
          results = [];
        }
        for (const f of results) if (looksLikeFood(f)) seen.set(f.id ?? f.name, f);
      }
    }
    foods = [...seen.values()];
  }
  if (!foods?.length) throw new Error("Could not read the food list from open-nutrition-engine");
  console.log(`  Sample record: ${JSON.stringify(foods[0]).slice(0, 400)}`);

  const out = foods.filter(looksLikeFood).map((f, i) => {
    const name = String(f.name).trim();
    const tag = String(f.diet ?? "").toLowerCase();
    const guess = dietOf(name);
    const diet = /egg/.test(tag) || guess === "egg" ? "egg" : /non|meat/.test(tag) ? "nonveg" : guess === "nonveg" ? "nonveg" : guess;
    const servings = (Array.isArray(f.servings) ? f.servings : [])
      .map((s) => [String(s.label ?? s.id ?? "1 serving").slice(0, 60), r1(num(s.amount ?? s.grams ?? s.g))])
      .filter(([, g]) => g > 0)
      .slice(0, 6);
    const aliases = [f.hindiName, ...(Array.isArray(f.aliases) ? f.aliases : [])].filter(Boolean).map(String);
    const category = String(f.category ?? "Indian").replace(/[-_]/g, " ");
    return {
      id: `in-${String(f.id ?? i)}`,
      n: name,
      g: category.charAt(0).toUpperCase() + category.slice(1),
      rg: regionGuess(`${name} ${aliases.join(" ")}`),
      k: r1(num(f.calories)),
      p: r1(num(f.protein)),
      c: r1(num(f.carbs ?? f.carbohydrates)),
      f: r1(num(f.fat ?? f.fats)),
      fb: r1(num(f.fiber ?? f.fibre)),
      s: r1(num(f.sugar ?? f.sugars)),
      na: r1(num(f.sodium)),
      pt: servings,
      al: aliases,
      d: diet,
      j: false,
      a: allergensOf(`${name} ${aliases.join(" ")}`),
      src: "ONE",
    };
  });
  await save("foods-india.json", out);

  // Keep their MIT licence text so it can be shown in the app's credits
  let licence = "MIT License";
  for (const file of ["LICENSE", "LICENSE.md", "LICENSE.txt", "license"]) {
    try {
      licence = await readFile(path.join(process.cwd(), "node_modules", "open-nutrition-engine", file), "utf8");
      break;
    } catch {
      /* try the next name */
    }
  }
  return { count: out.length, licence };
}

/* ---------- Run ---------- */
const results = {};
const fail = (label, err) => console.error(`  ✗ ${label} failed: ${err.message}`);

try {
  results.exercises = await buildExercises();
} catch (err) {
  fail("Exercises", err);
}
try {
  results.world = await buildWorldFoods();
} catch (err) {
  fail("World foods", err);
}
try {
  results.india = await buildIndianFoods();
} catch (err) {
  fail("Indian foods", err);
}

await save("sources.json", [
  { name: "Free Exercise DB", by: "yuhonas and contributors", licence: "Unlicense (public domain)", url: "https://github.com/yuhonas/free-exercise-db" },
  { name: "USDA FoodData Central, SR Legacy", by: "U.S. Department of Agriculture", licence: "CC0 1.0 (public domain)", url: "https://fdc.nal.usda.gov/" },
  { name: "open-nutrition-engine", by: "Surya Challa / TheBarbellCrew", licence: "MIT", url: "https://github.com/suryachalla/open-nutrition-engine", text: results.india?.licence ?? "MIT License" },
]);

console.log("\nSummary:");
console.log(`  Exercises:     ${results.exercises ?? "FAILED"}`);
console.log(`  World foods:   ${results.world ?? "FAILED"}`);
console.log(`  Indian foods:  ${results.india?.count ?? "FAILED"}`);
if (!results.exercises || !results.world || !results.india) process.exitCode = 1;