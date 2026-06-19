/* =====================================================================
   stats.js — benchmark-derived stats + the customizable benchmark form
   Stats reflect REAL ability and are fully data-driven: each stat takes the
   BEST of whatever tests you've logged for it (from your benchmark list).
   INT is a discipline score (streak + quests). See config BENCHMARK_CATALOG.
   ===================================================================== */

function disciplineScore(){
  return Math.round(clamp(10 + state.bestStreak*4 + Math.min(state.totalQuests,40)*1.2, 0, 130));
}

// Turn a 0–130 score into a readable tier ("Intermediate", etc.)
function tierFor(scoreVal){
  if(scoreVal == null) return "Untested";
  for(const t of STAT_TIERS){ if(scoreVal >= t.min) return t.label; }
  return "Novice";
}

// Latest logged bodyweight (gym lifts are scored relative to it)
function currentBodyweight(){
  if(!state.body || !state.body.length) return null;
  return state.body.slice().sort((a,b)=> a.date < b.date ? -1 : 1).pop().weight;
}
// A 1RM lift scores 50 at ratio50×bodyweight, ~100 at double that
function scoreLift(kg, ratio50){
  const bw = currentBodyweight();
  if(kg==null || !bw) return null;
  return Math.round(Math.min(130, (kg / bw) / ratio50 * 50));
}

/* ---------- Test resolution & scoring ---------- */
function getTest(id){ return CATALOG_BY_ID[id] || (state.customTests || []).find(t => t.id === id) || null; }
function activeTests(){ return (state.benchActive || []).map(getTest).filter(Boolean); }
function scoreTest(def, value){
  if(def == null || value == null) return null;
  if(def.type === "lift")   return scoreLift(value, def.ratio50);
  if(def.type === "offset") return Math.round(clamp(def.mid + value * def.slope, 0, 120));
  if(def.type === "time")   return value > 0 ? Math.round(Math.min(130, (def.t50 / value) * 50)) : null; // faster = better
  return score(value, def.t50); // "value" (higher = better)
}

function computeStats(bench){
  const b = bench || {};
  const byStat = { STR:[], AGI:[], VIT:[], SEN:[] };
  activeTests().forEach(def=>{
    if(!byStat[def.stat]) return;            // INT (or unknown) isn't a logged test
    const s = scoreTest(def, b[def.id]);
    if(s != null) byStat[def.stat].push(s);
  });
  const best = arr => arr.length ? Math.max(...arr) : null;
  return {
    STR: best(byStat.STR),
    AGI: best(byStat.AGI),
    VIT: best(byStat.VIT),
    SEN: best(byStat.SEN),
    INT: disciplineScore(),
  };
}

/* ---------- Benchmark form ---------- */
function renderBench(){
  const el = $("#benchLast"); if(!el) return;
  const last = state.benchmarks && state.benchmarks.date;
  if(!last){
    el.textContent = "Stats are untested — run a benchmark to reveal your real ability.";
    el.classList.remove("retest");
    return;
  }
  const days = daysBetween(last, todayStr());
  if(days >= 21 && (state.benchActive || []).length){
    el.textContent = `Last benchmark: ${last} · ${days} days ago — time to re-test?`;
    el.classList.add("retest");
  } else {
    el.textContent = `Last benchmark: ${last}`;
    el.classList.remove("retest");
  }
}

// Build the editable list of test inputs + the "add from catalog" dropdown
function renderBenchForm(){
  const wrap = $("#benchFields"); if(!wrap) return;
  const tests = activeTests();
  wrap.innerHTML = "";

  if(!tests.length){
    wrap.innerHTML = `<p class="bench-empty">Your benchmark is empty. Add the tests you actually do from the dropdown below, or create a custom one — your stats are built from whatever you pick.</p>`;
  } else {
    tests.forEach(def=>{
      const stored = state.benchmarks[def.id];
      const dispUnit = def.unit === "kg" ? wUnit() : def.unit === "km" ? dUnit() : def.unit;
      let val = "";
      if(stored != null){
        val = def.unit === "kg" ? round1(kgToDisp(stored))
            : def.unit === "km" ? round1(kmToDisp(stored))
            : stored;
      }
      const extra = def.type === "lift" ? " · vs bodyweight"
                  : def.type === "time" ? " · faster = better"
                  : def.custom          ? " · custom" : "";
      const label = document.createElement("label");
      label.className = "bench-field";
      label.innerHTML = `
        <span class="bf-top">${def.label}
          <button class="bf-del" data-del="${def.id}" title="Remove from list" type="button">✕</button>
        </span>
        <span class="bf-sub">${dispUnit} · ${def.stat}${extra}</span>
        <input id="bm_${def.id}" type="number" step="any" class="text-input small" value="${val}" placeholder="—">`;
      wrap.appendChild(label);
    });
  }

  const sel = $("#benchAddSelect");
  if(sel){
    const activeSet = new Set(state.benchActive || []);
    const opts = BENCHMARK_CATALOG.filter(t => !activeSet.has(t.id));
    if(!opts.length){
      sel.innerHTML = `<option value="">All catalog tests added</option>`;
      sel.disabled = true;
    } else {
      const groups = { STR:"Strength", AGI:"Agility", VIT:"Vitality", SEN:"Sense" };
      let html = `<option value="">Add a test…</option>`;
      Object.keys(groups).forEach(stat=>{
        const items = opts.filter(t => t.stat === stat);
        if(items.length){
          html += `<optgroup label="${groups[stat]}">` +
                  items.map(t => `<option value="${t.id}">${t.label}</option>`).join("") +
                  `</optgroup>`;
        }
      });
      sel.innerHTML = html;
      sel.disabled = false;
    }
  }
}

function openBenchForm(){
  renderBenchForm();
  $("#benchCustomForm").classList.add("hidden");
  $("#benchForm").classList.remove("hidden");
  $("#benchToggleBtn").classList.add("hidden");
}
function closeBenchForm(){
  $("#benchForm").classList.add("hidden");
  $("#benchCustomForm").classList.add("hidden");
  $("#benchToggleBtn").classList.remove("hidden");
}

/* ---------- Add / remove / custom tests ---------- */
function addBenchTest(){
  const sel = $("#benchAddSelect"); const id = sel && sel.value;
  if(!id) return;
  if(!state.benchActive.includes(id)) state.benchActive.push(id);
  save(); renderBenchForm();
}
function removeBenchTest(id){
  state.benchActive = state.benchActive.filter(x => x !== id);
  save(); renderBenchForm();
}
function showCustomForm(){ $("#benchCustomForm").classList.toggle("hidden"); }
function addCustomTest(){
  const label = $("#ct_label").value.trim();
  const stat  = $("#ct_stat").value;
  const unit  = ($("#ct_unit").value.trim() || "reps");
  const t50   = parseFloat($("#ct_t50").value);
  if(!label){ queueNotif("danger","[ SYSTEM ]","Name your test first.",2600); return; }
  if(isNaN(t50) || t50 <= 0){ queueNotif("danger","[ SYSTEM ]","Set a 'solid result' target (the number that should score 50).",3200); return; }
  const id = "custom_" + Date.now().toString(36);
  state.customTests.push({ id, label, unit, stat, type:"value", t50, custom:true });
  state.benchActive.push(id);
  $("#ct_label").value = ""; $("#ct_unit").value = ""; $("#ct_t50").value = "";
  $("#benchCustomForm").classList.add("hidden");
  save(); renderBenchForm();
  queueNotif("ok","[ TEST ADDED ]",`${label} added to your benchmark.`,2600);
}

function saveBenchmark(){
  const prev = { ...state.benchmarks };
  const merged = { ...state.benchmarks };
  let any = false;
  activeTests().forEach(def=>{
    const el = $("#bm_"+def.id); if(!el) return;
    const raw = el.value;
    if(raw !== ""){
      let num = parseFloat(raw);
      if(!isNaN(num)){
        if(def.unit === "kg") num = dispToKg(num);       // store canonical kg
        else if(def.unit === "km") num = dispToKm(num);  // store canonical km
        merged[def.id] = num; any = true;
      }
    }
  });
  if(!any){ queueNotif("danger","[ SYSTEM ]","Enter at least one benchmark value.",2600); return; }
  merged.date = todayStr();
  state.benchmarksPrev = prev;
  state.benchmarks = merged;

  const before = computeStats(prev), after = computeStats(merged);
  // record a dated snapshot for the progress trend (one per day; overwrite same day)
  state.statHistory = (state.statHistory || []).filter(h => h.date !== merged.date);
  state.statHistory.push({ date: merged.date, STR:after.STR, AGI:after.AGI, VIT:after.VIT, SEN:after.SEN, INT:after.INT });
  save(); render(); closeBenchForm();
  queueNotif("ok","[ BENCHMARK LOGGED ]","Stats recalculated from your real numbers.",3200);
  Object.keys(STATS).forEach(k=>{
    if(after[k]!=null && before[k]!=null && after[k]!==before[k]){
      const up = after[k] > before[k];
      queueNotif(up?"level":"danger", up?"[ STAT INCREASED ]":"[ STAT CHANGED ]", `${STATS[k].full}: ${before[k]} → ${after[k]}`, 2800);
    } else if(after[k]!=null && before[k]==null){
      queueNotif("level","[ STAT REVEALED ]",`${STATS[k].full}: ${after[k]}`,2800);
    }
  });
}
