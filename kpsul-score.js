/* KPSUL -- SCORE GLOBAL + CAPSULE ANIMÉE */
(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));
  const sb = () => window.sb || null;

  const safe = v => String(v ?? "").replace(/[&<>"']/g, s => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  }[s]));

  function injectStyle(){
    if($("kscoreStyle")) return;
    const st = document.createElement("style");
    st.id = "kscoreStyle";
    st.textContent = `
      .kscore-capsule{
        width:210px;height:92px;border-radius:999px;border:1px solid var(--line,#22403A);
        background:#07110f;overflow:hidden;position:relative;margin:18px auto;
        box-shadow:0 0 0 1px rgba(52,224,200,.12), inset 0 0 30px rgba(0,0,0,.35);
        transform:rotate(-8deg);
      }
      .kscore-fill{
        position:absolute;left:0;top:0;height:100%;width:0%;
        background:linear-gradient(90deg,var(--core,#34E0C8),var(--shell,#E7D9C4));
        transition:width .9s ease;
      }
      .kscore-capsule::after{
        content:"";position:absolute;inset:10px;border-radius:999px;
        border:1px solid rgba(255,255,255,.18);
        pointer-events:none;
      }
      .kscore-capsule.done{
        box-shadow:0 0 38px rgba(52,224,200,.55),0 0 0 1px rgba(52,224,200,.45);
        animation:kscorePulse 1.4s ease-in-out infinite;
      }
      @keyframes kscorePulse{0%,100%{transform:rotate(-8deg) scale(1)}50%{transform:rotate(-8deg) scale(1.025)}}
      .kscore-percent{text-align:center;font-family:var(--disp,system-ui);font-size:48px;color:var(--core,#34E0C8);line-height:1}
      .kscore-message{text-align:center;color:#C6D0CB;margin:10px auto 18px;max-width:480px}
      .kscore-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-top:16px}
      .kscore-item{border:1px solid var(--line,#22403A);border-radius:14px;padding:14px;background:rgba(255,255,255,.025)}
      .kscore-item b{display:flex;justify-content:space-between;color:var(--paper,#ECEFE9);font-family:var(--disp,system-ui)}
      .kscore-item span{display:block;color:#8A9A93;font-size:13px;margin-top:5px}
      @media(max-width:560px){.kscore-grid{grid-template-columns:1fr}.kscore-capsule{width:180px;height:78px}}
    `;
    document.head.appendChild(st);
  }

  async function uid(){
    const client = sb();
    if(!client) return null;
    const { data } = await client.auth.getSession();
    return data?.session?.user?.id || null;
  }

  async function getRows(table, userId){
    const client = sb();
    if(!client || !userId) return [];
    try{
      const { data, error } = await client.from(table).select("*").eq("user_id", userId);
      if(error) return [];
      return data || [];
    }catch(e){ return []; }
  }

  function lastNumber(rows, key){
    const r = [...rows].reverse().find(x => x[key] != null);
    return r ? Number(r[key]) : null;
  }

  function partScore(value, max){
    return Math.min(100, Math.round((value / max) * 100));
  }

  function compute(data){
    const workouts = data.workouts || [];
    const nutrition = data.nutrition || [];
    const habits = data.habits || [];
    const checkins = data.checkins || [];
    const measures = data.measures || [];
    const goals = data.goals || [];
    const goalsV4 = data.goalsV4 || [];
    const understandings = data.understandings || [];
    const messages = data.messages || [];

    const workoutScore = partScore(workouts.length, 20);
    const nutritionScore = partScore(nutrition.length, 30);

    const sleepValues = [
      ...habits.map(h => Number(h.sleep_hours || 0)).filter(Boolean),
      ...checkins.map(c => Number(c.sleep_hours || 0)).filter(Boolean)
    ];
    const sleepAvg = sleepValues.length ? sleepValues.reduce((a,b)=>a+b,0) / sleepValues.length : 0;
    const sleepScore = sleepAvg ? Math.min(100, Math.round((sleepAvg / 8) * 100)) : 35;

    const feelingValues = checkins.map(c => Number(c.energy_level || 0)).filter(Boolean);
    const feelingAvg = feelingValues.length ? feelingValues.reduce((a,b)=>a+b,0) / feelingValues.length : 0;
    const feelingScore = feelingAvg ? Math.min(100, Math.round((feelingAvg / 10) * 100)) : 45;

    const understandingScore = partScore(understandings.length + messages.length, 15);
    const regularityScore = partScore(workouts.length + nutrition.length + habits.length + checkins.length, 55);

    let objectiveScore = 0;
    const activeGoal = goalsV4.find(g => g.status === "active" && g.target_value != null);
    if(activeGoal){
      objectiveScore = Math.min(100, Math.round((Number(activeGoal.current_value || 0) / Number(activeGoal.target_value || 1)) * 100));
    }else{
      const targetGoal = goals.find(g => g.target_weight_kg != null);
      const lastWeight = lastNumber(measures, "weight_kg");
      if(targetGoal && lastWeight){
        const target = Number(targetGoal.target_weight_kg);
        const start = Number(measures[0]?.weight_kg || lastWeight);
        const distanceStart = Math.abs(target - start);
        const distanceNow = Math.abs(target - lastWeight);
        objectiveScore = distanceStart ? Math.min(100, Math.round(((distanceStart - distanceNow) / distanceStart) * 100)) : 0;
      }else{
        objectiveScore = partScore(measures.length, 10);
      }
    }

    const score = Math.round(
      workoutScore * 0.22 +
      nutritionScore * 0.18 +
      objectiveScore * 0.22 +
      sleepScore * 0.10 +
      feelingScore * 0.08 +
      regularityScore * 0.12 +
      understandingScore * 0.08
    );

    const finalScore = Math.max(0, Math.min(100, score));

    let level = "Départ";
    let message = "Ton objectif commence à prendre forme. Continue à renseigner tes données.";
    if(finalScore >= 25){ level = "Mise en route"; message = "Tu construis une vraie régularité. La capsule commence à se remplir."; }
    if(finalScore >= 50){ level = "Progression visible"; message = "Les données montrent une progression. Continue sur les bases : séances, nutrition, repos."; }
    if(finalScore >= 75){ level = "Objectif proche"; message = "Tu es proche de ton objectif. Le coach peut affiner les derniers détails."; }
    if(finalScore >= 100){ level = "Objectif atteint"; message = "Objectif atteint. Nouveau cycle recommandé avec ton coach."; }

    return {
      score: finalScore,
      level,
      message,
      details: {
        workoutScore,
        nutritionScore,
        objectiveScore,
        sleepScore,
        feelingScore,
        regularityScore,
        understandingScore
      }
    };
  }

  function injectClient(){
    const tabs = qs(".module-tabs");
    if(tabs && !qs('[data-module="modKpsulScore"]')){
      tabs.insertAdjacentHTML("afterbegin",
        `<button class="module-tab" data-module="modKpsulScore" type="button">Kpsul Score</button>`
      );
    }

    const anchor = qs(".module-panel");
    if(!anchor || $("modKpsulScore")) return;

    anchor.insertAdjacentHTML("beforebegin", `
      <div class="module-panel" id="modKpsulScore">
        <div class="tool-panel">
          <h3>💊 Kpsul Score</h3>
          <p>Ton score global est calculé selon tes séances, ta nutrition, ton repos, ton ressenti, tes mesures, tes objectifs et ta régularité.</p>

          <div class="kscore-capsule" id="kscoreCapsule">
            <div class="kscore-fill" id="kscoreFill"></div>
          </div>

          <div class="kscore-percent" id="kscorePercent">0%</div>
          <div class="kscore-message" id="kscoreMessage">Chargement du score…</div>

          <button class="btn btn-ghost" id="kscoreRefresh" type="button">Recalculer</button>

          <div class="kscore-grid" id="kscoreDetails"></div>
        </div>
      </div>
    `);
  }

  function hookTabs(){
    qsa("[data-module]").forEach(btn => {
      if(btn.dataset.kscoreHooked) return;
      btn.dataset.kscoreHooked = "1";
      btn.addEventListener("click", () => {
        const target = btn.dataset.module;
        qsa(".module-tab").forEach(b => b.classList.toggle("active", b.dataset.module === target));
        qsa(".module-panel").forEach(p => p.classList.toggle("active", p.id === target));
        if(target === "modKpsulScore") loadClientScore();
      });
    });
  }

  function render(result){
    const fill = $("kscoreFill");
    const percent = $("kscorePercent");
    const msg = $("kscoreMessage");
    const cap = $("kscoreCapsule");

    if(fill) fill.style.width = result.score + "%";
    if(percent) percent.textContent = result.score + "%";
    if(msg) msg.textContent = result.level + " -- " + result.message;
    if(cap) cap.classList.toggle("done", result.score >= 100);

    const d = result.details || {};
    const box = $("kscoreDetails");
    if(box){
      box.innerHTML = [
        ["Séances", d.workoutScore, "Accomplissement des séances renseignées."],
        ["Nutrition", d.nutritionScore, "Suivi alimentaire et régularité nutritionnelle."],
        ["Objectif", d.objectiveScore, "Avancement vers l’objectif fixé au départ."],
        ["Repos", d.sleepScore, "Sommeil et récupération."],
        ["Ressenti", d.feelingScore, "Énergie et état général."],
        ["Régularité", d.regularityScore, "Présence globale dans le suivi."],
        ["Compréhension", d.understandingScore, "Questions, échanges et compréhension du programme."]
      ].map(([label, val, text]) => `
        <div class="kscore-item">
          <b>${safe(label)} <em>${Math.round(val || 0)}%</em></b>
          <span>${safe(text)}</span>
        </div>
      `).join("");
    }
  }

  async function saveSnapshot(userId, result){
    const client = sb();
    if(!client || !userId) return;

    await client.from("kpsul_score_snapshots").upsert({
      user_id: userId,
      score_date: new Date().toISOString().slice(0,10),
      score_percent: result.score,
      level: result.level,
      details: result.details
    }, { onConflict: "user_id,score_date" });
  }

  async function loadClientScore(){
    const userId = await uid();
    if(!userId) return;

    const data = {
      workouts: await getRows("workout_exercise_logs", userId),
      nutrition: await getRows("nutrition_logs", userId),
      habits: await getRows("habit_logs", userId),
      checkins: await getRows("client_checkins", userId),
      measures: await getRows("body_measurements", userId),
      goals: await getRows("client_goals", userId),
      goalsV4: await getRows("client_goals_v4", userId),
      understandings: await getRows("understanding_logs", userId),
      messages: await getRows("messages", userId)
    };

    const result = compute(data);
    render(result);
    saveSnapshot(userId, result);
  }

  function init(){
    injectStyle();
    injectClient();
    hookTabs();

    $("kscoreRefresh")?.addEventListener("click", loadClientScore);

    setTimeout(() => {
      hookTabs();
      loadClientScore();
    }, 700);
  }

  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", init)
    : init();
})();