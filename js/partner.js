/* =====================================================================
   partner.js — link with a partner (e.g. your girlfriend) and see each
   other's streak & level. Each person's `profiles` row is a small public
   summary (name, level, rank, streak, quests, last trained) — never the
   full save. You link by trading invite codes; either side can unlink.
   ===================================================================== */

let myInviteCode = null;
let partners = [];          // linked partners' profile rows

// What a partner is allowed to see about you
function profileSummary(){
  return {
    user_id: syncUser.id,
    hunter_name: state.name || "Hunter",
    level: state.level,
    rank: rankForLevel(state.level),
    title: titleFor(state.level, state.streak),
    streak: state.streak,
    best_streak: state.bestStreak,
    total_quests: state.totalQuests,
    last_trained: state.lastCompletedDate || null,
  };
}
async function pushProfile(){
  if(!supaClient || !syncUser || !state) return;
  try { await supaClient.from("profiles").upsert(profileSummary(), { onConflict:"user_id" }); }
  catch(e){ /* transient — retried on the next change */ }
}

async function loadPartners(){
  if(!supaClient || !syncUser) return;
  try {
    const mine = await supaClient.from("profiles").select("invite_code").eq("user_id", syncUser.id).maybeSingle();
    myInviteCode = mine.data ? mine.data.invite_code : null;
    // row-level security only ever returns your partners (plus yourself, filtered out here)
    const res = await supaClient.from("profiles")
      .select("user_id,hunter_name,level,rank,title,streak,best_streak,total_quests,last_trained")
      .neq("user_id", syncUser.id);
    partners = res.data || [];
  } catch(e){ /* offline — keep what we had */ }
  renderPartnerCard();
  renderPartnerSettings();
}

async function linkPartner(){
  const input = $("#partnerCodeInput"); if(!input) return;
  const code = input.value.trim();
  if(!code){ queueNotif("danger","[ PARTNER ]","Enter your partner's code first.",2600); return; }
  await pushProfile();                       // make sure your own profile exists before linking
  const { data, error } = await supaClient.rpc("link_partner", { code });
  if(error){ queueNotif("danger","[ PARTNER ]", error.message, 4200); return; }
  input.value = "";
  queueNotif("ok","[ LINKED ]",`You're now linked with ${data}.`,3600);
  await loadPartners();
}

async function unlinkPartner(otherId){
  if(!confirm("Unlink from this partner? You'll stop seeing each other's progress.")) return;
  const a = syncUser.id < otherId ? syncUser.id : otherId;
  const b = syncUser.id < otherId ? otherId : syncUser.id;
  const { error } = await supaClient.from("partnerships").delete().eq("user_a", a).eq("user_b", b);
  if(error){ queueNotif("danger","[ PARTNER ]", error.message, 4200); return; }
  queueNotif("ok","[ PARTNER ]","Unlinked.",2600);
  await loadPartners();
}

function agoText(dateStr){
  if(!dateStr) return "hasn't trained yet";
  const d = daysBetween(dateStr, todayStr());
  return d <= 0 ? "trained today ✓" : d === 1 ? "trained yesterday" : `trained ${d} days ago`;
}

/* ---------- Status tab card ---------- */
function renderPartnerCard(){
  const el = $("#partnerCard"); if(!el) return;
  if(!partners.length){ el.classList.add("hidden"); el.innerHTML = ""; return; }
  el.classList.remove("hidden");
  el.innerHTML = `
    <div class="panel-corner tl"></div><div class="panel-corner tr"></div>
    <div class="panel-corner bl"></div><div class="panel-corner br"></div>
    <div class="system-tag">[ PARTNER ]</div>
    ${partners.map(p => `
      <div class="partner-row">
        <span class="rank-badge small">${esc(p.rank)}</span>
        <div class="partner-main">
          <div class="partner-name">${esc(p.hunter_name)} <span class="partner-title">${esc(p.title)}</span></div>
          <div class="partner-sub">Level ${Number(p.level)} · ${Number(p.total_quests)} quests · ${esc(agoText(p.last_trained))}</div>
        </div>
        <div class="partner-streak">🔥 ${Number(p.streak)}</div>
      </div>`).join("")}
    <button id="partnerRefreshBtn" class="link-btn" type="button">↻ Refresh</button>`;
}

/* ---------- Settings group ---------- */
function renderPartnerSettings(){
  const g = $("#partnerGroup"); if(!g) return;
  g.innerHTML = `
    <div class="setup-label">PARTNER</div>
    <p class="sys-caption">Link with your partner to see each other's level and streak. They'll only ever see your hunter name, level, rank, streak, quests cleared and last-trained date — nothing else.</p>
    <p class="sys-caption">Your code: <b class="invite-code">${myInviteCode ? esc(myInviteCode) : "…"}</b> — give it to them.</p>
    <div class="settings-row">
      <input id="partnerCodeInput" class="text-input small" placeholder="Their code" maxlength="12" autocomplete="off" />
      <button id="partnerLinkBtn" class="mini-chip" type="button">Link</button>
    </div>
    ${partners.map(p => `
      <div class="partner-linked"><span>✓ Linked with <b>${esc(p.hunter_name)}</b></span>
      <button class="link-btn" data-unlink="${esc(p.user_id)}" type="button">Unlink</button></div>`).join("")}`;
}
