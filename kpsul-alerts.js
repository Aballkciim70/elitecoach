/* ============================================================
   KPSUL ALERTS V1 — PHASE 2
   Alertes automatiques client / coach basées sur les vraies données.
   Nécessite window.sb et la migration SQL fournie.
   ============================================================ */
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const sb = () => window.sb || null;
  const today = () => new Date().toISOString().slice(0, 10);
  const daysBack = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (s) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[s]));
  const avg = (arr) => arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0;

  let sessionUser = null;
  let profile = null;
  let realtimeChannel = null;

  function injectStyles() {
    if ($("kpsulAlertsStyles")) return;
    const style = document.createElement("style");
    style.id = "kpsulAlertsStyles";
    style.textContent = `
      .ka-tile{border-color:rgba(232,115,91,.45)!important;
        background:linear-gradient(145deg,rgba(232,115,91,.1),rgba(255,255,255,.02))!important}
      .ka-badge{display:inline-flex;align-items:center;justify-content:center;min-width:20px;height:20px;
        padding:0 6px;border-radius:99px;background:#E8735B;color:white;font:700 11px system-ui}
      .ka-head{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:14px}
      .ka-head h3{margin:0;font-size:clamp(24px,4vw,36px)}
      .ka-list{display:grid;gap:10px}
      .ka-card{border:1px solid var(--line,#22403A);border-radius:16px;padding:14px;
        background:rgba(255,255,255,.025)}
      .ka-card[data-level="critical"]{border-color:rgba(232,115,91,.65)}
      .ka-card[data-level="warning"]{border-color:rgba(233,196,106,.55)}
      .ka-card[data-level="info"]{border-color:rgba(52,224,200,.35)}
      .ka-top{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}
      .ka-title{font-weight:800;font-size:15px}
      .ka-level{font:700 10px monospace;letter-spacing:.08em;text-transform:uppercase;
        border-radius:99px;padding:5px 8px;white-space:nowrap}
      .ka-card[data-level="critical"] .ka-level{color:#E8735B;border:1px solid rgba(232,115,91,.45)}
      .ka-card[data-level="warning"] .ka-level{color:#E9C46A;border:1px solid rgba(233,196,106,.4)}
      .ka-card[data-level="info"] .ka-level{color:#34E0C8;border:1px solid rgba(52,224,200,.35)}
      .ka-card p{color:var(--muted,#8A9A93);font-size:13px;line-height:1.5;margin:7px 0 0}
      .ka-meta{font-size:11px;color:var(--muted,#8A9A93);margin-top:9px}
      .ka-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:11px}
      .ka-empty{padding:28px;text-align:center;color:var(--muted,#8A9A93);
        border:1px dashed var(--line,#22403A);border-radius:16px}
      .ka-filter{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
      .ka-status{min-height:18px;font-size:12px;color:var(--core,#34E0C8);margin:6px 0 12px}
      .ka-status.err{color:#E8735B}
      .ka-section-title{margin:20px 0 10px;font-size:18px}
    `;
    document.head.appendChild(style);
  }

  function ensureUI() {
    injectStyles();

    let panel = $("modAlerts");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "modAlerts";
      panel.className = "module-panel";
      $("memberTools")?.prepend(panel);
    }

    if (panel && panel.dataset.ready !== "1") {
      panel.dataset.ready = "1";
      panel.innerHTML = `
        <div class="tool-panel">
          <div class="ka-head">
            <div>
              <div style="font:10px monospace;letter-spacing:.16em;text-transform:uppercase;color:var(--core,#34E0C8)">— Phase 2</div>
              <h3>Alertes intelligentes</h3>
            </div>
            <span class="ka-badge" id="kaCount">0</span>
          </div>

          <div class="ka-filter">
            <button class="btn btn-primary" id="kaRefresh" type="button">Analyser maintenant</button>
            <button class="btn btn-ghost" id="kaAll" type="button">Toutes</button>
            <button class="btn btn-ghost" id="kaUnread" type="button">Non lues</button>
          </div>

          <div class="ka-status" id="kaStatus"></div>
          <div class="ka-list" id="kaList"></div>
        </div>
      `;

      $("kaRefresh")?.addEventListener("click", () => runAnalysis(true));
      $("kaAll")?.addEventListener("click", () => loadAlerts(false));
      $("kaUnread")?.addEventListener("click", () => loadAlerts(true));
    }

    ensureTile();
  }

  function ensureTile() {
    const tiles = document.querySelector("#member .member-tiles");
    if (!tiles || tiles.querySelector('[data-goto="modAlerts"]')) return;

    const tile = document.createElement("div");
    tile.className = "mtile ka-tile";
    tile.tabIndex = 0;
    tile.dataset.goto = "modAlerts";
    tile.innerHTML = `
      <div class="mtile-icon">🚨</div>
      <h3>Alertes</h3>
      <p>Détecte automatiquement les blocages, oublis et situations à surveiller.</p>
      <span class="mtile-go">Voir les alertes →</span>
    `;
    tiles.prepend(tile);

    const open = () => {
      openModule("modAlerts");
      loadAlerts(false);
    };
    tile.addEventListener("click", open);
    tile.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open();
      }
    });
  }

  function openModule(id) {
    document.querySelectorAll("#member .module-panel").forEach((p) => p.classList.remove("active"));
    const target = $(id);
    if (!target) return;
    target.classList.add("active");
    document.body.classList.add("kpsul-panel-open");
    setTimeout(() => $("member")?.scrollIntoView({behavior:"smooth",block:"start"}), 40);
  }

  function setStatus(text, error=false) {
    const el = $("kaStatus");
    if (!el) return;
    el.textContent = text || "";
    el.classList.toggle("err", !!error);
  }

  async function initUser() {
    const client = sb();
    if (!client) throw new Error("Supabase indisponible.");

    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    sessionUser = data?.session?.user?.id || null;
    if (!sessionUser) throw new Error("Utilisateur non connecté.");

    const { data: rows } = await client.from("profiles")
      .select("id,role,full_name")
      .eq("id", sessionUser)
      .limit(1);

    profile = rows?.[0] || { id: sessionUser, role:"client" };
  }

  async function safe(name, fn) {
    try {
      const r = await fn();
      if (r?.error) {
        console.warn("Kpsul Alerts", name, r.error.message);
        return [];
      }
      return r?.data || [];
    } catch (e) {
      console.warn("Kpsul Alerts", name, e);
      return [];
    }
  }

  async function collectClientData(clientId) {
    const client = sb();
    const d30 = daysBack(30);
    const d14 = daysBack(14);
    const d7 = daysBack(7);

    const [workouts, meals, habits, measures, messages, scores] = await Promise.all([
      safe("workouts", () => client.from("workout_exercise_logs")
        .select("*").eq("user_id", clientId).gte("log_date", d30).order("log_date",{ascending:false})),
      safe("meals", () => client.from("nutrition_logs")
        .select("*").eq("user_id", clientId).gte("log_date", d14).order("log_date",{ascending:false})),
      safe("habits", () => client.from("habit_logs")
        .select("*").eq("user_id", clientId).gte("log_date", d14).order("log_date",{ascending:false})),
      safe("measures", () => client.from("body_measurements")
        .select("*").eq("user_id", clientId).order("log_date",{ascending:false}).limit(8)),
      safe("messages", () => client.from("messages")
        .select("*").eq("client_id", clientId).order("created_at",{ascending:false}).limit(20)),
      safe("scores", () => client.from("kpsul_score_daily")
        .select("*").eq("user_id", clientId).order("score_date",{ascending:false}).limit(14))
    ]);

    return { workouts, meals, habits, measures, messages, scores, d30, d14, d7 };
  }

  function makeAlert(type, level, title, body, actionModule, actionLabel, score=0) {
    return { type, level, title, body, action_module:actionModule, action_label:actionLabel, severity_score:score };
  }

  function analyzeClient(D) {
    const alerts = [];
    const workouts7 = D.workouts.filter(x => x.log_date >= D.d7);
    const workouts14 = D.workouts.filter(x => x.log_date >= D.d14);
    const workoutDays7 = new Set(workouts7.map(x => x.log_date)).size;
    const workoutDays14 = new Set(workouts14.map(x => x.log_date)).size;

    if (workoutDays7 === 0) {
      alerts.push(makeAlert(
        "no_workout_7d","critical","Aucune séance depuis 7 jours",
        "Le client n'a enregistré aucune séance durant les 7 derniers jours.",
        "modProgram","Voir le programme",100
      ));
    } else if (workoutDays7 < 2) {
      alerts.push(makeAlert(
        "low_workout_7d","warning","Régularité d'entraînement faible",
        `${workoutDays7} seul jour de séance enregistré sur les 7 derniers jours.`,
        "modProgram","Voir le programme",72
      ));
    }

    const sleep = D.habits.map(x => Number(x.sleep_hours)).filter(v => v > 0);
    const sleepAvg = avg(sleep);
    if (sleep.length >= 3 && sleepAvg < 6) {
      alerts.push(makeAlert(
        "sleep_critical","critical","Sommeil très insuffisant",
        `Moyenne récente : ${sleepAvg.toFixed(1)} h par nuit.`,
        "modHabits","Voir le sommeil",95
      ));
    } else if (sleep.length >= 3 && sleepAvg < 7) {
      alerts.push(makeAlert(
        "sleep_low","warning","Récupération à surveiller",
        `Moyenne récente : ${sleepAvg.toFixed(1)} h de sommeil.`,
        "modHabits","Voir le sommeil",68
      ));
    } else if (!sleep.length) {
      alerts.push(makeAlert(
        "sleep_missing","info","Sommeil non renseigné",
        "Aucune donnée récente ne permet d'évaluer la récupération.",
        "modHabits","Renseigner le sommeil",35
      ));
    }

    const water = D.habits.map(x => Number(x.water_liters)).filter(v => v > 0);
    const waterAvg = avg(water);
    if (water.length >= 3 && waterAvg < 1.5) {
      alerts.push(makeAlert(
        "water_low","warning","Hydratation insuffisante",
        `Moyenne récente : ${waterAvg.toFixed(1)} L par jour.`,
        "modHabits","Voir l'hydratation",60
      ));
    }

    const mealDays = new Set(D.meals.map(x => x.log_date)).size;
    if (mealDays < 3) {
      alerts.push(makeAlert(
        "nutrition_missing","warning","Suivi nutrition incomplet",
        `${mealDays} jour(s) de nutrition renseigné(s) sur les 14 derniers jours.`,
        "modNutrition","Voir la nutrition",58
      ));
    }

    const lastMeasure = D.measures[0];
    if (!lastMeasure) {
      alerts.push(makeAlert(
        "weight_missing","info","Aucune mesure corporelle",
        "Le suivi de progression corporelle ne peut pas être calculé.",
        "modProgress","Ajouter une mesure",38
      ));
    } else {
      const age = Math.floor((Date.now() - new Date(lastMeasure.log_date).getTime()) / 86400000);
      if (age > 14) {
        alerts.push(makeAlert(
          "weight_old","warning","Mesure corporelle trop ancienne",
          `Dernière mesure enregistrée il y a ${age} jours.`,
          "modProgress","Mettre à jour",62
        ));
      }
    }

    if (D.measures.length >= 3) {
      const recent = D.measures.slice(0,3).map(x => Number(x.weight_kg)).filter(Number.isFinite);
      if (recent.length === 3) {
        const diff = recent[0] - recent[2];
        if (Math.abs(diff) < 0.15) {
          alerts.push(makeAlert(
            "weight_plateau","info","Progression du poids stable",
            "Les trois dernières mesures montrent peu de variation. Vérifie si cela correspond à l'objectif.",
            "modProgress","Voir l'évolution",42
          ));
        }
      }
    }

    const lastScore = Number(D.scores[0]?.global_score);
    const oldScore = Number(D.scores[Math.min(6, D.scores.length-1)]?.global_score);
    if (Number.isFinite(lastScore) && Number.isFinite(oldScore) && oldScore - lastScore >= 8) {
      alerts.push(makeAlert(
        "score_drop","critical","Baisse importante du Kpsul Score",
        `Le score a baissé de ${Math.round(oldScore-lastScore)} points récemment.`,
        "modKpsulIndex","Analyser le score",90
      ));
    }

    const coachMessages = D.messages.filter(m =>
      m.sender_role === "coach" || m.sender_role === "admin" || m.sender === "coach"
    );
    const clientMessages = D.messages.filter(m =>
      m.sender_role === "client" || m.sender === "client"
    );
    const latestCoach = coachMessages[0]?.created_at ? new Date(coachMessages[0].created_at) : null;
    const latestClient = clientMessages[0]?.created_at ? new Date(clientMessages[0].created_at) : null;

    if (latestClient && (!latestCoach || latestClient > latestCoach)) {
      const hours = Math.floor((Date.now() - latestClient.getTime()) / 3600000);
      if (hours >= 24) {
        alerts.push(makeAlert(
          "client_waiting_reply","warning","Message client sans réponse",
          `Le dernier message du client attend une réponse depuis environ ${hours} h.`,
          "modMessages","Répondre",75
        ));
      }
    }

    if (workoutDays14 === 0 && mealDays === 0 && D.habits.length === 0) {
      alerts.push(makeAlert(
        "inactive_client","critical","Client inactif",
        "Aucune activité récente détectée dans les principaux modules.",
        "modMessages","Contacter le client",100
      ));
    }

    return alerts.sort((a,b) => b.severity_score - a.severity_score);
  }

  async function saveAlerts(clientId, alerts) {
    const client = sb();
    const date = today();

    for (const alert of alerts) {
      const payload = {
        client_id: clientId,
        alert_key: `${alert.type}:${date}`,
        alert_type: alert.type,
        level: alert.level,
        title: alert.title,
        body: alert.body,
        action_module: alert.action_module,
        action_label: alert.action_label,
        severity_score: alert.severity_score,
        detected_on: date,
        updated_at: new Date().toISOString()
      };

      const { error } = await client.from("kpsul_alerts")
        .upsert(payload, { onConflict:"client_id,alert_key" });

      if (error) console.warn("Sauvegarde alerte", error.message);
    }
  }

  async function runAnalysis(manual=false) {
    ensureUI();
    try {
      await initUser();
      setStatus("Analyse automatique en cours…");

      if (profile.role === "coach" || profile.role === "admin") {
        const clients = await safe("clients", () => sb().from("profiles")
          .select("id,full_name,role").eq("role","client"));

        let total = 0;
        for (const c of clients) {
          const D = await collectClientData(c.id);
          const alerts = analyzeClient(D);
          await saveAlerts(c.id, alerts);
          total += alerts.length;
        }
        setStatus(`✔ ${clients.length} client(s) analysé(s), ${total} alerte(s) détectée(s).`);
      } else {
        const D = await collectClientData(sessionUser);
        const alerts = analyzeClient(D);
        await saveAlerts(sessionUser, alerts);
        setStatus(`✔ Analyse terminée : ${alerts.length} alerte(s) détectée(s).`);
      }

      await loadAlerts(false);
    } catch (e) {
      console.error(e);
      setStatus("Impossible d'analyser : " + (e.message || e), true);
    }
  }

  async function loadAlerts(unreadOnly=false) {
    ensureUI();
    try {
      await initUser();

      let q = sb().from("kpsul_alerts")
        .select("*, profiles!kpsul_alerts_client_id_fkey(full_name)")
        .eq("is_resolved", false)
        .order("severity_score",{ascending:false})
        .order("created_at",{ascending:false})
        .limit(100);

      if (profile.role === "client") q = q.eq("client_id", sessionUser);
      if (unreadOnly) q = q.is("read_at", null);

      const { data, error } = await q;
      if (error) throw error;

      renderAlerts(data || []);
      subscribeRealtime();
    } catch (e) {
      console.error(e);
      setStatus("Impossible de charger les alertes : " + (e.message || e), true);
    }
  }

  function renderAlerts(alerts) {
    $("kaCount").textContent = String(alerts.filter(a => !a.read_at).length);
    const box = $("kaList");

    if (!alerts.length) {
      box.innerHTML = `<div class="ka-empty">✅ Aucune alerte active. Les données disponibles ne montrent pas de problème important.</div>`;
      return;
    }

    const isStaff = profile.role === "coach" || profile.role === "admin";

    box.innerHTML = alerts.map(a => `
      <article class="ka-card" data-level="${esc(a.level)}">
        <div class="ka-top">
          <div>
            <div class="ka-title">${esc(a.title)}</div>
            ${isStaff ? `<div class="ka-meta">Client : ${esc(a.profiles?.full_name || "Client")}</div>` : ""}
          </div>
          <span class="ka-level">${esc(a.level)}</span>
        </div>
        <p>${esc(a.body)}</p>
        <div class="ka-meta">Détectée le ${esc(a.detected_on || String(a.created_at || "").slice(0,10))}</div>
        <div class="ka-actions">
          ${a.action_module ? `<button class="btn btn-ghost" data-open="${esc(a.action_module)}" type="button">${esc(a.action_label || "Ouvrir")}</button>` : ""}
          ${!a.read_at ? `<button class="btn btn-ghost" data-read="${esc(a.id)}" type="button">Marquer comme lue</button>` : ""}
          <button class="btn btn-ghost" data-resolve="${esc(a.id)}" type="button">Résoudre</button>
        </div>
      </article>
    `).join("");

    box.querySelectorAll("[data-open]").forEach(btn => {
      btn.addEventListener("click", () => openModule(btn.dataset.open));
    });
    box.querySelectorAll("[data-read]").forEach(btn => {
      btn.addEventListener("click", () => markRead(btn.dataset.read));
    });
    box.querySelectorAll("[data-resolve]").forEach(btn => {
      btn.addEventListener("click", () => resolveAlert(btn.dataset.resolve));
    });
  }

  async function markRead(id) {
    const { error } = await sb().from("kpsul_alerts")
      .update({read_at:new Date().toISOString()})
      .eq("id",id);
    if (!error) loadAlerts(false);
  }

  async function resolveAlert(id) {
    const { error } = await sb().from("kpsul_alerts")
      .update({is_resolved:true,resolved_at:new Date().toISOString(),resolved_by:sessionUser})
      .eq("id",id);
    if (!error) loadAlerts(false);
  }

  function subscribeRealtime() {
    if (realtimeChannel || !sessionUser) return;
    realtimeChannel = sb().channel(`kpsul-alerts-${sessionUser}`)
      .on("postgres_changes", {
        event:"*", schema:"public", table:"kpsul_alerts"
      }, () => loadAlerts(false))
      .subscribe();
  }

  function start() {
    ensureUI();
    window.KpsulAlerts = {
      open: () => { openModule("modAlerts"); loadAlerts(false); },
      analyze: () => runAnalysis(true),
      refresh: () => loadAlerts(false)
    };

    document.addEventListener("click", (e) => {
      const trigger = e.target.closest?.('[data-goto="modAlerts"],[data-module="modAlerts"]');
      if (trigger) setTimeout(() => loadAlerts(false), 50);
    }, true);
  }

  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", start)
    : start();
})();
