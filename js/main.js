/* =====================================================================
   main.js — initialization & all event wiring (runs on DOMContentLoaded)
   ===================================================================== */
function init(){
  state = load();
  if(!state){ $("#onboarding").classList.remove("hidden"); }
  else {
    checkPenaltyOnLoad();
    // reset daily gate counter on a new day
    const today = todayStr();
    if(state.gatesDate !== today){ state.gatesToday = 0; state.gatesDate = today; save(); }
    showApp();
  }
  if($("#bodyDate")) $("#bodyDate").value = todayStr();

  // onboarding
  $("#startBtn").addEventListener("click",()=>{
    const name = ($("#hunterName").value || "Hunter").trim().slice(0,18) || "Hunter";
    state = defaultState(name); save(); showApp();
    queueNotif("level","[ SYSTEM ]","You have become a Player. Begin your daily quest.",4200);
  });
  $("#hunterName").addEventListener("keydown",e=>{ if(e.key==="Enter") $("#startBtn").click(); });

  // tabs
  $$(".tab").forEach(tab=>{
    tab.addEventListener("click",()=> switchTab(tab.dataset.tab));
  });

  // guide "Go ›" buttons jump to the right tab
  $("#guideSteps").addEventListener("click",e=>{
    const go = e.target.closest(".gs-go"); if(go) switchTab(go.dataset.goto);
  });

  // setup choices
  $("#locationChoices").addEventListener("click",e=>{ const b=e.target.closest(".choice"); if(b) selectChoice("locationChoices",b,"location",v=>pendingLoc=v); });
  $("#focusChoices").addEventListener("click",e=>{ const b=e.target.closest(".choice"); if(b){ selectChoice("focusChoices",b,"focus",v=>pendingFocus=v); onFocusChosen(); } });
  $("#modeChoices").addEventListener("click",e=>{ const b=e.target.closest(".choice"); if(b) selectChoice("modeChoices",b,"mode",v=>pendingMode=v); });

  // Body map: tap a muscle region to toggle it
  $("#bodyMap").addEventListener("click",e=>{ const z=e.target.closest("[data-muscle]"); if(z) toggleMuscle(z.dataset.muscle); });
  // Quick presets (Push / Pull / Legs / Core / Full)
  $("#musclePresets").addEventListener("click",e=>{ const b=e.target.closest(".mini-chip"); if(b) applyMusclePreset(b.dataset.preset); });

  $("#generateBtn").addEventListener("click",()=>{
    if(!pendingLoc || !pendingMode || !pendingFocus) return;
    const kind = setupKind === "gate" ? "gate" : "daily";
    state.today = generateQuest(pendingLoc, pendingMode, pendingFocus, kind, pendingMuscles);
    state.lastChoices = { location: pendingLoc, focus: pendingFocus, mode: pendingMode, muscles: pendingMuscles.slice() };
    setupKind = "daily";
    save(); render();
    if(kind === "gate") queueNotif("ok","[ GATE OPENED ]","You've entered a Gate. Clear it for bonus EXP.",3600);
    else queueNotif("ok","[ QUEST RECEIVED ]","Your daily quest has arrived. Clear all tasks.",3600);
  });

  $("#resetQuestBtn").addEventListener("click",()=>{
    if(!confirm("Regenerate this quest? Progress on the current quest will be lost.")) return;
    state.today = generateQuest(state.today.location, state.today.mode, state.today.focus, state.today.kind, state.today.muscles);
    save(); render();
  });

  // Gates
  $("#enterGateBtn").addEventListener("click",()=>{ setupKind = "gate"; render(); });
  $("#setupCancelBtn").addEventListener("click",()=>{ setupKind = "daily"; render(); });

  // Rest day
  $("#restDayBtn").addEventListener("click", restDay);
  $("#trainAnywayBtn").addEventListener("click", trainAnyway);

  // Benchmark
  $("#benchToggleBtn").addEventListener("click", openBenchForm);
  $("#benchCancelBtn").addEventListener("click", closeBenchForm);
  $("#benchSaveBtn").addEventListener("click", saveBenchmark);
  $("#benchAddBtn").addEventListener("click", addBenchTest);
  $("#benchCustomBtn").addEventListener("click", showCustomForm);
  $("#ct_add").addEventListener("click", addCustomTest);
  $("#ct_cancel").addEventListener("click",()=> $("#benchCustomForm").classList.add("hidden"));
  $("#benchFields").addEventListener("click",e=>{
    const del = e.target.closest(".bf-del"); if(del) removeBenchTest(del.dataset.del);
  });

  // Body metrics
  $("#bodyLogBtn").addEventListener("click", logBody);
  $("#bodyList").addEventListener("click",e=>{
    const del = e.target.closest(".bi-del"); if(!del) return;
    if(!confirm("Delete this entry?")) return;
    state.body = state.body.filter(x => x.date !== del.dataset.date);
    save(); render();
  });

  // task interactions (delegated): toggle done, or expand instructions
  $("#taskList").addEventListener("click",e=>{
    const infoBtn = e.target.closest(".task-info");
    if(infoBtn){
      e.stopPropagation();
      const d = $("#details-"+infoBtn.dataset.info);
      d.classList.toggle("hidden");
      infoBtn.classList.toggle("open");
      return;
    }
    const row = e.target.closest(".task");
    if(row) toggleTask(parseInt(row.dataset.i,10));
  });

  // reset all
  $("#resetAllBtn").addEventListener("click",()=>{
    if(!confirm("Reset ALL progress and start over? This cannot be undone.")) return;
    localStorage.removeItem(SAVE_KEY); location.reload();
  });
}

document.addEventListener("DOMContentLoaded", init);
