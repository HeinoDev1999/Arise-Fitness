/* =====================================================================
   settings.js — Settings tab: rename, data backup (export/import), reset
   ===================================================================== */

/* Experience level: scales quest targets. Weight comes from your latest Body entry. */
function renderExperience(){
  const g = $("#expGroup"); if(!g) return;
  const bw = currentBodyweight();
  const wNote = bw
    ? `Tuned using your latest weight: <b>${round1(kgToDisp(bw))} ${wUnit()}</b>.`
    : `Log your weight in the <b>Body</b> tab to tune bodyweight exercises to you.`;
  const pct = Math.round((adaptFactor() - 1) * 100);
  const adaptNote = Math.abs(adaptFactor() - 1) >= 0.01
    ? `<p class="sys-caption">Your "how did that feel?" ratings have adjusted targets by <b>${pct > 0 ? "+" : ""}${pct}%</b>. <button id="resetAdaptBtn" class="link-btn" type="button">Reset</button></p>` : "";
  g.innerHTML = `
    <div class="setup-label">EXPERIENCE LEVEL</div>
    <div class="exp-choices" id="expSettings">
      ${Object.keys(EXPERIENCE).map(k => `
        <button class="choice${state.experience===k?" selected":""}" data-exp="${k}" type="button">
          ${EXPERIENCE[k].label}<span class="choice-sub">${EXPERIENCE[k].desc}</span>
        </button>`).join("")}
    </div>
    <p class="sys-caption">Scales every rep, duration and distance — and how many hard exercises you get. ${wNote} Applies to quests you generate from now on.</p>${adaptNote}`;
}

/* Gym equipment checklist: gym quests only use exercises you can actually do there. */
function renderGear(){
  const g = $("#gearGroup"); if(!g) return;
  const have = new Set(state.gymGear || []);
  g.innerHTML = `
    <div class="setup-label">MY GYM'S EQUIPMENT</div>
    <p class="sys-caption">Tick what your gym has — gym quests will only use those. Bodyweight moves are always available.</p>
    <div class="gear-grid">
      ${Object.keys(EQUIPMENT).map(k => `<button class="gear-chip${have.has(k)?" on":""}" data-gear="${k}" type="button">${have.has(k)?"✓ ":""}${EQUIPMENT[k]}</button>`).join("")}
    </div>
    <div class="settings-row" style="margin-top:8px">
      <button class="mini-chip" data-gearall="1" type="button">Select all</button>
      <button class="mini-chip" data-gearnone="1" type="button">Clear all</button>
    </div>`;
}

function openSettings(){
  if($("#setName")) $("#setName").value = state.name || "";
  renderPartnerSettings();
  if(typeof loadPartners === "function") loadPartners();
  renderGear();
  renderExperience();
  if(typeof renderUnits === "function") renderUnits();
  if(typeof renderSyncUI === "function") renderSyncUI();
  switchTab("settings");
}

function renderUnits(){
  const g = $("#unitsGroup"); if(!g) return;
  g.innerHTML = `
    <div class="setup-label">UNITS</div>
    <div class="units-row"><span>Weight</span>
      <div class="seg" id="segWeight">
        <button class="seg-btn${wUnit()==='kg'?' on':''}" data-uw="kg" type="button">kg</button>
        <button class="seg-btn${wUnit()==='lb'?' on':''}" data-uw="lb" type="button">lb</button>
      </div></div>
    <div class="units-row"><span>Distance</span>
      <div class="seg" id="segDist">
        <button class="seg-btn${dUnit()==='km'?' on':''}" data-ud="km" type="button">km</button>
        <button class="seg-btn${dUnit()==='mi'?' on':''}" data-ud="mi" type="button">mi</button>
      </div></div>`;
}

function renameHunter(){
  const v = ($("#setName").value || "").trim().slice(0,18);
  if(!v){ queueNotif("danger","[ SYSTEM ]","Enter a name first.",2400); return; }
  state.name = v;
  save(); render();
  queueNotif("ok","[ SYSTEM ]",`Name updated to ${v}.`,2600);
}

/* ---------- Backup: export / import the full save ---------- */
function exportData(){
  const data = localStorage.getItem(SAVE_KEY) || JSON.stringify(state);
  const blob = new Blob([data], { type:"application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `the-system-backup-${todayStr()}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  queueNotif("ok","[ EXPORTED ]","Backup downloaded. Keep it safe, Hunter.",3200);
}

function importData(file){
  if(!file) return;
  const reader = new FileReader();
  reader.onload = e=>{
    let obj;
    try { obj = JSON.parse(e.target.result); }
    catch(err){ queueNotif("danger","[ IMPORT FAILED ]","That file isn't valid JSON.",3600); return; }
    if(!obj || typeof obj !== "object" || obj.level === undefined || obj.name === undefined){
      queueNotif("danger","[ IMPORT FAILED ]","That doesn't look like a SYSTEM backup.",3800); return;
    }
    if(!confirm("Import this backup? It will REPLACE all your current progress in your account.")) return;
    state = migrate(obj);
    save();
    lastRenderedLevel = state.level;
    lastRenderedTitle = titleFor(state.level, state.streak);
    render();
    switchTab("status");
    queueNotif("ok","[ IMPORTED ]","Backup restored. Welcome back, Hunter.",3600);
  };
  reader.readAsText(file);
}
