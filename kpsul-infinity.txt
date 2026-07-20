/* KPSUL INFINITY — couche d'innovation intégrée
   Réutilise les données Kpsul existantes : profiles, programs, nutrition_logs,
   workout_exercise_logs, habit_logs, client_goals, bookings, client_documents.
   Aucun remplacement des modules existants. */
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const esc = (v="") => String(v).replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  const today = () => new Date().toISOString().slice(0,10);
  const monthKey = () => today().slice(0,7);
  const fmtDate = (v) => v ? new Intl.DateTimeFormat("fr-FR", {dateStyle:"medium"}).format(new Date(v)) : "—";
  const clamp = (n,min,max) => Math.max(min,Math.min(max,n));

  const state = { user:null, profile:null, data:null, currentTab:"dashboard" };

  function sb(){ return window.sb || window.supabaseClient || null; }
  async function session(){
    const client = sb();
    if(!client) return null;
    const {data} = await client.auth.getSession();
    return data?.session || null;
  }

  function css(){
    if($("kInfinityStyle")) return;
    const s=document.createElement("style"); s.id="kInfinityStyle";
    s.textContent=`
      .ki-shell{display:grid;gap:16px}.ki-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;flex-wrap:wrap}
      .ki-head h3{font-family:var(--disp);font-size:26px}.ki-muted{color:var(--muted);font-size:14px}.ki-tabs{display:flex;gap:8px;overflow:auto;padding-bottom:4px}
      .ki-tab{white-space:nowrap;border:1px solid var(--line);background:var(--ink-900);color:var(--paper);border-radius:999px;padding:9px 13px;cursor:pointer;font:12px var(--mono)}
      .ki-tab.active{background:var(--core);color:#04110e;border-color:var(--core)}.ki-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
      .ki-card{border:1px solid var(--line);border-radius:16px;background:var(--ink-900);padding:16px}.ki-card h4{font-family:var(--disp);font-size:17px;margin-bottom:7px}
      .ki-kpi{font-family:var(--disp);font-size:31px;color:var(--core);line-height:1.1}.ki-list{display:grid;gap:9px}.ki-item{border:1px solid var(--line);border-radius:13px;padding:13px;background:rgba(255,255,255,.02)}
      .ki-row{display:flex;justify-content:space-between;gap:12px;align-items:center}.ki-badge{font:10px var(--mono);text-transform:uppercase;letter-spacing:.08em;padding:5px 8px;border-radius:999px;border:1px solid var(--line);color:var(--core)}
      .ki-progress{height:8px;border-radius:999px;background:#07110f;border:1px solid var(--line);overflow:hidden}.ki-progress>i{display:block;height:100%;background:var(--core);border-radius:inherit}
      .ki-form{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.ki-form textarea{grid-column:1/-1}.ki-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
      .ki-btn{border:1px solid var(--line);background:var(--ink-800);color:var(--paper);border-radius:10px;padding:10px 12px;cursor:pointer}.ki-btn.primary{background:var(--core);color:#04110e;border-color:var(--core)}
      .ki-bodymap{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.ki-muscle{border:1px solid var(--line);border-radius:12px;padding:12px;cursor:pointer;background:var(--ink-900)}.ki-muscle:hover{border-color:var(--core)}
      .ki-empty{padding:20px;border:1px dashed var(--line);border-radius:14px;color:var(--muted);text-align:center}.ki-panel{display:none}.ki-panel.active{display:block}
      .ki-note{border-left:2px solid var(--core);padding:12px 14px;background:rgba(52,224,200,.06);border-radius:0 12px 12px 0}.ki-status{min-height:20px;color:var(--core);font-size:13px;margin-top:8px}
      @media(max-width:900px){.ki-grid{grid-template-columns:repeat(2,1fr)}.ki-form{grid-template-columns:1fr 1fr}.ki-bodymap{grid-template-columns:repeat(2,1fr)}}
      @media(max-width:560px){.ki-grid,.ki-form{grid-template-columns:1fr}.ki-form textarea{grid-column:auto}.ki-bodymap{grid-template-columns:1fr 1fr}}
    `;
    document.head.appendChild(s);
  }

  function inject(){
    css();
    const tiles=document.querySelector("#member .member-tiles");
    if(tiles && !$("kiTile")){
      const tile=document.createElement("div"); tile.id="kiTile"; tile.className="mtile"; tile.tabIndex=0;
      tile.innerHTML=`<div class="tag">Écosystème</div><h4>Kpsul Infinity</h4><p>Passeport, coffre, missions, points, laboratoire, capsules et jumeau numérique.</p><span class="mtile-go">Ouvrir →</span>`;
      tile.addEventListener("click", openPanel); tile.addEventListener("keydown",e=>{if(e.key==="Enter")openPanel()}); tiles.appendChild(tile);
    }
    const host=document.querySelector("#member .member-card") || $("member");
    if(host && !$("modKpsulInfinity")){
      const panel=document.createElement("div"); panel.id="modKpsulInfinity"; panel.className="module-panel";
      panel.innerHTML=`<div class="ki-shell">
        <div class="ki-head"><div><div class="eyebrow">Kpsul Core</div><h3>Kpsul Infinity</h3><p class="ki-muted">Une seule donnée nourrit tous les modules. Aucun doublon.</p></div><span class="ki-badge">évolution continue</span></div>
        <div class="ki-tabs" id="kiTabs"></div><div id="kiContent"></div><div class="ki-status" id="kiStatus"></div>
      </div>`;
      host.appendChild(panel);
    }
  }

  function openPanel(){
    document.querySelectorAll("#member .module-panel").forEach(p=>p.classList.remove("active"));
    $("modKpsulInfinity")?.classList.add("active"); document.body.classList.add("kpsul-panel-open");
    $("modKpsulInfinity")?.scrollIntoView({behavior:"smooth",block:"start"}); refresh();
  }

  const tabs=[
    ["dashboard","Vue globale"],["passport","Passeport santé"],["vault","Coffre de vie"],["lab","Laboratoire"],
    ["missions","Missions & points"],["skills","Compétences"],["body","Carte du corps"],["calendar","Calendrier de vie"],
    ["community","Saisons & salle"],["capsules","Capsules"],["twin","Jumeau numérique"]
  ];
  function renderTabs(){
    $("kiTabs").innerHTML=tabs.map(([id,label])=>`<button class="ki-tab ${state.currentTab===id?"active":""}" data-ki-tab="${id}">${label}</button>`).join("");
    $("kiTabs").querySelectorAll("[data-ki-tab]").forEach(b=>b.onclick=()=>{state.currentTab=b.dataset.kiTab;render();});
  }

  async function safeSelect(table, query=(q)=>q){
    try{ const r=await query(sb().from(table).select("*")); return r.error?[]:(r.data||[]); }catch(_){ return []; }
  }

  async function load(){
    const se=await session(); if(!se) return null; state.user=se.user;
    const uid=se.user.id;
    const [profiles,programs,nutrition,workouts,habits,goals,bookings,documents,points,missions,userMissions,skills,userSkills,events,capsules,seasons,insights,measurements]=await Promise.all([
      safeSelect("profiles",q=>q.eq("id",uid).limit(1)), safeSelect("programs",q=>q.eq("client_id",uid).order("created_at",{ascending:false})),
      safeSelect("nutrition_logs",q=>q.eq("user_id",uid).order("date",{ascending:false}).limit(90)), safeSelect("workout_exercise_logs",q=>q.eq("user_id",uid).order("created_at",{ascending:false}).limit(250)),
      safeSelect("habit_logs",q=>q.eq("user_id",uid).order("date",{ascending:false}).limit(120)), safeSelect("client_goals",q=>q.eq("user_id",uid).order("created_at",{ascending:false})),
      safeSelect("bookings",q=>q.eq("client_id",uid).order("created_at",{ascending:false})), safeSelect("client_documents",q=>q.eq("client_id",uid).order("created_at",{ascending:false})),
      safeSelect("kpsul_points_ledger",q=>q.eq("user_id",uid).order("created_at",{ascending:false})), safeSelect("kpsul_missions",q=>q.eq("active",true).order("created_at",{ascending:false})),
      safeSelect("kpsul_user_missions",q=>q.eq("user_id",uid)), safeSelect("kpsul_skills",q=>q.eq("active",true).order("sort_order")), safeSelect("kpsul_user_skills",q=>q.eq("user_id",uid)),
      safeSelect("kpsul_life_events",q=>q.eq("user_id",uid).order("starts_on",{ascending:false})), safeSelect("kpsul_capsules",q=>q.eq("user_id",uid).order("period_key",{ascending:false})),
      safeSelect("kpsul_seasons",q=>q.eq("active",true).order("starts_on",{ascending:false})), safeSelect("kpsul_insights",q=>q.eq("user_id",uid).order("created_at",{ascending:false}).limit(30)),
      safeSelect("body_measurements",q=>q.eq("user_id",uid).order("measured_at",{ascending:false}).limit(30))
    ]);
    state.profile=profiles[0]||{};
    state.data={programs,nutrition,workouts,habits,goals,bookings,documents,points,missions,userMissions,skills,userSkills,events,capsules,seasons,insights,measurements};
    return state.data;
  }

  function metrics(){
    const d=state.data||{}; const pts=(d.points||[]).reduce((s,x)=>s+Number(x.points||0),0);
    const done=(d.userMissions||[]).filter(x=>x.status==="completed").length;
    const workouts30=(d.workouts||[]).filter(x=>new Date(x.created_at||x.date)>=new Date(Date.now()-30*86400000)).length;
    const habits30=(d.habits||[]).filter(x=>new Date(x.date||x.created_at)>=new Date(Date.now()-30*86400000)).length;
    const consistency=clamp(Math.round((workouts30*4+habits30)/1.5),0,100);
    const passport=clamp(Math.round([d.programs?.length,d.nutrition?.length,d.workouts?.length,d.habits?.length,d.measurements?.length,d.goals?.length].filter(Boolean).length/6*100),0,100);
    return {pts,done,workouts30,consistency,passport};
  }

  function render(){
    renderTabs(); const c=$("kiContent"); if(!c)return;
    const renderers={dashboard:dashboard,passport,vault,lab,missions,skills,body,calendar,community,capsules,twin};
    c.innerHTML=(renderers[state.currentTab]||dashboard)(); bind();
  }

  function dashboard(){const m=metrics();return `<div class="ki-grid">
    <div class="ki-card"><div class="ki-kpi">${m.pts}</div><div class="ki-muted">Kpsul Points disponibles</div></div>
    <div class="ki-card"><div class="ki-kpi">${m.passport}%</div><div class="ki-muted">Passeport renseigné</div></div>
    <div class="ki-card"><div class="ki-kpi">${m.workouts30}</div><div class="ki-muted">Entrées d'entraînement sur 30 jours</div></div>
    <div class="ki-card"><div class="ki-kpi">${m.consistency}%</div><div class="ki-muted">Indice de régularité estimé</div></div>
  </div><div class="ki-card" style="margin-top:12px"><h4>Le principe Kpsul Core</h4><div class="ki-note">Tes programmes, repas, habitudes, réservations, mesures et séances restent dans leurs tables actuelles. Infinity les assemble pour produire le passeport, les récompenses, les capsules et les analyses.</div></div>
  <div class="ki-grid" style="margin-top:12px">${[["Passeport santé","Une lecture claire de ton évolution globale."],["Laboratoire","Des corrélations personnelles, jamais des ordres automatiques."],["Missions","Des récompenses liées à la constance, pas à la performance brute."],["Jumeau numérique","Une comparaison avec toi-même, pas avec les autres."]].map(x=>`<div class="ki-card"><h4>${x[0]}</h4><p class="ki-muted">${x[1]}</p></div>`).join("")}</div>`}

  function passport(){const m=metrics(),d=state.data; const domains=[
    ["Entraînement",clamp((d.workouts?.length||0)*4,0,100)],["Nutrition",clamp((d.nutrition?.length||0)*3,0,100)],["Habitudes",clamp((d.habits?.length||0)*2,0,100)],
    ["Corps",clamp((d.measurements?.length||0)*12,0,100)],["Objectifs",d.goals?.length?80:10],["Régularité",m.consistency]
  ];return `<div class="ki-card"><div class="ki-row"><div><h4>Passeport santé et sportif</h4><p class="ki-muted">Construit exclusivement depuis tes données existantes.</p></div><div class="ki-kpi">${m.passport}%</div></div></div><div class="ki-grid" style="margin-top:12px">${domains.map(([n,v])=>`<div class="ki-card"><div class="ki-row"><h4>${n}</h4><b>${v}%</b></div><div class="ki-progress"><i style="width:${v}%"></i></div></div>`).join("")}</div>`}

  function vault(){const d=state.data;const items=[...[...(d.programs||[])].map(x=>({type:"Programme",date:x.created_at,title:x.name||x.title||"Programme"})),...[...(d.documents||[])].map(x=>({type:"Document",date:x.created_at,title:x.name||x.filename||"Document"})),...[...(d.measurements||[])].map(x=>({type:"Mesure",date:x.measured_at||x.created_at,title:`Poids ${x.weight_kg??"—"} kg`}))].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,30);return `<div class="ki-card"><h4>Coffre de vie</h4><p class="ki-muted">Chronologie unifiée sans recopier tes données.</p></div><div class="ki-list" style="margin-top:12px">${items.length?items.map(x=>`<div class="ki-item ki-row"><div><b>${esc(x.title)}</b><div class="ki-muted">${x.type}</div></div><span>${fmtDate(x.date)}</span></div>`).join(""):`<div class="ki-empty">Le coffre se remplira automatiquement avec tes programmes, mesures et documents.</div>`}</div>`}

  function lab(){const d=state.data, insights=d.insights||[]; return `<div class="ki-card"><h4>Laboratoire Kpsul</h4><p class="ki-muted">Les observations décrivent des tendances. Elles ne remplacent jamais le coach ni un professionnel de santé.</p><div class="ki-actions"><button class="ki-btn primary" id="kiGenerateInsights">Analyser mes tendances</button></div></div><div class="ki-list" style="margin-top:12px">${insights.length?insights.map(x=>`<div class="ki-item"><div class="ki-row"><b>${esc(x.title||"Observation")}</b><span class="ki-badge">${Math.round(Number(x.confidence||0)*100)}% confiance</span></div><p class="ki-muted">${esc(x.summary||"")}</p></div>`).join(""):`<div class="ki-empty">Lance une analyse quand suffisamment de données sont disponibles.</div>`}</div>`}

  function missions(){const d=state.data,m=metrics();return `<div class="ki-grid"><div class="ki-card"><div class="ki-kpi">${m.pts}</div><div class="ki-muted">Points disponibles</div></div><div class="ki-card"><div class="ki-kpi">${m.done}</div><div class="ki-muted">Missions accomplies</div></div></div><div class="ki-list" style="margin-top:12px">${(d.missions||[]).length?(d.missions||[]).map(x=>{const u=(d.userMissions||[]).find(y=>y.mission_id===x.id);const p=clamp(Number(u?.progress||0),0,100);return `<div class="ki-item"><div class="ki-row"><div><b>${esc(x.title)}</b><div class="ki-muted">${esc(x.description||"")}</div></div><span class="ki-badge">+${x.reward_points||0} pts</span></div><div class="ki-progress" style="margin-top:10px"><i style="width:${p}%"></i></div><div class="ki-actions"><button class="ki-btn" data-start-mission="${x.id}">${u?"Mettre à jour":"Commencer"}</button></div></div>`}).join(""):`<div class="ki-empty">Les missions seront publiées par le coach.</div>`}</div>`}

  function skills(){const d=state.data;return `<div class="ki-card"><h4>Arbre des compétences</h4><p class="ki-muted">Apprendre fait partie de la transformation : nutrition, technique, récupération et autonomie.</p></div><div class="ki-grid" style="margin-top:12px">${(d.skills||[]).length?(d.skills||[]).map(x=>{const u=(d.userSkills||[]).find(y=>y.skill_id===x.id);return `<div class="ki-card"><div class="ki-row"><h4>${esc(x.title)}</h4><span class="ki-badge">${u?.mastered_at?"acquis":"à découvrir"}</span></div><p class="ki-muted">${esc(x.description||"")}</p>${!u?.mastered_at?`<button class="ki-btn" data-master-skill="${x.id}">J'ai compris</button>`:""}</div>`}).join(""):`<div class="ki-empty">Les compétences seront ajoutées progressivement à la pédagogie existante.</div>`}</div>`}

  function body(){const d=state.data; const muscles=["Pectoraux","Dos","Épaules","Biceps","Triceps","Quadriceps","Ischio-jambiers","Fessiers","Mollets","Abdominaux","Lombaires","Cardio / souffle"];return `<div class="ki-card"><h4>Carte du corps</h4><p class="ki-muted">Chaque zone renvoie aux séances enregistrées et, lorsqu'elle est disponible, à la bibliothèque d'exercices existante.</p></div><div class="ki-bodymap" style="margin-top:12px">${muscles.map(m=>{const n=(d.workouts||[]).filter(x=>JSON.stringify(x).toLowerCase().includes(m.toLowerCase().split(" ")[0])).length;return `<button class="ki-muscle" data-muscle="${esc(m)}"><b>${m}</b><div class="ki-muted">${n} entrée(s) liée(s)</div></button>`}).join("")}</div><div id="kiMuscleDetail" class="ki-card" style="margin-top:12px"><p class="ki-muted">Sélectionne une zone.</p></div>`}

  function calendar(){const d=state.data;return `<div class="ki-card"><h4>Calendrier de vie</h4><p class="ki-muted">Ajoute vacances, travail intense, fatigue, blessure ou compétition. Ces événements contextualisent les données sans modifier automatiquement le programme.</p><div class="ki-form" style="margin-top:12px"><input id="kiEventTitle" placeholder="Titre"><select id="kiEventType"><option>vacances</option><option>travail</option><option>fatigue</option><option>blessure</option><option>compétition</option><option>autre</option></select><input id="kiEventStart" type="date" value="${today()}"><input id="kiEventEnd" type="date" value="${today()}"><textarea id="kiEventNote" placeholder="Contexte utile au coach"></textarea></div><button class="ki-btn primary" id="kiSaveEvent">Ajouter</button></div><div class="ki-list" style="margin-top:12px">${(d.events||[]).length?(d.events||[]).map(x=>`<div class="ki-item ki-row"><div><b>${esc(x.title)}</b><div class="ki-muted">${esc(x.event_type)} · ${fmtDate(x.starts_on)} → ${fmtDate(x.ends_on)}</div></div><span>${esc(x.notes||"")}</span></div>`).join(""):`<div class="ki-empty">Aucun événement de contexte.</div>`}</div>`}

  function community(){const d=state.data;const season=d.seasons?.[0];return `<div class="ki-grid"><div class="ki-card"><h4>Saison active</h4>${season?`<div class="ki-kpi">${esc(season.name)}</div><p class="ki-muted">${fmtDate(season.starts_on)} → ${fmtDate(season.ends_on)}</p>`:`<p class="ki-muted">Aucune saison publiée.</p>`}</div><div class="ki-card"><h4>Salle virtuelle</h4><div class="ki-kpi" id="kiLiveCount">—</div><p class="ki-muted">membres actifs aujourd'hui</p><button class="ki-btn" id="kiCheckIn">Je m'entraîne maintenant</button></div></div><div class="ki-card" style="margin-top:12px"><h4>Défis collectifs</h4><p class="ki-muted">Les missions de saison utilisent le même système de missions et de points, sans créer un deuxième moteur de récompenses.</p></div>`}

  function capsules(){const d=state.data;return `<div class="ki-card"><h4>Capsules mensuelles</h4><p class="ki-muted">Un instantané synthétique de ton mois. Les données sources restent dans leurs modules d'origine.</p><button class="ki-btn primary" id="kiCreateCapsule">Créer la capsule ${monthKey()}</button></div><div class="ki-list" style="margin-top:12px">${(d.capsules||[]).length?(d.capsules||[]).map(x=>`<div class="ki-item"><div class="ki-row"><b>${esc(x.period_key)}</b><span class="ki-badge">${esc(x.status||"créée")}</span></div><p class="ki-muted">${esc(x.summary||"")}</p></div>`).join(""):`<div class="ki-empty">Aucune capsule créée.</div>`}</div>`}

  function twin(){const m=metrics(),d=state.data;let msg="Ton jumeau numérique est en phase d'apprentissage.";if(m.consistency>75)msg="Tu traverses une période très régulière par rapport à tes propres habitudes.";else if(m.consistency<30)msg="Ta régularité récente est inférieure à ton rythme habituel. Le contexte de vie peut aider à comprendre pourquoi.";return `<div class="ki-card"><div class="ki-row"><div><h4>Jumeau numérique personnel</h4><p class="ki-muted">Il te compare uniquement à ton historique.</p></div><div class="ki-kpi">${m.consistency}%</div></div><div class="ki-note" style="margin-top:12px">${msg}</div></div><div class="ki-grid" style="margin-top:12px"><div class="ki-card"><h4>Données apprises</h4><div class="ki-kpi">${(d.workouts?.length||0)+(d.habits?.length||0)+(d.nutrition?.length||0)}</div><p class="ki-muted">observations exploitables</p></div><div class="ki-card"><h4>Confiance actuelle</h4><div class="ki-kpi">${clamp(Math.round(((d.workouts?.length||0)+(d.habits?.length||0))/2),0,100)}%</div><p class="ki-muted">augmente avec la durée et la qualité des données</p></div></div>`}

  async function upsert(table,row,onConflict){const r=await sb().from(table).upsert(row,{onConflict});if(r.error)throw r.error;}
  function status(msg,err=false){const el=$("kiStatus");if(el){el.textContent=msg;el.style.color=err?"var(--err)":"var(--core)"}}

  function bind(){
    $("kiGenerateInsights")?.addEventListener("click",generateInsights);
    document.querySelectorAll("[data-start-mission]").forEach(b=>b.onclick=()=>startMission(b.dataset.startMission));
    document.querySelectorAll("[data-master-skill]").forEach(b=>b.onclick=()=>masterSkill(b.dataset.masterSkill));
    document.querySelectorAll("[data-muscle]").forEach(b=>b.onclick=()=>showMuscle(b.dataset.muscle));
    $("kiSaveEvent")?.addEventListener("click",saveEvent); $("kiCreateCapsule")?.addEventListener("click",createCapsule); $("kiCheckIn")?.addEventListener("click",checkIn);
    loadLiveCount();
  }

  async function startMission(id){try{await upsert("kpsul_user_missions",{user_id:state.user.id,mission_id:id,status:"active",progress:10,started_at:new Date().toISOString()},"user_id,mission_id");status("Mission activée.");await refresh();}catch(e){status("Impossible d'activer la mission : "+e.message,true)}}
  async function masterSkill(id){try{await upsert("kpsul_user_skills",{user_id:state.user.id,skill_id:id,mastered_at:new Date().toISOString()},"user_id,skill_id");await sb().from("kpsul_points_ledger").insert({user_id:state.user.id,points:15,reason:"Compétence acquise",source_type:"skill",source_id:id});status("Compétence validée : +15 points.");await refresh();}catch(e){status(e.message,true)}}
  function showMuscle(name){const rows=(state.data.workouts||[]).filter(x=>JSON.stringify(x).toLowerCase().includes(name.toLowerCase().split(" ")[0])).slice(0,10);$("kiMuscleDetail").innerHTML=`<h4>${esc(name)}</h4>${rows.length?rows.map(x=>`<div class="ki-item"><b>${esc(x.exercise_name||x.name||"Séance")}</b><div class="ki-muted">${fmtDate(x.created_at||x.date)}</div></div>`).join(""):`<p class="ki-muted">Aucune donnée liée. La carte se remplira depuis les séances existantes.</p>`}`}
  async function saveEvent(){try{const title=$("kiEventTitle").value.trim();if(!title)throw new Error("Ajoute un titre.");await sb().from("kpsul_life_events").insert({user_id:state.user.id,title,event_type:$("kiEventType").value,starts_on:$("kiEventStart").value,ends_on:$("kiEventEnd").value,notes:$("kiEventNote").value});status("Événement ajouté au contexte de vie.");await refresh();}catch(e){status(e.message,true)}}
  async function checkIn(){try{await upsert("kpsul_live_presence",{user_id:state.user.id,presence_date:today(),last_seen_at:new Date().toISOString(),status:"training"},"user_id,presence_date");status("Présence enregistrée. Bonne séance !");loadLiveCount();}catch(e){status(e.message,true)}}
  async function loadLiveCount(){if(!$("kiLiveCount")||!sb())return;try{const {count}=await sb().from("kpsul_live_presence").select("id",{count:"exact",head:true}).eq("presence_date",today());$("kiLiveCount").textContent=count??0;}catch(_){}}
  async function createCapsule(){try{const m=metrics(),d=state.data;const summary=`${m.workouts30} entrées d'entraînement, ${d.nutrition?.length||0} entrées nutrition, ${d.habits?.length||0} habitudes suivies, régularité estimée ${m.consistency}%.`;await upsert("kpsul_capsules",{user_id:state.user.id,period_key:monthKey(),summary,snapshot:{metrics:m,counts:{programs:d.programs?.length||0,documents:d.documents?.length||0,measurements:d.measurements?.length||0}},status:"generated"},"user_id,period_key");status("Capsule mensuelle créée.");await refresh();}catch(e){status(e.message,true)}}
  async function generateInsights(){try{const d=state.data,m=metrics();const candidates=[];if((d.habits?.length||0)>=5)candidates.push({title:"Régularité récente",summary:`Ton indice de régularité estimé est de ${m.consistency} %. Cette observation décrit ton historique récent et doit être interprétée avec ton contexte de vie.`,confidence:.65});if((d.workouts?.length||0)>=8)candidates.push({title:"Volume d'entraînement observable",summary:`Kpsul dispose de ${d.workouts.length} entrées d'entraînement pour repérer progressivement tes tendances personnelles.`,confidence:.7});if(!candidates.length)throw new Error("Pas encore assez de données pour produire une observation fiable.");for(const x of candidates)await sb().from("kpsul_insights").insert({...x,user_id:state.user.id,insight_type:"personal_trend",evidence:{workouts:d.workouts?.length||0,habits:d.habits?.length||0}});status("Analyse terminée.");await refresh();}catch(e){status(e.message,true)}}

  async function refresh(){
    inject(); if(!sb()){status("Supabase n'est pas encore disponible.",true);return;}
    const data=await load(); if(!data){status("Connecte-toi pour ouvrir Kpsul Infinity.",true);return;} render();
  }

  document.addEventListener("DOMContentLoaded",()=>{inject();setTimeout(refresh,900)});
  window.addEventListener("load",()=>setTimeout(()=>{inject();},300));
  window.KpsulInfinity={open:openPanel,refresh};
})();
