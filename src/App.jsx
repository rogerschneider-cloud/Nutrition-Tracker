import { useState, useEffect, useRef } from "react";

// ── Diet presets ─────────────────────────────────────────────────────────────
const DIET_PRESETS = {
  mediterranean: { label: "Mediterranean Glycemic Load", carbs: 80, fatPct: 0.45, proteinPct: 0.30 },
  lowcarb:       { label: "Low Carb", carbs: 50, fatPct: 0.50, proteinPct: 0.30 },
  keto:          { label: "Strict Keto", carbs: 25, fatPct: 0.70, proteinPct: 0.25 },
  custom:        { label: "Custom", carbs: 80, fatPct: 0.45, proteinPct: 0.30 },
};

// Mifflin-St Jeor TDEE calculation
const calcTDEE = (profile) => {
  const { weight, height, age, sex, activity } = profile;
  const bmr = sex === "female"
    ? 10 * weight + 6.25 * height - 5 * age - 161
    : 10 * weight + 6.25 * height - 5 * age + 5;
  const multipliers = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, veryActive: 1.9 };
  return Math.round(bmr * (multipliers[activity] || 1.55));
};

const calcTargets = (profile) => {
  const tdee = calcTDEE(profile);
  const deficitMap = { lose: 500, maintain: 0, gain: -300 };
  const deficit = deficitMap[profile.goal] || 500;
  const kcal = Math.max(1000, tdee - deficit);
  const preset = DIET_PRESETS[profile.dietType] || DIET_PRESETS.mediterranean;
  const carbsKcal = (profile.customCarbs ?? preset.carbs) * 4;
  const remaining = kcal - carbsKcal;
  const protein = Math.round(profile.weight * 1.6);
  const proteinKcal = protein * 4;
  const fat = Math.round(Math.max(20, (remaining - proteinKcal)) / 9);
  // Fiber target: sex-specific RDA, adjusted for diet type
  const fiberBase = profile.sex === "female" ? 25 : 35;
  const fiberTarget = profile.dietType === "keto" ? 10 : profile.dietType === "lowcarb" ? 15 : fiberBase;

  return {
    calories: kcal,
    carbs: profile.customCarbs ?? preset.carbs,
    protein: profile.customProtein ?? protein,
    fat: profile.customFat ?? fat,
    fiber: profile.customFiber ?? fiberTarget,
  };
};

const calcMineralTargets = (profile) => ({
  sodium: profile.hypertension ? 1800 : 2300,
  calcium: profile.osteopenia ? 2000 : 1000,
  magnesium: profile.customMagnesium ?? (profile.sex === "female" ? 320 : 420),
  potassium: profile.customPotassium ?? (profile.arbMedication ? 3000 : 3500),
});

// Legacy helpers for backward compat during migration
const getKetoTargets = (userId, profiles) => {
  const p = profiles?.find(p => p.id === userId);
  return p ? calcTargets(p) : { fat: 123, protein: 142, carbs: 80, fiber: 10 };
};
const getMineralTargets = (userId, profiles) => {
  const p = profiles?.find(p => p.id === userId);
  return p ? calcMineralTargets(p) : { sodium: 2300, calcium: 2000, magnesium: 420, potassium: 3500 };
};
const MINERAL_COLORS = { sodium: "#7ec8e3", calcium: "#f4d06f", magnesium: "#b5a4f5", potassium: "#7ec8a4" };
const MAG_SUPPLEMENT = 400;

// Default profiles (migrated from hardcoded setup)
const DEFAULT_PROFILES = [
  { id: "me", name: "Me", icon: "🧔", weight: 89, height: 175, age: 60, sex: "male", activity: "active", goal: "lose", dietType: "mediterranean", hypertension: false, osteopenia: false, customCarbs: 80, loggingBias: 10, quickLogBias: 15, glucoseUnit: "mmol", defaultCalSupp: 600, calSuppStep: 300 },
  { id: "wife", name: "Liat", icon: "👩", weight: 75, height: 160, age: 58, sex: "female", activity: "moderate", goal: "lose", dietType: "mediterranean", hypertension: true, osteopenia: true, arbMedication: true, customCarbs: 80, loggingBias: 0, quickLogBias: 15, glucoseUnit: "mmol", defaultMagSupp: 320, defaultCalSupp: 1000, calSuppStep: 250 },
];

const PRESET_FOODS = [
  { name: "Eggs (2 large, boiled/poached)", calories: 140, fat: 10, protein: 12, carbs: 0.8, fiber: 0, sodium: 140, calcium: 56, magnesium: 12, potassium: 138 },
  { name: "Avocado (half)", calories: 120, fat: 11, protein: 1.5, carbs: 6, fiber: 4.5, sodium: 7, calcium: 12, magnesium: 29, potassium: 487 },
  { name: "Bacon (3 strips)", calories: 130, fat: 10, protein: 9, carbs: 0.3, fiber: 0, sodium: 580, calcium: 5, magnesium: 7, potassium: 128 },
  { name: "Salmon (150g)", calories: 280, fat: 16, protein: 31, carbs: 0, fiber: 0, sodium: 105, calcium: 18, magnesium: 42, potassium: 628 },
  { name: "Olive oil (1 tbsp)", calories: 119, fat: 13.5, protein: 0, carbs: 0, fiber: 0, sodium: 0, calcium: 0, magnesium: 0, potassium: 0 },
  { name: "Almonds (30g)", calories: 173, fat: 15, protein: 6, carbs: 6, fiber: 3.5, sodium: 0, calcium: 75, magnesium: 80, potassium: 208 },
  { name: "Spinach (100g)", calories: 23, fat: 0.4, protein: 2.9, carbs: 3.6, fiber: 2.2, sodium: 79, calcium: 99, magnesium: 79, potassium: 558 },
  { name: "Chicken breast (150g)", calories: 248, fat: 5, protein: 47, carbs: 0, fiber: 0, sodium: 113, calcium: 18, magnesium: 39, potassium: 440 },
  { name: "Cheddar (30g)", calories: 120, fat: 10, protein: 7, carbs: 0.4, fiber: 0, sodium: 180, calcium: 204, magnesium: 8, potassium: 27 },
  { name: "Butter (1 tbsp)", calories: 102, fat: 11.5, protein: 0.1, carbs: 0, fiber: 0, sodium: 91, calcium: 3, magnesium: 0, potassium: 3 },
  { name: "Broccoli (100g)", calories: 34, fat: 0.4, protein: 2.8, carbs: 7, fiber: 2.6, sodium: 33, calcium: 47, magnesium: 21, potassium: 316 },
  { name: "Greek yogurt full-fat (100g)", calories: 97, fat: 5, protein: 9, carbs: 3.6, fiber: 0, sodium: 36, calcium: 110, magnesium: 11, potassium: 141 },
  { name: "Walnuts (30g)", calories: 196, fat: 19.6, protein: 4.6, carbs: 4, fiber: 2, sodium: 1, calcium: 28, magnesium: 45, potassium: 125 },
  { name: "Zucchini (100g)", calories: 17, fat: 0.3, protein: 1.2, carbs: 3.1, fiber: 1, sodium: 8, calcium: 16, magnesium: 18, potassium: 261 },
  { name: "Ground beef 80/20 (150g)", calories: 366, fat: 30, protein: 26, carbs: 0, fiber: 0, sodium: 90, calcium: 18, magnesium: 21, potassium: 318 },
  { name: "Sardines in oil (100g)", calories: 208, fat: 11, protein: 25, carbs: 0, fiber: 0, sodium: 505, calcium: 382, magnesium: 39, potassium: 397 },
  { name: "Bone broth (240ml)", calories: 40, fat: 1, protein: 6, carbs: 0, fiber: 0, sodium: 450, calcium: 14, magnesium: 8, potassium: 180 },
  { name: "Salt, pink himalayan (¼ tsp)", calories: 0, fat: 0, protein: 0, carbs: 0, fiber: 0, sodium: 560, calcium: 2, magnesium: 1, potassium: 1 },
  { name: "Dark chocolate 85% (30g)", calories: 170, fat: 12, protein: 3, carbs: 13, fiber: 3.5, sodium: 7, calcium: 20, magnesium: 65, potassium: 200 },
  { name: "Mackerel (150g)", calories: 314, fat: 21, protein: 28, carbs: 0, fiber: 0, sodium: 120, calcium: 15, magnesium: 75, potassium: 520 },
];

const todayKey = () => new Date().toISOString().split("T")[0];
const yesterdayKey = () => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().split("T")[0]; };
const formatDate = (key) => { const [, m, d] = key.split("-"); return `${d}/${m}`; };

const ANALYZE_PROMPT = `You are a precise nutritionist. The user will describe a food or meal.

CRITICAL RULES:
1. If the user provides specific nutritional values (calories, protein, fat, etc.) from a product label, USE THOSE EXACT VALUES. Do not recalculate or estimate — the user knows their product better than you do.
2. If the user specifies an exact weight or volume (e.g. "200g", "150ml"), give values for that EXACT amount. Set "unit" to "g" or "ml". Set "servings" to the specified amount.
3. If no weight is specified: solid foods normalize to per 100g; liquids/smoothies normalize to per 100ml; countable items (eggs, bars, muffins) give values per 1 unit and set "unit" to "each".
4. Only estimate values for ingredients where no label data is provided.

Respond ONLY with a valid JSON object (no markdown, no explanation) in this exact shape:
{
  "name": "Short food name (include weight in name if specified, e.g. 'Chicken breast (200g)' or 'Greek Yogurt (per 100g)')",
  "unit": "g",
  "servings": 1,
  "note": "One sentence about what you identified and which base you used.",
  "calories": 0,
  "fat": 0,
  "protein": 0,
  "carbs": 0,
  "fiber": 0,
  "sodium": 0,
  "calcium": 0,
  "magnesium": 0,
  "potassium": 0
}
Round all values to 1 decimal place.`;

const QUICK_LOG_PROMPT = `You are a precise nutritionist. The user will describe everything they ate today or in a meal in casual natural language — no exact measurements needed, just how they'd describe it to a friend.

Identify each distinct food item, estimate realistic portions based on typical serving sizes, and return a JSON array of food items.

Respond ONLY with a valid JSON array (no markdown, no explanation) in this exact shape:
[
  {
    "name": "Short food name (with estimated portion)",
    "calories": 0,
    "fat": 0,
    "protein": 0,
    "carbs": 0,
    "fiber": 0,
    "sodium": 0,
    "calcium": 0,
    "magnesium": 0,
    "potassium": 0,
    "note": "Brief assumption about portion size"
  }
]

Be realistic with portions — a normal home-cooked serving, not a restaurant portion. If the user mentions a small amount, estimate accordingly. Round all values to 1 decimal place.`;

// ── Storage helpers (namespaced by userId) ──────────────────────────────────
// ── Supabase config ──────────────────────────────────────────────────────────
const SUPABASE_URL = "https://eaakmlmxlxdsypfuuhhx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhYWttbG14bHhkc3lwZnV1aGh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3NjUxMzIsImV4cCI6MjA5NzM0MTEzMn0.zFhuabKpY0YXfv2uTntoRSfZCkKWHekp1XFM0yAaxQo";

const sbGet = async (userKey) => {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/tracker_data?user_key=eq.${encodeURIComponent(userKey)}&select=value`, {
      headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` }
    });
    const data = await res.json();
    if (data && data[0]) return JSON.parse(data[0].value);
    return null;
  } catch { return null; }
};

const sbSet = async (userKey, val) => {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/tracker_data?on_conflict=user_key`, {
      method: "POST",
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal"
      },
      body: JSON.stringify({ user_key: userKey, value: JSON.stringify(val), updated_at: new Date().toISOString() })
    });
  } catch {}
};

// Write-through cache: localStorage for speed, Supabase for persistence
const lsGet = (key, uid) => { try { const v = localStorage.getItem(`keto_${uid}_${key}`); return v ? JSON.parse(v) : null; } catch { return null; } };
const lsSet = (key, uid, val) => {
  try { localStorage.setItem(`keto_${uid}_${key}`, JSON.stringify(val)); } catch {}
  sbSet(`keto_${uid}_${key}`, val);
};

// Load from Supabase and sync to localStorage
const syncFromCloud = async (key, uid) => {
  const val = await sbGet(`keto_${uid}_${key}`);
  if (val !== null) {
    try { localStorage.setItem(`keto_${uid}_${key}`, JSON.stringify(val)); } catch {}
  }
  return val;
};

// ── One-time migration: copy old single-user data into "me" profile ──────────
const runMigration = () => {
  try {
    if (localStorage.getItem("keto_migration_done")) return;
    // Migrate history (contains per-day entry arrays)
    const oldHist = localStorage.getItem("keto_history");
    if (oldHist) {
      const hist = JSON.parse(oldHist);
      // Also pull today's entries into history
      const todayEntries = localStorage.getItem("keto_entries_" + new Date().toISOString().split("T")[0]);
      if (todayEntries) hist[new Date().toISOString().split("T")[0]] = JSON.parse(todayEntries);
      lsSet("history", "me", hist);
      // Restore today's entries
      const today = new Date().toISOString().split("T")[0];
      if (hist[today]) lsSet("entries_" + today, "me", hist[today]);
    }
    // Migrate other keys
    const bl = localStorage.getItem("keto_burn_log");
    if (bl) lsSet("burn_log", "me", JSON.parse(bl));
    const eo = localStorage.getItem("keto_eaten_override");
    if (eo) lsSet("eaten_override", "me", JSON.parse(eo));
    const ms = localStorage.getItem("keto_mag_supp");
    if (ms !== null) lsSet("mag_supp", "me", JSON.parse(ms));
    const mf = localStorage.getItem("keto_my_foods");
    if (mf) {
      lsSet("my_foods", "me", JSON.parse(mf)); // keep old per-user copy too
      // Write to shared key so both profiles see it
      localStorage.setItem("keto_shared_my_foods", mf);
    }
    localStorage.setItem("keto_migration_done", "1");
    console.log("✅ Keto data migrated to Me profile");
  } catch (e) { console.warn("Migration failed:", e); }
};
runMigration();

// ── Seed shared My Foods — one batched read-modify-write ─────────────────────
const SEEDED_MY_FOODS = [
  { id: "mf_sardines_water", name: "Sardines in Water (per 100g)", calories: 140, fat: 5, protein: 24, carbs: 0, fiber: 0, sodium: 400, calcium: 380, magnesium: 35, potassium: 390, _unit: "g" },
  { id: "mf_creapure_creatine", name: "Creapure Creatine (3.4g dose)", calories: 0, fat: 0, protein: 0, carbs: 0, fiber: 0, sodium: 0, calcium: 0, magnesium: 0, potassium: 0, _unit: "each" },
  { id: "mf_spiced_chicken_kale", name: "Spiced Chicken with Kale & Chard (1 serving)", calories: 485, fat: 28, protein: 42, carbs: 14, fiber: 4, sodium: 190, calcium: 180, magnesium: 95, potassium: 1050, _unit: "each" },
  { id: "mf_yogurt_neogal_10", name: "Greek Yogurt 10% - Neogal (per 100g)", calories: 128, fat: 10, protein: 5.6, carbs: 4, fiber: 0, sodium: 64, calcium: 120, magnesium: 12, potassium: 140, _unit: "g" },
  { id: "mf_yogurt_bifidus", name: "Yogurt Bifidus Probiotic (per 100g)", calories: 101, fat: 6.5, protein: 5.5, carbs: 4.3, fiber: 0, sodium: 47, calcium: 162, magnesium: 12, potassium: 150, _unit: "g" },
  { id: "mf_tahini_yogurt_sauce", name: "Tahini Yogurt Sauce (per 100g)", calories: 250, fat: 20.8, protein: 8.4, carbs: 10.9, fiber: 3.6, sodium: 46, calcium: 200, magnesium: 45, potassium: 180, _unit: "g" },
  { id: "mf_sweet_potato_pancake", name: "Sweet Potato Savory Pancake (1 of 13)", calories: 83, fat: 5.8, protein: 2.1, carbs: 5.6, fiber: 1.2, sodium: 30, calcium: 25, magnesium: 12, potassium: 165, _unit: "each" },
  { id: "mf_mulberries", name: "Mulberries fresh (per 100g)", calories: 43, fat: 0.4, protein: 1.4, carbs: 9.8, fiber: 1.7, sodium: 10, calcium: 39, magnesium: 18, potassium: 194, _unit: "g" },
  { id: "mf_acai", name: "Açaí Organic Unsweetened - Sambazon (per 100g)", calories: 64, fat: 4.9, protein: 1, carbs: 2.5, fiber: 1, sodium: 15, calcium: 0, magnesium: 0, potassium: 0, _unit: "g" },
  { id: "mf_mct_oil", name: "MCT Oil (1 tsp, 5ml)", calories: 45, fat: 5, protein: 0, carbs: 0, fiber: 0, sodium: 0, calcium: 0, magnesium: 0, potassium: 0, _unit: "each" },
  { id: "mf_sweet_potato", name: "Sweet Potato boiled (per 100g)", calories: 76, fat: 0.1, protein: 1.4, carbs: 17, fiber: 2.5, sodium: 27, calcium: 27, magnesium: 18, potassium: 475, _unit: "g" },
  { id: "mf_vegan_shawarma_dish", name: "Vegan Shawarma with Vegetables (150g serving)", calories: 243, fat: 13.3, protein: 18.8, carbs: 11.3, fiber: 6.3, sodium: 290, calcium: 30, magnesium: 35, potassium: 325, _unit: "each" },
  { id: "mf_vegan_shawarma", name: "Vegan Shawarma Soy Strips dry (per 100g)", calories: 356, fat: 7.5, protein: 50, carbs: 14, fiber: 17, sodium: 8, calcium: 0, magnesium: 0, potassium: 0, _unit: "g" },
  { id: "mf_black_lentil_hummus", name: "Black Lentil Hummus homemade (per 100g)", calories: 149, fat: 6, protein: 8, carbs: 15.7, fiber: 5.7, sodium: 0, calcium: 45, magnesium: 40, potassium: 589, _unit: "g" },
  { id: "mf_white_bean_hummus", name: "White Bean Hummus homemade (per 100g)", calories: 163, fat: 6, protein: 8, carbs: 18, fiber: 7, sodium: 0, calcium: 55, magnesium: 42, potassium: 893, _unit: "g" },
  { id: "mf_chickpeas", name: "Chickpeas cooked (per 100g)", calories: 164, fat: 2.6, protein: 9, carbs: 25, fiber: 7, sodium: 7, calcium: 49, magnesium: 48, potassium: 291, _unit: "g" },
  { id: "mf_white_beans", name: "White Beans / Cannellini cooked (per 100g)", calories: 139, fat: 0.5, protein: 9, carbs: 25, fiber: 10, sodium: 2, calcium: 90, magnesium: 45, potassium: 1190, _unit: "g" },
  { id: "mf_lentils", name: "Lentils cooked (per 100g)", calories: 116, fat: 0.4, protein: 9, carbs: 20, fiber: 8, sodium: 2, calcium: 19, magnesium: 36, potassium: 730, _unit: "g" },
  { id: "mf_hungarian_goulash", name: "Hungarian Goulash (1 serving, 483g)", calories: 420, fat: 18, protein: 42, carbs: 21, fiber: 3, sodium: 680, calcium: 55, magnesium: 45, potassium: 820, _unit: "each" },
  { id: "mf_sprats_larsen", name: "Smoked Sprats in Oil - Larsen (1 jar, 131g)", calories: 284, fat: 21, protein: 22, carbs: 0, fiber: 0, sodium: 590, calcium: 200, magnesium: 35, potassium: 320, _unit: "each" },
  { id: "mf_sardines_grilled", name: "Sardines Grilled in Olive Oil - Brivais Vilnis (1 tin, 133g)", calories: 240, fat: 17, protein: 23, carbs: 0.3, fiber: 0, sodium: 638, calcium: 300, magnesium: 40, potassium: 420, _unit: "each" },
  { id: "mf_cream_of_tartar", name: "Cream of Tartar (¼ tsp)", calories: 2, fat: 0, protein: 0, carbs: 0.5, fiber: 0, sodium: 2, calcium: 0, magnesium: 0, potassium: 500, _unit: "each" },
  { id: "mf_custard", name: "Keto Custard - 1 serving (half recipe)", calories: 448, fat: 44.5, protein: 6.5, carbs: 4.5, fiber: 0.3, sodium: 100, calcium: 80, magnesium: 8, potassium: 120, _unit: "each" },
  { id: "mf_bulgarian_cheese", name: "Bulgarian Cheese - Piraeus (per 100g)", calories: 248, fat: 24, protein: 7, carbs: 1.1, fiber: 0, sodium: 540, calcium: 170, magnesium: 0, potassium: 0, _unit: "g" },
  { id: "mf_keto_bread_roll", name: "Keto Almond Psyllium Roll (1 of 8)", calories: 130, fat: 9, protein: 5.3, carbs: 2.3, fiber: 4, sodium: 145, calcium: 60, magnesium: 35, potassium: 120, _unit: "each" },
  { id: "mf_quest_bar", name: "Quest Bar (1 bar, 60g)", calories: 160, fat: 7, protein: 16, carbs: 3, fiber: 0, sodium: 160, calcium: 210, magnesium: 0, potassium: 40, _unit: "each" },
  { id: "mf_labneh_zaatar", name: "Labneh Olive Oil & Zaatar - Gad (per 100g)", calories: 146, fat: 10, protein: 8, carbs: 6, fiber: 0, sodium: 400, calcium: 0, magnesium: 0, potassium: 0, _unit: "g" },
  { id: "mf_cream_cheese_30", name: "Cream Cheese 30% (per 100g)", calories: 302, fat: 30, protein: 5, carbs: 2.5, fiber: 0, sodium: 370, calcium: 100, magnesium: 0, potassium: 0, _unit: "g" },
  { id: "mf_keto_bread_slice", name: "Keto bread – 1 slice (22g)", calories: 46, fat: 1.7, protein: 4.4, carbs: 3.2, fiber: 4, sodium: 86, calcium: 0, magnesium: 0, potassium: 0, _unit: "each" },
  { id: "mf_protein_berry_shake", name: "Protein Berry Shake - Nutricost WPI + Soy Milk (per 100g)", calories: 99, fat: 3.6, protein: 13.1, carbs: 3.4, fiber: 0.5, sodium: 56, calcium: 41, magnesium: 0, potassium: 67, _unit: "g" },
  { id: "mf_wpi_soy_smoothie_100g", name: "Soy Milk Whey Protein Raspberry Smoothie (per 100g)", calories: 99, fat: 2.5, protein: 16.5, carbs: 5.9, fiber: 1.6, sodium: 47, calcium: 78, magnesium: 18, potassium: 159, _unit: "g" },
  { id: "mf_israeli_chopped_salad", name: "Israeli Chopped Salad (per 100g)", calories: 52, fat: 3.2, protein: 1.1, carbs: 5.4, fiber: 1.5, sodium: 148, calcium: 22, magnesium: 12, potassium: 220, _unit: "g" },
  { id: "mf_frittata_kale_zucchini", name: "2-Egg Frittata with Kale, Zucchini, Pepper & Onion (1 serving)", calories: 220, fat: 13.5, protein: 15.2, carbs: 8.4, fiber: 2.1, sodium: 320, calcium: 120, magnesium: 38, potassium: 420, _unit: "each" },
  { id: "mf_keto_choc_muffin", name: "Keto Chocolate Muffin (1 of 12)", calories: 178, fat: 14.8, protein: 6.2, carbs: 8.1, fiber: 3.9, sodium: 82, calcium: 68, magnesium: 38, potassium: 152, _unit: "each" },
  { id: "mf_chicken_soup", name: "Homemade Chicken Soup (per 100g)", calories: 52, fat: 2.8, protein: 4.9, carbs: 2.8, fiber: 0.5, sodium: 210, calcium: 14, magnesium: 9, potassium: 135, _unit: "g" },
  { id: "mf_scrambled_egg", name: "Scrambled Egg (per egg)", calories: 91, fat: 6.7, protein: 6.3, carbs: 0.6, fiber: 0, sodium: 171, calcium: 43, magnesium: 6, potassium: 84, _unit: "each" },
  { id: "mf_emek_cheese_slice", name: "Emek Cheese (1 slice, ~20g)", calories: 72, fat: 5.8, protein: 4.8, carbs: 0.2, fiber: 0, sodium: 180, calcium: 144, magnesium: 6, potassium: 30, _unit: "each" },
  { id: "mf_pear_100g", name: "Pear (per 100g)", calories: 57, fat: 0.1, protein: 0.4, carbs: 15.2, fiber: 3.1, sodium: 1, calcium: 9, magnesium: 7, potassium: 116, _unit: "g" },
  { id: "mf_stewed_beef", name: "Stewed Beef (per 100g)", calories: 185, fat: 9.5, protein: 23.8, carbs: 0, fiber: 0, sodium: 65, calcium: 12, magnesium: 20, potassium: 280, _unit: "g" },
  { id: "mf_buckwheat_kasha", name: "Buttered Buckwheat Kasha (per 100g cooked)", calories: 106, fat: 2.9, protein: 3.4, carbs: 18.1, fiber: 1.8, sodium: 142, calcium: 8, magnesium: 45, potassium: 138, _unit: "g" },
  { id: "mf_black_lentil_sweet_potato_salad", name: "Black Lentil & Sweet Potato Salad (per 100g)", calories: 112, fat: 3.1, protein: 5.2, carbs: 16.8, fiber: 3.4, sodium: 48, calcium: 28, magnesium: 29, potassium: 313, _unit: "g" },
  { id: "mf_bari_date", name: "Bari Date (small, per date ~8g)", calories: 23, fat: 0, protein: 0.2, carbs: 6.1, fiber: 0.6, sodium: 0, calcium: 3, magnesium: 2.5, potassium: 55, _unit: "each" },
  { id: "mf_roasted_almond", name: "Roasted Almond (per almond)", calories: 7, fat: 0.6, protein: 0.3, carbs: 0.2, fiber: 0.1, sodium: 0.2, calcium: 2.6, magnesium: 3.1, potassium: 10, _unit: "each" },
  { id: "mf_dry_roasted_peanuts", name: "Dry Roasted Peanuts Lightly Salted (per 100g)", calories: 584, fat: 49.7, protein: 23.6, carbs: 21.5, fiber: 8, sodium: 191, calcium: 54, magnesium: 176, potassium: 659, _unit: "g" },
  { id: "mf_pistachios", name: "Pistachios in-shell Lightly Salted (per 100g)", calories: 159, fat: 12.9, protein: 5.8, carbs: 7.7, fiber: 3, sodium: 115, calcium: 30, magnesium: 31, potassium: 290, _unit: "g" },
  { id: "mf_garden_salad_dressing", name: "Garden Salad with Lemon Olive Oil Dressing (per 100g)", calories: 63, fat: 4.1, protein: 1.4, carbs: 5.8, fiber: 1.8, sodium: 29, calcium: 38, magnesium: 14, potassium: 219, _unit: "g" },
  { id: "mf_salt_pinch", name: "Salt - 1 pinch (1g)", calories: 0, fat: 0, protein: 0, carbs: 0, fiber: 0, sodium: 390, calcium: 0, magnesium: 0, potassium: 0, _unit: "each" },
  { id: "mf_protein_berry_turmeric_smoothie", name: "Protein Berry Turmeric Smoothie (per 100ml)", calories: 71.1, fat: 3.2, protein: 5.8, carbs: 5.9, fiber: 0.9, sodium: 38.2, calcium: 48.3, magnesium: 11.4, potassium: 112.7, _unit: "ml" },
  { id: "mf_pasta_beef_ragu", name: "Pasta with Beef Ragu (per 100g)", calories: 144, fat: 6.7, protein: 10.6, carbs: 17.8, fiber: 0.8, sodium: 133, calcium: 9, magnesium: 14, potassium: 98, _unit: "g" },
  { id: "mf_watermelon", name: "Watermelon (per 100g)", calories: 30, fat: 0.2, protein: 0.6, carbs: 7.6, fiber: 0.4, sodium: 1, calcium: 7, magnesium: 10, potassium: 112, _unit: "g" },
  { id: "mf_hard_boiled_egg", name: "Hard-Boiled Egg (1 large)", calories: 77.5, fat: 5.3, protein: 6.3, carbs: 0.6, fiber: 0, sodium: 62, calcium: 25, magnesium: 5, potassium: 63, _unit: "each" },
  { id: "mf_chicken_drumstick", name: "Chicken Drumstick (roasted, skin-on)", calories: 195, fat: 11.2, protein: 22.5, carbs: 0, fiber: 0, sodium: 85, calcium: 12, magnesium: 20, potassium: 220, _unit: "each" },
  { id: "mf_egg_mushroom_scramble_mozz", name: "Egg & Mushroom Scramble with Mozzarella (1 serving)", calories: 387.2, fat: 28.6, protein: 26.4, carbs: 3.1, fiber: 0.5, sodium: 420, calcium: 148.2, magnesium: 22.4, potassium: 362.5, _unit: "each" },
  { id: "mf_white_bean_beef_chilli", name: "White Bean Chilli with Beef (per 100g)", calories: 118, fat: 4.2, protein: 8.8, carbs: 10.2, fiber: 2.8, sodium: 210, calcium: 38, magnesium: 22, potassium: 380, _unit: "g" },
  { id: "mf_tnuva_bio_yogurt_3", name: "Tnuva Bio Yogurt 3% (per 100g)", calories: 64, fat: 3, protein: 5.3, carbs: 4, fiber: 0, sodium: 50, calcium: 250, magnesium: 0, potassium: 0, _unit: "g" },
  { id: "mf_sardines_tomato_moroccan", name: "Sardines in Tomato Sauce Moroccan (per 100g)", calories: 164, fat: 10.5, protein: 16.1, carbs: 0, fiber: 0, sodium: 156, calcium: 0, magnesium: 0, potassium: 0, _unit: "g" },
  { id: "mf_dehydrated_beet_greens", name: "Dehydrated Beet Greens homemade (per 100g)", calories: 256, fat: 4, protein: 23.3, carbs: 46.7, fiber: 25.3, sodium: 1980, calcium: 1460, magnesium: 653, potassium: 7053, _unit: "g" },
  { id: "mf_dehydrated_dragon_kale", name: "Dehydrated Dragon Kale homemade (per 100g)", calories: 353, fat: 6, protein: 23.3, carbs: 56.7, fiber: 12.7, sodium: 293, calcium: 900, magnesium: 153, potassium: 2320, _unit: "g" },
  { id: "mf_tofu_firm", name: "Tofu Firm (per 100g)", calories: 76, fat: 4.2, protein: 8, carbs: 1.9, fiber: 0.3, sodium: 7, calcium: 350, magnesium: 30, potassium: 121, _unit: "g" },
  { id: "mf_feta_cheese", name: "Feta Cheese (per 100g)", calories: 264, fat: 21, protein: 14, carbs: 4, fiber: 0, sodium: 917, calcium: 493, magnesium: 19, potassium: 62, _unit: "g" },
  { id: "mf_ricotta_homemade", name: "Homemade Ricotta from 3% Milk (per 100g)", calories: 174, fat: 10, protein: 11, carbs: 7, fiber: 0, sodium: 45, calcium: 207, magnesium: 0, potassium: 0, _unit: "g" },
  { id: "mf_sour_cream_full_fat", name: "Sour Cream Full Fat - Tnuva (per 100g)", calories: 265, fat: 27, protein: 2.4, carbs: 3, fiber: 0, sodium: 45, calcium: 0, magnesium: 0, potassium: 0, _unit: "g" },
];
const SEED_VERSION = 6; // increment when SEEDED_MY_FOODS changes
try {
  const raw = localStorage.getItem("keto_shared_my_foods");
  const existing = raw ? JSON.parse(raw) : [];
  const storedVersion = parseInt(localStorage.getItem("keto_seed_version") || "0");
  const seedMap = Object.fromEntries(SEEDED_MY_FOODS.map(f => [f.id, f]));

  if (storedVersion < SEED_VERSION) {
    // Full reseed: replace all seeded foods with latest values, keep user-added foods (no mf_ prefix or unknown id)
    const userAdded = existing.filter(f => !seedMap[f.id]);
    const merged = [...SEEDED_MY_FOODS, ...userAdded];
    localStorage.setItem("keto_shared_my_foods", JSON.stringify(merged));
    localStorage.setItem("keto_seed_version", String(SEED_VERSION));
    sbSet("keto_shared_my_foods", merged);
  } else {
    // Just add missing and patch _unit
    const patched = existing.map(f => (seedMap[f.id] && !f._unit) ? { ...seedMap[f.id], ...f, _unit: seedMap[f.id]._unit } : f);
    const existingIds = new Set(patched.map(f => f.id));
    const toAdd = SEEDED_MY_FOODS.filter(f => !existingIds.has(f.id));
    if (toAdd.length > 0 || patched.some((f, i) => f !== existing[i])) {
      localStorage.setItem("keto_shared_my_foods", JSON.stringify([...toAdd, ...patched]));
    }
  }
} catch {}

// ── Sub-components ──────────────────────────────────────────────────────────
// ── Info tooltip system ──────────────────────────────────────────────────────
const INFO_TEXTS = {
  burnCalories: "Enter the total calories burned yesterday from your fitness device (Garmin, Apple Watch, Fitbit etc.). This is your TDEE — Total Daily Energy Expenditure — which includes both resting metabolism and all activity. Check your device's 'Calories Burned' or 'Active Calories + Resting' summary for the previous day each morning.",
  deficit: "A positive deficit means you burned more calories than you ate — your body used stored fat to make up the difference. A negative deficit means you ate more than you burned (a surplus). Over time, consistent deficits lead to fat loss. 7,700 kcal deficit ≈ 1kg of fat lost.",
  netCarbs: "Net Carbs = Total Carbs minus Fiber. Fiber is not digested and does not raise blood sugar, so it's subtracted. This is the number that matters for blood sugar and insulin response, not total carbs.",
  glycemicLoad: "Glycemic Load combines how fast a food raises blood sugar (Glycemic Index) with how much of it you actually ate. It's a more practical measure than GI alone. Low GL per meal is under 10, moderate 10-20, high over 20.",
  mgSupp: "Adjust your magnesium supplement dose based on how much magnesium you got from food today. The goal is to reach your personal daily target combining food + supplement — 420mg for men, 320mg for women (NIH RDA). Your target is shown in your mineral bar. Reduce the supplement if food sources already covered a significant portion. Magnesium supports sleep, muscle recovery and hundreds of enzymatic processes. If your doctor has prescribed a different amount, override your target in Profile Settings.",
  kSupp: "Potassium supplement tracking — for informational purposes only.\n\nHealthy humans can handle very high potassium intakes safely — traditional diets often provided 8,000mg+ daily without issues. The kidneys are extremely efficient at excreting excess potassium in healthy people.\n\n⚠️ ACE INHIBITORS (e.g. enalapril, lisinopril): these directly cause potassium retention and the risk of hyperkalemia is well documented. Avoid potassium supplements without medical approval.\n\n⚠️ ARB MEDICATION (e.g. valsartan, losartan): the potassium retention effect is milder than ACE inhibitors. Food-based potassium at normal dietary levels (2500-3500mg) is generally considered safe. The real concern is concentrated potassium supplements and salt substitutes — not whole food sources.\n\nThe most useful action is to get a serum potassium blood test periodically. If your level is in the normal range (3.5-5.0 mmol/L) on your current diet, food-based potassium is likely fine. Discuss any supplementation with your doctor.\n\nNote: Most doctors receive minimal nutrition training. If in doubt, request a serum potassium test and let the lab data guide the decision.",
  trends: "Charts show your daily averages over the selected time range. The horizontal line is your target. Average shown top-right — if it's consistently below target (red) you may need to adjust your diet or supplements. Deficit chart shows cumulative fat loss potential over time.",
  offDay: "Marking a day as Off Day excludes it from your deficit totals and trend charts. Use this for social occasions, travel or days when tracking wasn't practical. It keeps your data clean without counting zero-intake days against your averages.",
  readings: "Glucose and ketone readings give you a direct window into your metabolic health that food logging alone cannot provide.\n\n📊 WHAT THE READINGS TELL YOU\nGlucose shows how your body is responding to the food you eat. A well-controlled glucose response — no sharp spikes and slow return to baseline — indicates good insulin sensitivity and low Glycemic Load eating. Ketones show whether your body is burning fat for fuel. Even on a Mediterranean Glycemic Load diet you can maintain light to nutritional ketosis, especially if you exercise.\n\n⏰ WHEN TO MEASURE\nFasting glucose: first thing in the morning before eating — your most important baseline reading.\nPost-meal glucose: 1-2 hours after eating — shows how specific meals affect your blood sugar.\nKetones: best measured in the afternoon (morning ketones are often lower) or before bed.\nPre/post workout: interesting to see how exercise affects both readings.\n\n🎨 WHAT THE COLORS MEAN\nGlucose — Green: normal healthy range. Amber: elevated, worth noting what you ate. Red: high, look at recent food choices. Yellow: low, eat something.\nKetones — Grey: not in ketosis. Blue: light ketosis, fat burning beginning. Green: nutritional ketosis, optimal fat burning zone. Amber: deep ketosis, fine for most people. Red: very high, consult your doctor.\n\n🔗 THE TWO READINGS TOGETHER\nLow glucose + moderate ketones = ideal metabolic state for fat loss and sustained energy.\nLow glucose + low ketones = burning glucose efficiently, not yet in fat burning mode.\nHigh glucose + low ketones = too many carbs or stress response, insulin doing its job.\nNormal glucose + high ketones = extended fasting or very low carb eating.\n\nOver time, tracking both alongside your food log reveals which specific meals and habits produce your best metabolic response — that insight is more valuable than any general dietary guideline.",
  quickLogBias: "AI-based Quick Log tends to underestimate calorie intake for several reasons: it assumes modest portion sizes, cannot see the actual plate, often misses added cooking fats like olive oil, and defaults to conservative estimates when details are missing.\n\nResearch on AI food recognition suggests it typically underestimates by 15-25% compared to careful manual logging.\n\nWe recommend setting this adjustment to at least +15% as a starting point. Compare your Quick Log estimates against careful manual logging for a week, then fine-tune this slider to match your personal pattern.\n\nSetting this correctly puts you in control — the AI gives you the speed, you provide the calibration. That combination is more accurate than either alone.",
  loggingBias: "Food logging is never perfectly accurate — and that's normal. Research consistently shows people underestimate calorie intake by 20-40% on average, even when trying to be precise. Common reasons: generous pour of olive oil logged as 'one tablespoon', forgetting a handful of nuts, underestimating restaurant portions, or simply being too kind to yourself with estimates.\n\nThis Personal Accuracy Factor lets you calibrate your logs to match your actual eating patterns. If you know you tend to be generous with portions or forget snacks, set it to +10% or +15%. If you log obsessively and tend to overcount, set it to -5% or -10%.\n\nThe adjustment is applied to your total calorie and macro summaries only — individual food entries are unchanged. This affects your deficit calculations and trend averages, giving you a more realistic picture.\n\nThis is not cheating — it's honest calibration. Even professional dietitian-supervised food logs have a ±20% margin of error. The most accurate logging system is the one that reflects how you actually eat — and that honesty is what contributes to your long-term success.",
  minerals: "The four key minerals tracked here interact with each other and are commonly depleted on low-carb diets. Sodium and potassium regulate fluid balance and blood pressure. Magnesium supports over 300 enzymatic reactions including sleep and muscle function. Calcium is critical for bone density.",
  magnesiumTarget: "The magnesium target is based on the NIH Recommended Dietary Allowance (RDA): 420mg/day for men and 320mg/day for women aged 31+. Low-carb and Mediterranean diets can deplete magnesium faster as kidneys excrete more during ketosis. The upper safe limit for magnesium supplements is 350mg/day — from food there is no upper limit. Deficiency is very common, estimated at 50-70% of the general population. If your doctor or nutritionist has prescribed a different target, you can override this in your Profile Settings under 'Override Daily Targets'.",
};

function InfoButton({ topic, style }) {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ position: "relative", display: "inline-block", ...style }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ background: "#1a2a3a", border: "1px solid #7ec8e3", borderRadius: "50%", width: 18, height: 18, color: "#7ec8e3", fontSize: 10, cursor: "pointer", padding: 0, lineHeight: 1, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
        ℹ
      </button>
      {open && (
        <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", background: "#1e1e1e", border: "1px solid #3a3a3a", borderRadius: 14, padding: "16px 18px", zIndex: 1000, maxWidth: 340, width: "90vw", maxHeight: "75vh", display: "flex", flexDirection: "column", boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}>
          <div style={{ overflowY: "auto", flex: 1, fontSize: 13, color: "#d0cdc8", lineHeight: 1.7, textTransform: "none", fontWeight: 400, whiteSpace: "pre-line" }}>{INFO_TEXTS[topic]}</div>
          <button onClick={() => setOpen(false)} style={{ marginTop: 14, background: "#c9a96e", border: "none", borderRadius: 8, padding: "8px 20px", color: "#111", fontWeight: 800, fontSize: 13, cursor: "pointer", width: "100%", flexShrink: 0 }}>Got it</button>
        </div>
      )}
      {open && <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 999 }} />}
    </span>
  );
}

const MineralBar = ({ mineral, value, target, suppActive, potSuppActive, calSuppActive, arbMedication }) => {
  const over = value > target;
  const color = MINERAL_COLORS[mineral];
  const isMag = mineral === "magnesium";
  const isPot = mineral === "potassium";
  const isCal = mineral === "calcium";
  const suppVal = isMag && suppActive ? suppActive : isPot && potSuppActive ? potSuppActive : isCal && calSuppActive ? calSuppActive : 0;
  const foodPct = Math.min((value - suppVal) / target, 1);
  const suppPct = suppVal ? Math.min(suppVal / target, 1 - foodPct) : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 3 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12, color: "#ccc", textTransform: "capitalize" }}>{mineral}</span>
          {isMag && <InfoButton topic="magnesiumTarget" style={{ marginLeft: 2 }} />}
          {isMag && suppActive && <span style={{ fontSize: 9, background: "#2a1f4a", color: "#b5a4f5", borderRadius: 10, padding: "1px 6px" }}>+{suppActive}mg supp</span>}
          {isPot && potSuppActive > 0 && <span style={{ fontSize: 9, background: "#1a2a1a", color: "#7ec8a4", borderRadius: 10, padding: "1px 6px" }}>+{potSuppActive}mg supp</span>}
          {isCal && calSuppActive > 0 && <span style={{ fontSize: 9, background: "#2a1a0a", color: "#c9a96e", borderRadius: 10, padding: "1px 6px" }}>+{calSuppActive}mg supp</span>}
          {isPot && arbMedication && <span style={{ fontSize: 9, background: "#1a1a2a", color: "#7ec8e3", borderRadius: 10, padding: "1px 6px" }}>ℹ ARB med</span>}
        </div>
        <span style={{ fontSize: 12, fontFamily: "monospace", color: over ? "#ff4444" : "#aaa" }}>
          {Math.round(value)}<span style={{ color: "#555" }}>/{target}mg</span>
        </span>
      </div>
      <div style={{ height: 7, borderRadius: 4, background: "#222", overflow: "hidden", position: "relative" }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${Math.min(foodPct * 100, 100)}%`, background: over ? "#ff4444" : color, borderRadius: 4, transition: "width 0.4s ease" }} />
        {suppPct > 0 && <div style={{ position: "absolute", left: `${foodPct * 100}%`, top: 0, bottom: 0, width: `${suppPct * 100}%`, background: "#6a5acd", opacity: 0.7, borderRadius: 4 }} />}
      </div>
    </div>
  );
};

const Ring = ({ value, max, color, label, unit, size = 76, info, positiveOver }) => {
  const pct = Math.min(value / max, 1);
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const over = value > max;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#2a2a2a" strokeWidth={7} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={over ? (positiveOver ? "#7ec8a4" : "#ff4444") : color} strokeWidth={7}
          strokeDasharray={`${pct * circ} ${circ}`} strokeLinecap="round" style={{ transition: "stroke-dasharray 0.5s ease" }} />
      </svg>
      <div style={{ marginTop: -size / 2 - 3, textAlign: "center", position: "relative", zIndex: 1, lineHeight: 1.2 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: over ? (positiveOver ? "#7ec8a4" : "#ff4444") : "#f0ede8", fontFamily: "monospace" }}>{Math.round(value)}</div>
        <div style={{ fontSize: 9, color: "#777", textTransform: "uppercase", letterSpacing: 1 }}>{unit}</div>
      </div>
      <div style={{ fontSize: 10, color: "#aaa", textTransform: "uppercase", letterSpacing: 0.5, marginTop: size / 2 - 9, display: "flex", alignItems: "center", gap: 2 }}>{label}{info && <InfoButton topic={info} />}</div>
      <div style={{ fontSize: 10, color: "#555" }}>{Math.round(value)}/{max}</div>
    </div>
  );
};

const FoodCard = ({ food, onAdd, onDelete, showDelete, onEditWithAI }) => {
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState(food._unit === "each" ? "x" : food._unit === "ml" ? "ml" : "g");

  // base reference is always 100g when unit=g (food values are per-label serving by default)
  // We'll treat food values as "per 1 serving" for unit=x
  // For grams mode the label serving size is unknown so we scale from whatever the food has as 1 serving
  const scale = () => {
    const n = parseFloat(qty);
    if (!n || n <= 0) return 1;
    if (unit === "x") return n;
    // grams: food data is per 1 serving; we don't know serving weight so we just scale linearly
    return n / 100; // treat food values as per 100g
  };

  const scaled = (val) => {
    const n = parseFloat(qty);
    if (!n || n <= 0) return val;
    const s = unit === "x" ? n : n / 100;  // g and ml both scale from per-100 base
    return Math.round(val * s * 10) / 10;
  };

  const handleAdd = () => {
    const n = parseFloat(qty);
    if (!n || n <= 0) { onAdd(food); return; }
    const s = unit === "x" ? n : n / 100;  // g and ml both scale from per-100 base
    const scaledFood = {
      ...food,
      name: unit === "x" && n !== 1 ? `${food.name} ×${n}` : unit === "ml" ? `${food.name} (${n}ml)` : unit === "g" ? `${food.name} (${n}g)` : food.name,
      calories: Math.round((food.calories || 0) * s),
      fat: Math.round((food.fat || 0) * s * 10) / 10,
      protein: Math.round((food.protein || 0) * s * 10) / 10,
      carbs: Math.round((food.carbs || 0) * s * 10) / 10,
      fiber: Math.round((food.fiber || 0) * s * 10) / 10,
      sodium: Math.round((food.sodium || 0) * s),
      calcium: Math.round((food.calcium || 0) * s),
      magnesium: Math.round((food.magnesium || 0) * s),
      potassium: Math.round((food.potassium || 0) * s),
    };
    onAdd(scaledFood);
  };

  const n = parseFloat(qty);
  const hasQty = n && n > 0;

  return (
    <div style={{ background: "#1a1a1a", borderRadius: 10, marginBottom: 6, border: "1px solid #252525", overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{food.name}</div>
          <div style={{ fontSize: 11, color: "#888", marginTop: 1 }}>
            F:{hasQty ? scaled(food.fat) : food.fat}g · P:{hasQty ? scaled(food.protein) : food.protein}g · NC:{hasQty ? Math.max(0, scaled(food.carbs) - scaled(food.fiber)).toFixed(1) : Math.max(0,(food.carbs||0)-(food.fiber||0)).toFixed(1)}g
          </div>
          <div style={{ fontSize: 10, color: "#666", marginTop: 1 }}>Na:{hasQty ? scaled(food.sodium||0) : (food.sodium||0)} · Ca:{hasQty ? scaled(food.calcium||0) : (food.calcium||0)} · Mg:{hasQty ? scaled(food.magnesium||0) : (food.magnesium||0)} · K:{hasQty ? scaled(food.potassium||0) : (food.potassium||0)} mg</div>
          {food.notes && <div style={{ fontSize: 10, color: "#7ec8a4", marginTop: 3, fontStyle: "italic" }}>📝 {food.notes}</div>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 50, justifyContent: "flex-end" }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#c9a96e" }}>{hasQty ? scaled(food.calories) : food.calories}</div>
            <div style={{ fontSize: 10, color: "#666" }}>kcal</div>
          </div>
          {showDelete && (
            <button onClick={() => onDelete(food.id)} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 15, padding: 0, lineHeight: 1 }}>🗑</button>
          )}
          {showDelete && onEditWithAI && (
            <button onClick={() => onEditWithAI(food)} style={{ background: "none", border: "none", color: "#7ec8a4", cursor: "pointer", fontSize: 13, padding: 0, lineHeight: 1 }} title="Edit with AI">✏️</button>
          )}
        </div>
      </div>
      {/* Qty row */}
      <div style={{ display: "flex", gap: 6, padding: "0 10px 10px", alignItems: "center" }}>
        <input
          type="number"
          min="0"
          placeholder={unit === "x" ? (food._unit === "each" ? "how many? (e.g. 2)" : "qty (e.g. 1.5)") : unit === "ml" ? "ml (e.g. 250)" : "grams (e.g. 200)"}
          value={qty}
          onChange={e => setQty(e.target.value)}
          style={{ flex: 1, background: "#111", border: "1px solid #2a2a2a", borderRadius: 8, padding: "6px 10px", color: "#f0ede8", fontSize: 12, outline: "none" }}
        />
        <button
          onClick={() => setUnit(u => u === "x" ? "g" : "x")}
          style={{ background: "#222", border: "1px solid #333", borderRadius: 8, padding: "6px 10px", color: "#aaa", fontSize: 12, cursor: "pointer", minWidth: 44, fontWeight: 700 }}
        >{unit === "x" ? (food._unit === "each" ? "each" : "×") : unit === "ml" ? "ml" : "g"}</button>
        <button
          onClick={handleAdd}
          style={{ background: "#c9a96e", border: "none", borderRadius: 8, padding: "6px 12px", color: "#111", fontSize: 12, fontWeight: 800, cursor: "pointer" }}
        >+ Add</button>
      </div>
    </div>
  );
};

// ── Mini bar chart component ────────────────────────────────────────────────
const MiniChart = ({ data, color, target, label }) => {
  if (!data || !data.length) return null;
  const CHART_H = 60;
  const DATE_H = 20;
  const max = Math.max(...data.map(d => Math.abs(d.value || 0)), target || 1) * 1.1;
  const w = Math.max(14, Math.min(28, Math.floor(300 / data.length)));
  const targetPct = target ? Math.min(target / max, 1) : null;
  const targetY = targetPct ? Math.round((1 - targetPct) * CHART_H) : null;
  const avg = data.length ? Math.round(data.reduce((a, d) => a + (d.value || 0), 0) / data.length) : 0;
  const avgColor = target ? (avg < target * 0.8 ? "#ff6b6b" : avg > target * 1.2 ? "#ff4444" : "#7ec8a4") : "#aaa";
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: "#aaa" }}>{label}</span>
        <div style={{ display: "flex", gap: 10 }}>
          <span style={{ fontSize: 10, color: avgColor, fontFamily: "monospace", fontWeight: 700 }}>avg: {avg}</span>
          {target && <span style={{ fontSize: 10, color: "#555" }}>target: {target}</span>}
        </div>
      </div>
      {/* Date labels row above bars */}
      <div style={{ display: "flex", gap: 2, marginBottom: 2, overflowX: "auto" }}>
        {data.map((d, i) => (
          <div key={i} style={{ minWidth: w, flex: "0 0 auto", textAlign: "center", fontSize: 7, color: "#555", lineHeight: 1 }}>{d.date}</div>
        ))}
      </div>
      {/* Bar chart with target line */}
      <div style={{ position: "relative", height: CHART_H, overflowX: "auto" }}>
        {targetY !== null && (
          <div style={{ position: "absolute", left: 0, right: 0, top: targetY, height: 1, background: "#555", zIndex: 2, pointerEvents: "none" }}>
            <span style={{ position: "absolute", right: 2, top: -8, fontSize: 8, color: "#555" }}>{target}</span>
          </div>
        )}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: "100%" }}>
          {data.map((d, i) => {
            const val = d.value || 0;
            const pct = Math.min(Math.abs(val) / max, 1);
            return (
              <div key={i} title={`${d.date}: ${Math.round(val)}`} style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: w, flex: "0 0 auto", height: "100%" }}>
                <div style={{ width: w - 2, height: Math.max(2, Math.round(pct * CHART_H)), background: color, borderRadius: "2px 2px 0 0", marginTop: "auto" }} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ── Trends view component ────────────────────────────────────────────────────
const TrendsView = ({ history, entries, eatenOverride, burnLog, magSupp, userId, offDays, MINERAL_TARGETS, KETO_TARGETS, s }) => {
  const [trendView, setTrendView] = useState("deficit");

  const allKeys = Object.keys(history).sort();
  const trendData = allKeys.map(key => {
    const ents = key === todayKey() ? entries : (history[key] || []);
    const eaten = eatenOverride[key] ?? ents.reduce((a, e) => a + (e.calories || 0), 0);
    const burn = burnLog[key] || null;
    const fat = ents.reduce((a, e) => a + (e.fat || 0), 0);
    const protein = ents.reduce((a, e) => a + (e.protein || 0), 0);
    const nc = Math.max(0, ents.reduce((a, e) => a + (e.carbs || 0), 0) - ents.reduce((a, e) => a + (e.fiber || 0), 0));
    const sodium = ents.reduce((a, e) => a + (e.sodium || 0), 0);
    const magFromFood = ents.reduce((a, e) => a + (e.magnesium || 0), 0);
    // Get the supplement value for this day from localStorage
    const dayMagSupp = (() => { try { const v = localStorage.getItem(`keto_${userId}_mag_supp`); return v ? (JSON.parse(v) === true ? 400 : JSON.parse(v) === false ? 0 : Number(JSON.parse(v))) : (magSupp || 0); } catch { return magSupp || 0; } })();
    const magnesium = magFromFood + dayMagSupp;
    const potassium = ents.reduce((a, e) => a + (e.potassium || 0), 0);
    const calcium = ents.reduce((a, e) => a + (e.calcium || 0), 0);
    const def = burn ? burn - eaten : null;
    return { key, date: formatDate(key), eaten, burn, def, fat, protein, nc, sodium, magnesium, potassium, calcium };
  }).filter(d => d.eaten > 0 && !(offDays && offDays[d.key]));

  const cumDef = trendData.reduce((a, d) => a + (d.def || 0), 0);
  const avgEaten = Math.round(trendData.reduce((a, d) => a + d.eaten, 0) / Math.max(trendData.length, 1));

  const [trendRange, setTrendRange] = useState(30);
  const ranges = [7, 30, 90, "All"];

  const visibleData = trendRange === "All" ? trendData : trendData.slice(-trendRange);

  const views = [
    { id: "deficit", label: "Deficit" },
    { id: "macros", label: "Macros" },
    { id: "minerals", label: "Minerals" },
  ];

  return (
    <div style={s.section}>
      <div style={{ ...s.card, margin: "0 0 10px" }}>
        <div style={{ ...s.cardLabel, display: 'flex', alignItems: 'center', gap: 6 }}>All-time Summary ({trendData.length} days tracked) <InfoButton topic="trends" /></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div style={{ background: "#111", borderRadius: 8, padding: "8px 12px" }}>
            <div style={{ fontSize: 10, color: "#666" }}>Total deficit</div>
            <div style={{ fontSize: 18, fontWeight: 800, fontFamily: "monospace", color: cumDef >= 0 ? "#7ec8a4" : "#ff6b6b" }}>{cumDef >= 0 ? "+" : ""}{Math.round(cumDef)}</div>
            <div style={{ fontSize: 10, color: "#555" }}>≈ {(cumDef / 7700).toFixed(2)} kg fat</div>
          </div>
          <div style={{ background: "#111", borderRadius: 8, padding: "8px 12px" }}>
            <div style={{ fontSize: 10, color: "#666" }}>Avg daily eaten</div>
            <div style={{ fontSize: 18, fontWeight: 800, fontFamily: "monospace", color: "#c9a96e" }}>{avgEaten}</div>
            <div style={{ fontSize: 10, color: "#555" }}>kcal/day</div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        {views.map(v => (
          <button key={v.id} style={s.subTab(trendView === v.id)} onClick={() => setTrendView(v.id)}>{v.label}</button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
        {ranges.map(r => (
          <button key={r} onClick={() => setTrendRange(r)}
            style={{ flex: 1, padding: "5px 0", borderRadius: 8, border: `1px solid ${trendRange === r ? "#c9a96e" : "#2a2a2a"}`, background: trendRange === r ? "#2a1e0a" : "transparent", color: trendRange === r ? "#c9a96e" : "#555", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
            {r === "All" ? "All" : `${r}d`}
          </button>
        ))}
      </div>

      {trendView === "deficit" && (
        <div style={{ ...s.card, margin: "0" }}>
          <MiniChart data={visibleData.filter(d => d.def !== null).map(d => ({ date: d.date, value: d.def }))} color="#7ec8a4" label="Daily Deficit (kcal)" />
          <MiniChart data={visibleData.map(d => ({ date: d.date, value: d.eaten }))} color="#c9a96e" label="Calories Eaten" />
        </div>
      )}

      {trendView === "macros" && (
        <div style={{ ...s.card, margin: "0" }}>
          <MiniChart data={visibleData.map(d => ({ date: d.date, value: d.fat }))} color="#c9a96e" target={KETO_TARGETS.fat} label="Fat (g)" />
          <MiniChart data={visibleData.map(d => ({ date: d.date, value: d.protein }))} color="#7ec8e3" target={KETO_TARGETS.protein} label="Protein (g)" />
          <MiniChart data={visibleData.map(d => ({ date: d.date, value: d.nc }))} color="#f4d06f" target={KETO_TARGETS.carbs} label="Net Carbs (g)" />
        </div>
      )}

      {trendView === "minerals" && (
        <div style={{ ...s.card, margin: "0" }}>
          <MiniChart data={visibleData.map(d => ({ date: d.date, value: d.sodium }))} color={MINERAL_COLORS.sodium} target={MINERAL_TARGETS.sodium} label="Sodium (mg)" />
          <MiniChart data={visibleData.map(d => ({ date: d.date, value: d.calcium }))} color={MINERAL_COLORS.calcium} target={MINERAL_TARGETS.calcium} label="Calcium (mg)" />
          <MiniChart data={visibleData.map(d => ({ date: d.date, value: d.magnesium }))} color={MINERAL_COLORS.magnesium} target={MINERAL_TARGETS.magnesium} label="Magnesium (mg)" />
          <MiniChart data={visibleData.map(d => ({ date: d.date, value: d.potassium }))} color={MINERAL_COLORS.potassium} target={MINERAL_TARGETS.potassium} label="Potassium (mg)" />
        </div>
      )}
    </div>
  );
};

// ── Per-user tracker ─────────────────────────────────────────────────────────
function UserTracker({ userId, profile, profiles }) {
  const [entries, setEntries] = useState([]);
  const [search, setSearch] = useState("");
  const [myFoodsSearch, setMyFoodsSearch] = useState("");
  const [tab, setTab] = useState("log");
  const [addSubTab, setAddSubTab] = useState("foods");
  const [history, setHistory] = useState({});
  const [burnLog, setBurnLog] = useState({});
  const [burnDraft, setBurnDraft] = useState("");
  const [burnEditDay, setBurnEditDay] = useState("");
  const [eatenOverride, setEatenOverride] = useState({});
  const [eatenEditDay, setEatenEditDay] = useState("");
  const [suppEditDay, setSuppEditDay] = useState("");
  const [magSupp, setMagSupp] = useState(400); // mg of magnesium supplement
  const [potSupp, setPotSupp] = useState(0); // mg of potassium supplement (cream of tartar)
  const [calSupp, setCalSupp] = useState(0); // mg of calcium supplement
  const [suppLog, setSuppLog] = useState({}); // { "YYYY-MM-DD": { mag: 400, pot: 0 } }
  const [myFoods, setMyFoods] = useState([]);
  const [expandedEntry, setExpandedEntry] = useState(null);
  const [expandedHistoryDay, setExpandedHistoryDay] = useState(null);
  const [selectedEntries, setSelectedEntries] = useState({});
  const [copySuccess, setCopySuccess] = useState(false);
  const [showDataModal, setShowDataModal] = useState(null);
  const [exportText, setExportText] = useState("");
  const [importText, setImportText] = useState("");
  const [offDays, setOffDays] = useState({});

  const [analyzeMode, setAnalyzeMode] = useState(false);
  const [analyzeText, setAnalyzeText] = useState("");
  const [analyzeImage, setAnalyzeImage] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeResult, setAnalyzeResult] = useState(null);
  const [analyzeError, setAnalyzeError] = useState("");
  const [analyzeNote, setAnalyzeNote] = useState("");
  const [savingToMyFoods, setSavingToMyFoods] = useState(false);
  const fileInputRef = useRef();

  // Quick Log state
  const [quickLogText, setQuickLogText] = useState("");
  const [quickLogging, setQuickLogging] = useState(false);
  const [quickLogResults, setQuickLogResults] = useState(null);
  const [quickLogError, setQuickLogError] = useState("");
  const [quickLogMode, setQuickLogMode] = useState("casual");

  // Readings state
  const [readings, setReadings] = useState([]);
  const [readingsHistory, setReadingsHistory] = useState({});
  const [readingForm, setReadingForm] = useState({ glucose: "", ketone: "", bpSystolic: "", bpDiastolic: "", note: "" });

  // Load on userId change — Supabase first, localStorage as fallback
  useEffect(() => {
    (async () => {
      // Try Supabase first
      const [hist, bl, eo, sl, od, rh, ms2, ps2, cs2, mf2, todayEntries] = await Promise.all([
        syncFromCloud("history", userId),
        syncFromCloud("burn_log", userId),
        syncFromCloud("eaten_override", userId),
        syncFromCloud("supp_log", userId),
        syncFromCloud("off_days", userId),
        syncFromCloud("readings_history", userId),
        syncFromCloud("mag_supp", userId),
        syncFromCloud("pot_supp", userId),
        syncFromCloud("cal_supp", userId),
        sbGet("keto_shared_my_foods"),
        syncFromCloud("entries_" + todayKey(), userId),
      ]);

      // Set from cloud or fall back to localStorage
      const history = hist || lsGet("history", userId) || {};
      setHistory(history);
      setBurnLog(bl || lsGet("burn_log", userId) || {});
      setEatenOverride(eo || lsGet("eaten_override", userId) || {});
      setSuppLog(sl || lsGet("supp_log", userId) || {});
      setOffDays(od || lsGet("off_days", userId) || {});
      const readHist = rh || lsGet("readings_history", userId) || {};
      setReadingsHistory(readHist);
      setReadings(readHist[todayKey()] || []);

      const ms = ms2 ?? lsGet("mag_supp", userId);
      setMagSupp(ms !== null ? (ms === true ? 400 : ms === false ? 0 : Number(ms)) : (profile?.defaultMagSupp ?? 400));
      const ps = ps2 ?? lsGet("pot_supp", userId);
      setPotSupp(ps !== null ? Math.max(0, Number(ps)) : (profile?.defaultPotSupp ?? 0));
      const cs = cs2 ?? lsGet("cal_supp", userId);
      setCalSupp(cs !== null ? Math.max(0, Number(cs)) : (profile?.defaultCalSupp ?? 0));

      // Today's entries — prefer cloud, fall back to history[today], then localStorage
      const todayFromHistory = history[todayKey()] || [];
      const savedEntries = todayEntries || todayFromHistory || lsGet("entries_" + todayKey(), userId) || [];
      setEntries(savedEntries);

      // My Foods
      if (mf2 !== null) {
        try { localStorage.setItem("keto_shared_my_foods", JSON.stringify(mf2)); } catch {}
        setMyFoods(mf2);
      } else {
        try { const mf = localStorage.getItem("keto_shared_my_foods"); setMyFoods(mf ? JSON.parse(mf) : []); } catch { setMyFoods([]); }
      }
      setDataLoaded(true);
      dataLoadedRef.current = true;
    })();
  }, [userId]);

  const [dataLoaded, setDataLoaded] = useState(false);
  const dataLoadedRef = useRef(false);
  useEffect(() => {
    if (!dataLoadedRef.current) return;
    lsSet("entries_" + todayKey(), userId, entries);
    setHistory(prev => {
      const hist = { ...prev, [todayKey()]: entries };
      lsSet("history", userId, hist);
      return hist;
    });
  }, [entries, userId]);

  useEffect(() => { lsSet("burn_log", userId, burnLog); }, [burnLog, userId]);
  useEffect(() => { lsSet("eaten_override", userId, eatenOverride); }, [eatenOverride, userId]);
  useEffect(() => {
    lsSet("mag_supp", userId, magSupp);
    // Read potSupp from storage to avoid stale closure
    setSuppLog(prev => {
      const savedPot = lsGet("pot_supp", userId);
      const currentPot = savedPot !== null ? Math.max(0, Number(savedPot)) : 0;
      const updated = { ...prev, [todayKey()]: { mag: magSupp, pot: currentPot } };
      lsSet("supp_log", userId, updated);
      return updated;
    });
  }, [magSupp, userId]);
  useEffect(() => {
    lsSet("cal_supp", userId, calSupp);
    sbSet(`keto_${userId}_cal_supp`, calSupp);
  }, [calSupp, userId]);
  useEffect(() => {
    lsSet("pot_supp", userId, potSupp);
    // Read magSupp from storage to avoid stale closure
    setSuppLog(prev => {
      const savedMag = lsGet("mag_supp", userId);
      const currentMag = savedMag !== null ? Number(savedMag) : 0;
      const updated = { ...prev, [todayKey()]: { mag: currentMag, pot: potSupp } };
      lsSet("supp_log", userId, updated);
      return updated;
    });
  }, [potSupp, userId]);
  useEffect(() => { lsSet("off_days", userId, offDays); }, [offDays, userId]);
  useEffect(() => {
    const rh = lsGet("readings_history", userId) || {};
    rh[todayKey()] = readings;
    lsSet("readings_history", userId, rh);
    setReadingsHistory(rh);
  }, [readings, userId]);
  // My Foods saved to shared key so both profiles see the same list
  useEffect(() => { try { localStorage.setItem("keto_shared_my_foods", JSON.stringify(myFoods)); } catch {} sbSet("keto_shared_my_foods", myFoods); }, [myFoods]);

  const rawTotals = entries.reduce((acc, e) => ({
    calories: acc.calories + (e.calories || 0), fat: acc.fat + (e.fat || 0),
    protein: acc.protein + (e.protein || 0), carbs: acc.carbs + (e.carbs || 0),
    fiber: acc.fiber + (e.fiber || 0), sodium: acc.sodium + (e.sodium || 0),
    calcium: acc.calcium + (e.calcium || 0), magnesium: acc.magnesium + (e.magnesium || 0),
    potassium: acc.potassium + (e.potassium || 0),
  }), { calories: 0, fat: 0, protein: 0, carbs: 0, fiber: 0, sodium: 0, calcium: 0, magnesium: 0, potassium: 0 });

  // Apply personal accuracy factor (logging bias)
  const biasFactor = 1 + ((profile?.loggingBias ?? 0) / 100);
  const totals = {
    calories: Math.round(rawTotals.calories * biasFactor),
    fat: Math.round(rawTotals.fat * biasFactor * 10) / 10,
    protein: Math.round(rawTotals.protein * biasFactor * 10) / 10,
    carbs: Math.round(rawTotals.carbs * biasFactor * 10) / 10,
    fiber: Math.round(rawTotals.fiber * biasFactor * 10) / 10,
    sodium: Math.round(rawTotals.sodium * biasFactor),
    calcium: Math.round(rawTotals.calcium * biasFactor),
    magnesium: Math.round(rawTotals.magnesium * biasFactor),
    potassium: Math.round(rawTotals.potassium * biasFactor),
  };
  const biasActive = (profile?.loggingBias ?? 0) !== 0;

  const MINERAL_TARGETS = profile ? calcMineralTargets(profile) : { sodium: 2300, calcium: 2000, magnesium: 420, potassium: 3500 };
  const USER_KETO_TARGETS = profile ? calcTargets(profile) : { fat: 123, protein: 142, carbs: 80, fiber: 10 };
  const mineralTotals = {
    sodium: totals.sodium, calcium: totals.calcium,
    magnesium: totals.magnesium + (magSupp || 0),
    potassium: totals.potassium + (potSupp || 0),
    calcium: totals.calcium + (calSupp || 0),
  };

  const netCarbs = Math.max(0, totals.carbs - totals.fiber);
  const yesterdayBurn = burnLog[yesterdayKey()] || null;

  const addFood = (food) => {
    setEntries(prev => [...prev, { ...food, id: Date.now() + Math.random() }]);
    setSearch(""); setMyFoodsSearch(""); setTab("log");
  };
  const removeEntry = (id) => setEntries(prev => prev.filter(e => e.id !== id));

  const saveBurn = (key, val) => {
    const n = parseInt(val);
    if (!isNaN(n) && n > 0) setBurnLog(prev => ({ ...prev, [key]: n }));
    setBurnDraft(""); setBurnEditDay("");
  };

  const saveToMyFoods = (food, notes) => {
    const { id, ...clean } = food;
    const newFood = { ...clean, id: "mf_" + Date.now(), notes: notes || "" };
    setMyFoods(prev => [newFood, ...prev]);
    setSavingToMyFoods(true);
    setTimeout(() => setSavingToMyFoods(false), 1500);
  };
  const deleteMyFood = (id) => setMyFoods(prev => prev.filter(f => f.id !== id));

  const copySelectedToOther = () => {
    const otherProfile = profiles?.find(p => p.id !== userId);
    const otherUserId = otherProfile?.id || (userId === "me" ? "wife" : "me");
    const otherKey = "keto_" + otherUserId + "_entries_" + todayKey();
    const selected = entries.filter(e => selectedEntries[e.id]);
    if (!selected.length) return;
    try {
      const existing = JSON.parse(localStorage.getItem(otherKey) || "[]");
      const newEntries = selected.map(e => ({ ...e, id: "copied_" + Date.now() + Math.random() }));
      localStorage.setItem(otherKey, JSON.stringify([...existing, ...newEntries]));
      // Also update other user's history
      const otherHist = JSON.parse(localStorage.getItem("keto_" + otherUserId + "_history") || "{}");
      otherHist[todayKey()] = [...existing, ...newEntries];
      localStorage.setItem("keto_" + otherUserId + "_history", JSON.stringify(otherHist));
      setSelectedEntries({});
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (e) { alert("Copy failed: " + e.message); }
  };

  const addReading = () => {
    const unit = profile?.glucoseUnit ?? "mmol";
    const fromInput = (v) => unit === "mgdl" ? parseFloat(v) / 18 : parseFloat(v);
    const g = readingForm.glucose ? fromInput(readingForm.glucose) : null;
    const k = readingForm.ketone ? parseFloat(readingForm.ketone) : null;
    const sys = readingForm.bpSystolic ? parseInt(readingForm.bpSystolic) : null;
    const dia = readingForm.bpDiastolic ? parseInt(readingForm.bpDiastolic) : null;
    if (!g && !k && !sys) return;
    const newReading = {
      id: Date.now(),
      time: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
      glucose: g,
      ketone: k,
      bpSystolic: sys,
      bpDiastolic: dia,
      note: readingForm.note,
    };
    setReadings(prev => [...prev, newReading]);
    setReadingForm({ glucose: "", ketone: "", bpSystolic: "", bpDiastolic: "", note: "" });
  };

  // Export all user data as downloadable JSON file
  const exportData = () => {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith("keto_")) {
        data[key] = localStorage.getItem(key);
      }
    }
    const json = JSON.stringify(data, null, 2);
    setExportText(json);
    // Try to trigger file download
    try {
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `NutritionTracker_backup_${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Fallback to showing text
    }
    setShowDataModal("export");
  };

  const importData = (json) => {
    try {
      const data = JSON.parse(json);
      Object.entries(data).forEach(([key, value]) => {
        localStorage.setItem(key, value);
      });
      setShowDataModal(null);
      window.location.reload();
    } catch {
      alert("Invalid data — please paste the exact exported text");
    }
  };

  const editFoodWithAI = (food) => {
    setTab("add");
    setAddSubTab("ai");
    setAnalyzeMode("text");
    const baseDesc = food.notes ? food.notes.replace(/User described: /g, "").split(" | ")[1] || food.notes.split(" | ")[0] : food.name;
    setAnalyzeText(baseDesc + " — update this description with any changes");
    setAnalyzeResult(null);
    setAnalyzeError("");
  };

  const handleImageFile = (file) => {
    if (!file) return;
    const canvas = document.createElement("canvas");
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      // Resize to max 1024px on longest side
      const MAX = 1024;
      let { width, height } = img;
      if (width > height && width > MAX) { height = Math.round(height * MAX / width); width = MAX; }
      else if (height > width && height > MAX) { width = Math.round(width * MAX / height); height = MAX; }
      else if (width > MAX) { height = Math.round(height * MAX / width); width = MAX; }
      canvas.width = width; canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      URL.revokeObjectURL(objectUrl);
      setAnalyzeImage({ base64: dataUrl.split(",")[1], mediaType: "image/jpeg", preview: dataUrl });
    };
    img.src = objectUrl;
  };

  const runAnalysis = async () => {
    setAnalyzing(true); setAnalyzeError(""); setAnalyzeResult(null); setAnalyzeNote("");
    try {
      // Build message content — include image if present
      let userContent;
      if (analyzeImage) {
        userContent = [
          { type: "image", source: { type: "base64", media_type: analyzeImage.mediaType, data: analyzeImage.base64 } },
          { type: "text", text: analyzeText || "What food is this? Analyze its nutritional content." }
        ];
      } else {
        userContent = analyzeText;
      }
      const resp = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1000, system: ANALYZE_PROMPT, messages: [{ role: "user", content: userContent }] }),
      });
      const data = await resp.json();
      if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
      const text = data.content.map(b => b.text || "").join("").replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(text);
      setAnalyzeNote(parsed.note || "");
      const { note, servings, ...food } = parsed;
      const userDesc = analyzeText ? `User described: ${analyzeText}` : "";
      const fullNote = [note, userDesc].filter(Boolean).join(" | ");
      setAnalyzeNote(fullNote);
      setAnalyzeResult({ ...food, _unit: parsed.unit || "g" });
    } catch (err) {
      setAnalyzeError("Couldn't analyze — " + (err.message || "try describing it in more detail."));
    }
    setAnalyzing(false);
  };

  const resetAnalyze = () => {
    setAnalyzeMode(false); setAnalyzeText(""); setAnalyzeImage(null);
    setAnalyzeResult(null); setAnalyzeError(""); setAnalyzeNote("");
  };

  const runQuickLog = async () => {
    setQuickLogging(true); setQuickLogError(""); setQuickLogResults(null);
    try {
      const resp = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6", max_tokens: 2000,
          system: QUICK_LOG_PROMPT,
          messages: [{ role: "user", content: quickLogText }]
        }),
      });
      const data = await resp.json();
      if (data.error) throw new Error(data.error.message);
      const rawText = data.content.map(b => b.text || "").join("");
      console.log("Quick Log API response:", rawText.substring(0, 500));
      // Extract JSON array from response - handle various formats including markdown
      const cleaned = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
      const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.error("Full response:", rawText);
        throw new Error("No JSON array found in response");
      }
      const parsed = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("Empty result");
      setQuickLogResults(parsed);
    } catch (e) {
      setQuickLogError(`Analysis failed: ${e.message}. Try again or break it into smaller descriptions.`);
    }
    setQuickLogging(false);
  };

  const addAllQuickLog = (items, mode) => {
    const useAdj = (mode || quickLogMode) === "casual";
    const bias = useAdj ? 1 + ((profile?.quickLogBias ?? 15) / 100) : 1;
    const newEntries = items.map(item => ({
      ...item,
      id: "ql_" + Date.now() + Math.random(),
      calories: Math.round((item.calories || 0) * bias),
      fat: Math.round((item.fat || 0) * bias * 10) / 10,
      protein: Math.round((item.protein || 0) * bias * 10) / 10,
      carbs: Math.round((item.carbs || 0) * bias * 10) / 10,
      fiber: Math.round((item.fiber || 0) * bias * 10) / 10,
      sodium: Math.round((item.sodium || 0) * bias),
      calcium: Math.round((item.calcium || 0) * bias),
      magnesium: Math.round((item.magnesium || 0) * bias),
      potassium: Math.round((item.potassium || 0) * bias),
      name: useAdj ? item.name + " (est)" : item.name,
    }));
    setEntries(prev => [...prev, ...newEntries]);
    setQuickLogResults(null);
    setQuickLogText("");
    setTab("log");
  };

  const saveEaten = (key, val) => {
    const n = parseInt(val);
    if (!isNaN(n) && n > 0) setEatenOverride(prev => ({ ...prev, [key]: n }));
    setEatenEditDay("");
  };

  const [exportDone, setExportDone] = useState(false);
  const filteredPresets = PRESET_FOODS.filter(f => f.name.toLowerCase().includes(search.toLowerCase()));
  const filteredMyFoods = myFoods.filter(f => f.name.toLowerCase().includes(myFoodsSearch.toLowerCase()));

  const last7Keys = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split("T")[0];
  });
  const last7 = last7Keys.map(key => {
    const ents = key === todayKey() ? entries : (history[key] || []);
    const trackedEaten = ents.reduce((a, e) => a + (e.calories || 0), 0);
    const eaten = eatenOverride[key] ?? trackedEaten;
    const nc = Math.max(0, ents.reduce((a, e) => a + (e.carbs || 0), 0) - ents.reduce((a, e) => a + (e.fiber || 0), 0));
    const burn = burnLog[key] || null;
    const isOff = offDays[key];
    return { key, date: formatDate(key), eaten, nc, burn, def: (!isOff && burn) ? burn - eaten : null, isToday: key === todayKey(), hasOverride: eatenOverride[key] != null, isOff };
  });
  const totalDeficit = last7.reduce((a, d) => d.def ? a + d.def : a, 0);

  const s = {
    card: { margin: "12px 16px 0", background: "#1a1a1a", borderRadius: 16, padding: "14px 18px", border: "1px solid #2a2a2a" },
    cardLabel: { fontSize: 11, color: "#888", letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 },
    tabs: { display: "flex", gap: 8, padding: "14px 16px 0" },
    tabBtn: (a) => ({ flex: 1, padding: "8px 0", borderRadius: 10, border: "none", background: a ? "#c9a96e" : "#1e1e1e", color: a ? "#111" : "#888", fontWeight: 700, fontSize: 12, cursor: "pointer" }),
    subTab: (a) => ({ flex: 1, padding: "6px 0", borderRadius: 8, border: `1px solid ${a ? "#c9a96e" : "#2a2a2a"}`, background: a ? "#2a1e0a" : "transparent", color: a ? "#c9a96e" : "#666", fontWeight: 600, fontSize: 12, cursor: "pointer" }),
    section: { padding: "12px 16px 0" },
    input: { width: "100%", background: "#1e1e1e", border: "1px solid #333", borderRadius: 10, padding: "10px 14px", color: "#f0ede8", fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 8 },
    btn: (bg, fg) => ({ background: bg || "#c9a96e", border: "none", borderRadius: 10, padding: "10px 18px", color: fg || (bg ? "#fff" : "#111"), fontWeight: 800, fontSize: 13, cursor: "pointer" }),
    entryRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 14px", background: "#1a1a1a", borderRadius: 10, marginBottom: 5, border: "1px solid #222" },
    bar: { height: 5, borderRadius: 3, background: "#2a2a2a", overflow: "hidden", marginTop: 8 },
    barFill: (pct, color) => ({ height: "100%", width: `${Math.min(pct * 100, 100)}%`, background: pct > 1 ? "#ff4444" : color, borderRadius: 3, transition: "width 0.4s ease" }),
    bigNum: (color) => ({ fontSize: 30, fontWeight: 800, fontFamily: "monospace", color: color || "#c9a96e" }),
  };

  return (
    <div>
      {/* Yesterday's burn prompt */}
      {!yesterdayBurn && (
        <div style={{ margin: "12px 16px 0", background: "#1a1400", border: "1px solid #3a2e00", borderRadius: 14, padding: "12px 16px" }}>
          <div style={{ fontSize: 11, color: "#c9a96e", letterSpacing: 1, textTransform: "uppercase", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>🔥 Log Yesterday's Burn <InfoButton topic="burnCalories" /></div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="number"
              placeholder="e.g. 2200 kcal"
              value={burnDraft}
              onChange={e => setBurnDraft(e.target.value)}
              style={{ ...s.input, marginBottom: 0, flex: 1 }}
            />
            <button onClick={() => saveBurn(yesterdayKey(), burnDraft)} style={s.btn()}>Save</button>
          </div>
        </div>
      )}
      {yesterdayBurn && (
        <div style={{ margin: "12px 16px 0", background: "#0f1a0f", border: "1px solid #1a3a1a", borderRadius: 14, padding: "10px 16px" }}>
          {burnEditDay === yesterdayKey() ? (
            <div>
              <div style={{ fontSize: 11, color: "#7ec8a4", letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>🔥 Edit Yesterday's Burn</div>
              <div style={{ display: "flex", gap: 8 }}>
                <input type="number" placeholder={String(yesterdayBurn)} value={burnDraft} onChange={e => setBurnDraft(e.target.value)}
                  style={{ ...s.input, marginBottom: 0, flex: 1 }} />
                <button onClick={() => saveBurn(yesterdayKey(), burnDraft)} style={s.btn()}>✓</button>
                <button onClick={() => { setBurnEditDay(""); setBurnDraft(""); }} style={{ ...s.btn("#222", "#888") }}>✕</button>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 11, color: "#7ec8a4", letterSpacing: 1, textTransform: "uppercase" }}>🔥 Yesterday's Burn</div>
                <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "monospace", color: "#7ec8a4", marginTop: 2 }}>{yesterdayBurn} kcal</div>
              </div>
              <button onClick={() => { setBurnEditDay(yesterdayKey()); setBurnDraft(String(yesterdayBurn)); }} style={{ ...s.btn("#1a2a1a", "#7ec8a4"), fontSize: 11, padding: "6px 12px", border: "1px solid #2a4a2a" }}>Edit</button>
            </div>
          )}
        </div>
      )}

      {/* Energy card */}
      <div style={s.card}>
        <div style={s.cardLabel}>Today's Energy</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, textAlign: "center" }}>
          <div>
            <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>Eaten</div>
            <div style={{ ...s.bigNum(), fontSize: 24 }}>{Math.round(totals.calories)}</div>
            <div style={{ fontSize: 10, color: "#666" }}>kcal</div>
            {biasActive && <div style={{ fontSize: 9, color: "#c9a96e", marginTop: 2 }}>±{profile.loggingBias}% adj</div>}
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>Yesterday burned</div>
            {yesterdayBurn
              ? <><div style={{ ...s.bigNum("#7ec8a4"), fontSize: 24 }}>{yesterdayBurn}</div><div style={{ fontSize: 10, color: "#666" }}>kcal</div></>
              : <div style={{ fontSize: 11, color: "#555", marginTop: 6 }}>—</div>}
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#888", marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>Yesterday deficit <InfoButton topic="deficit" /></div>
            {yesterdayBurn ? (() => {
              const yTracked = (history[yesterdayKey()] || []).reduce((a, e) => a + (e.calories || 0), 0);
              const yEaten = eatenOverride[yesterdayKey()] ?? yTracked;
              const yDef = yesterdayBurn - yEaten;
              return <><div style={{ ...s.bigNum(yDef >= 0 ? "#7ec8a4" : "#ff6b6b"), fontSize: 24 }}>{yDef >= 0 ? "+" : ""}{Math.round(yDef)}</div><div style={{ fontSize: 10, color: "#666" }}>kcal</div></>;
            })() : <div style={{ fontSize: 11, color: "#555", marginTop: 6 }}>—</div>}
          </div>
        </div>
      </div>

      {/* Macros rings */}
      <div style={{ display: "flex", justifyContent: "space-around", padding: "18px 10px", background: "#161616", margin: "12px 0 0", borderTop: "1px solid #222", borderBottom: "1px solid #222" }}>
        <Ring value={totals.fat} max={USER_KETO_TARGETS.fat} color="#c9a96e" label="Fat" unit="g" />
        <Ring value={totals.protein} max={USER_KETO_TARGETS.protein} color="#7ec8e3" label="Protein" unit="g" />
        <Ring value={netCarbs} max={USER_KETO_TARGETS.carbs} color="#f4d06f" label="Net Carbs" unit="g" info="netCarbs" />
        <Ring value={totals.fiber} max={USER_KETO_TARGETS.fiber} color="#7ec8a4" label="Fiber" unit="g" positiveOver={true} />
      </div>

      {/* Minerals */}
      <div style={s.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ ...s.cardLabel, display: "flex", alignItems: "center", gap: 6 }}>Minerals <InfoButton topic="minerals" /></div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 10, color: magSupp ? "#b5a4f5" : "#555", fontWeight: 600, minWidth: 42, display: "flex", alignItems: "center", gap: 3 }}>Mg Supp <InfoButton topic="mgSupp" /></span>
              <button onClick={() => setMagSupp(p => Math.max(0, p - 50))} style={{ background: "#1e1e1e", border: "1px solid #333", borderRadius: 6, width: 22, height: 22, color: "#aaa", fontSize: 14, cursor: "pointer", lineHeight: 1, padding: 0 }}>−</button>
              <span style={{ fontSize: 11, fontFamily: "monospace", color: magSupp ? "#b5a4f5" : "#555", minWidth: 40, textAlign: "center", fontWeight: 700 }}>{magSupp ? `${magSupp}mg` : "OFF"}</span>
              <button onClick={() => setMagSupp(p => Math.min(400, p + 50))} style={{ background: "#1e1e1e", border: "1px solid #333", borderRadius: 6, width: 22, height: 22, color: "#aaa", fontSize: 14, cursor: "pointer", lineHeight: 1, padding: 0 }}>+</button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 10, color: potSupp > 0 ? "#7ec8a4" : "#555", fontWeight: 600, minWidth: 42, display: "flex", alignItems: "center", gap: 3 }}>K Supp <InfoButton topic="kSupp" /></span>
              <button onClick={() => setPotSupp(p => Math.max(0, p - 100))} style={{ background: "#1e1e1e", border: "1px solid #333", borderRadius: 6, width: 22, height: 22, color: "#aaa", fontSize: 14, cursor: "pointer", lineHeight: 1, padding: 0 }}>−</button>
              <span style={{ fontSize: 11, fontFamily: "monospace", color: (potSupp > 0) ? "#7ec8a4" : "#555", minWidth: 40, textAlign: "center", fontWeight: 700 }}>{(potSupp > 0) ? `${potSupp}mg` : "OFF"}</span>
              <button onClick={() => setPotSupp(p => Math.min(1000, p + 100))} style={{ background: "#1e1e1e", border: "1px solid #333", borderRadius: 6, width: 22, height: 22, color: "#aaa", fontSize: 14, cursor: "pointer", lineHeight: 1, padding: 0 }}>+</button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 10, color: calSupp > 0 ? "#c9a96e" : "#555", fontWeight: 600, minWidth: 42 }}>Ca Supp</span>
              <button onClick={() => setCalSupp(p => Math.max(0, p - (profile?.calSuppStep ?? 250)))} style={{ background: "#1e1e1e", border: "1px solid #333", borderRadius: 6, width: 22, height: 22, color: "#aaa", fontSize: 14, cursor: "pointer", lineHeight: 1, padding: 0 }}>−</button>
              <span style={{ fontSize: 11, fontFamily: "monospace", color: calSupp > 0 ? "#c9a96e" : "#555", minWidth: 40, textAlign: "center", fontWeight: 700 }}>{calSupp > 0 ? `${calSupp}mg` : "OFF"}</span>
              <button onClick={() => setCalSupp(p => Math.min(2000, p + (profile?.calSuppStep ?? 250)))} style={{ background: "#1e1e1e", border: "1px solid #333", borderRadius: 6, width: 22, height: 22, color: "#aaa", fontSize: 14, cursor: "pointer", lineHeight: 1, padding: 0 }}>+</button>
            </div>
          </div>
        </div>
        {Object.keys(MINERAL_TARGETS).map(m => (
          <MineralBar key={m} mineral={m} value={mineralTotals[m]} target={MINERAL_TARGETS[m]} suppActive={magSupp} potSuppActive={potSupp} calSuppActive={calSupp} arbMedication={profile?.arbMedication} />
        ))}
      </div>

      {/* Export/Import Modal */}
      {showDataModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#1e1e1e", border: "1px solid #333", borderRadius: 14, padding: 20, width: "100%", maxWidth: 380, maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
            {showDataModal === "export" ? (
              <>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#f0ede8", marginBottom: 8 }}>📤 Export Your Data</div>
                <div style={{ fontSize: 11, color: "#888", marginBottom: 10 }}>Copy this text and save it somewhere safe. Use Import to restore it in any new tracker instance.</div>
                <textarea readOnly value={exportText}
                  onFocus={e => e.target.select()}
                  style={{ flex: 1, background: "#111", border: "1px solid #333", borderRadius: 8, padding: 10, color: "#7ec8a4", fontSize: 9, fontFamily: "monospace", resize: "none", minHeight: 150, userSelect: "all", WebkitUserSelect: "all" }} />
                <div style={{ fontSize: 11, color: "#c9a96e", textAlign: "center", marginTop: 6 }}>👆 Tap the text box to select all, then copy manually</div>
                <button onClick={() => {
                  try {
                    const ta = document.querySelector("textarea[readonly]");
                    if (ta) { ta.select(); document.execCommand("copy"); }
                    navigator.clipboard?.writeText(exportText);
                    setCopySuccess(true); setTimeout(() => setCopySuccess(false), 2000);
                  } catch {}
                }}
                  style={{ marginTop: 6, background: "#c9a96e", border: "none", borderRadius: 8, padding: "10px 0", color: "#111", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>
                  {copySuccess ? "✓ Copied!" : "📋 Copy to Clipboard"}
                </button>
                <button onClick={() => setShowDataModal(null)} style={{ marginTop: 8, background: "none", border: "1px solid #333", borderRadius: 8, padding: "8px 0", color: "#888", fontSize: 12, cursor: "pointer" }}>Close</button>
              </>
            ) : (
              <>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#f0ede8", marginBottom: 8 }}>📥 Import Your Data</div>
                <div style={{ fontSize: 11, color: "#888", marginBottom: 10 }}>Attach your backup JSON file to restore all food logs, history and settings.</div>
                <input type="file" accept=".json,application/json"
                  onChange={e => {
                    const file = e.target.files[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = ev => setImportText(ev.target.result);
                    reader.readAsText(file);
                  }}
                  style={{ marginBottom: 10, color: "#888", fontSize: 12 }} />
                {importText && <div style={{ fontSize: 11, color: "#7ec8a4", marginBottom: 8 }}>✓ File loaded — ready to restore</div>}
                <div style={{ fontSize: 11, color: "#555", marginBottom: 10 }}>Or paste the JSON text directly:</div>
                <textarea value={importText} onChange={e => setImportText(e.target.value)}
                  placeholder="Paste exported JSON here..."
                  style={{ flex: 1, background: "#111", border: "1px solid #333", borderRadius: 8, padding: 10, color: "#7ec8a4", fontSize: 9, fontFamily: "monospace", resize: "none", minHeight: 100 }} />
                <button onClick={() => importData(importText)} disabled={!importText}
                  style={{ marginTop: 10, background: importText ? "#7ec8a4" : "#333", border: "none", borderRadius: 8, padding: "10px 0", color: importText ? "#111" : "#666", fontWeight: 800, fontSize: 13, cursor: importText ? "pointer" : "default" }}>
                  📥 Import & Restore
                </button>
                <button onClick={() => setShowDataModal(null)} style={{ marginTop: 8, background: "none", border: "1px solid #333", borderRadius: 8, padding: "8px 0", color: "#888", fontSize: 12, cursor: "pointer" }}>Cancel</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Nav tabs */}
      <div style={s.tabs}>
        {["log", "add", "history", "trends", "readings"].map(t => (
          <button key={t} style={{ ...s.tabBtn(tab === t), fontSize: 10 }} onClick={() => setTab(t)}>
            {t === "log" ? "📋 Log" : t === "add" ? "➕ Add" : t === "history" ? "📊 Hist" : t === "trends" ? "📈 Trends" : "🩸 Readings"}
          </button>
        ))}
      </div>

      {/* LOG tab */}
      {tab === "log" && (
        <div style={s.section}>
          {/* Export/Import buttons */}
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            <button onClick={exportData} style={{ flex: 1, background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, padding: "6px 0", color: "#c9a96e", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
              📤 Export Data
            </button>
            <button onClick={() => { setImportText(""); setShowDataModal("import"); }} style={{ flex: 1, background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, padding: "6px 0", color: "#7ec8a4", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
              📥 Import Data
            </button>
          </div>

          {/* Copy to other user button */}
          {Object.values(selectedEntries).some(Boolean) && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, padding: "8px 12px", background: "#1a2a1a", borderRadius: 10, border: "1px solid #2a4a2a" }}>
              <span style={{ fontSize: 12, color: "#7ec8a4" }}>{Object.values(selectedEntries).filter(Boolean).length} selected</span>
              <button onClick={copySelectedToOther} style={{ background: "#2a4a2a", border: "none", borderRadius: 8, padding: "6px 14px", color: "#7ec8a4", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                {copySuccess ? "✓ Copied!" : `Copy to ${profiles?.find(p => p.id !== userId)?.name || "Other"} →`}
              </button>
            </div>
          )}
          {entries.length === 0
            ? <div style={{ textAlign: "center", color: "#555", padding: "30px 0", fontSize: 13 }}>No food logged yet today</div>
            : entries.map(e => {
              const baseName = (n) => n.replace(/\s*\([^)]*\)/g, '').replace(/\s*×[\d.]+/g, '').trim().toLowerCase();
              const alreadySaved = myFoods.some(f => baseName(f.name) === baseName(e.name) || f.name === e.name);
              const isExpanded = expandedEntry === e.id;
              const sodiumTarget = MINERAL_TARGETS.sodium;
              const sodiumPct = e.sodium ? Math.round((e.sodium / sodiumTarget) * 100) : 0;
              return (
                <div key={e.id} style={{ ...s.entryRow, flexDirection: "column", alignItems: "stretch", padding: 0, overflow: "hidden" }}>
                  {/* Main row */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 14px", cursor: "pointer" }}
                    onClick={() => setExpandedEntry(isExpanded ? null : e.id)}>
                    <input type="checkbox" checked={!!selectedEntries[e.id]}
                      onChange={ev => { ev.stopPropagation(); setSelectedEntries(prev => ({ ...prev, [e.id]: !prev[e.id] })); }}
                      onClick={ev => ev.stopPropagation()}
                      style={{ marginRight: 8, width: 16, height: 16, accentColor: "#7ec8a4", cursor: "pointer", flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>
                        {e.name.split(/(\s[\d.]+(?:g|ml)|\s×[\d.]+)(?=\)?$)/)[0]}
                        {(() => { const m = e.name.match(/(\s[\d.]+(?:g|ml)|\s×[\d.]+)\)?$/); return m ? <span style={{ color: "#c9a96e", fontSize: 11, fontWeight: 700 }}> {m[0].trim()}</span> : null; })()}
                      </div>
                      <div style={{ fontSize: 11, color: "#777" }}>F:{e.fat}g · P:{e.protein}g · NC:{Math.max(0, (e.carbs || 0) - (e.fiber || 0)).toFixed(1)}g</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#c9a96e" }}>{e.calories}</div>
                        <div style={{ fontSize: 10, color: "#555" }}>kcal</div>
                      </div>
                      <span style={{ fontSize: 11, color: "#555" }}>{isExpanded ? "▲" : "▼"}</span>
                      <button
                        onClick={ev => { ev.stopPropagation(); !alreadySaved && saveToMyFoods(e); }}
                        title={alreadySaved ? "Already in My Foods" : "Save to My Foods"}
                        style={{ background: "none", border: "none", cursor: alreadySaved ? "default" : "pointer", fontSize: 14, padding: 0, opacity: alreadySaved ? 0.3 : 0.8 }}
                      >💾</button>
                      <button onClick={ev => { ev.stopPropagation(); removeEntry(e.id); }} style={{ background: "none", border: "none", color: "#444", cursor: "pointer", fontSize: 16, padding: 0 }}>×</button>
                    </div>
                  </div>
                  {/* Expanded breakdown */}
                  {isExpanded && (
                    <div style={{ background: "#141414", borderTop: "1px solid #2a2a2a", padding: "10px 14px" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 12px", marginBottom: 8 }}>
                        {[
                          { label: "Calories", val: e.calories, unit: "kcal", color: "#c9a96e" },
                          { label: "Fat", val: e.fat, unit: "g", color: "#c9a96e" },
                          { label: "Protein", val: e.protein, unit: "g", color: "#7ec8e3" },
                          { label: "Net Carbs", val: Math.max(0,(e.carbs||0)-(e.fiber||0)).toFixed(1), unit: "g", color: "#f4d06f" },
                          { label: "Fiber", val: e.fiber, unit: "g", color: "#7ec8a4" },
                        ].map(({ label, val, unit, color }) => (
                          <div key={label} style={{ fontSize: 12 }}>
                            <span style={{ color: "#666" }}>{label}: </span>
                            <span style={{ color, fontWeight: 700 }}>{val}{unit}</span>
                          </div>
                        ))}
                      </div>
                      <div style={{ borderTop: "1px solid #222", paddingTop: 8 }}>
                        <div style={{ fontSize: 10, color: "#666", letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>Minerals</div>
                        {[
                          { label: "Sodium", val: e.sodium, color: MINERAL_COLORS.sodium, target: MINERAL_TARGETS.sodium },
                          { label: "Calcium", val: e.calcium, color: MINERAL_COLORS.calcium, target: MINERAL_TARGETS.calcium },
                          { label: "Magnesium", val: e.magnesium, color: MINERAL_COLORS.magnesium, target: MINERAL_TARGETS.magnesium },
                          { label: "Potassium", val: e.potassium, color: MINERAL_COLORS.potassium, target: MINERAL_TARGETS.potassium },
                        ].map(({ label, val, color, target }) => {
                          const pct = val ? Math.min((val / target) * 100, 100) : 0;
                          const over = val > target;
                          return (
                            <div key={label} style={{ marginBottom: 7 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                                <span style={{ fontSize: 11, color: "#aaa" }}>{label}</span>
                                <span style={{ fontSize: 11, fontFamily: "monospace", color: over ? "#ff4444" : "#888" }}>
                                  {Math.round(val || 0)}mg <span style={{ color: "#444" }}>({Math.round(pct)}% of daily)</span>
                                </span>
                              </div>
                              <div style={{ height: 4, borderRadius: 2, background: "#222", overflow: "hidden" }}>
                                <div style={{ height: "100%", width: `${pct}%`, background: over ? "#ff4444" : color, borderRadius: 2, transition: "width 0.3s" }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

        </div>
      )}

      {/* ADD tab */}
      {tab === "add" && (
        <div style={s.section}>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            {["foods", "ai", "quick"].map(st => (
              <button key={st} style={s.subTab(addSubTab === st)} onClick={() => { setAddSubTab(st); resetAnalyze(); setQuickLogResults(null); }}>
                {st === "foods" ? "🍽 Foods" : st === "ai" ? "✨ AI" : "⚡ Quick Log"}
              </button>
            ))}
          </div>

          {addSubTab === "foods" && (() => {
            const allFoods = [
              ...myFoods.map(f => ({ ...f, _isMine: true })),
              ...PRESET_FOODS.filter(p => !myFoods.find(m => m.name === p.name)).map(f => ({ ...f, _isMine: false })),
            ];
            const filtered = allFoods.filter(f => f.name.toLowerCase().includes(search.toLowerCase()));
            return (
              <>
                <input placeholder="Search all foods…" value={search} onChange={e => setSearch(e.target.value)} style={s.input} />
                {filtered.length === 0
                  ? <div style={{ color: "#555", fontSize: 13, textAlign: "center", padding: "20px 0" }}>No foods found</div>
                  : filtered.map(f => (
                    <FoodCard key={f.id || f.name} food={f} onAdd={addFood}
                      showDelete={f._isMine} onDelete={deleteMyFood}
                      onEditWithAI={f._isMine ? editFoodWithAI : null} />
                  ))
                }
              </>
            );
          })()}

          {addSubTab === "ai" && (
            <div>
              {!analyzeResult ? (
                <>
                  {/* Photo upload — camera or gallery */}
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                      <label style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "#1a1a1a", border: "1px dashed #333", borderRadius: 10, padding: "10px 8px", cursor: "pointer" }}>
                        <span style={{ fontSize: 18 }}>📷</span>
                        <span style={{ fontSize: 11, color: "#888" }}>Camera</span>
                        <input type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={e => handleImageFile(e.target.files[0])} />
                      </label>
                      <label style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "#1a1a1a", border: "1px dashed #333", borderRadius: 10, padding: "10px 8px", cursor: "pointer" }}>
                        <span style={{ fontSize: 18 }}>🖼️</span>
                        <span style={{ fontSize: 11, color: "#888" }}>Gallery</span>
                        <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => handleImageFile(e.target.files[0])} />
                      </label>
                    </div>
                    {analyzeImage && (
                      <div style={{ position: "relative", display: "inline-block" }}>
                        <img src={analyzeImage.preview} alt="preview" style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 8 }} />
                        <button onClick={() => setAnalyzeImage(null)} style={{ position: "absolute", top: -6, right: -6, background: "#333", border: "none", borderRadius: "50%", width: 20, height: 20, color: "#fff", fontSize: 12, cursor: "pointer", lineHeight: 1 }}>×</button>
                      </div>
                    )}
                  </div>
                  <textarea placeholder={analyzeImage ? "Optional: add context (e.g. 'homemade, generous portion')" : "Describe your meal… e.g. 'pan-fried salmon with steamed broccoli and butter'"}
                    value={analyzeText} onChange={e => setAnalyzeText(e.target.value)}
                    style={{ ...s.input, minHeight: 80, resize: "vertical" }} />
                  <button onClick={runAnalysis} disabled={analyzing || (!analyzeText && !analyzeImage)} style={{ ...s.btn(), width: "100%", opacity: analyzing || (!analyzeText && !analyzeImage) ? 0.5 : 1 }}>
                    {analyzing ? "Analyzing…" : "✨ Analyze Meal"}
                  </button>
                  {analyzeError && <div style={{ color: "#ff6b6b", fontSize: 12, marginTop: 8 }}>{analyzeError}</div>}
                </>
              ) : (
                <div>
                  <div style={{ ...s.card, margin: "0 0 10px" }}>
                    <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{analyzeResult.name}</div>
                    {analyzeNote && <div style={{ fontSize: 11, color: "#888", marginBottom: 10, fontStyle: "italic" }}>{analyzeNote}</div>}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 12 }}>
                      {["calories", "fat", "protein", "carbs", "fiber", "sodium", "calcium", "magnesium", "potassium"].map(k => (
                        <div key={k} style={{ background: "#111", borderRadius: 8, padding: "6px 10px" }}>
                          <span style={{ color: "#666", textTransform: "capitalize" }}>{k}: </span>
                          <span style={{ color: "#c9a96e", fontWeight: 700 }}>{analyzeResult[k]}{k === "calories" ? "" : k === "sodium" || k === "calcium" || k === "magnesium" || k === "potassium" ? "mg" : "g"}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                      <button onClick={() => addFood(analyzeResult)} style={{ ...s.btn(), flex: 1 }}>+ Add to Log</button>
                      <button onClick={() => saveToMyFoods(analyzeResult, analyzeNote)} style={{ ...s.btn("#1a2a1a", "#7ec8a4"), flex: 1, border: "1px solid #2a4a2a" }}>
                        {savingToMyFoods ? "✓ Saved!" : "💾 Save to My Foods"}
                      </button>
                    </div>
                    <button onClick={resetAnalyze} style={{ ...s.btn("#1e1e1e", "#888"), width: "100%", marginTop: 8, border: "1px solid #333" }}>← Back</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* READINGS tab */}
      {tab === "readings" && (() => {
        const unit = profile?.glucoseUnit ?? "mmol";
        const toDisplay = (v) => unit === "mgdl" ? Math.round(v * 18) : v;
        const fromInput = (v) => unit === "mgdl" ? parseFloat(v) / 18 : parseFloat(v);
        const unitLabel = unit === "mgdl" ? "mg/dL" : "mmol/L";

        const glucoseColor = (v) => {
          if (!v) return "#555";
          if (v < 3.9) return "#f4d06f"; // low
          if (v <= 5.5) return "#7ec8a4"; // normal fasting
          if (v <= 7.8) return "#c9a96e"; // elevated
          return "#ff4444"; // high
        };
        const ketoneColor = (v) => {
          if (!v) return "#555";
          if (v < 0.5) return "#555"; // not in ketosis
          if (v < 1.5) return "#7ec8e3"; // light
          if (v < 3.0) return "#7ec8a4"; // nutritional ketosis
          if (v < 5.0) return "#c9a96e"; // deep
          return "#ff4444"; // very high
        };
        const ketoneLabel = (v) => {
          if (!v) return "";
          if (v < 0.5) return "Not in ketosis";
          if (v < 1.5) return "Light ketosis";
          if (v < 3.0) return "Nutritional ketosis ✓";
          if (v < 5.0) return "Deep ketosis";
          return "Very high — consult doctor";
        };



        return (
          <div style={s.section}>
            {/* Entry form */}
            <div style={{ ...s.card, margin: "0 0 12px" }}>
              <div style={{ ...s.cardLabel, display: "flex", alignItems: "center", gap: 6 }}>Log a Reading <InfoButton topic="readings" /></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 10, color: "#888", marginBottom: 4 }}>Glucose ({unitLabel})</div>
                  <input type="number" step="0.1" placeholder={unit === "mgdl" ? "e.g. 95" : "e.g. 5.2"}
                    value={readingForm.glucose}
                    onChange={e => setReadingForm(p => ({ ...p, glucose: e.target.value }))}
                    style={{ ...s.input, marginBottom: 0 }} />
                </div>
                <div>
                  <div style={{ fontSize: 10, color: "#888", marginBottom: 4 }}>Ketones (mmol/L)</div>
                  <input type="number" step="0.1" placeholder="e.g. 1.2"
                    value={readingForm.ketone}
                    onChange={e => setReadingForm(p => ({ ...p, ketone: e.target.value }))}
                    style={{ ...s.input, marginBottom: 0 }} />
                </div>
                <div>
                  <div style={{ fontSize: 10, color: "#e87777", marginBottom: 4 }}>BP Systolic (mmHg)</div>
                  <input type="number" placeholder="e.g. 120"
                    value={readingForm.bpSystolic}
                    onChange={e => setReadingForm(p => ({ ...p, bpSystolic: e.target.value }))}
                    style={{ ...s.input, marginBottom: 0 }} />
                </div>
                <div>
                  <div style={{ fontSize: 10, color: "#888", marginBottom: 4 }}>BP Diastolic (mmHg)</div>
                  <input type="number" placeholder="e.g. 80"
                    value={readingForm.bpDiastolic}
                    onChange={e => setReadingForm(p => ({ ...p, bpDiastolic: e.target.value }))}
                    style={{ ...s.input, marginBottom: 0 }} />
                </div>
              </div>
              <input placeholder="Note (optional — e.g. fasting, 2hr post meal)"
                value={readingForm.note}
                onChange={e => setReadingForm(p => ({ ...p, note: e.target.value }))}
                style={{ ...s.input, marginBottom: 10 }} />
              <button onClick={addReading} style={{ ...s.btn(), width: "100%" }}>+ Log Reading</button>
            </div>

            {/* Reference ranges */}
            <div style={{ ...s.card, margin: "0 0 12px", background: "#161616" }}>
              <div style={s.cardLabel}>Reference Ranges</div>
              <div style={{ fontSize: 11, color: "#888", lineHeight: 1.8 }}>
                <div>🟢 Glucose fasting: {unit === "mgdl" ? "72–99 mg/dL" : "4.0–5.5 mmol/L"}</div>
                <div>🟢 Glucose 2hr post meal: {unit === "mgdl" ? "under 140 mg/dL" : "under 7.8 mmol/L"}</div>
                <div>🟢 Ketones (nutritional ketosis): 0.5–3.0 mmol/L</div>
                <div>🟢 Blood pressure normal: under 120/80 mmHg</div>
                <div>🟡 Elevated: 120–129 systolic</div>
                <div>🔴 High: 130+ systolic</div>
              </div>
            </div>

            {/* Today's readings */}
            {readings.length === 0
              ? <div style={{ textAlign: "center", color: "#555", padding: "30px 0", fontSize: 13 }}>No readings logged today</div>
              : readings.map(r => (
                <div key={r.id} style={{ ...s.card, margin: "0 0 8px", padding: "12px 16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: "#555" }}>{r.time}</span>
                    {r.note && <span style={{ fontSize: 11, color: "#888", fontStyle: "italic" }}>{r.note}</span>}
                    <button onClick={() => setReadings(prev => prev.filter(x => x.id !== r.id))}
                      style={{ background: "none", border: "none", color: "#444", cursor: "pointer", fontSize: 15 }}>×</button>
                  </div>
                  <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                    <button onClick={() => {
                      // Try Android intent first, fallback to iOS, then web
                      const seconds = 7200;
                      // Android clock deep link
                      window.location.href = `intent://timer#Intent;scheme=android-app;package=com.google.android.deskclock;S.android.intent.extra.alarm.LENGTH=${seconds};end`;
                      // Fallback after short delay
                      setTimeout(() => {
                        window.location.href = `clock://timer?duration=7200`;
                      }, 500);
                    }}
                      style={{ flex: 1, background: "#1a2a1a", border: "1px solid #2a4a2a", borderRadius: 8, padding: "6px 0", color: "#7ec8a4", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                      ⏱ Set 2hr Timer
                    </button>
                    <button onClick={() => {
                      window.location.href = `intent://timer#Intent;scheme=android-app;package=com.google.android.deskclock;S.android.intent.extra.alarm.LENGTH=3600;end`;
                      setTimeout(() => { window.location.href = `clock://timer?duration=3600`; }, 500);
                    }}
                      style={{ flex: 1, background: "#1a1a2a", border: "1px solid #2a2a4a", borderRadius: 8, padding: "6px 0", color: "#7ec8e3", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                      ⏱ Set 1hr Timer
                    </button>
                  </div>
                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                    {r.glucose && (
                      <div>
                        <div style={{ fontSize: 10, color: "#888" }}>Glucose</div>
                        <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "monospace", color: glucoseColor(r.glucose) }}>
                          {toDisplay(r.glucose)}
                          <span style={{ fontSize: 11, fontWeight: 400, marginLeft: 2 }}>{unitLabel}</span>
                        </div>
                      </div>
                    )}
                    {r.ketone && (
                      <div>
                        <div style={{ fontSize: 10, color: "#888" }}>Ketones</div>
                        <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "monospace", color: ketoneColor(r.ketone) }}>
                          {r.ketone}
                          <span style={{ fontSize: 11, fontWeight: 400, marginLeft: 2 }}>mmol/L</span>
                        </div>
                        <div style={{ fontSize: 10, color: ketoneColor(r.ketone), marginTop: 2 }}>{ketoneLabel(r.ketone)}</div>
                      </div>
                    )}
                    {r.bpSystolic && (
                      <div>
                        <div style={{ fontSize: 10, color: "#888" }}>Blood Pressure</div>
                        <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "monospace", color: r.bpSystolic > 140 ? "#ff4444" : r.bpSystolic > 130 ? "#c9a96e" : "#7ec8a4" }}>
                          {r.bpSystolic}{r.bpDiastolic ? `/${r.bpDiastolic}` : ""}
                          <span style={{ fontSize: 11, fontWeight: 400, marginLeft: 2 }}>mmHg</span>
                        </div>
                        <div style={{ fontSize: 10, color: r.bpSystolic > 140 ? "#ff4444" : r.bpSystolic > 130 ? "#c9a96e" : "#7ec8a4", marginTop: 2 }}>
                          {r.bpSystolic > 140 ? "High" : r.bpSystolic > 130 ? "Elevated" : r.bpSystolic > 120 ? "Normal-High" : "Normal ✓"}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))
            }

            {/* Past readings history */}
            {(() => {
              const pastKeys = Object.keys(readingsHistory)
                .filter(k => k !== todayKey() && readingsHistory[k]?.length > 0)
                .sort().reverse().slice(0, 14);
              if (!pastKeys.length) return null;
              return (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 11, color: "#555", letterSpacing: 1, textTransform: "uppercase", marginBottom: 8, paddingLeft: 2 }}>Past Readings</div>
                  {pastKeys.map(dateKey => {
                    const dayReadings = readingsHistory[dateKey] || [];
                    const [, m, d] = dateKey.split("-");
                    return (
                      <div key={dateKey} style={{ ...s.card, margin: "0 0 8px", padding: "10px 14px" }}>
                        <div style={{ fontSize: 11, color: "#c9a96e", fontWeight: 700, marginBottom: 6 }}>{d}/{m}</div>
                        {dayReadings.map((r, i) => (
                          <div key={i} style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", marginBottom: i < dayReadings.length - 1 ? 8 : 0, paddingBottom: i < dayReadings.length - 1 ? 8 : 0, borderBottom: i < dayReadings.length - 1 ? "1px solid #222" : "none" }}>
                            <span style={{ fontSize: 10, color: "#555", minWidth: 36 }}>{r.time}</span>
                            {r.glucose && <span style={{ fontSize: 12, fontFamily: "monospace", color: glucoseColor(r.glucose) }}>G: {toDisplay(r.glucose)} {unitLabel}</span>}
                            {r.ketone && <span style={{ fontSize: 12, fontFamily: "monospace", color: ketoneColor(r.ketone) }}>K: {r.ketone} mmol/L</span>}
                            {r.bpSystolic && <span style={{ fontSize: 12, fontFamily: "monospace", color: r.bpSystolic > 140 ? "#ff4444" : r.bpSystolic > 130 ? "#c9a96e" : "#7ec8a4" }}>BP: {r.bpSystolic}{r.bpDiastolic ? `/${r.bpDiastolic}` : ""}</span>}
                            {r.note && <span style={{ fontSize: 10, color: "#666", fontStyle: "italic" }}>{r.note}</span>}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        );
      })()}

      {/* QUICK LOG tab */}
      {tab === "add" && addSubTab === "quick" && (
        <div style={s.section}>
          {!quickLogResults ? (
            <>
              {/* Mode toggle */}
              <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                <button onClick={() => setQuickLogMode("casual")}
                  style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: `1px solid ${quickLogMode === "casual" ? "#c9a96e" : "#2a2a2a"}`, background: quickLogMode === "casual" ? "#2a1e0a" : "transparent", color: quickLogMode === "casual" ? "#c9a96e" : "#666", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
                  🗣 Casual (+{profile?.quickLogBias ?? 15}% adj)
                </button>
                <button onClick={() => setQuickLogMode("exact")}
                  style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: `1px solid ${quickLogMode === "exact" ? "#7ec8e3" : "#2a2a2a"}`, background: quickLogMode === "exact" ? "#0a1a2a" : "transparent", color: quickLogMode === "exact" ? "#7ec8e3" : "#666", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
                  ⚖️ Exact weights (no adj)
                </button>
              </div>
              <div style={{ fontSize: 11, color: quickLogMode === "casual" ? "#c9a96e" : "#7ec8e3", marginBottom: 8, lineHeight: 1.4 }}>
                {quickLogMode === "casual"
                  ? "Describe meals naturally — AI estimates portions and adds your accuracy adjustment."
                  : "Include exact weights (e.g. '10g pumpkin seeds, 150g yogurt') — AI looks up values, no adjustment applied."}
              </div>
              <textarea
                placeholder={quickLogMode === "casual" ? "e.g. 'For breakfast I had two scrambled eggs with cheese. Lunch was a salad with tuna and olive oil. Snacked on some almonds. Dinner was grilled chicken with tahini sauce.'" : "e.g. '10g pumpkin seeds, 150g Greek yogurt, 2 eggs, 200ml smoothie, 30g walnuts'"}
                value={quickLogText}
                onChange={e => setQuickLogText(e.target.value)}
                style={{ ...s.input, minHeight: 120, resize: "vertical", lineHeight: 1.5 }}
              />
              <button onClick={runQuickLog} disabled={quickLogging || !quickLogText.trim()}
                style={{ ...s.btn(), width: "100%", opacity: quickLogging || !quickLogText.trim() ? 0.5 : 1 }}>
                {quickLogging ? "Analyzing your day…" : "⚡ Log Everything"}
              </button>
              {quickLogError && <div style={{ color: "#ff6b6b", fontSize: 12, marginTop: 8 }}>{quickLogError}</div>}
            </>
          ) : (
            <div>
              <div style={{ fontSize: 13, color: "#888", marginBottom: 12 }}>
                Found {quickLogResults.length} items — review and add all to your log:
              </div>
              {quickLogResults.map((item, i) => (
                <div key={i} style={{ background: "#1a1a1a", borderRadius: 10, padding: "10px 14px", marginBottom: 8, border: "1px solid #252525" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{item.name}</div>
                      <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>F:{item.fat}g · P:{item.protein}g · NC:{Math.max(0,(item.carbs||0)-(item.fiber||0)).toFixed(1)}g</div>
                      {item.note && <div style={{ fontSize: 10, color: "#7ec8a4", marginTop: 2, fontStyle: "italic" }}>{item.note}</div>}
                    </div>
                    <div style={{ textAlign: "right", marginLeft: 10 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#c9a96e" }}>{item.calories}</div>
                      <div style={{ fontSize: 10, color: "#666" }}>kcal</div>
                    </div>
                  </div>
                </div>
              ))}
              <div style={{ background: "#1a1a1a", borderRadius: 10, padding: "10px 14px", marginBottom: 12, border: "1px solid #2a2a2a" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: quickLogMode === "casual" ? 4 : 0 }}>
                  <span style={{ fontSize: 13, color: "#888" }}>{quickLogMode === "casual" ? "AI estimate" : "Total"}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: quickLogMode === "casual" ? "#888" : "#c9a96e" }}>
                    {quickLogResults.reduce((a, i) => a + (i.calories || 0), 0)} kcal
                  </span>
                </div>
                {quickLogMode === "casual" && <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 13, color: "#c9a96e" }}>After +{profile?.quickLogBias ?? 15}% adjustment</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#c9a96e" }}>
                    {Math.round(quickLogResults.reduce((a, i) => a + (i.calories || 0), 0) * (1 + (profile?.quickLogBias ?? 15) / 100))} kcal
                  </span>
                </div>}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => addAllQuickLog(quickLogResults, quickLogMode)} style={{ ...s.btn(), flex: 1 }}>
                  + Add All to Log
                </button>
                <button onClick={() => { setQuickLogResults(null); setQuickLogText(""); }}
                  style={{ ...s.btn("#1e1e1e", "#888"), padding: "10px 16px", border: "1px solid #333" }}>
                  ← Redo
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* HISTORY tab */}
      {tab === "history" && (
        <div style={s.section}>
          <div style={{ ...s.card, margin: "0 0 10px" }}>
            <div style={s.cardLabel}>7-Day Deficit Total</div>
            <div style={{ fontSize: 26, fontWeight: 800, fontFamily: "monospace", color: totalDeficit >= 0 ? "#7ec8a4" : "#ff6b6b" }}>
              {totalDeficit >= 0 ? "+" : ""}{Math.round(totalDeficit)} kcal
            </div>
            <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>≈ {(totalDeficit / 7700).toFixed(2)} kg fat</div>
          </div>
          {last7.map(day => {
            const dayEntries = day.isToday ? entries : (history[day.key] || []);
            const isExpanded = expandedHistoryDay === day.key;
            return (
            <div key={day.key} style={{ ...s.card, margin: "0 0 8px", border: day.isToday ? "1px solid #3a2e1a" : "1px solid #2a2a2a" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, cursor: "pointer" }}
                onClick={() => setExpandedHistoryDay(isExpanded ? null : day.key)}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: 14, color: day.isToday ? "#c9a96e" : "#f0ede8" }}>{day.isToday ? "Today" : day.date}</span>
                  {day.hasOverride && <span style={{ fontSize: 9, color: "#888", marginLeft: 6 }}>manual</span>}
                </div>
                <div style={{ display: "flex", gap: 14, fontSize: 12, color: "#aaa", alignItems: "center" }}>
                  <span>🍽 {Math.round(day.eaten)}</span>
                  {day.burn ? <span>🔥 {day.burn}</span> : <span style={{ color: "#444" }}>🔥 —</span>}
                  {day.def !== null && <span style={{ color: day.def >= 0 ? "#7ec8a4" : "#ff6b6b", fontWeight: 700 }}>{day.def >= 0 ? "+" : ""}{Math.round(day.def)}</span>}
                  <span style={{ fontSize: 11, color: "#555" }}>{isExpanded ? "▲" : "▼"}</span>
                </div>
              </div>
              <div style={{ fontSize: 11, color: "#555" }}>NC: {day.nc.toFixed(1)}g</div>
              {isExpanded && (
                <div style={{ marginTop: 10, borderTop: "1px solid #222", paddingTop: 10 }}>
                  {dayEntries.length === 0
                    ? <div style={{ fontSize: 12, color: "#444", textAlign: "center", padding: "8px 0" }}>No foods logged</div>
                    : dayEntries.map((e, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid #1a1a1a" }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: "#e0ddd8" }}>{e.name}</div>
                          <div style={{ fontSize: 10, color: "#666", marginTop: 1 }}>
                            F:{e.fat}g · P:{e.protein}g · NC:{Math.max(0,(e.carbs||0)-(e.fiber||0)).toFixed(1)}g · Na:{e.sodium||0}mg
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#c9a96e" }}>{e.calories} kcal</div>
                          {!day.isToday && (
                            <button onClick={() => {
                              const updated = { ...history };
                              updated[day.key] = dayEntries.filter((_, idx) => idx !== i);
                              setHistory(updated);
                              lsSet("history", userId, updated);
                              lsSet("entries_" + day.key, userId, updated[day.key]);
                            }} style={{ background: "none", border: "none", color: "#444", cursor: "pointer", fontSize: 15, padding: 0 }}>×</button>
                          )}
                        </div>
                      </div>
                    ))
                  }
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, paddingTop: 6, borderTop: "1px solid #2a2a2a" }}>
                    <span style={{ fontSize: 11, color: "#888" }}>Total</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#c9a96e" }}>{Math.round(day.eaten)} kcal</span>
                  </div>
                </div>
              )}
              {/* Burn edit */}
              {burnEditDay === day.key
                ? <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  <input type="number" placeholder="burn kcal" defaultValue={day.burn || ""} id={`burn_${day.key}`} style={{ ...s.input, margin: 0, flex: 1, fontSize: 12, padding: "6px 10px" }} />
                  <button onClick={() => saveBurn(day.key, document.getElementById(`burn_${day.key}`).value)} style={s.btn()}>✓</button>
                  <button onClick={() => setBurnEditDay("")} style={{ ...s.btn("#222", "#888") }}>✕</button>
                </div>
                : <div style={{ display: "inline-flex", gap: 6, marginTop: 6 }}>
                  <button onClick={() => setBurnEditDay(day.key)} style={{ ...s.btn("#1e1e1e", "#666"), padding: "5px 10px", fontSize: 11, border: "1px solid #2a2a2a" }}>
                    {day.burn ? "Edit burn" : "+ Log burn"}
                  </button>
                  {day.burn && <button onClick={() => setBurnLog(prev => { const n = {...prev}; delete n[day.key]; return n; })} style={{ ...s.btn("#1e1e1e", "#555"), padding: "5px 10px", fontSize: 11, border: "1px solid #2a2a2a" }}>🗑</button>}
                  <button onClick={() => setOffDays(prev => { const n = {...prev}; if (n[day.key]) delete n[day.key]; else n[day.key] = true; return n; })}
                    style={{ ...s.btn(day.isOff ? "#2a1a1a" : "#1e1e1e", day.isOff ? "#ff9966" : "#555"), padding: "5px 10px", fontSize: 11, border: `1px solid ${day.isOff ? "#4a2a1a" : "#2a2a2a"}` }}>
                    {day.isOff ? "🏖 Off day" : "Mark off day"}<InfoButton topic="offDay" style={{ marginLeft: 4 }} />
                  </button>
                </div>}
              {/* Eaten edit */}
              {eatenEditDay === day.key
                ? <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                  <input type="number" placeholder="eaten kcal" defaultValue={day.eaten || ""} id={`eaten_${day.key}`} style={{ ...s.input, margin: 0, flex: 1, fontSize: 12, padding: "6px 10px" }} />
                  <button onClick={() => saveEaten(day.key, document.getElementById(`eaten_${day.key}`).value)} style={s.btn()}>✓</button>
                  <button onClick={() => setEatenEditDay("")} style={{ ...s.btn("#222", "#888") }}>✕</button>
                </div>
                : !day.isToday && <button onClick={() => setEatenEditDay(day.key)} style={{ ...s.btn("#1e1e1e", "#666"), padding: "5px 10px", fontSize: 11, marginTop: 4, border: "1px solid #2a2a2a", marginLeft: 6 }}>
                  {day.hasOverride ? "Edit eaten" : "+ Override eaten"}
                </button>}

              {/* Supplement edit */}
              {suppEditDay === day.key
                ? <div style={{ marginTop: 8, background: "#161616", borderRadius: 10, padding: "10px 12px" }}>
                  <div style={{ fontSize: 10, color: "#888", marginBottom: 8 }}>Edit supplements for {day.date}</div>
                  <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10, color: "#b5a4f5", marginBottom: 4 }}>Mg (mg)</div>
                      <input type="number" id={`mag_${day.key}`}
                        defaultValue={suppLog[day.key]?.mag ?? ""}
                        placeholder="e.g. 400"
                        style={{ ...s.input, margin: 0, fontSize: 12, padding: "6px 10px" }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10, color: "#7ec8a4", marginBottom: 4 }}>K (mg)</div>
                      <input type="number" id={`pot_${day.key}`}
                        defaultValue={suppLog[day.key]?.pot ?? ""}
                        placeholder="e.g. 500"
                        style={{ ...s.input, margin: 0, fontSize: 12, padding: "6px 10px" }} />
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => {
                      const mag = Number(document.getElementById(`mag_${day.key}`).value) || 0;
                      const pot = Number(document.getElementById(`pot_${day.key}`).value) || 0;
                      setSuppLog(prev => {
                        const updated = { ...prev, [day.key]: { mag, pot } };
                        lsSet("supp_log", userId, updated);
                        return updated;
                      });
                      setSuppEditDay("");
                    }} style={s.btn()}>✓ Save</button>
                    <button onClick={() => setSuppEditDay("")} style={{ ...s.btn("#222", "#888") }}>✕</button>
                  </div>
                </div>
                : <button onClick={() => setSuppEditDay(day.key)}
                  style={{ ...s.btn("#1e1e1e", "#666"), padding: "5px 10px", fontSize: 11, marginTop: 4, border: "1px solid #2a2a2a" }}>
                  {suppLog[day.key] ? `💊 Mg:${suppLog[day.key].mag}mg K:${suppLog[day.key].pot || "OFF"}` : "+ Log supplements"}
                </button>}
            </div>
          );})}
        </div>
      )}

      {/* TRENDS tab */}
      {tab === "trends" && (
        <TrendsView
          history={history}
          entries={entries}
          eatenOverride={eatenOverride}
          burnLog={burnLog}
          magSupp={magSupp}
          userId={userId}
          offDays={offDays}
          MINERAL_TARGETS={MINERAL_TARGETS}
          KETO_TARGETS={USER_KETO_TARGETS}
          profile={profile}
          s={s}
        />
      )}

    </div>
  );
}

// ── Profile Setup Screen ─────────────────────────────────────────────────────
function ProfileSetup({ profile, onSave, onCancel, isNew }) {
  const [form, setForm] = useState(profile || {
    id: "p_" + Date.now(),
    name: "", icon: "🧑", weight: "", height: "", age: "",
    sex: "male", activity: "moderate", goal: "lose",
    dietType: "mediterranean", hypertension: false, osteopenia: false, customCarbs: 80,
  });

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const preview = form.weight && form.height && form.age ? calcTargets(form) : null;
  const mineralPreview = calcMineralTargets(form);

  const icons = ["🧑","🧔","👩","👨","🧓","👴","👵","🏃","🏊","🚴"];

  const s = {
    label: { fontSize: 11, color: "#888", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 },
    input: { width: "100%", background: "#1e1e1e", border: "1px solid #333", borderRadius: 10, padding: "10px 14px", color: "#f0ede8", fontSize: 14, outline: "none", boxSizing: "border-box" },
    row: { marginBottom: 16 },
    seg: (active) => ({ flex: 1, padding: "8px 0", borderRadius: 8, border: `1px solid ${active ? "#c9a96e" : "#2a2a2a"}`, background: active ? "#2a1e0a" : "transparent", color: active ? "#c9a96e" : "#666", fontWeight: 600, fontSize: 12, cursor: "pointer" }),
  };

  return (
    <div style={{ padding: "16px", paddingBottom: 80 }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: "#f0ede8", marginBottom: 20 }}>
        {isNew ? "Add Profile" : "Edit Profile"}
      </div>

      {/* Icon picker */}
      <div style={s.row}>
        <div style={s.label}>Icon</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {icons.map(ic => (
            <button key={ic} onClick={() => set("icon", ic)}
              style={{ fontSize: 22, background: form.icon === ic ? "#2a1e0a" : "#1e1e1e", border: `1px solid ${form.icon === ic ? "#c9a96e" : "#333"}`, borderRadius: 8, padding: "6px 8px", cursor: "pointer" }}>
              {ic}
            </button>
          ))}
        </div>
      </div>

      {/* Name */}
      <div style={s.row}>
        <div style={s.label}>Name</div>
        <input value={form.name} onChange={e => set("name", e.target.value)} placeholder="Your name" style={s.input} />
      </div>

      {/* Sex */}
      <div style={s.row}>
        <div style={s.label}>Sex</div>
        <div style={{ display: "flex", gap: 6 }}>
          {[["male","Male"],["female","Female"]].map(([v,l]) => (
            <button key={v} style={s.seg(form.sex === v)} onClick={() => set("sex", v)}>{l}</button>
          ))}
        </div>
      </div>

      {/* Glucose unit */}
      <div style={s.row}>
        <div style={s.label}>Glucose Unit</div>
        <div style={{ display: "flex", gap: 6 }}>
          <button style={s.seg((form.glucoseUnit ?? "mmol") === "mmol")} onClick={() => set("glucoseUnit", "mmol")}>mmol/L (default)</button>
          <button style={s.seg((form.glucoseUnit ?? "mmol") === "mgdl")} onClick={() => set("glucoseUnit", "mgdl")}>mg/dL (US)</button>
        </div>
      </div>

      {/* Weight / Height / Age */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
        {[["weight","Weight (kg)"],["height","Height (cm)"],["age","Age"]].map(([k,l]) => (
          <div key={k}>
            <div style={s.label}>{l}</div>
            <input type="number" value={form[k]} onChange={e => set(k, Number(e.target.value))} style={{ ...s.input, padding: "10px 8px" }} />
          </div>
        ))}
      </div>

      {/* Activity */}
      <div style={s.row}>
        <div style={s.label}>Activity Level</div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {[["sedentary","Sedentary"],["light","Light"],["moderate","Moderate"],["active","Active"],["veryActive","Very Active"]].map(([v,l]) => (
            <button key={v} style={{ ...s.seg(form.activity === v), fontSize: 11 }} onClick={() => set("activity", v)}>{l}</button>
          ))}
        </div>
      </div>

      {/* Goal */}
      <div style={s.row}>
        <div style={s.label}>Goal</div>
        <div style={{ display: "flex", gap: 6 }}>
          {[["lose","Lose Weight"],["maintain","Maintain"],["gain","Gain Muscle"]].map(([v,l]) => (
            <button key={v} style={s.seg(form.goal === v)} onClick={() => set("goal", v)}>{l}</button>
          ))}
        </div>
      </div>

      {/* Diet Type */}
      <div style={s.row}>
        <div style={s.label}>Diet Type</div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {Object.entries(DIET_PRESETS).map(([k,v]) => (
            <button key={k} style={{ ...s.seg(form.dietType === k), fontSize: 11 }} onClick={() => set("dietType", k)}>{v.label}</button>
          ))}
        </div>
      </div>

      {/* Health flags */}
      <div style={s.row}>
        <div style={s.label}>Health Conditions</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[["hypertension","Hypertension"],["osteopenia","Osteopenia / Low bone density"],["kidneyIssues","Kidney Issues"],["arbMedication","ARB / ACE Inhibitor medication"]].map(([k,l]) => (
            <button key={k} onClick={() => set(k, !form[k])}
              style={{ padding: "7px 12px", borderRadius: 8, border: `1px solid ${form[k] ? "#ff9966" : "#2a2a2a"}`, background: form[k] ? "#2a1a0a" : "transparent", color: form[k] ? "#ff9966" : "#555", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
              {form[k] ? "✓ " : ""}{l}
            </button>
          ))}
        </div>
      </div>

      {/* Logging bias */}
      <div style={s.row}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <div style={s.label}>Personal Accuracy Factor</div>
          <InfoButton topic="loggingBias" />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: "#666", minWidth: 60 }}>Too little</span>
          <input type="range" min="-20" max="20" step="5"
            value={form.loggingBias ?? 0}
            onChange={e => set("loggingBias", Number(e.target.value))}
            style={{ flex: 1, accentColor: "#c9a96e" }} />
          <span style={{ fontSize: 11, color: "#666", minWidth: 55, textAlign: "right" }}>Too much</span>
        </div>
        <div style={{ textAlign: "center", fontSize: 13, fontWeight: 700, color: (form.loggingBias ?? 0) === 0 ? "#7ec8a4" : "#c9a96e" }}>
          {(form.loggingBias ?? 0) === 0 ? "Accurate (0% adjustment)" : (form.loggingBias ?? 0) > 0 ? `+${form.loggingBias}% added to logged totals` : `${form.loggingBias}% removed from logged totals`}
        </div>
      </div>

      {/* Quick Log bias */}
      <div style={s.row}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <div style={s.label}>⚡ Quick Log Accuracy Factor</div>
          <InfoButton topic="quickLogBias" />
        </div>
        <div style={{ fontSize: 11, color: "#c9a96e", marginBottom: 8 }}>AI tends to underestimate — we recommend starting at +15%</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: "#666", minWidth: 30 }}>0%</span>
          <input type="range" min="0" max="40" step="5"
            value={form.quickLogBias ?? 15}
            onChange={e => set("quickLogBias", Number(e.target.value))}
            style={{ flex: 1, accentColor: "#c9a96e" }} />
          <span style={{ fontSize: 11, color: "#666", minWidth: 30, textAlign: "right" }}>+40%</span>
        </div>
        <div style={{ textAlign: "center", fontSize: 13, fontWeight: 700, color: "#c9a96e" }}>
          +{form.quickLogBias ?? 15}% added to Quick Log totals
        </div>
      </div>

      {/* Supplement defaults */}
      <div style={s.row}>
        <div style={s.label}>Default Supplement Amounts</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 10, color: "#b5a4f5", marginBottom: 3 }}>Magnesium supplement (mg)</div>
            <input type="number" placeholder="e.g. 400"
              value={form.defaultMagSupp ?? ""}
              onChange={e => set("defaultMagSupp", e.target.value === "" ? undefined : Number(e.target.value))}
              style={{ ...s.input, padding: "8px 10px", fontSize: 12 }} />
          </div>
          <div>
            <div style={{ fontSize: 10, color: "#7ec8a4", marginBottom: 3 }}>Potassium supplement (mg)</div>
            <input type="number" placeholder="e.g. 500"
              value={form.defaultPotSupp ?? ""}
              onChange={e => set("defaultPotSupp", e.target.value === "" ? undefined : Number(e.target.value))}
              style={{ ...s.input, padding: "8px 10px", fontSize: 12 }} />
          </div>
        </div>
        <div style={{ background: "#1a1400", border: "1px solid #3a2e00", borderRadius: 8, padding: "10px 12px", fontSize: 11, color: "#c9a96e", lineHeight: 1.5 }}>
          ⚠️ <strong>Potassium supplements:</strong> This app does not recommend potassium supplementation. High potassium intake can be dangerous for people with kidney disease or those taking ACE inhibitors, ARBs, or potassium-sparing diuretics. Consult your doctor before supplementing potassium. Food sources are always preferred.
        </div>
      </div>

      {/* Custom macro/mineral targets */}
      <div style={s.row}>
        <div style={s.label}>Override Daily Targets</div>
        <div style={{ fontSize: 11, color: "#7ec8a4", marginBottom: 10, lineHeight: 1.5 }}>
          All values below are auto-calculated from your profile. Override any field if you have specific targets from a doctor, nutritionist or personal protocol. Leave blank to use the calculated default.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[
            ["customCarbs", "Net Carbs (g)", 5, 0, 200],
            ["customFiber", "Fiber (g)", 5, 0, 60],
            ["customProtein", "Protein (g)", 5, 0, 300],
            ["customFat", "Fat (g)", 5, 0, 300],
            ["customSodium", "Sodium (mg)", 100, 500, 4000],
            ["customMagnesium", "Magnesium (mg)", 10, 100, 800],
            ["customPotassium", "Potassium (mg)", 100, 500, 5000],
          ].map(([k, l, step, min, max]) => (
            <div key={k}>
              <div style={{ fontSize: 10, color: "#888", marginBottom: 4 }}>{l}</div>
              <div style={{ display: "flex", alignItems: "center", background: "#1e1e1e", border: "1px solid #333", borderRadius: 10, overflow: "hidden" }}>
                <button onClick={() => set(k, Math.max(min, (form[k] ?? 0) - step))}
                  style={{ background: "none", border: "none", color: "#aaa", fontSize: 16, padding: "8px 10px", cursor: "pointer", lineHeight: 1 }}>−</button>
                <div style={{ flex: 1, textAlign: "center", fontSize: 12, color: form[k] !== undefined ? "#c9a96e" : "#555", fontWeight: form[k] !== undefined ? 700 : 400 }}>
                  {form[k] !== undefined ? form[k] : "auto"}
                </div>
                <button onClick={() => set(k, Math.min(max, (form[k] ?? (k === "customSodium" ? 2300 : k === "customMagnesium" ? 420 : k === "customPotassium" ? 3500 : k === "customCarbs" ? 80 : k === "customFiber" ? 25 : 100)) + step))}
                  style={{ background: "none", border: "none", color: "#aaa", fontSize: 16, padding: "8px 10px", cursor: "pointer", lineHeight: 1 }}>+</button>
              </div>
              {form[k] !== undefined && (
                <button onClick={() => set(k, undefined)}
                  style={{ fontSize: 9, color: "#555", background: "none", border: "none", cursor: "pointer", padding: "2px 0" }}>reset to auto</button>
              )}
            </div>
          ))}
        </div>
        <div style={{ fontSize: 10, color: "#555", marginTop: 6 }}>Values shown as "auto" use calculated defaults. Tap + to override.</div>
      </div>

      {/* Live preview */}
      {preview && (
        <div style={{ background: "#161616", borderRadius: 12, padding: "12px 16px", marginBottom: 20, border: "1px solid #2a2a2a" }}>
          <div style={{ fontSize: 11, color: "#888", letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>Calculated Targets Preview</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 12 }}>
            {[
              ["Daily calories", `${preview.calories} kcal`],
              ["Fat", `${form.customFat ?? preview.fat}g`],
              ["Protein", `${form.customProtein ?? preview.protein}g`],
              ["Net Carbs", `${form.customCarbs ?? preview.carbs}g`],
              ["Sodium", `${mineralPreview.sodium}mg`],
              ["Calcium", `${mineralPreview.calcium}mg`],
              ["Magnesium", `${mineralPreview.magnesium}mg (${form.sex === "female" ? "women" : "men"}'s RDA)`],
              ["Potassium", `${mineralPreview.potassium}mg`],
            ].map(([l,v]) => (
              <div key={l} style={{ background: "#111", borderRadius: 8, padding: "6px 10px" }}>
                <span style={{ color: "#666" }}>{l}: </span>
                <span style={{ color: "#c9a96e", fontWeight: 700 }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Buttons */}
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={() => onSave(form)}
          disabled={!form.name}
          style={{ flex: 1, background: form.name ? "#c9a96e" : "#333", border: "none", borderRadius: 12, padding: "12px 0", color: form.name ? "#111" : "#666", fontWeight: 800, fontSize: 14, cursor: form.name ? "pointer" : "default" }}>
          {isNew ? "Create Profile" : "Save Changes"}
        </button>
        {onCancel && <button onClick={onCancel}
          style={{ padding: "12px 20px", background: "#1e1e1e", border: "1px solid #333", borderRadius: 12, color: "#888", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
          Cancel
        </button>}
      </div>
    </div>
  );
}

// ── Root with flexible profiles ───────────────────────────────────────────────
export default function KetoTracker() {
  const [profiles, setProfiles] = useState([]);
  const [activeUser, setActiveUser] = useState("me");
  const [showSetup, setShowSetup] = useState(null); // null | "new" | profileId

  // Load profiles — localStorage first, then sync from Supabase
  useEffect(() => {
    try {
      const saved = localStorage.getItem("keto_profiles");
      if (saved) {
        setProfiles(JSON.parse(saved));
      } else {
        setProfiles(DEFAULT_PROFILES);
        localStorage.setItem("keto_profiles", JSON.stringify(DEFAULT_PROFILES));
        sbSet("keto_profiles", DEFAULT_PROFILES);
      }
    } catch { setProfiles(DEFAULT_PROFILES); }
    // Sync from cloud
    (async () => {
      const val = await sbGet("keto_profiles");
      if (val !== null) {
        try { localStorage.setItem("keto_profiles", JSON.stringify(val)); } catch {}
        setProfiles(val);
      }
    })();
  }, []);

  const saveProfiles = (updated) => {
    setProfiles(updated);
    localStorage.setItem("keto_profiles", JSON.stringify(updated));
    sbSet("keto_profiles", updated);
  };

  const handleSaveProfile = (form) => {
    if (showSetup === "new") {
      const updated = [...profiles, form];
      saveProfiles(updated);
      setActiveUser(form.id);
    } else {
      const updated = profiles.map(p => p.id === form.id ? form : p);
      saveProfiles(updated);
    }
    setShowSetup(null);
  };

  const handleDeleteProfile = (id) => {
    if (profiles.length <= 1) return; // keep at least one
    const updated = profiles.filter(p => p.id !== id);
    saveProfiles(updated);
    if (activeUser === id) setActiveUser(updated[0].id);
    setShowSetup(null);
  };

  const activeProfile = profiles.find(p => p.id === activeUser) || profiles[0];

  if (showSetup) {
    const editingProfile = showSetup === "new" ? null : profiles.find(p => p.id === showSetup);
    return (
      <div style={{ minHeight: "100vh", background: "#111", color: "#f0ede8", fontFamily: "system-ui, sans-serif", maxWidth: 420, margin: "0 auto" }}>
        <div style={{ background: "linear-gradient(135deg, #1a1a1a 0%, #141414 100%)", borderBottom: "1px solid #2a2a2a", padding: "20px 20px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#f0ede8" }}>
            {showSetup === "new" ? "New Profile" : "Edit Profile"}
          </div>
          {showSetup !== "new" && profiles.length > 1 && (
            <button onClick={() => { if (confirm("Delete this profile?")) handleDeleteProfile(showSetup); }}
              style={{ background: "none", border: "1px solid #4a1a1a", borderRadius: 8, padding: "6px 12px", color: "#ff6b6b", fontSize: 12, cursor: "pointer" }}>
              🗑 Delete
            </button>
          )}
        </div>
        <ProfileSetup
          profile={editingProfile}
          onSave={handleSaveProfile}
          onCancel={() => setShowSetup(null)}
          isNew={showSetup === "new"}
        />
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#111", color: "#f0ede8", fontFamily: "system-ui, sans-serif", maxWidth: 420, margin: "0 auto", paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #1a1a1a 0%, #141414 100%)", borderBottom: "1px solid #2a2a2a", padding: "20px 20px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5, color: "#f0ede8" }}>Nutrition Tracker</div>
            <div style={{ fontSize: 12, color: "#c9a96e", letterSpacing: 2, textTransform: "uppercase", marginTop: 2, marginBottom: 14 }}>🏔 Mediterranean · Glycemic Load</div>
          </div>
          <button onClick={() => setShowSetup(activeUser)}
            style={{ background: "none", border: "1px solid #333", borderRadius: 8, padding: "6px 10px", color: "#888", fontSize: 11, cursor: "pointer", marginTop: 4 }}>
            ⚙️ Edit
          </button>
        </div>

        {/* Profile switcher — scrollable */}
        <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #2a2a2a", overflowX: "auto" }}>
          {profiles.map(p => (
            <button key={p.id} onClick={() => setActiveUser(p.id)}
              style={{ padding: "10px 16px", background: "none", border: "none", borderBottom: activeUser === p.id ? "2px solid #c9a96e" : "2px solid transparent", color: activeUser === p.id ? "#c9a96e" : "#555", fontWeight: 700, fontSize: 14, cursor: "pointer", transition: "all 0.2s", whiteSpace: "nowrap" }}>
              {p.icon} {p.name}
            </button>
          ))}
          <button onClick={() => setShowSetup("new")}
            style={{ padding: "10px 14px", background: "none", border: "none", borderBottom: "2px solid transparent", color: "#444", fontSize: 18, cursor: "pointer" }}>
            +
          </button>
        </div>
      </div>

      {/* Per-user content */}
      {activeProfile && (
        <UserTracker key={activeUser} userId={activeUser} profile={activeProfile} profiles={profiles} />
      )}
    </div>
  );
}
