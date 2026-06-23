/* =====================================================================
   quests.js — quest generation, penalties, progression & task actions
   ===================================================================== */

/* ---------- Quest generation ---------- */
function buildTarget(ex, mult){
  if(ex.unit === "flag") return "✓ today";
  if(ex.unit === "sets") return `${ex.base} × ${ex.reps}`;
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
    const byStat = {}; f.stats.forEach(s => byStat[s] = pool.filter(e => e.stat === s));
    for(const s of f.stats){
      if(chosen.length >= m.count) break;
      if(byStat[s].length) chosen.push(rand(byStat[s]));
    }
    const rest = shuffle(pool.filter(e => !chosen.includes(e)));
    while(chosen.length < m.count && rest.length) chosen.push(rest.pop());
  } else {
    // Focused: just draw from the single pool (no repeats; shorter if pool is small)
    chosen = shuffle(pool).slice(0, m.count);
  }

  // INT discipline habits (Full Body only)
  if(f.habits){
    const habitPool = EXERCISES.filter(e => e.stat === "INT" && e.loc.includes(location));
    chosen = chosen.concat(shuffle(habitPool).slice(0, m.habits));
  }

  const xpScale = kind === "gate" ? gateMultiplier() : 1;
  const tasks = chosen.map(ex => ({
    id: ex.id, name: ex.name, stat: ex.stat,
    target: buildTarget(ex, m.mult),
    xp: Math.max(1, Math.round(ex.xp * (ex.stat === "INT" ? 1 : m.mult) * xpScale)),
    done: false,
  }));

  return {
    date: todayStr(), location, mode, focus,
    muscles: focus === "strength" && Array.isArray(muscles) ? muscles.slice() : [],
    kind, statScale: kind === "gate" ? 0.5 : 1,
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
  const tasks = defs.map(d => ({
    id:d.id, name:d.name, stat:d.stat,
    target:`${d.n} ${d.unit}`, xp:0, done:false,
  }));
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
  if(!pool.length){ queueNotif("danger","[ SYSTEM ]","No alternative for this slot here, Hunter.",2800); return; }

  const ex = rand(pool);
  const xpScale = q.kind === "gate" ? gateMultiplier() : 1;
  const oldName = t.name;
  q.tasks[i] = {
    id: ex.id, name: ex.name, stat: ex.stat,
    target: buildTarget(ex, m.mult),
    xp: Math.max(1, Math.round(ex.xp * (ex.stat === "INT" ? 1 : m.mult) * xpScale)),
    done: false,
  };
  save(); render();
  queueNotif("ok","[ EXERCISE SWAPPED ]",`${oldName} → ${ex.name}`,2600);
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
