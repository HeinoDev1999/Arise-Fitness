/* =====================================================================
   sync.js — account + cloud sync via Supabase (email + password)
   Model: "the cloud is the boss." Sign in → your account's data loads.
   Make changes → they save to your account (debounced). localStorage is
   the offline cache. One safety rule: an empty/fresh device never
   overwrites a cloud that already has data (and vice-versa).
   ===================================================================== */

let supaClient = null;
let syncUser = null;        // { id, email } when signed in
let pushTimer = null;
let pushEnabled = false;

function createSupa(){
  if(supaClient) return;
  if(window.supabase && window.SUPA_URL && window.SUPA_KEY){
    supaClient = window.supabase.createClient(window.SUPA_URL, window.SUPA_KEY);
  }
}
function initSync(){
  createSupa();
  if(!supaClient){
    // sync unavailable (offline first load / lib blocked) — let them work locally
    if(state) showApp(); else showAuthScreen();
    return;
  }
  supaClient.auth.getSession().then(({ data })=>{
    if(data && data.session){ setUser(data.session.user); afterAuth(); }
    else { showAuthScreen(); }
  }).catch(()=> showAuthScreen());
}

function setUser(u){ syncUser = { id:u.id, email:u.email }; }

/* After a session is established: pull the account's data, then show the app. */
async function afterAuth(){
  renderSyncUI();
  let route = "app";
  try { route = await pullCloud(); } catch(e){ route = "app"; }
  pushEnabled = true;
  if(route === "onboard") showOnboarding();
  else showApp();
}

/* Cloud is the boss — with one guard so empty data can't clobber real data. */
async function pullCloud(){
  if(!supaClient || !syncUser) return "app";
  let res;
  try { res = await supaClient.from("saves").select("data").eq("user_id", syncUser.id).maybeSingle(); }
  catch(e){ queueNotif("danger","[ SYNC ]","Offline — using this device's saved copy.",3000); return "app"; }
  if(res.error){ queueNotif("danger","[ SYNC ]","Sync error: "+res.error.message,4000); return "app"; }

  const cloud = res.data && res.data.data;
  if(cloud && isMeaningfulState(cloud)){
    // account has data -> load it (cloud wins)
    state = migrate(cloud);
    persistClean();
    return "app";
  }
  if(isMeaningfulState(state)){
    // account empty but this device has data -> seed/recover the cloud
    await pushNow();
    return "app";
  }
  // brand-new account, nothing anywhere -> create a hunter
  return "onboard";
}

function schedulePush(){
  if(!pushEnabled || !supaClient || !syncUser) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(pushNow, 1200);
}
async function pushNow(){
  if(!supaClient || !syncUser) return;
  try { await supaClient.from("saves").upsert({ user_id: syncUser.id, data: state }, { onConflict:"user_id" }); }
  catch(e){ /* offline — retries on the next change */ }
}

/* ---------- Auth core ---------- */
async function doSignIn(email, pw, msgEl){
  if(!supaClient){ if(msgEl) msgEl.textContent = "Sync is offline right now."; return; }
  if(!email || !pw){ if(msgEl) msgEl.textContent = "Enter your email and password."; return; }
  const { data, error } = await supaClient.auth.signInWithPassword({ email, password: pw });
  if(error){ if(msgEl) msgEl.textContent = error.message; else queueNotif("danger","[ SYNC ]", error.message, 4200); return; }
  localStorage.removeItem("offlineMode");
  setUser(data.user);
  await afterAuth();
}
async function doSignUp(email, pw, msgEl){
  if(!supaClient){ if(msgEl) msgEl.textContent = "Sync is offline right now."; return; }
  if(!email){ if(msgEl) msgEl.textContent = "Enter an email."; return; }
  if(pw.length < 6){ if(msgEl) msgEl.textContent = "Password must be at least 6 characters."; return; }
  const { data, error } = await supaClient.auth.signUp({ email, password: pw });
  if(error){ if(msgEl) msgEl.textContent = error.message; else queueNotif("danger","[ SYNC ]", error.message, 4200); return; }
  if(data.session){
    localStorage.removeItem("offlineMode");
    setUser(data.user);
    await afterAuth();
  } else {
    const m = "Account created — click the confirmation link in your email, then Sign in.";
    if(msgEl) msgEl.textContent = m; else queueNotif("ok","[ CHECK YOUR EMAIL ]", m, 6500);
  }
}

/* up-front login screen */
function authSignIn(){ doSignIn(($("#authEmail").value||"").trim(), $("#authPass").value||"", $("#authMsg")); }
function authSignUp(){ doSignUp(($("#authEmail").value||"").trim(), $("#authPass").value||"", $("#authMsg")); }
/* Settings → Cloud Sync */
function syncSignIn(){ doSignIn(($("#syncEmail").value||"").trim(), $("#syncPass").value||"", null); }
function syncSignUp(){ doSignUp(($("#syncEmail").value||"").trim(), $("#syncPass").value||"", null); }

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
      <p class="sys-caption">Sync is unavailable right now (offline). Reconnect and reopen to sync.</p>`;
    return;
  }
  if(syncUser){
    g.innerHTML = `<div class="setup-label">CLOUD SYNC</div>
      <p class="sys-caption">✓ Signed in as <b>${syncUser.email}</b>. Your progress syncs to your account.</p>
      <div class="settings-row">
        <button id="syncNowBtn" class="mini-chip" type="button">Sync now</button>
        <button id="signOutBtn" class="mini-chip" type="button">Sign out</button>
      </div>`;
  } else {
    g.innerHTML = `<div class="setup-label">CLOUD SYNC</div>
      <p class="sys-caption">Sign in to sync across devices.</p>
      <input id="syncEmail" type="email" class="text-input small" placeholder="Email" autocomplete="username" />
      <input id="syncPass" type="password" class="text-input small" placeholder="Password (6+ chars)" autocomplete="current-password" style="margin-top:8px" />
      <div class="settings-row" style="margin-top:8px">
        <button id="signInBtn" class="btn btn-ghost btn-small" type="button" style="flex:1">Sign in</button>
        <button id="signUpBtn" class="btn btn-ghost btn-small" type="button" style="flex:1">Create account</button>
      </div>`;
  }
}
