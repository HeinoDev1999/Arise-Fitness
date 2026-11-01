/* =====================================================================
   main.js — initialization & all event wiring (runs on DOMContentLoaded)
   ===================================================================== */
function init(){
  state = load();   // local technical cache only; initSync() below is what decides what's shown
  if($("#bodyDate")) $("#bodyDate").value = todayStr();

  // onboarding (hunter name) — reached the first time a brand-new account signs in
  $("#startBtn").addEventListener("click",()=>{
    const name = ($("#hunterName").value || "Hunter").trim().slice(0,18) || "Hunter";
    const sel = document.querySelector("#expChoices .choice.selected");
    state = defaultState(name, sel ? sel.dataset.exp : DEFAULT_EXPERIENCE);
    const w = parseFloat($("#onboardWeight").value);   // onboarding asks in kg (the default unit)
    if(!isNaN(w) && w >= 20 && w <= 400){
      state.body.push({ date: todayStr(), weight: Math.round(w*100)/100, bodyfat:null, waist:null, note:null });
    }
    save(); showApp();
    queueNotif("level","[ SYSTEM ]","You have become a Player. Begin your daily quest.",4200);
  });
  $("#hunterName").addEventListener("keydown",e=>{ if(e.key==="Enter") $("#startBtn").click(); });
  $("#expChoices").addEventListener("click",e=>{
    const b = e.target.closest(".choice"); if(!b) return;
    $$("#expChoices .choice").forEach(c=>c.classList.remove("selected"));
    b.classList.add("selected");
  });

  // up-front auth screen
  $("#authSignInBtn").addEventListener("click", authSignIn);
  $("#authSignUpBtn").addEventListener("click", authSignUp);
  $("#authPass").addEventListener("keydown",e=>{ if(e.key==="Enter") authSignIn(); });

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
    const swapBtn = e.target.closest(".task-swap");
    if(swapBtn){ e.stopPropagation(); swapTask(parseInt(swapBtn.dataset.swap,10)); return; }
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

  // reset all — wipes the account's saved row, not just this device's cache
  $("#resetAllBtn").addEventListener("click", async ()=>{
    if(!confirm("Reset ALL progress and start over? This cannot be undone.")) return;
    if(supaClient && syncUser){
      try { await supaClient.from("saves").delete().eq("user_id", syncUser.id); } catch(e){}
    }
    localStorage.removeItem(SAVE_KEY);
    location.reload();
  });

  // settings
  $("#settingsBtn").addEventListener("click", openSettings);
  $("#saveNameBtn").addEventListener("click", renameHunter);
  $("#exportBtn").addEventListener("click", exportData);
  $("#importFile").addEventListener("change", e=>{ if(e.target.files[0]) importData(e.target.files[0]); e.target.value = ""; });
  $("#expGroup").addEventListener("click",e=>{
    const b = e.target.closest("[data-exp]"); if(!b) return;
    state.experience = b.dataset.exp;
    save(); renderExperience(); render();
    queueNotif("ok","[ LEVEL SET ]",`Quest targets now tuned for ${EXPERIENCE[state.experience].label}.`,2600);
  });
  $("#unitsGroup").addEventListener("click",e=>{
    const w = e.target.closest("[data-uw]"), d = e.target.closest("[data-ud]");
    if(w){ state.units.weight = w.dataset.uw; save(); renderUnits(); render(); }
    else if(d){ state.units.distance = d.dataset.ud; save(); renderUnits(); render(); }
  });

  // account (Supabase) — Settings only ever shows the signed-in state
  $("#syncGroup").addEventListener("click",e=>{
    const b = e.target.closest("button"); if(b && b.id === "signOutBtn") syncSignOut();
  });
  initSync();
}

document.addEventListener("DOMContentLoaded", init);

// Register the service worker for offline use (no-op on file:// or older browsers)
if("serviceWorker" in navigator){
  window.addEventListener("load", ()=> navigator.serviceWorker.register("sw.js").catch(()=>{}));
}
