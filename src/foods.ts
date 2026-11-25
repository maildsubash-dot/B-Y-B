import type { Food } from "./store";

/* Estimated nutrition per serving. Values vary with recipe and portion size. */
const MILK = "Milk / lactose";
const GLUTEN = "Gluten / wheat";
const PEANUT = "Peanuts";
const NUTS = "Tree nuts";
const EGG = "Eggs";
const SOY = "Soy";
const FISH = "Fish";
const SHELL = "Shellfish";
const S = "South Indian";
const N = "North Indian";
const A = "Any";

// Meal tags: b breakfast, c rice/roti base, m main dish, d side dish, s snack, p pre-workout, o post-workout
function f(
  name: string, serving: string, kcal: number, protein: number, carbs: number, fat: number, fibre: number,
  diet: Food["diet"], meals: string, region: string, jain: boolean, cost: number, allergens: string[] = [],
): Food {
  return { name, serving, kcal, protein, carbs, fat, fibre, diet, meals, region, jain, cost, allergens };
}

export const FOODS: Food[] = [
  // Breakfast
  f("Idli", "2 pieces", 130, 4, 27, 0.5, 1.5, "vegan", "b", S, true, 1),
  f("Plain dosa", "1 medium", 170, 4, 28, 5, 1, "vegan", "b", S, true, 1),
  f("Masala dosa", "1 medium", 300, 6, 45, 11, 3, "vegan", "b", S, false, 2),
  f("Ragi dosa", "1 medium", 150, 4, 26, 4, 3, "vegan", "b", S, true, 1),
  f("Pesarattu (moong dosa)", "1 medium", 180, 9, 25, 5, 4, "vegan", "b", S, false, 1),
  f("Sambar", "1 katori", 110, 5, 15, 3, 4, "vegan", "bd", S, false, 1),
  f("Coconut chutney", "2 tbsp", 70, 1, 3, 6, 2, "vegan", "b", S, true, 1),
  f("Upma", "1 cup", 230, 6, 34, 8, 3, "vegan", "b", S, false, 1, [GLUTEN]),
  f("Pongal", "1 cup", 260, 7, 38, 9, 2, "veg", "b", S, false, 1, [MILK]),
  f("Poha", "1 cup", 250, 5, 40, 8, 2, "vegan", "b", N, false, 1, [PEANUT]),
  f("Besan chilla", "2 pieces", 220, 10, 26, 8, 4, "vegan", "b", N, false, 1),
  f("Aloo paratha", "1 piece", 290, 6, 40, 12, 3, "veg", "b", N, false, 1, [GLUTEN, MILK]),
  f("Oats with milk", "1 bowl", 270, 12, 38, 8, 4, "veg", "bp", A, true, 2, [MILK, GLUTEN]),
  f("Ragi malt with milk", "1 glass", 180, 7, 30, 4, 3, "veg", "bp", S, true, 1, [MILK]),
  f("Boiled eggs", "2 eggs", 140, 12, 1, 10, 0, "egg", "bso", A, false, 1, [EGG]),
  f("Egg omelette", "2 eggs", 190, 13, 2, 15, 0, "egg", "b", A, false, 1, [EGG]),
  f("Bread with peanut butter", "2 slices + 1 tbsp", 300, 11, 34, 12, 4, "vegan", "bp", A, false, 2, [GLUTEN, PEANUT]),
  // Rice and roti
  f("White rice (cooked)", "1 cup", 200, 4, 44, 0.5, 0.6, "vegan", "c", A, true, 1),
  f("Brown rice (cooked)", "1 cup", 215, 5, 45, 2, 3.5, "vegan", "c", A, true, 2),
  f("Chapati", "1 medium", 110, 3, 18, 3, 2.5, "vegan", "c", N, true, 1, [GLUTEN]),
  f("Millet roti (ragi/jowar)", "1 medium", 100, 3, 20, 1, 3, "vegan", "c", A, true, 1),
  f("Curd rice", "1 cup", 230, 7, 35, 7, 1, "veg", "c", S, true, 1, [MILK]),
  // Main dishes
  f("Moong dal", "1 katori", 150, 9, 20, 4, 5, "vegan", "m", A, true, 1),
  f("Rajma", "1 katori", 210, 10, 30, 5, 8, "vegan", "m", N, false, 1),
  f("Chana masala", "1 katori", 230, 10, 30, 8, 8, "vegan", "m", N, false, 1),
  f("Paneer", "100 g", 265, 18, 3, 20, 0, "veg", "mo", A, true, 3, [MILK]),
  f("Palak paneer", "1 katori", 260, 13, 9, 19, 3, "veg", "m", N, false, 2, [MILK]),
  f("Soya chunks curry", "1 katori (50 g dry)", 220, 26, 18, 5, 7, "vegan", "mo", A, false, 1, [SOY]),
  f("Tofu", "100 g", 145, 15, 3, 8, 1, "vegan", "mo", A, true, 2, [SOY]),
  f("Egg curry", "2 eggs", 260, 14, 8, 19, 1, "egg", "m", A, false, 1, [EGG]),
  f("Chicken curry", "150 g", 280, 26, 6, 17, 1, "nonveg", "m", A, false, 2),
  f("Grilled chicken breast", "150 g", 250, 40, 3, 8, 0, "nonveg", "mo", A, false, 2),
  f("Fish curry", "150 g", 220, 24, 5, 12, 1, "nonveg", "m", S, false, 2, [FISH]),
  f("Fish fry", "1 piece (100 g)", 230, 20, 6, 14, 0, "nonveg", "m", S, false, 2, [FISH]),
  f("Prawn curry", "150 g", 200, 24, 6, 9, 1, "nonveg", "m", S, false, 3, [SHELL]),
  f("Mutton curry", "150 g", 340, 25, 5, 25, 1, "nonveg", "m", A, false, 3),
  // Side dishes
  f("Rasam", "1 cup", 60, 2, 9, 2, 1, "vegan", "d", S, false, 1),
  f("Vegetable sabzi / poriyal", "1 katori", 110, 3, 12, 6, 4, "vegan", "d", A, false, 1),
  f("Curd", "1 cup", 120, 7, 9, 6, 0, "veg", "dso", A, true, 1, [MILK]),
  f("Cucumber salad", "1 bowl", 30, 1, 6, 0.2, 1.5, "vegan", "d", A, true, 1),
  // Snacks, pre- and post-workout
  f("Banana", "1 medium", 105, 1.3, 27, 0.4, 3, "vegan", "sp", A, true, 1),
  f("Apple", "1 medium", 95, 0.5, 25, 0.3, 4, "vegan", "s", A, true, 2),
  f("Papaya", "1 cup", 60, 0.7, 15, 0.2, 2.5, "vegan", "s", A, true, 1),
  f("Guava", "1 medium", 70, 2.5, 14, 1, 5, "vegan", "s", A, true, 1),
  f("Dates", "3 pieces", 70, 0.6, 18, 0, 2, "vegan", "p", A, true, 2),
  f("Roasted chana", "30 g", 110, 6, 18, 2, 5, "vegan", "sp", A, true, 1),
  f("Roasted peanuts", "30 g", 170, 7, 5, 14, 2.5, "vegan", "s", A, false, 1, [PEANUT]),
  f("Almonds", "10 pieces", 80, 3, 3, 7, 1.7, "vegan", "s", A, true, 2, [NUTS]),
  f("Sprouts salad", "1 cup", 100, 7, 16, 1, 4, "vegan", "sd", A, false, 1),
  f("Sundal", "1 cup", 160, 8, 24, 4, 7, "vegan", "s", S, false, 1),
  f("Makhana (dry roasted)", "30 g", 105, 3, 20, 0.3, 4, "vegan", "s", N, true, 2),
  f("Buttermilk", "1 glass", 40, 2, 5, 1, 0, "veg", "s", A, true, 1, [MILK]),
  f("Milk", "1 glass (200 ml)", 120, 6.5, 10, 6, 0, "veg", "po", A, true, 1, [MILK]),
  f("Whey protein in water", "1 scoop", 120, 24, 3, 1.5, 0, "veg", "o", A, true, 3, [MILK]),
  f("Sweet potato (boiled)", "1 medium", 115, 2, 27, 0.1, 4, "vegan", "p", A, false, 1),
  f("Medu vada", "1 piece", 150, 4, 15, 8, 2, "vegan", "s", S, false, 1),
  f("Peanut chikki", "1 piece (25 g)", 130, 4, 13, 7, 1, "vegan", "sp", A, false, 1, [PEANUT]),
];