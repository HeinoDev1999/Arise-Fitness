/* =====================================================================
   helpers.js — generic utilities, scoring math & the System notifications
   ===================================================================== */

/* ---------- DOM + misc helpers ---------- */
const $  = (s)=>document.querySelector(s);
const $$ = (s)=>document.querySelectorAll(s);
function todayStr(){ return new Date().toISOString().slice(0,10); }
function daysBetween(a,b){ return Math.round((new Date(b)-new Date(a))/86400000); }
function rand(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function shuffle(arr){ return [...arr].sort(()=>Math.random()-0.5); }
function cap(s){ return s ? s[0].toUpperCase()+s.slice(1) : s; }
function clamp(n,a,b){ return Math.max(a, Math.min(b, n)); }

/* ---------- Benchmark scoring math ---------- */
function score(value, t50){ return value==null ? null : Math.round(Math.min(130, (value / t50) * 50)); }

/* ---------- Notifications (the blue System pop-ups) ---------- */
let notifQueue = [], notifShowing = false;
function queueNotif(type, tag, msg, dur=3200){
  notifQueue.push({type, tag, msg, dur});
  if(!notifShowing) showNextNotif();
}
function showNextNotif(){
  if(!notifQueue.length){ notifShowing=false; return; }
  notifShowing = true;
  const { type, tag, msg, dur } = notifQueue.shift();
  const el = document.createElement("div");
  el.className = `notif ${type}`;
  el.innerHTML = `<div class="notif-tag">${tag}</div><div class="notif-msg">${msg}</div>`;
  $("#notifications").appendChild(el);
  setTimeout(()=>{ el.classList.add("out"); setTimeout(()=>{ el.remove(); showNextNotif(); }, 400); }, dur);
}
