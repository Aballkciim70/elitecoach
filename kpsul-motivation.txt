/* ============================================================
   KPSUL MOTIVATION V1 — PHASE 4
   Motivation utile, basée sur les données réelles du client.
   Aucun score manuel. Aucun accès aux données d'un autre client.
   ============================================================ */
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const sb = () => window.sb || null;
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, s => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[s]));

  const today = () => new Date().toISOString().slice(0,10);
  const daysBack = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0,10);
  const dateKey = (d) => new Date(d).toISOString().slice(0,10);
  const avg = (arr) => arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0;

  let sessionUser = null;
  let profile = null;
  let latestData = null;

  function injectStyles() {
    if ($("kpsulMotivationStyles")) return;
    const style = document.createElement("style");
    style.id = "kpsulMotivationStyles";
    style.textContent = `
      .km-wrap{display:grid;gap:14px}
      .km-hero{border:1px solid var(--line,#22403A);border-radius:20px;padding:18px;
        background:linear-gradient(145deg,rgba(52,224,200,.08),rgba(255,255,255,.02))}
      .km-eyebrow{font:10px monospace;letter-spacing:.16em;text-transform:uppercase;color:var(--core,#34E0C8)}
      .km-hero h3{font-size:clamp(28px,6vw,44px);margin:6px 0 8px}
      .km-hero p{max-width:760px;color:var(--muted,#8A9A93);margin:0;line-height:1.5}
      .km-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
      .km-card{border:1px solid var(--line,#22403A);border-radius:16px;padding:14px;background:rgba(3,10,8,.32)}
      .km-card span{font-size:11px;color:var(--muted,#8A9A93)}
      .km-card b{font-size:25px;display:block;margin-top:4px}
      .km-section{border:1px solid var(--line,#22403A);border-radius:18px;padding:15px}
      .km-section h4{margin:0 0 12px}
      .km-list{display:grid;gap:9px}
      .km-item{display:flex;gap:11px;align-items:flex-start;border:1px solid rgba(34,64,58,.72);
        border-radius:14px;padding:12px;background:rgba(3,10,8,.25)}
      .km-icon{font-size:24px;line-height:1}
      .km-item b{display:block;margin-bottom:3px}
      .km-item p{margin:0;font-size:12px;color:var(--muted,#8A9A93);line-height:1.45}
      .km-progress{height:9px;background:rgba(255,255,255,.07);border-radius:99px;overflow:hidden;margin-top:8px}
      .km-progress>i{display:block;height:100%;background:var(--core,#34E0C8);border-radius:99px}
      .km-badge{display:inline-flex;gap:7px;align-items:center;border:1px solid var(--line,#22403A);
        border-radius:999px;padding:7px 10px;font-size:11px;margin:3px 4px 3px 0}
      .km-badge.locked{opacity:.42;filter:grayscale(1)}
      .km-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
      .km-status{font-size:12px;min-height:18px;color:var(--core,#34E0C8)}
      .km-empty{padding:22px;text-align:center;color:var(--muted,#8A9A93)}
      @media(max-width:700px){.km-grid{grid-template-columns:1fr 1fr}.km-card:first-child{grid-column:1/-1}}
    `;
    document.head.appendChild(style);
  }

  function getClientRoot() {
    return document.querySelector("#member, #client, #clientSpace, [data-workspace='client'], .client-space");
  }

  function getClientTools() {
    return document.querySelector("#memberTools, #clientTools, #clientModules, #member .member-tools, [data-workspace='client'] .member-tools")
      || getClientRoot();
  }

  function getClientTiles() {
    return document.querySelector("#member .member-tiles, #client .member-tiles, #clientTiles, [data-workspace='client'] .member-tiles");
  }

  function insideAdmin(el) {
    return !!el?.closest?.("#admin, #adminSpace, #adminDashboard, [data-workspace='admin'], .admin-space, .admin-dashboard");
  }

  function ensureUI() {
    injectStyles();

    const tools = getClientTools();
    if (!tools || insideAdmin(tools)) return;

    let panel = $("modMotivation");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "modMotivation";
      panel.className = "module-panel";
      tools.appendChild(panel);
    } else if (!tools.contains(panel)) {
      tools.appendChild(panel);
    }

    if (panel.dataset.ready !== "1") {
      panel.dataset.ready = "1";
      panel.innerHTML = `
        <div class="tool-panel">
          <div class="km-wrap">
            <section class="km-hero">
              <div class="km-eyebrow">— Phase 4</div>
              <h3>Ma progression</h3>
              <p id="kmMessage">Kpsul analyse tes efforts réels et met en avant ce qui mérite d'être célébré.</p>
              <div class="km-actions">
                <button class="btn btn-primary" id="kmRefresh" type="button">Actualiser</button>
              </div>
              <div class="km-status" id="kmStatus"></div>
            </section>

            <div class="km-grid">
              <div class="km-card"><span>Série actuelle</span><b id="kmStreak">—</b></div>
              <div class="km-card"><span>Meilleure série</span><b id="kmBest">—</b></div>
              <div class="km-card"><span>Badges débloqués</span><b id="kmBadgeCount">—</b></div>
            </div>

            <section class="km-section">
              <h4>Victoire du moment</h4>
              <div id="kmWin"></div>
            </section>

            <section class="km-section">
              <h4>Prochain cap</h4>
              <div id="kmNext"></div>
            </section>

            <section class="km-section">
              <h4>Badges</h4>
              <div id="kmBadges"></div>
            </section>

            <section class="km-section">
              <h4>Historique positif</h4>
              <div class="km-list" id="kmHistory"></div>
            </section>
          </div>
        </div>
      `;

      $("kmRefresh")?.addEventListener("click", loadMotivation);
    }

    ensureTile();
  }

  function ensureTile() {
    const tiles = getClientTiles();
    if (!tiles || insideAdmin(tiles) || tiles.querySelector('[data-goto="modMotivation"]')) return;

    const tile = document.createElement("div");
    tile.className = "mtile";
    tile.tabIndex = 0;
    tile.dataset.goto = "modMotivation";
    tile.innerHTML = `
      <div class="mtile-icon">🏆</div>
      <h3>Ma progression</h3>
      <p>Découvre tes séries, tes badges et ton prochain objectif concret.</p>
      <span class="mtile-go">Voir mes progrès →</span>
    `;
    tiles.appendChild(tile);

    const open = () => {
      openModule("modMotivation");
      loadMotivation();
    };
    tile.addEventListener("click", open);
    tile.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
    });
  }

  function openModule(id) {
    const root = getClientRoot();
    const target = $(id);
    if (!root || !target || !root.contains(target) || insideAdmin(target)) return;

    root.querySelectorAll(".module-panel").forEach(p => p.classList.remove("active"));
    target.classList.add("active");
    document.body.classList.add("kpsul-panel-open");
    setTimeout(() => root.scrollIntoView({behavior:"smooth",block:"start"}),40);
  }

  function setStatus(text,error=false) {
    const el = $("kmStatus");
    if (!el) return;
    el.textContent = text || "";
    el.style.color = error ? "#E8735B" : "";
  }

  async function initAuth() {
    const client = sb();
    if (!client) throw new Error("Supabase indisponible.");

    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    sessionUser = data?.session?.user?.id;
    if (!sessionUser) throw new Error("Utilisateur non connecté.");

    const { data: rows, error: pErr } = await client.from("profiles")
      .select("id,role,full_name").eq("id",sessionUser).limit(1);
    if (pErr) throw pErr;
    profile = rows?.[0] || {id:sessionUser,role:"client"};
  }

  async function safe(name, fn) {
    try {
      const r = await fn();
      if (r?.error) {
        console.warn("Motivation",name,r.error.message);
        return [];
      }
      return r?.data || [];
    } catch(e) {
      console.warn("Motivation",name,e);
      return [];
    }
  }

  function calculateStreak(workoutDates, habitDates) {
    const active = new Set([...workoutDates, ...habitDates]);
    let current = 0;
    let cursor = new Date();
    for (let i=0;i<365;i++) {
      const key = cursor.toISOString().slice(0,10);
      if (active.has(key)) current++;
      else if (i > 0) break;
      cursor.setDate(cursor.getDate()-1);
    }

    const sorted = [...active].sort();
    let best = 0, run = 0, previous = null;
    for (const key of sorted) {
      const d = new Date(key+"T12:00:00");
      if (!previous) run = 1;
      else {
        const diff = Math.round((d-previous)/86400000);
        run = diff === 1 ? run+1 : 1;
      }
      best = Math.max(best,run);
      previous = d;
    }
    return {current,best};
  }

  function evaluateBadges(D) {
    const workoutCount = D.workouts.length;
    const workoutDays = new Set(D.workouts.map(x=>x.log_date)).size;
    const nutritionDays = new Set(D.meals.map(x=>x.log_date)).size;
    const habitDays = new Set(D.habits.map(x=>x.log_date)).size;
    const score = Number(D.scores[0]?.global_score || 0);
    const streak = D.streak.current;

    return [
      {key:"first_session",icon:"🏁",title:"Premier pas",desc:"Première séance enregistrée.",unlocked:workoutCount>=1,progress:Math.min(workoutCount,1),target:1},
      {key:"three_sessions",icon:"🔥",title:"Lancement",desc:"3 jours d'entraînement enregistrés.",unlocked:workoutDays>=3,progress:Math.min(workoutDays,3),target:3},
      {key:"ten_sessions",icon:"💪",title:"Régularité",desc:"10 jours d'entraînement enregistrés.",unlocked:workoutDays>=10,progress:Math.min(workoutDays,10),target:10},
      {key:"nutrition_week",icon:"🥗",title:"Nutrition suivie",desc:"7 jours de nutrition complétés.",unlocked:nutritionDays>=7,progress:Math.min(nutritionDays,7),target:7},
      {key:"habit_week",icon:"🌙",title:"Routine solide",desc:"7 jours d'habitudes renseignés.",unlocked:habitDays>=7,progress:Math.min(habitDays,7),target:7},
      {key:"streak_7",icon:"⚡",title:"Série de 7 jours",desc:"7 jours actifs consécutifs.",unlocked:streak>=7,progress:Math.min(streak,7),target:7},
      {key:"score_70",icon:"📈",title:"Cap 70",desc:"Kpsul Score supérieur ou égal à 70.",unlocked:score>=70,progress:Math.min(score,70),target:70},
      {key:"score_85",icon:"🏆",title:"Excellence",desc:"Kpsul Score supérieur ou égal à 85.",unlocked:score>=85,progress:Math.min(score,85),target:85}
    ];
  }

  function findWin(D,badges) {
    const latestScore = Number(D.scores[0]?.global_score);
    const previousScore = Number(D.scores[1]?.global_score);
    if (Number.isFinite(latestScore) && Number.isFinite(previousScore) && latestScore > previousScore) {
      return {icon:"📈",title:`Ton score progresse de ${Math.round(latestScore-previousScore)} points`,desc:"Tes efforts récents produisent déjà un effet mesurable."};
    }

    const recentWorkoutDays = new Set(D.workouts.filter(x=>x.log_date>=daysBack(7)).map(x=>x.log_date)).size;
    if (recentWorkoutDays >= 3) {
      return {icon:"🔥",title:`${recentWorkoutDays} jours d'entraînement cette semaine`,desc:"Ta régularité est actuellement ton principal point fort."};
    }

    if (D.streak.current >= 2) {
      return {icon:"⚡",title:`Série de ${D.streak.current} jours`,desc:"Tu construis une habitude. Le prochain jour compte plus que la perfection."};
    }

    const unlocked = badges.filter(b=>b.unlocked).slice(-1)[0];
    if (unlocked) {
      return {icon:unlocked.icon,title:`Badge « ${unlocked.title} » débloqué`,desc:unlocked.desc};
    }

    return {icon:"🎯",title:"Tu as commencé à mesurer ta progression",desc:"Chaque donnée renseignée rend les conseils de Kpsul plus précis."};
  }

  function findNextGoal(badges) {
    const locked = badges
      .filter(b=>!b.unlocked)
      .sort((a,b)=>(b.progress/b.target)-(a.progress/a.target))[0];

    if (!locked) return {
      icon:"👑",title:"Tous les badges actuels sont débloqués",
      desc:"Continue à maintenir tes habitudes pour consolider tes résultats.",
      progress:100
    };

    return {
      icon:locked.icon,
      title:locked.title,
      desc:`${locked.progress}/${locked.target} — ${locked.desc}`,
      progress:Math.round((locked.progress/locked.target)*100)
    };
  }

  async function persistBadges(badges) {
    const unlocked = badges.filter(b=>b.unlocked);
    for (const badge of unlocked) {
      await safe("badge", () => sb().from("client_achievements").upsert({
        client_id:sessionUser,
        achievement_key:badge.key,
        title:badge.title,
        description:badge.desc,
        icon:badge.icon,
        unlocked_at:new Date().toISOString()
      },{onConflict:"client_id,achievement_key"}));
    }
  }

  async function saveDailyState(D,badges) {
    await safe("state", () => sb().from("client_motivation_daily").upsert({
      client_id:sessionUser,
      state_date:today(),
      current_streak:D.streak.current,
      best_streak:D.streak.best,
      unlocked_badges:badges.filter(b=>b.unlocked).length,
      kpsul_score:Number.isFinite(Number(D.scores[0]?.global_score)) ? Math.round(Number(D.scores[0].global_score)) : null
    },{onConflict:"client_id,state_date"}));
  }

  async function loadMotivation() {
    ensureUI();
    try {
      setStatus("Analyse de ta progression…");
      await initAuth();

      const c = sb();
      const [workouts, meals, habits, scores, history] = await Promise.all([
        safe("workouts",()=>c.from("workout_exercise_logs").select("*").eq("user_id",sessionUser).gte("log_date",daysBack(120))),
        safe("meals",()=>c.from("nutrition_logs").select("*").eq("user_id",sessionUser).gte("log_date",daysBack(60))),
        safe("habits",()=>c.from("habit_logs").select("*").eq("user_id",sessionUser).gte("log_date",daysBack(120))),
        safe("scores",()=>c.from("kpsul_score_daily").select("*").eq("user_id",sessionUser).order("score_date",{ascending:false}).limit(30)),
        safe("history",()=>c.from("client_achievements").select("*").eq("client_id",sessionUser).order("unlocked_at",{ascending:false}).limit(20))
      ]);

      const workoutDates = workouts.map(x=>x.log_date).filter(Boolean);
      const habitDates = habits.map(x=>x.log_date).filter(Boolean);
      const streak = calculateStreak(workoutDates,habitDates);

      const D = {workouts,meals,habits,scores,history,streak};
      const badges = evaluateBadges(D);
      latestData = {D,badges};

      await persistBadges(badges);
      await saveDailyState(D,badges);

      render(D,badges,history);
      setStatus("✔ Progression actualisée.");
    } catch(e) {
      console.error(e);
      setStatus(e.message || String(e),true);
    }
  }

  function render(D,badges,history) {
    const unlocked = badges.filter(b=>b.unlocked);
    const win = findWin(D,badges);
    const next = findNextGoal(badges);

    $("kmStreak").textContent = `${D.streak.current} jour${D.streak.current>1?"s":""}`;
    $("kmBest").textContent = `${D.streak.best} jour${D.streak.best>1?"s":""}`;
    $("kmBadgeCount").textContent = `${unlocked.length}/${badges.length}`;

    $("kmMessage").textContent = D.streak.current > 0
      ? `Tu construis actuellement une série de ${D.streak.current} jour${D.streak.current>1?"s":""}.`
      : "Le prochain petit effort peut relancer ta série dès aujourd'hui.";

    $("kmWin").innerHTML = `
      <div class="km-item">
        <div class="km-icon">${win.icon}</div>
        <div><b>${esc(win.title)}</b><p>${esc(win.desc)}</p></div>
      </div>
    `;

    $("kmNext").innerHTML = `
      <div class="km-item">
        <div class="km-icon">${next.icon}</div>
        <div style="flex:1">
          <b>${esc(next.title)}</b>
          <p>${esc(next.desc)}</p>
          <div class="km-progress"><i style="width:${Math.max(0,Math.min(100,next.progress))}%"></i></div>
        </div>
      </div>
    `;

    $("kmBadges").innerHTML = badges.map(b=>`
      <span class="km-badge ${b.unlocked?"":"locked"}" title="${esc(b.desc)}">
        ${b.icon} ${esc(b.title)}
      </span>
    `).join("");

    const mergedHistory = [
      ...history.map(h=>({
        icon:h.icon || "🏅",
        title:h.title,
        desc:h.description,
        date:h.unlocked_at
      })),
      ...unlocked.filter(b=>!history.some(h=>h.achievement_key===b.key)).map(b=>({
        icon:b.icon,title:b.title,desc:b.desc,date:new Date().toISOString()
      }))
    ].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,10);

    $("kmHistory").innerHTML = mergedHistory.length
      ? mergedHistory.map(h=>`
          <div class="km-item">
            <div class="km-icon">${h.icon}</div>
            <div>
              <b>${esc(h.title)}</b>
              <p>${esc(h.desc)} · ${new Date(h.date).toLocaleDateString("fr-FR")}</p>
            </div>
          </div>
        `).join("")
      : `<div class="km-empty">Tes prochaines réussites apparaîtront ici automatiquement.</div>`;
  }

  function start() {
    ensureUI();

    window.KpsulMotivation = {
      open:()=>{ensureUI();openModule("modMotivation");loadMotivation();},
      refresh:loadMotivation
    };

    new MutationObserver(()=>ensureUI())
      .observe(document.body,{childList:true,subtree:true});
  }

  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded",start)
    : start();
})();
