/* =====================================================================
   main.js — initialization & all event wiring (runs on DOMContentLoaded)
   ===================================================================== */
function init(){
  state = load();   // local cache (may be null); entry decided in bootEntry() after wiring
  if($("#bodyDate")) $("#bodyDate").value = todayStr();

  // onboarding (hunter name) — reached for a brand-new account or offline start
  $("#startBtn").addEventListener("click",()=>{
    const name = ($("#hunterName").value || "Hunter").trim().slice(0,18) || "Hunter";
    state = defaultState(name); save(); showApp();
    queueNotif("level","[ SYSTEM ]","You have become a Player. Begin your daily quest.",4200);
  });
  $("#hunterName").addEventListener("keydown",e=>{ if(e.key==="Enter") $("#startBtn").click(); });

  // up-front auth screen
  $("#authSignInBtn").addEventListener("click", authSignIn);
  $("#authSignUpBtn").addEventListener("click", authSignUp);
  $("#authPass").addEventListener("keydown",e=>{ if(e.key==="Enter") authSignIn(); });
  $("#authOfflineBtn").addEventListener("click",()=>{
    localStorage.setItem("offlineMode","1");
    if(state) showApp(); else showOnboarding();
  });

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

  // reset all
  $("#resetAllBtn").addEventListener("click",()=>{
    if(!confirm("Reset ALL progress and start over? This cannot be undone.")) return;
    localStorage.removeItem(SAVE_KEY); location.reload();
  });

  // settings
  $("#settingsBtn").addEventListener("click", openSettings);
  $("#saveNameBtn").addEventListener("click", renameHunter);
  $("#exportBtn").addEventListener("click", exportData);
  $("#importFile").addEventListener("change", e=>{ if(e.target.files[0]) importData(e.target.files[0]); e.target.value = ""; });
  $("#unitsGroup").addEventListener("click",e=>{
    const w = e.target.closest("[data-uw]"), d = e.target.closest("[data-ud]");
    if(w){ state.units.weight = w.dataset.uw; save(); renderUnits(); render(); }
    else if(d){ state.units.distance = d.dataset.ud; save(); renderUnits(); render(); }
  });

  // cloud sync (Supabase)
  $("#syncGroup").addEventListener("click",e=>{
    const b = e.target.closest("button"); if(!b) return;
    if(b.id === "signInBtn")  syncSignIn();
    else if(b.id === "signUpBtn")  syncSignUp();
    else if(b.id === "signOutBtn") syncSignOut();
    else if(b.id === "syncNowBtn"){
      pullCloud().then(()=>{
        lastRenderedLevel = state.level;
        lastRenderedTitle = titleFor(state.level, state.streak);
        render();
        queueNotif("ok","[ SYNCED ]","Up to date with your account.",2400);
      });
    }
  });
  bootEntry();
}

// Decide what to show on launch: offline-mode -> local; otherwise let the
// cloud layer route (session -> pull & app; no session -> login screen).
function bootEntry(){
  if(localStorage.getItem("offlineMode") === "1"){
    if(typeof createSupa === "function") createSupa();   // so Settings → Cloud Sync can still sign in later
    if(state) showApp(); else showOnboarding();
    return;
  }
  if(typeof initSync === "function"){ initSync(); }
  else if(state){ showApp(); } else { showOnboarding(); }
}

document.addEventListener("DOMContentLoaded", init);

// Register the service worker for offline use (no-op on file:// or older browsers)
if("serviceWorker" in navigator){
  window.addEventListener("load", ()=> navigator.serviceWorker.register("sw.js").catch(()=>{}));
}
