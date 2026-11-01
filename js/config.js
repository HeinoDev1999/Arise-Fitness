/* =====================================================================
   THE SYSTEM — Solo Leveling style fitness tracker
   config.js — constants, data tables & pure level/title math
   (loaded first; everything else builds on this)
   ===================================================================== */

const SAVE_KEY = "solo_system_v1";

/* ---------- Stat definitions ---------- */
const STATS = {
  STR: { name: "STR", full: "Strength",     desc: "Power & muscle" },
  AGI: { name: "AGI", full: "Agility",      desc: "Speed & explosiveness" },
  VIT: { name: "VIT", full: "Vitality",     desc: "Endurance & fat-burn" },
  SEN: { name: "SEN", full: "Sense",        desc: "Mobility & recovery" },
  INT: { name: "INT", full: "Intelligence", desc: "Diet & discipline" },
};
const STAT_COLOR = { STR:"#ff7a7a", AGI:"#7affb0", VIT:"#ffd76a", SEN:"#b69cff", INT:"#7fe2ff" };

/* ---------- Stat tiers (make a 0–130 score mean something) ----------
   A benchmark's "solid" value scores 50 = Intermediate; double ~100. ---------- */
const STAT_TIERS = [
  { min:110, label:"World-class" },
  { min:85,  label:"Elite" },
  { min:70,  label:"Advanced" },
  { min:50,  label:"Intermediate" },
  { min:30,  label:"Beginner" },
  { min:1,   label:"Novice" },
];

/* ---------- Ranks (by level) ---------- */
const RANKS = [
  { rank: "E", min: 1 }, { rank: "D", min: 6 }, { rank: "C", min: 11 },
  { rank: "B", min: 21 }, { rank: "A", min: 36 }, { rank: "S", min: 56 },
];
function rankForLevel(lvl){ let r="E"; for(const x of RANKS){ if(lvl>=x.min) r=x.rank; } return r; }

/* ---------- Titles (by level milestones) ---------- */
const TITLES = [
  { min: 1,  title: "The Weakest" },
  { min: 3,  title: "Awakened" },
  { min: 6,  title: "Rising Hunter" },
  { min: 11, title: "Seasoned Hunter" },
  { min: 16, title: "Skilled Hunter" },
  { min: 21, title: "Elite Hunter" },
  { min: 28, title: "Veteran Hunter" },
  { min: 36, title: "Shadow Sovereign" },
  { min: 46, title: "Monarch's Vessel" },
  { min: 56, title: "Monarch" },
  { min: 70, title: "Shadow Monarch" },
];
/* ---------- Streak titles (override the level title when earned) ---------- */
const STREAK_TITLES = [
  { min: 7,   title: "The Persistent" },
  { min: 14,  title: "The Unwavering" },
  { min: 30,  title: "The Relentless" },
  { min: 60,  title: "The Unstoppable" },
  { min: 100, title: "The Eternal" },
];
function titleFor(lvl, streak){
  let st = null;
  for(const x of STREAK_TITLES){ if((streak||0) >= x.min) st = x.title; }
  if(st) return st;
  let t = TITLES[0].title;
  for(const x of TITLES){ if(lvl >= x.min) t = x.title; }
  return t;
}

/* ---------- XP curve ---------- */
function xpForLevel(lvl){ return Math.round(80 + (lvl - 1) * 45 + Math.pow(lvl, 1.45) * 6); }

/* ---------- Exercise library ----------
   loc:  which locations it's valid for
   stat: which stat it trains
   unit: how target is expressed ('reps','sec','min','km','x','sets','flag')
   base: base target at "standard" mode (reps for 'sets')
   need: equipment required   how: how to perform   tip: a form cue
   ----------------------------------------- */
const EXERCISES = [
  /* ---- STRENGTH: bodyweight — PUSH (chest / shoulders / triceps) ---- */
  { id:"pushups", name:"Push-ups", stat:"STR", splits:["upper","push"], muscles:["chest","triceps","shoulders"], loc:["home","outdoor","gym"], unit:"reps", base:25, xp:18,
    need:"Nothing — just floor space.",
    how:"Hands shoulder-width, body in a straight line from head to heels. Lower your chest to just above the floor, then push back up.",
    tip:"Keep your core braced so your hips don't sag. Drop to your knees if you need to." },
  { id:"diamond", name:"Diamond Push-ups", stat:"STR", splits:["upper","push"], muscles:["triceps","chest"], loc:["home","outdoor","gym"], unit:"reps", base:15, xp:18,
    need:"Nothing.",
    how:"Push-up with your hands close together under your chest forming a diamond. Lower and press back up.",
    tip:"Targets your triceps hard — keep your elbows tucked close to your body." },
  { id:"pike", name:"Pike Push-ups", stat:"STR", splits:["upper","push"], muscles:["shoulders","triceps"], loc:["home","outdoor","gym"], unit:"reps", base:15, xp:18,
    need:"Nothing.",
    how:"Start in a downward-dog shape (hips high, body like an upside-down V). Bend your elbows to lower the top of your head toward the floor, then press back up.",
    tip:"The higher you pike your hips, the more it targets your shoulders." },
  { id:"dips", name:"Tricep Dips", stat:"STR", splits:["upper","push"], muscles:["triceps","chest"], loc:["home","outdoor","gym"], unit:"reps", base:15, xp:18,
    need:"A sturdy chair, bench, or step.",
    how:"Hands on the edge behind you, legs out front. Bend your elbows to lower your hips, then press back up.",
    tip:"Keep your elbows pointing back, not flaring out to the sides." },

  /* ---- STRENGTH: bodyweight — PULL (back / biceps) ---- */
  { id:"invrows", name:"Inverted Rows", stat:"STR", splits:["upper","pull"], muscles:["back","biceps"], loc:["home","outdoor","gym"], unit:"reps", base:12, xp:18,
    need:"A sturdy table edge or a low bar.",
    how:"Lie under a table/bar, grip the edge, body straight, and pull your chest up to it, then lower under control.",
    tip:"Squeeze your shoulder blades together at the top." },
  { id:"superman", name:"Supermans", stat:"STR", splits:["upper","pull"], muscles:["back"], loc:["home","outdoor","gym"], unit:"reps", base:15, xp:12,
    need:"A mat is optional.",
    how:"Lie face-down, arms extended ahead. Lift your arms, chest and legs off the floor, hold a beat, then lower.",
    tip:"Strengthens your lower back and rear chain — move slowly, don't jerk." },

  /* ---- STRENGTH: bodyweight — LOWER (legs / glutes) ---- */
  { id:"squats", name:"Bodyweight Squats", stat:"STR", splits:["lower"], muscles:["quads","glutes"], loc:["home","outdoor","gym"], unit:"reps", base:35, xp:16,
    need:"Nothing.",
    how:"Feet shoulder-width, toes slightly out. Sit your hips back and down until thighs are roughly parallel to the floor, then drive through your heels to stand.",
    tip:"Knees track over your toes, chest up the whole time." },
  { id:"lunges", name:"Lunges", stat:"STR", splits:["lower"], muscles:["quads","glutes"], loc:["home","outdoor","gym"], unit:"reps", base:24, xp:16,
    need:"A bit of space to step forward.",
    how:"Step one foot forward and lower until both knees are about 90°, then push back to standing. Alternate legs — count is total reps.",
    tip:"Keep your front knee behind your toes; torso upright." },
  { id:"bulgarian", name:"Bulgarian Split Squats", stat:"STR", splits:["lower"], muscles:["quads","glutes"], loc:["home","gym"], unit:"reps", base:16, xp:20,
    need:"A chair or bench to rest your back foot on.",
    how:"Back foot up on the bench, lower into a single-leg squat on the front leg, then drive back up. Count is total reps.",
    tip:"Keep most of your weight on the front heel." },
  { id:"glutebr", name:"Glute Bridges", stat:"STR", splits:["lower"], muscles:["glutes","hamstrings"], loc:["home","gym"], unit:"reps", base:30, xp:14,
    need:"A mat is nice but optional.",
    how:"Lie on your back, knees bent, feet flat. Drive your hips up by squeezing your glutes, then lower slowly.",
    tip:"Pause and squeeze hard at the top for a second each rep." },
  { id:"calfraise", name:"Calf Raises", stat:"STR", splits:["lower"], muscles:["calves"], loc:["home","outdoor","gym"], unit:"reps", base:25, xp:12,
    need:"Optional: a step for more range.",
    how:"Stand tall, push up onto the balls of your feet as high as you can, then lower slowly.",
    tip:"Pause at the top and control the way down." },
  { id:"stepups", name:"Step-ups", stat:"STR", splits:["lower"], muscles:["quads","glutes"], loc:["home","outdoor","gym"], unit:"reps", base:20, xp:16,
    need:"A sturdy step, bench, or staircase.",
    how:"Step up fully onto the platform with one leg, stand tall, then step down. Alternate legs — count is total reps.",
    tip:"Drive through the heel of the stepping leg; don't push off the floor." },

  /* ---- STRENGTH: bodyweight — CORE ---- */
  { id:"crunches", name:"Crunches", stat:"STR", splits:["core"], muscles:["core"], loc:["home","outdoor","gym"], unit:"reps", base:25, xp:12,
    need:"A mat is optional.",
    how:"Lie on your back, knees bent. Curl your shoulders off the floor toward your knees, then lower under control.",
    tip:"It's a short curl — don't yank on your neck." },
  { id:"legraises", name:"Leg Raises", stat:"STR", splits:["core"], muscles:["core"], loc:["home","gym"], unit:"reps", base:15, xp:14,
    need:"A mat is optional.",
    how:"Lie flat, legs straight. Raise them to vertical, then lower slowly without letting your heels touch the floor.",
    tip:"Press your lower back into the floor the whole time." },
  { id:"russian", name:"Russian Twists", stat:"STR", splits:["core"], muscles:["core"], loc:["home","outdoor","gym"], unit:"reps", base:30, xp:14,
    need:"Optional: something light to hold.",
    how:"Sit leaning back slightly, feet up. Rotate your torso to tap each side. Count is total taps.",
    tip:"Rotate from your waist, not just your arms." },
  { id:"bicycle", name:"Bicycle Crunches", stat:"STR", splits:["core"], muscles:["core"], loc:["home","outdoor","gym"], unit:"reps", base:30, xp:14,
    need:"A mat is optional.",
    how:"On your back, bring opposite elbow to opposite knee while extending the other leg, alternating like pedaling. Count is total reps.",
    tip:"Slow and controlled beats fast and sloppy." },
  { id:"hollow", name:"Hollow Hold", stat:"STR", splits:["core"], muscles:["core"], loc:["home","gym"], unit:"sec", base:30, xp:16,
    need:"A mat is optional.",
    how:"Lie on your back, press your lower back down, and lift your shoulders and legs slightly off the floor into a shallow banana shape. Hold.",
    tip:"Lower your legs if your back starts to arch off the floor." },

  /* ---- STRENGTH: gym — PUSH ---- */
  { id:"bench", gear:["bench","dumbbells|barbell"], name:"Bench Press", stat:"STR", splits:["upper","push"], muscles:["chest","triceps","shoulders"], loc:["gym"], unit:"sets", base:3, reps:10, xp:24,
    need:"Barbell or dumbbells + a bench.",
    how:"Lie on the bench, lower the bar to mid-chest under control, then press it back up. Pick a weight where the last rep of each set is tough but clean.",
    tip:"Keep your shoulder blades pulled back and feet planted." },
  { id:"ohp", gear:["dumbbells|barbell"], name:"Shoulder Press", stat:"STR", splits:["upper","push"], muscles:["shoulders","triceps"], loc:["gym"], unit:"sets", base:3, reps:10, xp:20,
    need:"Dumbbells or a barbell.",
    how:"From shoulder height, press the weight overhead until your arms are straight, then lower under control.",
    tip:"Brace your core so you don't arch your lower back." },
  { id:"latraise", gear:["dumbbells"], name:"Lateral Raises", stat:"STR", splits:["upper","push"], muscles:["shoulders"], loc:["gym"], unit:"sets", base:3, reps:12, xp:16,
    need:"A pair of dumbbells.",
    how:"Standing, raise the dumbbells out to your sides up to shoulder height, then lower slowly.",
    tip:"Lead with your elbows; use a weight you can control, not swing." },

  /* ---- STRENGTH: gym — PULL ---- */
  { id:"pulldown", gear:["cable|machines"], name:"Lat Pulldown", stat:"STR", splits:["upper","pull"], muscles:["back","biceps"], loc:["gym"], unit:"sets", base:3, reps:10, xp:22,
    need:"Lat pulldown machine.",
    how:"Grip slightly wider than shoulders. Pull the bar to your upper chest while squeezing your back, then control it back up.",
    tip:"Lead the pull with your elbows, not your hands." },
  { id:"pullups", gear:["pullupbar"], name:"Pull-ups", stat:"STR", splits:["upper","pull"], muscles:["back","biceps"], loc:["gym"], unit:"reps", base:8, xp:24,
    need:"A pull-up bar.",
    how:"Hang from the bar, pull your chin above it by driving your elbows down, then lower under control.",
    tip:"Use a band or the assisted-pull-up machine if you need help." },
  { id:"dbrow", gear:["dumbbells"], name:"Dumbbell Rows", stat:"STR", splits:["upper","pull"], muscles:["back","biceps"], loc:["gym"], unit:"sets", base:3, reps:10, xp:20,
    need:"A dumbbell (bench optional).",
    how:"Hinge forward at the hips. Row the dumbbell up to your hip, squeeze, then lower slowly. Do both sides.",
    tip:"Pull with your back muscles, not just your arm." },
  { id:"curls", gear:["dumbbells|barbell"], name:"Bicep Curls", stat:"STR", splits:["upper","pull"], muscles:["biceps"], loc:["gym"], unit:"sets", base:3, reps:12, xp:16,
    need:"Dumbbells or a barbell.",
    how:"Arms at your sides, curl the weight up by bending your elbows, then lower slowly.",
    tip:"Keep your elbows pinned to your sides — don't swing." },
  { id:"facepull", gear:["cable"], name:"Face Pulls", stat:"STR", splits:["upper","pull"], muscles:["shoulders","back"], loc:["gym"], unit:"sets", base:3, reps:15, xp:14,
    need:"A cable machine with a rope.",
    how:"Pull the rope toward your face, splitting your hands apart, squeezing your rear shoulders, then return slowly.",
    tip:"Great for posture and shoulder health — keep it light and controlled." },

  /* ---- STRENGTH: gym — LOWER ---- */
  { id:"legpress", gear:["machines"], name:"Leg Press", stat:"STR", splits:["lower"], muscles:["quads","glutes"], loc:["gym"], unit:"sets", base:3, reps:12, xp:22,
    need:"Leg press machine.",
    how:"Feet shoulder-width on the platform. Lower until your knees reach about 90°, then press without harshly locking your knees.",
    tip:"Don't let your lower back round off the pad." },
  { id:"rdl", gear:["dumbbells|barbell"], name:"Romanian Deadlift", stat:"STR", splits:["lower"], muscles:["hamstrings","glutes"], loc:["gym"], unit:"sets", base:3, reps:10, xp:22,
    need:"A barbell or dumbbells.",
    how:"Slight knee bend, hinge at the hips pushing your butt back, lower the weight along your legs, then drive your hips forward to stand.",
    tip:"Feel the stretch in your hamstrings; keep your back flat." },
  { id:"legcurl", gear:["machines"], name:"Leg Curl", stat:"STR", splits:["lower"], muscles:["hamstrings"], loc:["gym"], unit:"sets", base:3, reps:12, xp:18,
    need:"Leg curl machine.",
    how:"Curl your heels toward your glutes against the pad, then lower under control.",
    tip:"Avoid jerking — squeeze the hamstrings each rep." },

  /* ---- AGILITY: explosive / fast cardio ---- */
  { id:"burpees", name:"Burpees", stat:"AGI", loc:["home","outdoor","gym"], unit:"reps", base:15, xp:22,
    need:"Nothing.",
    how:"Squat and put your hands on the floor, jump your feet back to a plank, (optional push-up), jump your feet back in, then explode up into a jump.",
    tip:"Find a steady rhythm rather than sprinting and burning out." },
  { id:"mtclimb", name:"Mountain Climbers", stat:"AGI", loc:["home","outdoor","gym"], unit:"reps", base:40, xp:16,
    need:"Nothing.",
    how:"In a plank position, drive your knees toward your chest one at a time, quickly, like running in place. Count is total knee-drives.",
    tip:"Keep your hips low and core braced — don't bounce up and down." },
  { id:"jacks", name:"Jumping Jacks", stat:"AGI", loc:["home","outdoor","gym"], unit:"reps", base:50, xp:12,
    need:"Nothing.",
    how:"Jump your feet out wide while raising your arms overhead, then jump back in. Keep a steady rhythm.",
    tip:"Land soft on the balls of your feet." },
  { id:"jumpsq", name:"Jump Squats", stat:"AGI", loc:["home","outdoor","gym"], unit:"reps", base:20, xp:18,
    need:"Nothing.",
    how:"Do a squat, then explode upward into a jump. Land softly and sink straight into the next rep.",
    tip:"Absorb every landing with bent knees to protect your joints." },
  { id:"sprints", name:"Sprint Intervals", stat:"AGI", loc:["outdoor"], unit:"x", base:6, xp:24,
    need:"Open space, a path, or a track.",
    how:"Sprint hard for ~20–30 seconds (or ~50–100m), then walk back to recover. That's one round — repeat for the listed rounds.",
    tip:"Full effort on the sprint, full recovery between. Quality over speed." },
  { id:"hiit", name:"HIIT Cardio", stat:"AGI", loc:["gym","home"], unit:"min", base:10, xp:22,
    need:"Nothing (or a bike/rower).",
    how:"Alternate ~30s of hard effort with ~30s easy for the listed minutes. Use any move — jacks, high knees, bike, rower.",
    tip:"The hard intervals should leave you genuinely breathless." },

  /* ---- VITALITY: endurance / fat-burn ---- */
  { id:"run", gear:["treadmill"], name:"Run", stat:"VIT", loc:["outdoor","gym"], unit:"km", base:2, xp:26,
    need:"Running shoes (or a treadmill).",
    how:"Run the listed distance at a steady pace you could hold a short conversation at.",
    tip:"Start slower than feels necessary — finish strong, not gassed early." },
  { id:"walk", name:"Brisk Walk", stat:"VIT", loc:["outdoor"], unit:"min", base:25, xp:14,
    need:"Comfortable shoes.",
    how:"Walk briskly for the listed time — fast enough that talking is easy but singing isn't.",
    tip:"Pump your arms and keep a quick, purposeful cadence." },
  { id:"plank", name:"Plank Hold", stat:"VIT", loc:["home","outdoor","gym"], unit:"sec", base:50, xp:16,
    need:"A mat is optional.",
    how:"On your forearms and toes, hold your body in a straight line from head to heels for the listed time.",
    tip:"Squeeze your glutes and abs; don't let your hips drop or pike up." },
  { id:"wallsit", name:"Wall Sit", stat:"VIT", loc:["home","gym"], unit:"sec", base:50, xp:14,
    need:"A wall.",
    how:"Slide down a wall until your thighs are parallel to the floor (like sitting in an invisible chair) and hold.",
    tip:"Keep your whole back flat against the wall." },
  { id:"row", gear:["rower"], name:"Rowing Machine", stat:"VIT", loc:["gym"], unit:"min", base:12, xp:22,
    need:"Rowing machine.",
    how:"Row at a steady pace for the listed minutes. Each stroke: drive with your legs, then lean back, then pull with your arms.",
    tip:"It's legs first, not arms first — that's where the power comes from." },
  { id:"bike", gear:["bike"], name:"Cycling", stat:"VIT", loc:["gym","outdoor"], unit:"min", base:20, xp:20,
    need:"A bike or stationary bike.",
    how:"Cycle at a steady, moderate effort for the listed minutes.",
    tip:"Aim for a smooth cadence around 80–90 rpm if you can." },

  /* ---- SENSE: mobility / recovery ---- */
  { id:"stretch", name:"Full-body Stretch", stat:"SEN", loc:["home","outdoor","gym"], unit:"min", base:8, xp:12,
    need:"A mat is optional.",
    how:"Move through stretches for your major muscle groups — legs, hips, back, shoulders — holding each ~30s and breathing slowly.",
    tip:"Stretch to mild tension, never pain." },
  { id:"mobility", name:"Mobility Flow", stat:"SEN", loc:["home","outdoor","gym"], unit:"min", base:8, xp:12,
    need:"Nothing.",
    how:"Do slow, controlled joint circles and dynamic movements for hips, shoulders, spine and ankles for the listed time.",
    tip:"Move slowly through your full available range." },
  { id:"yoga", name:"Yoga / Cool-down", stat:"SEN", loc:["home","outdoor","gym"], unit:"min", base:10, xp:12,
    need:"A mat is optional.",
    how:"Flow gently through poses like cat-cow, downward dog, low lunge and child's pose, syncing movement with your breath.",
    tip:"Focus on slow breathing; don't force any range." },
  { id:"deepsquat", name:"Deep Squat Hold", stat:"SEN", loc:["home","outdoor","gym"], unit:"sec", base:45, xp:12,
    need:"Nothing.",
    how:"Sink into the bottom of a squat and just relax there, letting your hips and ankles open up, for the listed time.",
    tip:"Use your elbows to gently push your knees out; keep your heels down." },
  { id:"wgs", name:"World's Greatest Stretch", stat:"SEN", loc:["home","outdoor","gym"], unit:"reps", base:8, xp:12,
    need:"A bit of floor space.",
    how:"Step into a deep lunge, drop the same-side hand to the floor, then rotate the other arm up to the ceiling. Alternate sides — count is total reps.",
    tip:"Move slowly and breathe into the rotation." },
  { id:"foamroll", name:"Foam Rolling", stat:"SEN", loc:["home","gym"], unit:"min", base:6, xp:10,
    need:"A foam roller.",
    how:"Slowly roll the major muscles (quads, hamstrings, calves, back) for the listed time, pausing on tight spots.",
    tip:"Breathe and ease into tender areas — don't grind hard." },

  /* ---- INTELLIGENCE: diet / discipline habits ---- */
  { id:"water", name:"Drink 2L Water", stat:"INT", loc:["home","outdoor","gym"], unit:"flag", xp:10,
    need:"Water.", how:"Drink at least 2 litres of water across the day.",
    tip:"Keep a bottle visible — out of sight, out of mind." },
  { id:"protein", name:"Hit Protein Goal", stat:"INT", loc:["home","outdoor","gym"], unit:"flag", xp:12,
    need:"—", how:"Get a solid protein intake across your meals (a good target is ~1.6g per kg of bodyweight).",
    tip:"Include a protein source in every meal." },
  { id:"nojunk", name:"No Junk Food", stat:"INT", loc:["home","outdoor","gym"], unit:"flag", xp:12,
    need:"—", how:"Skip processed junk and sugary snacks for the whole day.",
    tip:"Prep a healthy snack so you're not caught hungry." },
  { id:"sleep", name:"Sleep 7+ Hours", stat:"INT", loc:["home","outdoor","gym"], unit:"flag", xp:12,
    need:"—", how:"Get at least 7 hours of sleep tonight.",
    tip:"Screens off ~30 minutes before bed makes this far easier." },
  { id:"steps", name:"10,000 Steps", stat:"INT", loc:["home","outdoor","gym"], unit:"flag", xp:14,
    need:"—", how:"Accumulate at least 10,000 steps over the course of the day.",
    tip:"Short walks after meals add up fast." },
];
const EX_BY_ID = Object.fromEntries(EXERCISES.map(e => [e.id, e]));

/* ---------- Experience levels ----------
   mult:  scales every rep / duration / distance target
   sets:  scales gym set counts (clamped to 2–4)
   EXP is deliberately NOT scaled: a beginner doing their (smaller) quest
   earns the same EXP, because EXP measures effort & consistency. ---------- */
const EXPERIENCE = {
  beginner:     { label:"Beginner",     desc:"New to training, or a long break", mult:0.6,  sets:0.67 },
  intermediate: { label:"Intermediate", desc:"Train some, comfortable with basics", mult:0.85, sets:1.0 },
  advanced:     { label:"Advanced",     desc:"Train consistently, want a challenge", mult:1.15, sets:1.33 },
};
const DEFAULT_EXPERIENCE = "intermediate";

/* Exercises where you move your own bodyweight: heavier = harder, lighter = easier.
   Reps for these get a gentle, capped bodyweight adjustment (see weightFactor). */
const BW_LOADED = new Set([
  "pushups","diamond","pike","dips","invrows","pullups","squats","lunges","bulgarian",
  "stepups","burpees","mtclimb","jumpsq","jacks","run",
]);
const REF_WEIGHT_KG = 75;   // the weight the base numbers are tuned for

/* Too demanding for someone just starting out — left out of Beginner quests
   (only when enough easier options exist for that location/focus). */
const BEGINNER_SKIP = new Set([
  "pullups","burpees","pike","diamond","bulgarian","hollow","sprints","jumpsq","dips",
]);

/* ---------- Gym equipment ----------
   Gym quests only use exercises whose equipment you've ticked in Settings.
   An exercise's `gear` lists requirements; "a|b" means either one works.
   (Only checked at the gym — bodyweight moves and outdoor/home are unaffected.) */
const EQUIPMENT = {
  dumbbells: "Dumbbells",
  barbell:   "Barbell & plates",
  bench:     "Bench",
  cable:     "Cable machine",
  machines:  "Weight machines (leg press, leg curl, lat pulldown)",
  pullupbar: "Pull-up bar",
  treadmill: "Treadmill",
  bike:      "Exercise bike",
  rower:     "Rowing machine",
};

/* ---------- Mode (time) config ---------- */
const MODES = {
  quick:    { label:"Quick",    count:3, mult:0.6,  habits:1 },
  standard: { label:"Standard", count:4, mult:1.0,  habits:1 },
  full:     { label:"Full",     count:6, mult:1.45, habits:2 },
};

/* ---------- Focus config ----------
   stats: which stat pools to draw from
   spread: balance across the listed stats (Full Body)
   habits: whether to add INT discipline tasks ---------- */
const FOCUS = {
  full:     { label:"Full Body", stats:["STR","AGI","VIT","SEN"], spread:true,  habits:true },
  strength: { label:"Strength",  stats:["STR"],                   spread:false, habits:false },
  cardio:   { label:"Cardio",    stats:["AGI","VIT"],             spread:false, habits:false },
  mobility: { label:"Mobility",  stats:["SEN"],                   spread:false, habits:false },
};

/* ---------- Muscle groups (clickable body map; only for Strength) ---------- */
const MUSCLES = {
  chest:      "Chest",
  shoulders:  "Shoulders",
  back:       "Back",
  biceps:     "Biceps",
  triceps:    "Triceps",
  core:       "Core",
  quads:      "Quads",
  glutes:     "Glutes",
  hamstrings: "Hamstrings",
  calves:     "Calves",
};
/* Quick-select presets -> sets of muscles (empty = full body / all strength) */
const MUSCLE_PRESETS = {
  push:  ["chest","shoulders","triceps"],
  pull:  ["back","biceps"],
  legs:  ["quads","glutes","hamstrings","calves"],
  core:  ["core"],
};

/* ---------- Benchmark catalog (drives the real stats) ----------
   You build a personal benchmark list from this catalog (add/remove) and can
   also create custom tests. Each test scores a raw number into a 0–130 stat:
     type "value"  -> t50:   a value equal to t50 scores 50, double ~100
     type "lift"   -> ratio50: 1RM as a fraction of bodyweight scoring 50
     type "offset" -> mid + value*slope (used by toe reach; can be negative)
   Stats take the BEST of whatever you've logged for that stat. ---------- */
const BENCHMARK_CATALOG = [
  /* ---- STRENGTH ---- */
  { id:"pushups",   label:"Max Push-ups",        unit:"reps", stat:"STR", type:"value", t50:40 },
  { id:"pullups",   label:"Max Pull-ups",        unit:"reps", stat:"STR", type:"value", t50:10 },
  { id:"chinups",   label:"Max Chin-ups",        unit:"reps", stat:"STR", type:"value", t50:12 },
  { id:"dips",      label:"Max Dips",            unit:"reps", stat:"STR", type:"value", t50:20 },
  { id:"squats",    label:"Max Bodyweight Squats",unit:"reps",stat:"STR", type:"value", t50:55 },
  { id:"pistols",   label:"Pistol Squats / leg", unit:"reps", stat:"STR", type:"value", t50:5  },
  { id:"situps60",  label:"Sit-ups in 60s",      unit:"reps", stat:"STR", type:"value", t50:35 },
  { id:"deadhang",  label:"Dead Hang (grip)",    unit:"sec",  stat:"STR", type:"value", t50:60 },
  { id:"deadlift",  label:"Deadlift 1RM",        unit:"kg",   stat:"STR", type:"lift",  ratio50:1.25 },
  { id:"backsquat", label:"Back Squat 1RM",      unit:"kg",   stat:"STR", type:"lift",  ratio50:1.0  },
  { id:"benchpress",label:"Bench Press 1RM",     unit:"kg",   stat:"STR", type:"lift",  ratio50:0.75 },
  { id:"ohpress",   label:"Overhead Press 1RM",  unit:"kg",   stat:"STR", type:"lift",  ratio50:0.45 },
  { id:"bbrow",     label:"Barbell Row 1RM",     unit:"kg",   stat:"STR", type:"lift",  ratio50:0.75 },

  /* ---- AGILITY (speed & explosiveness) ---- */
  { id:"burpees60", label:"Burpees in 60s",      unit:"reps", stat:"AGI", type:"value", t50:20 },
  { id:"vertjump",  label:"Vertical Jump",       unit:"cm",   stat:"AGI", type:"value", t50:45 },
  { id:"broadjump", label:"Standing Broad Jump", unit:"cm",   stat:"AGI", type:"value", t50:200 },
  { id:"jumprope",  label:"Jump Rope (max unbroken)",unit:"reps",stat:"AGI", type:"value", t50:100 },
  { id:"mtclimb60", label:"Mountain Climbers in 60s",unit:"reps",stat:"AGI",type:"value", t50:60 },
  { id:"sprint40",  label:"40m Sprint",          unit:"sec",  stat:"AGI", type:"time",  t50:6.0 },

  /* ---- VITALITY (endurance & conditioning) ---- */
  { id:"plank",     label:"Max Plank Hold",      unit:"sec",  stat:"VIT", type:"value", t50:90 },
  { id:"wallsit",   label:"Max Wall Sit",        unit:"sec",  stat:"VIT", type:"value", t50:90 },
  { id:"run",       label:"Longest Run (nonstop)",unit:"km",  stat:"VIT", type:"value", t50:5  },
  { id:"cooper",    label:"12-min Run (Cooper)", unit:"km",   stat:"VIT", type:"value", t50:2.4 },
  { id:"mile",      label:"1-mile Run time",     unit:"min",  stat:"VIT", type:"time",  t50:8.0 },
  { id:"run5k",     label:"5 km Run time",       unit:"min",  stat:"VIT", type:"time",  t50:28 },
  { id:"row2k",     label:"2 km Row time",       unit:"min",  stat:"VIT", type:"time",  t50:8.5 },

  /* ---- SENSE (mobility & recovery) ---- */
  { id:"deepsquat", label:"Deep Squat Hold",     unit:"sec",  stat:"SEN", type:"value", t50:60 },
  { id:"toereach",  label:"Toe Reach (sit & reach)",unit:"cm",stat:"SEN", type:"offset", mid:50, slope:2.5 },
  { id:"balance",   label:"Single-leg Balance (eyes shut)",unit:"sec",stat:"SEN",type:"value", t50:30 },
];
const CATALOG_BY_ID = Object.fromEntries(BENCHMARK_CATALOG.map(t => [t.id, t]));
// New hunters start with a BLANK benchmark — they pick their own tests from the catalog.
const DEFAULT_BENCH = [];
