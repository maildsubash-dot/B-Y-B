/* ==========================================================
   BYB exercise library. Every workout is built from this list.
   ========================================================== */

export type Muscle =
  | "Chest" | "Back" | "Shoulders" | "Biceps" | "Triceps" | "Forearms" | "Abs and core"
  | "Quadriceps" | "Hamstrings" | "Glutes" | "Calves" | "Full body";
export type Equip =
  | "dumbbell" | "barbell" | "rack" | "bench" | "band" | "pullup" | "kettlebell"
  | "machine" | "cable" | "rope" | "cardio" | "bars" | "stairs";
export type Pattern =
  | "squat" | "hinge" | "lunge" | "hpush" | "vpush" | "hpull" | "vpull" | "chestIso" | "shoulderIso"
  | "rearDelt" | "biceps" | "triceps" | "forearm" | "quadIso" | "hamIso" | "glute" | "calves" | "core" | "cardio";
export type Unit = "reps" | "sec" | "min";

export type Exercise = {
  id: string;
  name: string;
  muscle: Muscle;
  secondary: string[];
  type: "Compound" | "Isolation" | "Cardio";
  equipment: Equip[]; // everything needed (empty = bodyweight)
  level: 1 | 2 | 3; // 1 beginner, 2 intermediate, 3 advanced
  pattern: Pattern;
  unit: Unit;
  steps: string[];
  mistakes: string[];
  safety: string;
  easier?: string;
  harder?: string;
  avoid: string[]; // pain areas (from onboarding) that should skip this
};

export const MUSCLES: Muscle[] = [
  "Chest", "Back", "Shoulders", "Biceps", "Triceps", "Forearms", "Abs and core",
  "Quadriceps", "Hamstrings", "Glutes", "Calves", "Full body",
];
export const ALL_EQUIP: Equip[] = [
  "dumbbell", "barbell", "rack", "bench", "band", "pullup", "kettlebell",
  "machine", "cable", "rope", "cardio", "bars", "stairs",
];
export const EQUIP_LABEL: Record<Equip, string> = {
  dumbbell: "Dumbbells", barbell: "Barbell", rack: "Squat rack", bench: "Bench", band: "Resistance band",
  pullup: "Pull-up bar", kettlebell: "Kettlebell", machine: "Gym machine", cable: "Cable machine",
  rope: "Skipping rope", cardio: "Treadmill, bike or rower", bars: "Dip / parallel bars", stairs: "Stairs or a step",
};
export const LEVEL_NAME = ["", "Beginner", "Intermediate", "Advanced"];
export const UNIT_LABEL: Record<Unit, string> = { reps: "reps", sec: "sec", min: "min" };
export const KINDS = ["Compound", "Isolation", "Bodyweight", "Dumbbell", "Barbell", "Machine", "Cable", "Band", "Kettlebell", "Cardio"];

// Pain areas, matching the onboarding answers
const NECK = "Neck";
const SHOULDER = "Shoulder";
const WRIST = "Elbow or wrist";
const UPBACK = "Upper back";
const LOWBACK = "Lower back";
const HIP = "Hip";
const KNEE = "Knee";
const ANKLE = "Ankle or foot";

type Extra = { easier?: string; harder?: string; avoid?: string[]; unit?: Unit };

function x(
  id: string, name: string, muscle: Muscle, secondary: string[], type: Exercise["type"], equipment: Equip[],
  level: 1 | 2 | 3, pattern: Pattern, steps: string[], mistakes: string[], safety: string, more: Extra = {},
): Exercise {
  return {
    id, name, muscle, secondary, type, equipment, level, pattern, steps, mistakes, safety,
    easier: more.easier, harder: more.harder, avoid: more.avoid ?? [], unit: more.unit ?? "reps",
  };
}

export const EXERCISES: Exercise[] = [
  /* ---------- Squats ---------- */
  x("chair-squat", "Chair squat", "Quadriceps", ["Glutes", "Hamstrings"], "Compound", [], 1, "squat",
    ["Stand in front of a sturdy chair, feet shoulder-width apart.", "Push your hips back and bend your knees to sit down slowly.", "Touch the seat lightly, then push through your whole foot to stand."],
    ["Dropping onto the chair instead of lowering slowly.", "Letting your knees cave inwards."],
    "Use a chair that can't slide. Keep the movement pain-free.", { harder: "bw-squat" }),
  x("bw-squat", "Bodyweight squat", "Quadriceps", ["Glutes", "Hamstrings", "Abs and core"], "Compound", [], 1, "squat",
    ["Stand with feet shoulder-width apart, toes turned out slightly.", "Bend your hips and knees together, keeping your chest up and heels down.", "Go as low as is comfortable, then push the floor away to stand."],
    ["Heels lifting off the floor.", "Knees collapsing inwards."],
    "Only go as deep as feels comfortable for your knees and hips.", { easier: "chair-squat", harder: "jump-squat", avoid: [KNEE] }),
  x("jump-squat", "Jump squat", "Quadriceps", ["Glutes", "Calves"], "Compound", [], 2, "squat",
    ["Squat down to a comfortable depth.", "Jump straight up, driving through your feet.", "Land softly with bent knees and flow into the next squat."],
    ["Landing with stiff, straight legs.", "Rushing and losing control."],
    "Land quietly. Skip this if jumping hurts your knees, hips or ankles.", { easier: "bw-squat", avoid: [KNEE, ANKLE, HIP] }),
  x("goblet-squat", "Goblet squat", "Quadriceps", ["Glutes", "Abs and core"], "Compound", ["dumbbell"], 1, "squat",
    ["Hold one dumbbell upright against your chest with both hands.", "Squat down between your knees, chest up and elbows inside your knees.", "Push through your whole foot to stand tall."],
    ["Letting the weight pull your chest forward.", "Rising onto your toes."],
    "Choose a weight you can control on every rep.", { easier: "bw-squat", harder: "back-squat", avoid: [KNEE] }),
  x("back-squat", "Barbell back squat", "Quadriceps", ["Glutes", "Hamstrings", "Abs and core"], "Compound", ["barbell", "rack"], 2, "squat",
    ["Set the bar in a rack at chest height and rest it across your upper back, not your neck.", "Step back with feet shoulder-width apart and brace your stomach.", "Squat down with control, keeping your back flat, then drive up."],
    ["Rounding your lower back at the bottom.", "Knees caving in as you stand."],
    "Always squat in a rack with the safety bars set just below your lowest point.", { easier: "goblet-squat", avoid: [KNEE, LOWBACK] }),
  x("leg-press", "Leg press", "Quadriceps", ["Glutes", "Hamstrings"], "Compound", ["machine"], 1, "squat",
    ["Sit with your back flat on the pad and feet shoulder-width on the platform.", "Release the safety handles and lower until your knees bend to about 90 degrees.", "Press back up without locking your knees."],
    ["Letting your lower back lift off the pad.", "Locking your knees straight at the top."],
    "Re-engage the safety handles before you get out.", { avoid: [KNEE] }),
  x("band-squat", "Banded squat", "Quadriceps", ["Glutes"], "Compound", ["band"], 1, "squat",
    ["Stand on the band with feet shoulder-width apart, holding the ends at your shoulders.", "Squat down with your chest up.", "Stand up against the band's pull."],
    ["Letting the band pull your shoulders forward.", "Knees caving in."],
    "Check the band for tears before each use.", { avoid: [KNEE] }),
  x("wall-sit", "Wall sit", "Quadriceps", ["Glutes"], "Isolation", [], 1, "quadIso",
    ["Stand with your back flat against a wall.", "Slide down until your knees are bent and directly above your ankles.", "Hold the position and keep breathing."],
    ["Knees drifting past your toes.", "Holding your breath."],
    "Only slide as low as is comfortable for your knees.", { unit: "sec" }),
  x("leg-extension", "Leg extension", "Quadriceps", [], "Isolation", ["machine"], 1, "quadIso",
    ["Sit with the pad on your lower shins and knees in line with the machine's pivot.", "Straighten your legs smoothly.", "Lower slowly back down."],
    ["Swinging the weight up.", "Lifting your hips off the seat."],
    "Use a light, controlled weight and stop if your knee hurts.", { avoid: [KNEE] }),

  /* ---------- Hip hinges ---------- */
  x("superman", "Superman", "Back", ["Glutes", "Hamstrings"], "Isolation", [], 1, "hinge",
    ["Lie face down with your arms stretched out in front.", "Gently lift your arms, chest and legs a few centimetres off the floor.", "Hold for a second, then lower slowly."],
    ["Lifting too high and cranking your neck.", "Jerking up quickly."],
    "Keep the lift small and your neck in line with your spine.", { avoid: [LOWBACK, NECK] }),
  x("sl-hinge", "Single-leg hip hinge", "Hamstrings", ["Glutes", "Abs and core"], "Compound", [], 2, "hinge",
    ["Stand on one leg with a soft knee; touch a wall for balance if needed.", "Hinge forward from your hips as your free leg reaches back.", "Stop when you feel a hamstring stretch, then stand back up."],
    ["Rounding your back.", "Twisting your hips open."],
    "Use a wall for balance until you feel steady.", { easier: "glute-bridge", avoid: [ANKLE, LOWBACK] }),
  x("db-rdl", "Dumbbell Romanian deadlift", "Hamstrings", ["Glutes", "Back"], "Compound", ["dumbbell"], 1, "hinge",
    ["Stand holding dumbbells in front of your thighs, knees slightly bent.", "Push your hips back and slide the weights down your legs with a flat back.", "Stop at a hamstring stretch, then squeeze your glutes to stand."],
    ["Rounding your back to reach lower.", "Bending your knees into a squat."],
    "Keep the weights close to your legs. Stop if you feel lower back pain.", { harder: "bb-rdl", avoid: [LOWBACK] }),
  x("bb-rdl", "Barbell Romanian deadlift", "Hamstrings", ["Glutes", "Back"], "Compound", ["barbell"], 2, "hinge",
    ["Hold a barbell in front of your thighs, hands just outside your legs, knees slightly bent.", "Push your hips back and slide the bar down your legs with a flat back.", "Stop at a hamstring stretch, then squeeze your glutes to stand."],
    ["Rounding your back.", "Letting the bar drift away from your legs."],
    "Keep the bar close and stop if you feel lower back pain.", { easier: "db-rdl", harder: "deadlift", avoid: [LOWBACK] }),
  x("deadlift", "Barbell deadlift", "Back", ["Glutes", "Hamstrings", "Forearms"], "Compound", ["barbell"], 3, "hinge",
    ["Stand with the bar over your mid-foot, feet hip-width apart.", "Hinge down and grip just outside your legs, then flatten your back and brace.", "Push the floor away and stand up with the bar close to your body.", "Lower it by pushing your hips back first."],
    ["Rounding your lower back.", "Jerking the bar off the floor."],
    "Learn this with light weight first, ideally with a coach watching.", { easier: "bb-rdl", avoid: [LOWBACK, UPBACK] }),
  x("kb-swing", "Kettlebell swing", "Glutes", ["Hamstrings", "Abs and core", "Back"], "Compound", ["kettlebell"], 2, "hinge",
    ["Stand with feet wider than hips and the kettlebell a little in front of you.", "Hike it back between your legs by hinging at your hips.", "Snap your hips forward to float it to chest height, then let it swing back."],
    ["Lifting with your arms instead of your hips.", "Squatting instead of hinging."],
    "Clear the space around you and keep your back flat.", { avoid: [LOWBACK] }),

  /* ---------- Lunges ---------- */
  x("reverse-lunge", "Reverse lunge", "Quadriceps", ["Glutes", "Hamstrings"], "Compound", [], 1, "lunge",
    ["Stand tall, then step one foot back.", "Lower until both knees bend to about 90 degrees.", "Push through your front foot to return. Alternate legs."],
    ["Front knee caving inwards.", "Leaning far forward."],
    "Hold a wall or chair for balance if needed.", { harder: "bulgarian", avoid: [KNEE] }),
  x("step-up", "Step-up", "Quadriceps", ["Glutes"], "Compound", ["stairs"], 1, "lunge",
    ["Place one whole foot on a sturdy step or stair.", "Press through that foot to stand up on the step.", "Step down slowly with control."],
    ["Pushing off with the back foot.", "Using a step that is too high."],
    "Use a stable step and hold a rail if there is one.", { harder: "bulgarian", avoid: [KNEE] }),
  x("bulgarian", "Bulgarian split squat", "Quadriceps", ["Glutes"], "Compound", ["bench"], 2, "lunge",
    ["Stand a stride in front of a bench and rest the top of your back foot on it.", "Lower straight down until your front thigh is near parallel.", "Drive through your front foot to rise."],
    ["Standing too close to the bench.", "Front heel lifting."],
    "Master it with bodyweight before holding dumbbells.", { easier: "reverse-lunge", avoid: [KNEE, HIP] }),
  x("db-lunge", "Dumbbell walking lunge", "Quadriceps", ["Glutes", "Hamstrings"], "Compound", ["dumbbell"], 2, "lunge",
    ["Hold a dumbbell in each hand at your sides.", "Step forward and lower until both knees bend to about 90 degrees.", "Push up and bring the back foot forward into the next step."],
    ["Taking very short steps.", "Front knee collapsing inwards."],
    "Make sure you have clear space to walk.", { easier: "reverse-lunge", avoid: [KNEE] }),

  /* ---------- Glutes and hamstrings ---------- */
  x("glute-bridge", "Glute bridge", "Glutes", ["Hamstrings", "Abs and core"], "Isolation", [], 1, "glute",
    ["Lie on your back with knees bent and feet flat, hip-width apart.", "Squeeze your glutes and lift your hips until your body is straight from knees to shoulders.", "Pause, then lower slowly."],
    ["Arching your lower back at the top.", "Pushing through your toes."],
    "Keep the movement in your hips, not your lower back.", { harder: "sl-bridge" }),
  x("sl-bridge", "Single-leg glute bridge", "Glutes", ["Hamstrings"], "Isolation", [], 2, "glute",
    ["Lie on your back, one foot flat and the other leg straight in the air.", "Push through the planted heel to lift your hips.", "Lower slowly and switch sides after your set."],
    ["Hips tilting to one side.", "Rushing the lowering."],
    "Keep your hips level throughout.", { easier: "glute-bridge", harder: "hip-thrust" }),
  x("hip-thrust", "Barbell hip thrust", "Glutes", ["Hamstrings"], "Compound", ["barbell", "bench"], 2, "glute",
    ["Sit with your upper back against a bench and a padded bar across your hips.", "Plant your feet and drive your hips up until your body is flat from shoulders to knees.", "Squeeze your glutes, then lower with control."],
    ["Over-arching your lower back at the top.", "Feet too far away."],
    "Use a bar pad or folded towel to protect your hips.", { easier: "glute-bridge" }),
  x("band-walk", "Band side walk", "Glutes", [], "Isolation", ["band"], 1, "glute",
    ["Put a mini band just above your knees.", "Bend your knees slightly and sit your hips back.", "Step sideways with tension on the band, then walk back the other way."],
    ["Standing up straight.", "Letting your feet touch."],
    "Keep your steps small and controlled."),
  x("cable-kickback", "Cable glute kickback", "Glutes", ["Hamstrings"], "Isolation", ["cable"], 1, "glute",
    ["Attach an ankle strap to a low cable and face the machine.", "Holding the frame, kick one leg straight back by squeezing your glute.", "Return slowly without letting the weight touch down."],
    ["Arching your lower back to kick higher.", "Swinging the leg."],
    "Keep your stomach tight and hips square."),
  x("leg-curl", "Lying leg curl", "Hamstrings", ["Calves"], "Isolation", ["machine"], 1, "hamIso",
    ["Lie face down with the pad just above your heels.", "Curl your heels towards your glutes.", "Lower slowly to the start."],
    ["Lifting your hips off the bench.", "Dropping the weight fast."],
    "Use a weight you can lower slowly."),
  x("towel-curl", "Towel slider leg curl", "Hamstrings", ["Glutes"], "Isolation", [], 2, "hamIso",
    ["Lie on your back on a smooth floor, heels on a towel, hips lifted in a bridge.", "Slide your heels out until your legs are almost straight.", "Pull them back in, keeping your hips up."],
    ["Letting your hips drop.", "Sliding out too far too soon."],
    "Start with small slides; cramps are common at first.", { easier: "glute-bridge" }),

  /* ---------- Calves ---------- */
  x("calf-raise", "Standing calf raise", "Calves", [], "Isolation", [], 1, "calves",
    ["Stand tall, holding a wall for balance.", "Rise onto the balls of your feet as high as you can.", "Lower your heels slowly."],
    ["Bouncing quickly.", "Bending your knees."],
    "Do it on a step edge for more range once you feel steady.", { harder: "sl-calf", avoid: [ANKLE] }),
  x("sl-calf", "Single-leg calf raise", "Calves", [], "Isolation", [], 2, "calves",
    ["Stand on one foot, holding a wall.", "Rise as high as you can on the ball of your foot.", "Lower slowly and switch legs after your set."],
    ["Using the wall to pull yourself up.", "Cutting the range short."],
    "Move slowly to protect your Achilles tendon.", { easier: "calf-raise", avoid: [ANKLE] }),
  x("machine-calf", "Machine calf raise", "Calves", [], "Isolation", ["machine"], 1, "calves",
    ["Set your shoulders under the pads with the balls of your feet on the edge.", "Rise up as high as you can.", "Lower until you feel a stretch, then repeat."],
    ["Bouncing at the bottom.", "Bending your knees to help."],
    "Control the stretch at the bottom.", { avoid: [ANKLE] }),

  /* ---------- Chest (horizontal push) ---------- */
  x("wall-pushup", "Wall push-up", "Chest", ["Triceps", "Shoulders"], "Compound", [], 1, "hpush",
    ["Stand an arm's length from a wall with hands on it at chest height.", "Bend your elbows to bring your chest towards the wall, body straight.", "Push back to the start."],
    ["Letting your hips sag.", "Flaring your elbows straight out."],
    "Step further from the wall to make it harder.", { harder: "knee-pushup" }),
  x("knee-pushup", "Knee push-up", "Chest", ["Triceps", "Shoulders"], "Compound", [], 1, "hpush",
    ["Kneel and place your hands slightly wider than your shoulders.", "Keep a straight line from knees to head and lower your chest to the floor.", "Push back up."],
    ["Bending at the hips.", "Letting your head drop."],
    "Put a folded towel under your knees.", { easier: "wall-pushup", harder: "pushup", avoid: [WRIST] }),
  x("pushup", "Push-up", "Chest", ["Triceps", "Shoulders", "Abs and core"], "Compound", [], 2, "hpush",
    ["Hands slightly wider than shoulders, body straight from head to heels.", "Lower your chest with elbows about 45 degrees from your body.", "Push the floor away to straighten your arms."],
    ["Hips sagging or sticking up.", "Only doing half the movement."],
    "If your wrists hurt, hold dumbbells or push-up handles to keep them straight.", { easier: "knee-pushup", harder: "decline-pushup", avoid: [WRIST, SHOULDER] }),
  x("decline-pushup", "Feet-elevated push-up", "Chest", ["Shoulders", "Triceps"], "Compound", [], 3, "hpush",
    ["Place your feet on a step or bench and your hands on the floor.", "Lower your chest with a straight body.", "Push back up."],
    ["Hips sagging.", "Elbows flaring straight out."],
    "Use a stable surface that won't slide.", { easier: "pushup", avoid: [WRIST, SHOULDER] }),
  x("db-floor-press", "Dumbbell floor press", "Chest", ["Triceps", "Shoulders"], "Compound", ["dumbbell"], 1, "hpush",
    ["Lie on the floor with knees bent and a dumbbell in each hand above your chest.", "Lower until your upper arms touch the floor.", "Press back up until your arms are straight."],
    ["Bouncing your elbows off the floor.", "Letting the weights drift towards your face."],
    "Shoulder-friendly, because the floor limits how far you lower.", { harder: "db-bench" }),
  x("db-bench", "Dumbbell bench press", "Chest", ["Triceps", "Shoulders"], "Compound", ["dumbbell", "bench"], 1, "hpush",
    ["Lie on a flat bench with a dumbbell in each hand at chest level.", "Press the weights up over your chest.", "Lower slowly until your elbows are just below the bench."],
    ["Arching your back a lot.", "Dropping the weights too fast."],
    "Bring the dumbbells to your chest before sitting up.", { easier: "db-floor-press", harder: "bb-bench", avoid: [SHOULDER] }),
  x("incline-db", "Incline dumbbell press", "Chest", ["Shoulders", "Triceps"], "Compound", ["dumbbell", "bench"], 2, "hpush",
    ["Set a bench to a 30–45 degree incline and lie back with dumbbells at your chest.", "Press up over your upper chest.", "Lower slowly with control."],
    ["Setting the bench too steep.", "Flaring your elbows straight out."],
    "Keep your shoulder blades pulled back and down.", { easier: "db-bench", avoid: [SHOULDER] }),
  x("bb-bench", "Barbell bench press", "Chest", ["Triceps", "Shoulders"], "Compound", ["barbell", "bench", "rack"], 2, "hpush",
    ["Lie on the bench with your eyes under the bar and feet flat.", "Grip a little wider than shoulder width, unrack, and lower the bar to your mid-chest.", "Press up and slightly back to the start."],
    ["Bouncing the bar off your chest.", "Lifting your hips off the bench."],
    "Use a spotter or safety bars when lifting heavy.", { easier: "db-bench", avoid: [SHOULDER] }),
  x("machine-press", "Machine chest press", "Chest", ["Triceps", "Shoulders"], "Compound", ["machine"], 1, "hpush",
    ["Adjust the seat so the handles line up with your mid-chest.", "Press forward until your arms are almost straight.", "Return slowly."],
    ["Seat set too high or low.", "Letting the weight stack slam."],
    "A safe way to train your chest without a spotter."),
  x("band-press", "Band chest press", "Chest", ["Triceps", "Shoulders"], "Compound", ["band"], 1, "hpush",
    ["Anchor the band behind you at chest height and hold an end in each hand.", "Step forward to create tension and press your hands forward.", "Return slowly."],
    ["Arching your back.", "Letting the band snap back."],
    "Make sure the anchor point is secure."),
  x("db-fly", "Dumbbell fly", "Chest", ["Shoulders"], "Isolation", ["dumbbell", "bench"], 2, "chestIso",
    ["Lie on a bench with dumbbells above your chest, elbows slightly bent.", "Open your arms in a wide arc until you feel a chest stretch.", "Squeeze your chest to bring them back together."],
    ["Straightening your arms fully.", "Going too heavy and lowering too far."],
    "Use light weights and a comfortable range.", { avoid: [SHOULDER] }),
  x("cable-fly", "Cable fly", "Chest", ["Shoulders"], "Isolation", ["cable"], 2, "chestIso",
    ["Set both cables at shoulder height and take a handle in each hand.", "Step forward and bring your hands together in front of your chest in an arc.", "Open back out slowly."],
    ["Bending and straightening your elbows like a press.", "Leaning too far forward."],
    "Keep a slight bend in your elbows throughout.", { avoid: [SHOULDER] }),
  x("pec-deck", "Pec deck", "Chest", ["Shoulders"], "Isolation", ["machine"], 1, "chestIso",
    ["Sit with your back flat and forearms or hands on the pads.", "Bring the pads together in front of your chest.", "Open back slowly until you feel a light stretch."],
    ["Letting the weight pull your shoulders too far back.", "Rushing the reps."],
    "Set the seat so your hands are at chest height."),

  /* ---------- Shoulders ---------- */
  x("wall-slide", "Wall slide", "Shoulders", ["Back"], "Isolation", [], 1, "vpush",
    ["Stand with your back against a wall, arms bent in a goalpost shape against it.", "Slide your arms up the wall as far as you can while keeping contact.", "Slide back down slowly."],
    ["Arching your lower back off the wall.", "Shrugging your shoulders up."],
    "Only go as high as you can without pain."),
  x("pike-pushup", "Pike push-up", "Shoulders", ["Triceps"], "Compound", [], 2, "vpush",
    ["Start in a push-up position, then walk your feet in so your hips are high.", "Bend your elbows to lower your head towards the floor.", "Push back up."],
    ["Letting your elbows flare out wide.", "Dropping your hips."],
    "Lower slowly so your head never bumps the floor.", { avoid: [SHOULDER, WRIST, NECK] }),
  x("db-ohp", "Seated dumbbell shoulder press", "Shoulders", ["Triceps"], "Compound", ["dumbbell"], 1, "vpush",
    ["Sit tall with dumbbells at shoulder height, palms forward.", "Press the weights overhead until your arms are straight.", "Lower slowly back to your shoulders."],
    ["Arching your lower back.", "Clanging the weights together at the top."],
    "Keep your stomach braced and your ribs down.", { harder: "bb-ohp", avoid: [SHOULDER] }),
  x("bb-ohp", "Barbell overhead press", "Shoulders", ["Triceps", "Abs and core"], "Compound", ["barbell"], 2, "vpush",
    ["Stand with the bar on your upper chest, hands just outside your shoulders.", "Brace and press the bar straight up, moving your head back slightly to let it pass.", "Lower it with control to your chest."],
    ["Leaning back a lot.", "Pressing the bar out in front of you."],
    "Squeeze your glutes to protect your lower back.", { easier: "db-ohp", avoid: [SHOULDER, LOWBACK] }),
  x("machine-shoulder", "Machine shoulder press", "Shoulders", ["Triceps"], "Compound", ["machine"], 1, "vpush",
    ["Adjust the seat so the handles start at shoulder height.", "Press up until your arms are almost straight.", "Lower slowly."],
    ["Seat set too low.", "Locking your elbows hard."],
    "Use a weight you can press smoothly.", { avoid: [SHOULDER] }),
  x("band-ohp", "Band overhead press", "Shoulders", ["Triceps"], "Compound", ["band"], 1, "vpush",
    ["Stand on the band and hold the ends at your shoulders.", "Press your hands overhead.", "Lower slowly to your shoulders."],
    ["Arching your back.", "Letting the band pull your arms down fast."],
    "Check the band for tears before use.", { avoid: [SHOULDER] }),
  x("lateral-raise", "Dumbbell lateral raise", "Shoulders", [], "Isolation", ["dumbbell"], 1, "shoulderIso",
    ["Stand with light dumbbells at your sides.", "Raise your arms out to the sides to shoulder height, elbows slightly bent.", "Lower slowly."],
    ["Swinging the weights up.", "Shrugging your shoulders."],
    "Light weights work best here."),
  x("band-lateral", "Band lateral raise", "Shoulders", [], "Isolation", ["band"], 1, "shoulderIso",
    ["Stand on the band and hold an end in each hand at your sides.", "Raise your arms out to shoulder height.", "Lower slowly."],
    ["Shrugging.", "Using momentum."],
    "Use a light band and keep your elbows soft."),
  x("cable-lateral", "Cable lateral raise", "Shoulders", [], "Isolation", ["cable"], 2, "shoulderIso",
    ["Stand side-on to a low cable and hold the handle with your far hand.", "Raise your arm out to shoulder height.", "Lower slowly and switch sides after your set."],
    ["Leaning away to cheat the weight up.", "Raising above shoulder height."],
    "Keep the movement smooth and controlled."),
  x("prone-yt", "Prone Y-T raise", "Shoulders", ["Back"], "Isolation", [], 1, "rearDelt",
    ["Lie face down with your arms stretched overhead in a Y shape, thumbs up.", "Lift your arms off the floor, hold for a second and lower.", "Repeat with your arms out to the sides in a T shape."],
    ["Lifting your head and straining your neck.", "Rushing the reps."],
    "Keep the lift small and controlled."),
  x("band-pull-apart", "Band pull-apart", "Shoulders", ["Back"], "Isolation", ["band"], 1, "rearDelt",
    ["Hold a band in front of your chest with straight arms.", "Pull it apart by squeezing your shoulder blades together.", "Return slowly."],
    ["Shrugging your shoulders.", "Bending your elbows a lot."],
    "Great for posture. Use a light band."),
  x("face-pull", "Cable face pull", "Shoulders", ["Back"], "Isolation", ["cable"], 1, "rearDelt",
    ["Set a rope at upper-chest height and grip it with thumbs pointing back.", "Pull towards your face, elbows high, separating the rope ends.", "Return slowly."],
    ["Leaning back to pull.", "Going too heavy."],
    "Light weight, slow reps."),
  x("rear-fly", "Dumbbell rear delt fly", "Shoulders", ["Back"], "Isolation", ["dumbbell"], 1, "rearDelt",
    ["Hinge forward with a flat back, light dumbbells hanging below your chest.", "Raise your arms out to the sides, leading with your elbows.", "Lower slowly."],
    ["Rounding your back.", "Swinging the weights."],
    "Rest your head on an incline bench if your lower back gets tired."),

  /* ---------- Back (rows) ---------- */
  x("door-row", "Doorframe row", "Back", ["Biceps"], "Compound", [], 1, "hpull",
    ["Stand facing a solid doorframe and grip both sides at chest height.", "Walk your feet closer and lean back with straight arms.", "Pull your chest towards the frame by squeezing your shoulder blades."],
    ["Letting your hips sag.", "Pulling with your arms only."],
    "Make sure your grip is firm before leaning back.", { harder: "inverted-row" }),
  x("inverted-row", "Inverted row", "Back", ["Biceps", "Shoulders"], "Compound", [], 2, "hpull",
    ["Lie under a sturdy table or low bar and grip the edge with both hands.", "Keep your body straight and pull your chest up towards it.", "Lower slowly."],
    ["Hips dropping.", "Shrugging your shoulders."],
    "Test that the table or bar can safely take your weight first.", { easier: "door-row" }),
  x("db-row", "One-arm dumbbell row", "Back", ["Biceps"], "Compound", ["dumbbell"], 1, "hpull",
    ["Put one hand and knee on a bench or chair, back flat.", "Pull the dumbbell towards your hip.", "Lower slowly and switch sides after your set."],
    ["Twisting your body to lift.", "Rounding your back."],
    "Keep your neck in line with your back.", { harder: "bb-row" }),
  x("bb-row", "Barbell bent-over row", "Back", ["Biceps", "Hamstrings"], "Compound", ["barbell"], 2, "hpull",
    ["Hold a barbell and hinge forward with a flat back, knees slightly bent.", "Pull the bar to your lower ribs.", "Lower with control."],
    ["Standing up as you pull.", "Rounding your back."],
    "Use a weight you can row without your back moving.", { easier: "db-row", avoid: [LOWBACK, UPBACK] }),
  x("cable-row", "Seated cable row", "Back", ["Biceps"], "Compound", ["cable"], 1, "hpull",
    ["Sit tall with feet on the platform and knees slightly bent.", "Pull the handle to your stomach, squeezing your shoulder blades.", "Return slowly, letting your arms straighten."],
    ["Rocking back and forth.", "Shrugging."],
    "Keep your back upright throughout."),
  x("band-row", "Band seated row", "Back", ["Biceps"], "Compound", ["band"], 1, "hpull",
    ["Sit with legs straight and loop the band around your feet.", "Pull the ends towards your stomach.", "Return slowly."],
    ["Leaning back to pull.", "Rounding your shoulders."],
    "Make sure the band can't slip off your feet."),
  x("machine-row", "Chest-supported machine row", "Back", ["Biceps"], "Compound", ["machine"], 1, "hpull",
    ["Set the seat so the chest pad supports you and handles are at arm's reach.", "Pull the handles back by squeezing your shoulder blades.", "Return slowly."],
    ["Lifting your chest off the pad.", "Jerking the weight."],
    "Great for protecting your lower back."),

  /* ---------- Back (vertical pull) ---------- */
  x("scap-pullup", "Scapular pull-up", "Back", ["Shoulders", "Forearms"], "Isolation", ["pullup"], 1, "vpull",
    ["Hang from the bar with straight arms.", "Pull your shoulder blades down and together so your body rises slightly.", "Relax back down with control."],
    ["Bending your elbows.", "Swinging."],
    "Use a step to get on and off the bar.", { harder: "negative-pullup" }),
  x("negative-pullup", "Negative pull-up", "Back", ["Biceps"], "Compound", ["pullup"], 2, "vpull",
    ["Use a step to get your chin above the bar.", "Lower yourself as slowly as you can, about 3–5 seconds.", "Step back up and repeat."],
    ["Dropping quickly.", "Swinging your legs."],
    "Stop if your shoulders hurt.", { easier: "scap-pullup", harder: "pullup", avoid: [SHOULDER] }),
  x("pullup", "Pull-up", "Back", ["Biceps", "Forearms"], "Compound", ["pullup"], 3, "vpull",
    ["Hang from the bar, palms facing away, hands a little wider than shoulders.", "Pull your chest towards the bar until your chin is above it.", "Lower all the way down with control."],
    ["Kicking or swinging.", "Doing half reps."],
    "Build up with negatives if you can't do one yet.", { easier: "negative-pullup", avoid: [SHOULDER, WRIST, UPBACK] }),
  x("chinup", "Chin-up", "Back", ["Biceps"], "Compound", ["pullup"], 3, "vpull",
    ["Hang from the bar with palms facing you, hands shoulder-width.", "Pull until your chin is above the bar.", "Lower slowly to straight arms."],
    ["Swinging.", "Not straightening your arms at the bottom."],
    "Usually a little easier than a pull-up.", { easier: "negative-pullup", avoid: [SHOULDER, WRIST] }),
  x("lat-pulldown", "Lat pulldown", "Back", ["Biceps"], "Compound", ["cable"], 1, "vpull",
    ["Sit with your thighs under the pads and grip the bar a little wider than shoulders.", "Pull the bar to your upper chest, leading with your elbows.", "Let it rise slowly until your arms are straight."],
    ["Leaning far back.", "Pulling the bar behind your neck."],
    "Always pull to the front of your body."),
  x("band-pulldown", "Band lat pulldown", "Back", ["Biceps"], "Compound", ["band"], 1, "vpull",
    ["Anchor the band high (over a door with a door anchor) and kneel facing it.", "Pull your hands down towards your chest.", "Return slowly."],
    ["Shrugging up.", "Leaning back."],
    "Make sure the anchor is secure before pulling."),

  /* ---------- Arms ---------- */
  x("db-curl", "Dumbbell curl", "Biceps", ["Forearms"], "Isolation", ["dumbbell"], 1, "biceps",
    ["Stand with dumbbells at your sides, palms forward.", "Curl the weights up by bending your elbows.", "Lower slowly."],
    ["Swinging your body.", "Moving your elbows forward."],
    "Keep your elbows by your sides."),
  x("hammer-curl", "Hammer curl", "Biceps", ["Forearms"], "Isolation", ["dumbbell"], 1, "biceps",
    ["Hold dumbbells at your sides, palms facing each other.", "Curl up, keeping your palms facing in.", "Lower slowly."],
    ["Swinging.", "Rushing the lowering."],
    "Also works your forearms."),
  x("bb-curl", "Barbell curl", "Biceps", ["Forearms"], "Isolation", ["barbell"], 1, "biceps",
    ["Hold a barbell with palms up, hands shoulder-width.", "Curl it to your chest.", "Lower slowly to straight arms."],
    ["Leaning back to lift it.", "Bouncing at the bottom."],
    "Use an EZ bar if straight bars bother your wrists.", { avoid: [WRIST] }),
  x("cable-curl", "Cable curl", "Biceps", [], "Isolation", ["cable"], 1, "biceps",
    ["Stand facing a low cable with a bar attached.", "Curl the bar up to your chest.", "Lower slowly."],
    ["Leaning back.", "Elbows drifting forward."],
    "The cable keeps tension on the muscle the whole time."),
  x("band-curl", "Band curl", "Biceps", [], "Isolation", ["band"], 1, "biceps",
    ["Stand on the band and hold the ends, palms forward.", "Curl your hands up.", "Lower slowly."],
    ["Swinging.", "Letting the band snap down."],
    "Stand on the middle of the band so it's even on both sides."),
  x("chair-dip", "Chair dip", "Triceps", ["Chest", "Shoulders"], "Compound", [], 1, "triceps",
    ["Sit on the edge of a sturdy chair, hands beside your hips.", "Slide off and bend your elbows to lower a little.", "Press back up."],
    ["Going too deep.", "Shrugging your shoulders to your ears."],
    "Keep the range small and pain-free. Use a chair that can't slide.", { harder: "dips", avoid: [SHOULDER, WRIST] }),
  x("close-pushup", "Close-grip push-up", "Triceps", ["Chest"], "Compound", [], 2, "triceps",
    ["Get into a push-up with hands under your shoulders.", "Lower with elbows close to your body.", "Push back up."],
    ["Flaring your elbows out.", "Hips sagging."],
    "Do it from your knees to make it easier.", { avoid: [WRIST] }),
  x("db-oh-ext", "Overhead dumbbell triceps extension", "Triceps", [], "Isolation", ["dumbbell"], 1, "triceps",
    ["Hold one dumbbell overhead with both hands.", "Lower it behind your head by bending your elbows.", "Straighten your arms to lift it back up."],
    ["Elbows flaring wide.", "Arching your lower back."],
    "Start light and keep your elbows pointing up.", { avoid: [SHOULDER] }),
  x("pushdown", "Cable triceps pushdown", "Triceps", [], "Isolation", ["cable"], 1, "triceps",
    ["Stand at a high cable with a bar or rope.", "Push down until your arms are straight, elbows at your sides.", "Let it rise slowly."],
    ["Elbows moving forward.", "Leaning over the weight."],
    "Keep your upper arms still."),
  x("band-pushdown", "Band triceps pushdown", "Triceps", [], "Isolation", ["band"], 1, "triceps",
    ["Anchor the band high and hold the ends.", "Push your hands down until your arms are straight.", "Return slowly."],
    ["Elbows moving.", "Rushing."],
    "Check the anchor is secure."),
  x("dips", "Parallel bar dip", "Triceps", ["Chest", "Shoulders"], "Compound", ["bars"], 3, "triceps",
    ["Support yourself on straight arms between parallel bars.", "Bend your elbows to lower until your upper arms are about parallel to the floor.", "Press back up."],
    ["Going too deep.", "Swinging your legs."],
    "Stop if you feel pain at the front of your shoulders.", { easier: "chair-dip", avoid: [SHOULDER, WRIST] }),
  x("skull-crusher", "Dumbbell skull crusher", "Triceps", [], "Isolation", ["dumbbell", "bench"], 2, "triceps",
    ["Lie on a bench holding dumbbells above your chest, palms facing in.", "Bend your elbows to lower the weights beside your head.", "Straighten your arms."],
    ["Elbows flaring out.", "Going too heavy."],
    "Control the weights near your head.", { avoid: [WRIST] }),
  x("farmer-carry", "Farmer's carry", "Forearms", ["Shoulders", "Abs and core"], "Compound", ["dumbbell"], 1, "forearm",
    ["Pick up heavy dumbbells, one in each hand.", "Walk tall with your shoulders back.", "Set them down with a flat back."],
    ["Leaning to one side.", "Shrugging up."],
    "Make sure your path is clear.", { unit: "sec" }),
  x("dead-hang", "Dead hang", "Forearms", ["Back", "Shoulders"], "Isolation", ["pullup"], 1, "forearm",
    ["Grip the bar with both hands.", "Hang with relaxed legs and active shoulders.", "Step down safely when your grip tires."],
    ["Dropping off suddenly.", "Fully relaxing your shoulders."],
    "Use a step to get on and off.", { unit: "sec", avoid: [SHOULDER] }),

  /* ---------- Core ---------- */
  x("dead-bug", "Dead bug", "Abs and core", [], "Isolation", [], 1, "core",
    ["Lie on your back, arms up, knees bent at 90 degrees above your hips.", "Press your lower back into the floor and slowly extend the opposite arm and leg.", "Return and switch sides."],
    ["Lower back lifting off the floor.", "Moving too fast."],
    "Move slowly and breathe out as you extend."),
  x("plank", "Plank", "Abs and core", ["Shoulders"], "Isolation", [], 1, "core",
    ["Rest on your forearms and toes with your body in a straight line.", "Tighten your stomach and glutes.", "Hold and breathe steadily."],
    ["Hips sagging.", "Holding your breath."],
    "Drop to your knees to make it easier.", { harder: "side-plank", unit: "sec" }),
  x("side-plank", "Side plank", "Abs and core", ["Shoulders"], "Isolation", [], 2, "core",
    ["Lie on your side and prop yourself up on one forearm.", "Lift your hips into a straight line.", "Hold, then switch sides."],
    ["Hips dropping.", "Rolling forward."],
    "Bend your knees to make it easier.", { easier: "plank", unit: "sec", avoid: [SHOULDER] }),
  x("bird-dog", "Bird dog", "Abs and core", ["Glutes", "Back"], "Isolation", [], 1, "core",
    ["Start on hands and knees.", "Slowly reach one arm forward and the opposite leg back.", "Return and switch sides."],
    ["Arching your back.", "Twisting your hips."],
    "Keep your back flat like a table."),
  x("crunch", "Crunch", "Abs and core", [], "Isolation", [], 1, "core",
    ["Lie on your back, knees bent, hands lightly beside your head.", "Curl your shoulders off the floor using your stomach.", "Lower slowly."],
    ["Pulling on your neck.", "Coming all the way up."],
    "Keep your chin slightly tucked.", { avoid: [NECK] }),
  x("leg-raise", "Lying leg raise", "Abs and core", [], "Isolation", [], 2, "core",
    ["Lie on your back with your hands under your hips.", "Keep your lower back down and raise straight legs to vertical.", "Lower slowly without touching the floor."],
    ["Arching your lower back.", "Dropping your legs fast."],
    "Bend your knees to make it easier.", { easier: "dead-bug", avoid: [LOWBACK] }),
  x("hanging-knee", "Hanging knee raise", "Abs and core", ["Forearms"], "Isolation", ["pullup"], 2, "core",
    ["Hang from a bar with straight arms.", "Raise your knees towards your chest.", "Lower slowly without swinging."],
    ["Swinging.", "Using momentum."],
    "Use a step to get on and off the bar.", { easier: "dead-bug", avoid: [SHOULDER] }),
  x("pallof", "Band Pallof press", "Abs and core", [], "Isolation", ["band"], 1, "core",
    ["Anchor a band at chest height and stand side-on to it.", "Hold the band at your chest and press it straight out.", "Resist the twist, return, and switch sides."],
    ["Letting your body rotate.", "Standing too close to the anchor."],
    "A gentle, back-friendly core exercise."),

  /* ---------- Cardio ---------- */
  x("march", "Marching on the spot", "Full body", ["Calves"], "Cardio", [], 1, "cardio",
    ["Stand tall and march, lifting your knees.", "Swing your arms naturally.", "Speed up to raise your heart rate."],
    ["Slouching.", "Holding your breath."],
    "A low-impact option that's kind to knees.", { harder: "brisk-walk", unit: "min" }),
  x("brisk-walk", "Brisk walk", "Full body", ["Calves", "Glutes"], "Cardio", [], 1, "cardio",
    ["Walk at a pace where talking is possible but slightly harder.", "Swing your arms.", "Keep a steady rhythm."],
    ["Walking too slowly to raise your heart rate.", "Looking down at your phone."],
    "Wear comfortable shoes and walk in safe, well-lit areas.", { harder: "jog", unit: "min" }),
  x("jog", "Jogging", "Full body", ["Calves", "Quadriceps"], "Cardio", [], 2, "cardio",
    ["Jog at an easy pace where you can still speak in short sentences.", "Land softly under your body.", "Walk for a minute whenever you need to."],
    ["Starting too fast.", "Overstriding."],
    "Build distance slowly from week to week.", { easier: "brisk-walk", unit: "min", avoid: [KNEE, ANKLE] }),
  x("jacks", "Jumping jacks", "Full body", ["Calves", "Shoulders"], "Cardio", [], 1, "cardio",
    ["Jump your feet out as your arms go overhead.", "Jump back in as your arms come down.", "Keep a steady rhythm."],
    ["Landing with stiff legs.", "Going faster than you can control."],
    "Step side to side instead for a low-impact version.", { unit: "sec", avoid: [KNEE, ANKLE] }),
  x("climbers", "Mountain climbers", "Full body", ["Abs and core", "Shoulders"], "Cardio", [], 2, "cardio",
    ["Start in a high plank.", "Drive one knee towards your chest, then switch quickly.", "Keep your hips level."],
    ["Hips bouncing up.", "Hands too far forward."],
    "Slow down if your form breaks.", { unit: "sec", avoid: [WRIST, SHOULDER] }),
  x("burpee", "Burpee", "Full body", ["Chest", "Quadriceps"], "Cardio", [], 3, "cardio",
    ["Squat down and place your hands on the floor.", "Jump or step your feet back into a plank.", "Return your feet and stand or jump up."],
    ["Collapsing in the plank.", "Landing heavily."],
    "Step instead of jumping to make it easier.", { avoid: [KNEE, WRIST, SHOULDER, LOWBACK] }),
  x("skipping", "Skipping rope", "Full body", ["Calves"], "Cardio", ["rope"], 2, "cardio",
    ["Hold the handles at hip height and turn the rope with your wrists.", "Jump just high enough for the rope to pass.", "Land softly on the balls of your feet."],
    ["Jumping too high.", "Turning the rope with your whole arms."],
    "Skip on a flat, non-slippery surface.", { unit: "min", avoid: [KNEE, ANKLE] }),
  x("bike", "Stationary bike", "Full body", ["Quadriceps"], "Cardio", ["cardio"], 1, "cardio",
    ["Set the seat so your knee is slightly bent at the bottom of the pedal stroke.", "Pedal at a steady pace.", "Add resistance as you get fitter."],
    ["Seat set too low.", "Bouncing in the saddle."],
    "A joint-friendly cardio choice.", { unit: "min" }),
  x("stair-climb", "Stair climbing", "Full body", ["Quadriceps", "Glutes", "Calves"], "Cardio", ["stairs"], 2, "cardio",
    ["Walk up stairs at a steady pace.", "Use the rail for balance.", "Walk down slowly to recover."],
    ["Rushing the way down.", "Leaning heavily on the rail."],
    "Take it slowly at first.", { unit: "min", avoid: [KNEE] }),
  x("rower", "Rowing machine", "Full body", ["Back", "Quadriceps"], "Cardio", ["cardio"], 2, "cardio",
    ["Push with your legs first, then lean back slightly and pull the handle to your ribs.", "Reverse the order to return: arms, body, then legs.", "Keep a smooth rhythm."],
    ["Pulling with your arms first.", "Rounding your back."],
    "Keep your back straight throughout.", { unit: "min", avoid: [LOWBACK] }),
];

const MAP: Record<string, Exercise> = Object.fromEntries(EXERCISES.map((e) => [e.id, e]));
export const byId = (id: string): Exercise | undefined => MAP[id];

export function kindOf(ex: Exercise): string {
  if (ex.type === "Cardio") return "Cardio";
  if (ex.equipment.includes("barbell")) return "Barbell";
  if (ex.equipment.includes("machine")) return "Machine";
  if (ex.equipment.includes("cable")) return "Cable";
  if (ex.equipment.includes("dumbbell")) return "Dumbbell";
  if (ex.equipment.includes("kettlebell")) return "Kettlebell";
  if (ex.equipment.includes("band")) return "Band";
  return "Bodyweight";
}

// Demonstration videos: opens a YouTube search for the exercise
export const demoUrl = (ex: Exercise) =>
  `https://www.youtube.com/results?search_query=${encodeURIComponent(`${ex.name} exercise proper form`)}`;