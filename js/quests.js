/* =====================================================================
   quests.js — quest generation, penalties, progression & task actions
   ===================================================================== */

/* ---------- Personal scaling: experience level × bodyweight ---------- */
function expCfg(){ return EXPERIENCE[state.experience] || EXPERIENCE[DEFAULT_EXPERIENCE]; }

// Gentle, capped bodyweight adjustment for bodyweight-loaded moves: lighter than
// the reference weight -> a bit more reps, heavier -> a bit fewer (never extreme).
function weightFactor(){
  const bw = currentBodyweight();   // latest Body-tab weight, canonical kg
  if(!bw) return 1;
  return clamp(Math.sqrt(REF_WEIGHT_KG / bw), 0.75, 1.1);
}
// What your "how did that feel?" ratings have learned (1 = no change)
function adaptFactor(){ return clamp(typeof state.adapt === "number" ? state.adapt : 1, 0.7, 1.4); }
// Target multiplier for one exercise: experience × learned feedback, plus bodyweight for bodyweight moves.
function personalMult(ex){
  return expCfg().mult * adaptFactor() * (BW_LOADED.has(ex.id) ? weightFactor() : 1);
}
// Beginners skip the hardest moves when an easier option exists.
function levelFilter(pool, need){
  if(state.experience !== "beginner") return pool;
  const easier = pool.filter(e => !BEGINNER_SKIP.has(e.id));
  return easier.length >= Math.min(need, pool.length) ? easier : pool;
}
// Shuffled; for beginners the easier exercises come first, so hard ones are only filler.
function levelOrder(pool){
  const sh = shuffle(pool);
  if(state.experience !== "beginner") return sh;
  return [...sh.filter(e => !BEGINNER_SKIP.has(e.id)), ...sh.filter(e => BEGINNER_SKIP.has(e.id))];
}
// One quest task from an exercise (EXP follows the time mode only, never the level).
function makeTask(ex, m, xpScale){
  return {
    id: ex.id, name: ex.name, stat: ex.stat,
    target: buildTarget(ex, m.mult * personalMult(ex)),
    xp: Math.max(1, Math.round(ex.xp * (ex.stat === "INT" ? 1 : m.mult) * xpScale)),
    done: false,
  };
}

/* ---------- Quest generation ---------- */
function buildTarget(ex, mult){
  if(ex.unit === "flag") return "✓ today";
  if(ex.unit === "sets") return `${clamp(Math.round(ex.base * expCfg().sets), 2, 4)} × ${ex.reps}`;
  if(ex.unit === "km"){ return `${round1(kmToDisp(Math.max(0.1, ex.base * mult)))} ${dUnit()}`; }
  const v = Math.max(1, Math.round(ex.base * mult));
  const unitText = { reps:"reps", sec:"sec", min:"min", x:"rounds" }[ex.unit] || ex.unit;
  return `${v} ${unitText}`;
}

function gateMultiplier(){
  // Diminishing returns for stacking Gates in one day: 50% -> 40% -> 30% -> 25% min
  return Math.max(0.25, 0.5 - 0.1 * (state.gatesToday || 0));
}

function generateQuest(location, mode, focus, kind="daily", muscles=null){
  const m = MODES[mode];
  const f = FOCUS[focus];
  let pool = EXERCISES.filter(e => e.loc.includes(location) && f.stats.includes(e.stat));

  // Strength can target specific muscles picked on the body map (empty = all)
  if(focus === "strength" && Array.isArray(muscles) && muscles.length){
    const filtered = pool.filter(e => e.muscles && e.muscles.some(mm => muscles.includes(mm)));
    if(filtered.length) pool = filtered; // fall back to all strength if selection has nothing here
  }
  let chosen = [];
  if(f.spread){
    // Full Body: guarantee a spread across the focus stats, then fill
    const byStat = {}; f.stats.forEach(s => byStat[s] = levelFilter(pool.filter(e => e.stat === s), 1));
    for(const s of f.stats){
      if(chosen.length >= m.count) break;
      if(byStat[s].length) chosen.push(rand(byStat[s]));
    }
    const rest = levelOrder(pool.filter(e => !chosen.includes(e))).reverse(); // pop() takes the easiest first
    while(chosen.length < m.count && rest.length) chosen.push(rest.pop());
  } else {
    // Focused: draw from the single pool (no repeats; shorter if pool is small)
    chosen = levelOrder(pool).slice(0, m.count);
  }

  // INT discipline habits (Full Body only)
  if(f.habits){
    const habitPool = EXERCISES.filter(e => e.stat === "INT" && e.loc.includes(location));
    chosen = chosen.concat(shuffle(habitPool).slice(0, m.habits));
  }

  const xpScale = kind === "gate" ? gateMultiplier() : 1;
  const tasks = chosen.map(ex => makeTask(ex, m, xpScale));

  return {
    date: todayStr(), location, mode, focus,
    muscles: focus === "strength" && Array.isArray(muscles) ? muscles.slice() : [],
    kind, statScale: kind === "gate" ? 0.5 : 1,
    feel: null,   // "hard" | "ok" | "easy" once you rate a finished daily quest
    tasks, completed:false,
  };
}

/* ---------- Penalty Quest ----------
   A mandatory, bodyweight-only redemption workout issued when you FAIL a
   daily quest. Gives no EXP — clearing it just lifts the penalty so you can
   train again. Deliberately tougher than a normal Quick quest. ---------- */
function generatePenaltyQuest(){
  const bump = Math.round(state.level * 0.5);
  const defs = [
    { id:"pushups", name:"Push-ups",          stat:"STR", n:40 + bump,     unit:"reps" },
    { id:"squats",  name:"Bodyweight Squats", stat:"STR", n:50 + bump,     unit:"reps" },
    { id:"lunges",  name:"Lunges",            stat:"STR", n:30 + bump,     unit:"reps" },
    { id:"burpees", name:"Burpees",           stat:"AGI", n:20 + bump,     unit:"reps" },
    { id:"plank",   name:"Plank Hold",        stat:"VIT", n:75 + bump * 2, unit:"sec"  },
  ];
  // Beginners get an easier redemption move in place of burpees
  if(state.experience === "beginner"){
    defs[3] = { id:"mtclimb", name:"Mountain Climbers", stat:"AGI", n:30 + bump, unit:"reps" };
  }
  // scaled to the person (experience + bodyweight), never below a token minimum
  const tasks = defs.map(d => {
    const n = Math.max(5, Math.round(d.n * personalMult(EX_BY_ID[d.id])));
    return { id:d.id, name:d.name, stat:d.stat, target:`${n} ${d.unit}`, xp:0, done:false };
  });
  return { date: todayStr(), kind:"penalty", tasks, completed:false };
}
function completePenalty(){
  state.penalty = null;
  save();
  queueNotif("ok","[ PENALTY CLEARED ]","The System releases you. Resume your training, Hunter.",4200);
}

/* ---------- Progression ---------- */
function addXp(amount){
  state.xp += amount; state.totalXp += amount;
  let leveled = false;
  while(state.xp >= xpForLevel(state.level)){ state.xp -= xpForLevel(state.level); state.level++; leveled = true; }
  return leveled;
}

/* ---------- Start-of-day maintenance (run on the final state, after any cloud pull) ---------- */
function dailyMaintenance(){
  checkPenaltyOnLoad();
  const today = todayStr();
  if(state.gatesDate !== today){ state.gatesToday = 0; state.gatesDate = today; save(); }
}

/* ---------- Penalty / streak check (on load) ---------- */
function checkPenaltyOnLoad(){
  const today = todayStr();

  // Gates never penalize — just discard a stale one
  if(state.today && state.today.kind === "gate" && state.today.date !== today){
    state.today = null; save();
  }

  if(state.today && state.today.date !== today && !state.today.completed){
    const done = state.today.tasks.filter(t=>t.done).length;
    state.history.unshift({
      date: state.today.date, mode: state.today.mode, location: state.today.location,
      focus: state.today.focus, xpGained: 0, completed:false, total: state.today.tasks.length, done,
    });
    const penalty = 25 + state.level * 5;
    state.xp = Math.max(0, state.xp - penalty);
    state.streak = 0;
    state.today = null;
    if(!state.penalty) state.penalty = generatePenaltyQuest();
    save();
    queueNotif("danger","[ PENALTY ]",`Daily quest failed. -${penalty} EXP. Streak reset.`,5200);
    queueNotif("danger","[ PENALTY QUEST ]","A Penalty Quest has been issued. Clear it before you can train again.",5200);
    return;
  }

  // Streak breaks only if you skipped a day WITHOUT resting (rest days keep it alive)
  const onPlan = state.lastOnPlanDate || state.lastCompletedDate;
  if(onPlan){
    const gap = daysBetween(onPlan, today);
    if(gap >= 2 && state.streak > 0){
      state.streak = 0; state.today = null; save();
      queueNotif("danger","[ STREAK BROKEN ]","You skipped a day without resting, Hunter. Streak reset to 0.",4600);
      return;
    }
  }

  // Clear a stale rest day so today shows a fresh setup
  if(state.restDate && state.restDate !== today){ state.restDate = null; save(); }

  if(state.today && state.today.date !== today){ state.today = null; save(); }
}

/* ---------- Which quest is being acted on (penalty overrides everything) ---------- */
function activeQuest(){
  if(state.penalty && !state.penalty.completed) return state.penalty;
  return state.today;
}

/* ---------- Swap a single exercise (keep the rest of the quest) ---------- */
function swapTask(i){
  const q = activeQuest();
  if(!q || q.kind === "penalty" || q.completed) return;
  const t = q.tasks[i];
  if(!t || t.done) return;

  const m = MODES[q.mode];
  const inQuest = new Set(q.tasks.map(x => x.id));
  // candidates: same stat, valid for this location, not already in the quest
  let pool = EXERCISES.filter(e => e.stat === t.stat && e.loc.includes(q.location) && !inQuest.has(e.id));
  // for strength, prefer an exercise within the quest's targeted muscles
  // (fall back to the swapped exercise's own muscles when no muscles were picked)
  if(q.focus === "strength"){
    const target = (q.muscles && q.muscles.length) ? q.muscles
                 : ((EX_BY_ID[t.id] && EX_BY_ID[t.id].muscles) || []);
    const sameMuscle = pool.filter(e => e.muscles && e.muscles.some(mm => target.includes(mm)));
    if(sameMuscle.length) pool = sameMuscle;
  }
  pool = levelFilter(pool, 1);
  if(!pool.length){ queueNotif("danger","[ SYSTEM ]","No alternative for this slot here, Hunter.",2800); return; }

  const ex = rand(pool);
  const xpScale = q.kind === "gate" ? gateMultiplier() : 1;
  const oldName = t.name;
  q.tasks[i] = makeTask(ex, m, xpScale);
  save(); render();
  queueNotif("ok","[ EXERCISE SWAPPED ]",`${oldName} → ${ex.name}`,2600);
}

/* ---------- "How did that feel?" — nudges future targets (±8% per rating) ---------- */
function setFeel(v){
  const q = state.today;
  if(!q || !q.completed || q.kind !== "daily" || q.feel) return;
  if(v !== "hard" && v !== "ok" && v !== "easy") return;
  q.feel = v;
  if(v === "hard") state.adapt = clamp(round3((state.adapt || 1) * 0.92), 0.7, 1.4);
  if(v === "easy") state.adapt = clamp(round3((state.adapt || 1) * 1.08), 0.7, 1.4);
  const h = state.history.find(x => x.kind === "daily" && x.date === q.date);
  if(h) h.feel = v;
  save(); render();
  const msg = v === "ok" ? "Targets stay as they are." : v === "hard" ? "Next quests will be a bit lighter." : "Next quests will be a bit tougher.";
  queueNotif("ok","[ NOTED ]", msg, 2800);
}

/* ---------- Task actions ---------- */
function toggleTask(i){
  const q = activeQuest(); if(!q || q.completed) return;
  const isPenalty = q.kind === "penalty";
  const t = q.tasks[i];
  t.done = !t.done;
  if(t.done){
    if(t.xp > 0){ addXp(t.xp); queueNotif("ok","[ TASK CLEARED ]",`${t.name} — +${t.xp} EXP`,1800); }
    else { queueNotif(isPenalty?"danger":"ok","[ TASK CLEARED ]",`${t.name} — cleared`,1600); }
  } else if(t.xp > 0){
    state.xp = Math.max(0, state.xp - t.xp);
    state.totalXp = Math.max(0, state.totalXp - t.xp);
  }
  checkLevelNotif();
  if(q.tasks.every(x=>x.done) && !q.completed){
    if(isPenalty) completePenalty(); else completeQuest();
  }
  render();
}

let lastRenderedLevel = 1;
function checkLevelNotif(){
  if(state.level > lastRenderedLevel){
    const rank = rankForLevel(state.level);
    queueNotif("level","[ LEVEL UP ]",`You reached Level ${state.level}!`,2600);
    $(".status-panel")?.classList.add("flash");
    setTimeout(()=>$(".status-panel")?.classList.remove("flash"),900);
    if(rankForLevel(lastRenderedLevel) !== rank){
      queueNotif("level","[ RANK UP ]",`You are now a ${rank}-Rank Hunter!`,3200);
    }
    lastRenderedLevel = state.level;
  }
}

function completeQuest(){
  const q = state.today; q.completed = true;
  const today = todayStr();
  const isGate = q.kind === "gate";
  const bonus = Math.round((30 + state.level * 4) * (isGate ? gateMultiplier() : 1));
  addXp(bonus);
  const totalXp = q.tasks.reduce((s,t)=>s+t.xp,0) + bonus;

  if(isGate){
    state.gatesToday = (state.gatesToday || 0) + 1;
    state.gatesDate = today;
    state.history.unshift({
      date: today, mode: q.mode, location: q.location, focus: q.focus, kind:"gate",
      xpGained: totalXp, completed:true, total: q.tasks.length, done: q.tasks.length,
    });
    checkLevelNotif();
    queueNotif("ok","[ GATE CLEARED ]",`Gate cleared! +${bonus} bonus EXP. (Gate #${state.gatesToday} today)`,4000);
  } else {
    state.totalQuests++;
    const onPlan = state.lastOnPlanDate;
    if(onPlan === today) { /* already on-plan today (e.g. rested then trained) */ if(state.streak < 1) state.streak = 1; }
    else if(onPlan && daysBetween(onPlan, today) === 1) state.streak++;
    else state.streak = 1;
    state.lastCompletedDate = today;
    state.lastOnPlanDate = today;
    state.restDate = null;
    state.bestStreak = Math.max(state.bestStreak, state.streak);
    state.history.unshift({
      date: today, mode: q.mode, location: q.location, focus: q.focus, kind:"daily",
      xpGained: totalXp, completed:true, total: q.tasks.length, done: q.tasks.length,
    });
    checkLevelNotif();
    queueNotif("ok","[ QUEST COMPLETE ]",`Daily quest cleared! +${bonus} bonus EXP · Streak ${state.streak} 🔥`,4200);
  }
}

/* ---------- Rest day ---------- */
function restDay(){
  if(!confirm("Take a rest day? No penalty, and your streak stays alive (it just won't increase today).")) return;
  const today = todayStr();
  state.restDate = today;
  state.lastOnPlanDate = today;
  // avoid duplicate rest entry for today
  state.history = state.history.filter(h => !(h.kind === "rest" && h.date === today));
  state.history.unshift({ date: today, kind:"rest", completed:true, total:0, done:0, xpGained:0 });
  state.today = null; setupKind = "daily";
  save(); render();
  queueNotif("ok","[ REST DAY ]","Recovery logged. Your streak is safe, Hunter.",3800);
}
function trainAnyway(){
  const today = todayStr();
  state.history = state.history.filter(h => !(h.kind === "rest" && h.date === today));
  state.restDate = null;
  setupKind = "daily";
  save(); render();
}
