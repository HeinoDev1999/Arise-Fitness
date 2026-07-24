/* =====================================================================
   sync.js — account system via Supabase (email + password)
   Online-only, single source of truth: your account's row in Supabase
   IS your progress. Sign in anywhere -> it loads. Every change saves to
   your account automatically. No offline mode, no local/cloud merging.
   ===================================================================== */

let supaClient = null;
let syncUser = null;   // { id, email } when signed in
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
    showAuthScreen();
    queueNotif("danger","[ SYSTEM ]","Couldn't connect. Check your internet connection and refresh.",5200);
    return;
  }
  supaClient.auth.getSession().then(({ data })=>{
    if(data && data.session){ setUser(data.session.user); afterAuth(); }
    else { showAuthScreen(); }
  }).catch(()=>{
    showAuthScreen();
    queueNotif("danger","[ SYSTEM ]","Couldn't reach the server. Check your connection and try again.",5200);
  });
}

function setUser(u){ syncUser = { id:u.id, email:u.email }; }

/* After a session is established: load the account's data, then show the app. */
async function afterAuth(){
  renderSyncUI();
  const route = await pullCloud();
  pushEnabled = true;
  if(route === "onboard") showOnboarding();
  else showApp();
}

/* Your account's row IS your data — load it, or start fresh if none exists yet. */
async function pullCloud(){
  if(!supaClient || !syncUser) return "onboard";
  let res;
  try { res = await supaClient.from("saves").select("data").eq("user_id", syncUser.id).maybeSingle(); }
  catch(e){ queueNotif("danger","[ SYSTEM ]","Couldn't reach the server. Try again.",3600); return "app"; }
  if(res.error){ queueNotif("danger","[ SYSTEM ]","Error loading your progress: "+res.error.message,4200); return "app"; }

  const cloud = res.data && res.data.data;
  if(cloud){
    state = migrate(cloud);
    persistClean();
    return "app";
  }
  return "onboard"; // brand-new account — nothing saved yet
}

function schedulePush(){
  if(!pushEnabled || !supaClient || !syncUser) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(pushNow, 1200);
}
async function pushNow(){
  if(!supaClient || !syncUser) return;
  try { await supaClient.from("saves").upsert({ user_id: syncUser.id, data: state }, { onConflict:"user_id" }); }
  catch(e){ /* transient network issue — the next change retries */ }
}

/* ---------- Auth actions (up-front login screen) ---------- */
async function doSignIn(email, pw, msgEl){
  if(!supaClient){ msgEl.textContent = "Can't connect right now."; return; }
  if(!email || !pw){ msgEl.textContent = "Enter your email and password."; return; }
  const { data, error } = await supaClient.auth.signInWithPassword({ email, password: pw });
  if(error){ msgEl.textContent = error.message; return; }
  setUser(data.user);
  await afterAuth();
}
async function doSignUp(email, pw, msgEl){
  if(!supaClient){ msgEl.textContent = "Can't connect right now."; return; }
  if(!email){ msgEl.textContent = "Enter an email."; return; }
  if(pw.length < 6){ msgEl.textContent = "Password must be at least 6 characters."; return; }
  const { data, error } = await supaClient.auth.signUp({ email, password: pw });
  if(error){ msgEl.textContent = error.message; return; }
  if(data.session){
    setUser(data.user);
    await afterAuth();
  } else {
    msgEl.textContent = "Account created — click the confirmation link in your email, then sign in.";
  }
}
function authSignIn(){ doSignIn(($("#authEmail").value||"").trim(), $("#authPass").value||"", $("#authMsg")); }
function authSignUp(){ doSignUp(($("#authEmail").value||"").trim(), $("#authPass").value||"", $("#authMsg")); }

async function syncSignOut(){
  pushEnabled = false;
  try { await supaClient.auth.signOut(); } catch(e){}
  syncUser = null;
  state = null;
  localStorage.removeItem(SAVE_KEY);
  showAuthScreen();
  queueNotif("ok","[ SYSTEM ]","Signed out.",2600);
}

/* ---------- Settings UI ---------- */
function renderSyncUI(){
  const g = $("#syncGroup"); if(!g || !syncUser) return;
  g.innerHTML = `<div class="setup-label">ACCOUNT</div>
    <p class="sys-caption">Signed in as <b>${syncUser.email}</b>.</p>
    <button id="signOutBtn" class="mini-chip" type="button">Sign out</button>`;
}
