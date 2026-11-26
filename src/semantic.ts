/* ==========================================================
   Smart mode: a small language model (all-MiniLM-L6-v2) that
   runs on the phone through Transformers.js. It understands the
   meaning of a message, so the coach copes with more ways of
   asking. Free, private, and offline after the first download.
   ========================================================== */

type Extractor = (texts: string[], options: { pooling: "mean"; normalize: boolean }) => Promise<{ tolist: () => number[][] }>;

const MODEL = "Xenova/all-MiniLM-L6-v2";
let extractor: Promise<Extractor> | null = null;
let examples: { intent: string; vec: number[] }[] | null = null;

// Example sentences for each thing the coach can do
const INTENT_EXAMPLES: Record<string, string[]> = {
  today: ["what should I train today", "what's my workout for today", "what am I doing in the gym today"],
  replace: ["swap this exercise for something else", "I want a different exercise instead of this one", "I hate squats, replace them"],
  remove: ["take lunges out of my plan", "I don't want to do deadlifts anymore", "get rid of that exercise"],
  add: ["put some curls in my plan", "I want more arm exercises", "add an exercise for my rear delts"],
  easier: ["the workouts are too hard for me", "make my training lighter", "I'm struggling to finish my workouts"],
  harder: ["my workouts are too easy", "I want more of a challenge", "make my training more intense"],
  minutes: ["I only have 30 minutes to train", "make my sessions shorter", "I don't have much time for workouts"],
  split: ["I want to do push pull legs", "change my split to upper lower", "can I train full body instead"],
  days: ["I can only train three days a week", "change my training days to monday wednesday friday", "I'm only free on weekends"],
  focus: ["change my plan to focus on strength", "I want my training to build bigger muscles", "make my plan focus on losing fat"],
  equipment: ["I don't have a barbell at home", "my gym is closed this week", "I'm travelling and only have my body weight"],
  shuffle: ["give me new exercises", "I'm bored of my routine", "change all the exercises"],
  workout_request: ["give me a chest workout", "make me a quick home workout", "I want a leg workout"],
  head_workout: ["how do I train every head of my biceps", "exercises for the long head of triceps", "workout for rear delts"],
  weight_advice: ["what weight should I lift for bench press", "how heavy should my dumbbells be", "am I ready to go heavier"],
  missed: ["I missed my workouts this week", "I skipped the gym for days", "I couldn't train yesterday"],
  plateau: ["I'm not getting stronger", "my progress has stopped", "my lifts are stuck"],
  protein: ["how much protein do I need", "what are good protein sources", "am I eating enough protein"],
  post_food: ["what should I eat after the gym", "best food after a workout", "post workout meal ideas"],
  pre_food: ["what should I eat before training", "pre workout snack", "can I train on an empty stomach"],
  calories: ["how many calories should I eat", "what are my macros", "how much food do I need"],
  weight_loss: ["how do I lose belly fat", "I want to lose weight", "tips for fat loss"],
  muscle_gain: ["how do I gain muscle", "I'm skinny and want to bulk", "how to put on size"],
  sleep: ["I can't sleep well", "I feel tired all the time", "how much sleep do I need"],
  water_info: ["how much water should I drink", "am I drinking enough water"],
  sore: ["my muscles are sore after the workout", "should I train when I'm sore", "my legs are stiff from yesterday"],
  progress: ["how am I doing", "show my progress", "am I improving"],
  supplements: ["should I take creatine", "do I need whey protein", "are fat burners good"],
  rest: ["can I take a rest day", "should I skip today", "I need a break from training"],
  motivation: ["I don't feel like working out", "I'm feeling lazy today", "I've lost my motivation"],
  stretch: ["how can I be more flexible", "give me some stretches", "my hips feel tight"],
  warmup: ["how should I warm up", "what warm up should I do before lifting"],
  show_plan: ["show me my plan", "what's in my routine", "list my workouts"],
  explain_plan: ["why did you give me this plan", "explain my workout plan"],
};

export async function loadSmartModel(): Promise<void> {
  if (!extractor) {
    extractor = import("@huggingface/transformers").then(
      async (mod) => (await mod.pipeline("feature-extraction", MODEL)) as unknown as Extractor,
    );
    extractor.catch(() => {
      extractor = null; // allow another try later
    });
  }
  const run = await extractor;
  if (!examples) {
    const items = Object.entries(INTENT_EXAMPLES).flatMap(([intent, list]) => list.map((text) => ({ intent, text })));
    const vecs = (await run(items.map((i) => i.text), { pooling: "mean", normalize: true })).tolist();
    examples = items.map((i, k) => ({ intent: i.intent, vec: vecs[k] }));
  }
}

const dot = (a: number[], b: number[]) => a.reduce((s, v, i) => s + v * b[i], 0);

// Returns the closest matching intent, or null if nothing is close enough
export async function classify(text: string): Promise<{ intent: string; score: number } | null> {
  if (!extractor || !examples) return null;
  const run = await extractor;
  const [vec] = (await run([text], { pooling: "mean", normalize: true })).tolist();
  let best = { intent: "", score: -1 };
  for (const item of examples) {
    const s = dot(vec, item.vec);
    if (s > best.score) best = { intent: item.intent, score: s };
  }
  return best.score >= 0.55 ? best : null;
}