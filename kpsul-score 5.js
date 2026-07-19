/* ============================================================
   KPSUL SCORE V3 — 100 % calculé depuis les vraies données.
   Aucun curseur : chaque métrique est mesurée ou marquée
   « non mesurée » et sortie du calcul. La fiabilité = part du
   score couverte par de vraies mesures.
   Nécessite window.sb. Panneau : #modKpsulIndex.
   ============================================================ */
(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const sb = () => window.sb || null;
  const esc = v => String(v ?? "").replace(/[&<>"']/g, s =>
    ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[s]));
  const today = () => new Date().toISOString().slice(0, 10);
  const clamp = (v, mn = 0, mx = 100) => Math.max(mn, Math.min(mx, v));
  const round = v => Math.round(Number(v) || 0);
  const daysBack = n => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
  const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  const METRICS = [
    { key:"strength",        label:"Progression de force",   icon:"💪", weight:15 },
    { key:"body",            label:"Évolution corporelle",   icon:"📏", weight:15 },
    { key:"adherence",       label:"Respect du programme",   icon:"📈", weight:10 },
    { key:"session_quality", label:"Qualité des séances",    icon:"⏱️", weight:5  },
    { key:"hydration",       label:"Hydratation",            icon:"💧", weight:5  },
    { key:"activity",        label:"Activité quotidienne",   icon:"🚶", weight:5  },
    { key:"cardio",          label:"Cardio",                 icon:"❤️", weight:5  },
    { key:"sleep",           label:"Qualité du sommeil",     icon:"😴", weight:10 },
    { key:"streak",          label:"Régularité longue durée",icon:"🔥", weight:5  },
    { key:"knowledge",       label:"Connaissances",          icon:"🧠", weight:5  },
    { key:"nutrition",       label:"Nutrition",              icon:"🍽️", weight:10 },
    { key:"feeling",         label:"Ressenti du jour",       icon:"🙂", weight:5  },
    { key:"goal",            label:"Avancement objectif",    icon:"🎯", weight:5  },
  ];

  let currentUser = null;

  /* ─── STYLE ────────────────────────────────────────────────── */
  function injectStyles() {
    if ($("ks3Style")) return;
    const st = document.createElement("style");
    st.id = "ks3Style";
    st.textContent = `
      .ks3-hero{border:1px solid rgba(52,224,200,.32);border-radius:20px;
        background:linear-gradient(165deg,rgba(52,224,200,.08),transparent);
        padding:22px 18px;margin-bottom:16px;text-align:center}
      .ks3-hero .tag{font-family:var(--mono,monospace);font-size:10px;letter-spacing:.16em;
        text-transform:uppercase;color:var(--core,#34E0C8)}
      .ks3-global{font-family:var(--disp,system-ui);font-size:58px;line-height:1.1;
        color:var(--core,#34E0C8);margin:8px 0 2px}
      .ks3-date{color:#8A9A93;font-size:13px}
      .ks3-conf{display:inline-block;margin-top:12px;border:1px solid var(--line,#22403A);
        border-radius:99px;padding:6px 14px;font-family:var(--mono,monospace);
        font-size:11px;letter-spacing:.06em;color:#C6D0CB}
      .ks3-conf b{color:var(--core,#34E0C8)}
      .ks3-stats{display:grid;grid-template-columns:repeat(2,1fr);gap:9px;margin:14px 0 18px}
      .ks3-stat{border:1px solid var(--line,#22403A);border-radius:13px;
        background:rgba(4,10,9,.34);padding:13px;text-align:center}
      .ks3-stat b{display:block;font-family:var(--disp,system-ui);font-size:19px;
        color:var(--core,#34E0C8)}
      .ks3-stat span{font-size:11px;color:#8A9A93}
      .ks3-card{border:1px solid var(--line,#22403A);border-radius:15px;
        background:rgba(255,255,255,.02);padding:15px;margin-bottom:10px}
      .ks3-card.off{opacity:.62}
      .ks3-top{display:flex;justify-content:space-between;align-items:baseline;gap:10px}
      .ks3-top b{font-family:var(--disp,system-ui);font-size:15.5px}
      .ks3-top b small{color:#8A9A93;font-weight:400;font-size:11px}
      .ks3-val{font-family:var(--disp,system-ui);font-size:19px;color:var(--core,#34E0C8);flex:0 0 auto}
      .ks3-val.na{color:#5E6E68}
      .ks3-bar{height:8px;border-radius:99px;background:#07110f;
        border:1px solid var(--line,#22403A);overflow:hidden;margin:10px 0 8px}
      .ks3-bar i{display:block;height:100%;width:0;border-radius:inherit;
        background:linear-gradient(90deg,var(--core,#34E0C8),var(--shell,#E7D9C4));
        transition:width .5s ease}
      .ks3-src{font-size:12.5px;color:#8A9A93;line-height:1.45}
      .ks3-src.hint{color:#E7D9C4}
      .ks3-feel{display:flex;gap:8px;margin-top:10px}
      .ks3-feel button{flex:1;border:1px solid var(--line,#22403A);background:none;
        border-radius:12px;padding:10px 4px;font-size:22px;cursor:pointer;transition:.15s}
      .ks3-feel button.active,.ks3-feel button:hover{border-color:var(--core,#34E0C8);
        background:rgba(52,224,200,.1)}
      .ks3-hist{margin:4px 0 16px}
      .ks3-refresh{width:100%;margin:4px 0 18px}
      .ks3-status{font-size:12.5px;color:var(--core,#34E0C8);min-height:16px;text-align:center}
      .ks3-status.err{color:#E8735B}
    `;
    document.head.appendChild(st);
  }

  /* ─── PANNEAU ──────────────────────────────────────────────── */
  function ensurePanel() {
    injectStyles();
    let panel = $("modKpsulIndex");
    if (!panel) {
      panel = document.createElement("div");
      panel.className = "module-panel";
      panel.id = "modKpsulIndex";
      const tools = $("memberTools");
      const first = document.querySelector("#member .module-panel");
      if (tools) tools.prepend(panel);
      else if (first) first.parentElement.insertBefore(panel, first);
      else $("member")?.appendChild(panel);
    }
    if (!panel.dataset.ks3) {
      panel.dataset.ks3 = "1";
      panel.innerHTML = `
        <div class="tool-panel">
          <div class="ks3-hero">
            <span class="tag">— Indice quotidien</span>
            <h3 style="margin:6px 0 0">💊 Kpsul Score</h3>
            <div class="ks3-global" id="ks3Global">—%</div>
            <div class="ks3-date" id="ks3Date"></div>
            <div class="ks3-conf" id="ks3Conf">Fiabilité —</div>
          </div>
          <p style="color:#8A9A93;font-size:13px;margin:0 0 14px;line-height:1.5">
            Ton score n'est pas déclaré, il est <b style="color:#C6D0CB">calculé</b> depuis ce que tu enregistres.
            Chaque mesure non renseignée vaut <b style="color:#C6D0CB">0 point</b> : remplis tes séances, repas,
            sommeil et mesures pour débloquer ton vrai score.
          </p>
          <div class="ks3-stats">
            <div class="ks3-stat"><b id="ks3MonthAvg">—%</b><span>Moyenne du mois</span></div>
            <div class="ks3-stat"><b id="ks3Best">—%</b><span>Meilleur jour</span></div>
            <div class="ks3-stat"><b id="ks3Low">—%</b><span>Jour le plus faible</span></div>
            <div class="ks3-stat"><b id="ks3Days">0</b><span>Jours enregistrés</span></div>
          </div>
          <div class="ks3-hist" id="ks3Hist"></div>
          <button class="btn btn-ghost ks3-refresh" id="ks3Refresh" type="button">Recalculer maintenant</button>
          <div class="ks3-status" id="ks3Status"></div>
          <div id="ks3Cards"></div>
        </div>`;
      $("ks3Refresh")?.addEventListener("click", () => refresh(true));
    }
  }

  /* ─── DONNÉES ──────────────────────────────────────────────── */
  async function fetchAll() {
    const client = sb();
    if (!client) throw new Error("connexion Supabase indisponible");
    const { data: sess } = await client.auth.getSession();
    const uid = sess?.session?.user?.id;
    if (!uid) throw new Error("Non connecté");
    currentUser = uid;
    const d30 = daysBack(30), d7 = daysBack(7);

    const [w, n, h, m, g, gv4, u, inputs, daily] = await Promise.all([
      client.from("workout_exercise_logs").select("log_date,exercise_name,load_kg,sets,reps,rest_seconds,tempo").eq("user_id", uid).gte("log_date", d30),
      client.from("nutrition_logs").select("log_date,calories,meal_name").eq("user_id", uid).gte("log_date", d30),
      client.from("habit_logs").select("log_date,sleep_hours,water_liters,steps").eq("user_id", uid).gte("log_date", d30),
      client.from("body_measurements").select("log_date,weight_kg").eq("user_id", uid).order("log_date"),
      client.from("client_goals").select("main_goal,target_weight_kg").eq("user_id", uid).order("created_at",{ascending:false}).limit(1),
      client.from("client_goals_v4").select("target_value,current_value,status").eq("user_id", uid).eq("status","active").limit(1),
      client.from("understanding_logs").select("created_at").eq("user_id", uid).gte("created_at", d30),
      client.from("kpsul_score_inputs").select("feeling_score").eq("user_id", uid).eq("score_date", today()).limit(1),
      client.from("kpsul_score_daily").select("score_date,global_score").eq("user_id", uid).order("score_date",{ascending:false}).limit(31),
    ]);
    return {
      workouts:(w.data||[]), meals:(n.data||[]), habits:(h.data||[]),
      measures:(m.data||[]), goal:(g.data||[])[0], goalV4:(gv4.data||[])[0],
      knowledge:(u.data||[]), feelingToday:(inputs.data||[])[0]?.feeling_score ?? null,
      history:(daily.data||[]), d7,
    };
  }

  /* ─── CALCULS ──────────────────────────────────────────────── */
  function compute(D) {
    const R = {}; // key -> { score, measured, src, hint }
    const last7 = arr => arr.filter(x => x.log_date >= D.d7);

    /* 💪 Force : charges max par exo, 14 derniers jours vs 14 précédents */
    {
      const d14 = daysBack(14);
      const byExo = {};
      D.workouts.forEach(w => {
        if (!w.exercise_name || !w.load_kg) return;
        const zone = w.log_date >= d14 ? "recent" : "prev";
        (byExo[w.exercise_name] ??= { recent: [], prev: [] })[zone].push(Number(w.load_kg));
      });
      const deltas = Object.values(byExo)
        .filter(e => e.recent.length && e.prev.length)
        .map(e => (Math.max(...e.recent) - Math.max(...e.prev)) / Math.max(...e.prev) * 100);
      if (deltas.length) {
        const d = avg(deltas);
        R.strength = { measured:true, score:clamp(50 + d * 8),
          src:`${deltas.length} exercice(s) comparé(s) · charges ${d >= 0 ? "+" : ""}${d.toFixed(1)} % sur 14 jours` };
      } else {
        R.strength = { measured:false, hint:"Enregistre tes charges sur 2 semaines pour mesurer ta progression." };
      }
    }

    /* 📏 Corps : tendance du poids dans le sens de l'objectif */
    {
      const w = D.measures.filter(x => x.weight_kg);
      if (w.length >= 2) {
        const first = Number(w[0].weight_kg), last = Number(w[w.length-1].weight_kg);
        const weeks = Math.max(1, (new Date(w[w.length-1].log_date) - new Date(w[0].log_date)) / 604800000);
        const rate = (last - first) / weeks; // kg / semaine
        let dir = null;
        const goalTxt = (D.goal?.main_goal || "").toLowerCase();
        if (D.goal?.target_weight_kg) dir = Number(D.goal.target_weight_kg) < last ? "loss" : "gain";
        else if (/perte|sèche|seche|mincir|maigrir/.test(goalTxt)) dir = "loss";
        else if (/prise|masse|grossir/.test(goalTxt)) dir = "gain";
        if (dir) {
          const ideal = dir === "loss" ? -0.5 : 0.3;
          R.body = { measured:true, score:clamp(100 - Math.abs(rate - ideal) * 120),
            src:`Poids ${rate >= 0 ? "+" : ""}${rate.toFixed(2)} kg/sem · objectif ${dir === "loss" ? "perte" : "prise"} (idéal ${ideal} kg/sem)` };
        } else {
          R.body = { measured:true, score:Math.abs(rate) <= 1 ? 60 : 40,
            src:`Poids ${rate >= 0 ? "+" : ""}${rate.toFixed(2)} kg/sem · définis un objectif pour affiner ce score` };
        }
      } else {
        R.body = { measured:false, hint:"Enregistre ton poids au moins 2 fois pour mesurer la tendance." };
      }
    }

    /* 📈 Respect du programme : jours de séance / 7j vs 3 séances */
    {
      const days = new Set(last7(D.workouts).map(w => w.log_date)).size;
      if (D.workouts.length) {
        R.adherence = { measured:true, score:clamp(days / 3 * 100),
          src:`${days} jour(s) de séance sur 7 · cible 3/semaine` };
      } else {
        R.adherence = { measured:false, hint:"Logge tes séances pour mesurer ton assiduité." };
      }
    }

    /* ⏱️ Qualité des séances : complétude des infos loggées */
    {
      const recent = D.workouts.slice(-10);
      if (recent.length) {
        const score = avg(recent.map(w =>
          ((w.sets > 0 ? 1 : 0) + (w.reps > 0 ? 1 : 0) + (w.load_kg > 0 ? 1 : 0) + ((w.rest_seconds > 0 || !!w.tempo) ? 1 : 0)) / 4 * 100));
        R.session_quality = { measured:true, score:clamp(score),
          src:`Précision des ${recent.length} derniers exercices (séries, reps, charge, repos/tempo)` };
      } else {
        R.session_quality = { measured:false, hint:"Logge une séance complète pour activer cette mesure." };
      }
    }

    /* 💧 Hydratation : moyenne 7j vs 2,5 L */
    {
      const vals = last7(D.habits).map(h => Number(h.water_liters)).filter(v => v > 0);
      if (vals.length) {
        R.hydration = { measured:true, score:clamp(avg(vals) / 2.5 * 100),
          src:`${avg(vals).toFixed(1)} L/jour en moyenne (${vals.length} jour(s)) · cible 2,5 L` };
      } else {
        R.hydration = { measured:false, hint:"Note ton eau dans Habitudes pour mesurer l'hydratation." };
      }
    }

    /* 🚶 Activité : pas moyens 7j vs 8 000 */
    {
      const vals = last7(D.habits).map(h => Number(h.steps)).filter(v => v > 0);
      if (vals.length) {
        R.activity = { measured:true, score:clamp(avg(vals) / 8000 * 100),
          src:`${round(avg(vals))} pas/jour en moyenne · cible 8 000` };
      } else {
        R.activity = { measured:false, hint:"Note tes pas dans Habitudes pour mesurer ton activité." };
      }
    }

    /* ❤️ Cardio : pas encore de source de données — honnêteté */
    R.cardio = { measured:false, unavailable:true, hint:"Pas encore mesurable — n'affecte pas ton score tant que la source n'existe pas." };

    /* 😴 Sommeil : moyenne 7 nuits vs 7,5 h */
    {
      const vals = last7(D.habits).map(h => Number(h.sleep_hours)).filter(v => v > 0);
      if (vals.length) {
        const a = avg(vals);
        R.sleep = { measured:true, score:clamp(100 - Math.abs(a - 7.5) * 18),
          src:`${a.toFixed(1)} h/nuit en moyenne sur ${vals.length} nuit(s) · idéal 7-8 h` };
      } else {
        R.sleep = { measured:false, hint:"Note ton sommeil dans Habitudes pour activer cette mesure." };
      }
    }

    /* 🔥 Régularité : jours actifs sur 30 (n'importe quel log) */
    {
      const days = new Set([
        ...D.workouts.map(x => x.log_date),
        ...D.meals.map(x => x.log_date),
        ...D.habits.map(x => x.log_date),
        ...D.measures.filter(x => x.log_date >= daysBack(30)).map(x => x.log_date),
      ]).size;
      if (days > 0) {
        R.streak = { measured:true, score:clamp(days / 30 * 100),
          src:`${days} jour(s) actif(s) sur les 30 derniers` };
      } else {
        R.streak = { measured:false, hint:"Chaque jour où tu enregistres quelque chose compte ici." };
      }
    }

    /* 🧠 Connaissances : activité du journal de compréhension (30j) */
    {
      const c = D.knowledge.length;
      if (c > 0) {
        R.knowledge = { measured:true, score:clamp(c / 4 * 100),
          src:`${c} question(s) posée(s) ce mois · cible 1/semaine` };
      } else {
        R.knowledge = { measured:false, hint:"Pose une question dans le Journal compréhension pour activer ce score." };
      }
    }

    /* 🍽️ Nutrition : jours avec ≥1 repas / 7 */
    {
      const days = new Set(last7(D.meals).map(m => m.log_date)).size;
      if (D.meals.length) {
        R.nutrition = { measured:true, score:clamp(days / 7 * 100),
          src:`${days} jour(s) suivis sur 7` };
      } else {
        R.nutrition = { measured:false, hint:"Logge tes repas pour mesurer la régularité nutrition." };
      }
    }

    /* 🙂 Ressenti : déclaré du jour (emoji), seule métrique subjective */
    {
      if (D.feelingToday != null) {
        R.feeling = { measured:true, score:clamp(Number(D.feelingToday)),
          src:"Ton ressenti déclaré aujourd'hui" };
      } else {
        R.feeling = { measured:false, hint:"Dis-nous comment tu te sens aujourd'hui :", feelingPicker:true };
      }
    }

    /* 🎯 Objectif : progression réelle vers la cible */
    {
      if (D.goalV4?.target_value) {
        const p = clamp(Number(D.goalV4.current_value || 0) / Number(D.goalV4.target_value) * 100);
        R.goal = { measured:true, score:p, src:`${round(p)} % de la cible atteinte` };
      } else if (D.goal?.target_weight_kg && D.measures.filter(m=>m.weight_kg).length >= 2) {
        const w = D.measures.filter(m => m.weight_kg);
        const start = Number(w[0].weight_kg), cur = Number(w[w.length-1].weight_kg),
              target = Number(D.goal.target_weight_kg);
        const p = start === target ? 100 : clamp((start - cur) / (start - target) * 100);
        R.goal = { measured:true, score:p,
          src:`${start} → ${cur} kg · cible ${target} kg (${round(p)} %)` };
      } else {
        R.goal = { measured:false, hint:"Fixe un objectif chiffré (module Objectif) pour mesurer ta progression." };
      }
    }

    /* Global : total sur toutes les métriques disponibles.
       Non renseigné = 0 point. Seules les métriques "unavailable"
       (aucune source possible, ex. cardio) sortent du dénominateur. */
    let wAvail = 0, sSum = 0, wMeasured = 0;
    METRICS.forEach(m => {
      const r = R[m.key];
      if (r?.unavailable) return;          // pas de source possible -> exclu
      wAvail += m.weight;                  // compte dans le total
      if (r?.measured) { sSum += r.score * m.weight; wMeasured += m.weight; }
    });
    const global = wAvail ? round(sSum / wAvail) : 0;
    const confidence = wAvail ? round(wMeasured / wAvail * 100) : 0; // couverture des données
    return { R, global, confidence };
  }

  /* ─── RENDU ────────────────────────────────────────────────── */
  function render(results, D) {
    const { R, global, confidence } = results;
    const g = $("ks3Global"); if (g) g.textContent = global + "%";
    const dt = $("ks3Date");
    if (dt) dt.textContent = new Date().toLocaleDateString("fr-FR",
      { weekday:"long", day:"numeric", month:"long", year:"numeric" });
    const nMeasured = METRICS.filter(m => R[m.key]?.measured).length;
    const nAvail = METRICS.filter(m => !R[m.key]?.unavailable).length;
    const conf = $("ks3Conf");
    if (conf) conf.innerHTML = `Données actives : <b>${nMeasured}/${nAvail}</b> · couverture ${confidence} %`;

    // Historique
    const hist = D.history || [];
    const scores = hist.map(h => Number(h.global_score)).filter(v => !isNaN(v));
    const ma = $("ks3MonthAvg"), be = $("ks3Best"), lo = $("ks3Low"), dy = $("ks3Days");
    if (ma) ma.textContent = scores.length ? round(avg(scores)) + "%" : "—%";
    if (be) be.textContent = scores.length ? round(Math.max(...scores)) + "%" : "—%";
    if (lo) lo.textContent = scores.length ? round(Math.min(...scores)) + "%" : "—%";
    if (dy) dy.textContent = hist.length;
    renderHist(hist);

    // Cartes métriques
    const cards = $("ks3Cards");
    if (cards) cards.innerHTML = METRICS.map(m => {
      const r = R[m.key] || { measured:false, hint:"" };
      return `
        <div class="ks3-card ${r.measured ? "" : "off"}">
          <div class="ks3-top">
            <b>${m.icon} ${esc(m.label)} <small>(${m.weight} %)</small></b>
            <span class="ks3-val ${r.measured ? "" : "na"}">${r.measured ? round(r.score) + " %" : "—"}</span>
          </div>
          <div class="ks3-bar"><i style="width:${r.measured ? clamp(r.score) : 0}%"></i></div>
          <div class="ks3-src ${r.measured ? "" : "hint"}">${esc(r.measured ? r.src : r.hint)}</div>
          ${r.feelingPicker ? `
            <div class="ks3-feel">
              <button type="button" data-feel="25">😞</button>
              <button type="button" data-feel="50">😐</button>
              <button type="button" data-feel="75">🙂</button>
              <button type="button" data-feel="100">🔥</button>
            </div>` : ""}
        </div>`;
    }).join("");

    document.querySelectorAll("[data-feel]").forEach(btn =>
      btn.addEventListener("click", () => saveFeeling(Number(btn.dataset.feel))));
  }

  function renderHist(hist) {
    const box = $("ks3Hist"); if (!box) return;
    const data = hist.slice(0, 14).reverse();
    if (data.length < 2) { box.innerHTML = ""; return; }
    const W = 320, H = 70, bw = Math.max(4, W / data.length - 4);
    box.innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" style="width:100%;display:block" aria-hidden="true">
        ${data.map((d, i) => {
          const v = clamp(Number(d.global_score) || 0);
          const bh = Math.max(2, v / 100 * (H - 14));
          const x = i * (W / data.length) + 2;
          return `<rect x="${x}" y="${H - 12 - bh}" width="${bw}" height="${bh}" rx="3"
            fill="#34E0C8" opacity="${0.35 + v / 200}"/>`;
        }).join("")}
      </svg>`;
  }

  /* ─── ACTIONS ──────────────────────────────────────────────── */
  async function saveFeeling(score) {
    const client = sb(); if (!client || !currentUser) return;
    setStatus("Enregistrement du ressenti…");
    const { error } = await client.from("kpsul_score_inputs").upsert({
      user_id: currentUser, score_date: today(),
      feeling_score: score, updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,score_date" });
    if (error) { setStatus("Erreur : " + error.message, true); return; }
    refresh(true);
  }

  async function saveSnapshot(results) {
    const client = sb(); if (!client || !currentUser) return;
    const payload = {
      user_id: currentUser, score_date: today(),
      global_score: results.global, confidence_score: results.confidence,
      calculated_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    METRICS.forEach(m => {
      const r = results.R[m.key];
      payload[`${m.key}_score`] = r?.measured ? round(r.score) : null;
    });
    await client.from("kpsul_score_daily").upsert(payload, { onConflict: "user_id,score_date" });
  }

  function setStatus(msg, err = false) {
    const el = $("ks3Status"); if (!el) return;
    el.textContent = msg || "";
    el.classList.toggle("err", !!err);
  }

  /* ─── CYCLE ────────────────────────────────────────────────── */
  let refreshing = false;
  async function refresh(manual = false) {
    if (refreshing) return;
    refreshing = true;
    ensurePanel();
    try {
      if (manual) setStatus("Calcul en cours…");
      const D = await fetchAll();
      const results = compute(D);
      render(results, D);
      await saveSnapshot(results);
      setStatus(manual ? "✔ Score recalculé depuis tes données." : "");
    } catch (err) {
      console.warn("Kpsul Score V3:", err);
      setStatus("Configuration requise : " + (err.message || err), true);
    } finally {
      refreshing = false;
    }
  }

  function open() {
    ensurePanel();
    document.querySelectorAll("#member .module-panel").forEach(p => p.classList.remove("active"));
    const panel = $("modKpsulIndex");
    if (!panel) return;
    panel.classList.add("active");
    document.body.classList.add("kpsul-panel-open");
    refresh();
    setTimeout(() => $("member")?.scrollIntoView({ behavior:"smooth", block:"start" }), 60);
  }

  function start() {
    ensurePanel();
    window.KpsulScoreV2 = { open, refresh: () => refresh(false) };
    if (document.body.classList.contains("authed")) refresh();
    new MutationObserver(() => {
      if (document.body.classList.contains("authed") && !$("modKpsulIndex")?.dataset.ks3Loaded) {
        const p = $("modKpsulIndex");
        if (p) p.dataset.ks3Loaded = "1";
        refresh();
      }
    }).observe(document.body, { attributeFilter: ["class"] });
  }

  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", start)
    : start();
})();
