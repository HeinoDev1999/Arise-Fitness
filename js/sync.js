/* =====================================================================
   sync.js — optional cloud sync via Supabase (email + password auth)
   One JSON row per user. Last-write-wins by state.updatedAt.
   localStorage stays the offline cache; this layer pulls on login and
   pushes (debounced) on every save. Sign-in is OPTIONAL — without it the
   app is fully local, exactly as before.
   ===================================================================== */

let supaClient = null;
let syncUser = null;        // { id, email } when signed in
let pushTimer = null;
let pushEnabled = false;    // gate pushes until the initial merge resolves
let bootLocalUpdated = 0;   // local save's timestamp captured BEFORE any render churn

function captureBootUpdated(){
  try {
    const r = JSON.parse(localStorage.getItem(SAVE_KEY));
    bootLocalUpdated = r && r.updatedAt ? Date.parse(r.updatedAt) : 0;
  } catch(e){ bootLocalUpdated = 0; }
}

function initSync(){
  if(!window.supabase || !window.SUPA_URL || !window.SUPA_KEY){ renderSyncUI(); return; }
  supaClient = window.supabase.createClient(window.SUPA_URL, window.SUPA_KEY);
  supaClient.auth.getSession().then(({ data })=>{
    if(data && data.session){
      syncUser = { id:data.session.user.id, email:data.session.user.email };
      renderSyncUI();
      pullAndMerge();
    } else {
      renderSyncUI();
    }
  });
}

/* ---------- Pull cloud row, merge by timestamp (last write wins) ---------- */
async function pullAndMerge(){
  if(!supaClient || !syncUser) return;
  let res;
  try { res = await supaClient.from("saves").select("data").eq("user_id", syncUser.id).maybeSingle(); }
  catch(e){ queueNotif("danger","[ SYNC ]","Couldn't reach the cloud right now.",3000); return; }
  if(res.error){ queueNotif("danger","[ SYNC ]","Sync error: "+res.error.message,4000); return; }

  const cloud = res.data && res.data.data;
  const cloudUpdated = cloud && cloud.updatedAt ? Date.parse(cloud.updatedAt) : 0;

  if(cloud && cloudUpdated >= bootLocalUpdated){
    // cloud is newer (or this device had none) -> adopt cloud
    state = migrate(cloud);
    lastRenderedLevel = state.level;
    lastRenderedTitle = titleFor(state.level, state.streak);
    pushEnabled = true;
    save();
    render();
    queueNotif("ok","[ SYNCED ]","Loaded your latest progress from the cloud.",3000);
  } else {
    // local was newer (or no cloud yet) -> push it up
    pushEnabled = true;
    await pushNow();
    queueNotif("ok","[ SYNCED ]", cloud ? "This device was newer — pushed to the cloud." : "Cloud sync is on.",3000);
  }
  bootLocalUpdated = Date.now();
}

function schedulePush(){
  if(!pushEnabled || !supaClient || !syncUser) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(pushNow, 1500);
}
async function pushNow(){
  if(!supaClient || !syncUser) return;
  try { await supaClient.from("saves").upsert({ user_id: syncUser.id, data: state }, { onConflict:"user_id" }); }
  catch(e){ /* offline — will retry on the next save */ }
}

/* ---------- Auth actions ---------- */
async function syncSignIn(){
  const email = ($("#syncEmail").value||"").trim();
  const pw = $("#syncPass").value||"";
  if(!email || !pw){ queueNotif("danger","[ SYNC ]","Enter your email and password.",2600); return; }
  const { data, error } = await supaClient.auth.signInWithPassword({ email, password: pw });
  if(error){ queueNotif("danger","[ SYNC ]", error.message, 4200); return; }
  syncUser = { id:data.user.id, email:data.user.email };
  $("#syncPass").value = "";
  renderSyncUI();
  await pullAndMerge();
}
async function syncSignUp(){
  const email = ($("#syncEmail").value||"").trim();
  const pw = $("#syncPass").value||"";
  if(!email){ queueNotif("danger","[ SYNC ]","Enter an email.",2600); return; }
  if(pw.length < 6){ queueNotif("danger","[ SYNC ]","Password must be at least 6 characters.",3000); return; }
  const { data, error } = await supaClient.auth.signUp({ email, password: pw });
  if(error){ queueNotif("danger","[ SYNC ]", error.message, 4200); return; }
  if(data.session){
    syncUser = { id:data.user.id, email:data.user.email };
    $("#syncPass").value = "";
    renderSyncUI();
    await pullAndMerge();
  } else {
    queueNotif("ok","[ CHECK YOUR EMAIL ]","Account created — click the confirmation link in your email, then Sign in.",6500);
  }
}
async function syncSignOut(){
  pushEnabled = false;
  try { await supaClient.auth.signOut(); } catch(e){}
  syncUser = null;
  renderSyncUI();
  queueNotif("ok","[ SYNC ]","Signed out. Your data stays on this device.",3000);
}

/* ---------- Settings UI ---------- */
function renderSyncUI(){
  const g = $("#syncGroup"); if(!g) return;
  if(!supaClient){
    g.innerHTML = `<div class="setup-label">CLOUD SYNC</div>
      <p class="sys-caption">Sync is unavailable right now (offline, or the library didn't load). Reconnect and reopen to sync.</p>`;
    return;
  }
  if(syncUser){
    g.innerHTML = `<div class="setup-label">CLOUD SYNC</div>
      <p class="sys-caption">✓ Synced as <b>${syncUser.email}</b>. Your progress follows you across devices.</p>
      <div class="settings-row">
        <button id="syncNowBtn" class="mini-chip" type="button">Sync now</button>
        <button id="signOutBtn" class="mini-chip" type="button">Sign out</button>
      </div>`;
  } else {
    g.innerHTML = `<div class="setup-label">CLOUD SYNC</div>
      <p class="sys-caption">Sign in with the same account on your phone &amp; PC to sync. New here? Create an account (you'll confirm via a one-time email).</p>
      <input id="syncEmail" type="email" class="text-input small" placeholder="Email" autocomplete="username" />
      <input id="syncPass" type="password" class="text-input small" placeholder="Password (6+ chars)" autocomplete="current-password" style="margin-top:8px" />
      <div class="settings-row" style="margin-top:8px">
        <button id="signInBtn" class="btn btn-ghost btn-small" type="button" style="flex:1">Sign in</button>
        <button id="signUpBtn" class="btn btn-ghost btn-small" type="button" style="flex:1">Create account</button>
      </div>`;
  }
}
