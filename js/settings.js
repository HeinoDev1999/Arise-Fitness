/* =====================================================================
   settings.js — Settings tab: rename, data backup (export/import), reset
   ===================================================================== */

function openSettings(){
  if($("#setName")) $("#setName").value = state.name || "";
  if(typeof renderUnits === "function") renderUnits();
  switchTab("settings");
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
    if(!confirm("Import this backup? It will REPLACE all your current progress on this device.")) return;
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
