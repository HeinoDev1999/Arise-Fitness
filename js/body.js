/* =====================================================================
   body.js — body-metrics tracking (weight / body-fat / waist) + sparkline
   ===================================================================== */

function sortedBody(){ return [...state.body].sort((a,b)=> a.date < b.date ? -1 : 1); }

function fmtDelta(v, unit, invertGood){
  // invertGood: for weight/fat/waist, going DOWN is usually "good" -> green
  if(v === 0) return `<span class="delta flat">±0 ${unit}</span>`;
  const down = v < 0;
  const good = invertGood ? down : !down;
  const arrow = down ? "▼" : "▲";
  return `<span class="delta ${good?"good":"bad"}">${arrow} ${Math.abs(v).toFixed(1)} ${unit}</span>`;
}

function renderBody(){
  const data = sortedBody();
  const summary = $("#bodySummary");
  const empty = $("#bodyEmpty");
  const list = $("#bodyList");
  const sparkWrap = $("#sparklineWrap");

  if(!data.length){
    summary.innerHTML = "";
    sparkWrap.innerHTML = "";
    list.innerHTML = "";
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  const u = wUnit();
  const latest = data[data.length-1];
  const first = data[0];
  const prev = data.length > 1 ? data[data.length-2] : null;
  const sinceStart = kgToDisp(latest.weight - first.weight);
  const sinceLast = prev ? kgToDisp(latest.weight - prev.weight) : 0;
  const lbl = $("#wUnitLbl"); if(lbl) lbl.textContent = u;

  summary.innerHTML = `
    <div class="body-current">
      <div class="bc-label">CURRENT WEIGHT</div>
      <div class="bc-value">${round1(kgToDisp(latest.weight)).toFixed(1)} <span>${u}</span></div>
    </div>
    <div class="body-deltas">
      <div class="bd-row"><span>Since last</span> ${fmtDelta(sinceLast,u,true)}</div>
      <div class="bd-row"><span>Since start</span> ${fmtDelta(sinceStart,u,true)}</div>
      ${latest.bodyfat!=null ? `<div class="bd-row"><span>Body fat</span> <b>${latest.bodyfat}%</b></div>`:""}
      ${latest.waist!=null ? `<div class="bd-row"><span>Waist</span> <b>${latest.waist} cm</b></div>`:""}
    </div>`;

  sparkWrap.innerHTML = sparkline(data.map(d=>round1(kgToDisp(d.weight))));

  list.innerHTML = "";
  [...data].reverse().forEach((e)=>{
    const li = document.createElement("li");
    li.className = "body-item";
    const extra = [
      e.bodyfat!=null ? `${e.bodyfat}% bf` : null,
      e.waist!=null ? `${e.waist} cm waist` : null,
      e.note ? esc(e.note) : null,
    ].filter(Boolean).join(" · ");
    li.innerHTML = `
      <div class="bi-left">
        <span class="bi-weight">${round1(kgToDisp(e.weight)).toFixed(1)} ${u}</span>
        <span class="bi-date">${e.date}${extra ? " · "+extra : ""}</span>
      </div>
      <button class="bi-del" data-date="${e.date}" title="Delete">✕</button>`;
    list.appendChild(li);
  });
}

function sparkline(values){
  if(values.length < 2) return `<div class="spark-hint">Log at least two entries to see your trend.</div>`;
  const W = 600, H = 120, pad = 14;
  const min = Math.min(...values), max = Math.max(...values);
  const range = (max - min) || 1;
  const stepX = (W - pad*2) / (values.length - 1);
  const pts = values.map((v,i)=>{
    const x = pad + i*stepX;
    const y = pad + (H - pad*2) * (1 - (v - min)/range);
    return [x,y];
  });
  const line = pts.map((p,i)=> (i?"L":"M")+p[0].toFixed(1)+" "+p[1].toFixed(1)).join(" ");
  const area = `M${pts[0][0].toFixed(1)} ${H-pad} ` + pts.map(p=>"L"+p[0].toFixed(1)+" "+p[1].toFixed(1)).join(" ") + ` L${pts[pts.length-1][0].toFixed(1)} ${H-pad} Z`;
  const dots = pts.map(p=>`<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3"/>`).join("");
  return `
    <svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      <defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="rgba(56,189,248,.35)"/><stop offset="100%" stop-color="rgba(56,189,248,0)"/>
      </linearGradient></defs>
      <path d="${area}" fill="url(#sg)"/>
      <path d="${line}" fill="none" stroke="#7fe2ff" stroke-width="2.5"/>
      <g fill="#7fe2ff">${dots}</g>
      <text x="${pad}" y="14" class="spark-lbl">${max.toFixed(1)}</text>
      <text x="${pad}" y="${H-3}" class="spark-lbl">${min.toFixed(1)}</text>
    </svg>`;
}

function logBody(){
  const date = $("#bodyDate").value || todayStr();
  const entered = parseFloat($("#bodyWeight").value);
  if(isNaN(entered) || entered <= 0){ queueNotif("danger","[ SYSTEM ]","Enter a valid weight first.",2600); return; }
  const weight = Math.round(dispToKg(entered) * 100) / 100; // store canonical kg
  const bodyfat = $("#bodyFat").value !== "" ? parseFloat($("#bodyFat").value) : null;
  const waist = $("#bodyWaist").value !== "" ? parseFloat($("#bodyWaist").value) : null;
  const note = $("#bodyNote").value.trim() || null;

  // one entry per date — overwrite if same date
  state.body = state.body.filter(e => e.date !== date);
  state.body.push({ date, weight, bodyfat, waist, note });

  $("#bodyWeight").value = ""; $("#bodyFat").value = ""; $("#bodyWaist").value = ""; $("#bodyNote").value = "";
  $("#bodyDate").value = todayStr();
  save(); render();
  queueNotif("ok","[ LOGGED ]",`Weight ${entered.toFixed(1)} ${wUnit()} saved for ${date}.`,2600);
}
