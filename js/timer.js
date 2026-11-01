/* =====================================================================
   timer.js — rest timer between sets
   Tap a duration to start a countdown (and make it your default). With
   "Auto" on, a rest starts whenever you tick off an exercise. The countdown
   uses an end timestamp, so it stays correct if the tab is throttled.
   ===================================================================== */

const REST_OPTIONS = [30, 60, 90, 120];
let restEnd = 0;       // epoch ms when the current rest finishes (0 = idle)
let restTick = null;

function restCfg(){
  if(!state.rest || typeof state.rest !== "object") state.rest = { auto:true, secs:60 };
  return state.rest;
}
function fmtRest(sec){ return `${Math.floor(sec/60)}:${String(sec%60).padStart(2,"0")}`; }

function startRest(secs){
  restEnd = Date.now() + secs * 1000;
  clearInterval(restTick);
  restTick = setInterval(updateRest, 250);
  updateRest();
}
function stopRest(){
  clearInterval(restTick); restTick = null; restEnd = 0;
  renderRestBar();
}
function updateRest(){
  const left = Math.ceil((restEnd - Date.now()) / 1000);
  if(left <= 0){
    stopRest();
    restAlert();
    queueNotif("ok","[ REST OVER ]","Next set, Hunter.",2200);
    return;
  }
  const t = $("#restTime"); if(t) t.textContent = fmtRest(left);
  const skip = $("#restSkipBtn"); if(skip) skip.classList.remove("hidden");
}

// two short beeps + a vibration (each is best-effort; browsers may block either)
function restAlert(){
  try { if(navigator.vibrate) navigator.vibrate([200,100,200]); } catch(e){}
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext; if(!Ctx) return;
    const ctx = new Ctx();
    [0, 0.25].forEach(delay=>{
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.0001, ctx.currentTime + delay);
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + delay + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + 0.18);
      o.start(ctx.currentTime + delay); o.stop(ctx.currentTime + delay + 0.2);
    });
  } catch(e){}
}

// Called from toggleTask when an exercise is ticked off
function autoRest(task){
  if(!state || task.stat === "INT") return;      // habits (water, sleep…) don't need a rest
  if(restCfg().auto) startRest(restCfg().secs);
}

function renderRestBar(){
  const bar = $("#restBar"); if(!bar || !state) return;
  const q = activeQuest();
  bar.classList.toggle("hidden", !q || !!q.completed);
  const cfg = restCfg();
  $$("#restBar [data-rest]").forEach(b => b.classList.toggle("on", parseInt(b.dataset.rest, 10) === cfg.secs));
  const auto = $("#restAutoBtn"); if(auto) auto.textContent = cfg.auto ? "Auto: on" : "Auto: off";
  const running = restEnd > Date.now();
  const skip = $("#restSkipBtn"); if(skip) skip.classList.toggle("hidden", !running);
  const t = $("#restTime"); if(t && !running) t.textContent = fmtRest(cfg.secs);
}

function wireRestBar(){
  $("#restBar").addEventListener("click", e=>{
    const d = e.target.closest("[data-rest]");
    if(d){
      const secs = parseInt(d.dataset.rest, 10);
      restCfg().secs = secs; save();
      startRest(secs); renderRestBar();
      return;
    }
    if(e.target.id === "restAutoBtn"){ restCfg().auto = !restCfg().auto; save(); renderRestBar(); }
    if(e.target.id === "restSkipBtn"){ stopRest(); }
  });
}
