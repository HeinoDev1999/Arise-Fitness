/* =====================================================================
   ui.js — rendering: status window, quest screens, guide, history & tabs
   ===================================================================== */

let lastRenderedTitle = null;
let setupKind = "daily";  // 'daily' or 'gate' — which setup we're showing
let pendingLoc = null, pendingMode = null, pendingFocus = null;
let pendingMuscles = [];  // selected muscle groups for Strength (empty = full body)

function render(){
  if(!state) return;
  const rank = rankForLevel(state.level), title = titleFor(state.level, state.streak);

  // Title-change notification (level or streak driven)
  if(lastRenderedTitle !== null && title !== lastRenderedTitle){
    queueNotif("level","[ NEW TITLE ]",`You are now ${state.name}, ${title}.`,3400);
  }
  lastRenderedTitle = title;

  $("#rankBadge").textContent = rank;
  $("#hunterNameDisplay").textContent = state.name;
  $("#hunterTitle").textContent = title;
  $("#streakCount").textContent = state.streak;

  $("#levelNumber").textContent = state.level;
  $("#bigRank").textContent = rank;
  $("#statusName").textContent = state.name;
  $("#statusClass").textContent = title;
  const need = xpForLevel(state.level);
  $("#xpText").textContent = `${state.xp} / ${need}`;
  $("#xpBar").style.width = Math.min(100,(state.xp/need)*100) + "%";
  $("#totalQuests").textContent = state.totalQuests;
  $("#bestStreak").textContent = state.bestStreak;
  $("#totalXp").textContent = state.totalXp;

  const computed = computeStats(state.benchmarks);
  const hist = state.statHistory || [];
  const prevSnap = hist.length >= 2 ? hist[hist.length - 2] : null;
  const grid = $("#statsGrid"); grid.innerHTML = "";
  for(const key of Object.keys(STATS)){
    const v = computed[key];
    const shown = v==null ? "—" : v;
    const width = v==null ? 0 : Math.min(100, v);

    // progress delta since the previous benchmark (measured stats only — INT is auto)
    let deltaHtml = "";
    if(key !== "INT" && v != null && prevSnap && prevSnap[key] != null){
      const d = v - prevSnap[key];
      if(d > 0)      deltaHtml = `<span class="stat-delta up">▲ ${d}</span>`;
      else if(d < 0) deltaHtml = `<span class="stat-delta down">▼ ${Math.abs(d)}</span>`;
    }

    const tier = tierFor(v);
    const meta = v == null ? `Untested · ${STATS[key].desc}`
              : key === "INT" ? `${tier} · discipline (auto)`
              : `${tier} · ${STATS[key].desc}`;

    const div = document.createElement("div");
    div.className = `stat s-${key}` + (v==null ? " untested":"");
    div.innerHTML = `
      <div class="stat-top"><span class="stat-name">${STATS[key].full}</span><span class="stat-val">${shown}${deltaHtml}</span></div>
      <div class="stat-desc">${meta}</div>
      <div class="stat-mini-bar"><div class="stat-mini-fill" style="width:${width}%"></div></div>`;
    grid.appendChild(div);
  }
  renderBench();
  renderGuide();

  renderQuest();
  renderBody();
  renderCalendar();
  renderHistory();
  save();
}

/* ---------- Activity calendar (GitHub-squares heatmap, last 13 weeks) ---------- */
function renderCalendar(){
  const wrap = $("#activityCal"); if(!wrap) return;
  // one status per day: trained > rest > missed
  const status = {};
  state.history.forEach(h=>{
    if(h.kind === "rest"){ if(status[h.date] !== "trained") status[h.date] = "rest"; }
    else if(h.completed){ status[h.date] = "trained"; }
    else if(!status[h.date]) status[h.date] = "missed";
  });
  const end = new Date(todayStr() + "T00:00:00Z");
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 90);
  start.setUTCDate(start.getUTCDate() - start.getUTCDay()); // back up to Sunday
  let html = "";
  for(const d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)){
    const ds = d.toISOString().slice(0,10);
    const st = status[ds] || "none";
    html += `<div class="cal-cell ${st}" title="${ds}${st !== "none" ? " · " + st : ""}"></div>`;
  }
  wrap.innerHTML = html;
}

/* ---------- Tab switching ---------- */
function switchTab(name){
  $$(".tab").forEach(t=>t.classList.toggle("active", t.dataset.tab===name));
  $$(".tab-panel").forEach(p=>p.classList.remove("active"));
  $("#tab-"+name).classList.add("active");
}

/* ---------- First-run guide ---------- */
function renderGuide(){
  const card = $("#guideCard");
  const steps = [
    { done: state.totalQuests > 0,                          text:"Generate &amp; clear your first Daily Quest", tab:"quest" },
    { done: !!(state.benchmarks && state.benchmarks.date),  text:"Run a Benchmark Test to reveal your stats",    tab:"status" },
    { done: state.body.length > 0,                          text:"Log your weight in the Body tab",             tab:"body" },
  ];
  if(steps.every(s=>s.done)){ card.classList.add("hidden"); return; }
  card.classList.remove("hidden");
  $("#guideSteps").innerHTML = steps.map(s=>`
    <div class="guide-step ${s.done?"done":""}">
      <span class="gs-check">${s.done?"✓":"○"}</span>
      <span class="gs-text">${s.text}</span>
      ${s.done ? "" : `<button class="gs-go" data-goto="${s.tab}">Go ›</button>`}
    </div>`).join("");
}

/* ---------- Quest setup mode (daily vs gate) ---------- */
function configureSetup(kind){
  if(kind === "gate"){
    $("#setupTag").textContent = "[ GATE ]";
    $("#setupTitle").textContent = "Enter a Gate";
    $("#generateBtn").textContent = "OPEN GATE";
    $("#restDayBtn").classList.add("hidden");
    $("#setupCancelBtn").classList.remove("hidden");
  } else {
    $("#setupTag").textContent = "[ QUEST GENERATION ]";
    $("#setupTitle").textContent = "Prepare today's quest";
    $("#generateBtn").textContent = "GENERATE DAILY QUEST";
    $("#restDayBtn").classList.remove("hidden");
    $("#setupCancelBtn").classList.add("hidden");
  }
}

/* ---------- Remember last quest choices ---------- */
function refreshGenerateBtn(){ $("#generateBtn").disabled = !(pendingLoc && pendingMode && pendingFocus); }
function markChoice(containerId, attr, value){
  $$(`#${containerId} .choice`).forEach(c => c.classList.toggle("selected", c.dataset[attr] === value));
}
function prefillSetup(){
  if(state.lastChoices){
    if(!pendingLoc)   pendingLoc   = state.lastChoices.location;
    if(!pendingFocus) pendingFocus = state.lastChoices.focus;
    if(!pendingMode)  pendingMode  = state.lastChoices.mode;
    if(pendingMuscles.length === 0 && Array.isArray(state.lastChoices.muscles)) pendingMuscles = state.lastChoices.muscles.slice();
  }
  markChoice("locationChoices","location",pendingLoc);
  markChoice("focusChoices","focus",pendingFocus);
  markChoice("modeChoices","mode",pendingMode);
  updateMuscleVisibility();
  renderBodyMap();
  refreshGenerateBtn();
}

// The body map only makes sense for Strength
function updateMuscleVisibility(){
  const grp = $("#muscleGroup"); if(!grp) return;
  grp.classList.toggle("hidden", pendingFocus !== "strength");
}
// Called after the focus choice changes
function onFocusChosen(){
  if(pendingFocus !== "strength") pendingMuscles = [];
  updateMuscleVisibility();
  renderBodyMap();
}

/* ---------- Body map (clickable muscle figure) ---------- */
function muscleSummaryText(){
  if(!pendingMuscles.length) return "Full body — all strength";
  return pendingMuscles.map(m => MUSCLES[m] || m).join(", ");
}
function renderBodyMap(){
  const map = $("#bodyMap"); if(!map) return;
  map.querySelectorAll("[data-muscle]").forEach(el =>
    el.classList.toggle("selected", pendingMuscles.includes(el.dataset.muscle))
  );
  const sum = $("#muscleSummary"); if(sum) sum.textContent = muscleSummaryText();
}
function toggleMuscle(m){
  const i = pendingMuscles.indexOf(m);
  if(i >= 0) pendingMuscles.splice(i,1); else pendingMuscles.push(m);
  renderBodyMap();
}
function applyMusclePreset(preset){
  if(preset === "full" || preset === "clear"){ pendingMuscles = []; }
  else if(MUSCLE_PRESETS[preset]){ pendingMuscles = MUSCLE_PRESETS[preset].slice(); }
  renderBodyMap();
}
function selectChoice(containerId, btn, attr, setter){
  $$(`#${containerId} .choice`).forEach(c=>c.classList.remove("selected"));
  btn.classList.add("selected");
  setter(btn.dataset[attr]);
  refreshGenerateBtn();
}

/* ---------- Quest rendering ---------- */
function renderTaskList(q){
  const list = $("#taskList"); list.innerHTML = "";
  const swappable = q.kind !== "penalty";
  let totalXp = 0;
  q.tasks.forEach((t,i)=>{
    totalXp += t.xp;
    const ex = EX_BY_ID[t.id] || {};
    const xpText = t.xp > 0 ? `<span class="task-xp"> · +${t.xp} EXP</span>` : "";
    const swapBtn = (swappable && !t.done)
      ? `<button class="task-swap" data-swap="${i}" title="Swap this exercise" type="button">⇄</button>` : "";
    const li = document.createElement("li");
    li.className = "task-wrap";
    li.innerHTML = `
      <div class="task${t.done?" done":""}" data-i="${i}">
        <div class="task-check">${t.done ? "✓":""}</div>
        <div class="task-body">
          <div class="task-name">${t.name}
            <span class="task-stat-tag" style="color:${STAT_COLOR[t.stat]}">${t.stat}</span>
          </div>
          <span class="task-target">${t.target}</span>${xpText}
        </div>
        ${swapBtn}
        <button class="task-info" data-info="${i}" title="How to do it">ⓘ</button>
      </div>
      <div class="task-details hidden" id="details-${i}">
        ${ex.need ? `<p><b>You need:</b> ${ex.need}</p>`:""}
        ${ex.how ? `<p><b>How:</b> ${ex.how}</p>`:""}
        ${ex.tip ? `<p class="task-tip"><b>Tip:</b> ${ex.tip}</p>`:""}
      </div>`;
    list.appendChild(li);
  });
  const done = q.tasks.filter(t=>t.done).length;
  $("#questProgressText").textContent = `${done} / ${q.tasks.length}`;
  $("#questProgressBar").style.width = (done/q.tasks.length)*100 + "%";
  return { done, total: q.tasks.length, totalXp };
}

function renderQuest(){
  const setup = $("#questSetup"), active = $("#questActive"), rest = $("#questRest");
  const penaltyActive = state.penalty && !state.penalty.completed;

  // ---- Penalty Quest overrides everything ----
  if(penaltyActive){
    setup.classList.add("hidden"); rest.classList.add("hidden");
    active.classList.remove("hidden"); active.classList.add("penalty-mode");
    const q = state.penalty;
    $("#questTitleText").textContent = "Penalty Zone";
    document.querySelector("#questActive .system-tag").textContent = "[ PENALTY QUEST ]";
    $("#questMeta").innerHTML = `Redemption<br/>Mandatory`;
    renderTaskList(q);
    $("#questReward").textContent = "No EXP — clear to be released";
    $("#questWarning").style.display = "flex";
    $("#questWarning").querySelector("span:last-child").innerHTML =
      "The System has imposed a <b>Penalty Quest</b>. You cannot train again until it is cleared.";
    $("#questCleared").classList.add("hidden");
    $("#resetQuestBtn").classList.add("hidden");
    $("#enterGateBtn").classList.add("hidden");
    return;
  }
  active.classList.remove("penalty-mode");
  // restore the normal daily-quest warning text
  $("#questWarning").querySelector("span:last-child").innerHTML =
    "WARNING: Failing to complete the daily quest will result in an appropriate <b>penalty</b>.";

  const restedToday = state.restDate === todayStr();
  if(!state.today) setupKind = "daily";

  if(state.today && setupKind !== "gate"){
    rest.classList.add("hidden");
    // fall through to active rendering below
  } else if(restedToday && setupKind !== "gate"){
    active.classList.add("hidden"); setup.classList.add("hidden");
    rest.classList.remove("hidden");
    return;
  } else {
    active.classList.add("hidden"); rest.classList.add("hidden");
    setup.classList.remove("hidden");
    configureSetup(setupKind);
    prefillSetup();
    return;
  }

  setup.classList.add("hidden"); active.classList.remove("hidden"); rest.classList.add("hidden");
  const q = state.today;
  const isGate = q.kind === "gate";
  const muscleList = (q.muscles && q.muscles.length) ? q.muscles.map(m => MUSCLES[m] || m).join(", ") : "";
  $("#questTitleText").textContent = (isGate ? "Gate — " : "") + `${FOCUS[q.focus].label} Training`;
  document.querySelector("#questActive .system-tag").textContent = isGate ? "[ GATE ]" : "[ DAILY QUEST ]";
  $("#questMeta").innerHTML = `${FOCUS[q.focus].label}${muscleList ? " · "+muscleList : ""}<br/>${MODES[q.mode].label} · ${cap(q.location)}`;

  const { totalXp } = renderTaskList(q);
  $("#questReward").textContent = `+${totalXp} EXP`;
  $("#questWarning").style.display = (!isGate && !q.completed) ? "flex" : "none";

  const cleared = $("#questCleared");
  if(q.completed){
    cleared.classList.remove("hidden");
    $("#questClearedText").textContent = isGate
      ? `Gate cleared! That's ${state.gatesToday} gate(s) today. Enter another, or rest, Hunter.`
      : `Daily quest cleared! 🔥 Want more? Enter a Gate for bonus EXP (reduced rewards).`;
    $("#resetQuestBtn").classList.add("hidden");
    $("#enterGateBtn").classList.remove("hidden");
  } else {
    cleared.classList.add("hidden");
    $("#resetQuestBtn").classList.remove("hidden");
    $("#enterGateBtn").classList.add("hidden");
  }
}

/* ---------- History ---------- */
function renderHistory(){
  const list = $("#historyList"), empty = $("#historyEmpty");
  list.innerHTML = "";
  if(!state.history.length){ empty.style.display="block"; return; }
  empty.style.display="none";
  state.history.slice(0,30).forEach(h=>{
    const li = document.createElement("li");
    if(h.kind === "rest"){
      li.className = "history-item rest";
      li.innerHTML = `
        <div class="hi-left">
          <span class="hi-date">${h.date}</span>
          <span class="hi-meta">Recovery</span>
        </div>
        <span class="hi-right rest">🛌 REST DAY</span>`;
      list.appendChild(li);
      return;
    }
    li.className = "history-item" + (h.completed ? "":" fail");
    const muscleLabel = (h.muscles && h.muscles.length) ? " ("+h.muscles.map(m => MUSCLES[m] || m).join("/")+")" : "";
    const focusLabel = h.focus ? (FOCUS[h.focus]?.label || h.focus)+muscleLabel+" · " : "";
    const gateTag = h.kind === "gate" ? `<span class="gate-tag">GATE</span> ` : "";
    li.innerHTML = `
      <div class="hi-left">
        <span class="hi-date">${gateTag}${h.date}</span>
        <span class="hi-meta">${focusLabel}${h.mode} · ${h.location} · ${h.done}/${h.total} tasks</span>
      </div>
      <span class="hi-right ${h.completed?"ok":"fail"}">${h.completed ? "+"+h.xpGained+" EXP" : "FAILED"}</span>`;
    list.appendChild(li);
  });
}

/* ---------- Screen routing ---------- */
function hideAll(){
  $("#authScreen") && $("#authScreen").classList.add("hidden");
  $("#onboarding").classList.add("hidden");
  $("#app").classList.add("hidden");
}
function showAuthScreen(){ hideAll(); if($("#authScreen")) $("#authScreen").classList.remove("hidden"); }
function showOnboarding(){ hideAll(); $("#onboarding").classList.remove("hidden"); }

function showApp(){
  hideAll();
  $("#app").classList.remove("hidden");
  if(typeof dailyMaintenance === "function") dailyMaintenance();  // penalty + daily gate reset on the final state
  lastRenderedLevel = state.level;
  lastRenderedTitle = titleFor(state.level, state.streak);
  render();
  if(state.penalty && !state.penalty.completed) switchTab("quest");
}
