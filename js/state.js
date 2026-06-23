/* =====================================================================
   state.js — the save object: defaults, migration, load & save
   Everything persists locally via localStorage.
   ===================================================================== */

let state = null;

function defaultState(name){
  return {
    name, level:1, xp:0, totalXp:0,
    streak:0, bestStreak:0, totalQuests:0,
    lastCompletedDate:null,
    lastOnPlanDate:null,  // last day you completed a quest OR took a rest day (keeps streak alive)
    restDate:null,        // date of the current rest day (if any)
    lastChoices:null,     // {location, focus, mode} — remembered for fast daily setup
    today:null,   // { date, location, mode, focus, kind, statScale, tasks:[], completed }
    penalty:null, // active Penalty Quest (must be cleared before training resumes)
    gatesToday:0, gatesDate:null,
    body:[],      // [{date, weight, bodyfat, waist, note}]
    benchmarks:{},     // latest test values keyed by test id (+ a 'date')
    benchmarksPrev:{}, // previous snapshot (for "since last test" deltas)
    benchActive: DEFAULT_BENCH.slice(), // which tests appear in your benchmark list
    customTests: [],   // user-created test defs {id,label,unit,stat,type:"value",t50,custom:true}
    statHistory: [],   // [{date, STR, AGI, VIT, SEN, INT}] snapshot per benchmark save (for trends)
    units: { weight:"kg", distance:"km" }, // display units (values are stored canonical: kg, km)
    updatedAt: null,   // ISO timestamp of last change (drives last-write-wins cloud sync)
    history:[],
  };
}
function migrate(s){
  if(!s) return s;
  if(s.gatesToday === undefined) s.gatesToday = 0;
  if(s.gatesDate === undefined) s.gatesDate = null;
  if(!Array.isArray(s.body)) s.body = [];
  if(!s.benchmarks) s.benchmarks = {};
  if(!s.benchmarksPrev) s.benchmarksPrev = {};
  if(s.lastOnPlanDate === undefined) s.lastOnPlanDate = s.lastCompletedDate || null;
  if(s.restDate === undefined) s.restDate = null;
  if(s.lastChoices === undefined) s.lastChoices = null;
  if(s.penalty === undefined) s.penalty = null;
  if(!Array.isArray(s.customTests)) s.customTests = [];
  if(!Array.isArray(s.statHistory)) s.statHistory = [];
  if(!s.units || typeof s.units !== "object") s.units = { weight:"kg", distance:"km" };
  if(!Array.isArray(s.benchActive)){
    // start from defaults, then keep any catalog tests they've already logged
    s.benchActive = DEFAULT_BENCH.slice();
    Object.keys(s.benchmarks || {}).forEach(k=>{
      if(k !== "date" && CATALOG_BY_ID[k] && !s.benchActive.includes(k)) s.benchActive.push(k);
    });
  }
  delete s.stats; // stats are now computed from benchmarks
  return s;
}
function load(){ try{ const r=localStorage.getItem(SAVE_KEY); return r?migrate(JSON.parse(r)):null; }catch(e){ return null; } }
function save(){
  if(state) state.updatedAt = new Date().toISOString();   // last-write timestamp for sync
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  if(typeof schedulePush === "function") schedulePush();  // debounced cloud push (if signed in)
}
