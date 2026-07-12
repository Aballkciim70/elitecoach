/* ============================================================
   KPSUL SCORE V2 — quotidien, historique, fiabilité et tendances
   Fichier autonome. Nécessite window.sb (client Supabase).
   ============================================================ */
(() => {
  "use strict";

  const METRICS = [
    { key:"strength", label:"Progression de force", icon:"💪", weight:15, help:"Évolution des charges, répétitions et records." },
    { key:"body", label:"Évolution corporelle", icon:"📏", weight:15, help:"Poids, mensurations, composition et photos." },
    { key:"adherence", label:"Respect du programme", icon:"📈", weight:10, help:"Part des séances prévues réellement effectuées." },
    { key:"session_quality", label:"Qualité des séances", icon:"⏱️", weight:5, help:"Durée utile, séries complètes, tempo et exécution." },
    { key:"hydration", label:"Hydratation", icon:"💧", weight:5, help:"Quantité d’eau par rapport à l’objectif du jour." },
    { key:"activity", label:"Activité quotidienne", icon:"🚶", weight:5, help:"Pas et activité générale hors entraînement." },
    { key:"cardio", label:"Cardio", icon:"❤️", weight:5, help:"Course, vélo, rameur ou marche rapide." },
    { key:"sleep", label:"Qualité du sommeil", icon:"😴", weight:10, help:"Durée, réveils et sensation de récupération." },
    { key:"streak", label:"Régularité longue durée", icon:"🔥", weight:5, help:"Continuité du suivi et jours actifs consécutifs." },
    { key:"knowledge", label:"Connaissances", icon:"🧠", weight:5, help:"Quiz, cartes scientifiques et compréhension." },
    { key:"nutrition", label:"Nutrition", icon:"🍽️", weight:10, help:"Régularité et qualité du suivi alimentaire." },
    { key:"feeling", label:"Ressenti", icon:"🙂", weight:5, help:"Énergie, motivation et état général." },
    { key:"goal", label:"Avancement objectif", icon:"🎯", weight:5, help:"Progression vers l’objectif fixé avec le coach." }
  ];

  const INPUT_TABLE = "kpsul_score_inputs";
  const DAILY_TABLE = "kpsul_score_daily";
  const today = () => new Date().toISOString().slice(0, 10);
  const clamp = v => Math.max(0, Math.min(100, Number(v)));
  const esc = v => String(v ?? "").replace(/[&<>"']/g, s => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[s]));

  let currentUser = null;
  let historyRows = [];
  let activeRange = 30;

  function injectStyles(){
    if(document.getElementById("kpsulScoreV2Styles")) return;
    const style = document.createElement("style");
    style.id = "kpsulScoreV2Styles";
    style.textContent = `
      .ks2-shell{display:grid;gap:16px}
      .ks2-hero{border:1px solid rgba(52,224,200,.38);border-radius:22px;padding:20px;background:radial-gradient(circle at top right,rgba(52,224,200,.14),transparent 42%),rgba(52,224,200,.035)}
      .ks2-top{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap}
      .ks2-score{font-family:var(--disp);font-size:clamp(58px,14vw,94px);line-height:1;color:var(--core);letter-spacing:-.06em}
      .ks2-confidence{border:1px solid var(--line);border-radius:999px;padding:8px 12px;font-family:var(--mono);font-size:11px}
      .ks2-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin-top:16px}
      .ks2-stat{border:1px solid var(--line);border-radius:14px;padding:12px;background:rgba(4,10,9,.34)}
      .ks2-stat b{display:block;font-family:var(--disp);font-size:20px;color:var(--paper)}
      .ks2-stat span{font-size:11px;color:var(--muted)}
      .ks2-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
      .ks2-card{border:1px solid var(--line);border-radius:16px;padding:14px;background:rgba(255,255,255,.025)}
      .ks2-card-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}
      .ks2-card b{font-family:var(--disp);font-size:16px}
      .ks2-card small{display:block;color:var(--muted);margin-top:3px;line-height:1.35}
      .ks2-value{font-family:var(--disp);font-size:22px;white-space:nowrap}
      .ks2-trend{font-family:var(--mono);font-size:10px;margin-top:6px}
      .ks2-trend.up{color:var(--core)} .ks2-trend.down{color:var(--err)} .ks2-trend.flat{color:var(--muted)}
      .ks2-bar{height:7px;border:1px solid var(--line);border-radius:999px;overflow:hidden;margin-top:10px;background:#07110f}
      .ks2-bar span{display:block;height:100%;background:var(--core);border-radius:inherit}
      .ks2-panel{border:1px solid var(--line);border-radius:20px;padding:18px;background:var(--ink-900)}
      .ks2-panel h4{font-family:var(--disp);font-size:20px;margin-bottom:6px}
      .ks2-panel>p{color:var(--muted);font-size:13px;margin-bottom:14px}
      .ks2-form{display:grid;gap:12px}
      .ks2-field{border:1px solid var(--line);border-radius:15px;padding:12px;background:rgba(255,255,255,.025)}
      .ks2-field-top{display:flex;justify-content:space-between;gap:10px;align-items:center}
      .ks2-field label{font-size:14px;font-weight:600}
      .ks2-field output{font-family:var(--mono);color:var(--core)}
      .ks2-field input[type=range]{padding:0;margin-top:10px;accent-color:var(--core)}
      .ks2-null{display:flex;align-items:center;gap:8px;margin-top:8px;color:var(--muted);font-size:12px}
      .ks2-null input{width:18px;height:18px}
      .ks2-actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:14px}
      .ks2-range{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:12px}
      .ks2-range button{border:1px solid var(--line);background:transparent;color:var(--muted);padding:7px 10px;border-radius:999px;font-family:var(--mono);font-size:10px;cursor:pointer}
      .ks2-range button.active{background:var(--core);color:#04110E;border-color:var(--core)}
      .ks2-chart{width:100%;height:230px;border:1px solid var(--line);border-radius:16px;background:rgba(4,10,9,.34);overflow:hidden}
      .ks2-chart svg{width:100%;height:100%;display:block}
      .ks2-status{min-height:20px;color:var(--core);font-size:13px;margin-top:10px}
      .ks2-note{border:1px dashed var(--line);border-radius:14px;padding:12px;color:var(--muted);font-size:12.5px}
      @media(max-width:700px){
        .ks2-summary{grid-template-columns:1fr 1fr}
        .ks2-grid{grid-template-columns:1fr}
      }
    `;
    document.head.appendChild(style);
  }

  function panelHTML(){
    return `
      <div class="tool-panel">
        <div class="ks2-shell">
          <div class="ks2-hero">
            <div class="ks2-top">
              <div>
                <div class="eyebrow">Indice quotidien</div>
                <h3 style="font-size:26px;margin:8px 0 4px">💊 Kpsul Score</h3>
                <p style="color:var(--muted);font-size:14px">Le score recommence chaque jour, mais chaque journée reste enregistrée dans ton historique.</p>
              </div>
              <div class="ks2-confidence" id="ks2Confidence">Fiabilité —</div>
            </div>
            <div style="display:flex;align-items:flex-end;gap:16px;flex-wrap:wrap;margin-top:18px">
              <div class="ks2-score" id="ks2Global">—%</div>
              <div style="padding-bottom:9px">
                <b id="ks2TrendLabel">Pas encore de tendance</b>
                <div style="color:var(--muted);font-size:13px" id="ks2DateLabel"></div>
              </div>
            </div>
            <div class="ks2-summary">
              <div class="ks2-stat"><b id="ks2MonthAvg">—%</b><span>Moyenne du mois</span></div>
              <div class="ks2-stat"><b id="ks2Best">—%</b><span>Meilleur jour</span></div>
              <div class="ks2-stat"><b id="ks2Lowest">—%</b><span>Jour le plus faible</span></div>
              <div class="ks2-stat"><b id="ks2Days">0</b><span>Jours enregistrés</span></div>
            </div>
          </div>

          <div class="ks2-grid" id="ks2MetricCards"></div>

          <div class="ks2-panel">
            <h4>Renseigner le score du jour</h4>
            <p>Décoche « donnée disponible » lorsque tu n’as pas assez d’information. Elle ne pénalisera pas le score, mais réduira sa fiabilité.</p>
            <div class="ks2-form" id="ks2Form"></div>
            <textarea id="ks2Notes" placeholder="Note du jour : performance, douleur, événement particulier..." style="margin-top:12px"></textarea>
            <div class="ks2-actions">
              <button class="btn btn-primary" id="ks2Save" type="button">Enregistrer aujourd’hui</button>
              <button class="btn btn-ghost" id="ks2Import" type="button">Importer mes données du jour</button>
              <button class="btn btn-ghost" id="ks2Recalculate" type="button">Recalculer</button>
            </div>
            <div class="ks2-status" id="ks2Status"></div>
          </div>

          <div class="ks2-panel">
            <h4>Courbe d’évolution</h4>
            <p>Le score mensuel est une moyenne des journées enregistrées, jamais une addition de pourcentages.</p>
            <div class="ks2-range">
              <button data-range="7">7 jours</button>
              <button data-range="30" class="active">30 jours</button>
              <button data-range="90">3 mois</button>
              <button data-range="365">1 an</button>
            </div>
            <div class="ks2-chart" id="ks2Chart"></div>
          </div>

          <div class="ks2-note">
            Le Kpsul Score est un outil de suivi et de motivation. Il ne constitue ni un diagnostic médical ni une mesure directe de santé.
          </div>
        </div>
      </div>
    `;
  }

  function ensurePanel(){
    injectStyles();
    let panel = document.getElementById("modKpsulIndex");
    if(!panel){
      panel = document.createElement("div");
      panel.className = "module-panel";
      panel.id = "modKpsulIndex";
      const tools = document.getElementById("memberTools");
      if(tools) tools.prepend(panel);
    }
    panel.innerHTML = panelHTML();
    renderForm();
    bindEvents();
  }

  function renderForm(){
    const form = document.getElementById("ks2Form");
    if(!form) return;
    form.innerHTML = METRICS.map(m => `
      <div class="ks2-field" data-field="${m.key}">
        <div class="ks2-field-top">
          <label for="ks2_${m.key}">${m.icon} ${esc(m.label)} <small style="color:var(--muted)">(${m.weight} %)</small></label>
          <output id="ks2_${m.key}_out">50 %</output>
        </div>
        <input id="ks2_${m.key}" type="range" min="0" max="100" step="1" value="50">
        <label class="ks2-null">
          <input id="ks2_${m.key}_available" type="checkbox">
          Donnée disponible aujourd’hui
        </label>
      </div>
    `).join("");

    METRICS.forEach(m => {
      const input = document.getElementById(`ks2_${m.key}`);
      const out = document.getElementById(`ks2_${m.key}_out`);
      input?.addEventListener("input", () => {
        if(out) out.textContent = `${input.value} %`;
        previewFromForm();
      });
      document.getElementById(`ks2_${m.key}_available`)?.addEventListener("change", previewFromForm);
    });
  }

  function getFormValues(){
    const values = {};
    METRICS.forEach(m => {
      const available = document.getElementById(`ks2_${m.key}_available`)?.checked;
      values[m.key] = available ? clamp(document.getElementById(`ks2_${m.key}`)?.value || 0) : null;
    });
    return values;
  }

  function setFormValues(row = {}){
    METRICS.forEach(m => {
      const value = row[`${m.key}_score`];
      const available = value !== null && value !== undefined;
      const input = document.getElementById(`ks2_${m.key}`);
      const check = document.getElementById(`ks2_${m.key}_available`);
      const out = document.getElementById(`ks2_${m.key}_out`);
      if(input) input.value = available ? clamp(value) : 50;
      if(check) check.checked = available;
      if(out) out.textContent = `${available ? Math.round(value) : 50} %`;
    });
    const notes = document.getElementById("ks2Notes");
    if(notes) notes.value = row.notes || "";
  }

  function calculate(values){
    let weighted = 0;
    let availableWeight = 0;
    METRICS.forEach(m => {
      const v = values[m.key];
      if(v !== null && v !== undefined && Number.isFinite(Number(v))){
        weighted += clamp(v) * m.weight;
        availableWeight += m.weight;
      }
    });
    return {
      global: availableWeight ? Math.round(weighted / availableWeight) : 0,
      confidence: Math.round(availableWeight)
    };
  }

  function previewFromForm(){
    const values = getFormValues();
    const result = calculate(values);
    updateMainNumbers(result.global, result.confidence);
    renderMetricCards(values, {});
  }

  function updateMainNumbers(global, confidence){
    const score = document.getElementById("ks2Global");
    const conf = document.getElementById("ks2Confidence");
    if(score) score.textContent = `${Math.round(global)}%`;
    if(conf){
      const label = confidence >= 80 ? "Très fiable" : confidence >= 50 ? "Fiabilité moyenne" : "Peu fiable";
      conf.textContent = `${label} · ${Math.round(confidence)} %`;
    }
    const date = document.getElementById("ks2DateLabel");
    if(date) date.textContent = new Intl.DateTimeFormat("fr-FR", {dateStyle:"full"}).format(new Date());
  }

  function renderMetricCards(values, trends){
    const box = document.getElementById("ks2MetricCards");
    if(!box) return;
    box.innerHTML = METRICS.map(m => {
      const val = values[m.key];
      const t = trends[m.key];
      let trendText = "Pas assez d’historique";
      let cls = "flat";
      if(Number.isFinite(t)){
        if(t > 1){ trendText = `▲ +${Math.round(t)} % sur 7 jours`; cls = "up"; }
        else if(t < -1){ trendText = `▼ ${Math.round(t)} % sur 7 jours`; cls = "down"; }
        else trendText = "→ Stable sur 7 jours";
      }
      return `
        <div class="ks2-card">
          <div class="ks2-card-head">
            <div><b>${m.icon} ${esc(m.label)}</b><small>${esc(m.help)}</small></div>
            <div class="ks2-value">${val === null || val === undefined ? "—" : Math.round(val)+"%"}</div>
          </div>
          <div class="ks2-bar"><span style="width:${val === null || val === undefined ? 0 : clamp(val)}%"></span></div>
          <div class="ks2-trend ${cls}">${trendText}</div>
        </div>
      `;
    }).join("");
  }

  async function getSession(){
    if(!window.sb) throw new Error("Supabase n’est pas disponible.");
    const { data, error } = await window.sb.auth.getSession();
    if(error) throw error;
    currentUser = data?.session?.user || null;
    if(!currentUser) throw new Error("Connecte-toi pour utiliser le Kpsul Score.");
    return currentUser;
  }

  function rowToValues(row){
    const values = {};
    METRICS.forEach(m => values[m.key] = row?.[`${m.key}_score`] ?? null);
    return values;
  }

  async function loadToday(){
    await getSession();
    const { data, error } = await window.sb
      .from(INPUT_TABLE)
      .select("*")
      .eq("user_id", currentUser.id)
      .eq("score_date", today())
      .maybeSingle();
    if(error) throw error;
    setFormValues(data || {});
    const values = rowToValues(data || {});
    const calc = calculate(values);
    updateMainNumbers(calc.global, calc.confidence);
    return { values, calc };
  }

  async function loadHistory(){
    await getSession();
    const from = new Date();
    from.setDate(from.getDate() - 370);
    const { data, error } = await window.sb
      .from(DAILY_TABLE)
      .select("*")
      .eq("user_id", currentUser.id)
      .gte("score_date", from.toISOString().slice(0,10))
      .order("score_date", { ascending:true });
    if(error) throw error;
    historyRows = data || [];
    renderStats();
    renderChart(activeRange);
    return historyRows;
  }

  function average(rows, column){
    const vals = rows.map(r => Number(r[column])).filter(Number.isFinite);
    return vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : null;
  }

  function metricTrends(){
    const now = new Date();
    const d7 = new Date(now); d7.setDate(now.getDate()-6);
    const d14 = new Date(now); d14.setDate(now.getDate()-13);
    const recent = historyRows.filter(r => new Date(r.score_date+"T12:00:00") >= d7);
    const previous = historyRows.filter(r => {
      const d = new Date(r.score_date+"T12:00:00");
      return d >= d14 && d < d7;
    });
    const trends = {};
    METRICS.forEach(m => {
      const a = average(recent, `${m.key}_score`);
      const b = average(previous, `${m.key}_score`);
      trends[m.key] = a === null || b === null ? NaN : a-b;
    });
    return trends;
  }

  function renderStats(){
    const monthKey = today().slice(0,7);
    const monthRows = historyRows.filter(r => String(r.score_date).startsWith(monthKey));
    const vals = monthRows.map(r=>Number(r.global_score)).filter(Number.isFinite);
    const avg = vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : null;
    const best = vals.length ? Math.max(...vals) : null;
    const low = vals.length ? Math.min(...vals) : null;
    const set = (id,v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
    set("ks2MonthAvg", avg===null ? "—%" : `${Math.round(avg)}%`);
    set("ks2Best", best===null ? "—%" : `${Math.round(best)}%`);
    set("ks2Lowest", low===null ? "—%" : `${Math.round(low)}%`);
    set("ks2Days", String(monthRows.length));

    const last = historyRows.at(-1);
    const prev = historyRows.at(-2);
    const label = document.getElementById("ks2TrendLabel");
    if(label){
      if(!last || !prev) label.textContent = "Pas encore de tendance";
      else {
        const delta = Number(last.global_score)-Number(prev.global_score);
        label.textContent = delta > 0 ? `▲ +${Math.round(delta)} % depuis hier`
          : delta < 0 ? `▼ ${Math.round(delta)} % depuis hier`
          : "→ Stable depuis hier";
      }
    }
    if(last){
      updateMainNumbers(last.global_score, last.confidence_score);
      renderMetricCards(rowToValues(last), metricTrends());
    }
  }

  function renderChart(days){
    const target = document.getElementById("ks2Chart");
    if(!target) return;
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - (days-1));
    const rows = historyRows.filter(r => new Date(r.score_date+"T12:00:00") >= cutoff);
    if(!rows.length){
      target.innerHTML = `<div style="display:grid;place-items:center;height:100%;color:var(--muted)">Aucun historique sur cette période.</div>`;
      return;
    }
    const W=760,H=230,P=34;
    const x = i => P + (rows.length===1 ? (W-2*P)/2 : i*(W-2*P)/(rows.length-1));
    const y = v => H-P-(clamp(v)*(H-2*P)/100);
    const points = rows.map((r,i)=>`${x(i)},${y(r.global_score)}`).join(" ");
    const area = `${P},${H-P} ${points} ${x(rows.length-1)},${H-P}`;
    const labels = rows.map((r,i) => {
      if(rows.length > 12 && i % Math.ceil(rows.length/6) !== 0 && i !== rows.length-1) return "";
      const d = new Date(r.score_date+"T12:00:00");
      return `<text x="${x(i)}" y="${H-10}" fill="#8A9A93" font-size="10" text-anchor="middle">${d.toLocaleDateString("fr-FR",{day:"2-digit",month:"2-digit"})}</text>`;
    }).join("");
    target.innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Courbe Kpsul Score">
        <defs>
          <linearGradient id="ks2Area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#34E0C8" stop-opacity=".32"/>
            <stop offset="1" stop-color="#34E0C8" stop-opacity="0"/>
          </linearGradient>
        </defs>
        ${[0,25,50,75,100].map(v=>`
          <line x1="${P}" y1="${y(v)}" x2="${W-P}" y2="${y(v)}" stroke="#22403A" stroke-width="1"/>
          <text x="${P-8}" y="${y(v)+4}" fill="#8A9A93" font-size="10" text-anchor="end">${v}</text>
        `).join("")}
        <polygon points="${area}" fill="url(#ks2Area)"/>
        <polyline points="${points}" fill="none" stroke="#34E0C8" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
        ${rows.map((r,i)=>`<circle cx="${x(i)}" cy="${y(r.global_score)}" r="4" fill="#0B1413" stroke="#34E0C8" stroke-width="2"><title>${r.score_date} : ${Math.round(r.global_score)} %</title></circle>`).join("")}
        ${labels}
      </svg>
    `;
  }

  async function saveToday(){
    const status = document.getElementById("ks2Status");
    try{
      if(status) status.textContent = "Enregistrement…";
      await getSession();
      const values = getFormValues();
      const calc = calculate(values);
      const inputPayload = {
        user_id: currentUser.id,
        score_date: today(),
        notes: document.getElementById("ks2Notes")?.value.trim() || null,
        updated_at: new Date().toISOString()
      };
      METRICS.forEach(m => inputPayload[`${m.key}_score`] = values[m.key]);
      const { error: inputError } = await window.sb
        .from(INPUT_TABLE)
        .upsert(inputPayload, { onConflict:"user_id,score_date" });
      if(inputError) throw inputError;

      const dailyPayload = {
        ...inputPayload,
        global_score: calc.global,
        confidence_score: calc.confidence,
        calculated_at: new Date().toISOString()
      };
      const { error: dailyError } = await window.sb
        .from(DAILY_TABLE)
        .upsert(dailyPayload, { onConflict:"user_id,score_date" });
      if(dailyError) throw dailyError;

      if(status) status.textContent = `Score du jour enregistré : ${calc.global} % · fiabilité ${calc.confidence} %.`;
      await loadHistory();
    }catch(err){
      console.error("Kpsul Score save:", err);
      if(status) status.textContent = `Erreur : ${err.message || err}`;
    }
  }

  async function importToday(){
    const status = document.getElementById("ks2Status");
    try{
      if(status) status.textContent = "Import des données du jour…";
      await getSession();
      const date = today();
      const [habitsRes, foodRes, workoutRes] = await Promise.all([
        window.sb.from("habit_logs").select("*").eq("user_id",currentUser.id).eq("log_date",date).order("created_at",{ascending:false}).limit(1),
        window.sb.from("nutrition_logs").select("*").eq("user_id",currentUser.id).eq("log_date",date),
        window.sb.from("workout_exercise_logs").select("*").eq("user_id",currentUser.id).eq("log_date",date)
      ]);

      const habit = habitsRes.data?.[0] || {};
      const foods = foodRes.data || [];
      const workouts = workoutRes.data || [];
      const apply = (key,value) => {
        if(value === null || value === undefined || !Number.isFinite(Number(value))) return;
        const input=document.getElementById(`ks2_${key}`);
        const check=document.getElementById(`ks2_${key}_available`);
        const out=document.getElementById(`ks2_${key}_out`);
        const v=clamp(value);
        if(input) input.value=v;
        if(check) check.checked=true;
        if(out) out.textContent=`${Math.round(v)} %`;
      };

      const sleepHours = Number(habit.sleep_hours ?? habit.sleep ?? NaN);
      if(Number.isFinite(sleepHours)) apply("sleep", Math.min(100, (sleepHours/8)*100));

      const water = Number(habit.water_liters ?? habit.water ?? NaN);
      if(Number.isFinite(water)) apply("hydration", Math.min(100, (water/2.5)*100));

      const steps = Number(habit.steps ?? NaN);
      if(Number.isFinite(steps)) apply("activity", Math.min(100, (steps/10000)*100));

      const energy = Number(habit.energy ?? NaN);
      if(Number.isFinite(energy)) apply("feeling", energy <= 10 ? energy*10 : energy);

      if(foods.length) apply("nutrition", Math.min(100, 35 + foods.length*20));
      if(workouts.length){
        apply("adherence", 100);
        apply("session_quality", Math.min(100, 55 + workouts.length*5));
      }

      previewFromForm();
      if(status) status.textContent = "Données disponibles importées. Vérifie puis enregistre.";
    }catch(err){
      console.error("Kpsul Score import:", err);
      if(status) status.textContent = "Import partiel impossible. Tu peux remplir les critères manuellement.";
    }
  }

  function bindEvents(){
    document.getElementById("ks2Save")?.addEventListener("click", saveToday);
    document.getElementById("ks2Recalculate")?.addEventListener("click", previewFromForm);
    document.getElementById("ks2Import")?.addEventListener("click", importToday);
    document.querySelectorAll(".ks2-range button").forEach(btn => btn.addEventListener("click", () => {
      activeRange = Number(btn.dataset.range || 30);
      document.querySelectorAll(".ks2-range button").forEach(b=>b.classList.toggle("active",b===btn));
      renderChart(activeRange);
    }));
  }

  async function initData(){
    const status = document.getElementById("ks2Status");
    try{
      if(status) status.textContent = "Chargement du Kpsul Score…";
      const { values, calc } = await loadToday();
      await loadHistory();
      if(!historyRows.length){
        updateMainNumbers(calc.global, calc.confidence);
        renderMetricCards(values, {});
      }
      if(status) status.textContent = "";
    }catch(err){
      console.error("Kpsul Score init:", err);
      if(status) status.textContent = `Configuration requise : ${err.message || err}`;
    }
  }

  function openScoreModule(){
    ensurePanel();

    document.querySelectorAll("#member .module-panel").forEach(panel => {
      panel.classList.remove("active");
    });

    const scorePanel = document.getElementById("modKpsulIndex");
    if(!scorePanel) return;

    scorePanel.classList.add("active");
    document.body.classList.add("kpsul-panel-open");

    setTimeout(() => {
      initData();
      scorePanel.scrollIntoView({
        block: "start",
        behavior: "smooth"
      });
    }, 60);
  }

  function watchOpen(){
    document.addEventListener("click", e => {
      const target = e.target.closest?.(
        '[data-goto="modKpsulIndex"],[data-module="modKpsulIndex"]'
      );

      if(!target) return;

      e.preventDefault();
      e.stopPropagation();
      openScoreModule();
    }, true);

    document.addEventListener("keydown", e => {
      if(e.key !== "Enter" && e.key !== " ") return;

      const target = e.target.closest?.(
        '[data-goto="modKpsulIndex"],[data-module="modKpsulIndex"]'
      );

      if(!target) return;

      e.preventDefault();
      openScoreModule();
    });
  }

  function start(){
    ensurePanel();
    watchOpen();

    window.KpsulScoreV2 = {
      open: openScoreModule,
      refresh: initData
    };

    if(document.body.classList.contains("authed")) initData();
    window.addEventListener("kpsul:session-ready", initData);
  }

  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
