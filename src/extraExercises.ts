import type { Equip, Exercise, Muscle, Pattern, Unit } from "./exercises";

/* ==========================================================
   Extra BYB exercises so suggested plans can train every head:
   biceps long/short head and brachialis, all three triceps
   heads, front/side/rear delts, upper/lower chest, soleus,
   inner and outer hip, traps, lower abs and obliques.
   ========================================================== */

const NECK = "Neck";
const SHOULDER = "Shoulder";
const WRIST = "Elbow or wrist";
const LOWBACK = "Lower back";
const HIP = "Hip";
const KNEE = "Knee";
const ANKLE = "Ankle or foot";

function e(
  id: string, name: string, muscle: Muscle, secondary: string[], type: Exercise["type"], equipment: Equip[], level: 1 | 2 | 3,
  pattern: Pattern, steps: string[], mistakes: string[], safety: string, avoid: string[] = [], unit: Unit = "reps",
): Exercise {
  return { id, name, muscle, secondary, type, equipment, level, pattern, steps, mistakes, safety, avoid, unit };
}

export const EXTRA_EXERCISES: Exercise[] = [
  /* Biceps */
  e("bx-incline-curl", "Incline dumbbell curl", "Biceps", ["Forearms"], "Isolation", ["dumbbell", "bench"], 2, "biceps",
    ["Set a bench to about 45 degrees and lie back with a dumbbell in each hand, arms hanging straight down.", "Keep your upper arms still and curl the weights up.", "Lower slowly until your arms are fully straight."],
    ["Swinging your shoulders forward.", "Going too heavy to reach a full stretch."],
    "Start light. This position stretches the long head of the biceps.", [SHOULDER]),
  e("bx-preacher-db", "Dumbbell preacher curl (on incline bench)", "Biceps", [], "Isolation", ["dumbbell", "bench"], 1, "biceps",
    ["Stand behind an incline bench and rest the back of your upper arm on the backrest.", "Curl the dumbbell up, keeping your arm on the pad.", "Lower slowly, stopping just before your elbow locks."],
    ["Lifting your elbow off the pad.", "Dropping the weight at the bottom."],
    "Don't let the weight jerk your elbow straight at the bottom.", [WRIST]),
  e("bx-concentration", "Concentration curl", "Biceps", [], "Isolation", ["dumbbell"], 1, "biceps",
    ["Sit on a bench or chair, lean forward and rest the back of your upper arm against your inner thigh.", "Curl the dumbbell towards your shoulder.", "Lower slowly and switch arms after your set."],
    ["Moving your upper arm.", "Rushing the lowering."],
    "Use a light weight and squeeze at the top."),
  e("bx-bayesian", "Bayesian cable curl", "Biceps", [], "Isolation", ["cable"], 2, "biceps",
    ["Set a cable low, face away from the machine and hold the handle behind you.", "Keep your elbow slightly behind your body and curl the handle forward and up.", "Return slowly to a full stretch."],
    ["Letting the elbow drift forward.", "Using momentum."],
    "Keep the stretch comfortable, never painful.", [SHOULDER]),
  e("bx-reverse-curl", "Reverse-grip dumbbell curl", "Biceps", ["Forearms"], "Isolation", ["dumbbell"], 1, "biceps",
    ["Hold dumbbells at your sides with palms facing down.", "Curl up, keeping your wrists straight.", "Lower slowly."],
    ["Bending your wrists.", "Swinging your body."],
    "Use a lighter weight than for normal curls.", [WRIST]),
  e("bx-band-hammer", "Band hammer curl", "Biceps", ["Forearms"], "Isolation", ["band"], 1, "biceps",
    ["Stand on the band and hold the ends with palms facing each other.", "Curl up, keeping your elbows by your sides.", "Lower slowly."],
    ["Swinging.", "Letting the band snap down."],
    "Check the band for tears before use."),

  /* Triceps */
  e("bx-reverse-pushdown", "Reverse-grip cable pushdown", "Triceps", [], "Isolation", ["cable"], 1, "triceps",
    ["Hold a straight bar on a high cable with palms facing up.", "Keep your elbows at your sides and push down until your arms are straight.", "Let it rise slowly."],
    ["Elbows moving forward.", "Bending your wrists."],
    "Use a lighter weight than a normal pushdown.", [WRIST]),
  e("bx-kickback", "Dumbbell triceps kickback", "Triceps", [], "Isolation", ["dumbbell"], 1, "triceps",
    ["Support yourself on a bench or chair and hinge forward with a flat back.", "Hold your upper arm by your side, parallel to the floor.", "Straighten your elbow to push the dumbbell back, then return slowly."],
    ["Swinging the weight.", "Letting your upper arm drop."],
    "Light weights work best here."),
  e("bx-band-oh-ext", "Band overhead triceps extension", "Triceps", [], "Isolation", ["band"], 1, "triceps",
    ["Stand on one end of the band and hold the other end behind your head with both hands.", "Straighten your arms overhead.", "Lower slowly behind your head."],
    ["Elbows flaring wide.", "Arching your back."],
    "Keep your elbows pointing up.", [SHOULDER]),

  /* Shoulders */
  e("bx-front-raise", "Dumbbell front raise", "Shoulders", [], "Isolation", ["dumbbell"], 1, "shoulderIso",
    ["Hold dumbbells in front of your thighs.", "Raise them in front of you to shoulder height with a slight bend in your elbows.", "Lower slowly."],
    ["Swinging your body.", "Raising above shoulder height."],
    "Light weights are enough; your front delts already work in presses.", [SHOULDER]),
  e("bx-band-front-raise", "Band front raise", "Shoulders", [], "Isolation", ["band"], 1, "shoulderIso",
    ["Stand on the band and hold the ends in front of your thighs.", "Raise your hands in front of you to shoulder height.", "Lower slowly."],
    ["Leaning back.", "Shrugging."],
    "Keep your stomach tight.", [SHOULDER]),
  e("bx-reverse-pecdeck", "Reverse pec deck", "Shoulders", ["Back"], "Isolation", ["machine"], 1, "rearDelt",
    ["Sit facing the pec deck with the handles set for the reverse movement.", "Pull the handles back and out in an arc.", "Return slowly."],
    ["Shrugging up.", "Using momentum."],
    "Light weight and slow reps target the rear delts best."),
  e("bx-band-face-pull", "Band face pull", "Shoulders", ["Back"], "Isolation", ["band"], 1, "rearDelt",
    ["Anchor a band at head height and hold each end.", "Pull towards your face with elbows high, spreading your hands apart.", "Return slowly."],
    ["Leaning back to pull.", "Elbows dropping."],
    "Make sure the anchor is secure."),

  /* Chest */
  e("bx-decline-db", "Decline dumbbell press", "Chest", ["Triceps", "Shoulders"], "Compound", ["dumbbell", "bench"], 2, "hpush",
    ["Lie on a decline bench with your feet secured and dumbbells at your chest.", "Press the weights up over your lower chest.", "Lower slowly with control."],
    ["Bouncing the weights.", "Flaring your elbows straight out."],
    "Have someone hand you the dumbbells, or start light.", [SHOULDER]),
  e("bx-low-high-fly", "Low-to-high cable fly", "Chest", ["Shoulders"], "Isolation", ["cable"], 2, "chestIso",
    ["Set both cables low and take a handle in each hand.", "Sweep your hands up and together to about chin height.", "Lower slowly."],
    ["Bending and straightening your elbows.", "Shrugging."],
    "Keep a slight bend in your elbows throughout.", [SHOULDER]),

  /* Calves */
  e("bx-seated-calf-db", "Seated dumbbell calf raise", "Calves", [], "Isolation", ["dumbbell"], 1, "calves",
    ["Sit with the balls of your feet on a step and dumbbells resting on your knees.", "Raise your heels as high as you can.", "Lower slowly to a stretch."],
    ["Bouncing.", "Cutting the range short."],
    "Seated raises target the soleus, the lower calf muscle.", [ANKLE]),
  e("bx-seated-calf-machine", "Seated calf raise (machine)", "Calves", [], "Isolation", ["machine"], 1, "calves",
    ["Sit with the pad on your thighs and the balls of your feet on the platform.", "Raise your heels as high as you can.", "Lower slowly to a stretch."],
    ["Bouncing at the bottom.", "Using too much weight."],
    "Control the stretch at the bottom.", [ANKLE]),

  /* Inner and outer hip */
  e("bx-copenhagen", "Copenhagen plank (knee version)", "Glutes", ["Abs and core"], "Isolation", ["bench"], 2, "glute",
    ["Lie on your side and rest your top knee on a bench.", "Lift your hips so your body is straight, supported by your forearm and knee.", "Hold, then switch sides."],
    ["Hips sagging.", "Holding your breath."],
    "Strengthens the inner thigh. Start with short holds.", [KNEE, HIP], "sec"),
  e("bx-adductor-machine", "Hip adduction machine", "Glutes", [], "Isolation", ["machine"], 1, "glute",
    ["Sit with the pads on the inside of your knees.", "Squeeze your legs together.", "Open back slowly."],
    ["Letting the weight slam.", "Using too much weight."],
    "Move slowly through a comfortable range.", [HIP]),
  e("bx-clamshell", "Band clamshell", "Glutes", [], "Isolation", ["band"], 1, "glute",
    ["Lie on your side with knees bent and a mini band above your knees.", "Keeping your feet together, lift your top knee.", "Lower slowly and switch sides."],
    ["Rolling your hips back.", "Rushing."],
    "Great for the outer hip (glute medius)."),
  e("bx-side-leg-raise", "Side-lying leg raise", "Glutes", [], "Isolation", [], 1, "glute",
    ["Lie on your side with your legs straight.", "Lift your top leg up, toes pointing forward.", "Lower slowly and switch sides."],
    ["Rolling your hips back.", "Swinging the leg."],
    "Keep the movement slow and controlled."),

  /* Traps */
  e("bx-shrug", "Dumbbell shrug", "Back", ["Forearms"], "Isolation", ["dumbbell"], 1, "rearDelt",
    ["Hold dumbbells at your sides.", "Lift your shoulders straight up towards your ears.", "Pause, then lower slowly."],
    ["Rolling your shoulders.", "Bending your elbows."],
    "Keep your neck relaxed and in line.", [NECK]),

  /* Abs */
  e("bx-reverse-crunch", "Reverse crunch", "Abs and core", [], "Isolation", [], 1, "core",
    ["Lie on your back with knees bent at 90 degrees above your hips.", "Curl your hips off the floor towards your chest.", "Lower slowly."],
    ["Swinging your legs.", "Arching your lower back."],
    "Move slowly; it's a small movement.", [LOWBACK]),
  e("bx-bicycle", "Bicycle crunch", "Abs and core", [], "Isolation", [], 1, "core",
    ["Lie on your back with hands lightly beside your head.", "Bring one knee in as you turn the opposite shoulder towards it.", "Switch sides in a slow pedalling motion."],
    ["Pulling on your neck.", "Going too fast."],
    "Slow reps work the obliques better.", [NECK]),
  e("bx-woodchop", "Cable woodchop", "Abs and core", ["Shoulders"], "Compound", ["cable"], 2, "core",
    ["Set a cable high and stand side-on, holding the handle with both hands.", "Pull it down and across your body, turning from your torso.", "Return slowly and switch sides after your set."],
    ["Pulling with your arms only.", "Twisting your lower back hard."],
    "Rotate through your upper back and hips, not your lower back.", [LOWBACK]),
];