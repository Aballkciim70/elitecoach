/* ============================================================
   KPSUL COACH CRM V1 — PHASE 3
   Tableau de bord coach avec priorité Vert / Orange / Rouge.
   Nécessite window.sb et la migration SQL fournie.
   ============================================================ */
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const sb = () => window.sb || null;
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (s) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[s]));
  const daysBack = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0,10);
  const avg = (arr) => arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0;
  const clamp = (v,min=0,max=100) => Math.max(min, Math.min(max, Number(v)||0));

  let userId = null;
  let role = null;
  let clientsCache = [];
  let activeClientId = null;

  function injectStyles() {
    if ($("kpsulCrmStyles")) return;
    const style = document.createElement("style");
    style.id = "kpsulCrmStyles";
    style.textContent = `
      .kc-wrap{display:grid;grid-template-columns:340px 1fr;gap:14px}
      .kc-side,.kc-main{border:1px solid var(--line,#22403A);border-radius:18px;
        background:rgba(255,255,255,.025);padding:14px;min-width:0}
      .kc-head{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:12px}
      .kc-head h3{margin:0;font-size:clamp(24px,4vw,36px)}
      .kc-search{width:100%;box-sizing:border-box;border:1px solid var(--line,#22403A);
        border-radius:12px;padding:11px 12px;background:rgba(3,10,8,.42);color:#fff;margin-bottom:10px}
      .kc-filters{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:10px}
      .kc-client-list{display:grid;gap:8px;max-height:72vh;overflow:auto}
      .kc-client{border:1px solid var(--line,#22403A);border-radius:14px;padding:11px;
        background:rgba(3,10,8,.32);cursor:pointer}
      .kc-client:hover,.kc-client.active{border-color:rgba(52,224,200,.55)}
      .kc-client-top{display:flex;justify-content:space-between;gap:10px;align-items:center}
      .kc-client-name{font-weight:800}
      .kc-light{width:11px;height:11px;border-radius:50%;display:inline-block;box-shadow:0 0 12px currentColor}
      .kc-green{color:#62d8a3;background:#62d8a3}.kc-orange{color:#E9C46A;background:#E9C46A}.kc-red{color:#E8735B;background:#E8735B}
      .kc-meta{font-size:11px;color:var(--muted,#8A9A93);margin-top:5px}
      .kc-score{font:700 11px monospace;color:var(--core,#34E0C8)}
      .kc-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
      .kc-stat{border:1px solid var(--line,#22403A);border-radius:14px;padding:13px;background:rgba(3,10,8,.32)}
      .kc-stat b{display:block;font-size:24px;margin-top:3px}.kc-stat span{font-size:11px;color:var(--muted,#8A9A93)}
      .kc-section{margin-top:14px;border:1px solid var(--line,#22403A);border-radius:16px;padding:14px}
      .kc-section h4{margin:0 0 10px}
      .kc-row{display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid rgba(34,64,58,.65)}
      .kc-row:last-child{border-bottom:0}.kc-row span{color:var(--muted,#8A9A93);font-size:12px}.kc-row b{text-align:right;font-size:13px}
      .kc-alert{border-left:3px solid #E9C46A;padding:10px 12px;background:rgba(233,196,106,.06);
        border-radius:0 12px 12px 0;margin-bottom:8px}
      .kc-alert.red{border-left-color:#E8735B;background:rgba(232,115,91,.06)}
      .kc-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
      .kc-empty{padding:30px;text-align:center;color:var(--muted,#8A9A93)}
      .kc-status{min-height:18px;font-size:12px;color:var(--core,#34E0C8);margin:7px 0}
      .kc-status.err{color:#E8735B}
      @media(max-width:900px){.kc-wrap{grid-template-columns:1fr}.kc-client-list{max-height:340px}}
      @media(max-width:600px){.kc-grid{grid-template-columns:1fr 1fr}.kc-stat:first-child{grid-column:1/-1}}
    `;
    document.head.appendChild(style);
  }

  function ensureUI() {
    injectStyles();

    let panel = $("modCoachCrm");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "modCoachCrm";
      panel.className = "module-panel";
      $("memberTools")?.appendChild(panel);
    }

    if (panel && panel.dataset.ready !== "1") {
      panel.dataset.ready = "1";
      panel.innerHTML = `
        <div class="tool-panel">
          <div class="kc-head">
            <div>
              <div style="font:10px monospace;letter-spacing:.16em;text-transform:uppercase;color:var(--core,#34E0C8)">— Phase 3</div>
              <h3>Coach CRM</h3>
            </div>
            <button class="btn btn-primary" id="kcRefresh" type="button">Actualiser</button>
          </div>

          <div class="kc-status" id="kcStatus"></div>

          <div class="kc-wrap">
            <aside class="kc-side">
              <input class="kc-search" id="kcSearch" placeholder="Rechercher un client…" />
              <div class="kc-filters">
                <button class="btn btn-ghost" data-kc-filter="all" type="button">Tous</button>
                <button class="btn btn-ghost" data-kc-filter="red" type="button">🔴 Rouge</button>
                <button class="btn btn-ghost" data-kc-filter="orange" type="button">🟠 Orange</button>
                <button class="btn btn-ghost" data-kc-filter="green" type="button">🟢 Vert</button>
              </div>
              <div class="kc-client-list" id="kcClientList"></div>
            </aside>

            <main class="kc-main" id="kcMain">
              <div class="kc-empty">Sélectionne un client pour ouvrir sa fiche complète.</div>
            </main>
          </div>
        </div>
      `;

      $("kcRefresh")?.addEventListener("click", loadDashboard);
      $("kcSearch")?.addEventListener("input", renderClientList);
      panel.querySelectorAll("[data-kc-filter]").forEach(btn => {
        btn.addEventListener("click", () => {
          panel.dataset.filter = btn.dataset.kcFilter;
          renderClientList();
        });
      });
    }

    ensureTile();
  }

  function ensureTile() {
    const tiles = document.querySelector("#member .member-tiles");
    if (!tiles || tiles.querySelector('[data-goto="modCoachCrm"]')) return;

    const tile = document.createElement("div");
    tile.className = "mtile";
    tile.tabIndex = 0;
    tile.dataset.goto = "modCoachCrm";
    tile.innerHTML = `
      <div class="mtile-icon">🧭</div>
      <h3>Coach CRM</h3>
      <p>Classe les clients par priorité et ouvre leur fiche complète.</p>
      <span class="mtile-go">Piloter les clients →</span>
    `;
    tiles.appendChild(tile);

    const open = () => {
      openModule("modCoachCrm");
      loadDashboard();
    };
    tile.addEventListener("click", open);
    tile.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
    });
  }

  function openModule(id) {
    document.querySelectorAll("#member .module-panel").forEach(p => p.classList.remove("active"));
    const target = $(id);
    if (!target) return;
    target.classList.add("active");
    document.body.classList.add("kpsul-panel-open");
    setTimeout(() => $("member")?.scrollIntoView({behavior:"smooth",block:"start"}), 40);
  }

  function setStatus(text,error=false) {
    const el = $("kcStatus");
    if (!el) return;
    el.textContent = text || "";
    el.classList.toggle("err", !!error);
  }

  async function initAuth() {
    const client = sb();
    if (!client) throw new Error("Supabase indisponible.");

    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    userId = data?.session?.user?.id;
    if (!userId) throw new Error("Utilisateur non connecté.");

    const { data: rows, error: pErr } = await client.from("profiles")
      .select("id,role,full_name").eq("id",userId).limit(1);
    if (pErr) throw pErr;
    role = rows?.[0]?.role || "client";

    if (!["coach","admin"].includes(role)) {
      throw new Error("Ce module est réservé au coach et à l'administrateur.");
    }
  }

  async function safe(name, fn) {
    try {
      const r = await fn();
      if (r?.error) {
        console.warn("Coach CRM", name, r.error.message);
        return [];
      }
      return r?.data || [];
    } catch (e) {
      console.warn("Coach CRM", name, e);
      return [];
    }
  }

  async function buildClientSummary(clientProfile) {
    const c = sb();
    const d30 = daysBack(30);
    const d14 = daysBack(14);
    const d7 = daysBack(7);

    const [workouts, meals, habits, measures, scores, alerts, messages, goals] = await Promise.all([
      safe("workouts", () => c.from("workout_exercise_logs").select("*").eq("user_id",clientProfile.id).gte("log_date",d30)),
      safe("meals", () => c.from("nutrition_logs").select("*").eq("user_id",clientProfile.id).gte("log_date",d14)),
      safe("habits", () => c.from("habit_logs").select("*").eq("user_id",clientProfile.id).gte("log_date",d14)),
      safe("measures", () => c.from("body_measurements").select("*").eq("user_id",clientProfile.id).order("log_date",{ascending:false}).limit(8)),
      safe("scores", () => c.from("kpsul_score_daily").select("*").eq("user_id",clientProfile.id).order("score_date",{ascending:false}).limit(14)),
      safe("alerts", () => c.from("kpsul_alerts").select("*").eq("client_id",clientProfile.id).eq("is_resolved",false).order("severity_score",{ascending:false})),
      safe("messages", () => c.from("messages").select("*").eq("client_id",clientProfile.id).order("created_at",{ascending:false}).limit(20)),
      safe("goals", () => c.from("client_goals_v4").select("*").eq("user_id",clientProfile.id).eq("status","active").limit(1))
    ]);

    const workoutDays7 = new Set(workouts.filter(x=>x.log_date>=d7).map(x=>x.log_date)).size;
    const mealDays = new Set(meals.map(x=>x.log_date)).size;
    const sleep = habits.map(x=>Number(x.sleep_hours)).filter(v=>v>0);
    const water = habits.map(x=>Number(x.water_liters)).filter(v=>v>0);
    const score = Number(scores[0]?.global_score);
    const confidence = Number(scores[0]?.confidence_score);
    const critical = alerts.filter(a=>a.level==="critical").length;
    const warning = alerts.filter(a=>a.level==="warning").length;

    const clientMessages = messages.filter(m=>m.sender_role==="client" || m.sender==="client");
    const coachMessages = messages.filter(m=>m.sender_role==="coach" || m.sender_role==="admin" || m.sender==="coach");
    const latestClient = clientMessages[0]?.created_at ? new Date(clientMessages[0].created_at) : null;
    const latestCoach = coachMessages[0]?.created_at ? new Date(coachMessages[0].created_at) : null;
    const waitingReply = latestClient && (!latestCoach || latestClient > latestCoach);

    let risk = 0;
    risk += critical * 35;
    risk += warning * 15;
    if (workoutDays7 === 0) risk += 35;
    else if (workoutDays7 < 2) risk += 18;
    if (sleep.length && avg(sleep) < 6) risk += 25;
    else if (!sleep.length) risk += 10;
    if (mealDays < 3) risk += 15;
    if (waitingReply) risk += 18;
    if (Number.isFinite(score) && score < 50) risk += 25;
    else if (Number.isFinite(score) && score < 65) risk += 12;
    risk = clamp(risk);

    const status = risk >= 60 ? "red" : risk >= 28 ? "orange" : "green";

    return {
      profile: clientProfile,
      workouts, meals, habits, measures, scores, alerts, messages, goals,
      workoutDays7, mealDays,
      sleepAvg: sleep.length ? avg(sleep) : null,
      waterAvg: water.length ? avg(water) : null,
      score: Number.isFinite(score) ? Math.round(score) : null,
      confidence: Number.isFinite(confidence) ? Math.round(confidence) : null,
      waitingReply, risk, status
    };
  }

  async function loadDashboard() {
    ensureUI();
    try {
      setStatus("Chargement du tableau de bord coach…");
      await initAuth();

      const profiles = await safe("clients", () =>
        sb().from("profiles").select("id,full_name,role,created_at").eq("role","client").order("full_name")
      );

      const summaries = [];
      for (const p of profiles) summaries.push(await buildClientSummary(p));

      clientsCache = summaries.sort((a,b)=>b.risk-a.risk);
      setStatus(`✔ ${clientsCache.length} client(s) analysé(s).`);
      renderClientList();

      if (activeClientId) {
        const current = clientsCache.find(c=>c.profile.id===activeClientId);
        if (current) renderClient(current);
      }
    } catch (e) {
      console.error(e);
      setStatus(e.message || String(e), true);
      $("kcMain").innerHTML = `<div class="kc-empty">${esc(e.message || e)}</div>`;
    }
  }

  function renderClientList() {
    const box = $("kcClientList");
    if (!box) return;

    const q = ($("kcSearch")?.value || "").trim().toLowerCase();
    const filter = $("modCoachCrm")?.dataset.filter || "all";
    const rows = clientsCache.filter(c => {
      const name = (c.profile.full_name || "").toLowerCase();
      return (!q || name.includes(q)) && (filter==="all" || c.status===filter);
    });

    if (!rows.length) {
      box.innerHTML = `<div class="kc-empty">Aucun client dans ce filtre.</div>`;
      return;
    }

    box.innerHTML = rows.map(c => `
      <article class="kc-client ${activeClientId===c.profile.id ? "active":""}" data-client="${esc(c.profile.id)}">
        <div class="kc-client-top">
          <div class="kc-client-name"><span class="kc-light kc-${c.status}"></span> ${esc(c.profile.full_name || "Client")}</div>
          <div class="kc-score">${c.score == null ? "—" : c.score+"%"}</div>
        </div>
        <div class="kc-meta">${c.workoutDays7} j séance · ${c.alerts.length} alerte(s) · risque ${Math.round(c.risk)}%</div>
      </article>
    `).join("");

    box.querySelectorAll("[data-client]").forEach(el => {
      el.addEventListener("click", () => {
        activeClientId = el.dataset.client;
        renderClientList();
        const client = clientsCache.find(c=>c.profile.id===activeClientId);
        if (client) renderClient(client);
      });
    });
  }

  function renderClient(c) {
    const main = $("kcMain");
    const latestWeight = c.measures[0];
    const previousWeight = c.measures[1];
    const weightDelta = latestWeight && previousWeight
      ? Number(latestWeight.weight_kg) - Number(previousWeight.weight_kg)
      : null;
    const goal = c.goals[0];

    main.innerHTML = `
      <div class="kc-head">
        <div>
          <div class="kc-meta">Fiche client</div>
          <h3 style="font-size:28px">${esc(c.profile.full_name || "Client")}</h3>
        </div>
        <div><span class="kc-light kc-${c.status}"></span> <b>${c.status.toUpperCase()}</b></div>
      </div>

      <div class="kc-grid">
        <div class="kc-stat"><span>Kpsul Score</span><b>${c.score == null ? "—" : c.score+"%"}</b></div>
        <div class="kc-stat"><span>Fiabilité</span><b>${c.confidence == null ? "—" : c.confidence+"%"}</b></div>
        <div class="kc-stat"><span>Risque coach</span><b>${Math.round(c.risk)}%</b></div>
      </div>

      <section class="kc-section">
        <h4>Résumé opérationnel</h4>
        <div class="kc-row"><span>Séances sur 7 jours</span><b>${c.workoutDays7}</b></div>
        <div class="kc-row"><span>Nutrition renseignée</span><b>${c.mealDays}/14 jours</b></div>
        <div class="kc-row"><span>Sommeil moyen</span><b>${c.sleepAvg == null ? "Non mesuré" : c.sleepAvg.toFixed(1)+" h"}</b></div>
        <div class="kc-row"><span>Hydratation moyenne</span><b>${c.waterAvg == null ? "Non mesurée" : c.waterAvg.toFixed(1)+" L"}</b></div>
        <div class="kc-row"><span>Poids actuel</span><b>${latestWeight?.weight_kg ? latestWeight.weight_kg+" kg" : "Non mesuré"}${weightDelta==null ? "" : ` (${weightDelta>=0?"+":""}${weightDelta.toFixed(1)} kg)`}</b></div>
        <div class="kc-row"><span>Objectif actif</span><b>${esc(goal?.title || goal?.goal_name || "Non défini")}</b></div>
      </section>

      <section class="kc-section">
        <h4>Alertes actives</h4>
        ${c.alerts.length ? c.alerts.slice(0,6).map(a => `
          <div class="kc-alert ${a.level==="critical" ? "red":""}">
            <b>${esc(a.title)}</b>
            <div class="kc-meta">${esc(a.body)}</div>
          </div>
        `).join("") : `<div class="kc-empty">Aucune alerte active.</div>`}
      </section>

      <section class="kc-section">
        <h4>Actions coach</h4>
        <div class="kc-actions">
          <button class="btn btn-primary" type="button" data-kc-open="modMessages">Écrire au client</button>
          <button class="btn btn-ghost" type="button" data-kc-open="modProgram">Voir le programme</button>
          <button class="btn btn-ghost" type="button" data-kc-open="modNutrition">Voir la nutrition</button>
          <button class="btn btn-ghost" type="button" data-kc-open="modProgress">Voir la progression</button>
          <button class="btn btn-ghost" type="button" id="kcSaveSnapshot">Enregistrer l'état</button>
        </div>
      </section>
    `;

    main.querySelectorAll("[data-kc-open]").forEach(btn => {
      btn.addEventListener("click", () => openModule(btn.dataset.kcOpen));
    });
    $("kcSaveSnapshot")?.addEventListener("click", () => saveSnapshot(c));
  }

  async function saveSnapshot(c) {
    try {
      const payload = {
        client_id: c.profile.id,
        coach_id: userId,
        status: c.status,
        risk_score: Math.round(c.risk),
        kpsul_score: c.score,
        confidence_score: c.confidence,
        active_alerts: c.alerts.length,
        workout_days_7: c.workoutDays7,
        nutrition_days_14: c.mealDays,
        sleep_average: c.sleepAvg,
        water_average: c.waterAvg,
        snapshot_date: new Date().toISOString().slice(0,10)
      };

      const { error } = await sb().from("coach_client_snapshots")
        .upsert(payload,{onConflict:"client_id,snapshot_date"});
      if (error) throw error;
      setStatus("✔ État du client enregistré.");
    } catch (e) {
      setStatus("Impossible d'enregistrer : " + (e.message || e), true);
    }
  }

  function start() {
    ensureUI();
    window.KpsulCoachCrm = {
      open: () => { openModule("modCoachCrm"); loadDashboard(); },
      refresh: loadDashboard
    };
  }

  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", start)
    : start();
})();
