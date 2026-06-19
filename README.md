# THE SYSTEM — Solo Leveling Fitness Tracker

A personal, gamified fitness tracker themed after the "System" from *Solo Leveling*.
Complete your **Daily Quest**, gain **EXP**, grow your **stats**, **level up**, and rank up
from **E-rank to S-rank**. Miss a day and the System hands you a **penalty**.

## How to use it
Just open **`index.html`** in any browser (double-click it). That's it — no install.

1. Enter your Hunter name.
2. Each day, open **Daily Quest** and choose:
   - **Location** — Home / Gym / Outdoor
   - **Focus** — Full Body / Strength / Cardio / Mobility (pick "Strength" for a strength-only day, etc.)
   - **Muscle map** (Strength only) — tap muscles on the front/back body figure to target them
     (e.g. chest + shoulders, or arms + legs). Quick presets: Push / Pull / Legs / Core / Full body.
   - **Time** — Quick / Standard / Full (the quest scales)
   then **Generate Daily Quest**.
3. Tap tasks to clear them. Tap the **ⓘ** on any task for how to do it, what you need, and a form tip.
   Clear them all before the day ends to avoid a penalty.
4. Got extra time? After clearing the daily quest, hit **⚔️ Enter a Gate** for an optional bonus
   workout — extra EXP & stat gains (reduced) that don't affect your streak.
5. Log your real **weight / body-fat / waist** under the **BODY** tab to track actual progress over time.
6. Need a break? Hit **🛌 Take a Rest Day** — no penalty, and your streak stays alive (it just won't increase that day).
7. Watch your **Status Window** grow. The getting-started guide on the Status tab disappears once you've done the basics.

## Stats (real, benchmark-derived)
Stats reflect *measured ability*, not "showing up" — they only move when you log a **Benchmark Test**
(Status tab → 🧪 Benchmark Test). Your Level / EXP / Rank are the "effort & consistency" reward instead.

Each stat takes the **best** of whatever you've logged for it — a weak movement never drags it down:
- **STR** Strength — push-ups, squats, OR gym lifts (deadlift / squat / bench / OHP, scored vs your bodyweight)
- **AGI** Agility — burpees in 60s
- **VIT** Vitality — max plank hold or longest run
- **SEN** Sense — deep squat hold or toe reach
- **INT** Intelligence — discipline score (auto: streak + quests cleared)

A benchmark equal to a "solid/intermediate" level scores ~50; double that scores ~100.
Log any subset whenever you test — blank fields keep their previous value. Gym lifts need a
logged bodyweight (Body tab) to be scored.

**Your benchmark is customizable.** In the benchmark form you can **+ Add** tests from a catalog
(pull-ups, dips, sit-ups, wall sit, broad jump, the gym lifts, etc.), remove ones you don't care
about (✕), or **+ Custom test** — name your own exercise, pick which stat it builds, and set the
"a solid result = ___" target that should score 50. Stats are computed from whatever tests are in
your list.

## Tuned for you
- Level: **Returning** (moderate starting numbers)
- Equipment: bodyweight, full gym, outdoor running
- Time: **varies** → you pick a mode each day, quest scales accordingly
- Goals: balanced strength / fat-loss / consistency

## Penalties & failure
Checked when you next open the app (it compares dates):
- **Fail a daily quest** you generated → lose `25 + 5×level` EXP, streak resets, and the System issues a
  **Penalty Quest** — a mandatory bodyweight redemption workout. You can't generate a new daily quest
  (or enter Gates / rest) until you clear it. Penalty tasks give **no EXP** — clearing them just lifts the lock.
- **Skip a day without resting** → streak resets only (no EXP loss, no penalty quest).
- Penalties **never** reduce your stats (stats only move with benchmarks).

## Titles & ranks
Both rise automatically with your **Level** (with a `[ NEW TITLE ]` / `[ RANK UP ]` popup):
E → D → C → B → A → S, and titles from *The Weakest* (L1) up to *Shadow Monarch* (L70).
**Streak titles** override the level title when earned — e.g. *The Persistent* (7-day) up to
*The Eternal* (100-day streak).

## Data
Everything saves locally in your browser (`localStorage`). Nothing is uploaded.

## Roadmap
- [x] **Phase 1** — Working themed app, local save
- [x] Focus selector (Strength / Cardio / Mobility / Full Body) + exercise instructions
- [x] Gates (optional bonus workouts) + Body metrics tracking
- [x] **Benchmark stats** — STR/AGI/VIT/SEN computed from logged tests; INT = discipline score
- [x] First-run guide, **rest days** (no penalty, streak preserved), remembers last quest choices
- [x] **Penalty Quest** (mandatory redemption workout after a failed daily) + expanded titles (level + streak)
- [ ] **Phase 2** — Cloud sync (Supabase) so phone + PC share progress
- [ ] **Phase 3** — Host online (free) + installable on phone (PWA)

## Files
- `index.html` — structure
- `styles.css` — the System look
- `js/` — logic, split by concern (loaded in this order; plain scripts sharing globals, works over `file://`):
  - `config.js` — constants & data (stats, ranks, titles, exercise library, modes, focuses, benchmark fields)
  - `helpers.js` — DOM/util helpers, scoring math, notifications
  - `state.js` — save object: defaults, migration, load/save
  - `stats.js` — benchmark-derived stats + benchmark form
  - `quests.js` — quest/penalty generation, progression, streaks, task actions
  - `body.js` — body-metrics tracking + weight sparkline
  - `ui.js` — all rendering (status, quest, guide, history, tabs)
  - `main.js` — init & event wiring
