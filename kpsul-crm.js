/* KPSUL — CRM COACH (fiche client professionnelle) */
(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));
  const sb = () => window.sb || null;
  const safe = v => String(v ?? "").replace(/[&<>"']/g, s =>
    ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[s]));
  const fmtDate = d => { try { return new Date(d).toLocaleDateString("fr-FR",{day:"2-digit",month:"short",year:"numeric"}); } catch(e){ return d||""; } };
  const fmtShort = d => { try { return new Date(d).toLocaleDateString("fr-FR",{day:"2-digit",month:"short"}); } catch(e){ return d||""; } };
  const round1 = n => Math.round(Number(n||0)*10)/10;
  const daysAgo = d => { try { return Math.floor((Date.now()-new Date(d))/86400000); } catch(e){ return null; } };

  let clients = [];
  let selected = null;
  let isCoach = false;

  /* ─── STYLE ────────────────────────────────────────────────── */
  function injectStyle() {
    if ($("kcrmStyle")) return;
    const st = document.createElement("style");
    st.id = "kcrmStyle";
    st.textContent = `
      .kcrm-search { width:100%;margin-bottom:14px }
      .kcrm-client {
        display:flex;justify-content:space-between;align-items:center;gap:10px;
        border:1px solid var(--line,#22403A);border-radius:14px;
        background:rgba(255,255,255,.02);padding:14px 16px;margin-bottom:9px;
        cursor:pointer;transition:border-color .18s,transform .12s;width:100%;text-align:left;
      }
      .kcrm-client:hover { border-color:var(--core,#34E0C8);transform:translateY(-1px) }
      .kcrm-client b { font-family:var(--disp,system-ui);font-size:16px;display:block }
      .kcrm-client span { color:#8A9A93;font-size:12.5px;display:block;margin-top:2px }
      .kcrm-tag {
        flex:0 0 auto;font-family:var(--mono,monospace);font-size:10px;
        letter-spacing:.06em;text-transform:uppercase;
        border:1px solid var(--line,#22403A);border-radius:99px;padding:4px 10px;color:#8A9A93;
      }
      .kcrm-tag.on { border-color:rgba(52,224,200,.5);color:var(--core,#34E0C8) }

      .kcrm-head {
        border:1px solid rgba(52,224,200,.28);border-radius:18px;
        background:linear-gradient(160deg,rgba(52,224,200,.07),transparent);
        padding:18px;margin-bottom:14px;
      }
      .kcrm-head h4 { font-family:var(--disp,system-ui);font-size:22px;margin:0 0 4px }
      .kcrm-head p { color:#8A9A93;font-size:13px;margin:0 }
      .kcrm-actions { display:flex;gap:8px;flex-wrap:wrap;margin-top:14px }
      .kcrm-btn {
        border:1px solid var(--line,#22403A);background:none;color:var(--paper,#ECEFE9);
        border-radius:99px;padding:9px 15px;font-size:13px;cursor:pointer;transition:.18s;
      }
      .kcrm-btn:hover { border-color:var(--core,#34E0C8);color:var(--core,#34E0C8) }
      .kcrm-btn.warn:hover { border-color:#E8735B;color:#E8735B }

      .kcrm-kpis { display:grid;grid-template-columns:repeat(2,1fr);gap:9px;margin-bottom:16px }
      .kcrm-kpi {
        border:1px solid var(--line,#22403A);border-radius:13px;
        background:rgba(4,10,9,.34);padding:13px;
      }
      .kcrm-kpi b { display:block;font-family:var(--disp,system-ui);font-size:19px;color:var(--core,#34E0C8);line-height:1.1 }
      .kcrm-kpi b small { font-size:12px;color:#8A9A93;font-weight:400 }
      .kcrm-kpi span { display:block;color:#8A9A93;font-size:11px;margin-top:5px }

      .kcrm-section { margin-bottom:20px }
      .kcrm-section h5 {
        font-family:var(--mono,monospace);font-size:11px;letter-spacing:.12em;
        text-transform:uppercase;color:#8A9A93;margin:0 0 10px;
      }
      .kcrm-photos { display:grid;grid-template-columns:1fr 1fr;gap:10px }
      .kcrm-photo { width:100%;aspect-ratio:3/4;object-fit:cover;border-radius:12px;border:1px solid var(--line,#22403A);display:block }
      .kcrm-photo-label { text-align:center;font-size:11px;color:#8A9A93;margin-top:5px }

      .kcrm-entry {
        border:1px solid var(--line,#22403A);border-radius:12px;
        background:rgba(255,255,255,.02);padding:11px 13px;margin-bottom:7px;font-size:13.5px;
      }
      .kcrm-entry b { color:var(--paper,#ECEFE9) }
      .kcrm-entry span { color:#8A9A93;display:block;margin-top:2px;font-size:12.5px }
      .kcrm-note-del { float:right;background:none;border:none;color:#5E6E68;font-size:16px;cursor:pointer;padding:0 3px }
      .kcrm-note-del:hover { color:#E8735B }

      .kcrm-alert {
        border:1px dashed rgba(232,115,91,.5);border-radius:12px;
        padding:11px 14px;color:#E8735B;font-size:13px;margin-bottom:14px;
      }
      .kcrm-empty { color:#5E6E68;font-size:13px;padding:8px 2px }
      @media(max-width:560px){ .kcrm-kpis{grid-template-columns:1fr 1fr} }
    `;
    document.head.appendChild(st);
  }

  /* ─── INJECTION ────────────────────────────────────────────── */
  function injectCard() {
    if (qs('[data-goto="modKpsulCRM"]')) return;
    const grid = qs(".member-tiles");
    if (!grid) return;
    const card = document.createElement("div");
    card.className = "mtile admin-zone";
    card.dataset.goto = "modKpsulCRM";
    card.setAttribute("role","button");
    card.setAttribute("tabindex","0");
    card.style.marginTop = "0";
    card.innerHTML = `<div class="tag">Coach</div><h4>Mes clients</h4><p>Fiches, courbes, photos, notes privées.</p><span class="mtile-go">Ouvrir →</span>`;
    grid.appendChild(card);
  }

  function injectModule() {
    if ($("modKpsulCRM")) return;
    const anchor = qs(".module-panel");
    if (!anchor) return;
    anchor.insertAdjacentHTML("beforebegin", `
      <div class="module-panel" id="modKpsulCRM">
        <div class="tool-panel">
          <h3>👥 Mes clients</h3>
          <div id="kcrmListView">
            <input class="kcrm-search" id="kcrmSearch" placeholder="Rechercher un client…" autocomplete="off">
            <div id="kcrmList"><div class="kcrm-empty">Chargement…</div></div>
          </div>
          <div id="kcrmDetailView" style="display:none"></div>
        </div>
      </div>`);

    $("kcrmSearch")?.addEventListener("input", renderClientList);
  }

  /* ─── LISTE CLIENTS ────────────────────────────────────────── */
  async function loadClients() {
    const client = sb(); if (!client) return;
    const { data: sess } = await client.auth.getSession();
    const uid = sess?.session?.user?.id; if (!uid) return;

    const { data: me } = await client.from("profiles").select("role").eq("id", uid).single();
    isCoach = ["coach","admin"].includes(me?.role);
    if (!isCoach) return;

    const { data, error } = await client.from("profiles")
      .select("id, full_name, email, role, forum_member, created_at")
      .order("created_at", { ascending: false });
    if (error) { console.warn("kcrm", error.message); return; }
    clients = (data || []).filter(p => p.role === "client");
    renderClientList();
  }

  function renderClientList() {
    const box = $("kcrmList"); if (!box) return;
    const q = ($("kcrmSearch")?.value || "").trim().toLowerCase();
    const rows = clients.filter(c =>
      !q || (c.full_name || "").toLowerCase().includes(q) || (c.email || "").toLowerCase().includes(q));

    if (!rows.length) {
      box.innerHTML = `<div class="kcrm-empty">${clients.length ? "Aucun client ne correspond." : "Aucun client inscrit pour l'instant. Dès qu'un client crée son compte, il apparaît ici."}</div>`;
      return;
    }
    box.innerHTML = rows.map(c => `
      <button class="kcrm-client" data-kcrm-id="${safe(c.id)}" type="button">
        <div>
          <b>${safe(c.full_name || "Sans prénom")}</b>
          <span>${safe(c.email || "")} · inscrit ${fmtShort(c.created_at)}</span>
        </div>
        <span class="kcrm-tag ${c.forum_member ? "on" : ""}">${c.forum_member ? "Forum ✓" : "Forum —"}</span>
      </button>`).join("");

    qsa("[data-kcrm-id]", box).forEach(btn =>
      btn.addEventListener("click", () => openClient(btn.dataset.kcrmId)));
  }

  /* ─── FICHE CLIENT ─────────────────────────────────────────── */
  async function openClient(uid) {
    const client = sb(); if (!client) return;
    selected = clients.find(c => c.id === uid);
    if (!selected) return;

    // Synchroniser la sélection legacy (messagerie, forum, etc.)
    try { if (typeof window.selectClient === "function") window.selectClient(uid); } catch(e){}

    $("kcrmListView").style.display = "none";
    const view = $("kcrmDetailView");
    view.style.display = "";
    view.innerHTML = `<div class="kcrm-empty">Chargement de la fiche…</div>`;

    const since30 = new Date(Date.now() - 30*86400000).toISOString().slice(0,10);
    const [mRes, wRes, nRes, hRes, noteRes, msgRes] = await Promise.all([
      client.from("body_measurements").select("*").eq("user_id", uid).order("log_date"),
      client.from("workout_exercise_logs").select("log_date,exercise_name,load_kg,sets,reps").eq("user_id", uid).gte("log_date", since30).order("log_date",{ascending:false}),
      client.from("nutrition_logs").select("log_date,calories,protein_g,meal_name").eq("user_id", uid).gte("log_date", since30).order("log_date",{ascending:false}),
      client.from("habit_logs").select("log_date,sleep_hours,energy_level").eq("user_id", uid).order("log_date",{ascending:false}).limit(7),
      client.from("coach_notes").select("*").eq("user_id", uid).order("created_at",{ascending:false}).limit(10),
      client.from("messages").select("created_at,sender").eq("user_id", uid).order("created_at",{ascending:false}).limit(1),
    ]);

    const measures = mRes.data || [];
    const workouts = wRes.data || [];
    const meals    = nRes.data || [];
    const habits   = hRes.data || [];
    const notes    = noteRes.data || [];
    const lastMsg  = (msgRes.data || [])[0];

    // KPIs
    const weights = measures.filter(m => m.weight_kg);
    const lastW = weights[weights.length-1];
    const firstW = weights[0];
    const deltaW = (lastW && firstW && lastW !== firstW) ? round1(lastW.weight_kg - firstW.weight_kg) : null;
    const nbSeances = [...new Set(workouts.map(w => w.log_date))].length;
    const lastActivity = [
      workouts[0]?.log_date, meals[0]?.log_date, habits[0]?.log_date,
      measures[measures.length-1]?.log_date
    ].filter(Boolean).sort().pop();
    const inactiveDays = lastActivity ? daysAgo(lastActivity) : null;

    // Photos avant/après
    const photos = measures.filter(m => m.photo_path);
    let photosHtml = "";
    if (photos.length >= 1) {
      const first = photos[0], last = photos[photos.length-1];
      const urls = await Promise.all([signedUrl(first.photo_path), photos.length>1 ? signedUrl(last.photo_path) : null]);
      if (urls[0]) {
        photosHtml = `
          <div class="kcrm-section">
            <h5>📸 Photos de progression</h5>
            <div class="kcrm-photos">
              <div><img class="kcrm-photo" src="${urls[0]}" alt="Photo"><div class="kcrm-photo-label">${fmtShort(first.log_date)}</div></div>
              ${urls[1] ? `<div><img class="kcrm-photo" src="${urls[1]}" alt="Photo"><div class="kcrm-photo-label">${fmtShort(last.log_date)}</div></div>` : ""}
            </div>
          </div>`;
      }
    }

    // Courbe poids sparkline
    const sparkline = weights.length >= 2 ? renderSparkline(weights.map(w => ({label:w.log_date, y:Number(w.weight_kg)}))) : "";

    const view2 = $("kcrmDetailView");
    view2.innerHTML = `
      <button class="kcrm-btn" id="kcrmBack" type="button" style="margin-bottom:14px">← Tous les clients</button>

      <div class="kcrm-head">
        <h4>${safe(selected.full_name || "Sans prénom")}</h4>
        <p>${safe(selected.email || "")} · inscrit le ${fmtDate(selected.created_at)}</p>
        <div class="kcrm-actions">
          <button class="kcrm-btn" id="kcrmMsg" type="button">💬 Messagerie</button>
          <button class="kcrm-btn" id="kcrmForum" type="button">${selected.forum_member ? "Retirer du forum" : "Inviter au forum"}</button>
        </div>
      </div>

      ${inactiveDays !== null && inactiveDays > 7 ? `
        <div class="kcrm-alert">⚠️ Aucune activité depuis ${inactiveDays} jours — un petit message de relance ?</div>` : ""}

      <div class="kcrm-kpis">
        <div class="kcrm-kpi">
          <b>${lastW ? round1(lastW.weight_kg) + " kg" : "—"}
            ${deltaW !== null ? `<small>(${deltaW >= 0 ? "+" : ""}${deltaW})</small>` : ""}</b>
          <span>Poids actuel</span>
        </div>
        <div class="kcrm-kpi"><b>${nbSeances}</b><span>Séances (30j)</span></div>
        <div class="kcrm-kpi"><b>${meals.length}</b><span>Repas loggés (30j)</span></div>
        <div class="kcrm-kpi"><b>${lastActivity ? fmtShort(lastActivity) : "—"}</b><span>Dernière activité</span></div>
      </div>

      ${sparkline ? `<div class="kcrm-section"><h5>⚖️ Évolution du poids</h5>${sparkline}</div>` : ""}

      ${photosHtml}

      <div class="kcrm-section">
        <h5>🔒 Notes privées (invisibles pour le client)</h5>
        <textarea id="kcrmNoteInput" placeholder="Blessure au genou, préfère s'entraîner le matin, objectif mariage en juin…"></textarea>
        <button class="btn btn-primary" id="kcrmNoteSave" type="button" style="margin-top:8px;width:100%">Enregistrer la note</button>
        <div style="margin-top:12px" id="kcrmNotesList">
          ${notes.length ? notes.map(n => `
            <div class="kcrm-entry">
              <button class="kcrm-note-del" data-note-del="${n.id}" type="button">×</button>
              <b>${fmtShort(n.created_at)}</b>
              <span>${safe(n.note)}</span>
            </div>`).join("") : `<div class="kcrm-empty">Aucune note pour l'instant.</div>`}
        </div>
      </div>

      <div class="kcrm-section">
        <h5>💪 Dernières séances</h5>
        ${workouts.length ? workouts.slice(0,5).map(w => `
          <div class="kcrm-entry"><b>${safe(w.exercise_name)}</b>
          <span>${fmtShort(w.log_date)} · ${w.sets||0}×${w.reps||0} ${w.load_kg ? "· "+w.load_kg+" kg" : ""}</span></div>`).join("")
          : `<div class="kcrm-empty">Aucune séance sur 30 jours.</div>`}
      </div>

      <div class="kcrm-section">
        <h5>🍽 Derniers repas</h5>
        ${meals.length ? meals.slice(0,5).map(m => `
          <div class="kcrm-entry"><b>${safe(m.meal_name || "Repas")}</b>
          <span>${fmtShort(m.log_date)} ${m.calories ? "· "+round1(m.calories)+" kcal" : ""} ${m.protein_g ? "· "+round1(m.protein_g)+"g prot" : ""}</span></div>`).join("")
          : `<div class="kcrm-empty">Aucun repas loggé sur 30 jours.</div>`}
      </div>

      <div class="kcrm-section">
        <h5>😴 Habitudes récentes</h5>
        ${habits.length ? habits.slice(0,4).map(h => `
          <div class="kcrm-entry"><b>${fmtShort(h.log_date)}</b>
          <span>${h.sleep_hours ? "Sommeil "+h.sleep_hours+"h" : ""} ${h.energy_level ? "· "+safe(h.energy_level) : ""}</span></div>`).join("")
          : `<div class="kcrm-empty">Aucune habitude enregistrée.</div>`}
      </div>
    `;

    // Actions
    $("kcrmBack")?.addEventListener("click", () => {
      $("kcrmDetailView").style.display = "none";
      $("kcrmListView").style.display = "";
    });
    $("kcrmMsg")?.addEventListener("click", () => {
      if (window.KpsulRouter) window.KpsulRouter.openModule("modMessages");
    });
    $("kcrmForum")?.addEventListener("click", toggleForum);
    $("kcrmNoteSave")?.addEventListener("click", saveNote);
    qsa("[data-note-del]").forEach(b => b.addEventListener("click", async () => {
      if (!confirm("Supprimer cette note ?")) return;
      await sb()?.from("coach_notes").delete().eq("id", b.dataset.noteDel);
      openClient(selected.id);
    }));
  }

  async function toggleForum() {
    const client = sb(); if (!client || !selected) return;
    const newVal = !selected.forum_member;
    const { error } = await client.from("profiles")
      .update({ forum_member: newVal }).eq("id", selected.id);
    if (!error) {
      selected.forum_member = newVal;
      const idx = clients.findIndex(c => c.id === selected.id);
      if (idx >= 0) clients[idx].forum_member = newVal;
      openClient(selected.id);
    }
  }

  async function saveNote() {
    const client = sb(); if (!client || !selected) return;
    const input = $("kcrmNoteInput");
    const note = input?.value.trim(); if (!note) return;
    const btn = $("kcrmNoteSave"); if (btn) btn.disabled = true;
    const { error } = await client.from("coach_notes").insert({ user_id: selected.id, note });
    if (btn) btn.disabled = false;
    if (!error) { input.value = ""; openClient(selected.id); }
  }

  async function signedUrl(path) {
    try {
      const { data } = await sb().storage.from("progress-photos").createSignedUrl(path, 3600);
      return data?.signedUrl || null;
    } catch(e){ return null; }
  }

  /* ─── SPARKLINE POIDS ──────────────────────────────────────── */
  function renderSparkline(data) {
    const W = 320, H = 90, pad = 14;
    const vals = data.map(d => d.y);
    const min = Math.min(...vals), max = Math.max(...vals);
    const range = max - min || 1;
    const pts = data.map((d, i) => ({
      x: pad + (i / (data.length - 1)) * (W - pad*2),
      y: pad + (H - pad*2) - ((d.y - min) / range) * (H - pad*2),
    }));
    const line = pts.map(p => `${p.x},${p.y}`).join(" ");
    const delta = round1(vals[vals.length-1] - vals[0]);
    return `
      <div style="border:1px solid var(--line,#22403A);border-radius:13px;background:rgba(4,10,9,.32);padding:10px">
        <div style="display:flex;justify-content:space-between;font-size:12px;color:#8A9A93;padding:0 4px 6px">
          <span>${round1(vals[0])} kg → <b style="color:var(--core,#34E0C8)">${round1(vals[vals.length-1])} kg</b></span>
          <span style="color:${delta >= 0 ? "#34E0C8" : "#E8735B"}">${delta >= 0 ? "+" : ""}${delta} kg</span>
        </div>
        <svg viewBox="0 0 ${W} ${H}" style="width:100%;display:block" aria-hidden="true">
          <polyline points="${line}" fill="none" stroke="#34E0C8" stroke-width="2.5"
            stroke-linecap="round" stroke-linejoin="round"/>
          ${pts.map((p,i) => i === pts.length-1
            ? `<circle cx="${p.x}" cy="${p.y}" r="4" fill="#34E0C8"/>` : "").join("")}
        </svg>
      </div>`;
  }

  /* ─── INIT ─────────────────────────────────────────────────── */
  function init() {
    injectStyle();
    injectCard();
    injectModule();
  }

  new MutationObserver(() => {
    if (document.body.classList.contains("authed")) init();
  }).observe(document.body, { attributeFilter: ["class"] });

  document.addEventListener("click", e => {
    const tile = e.target.closest("[data-goto]");
    if (tile?.dataset.goto === "modKpsulCRM") {
      setTimeout(() => { init(); loadClients(); }, 180);
    }
  });

  if (document.body.classList.contains("authed")) init();
})();
