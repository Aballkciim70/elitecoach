/* KPSUL — TRACKING UX (séances, nutrition, habitudes) */
(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));
  const sb = () => window.sb || null;
  const safe = v => String(v ?? "").replace(/[&<>"']/g, s =>
    ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[s]));
  const today = () => new Date().toISOString().slice(0, 10);
  const fmtDate = d => { try { return new Date(d).toLocaleDateString("fr-FR"); } catch(e) { return d || ""; } };
  const round1 = n => Math.round(Number(n || 0) * 10) / 10;
  const sum = (arr, key) => arr.reduce((a, b) => a + Number(b[key] || 0), 0);

  /* ─── STYLE ────────────────────────────────────────────────── */
  function injectStyle() {
    if ($("ktrackStyle")) return;
    const st = document.createElement("style");
    st.id = "ktrackStyle";
    st.textContent = `
      /* Formulaires tracking */
      .ktrack-form { display:grid; gap:10px; margin-bottom:18px }
      .ktrack-row  { display:grid; grid-template-columns:1fr 1fr; gap:10px }
      .ktrack-row.three { grid-template-columns:1fr 1fr 1fr }
      .ktrack-row.full  { grid-template-columns:1fr }

      /* Totaux nutrition */
      .ktrack-totals {
        display:grid; grid-template-columns:repeat(4,1fr); gap:8px;
        border:1px solid var(--line,#22403A); border-radius:14px;
        padding:14px; background:rgba(52,224,200,.06); margin-bottom:18px;
      }
      .ktrack-total-item { text-align:center }
      .ktrack-total-item b { display:block; font-family:var(--disp,system-ui);
        font-size:20px; color:var(--core,#34E0C8); line-height:1 }
      .ktrack-total-item span { display:block; color:#8A9A93; font-size:11px; margin-top:4px }

      /* Autocomplete exercice */
      .ktrack-autocomplete {
        position:relative;
      }
      .ktrack-ac-list {
        position:absolute; top:100%; left:0; right:0; z-index:100;
        background:var(--ink-800,#10201D); border:1px solid var(--core,#34E0C8);
        border-radius:0 0 12px 12px; max-height:220px; overflow-y:auto;
      }
      .ktrack-ac-item {
        padding:11px 14px; cursor:pointer; font-size:14px; border-bottom:1px solid var(--line,#22403A);
      }
      .ktrack-ac-item:last-child { border-bottom:none }
      .ktrack-ac-item:hover, .ktrack-ac-item.focused { background:var(--core-dim,rgba(52,224,200,.14)) }
      .ktrack-ac-item small { display:block; color:#8A9A93; font-size:11px; margin-top:2px }

      /* Historique */
      .ktrack-history { margin-top:20px }
      .ktrack-history h4 { font-family:var(--mono,monospace); font-size:11px;
        letter-spacing:.12em; text-transform:uppercase; color:var(--muted,#8A9A93);
        margin-bottom:10px }
      .ktrack-day { margin-bottom:16px }
      .ktrack-day-label { font-family:var(--mono,monospace); font-size:11px;
        color:var(--core,#34E0C8); letter-spacing:.08em; margin-bottom:7px }
      .ktrack-entry {
        border:1px solid var(--line,#22403A); border-radius:12px;
        background:rgba(255,255,255,.02); padding:12px 14px; margin-bottom:7px;
      }
      .ktrack-entry b { font-family:var(--disp,system-ui); font-size:15px }
      .ktrack-entry span { display:block; color:#8A9A93; font-size:13px; margin-top:3px }
      .ktrack-entry .ktrack-pills { display:flex; flex-wrap:wrap; gap:6px; margin-top:8px }
      .ktrack-pill { border:1px solid var(--line,#22403A); border-radius:99px;
        padding:3px 10px; font-size:12px; color:#C6D0CB }
      .ktrack-pill.green { border-color:rgba(52,224,200,.4); color:var(--core,#34E0C8) }
      .ktrack-del { float:right; background:none; border:none; color:#5E6E68;
        font-size:18px; cursor:pointer; line-height:1; padding:0 4px }
      .ktrack-del:hover { color:#E8735B }

      /* Bouton ajouter un autre */
      .ktrack-next { margin-top:8px; border:1px solid var(--line,#22403A);
        background:none; color:var(--paper,#ECEFE9); border-radius:99px;
        padding:9px 18px; font-size:14px; cursor:pointer; width:100% }
      .ktrack-next:hover { border-color:var(--core,#34E0C8); color:var(--core,#34E0C8) }

      /* Smiley niveaux */
      .ktrack-smileys { display:flex; gap:8px; flex-wrap:wrap }
      .ktrack-smiley { border:1px solid var(--line,#22403A); border-radius:99px;
        padding:7px 13px; font-size:15px; cursor:pointer; background:none; transition:.15s }
      .ktrack-smiley.active { border-color:var(--core,#34E0C8);
        background:var(--core-dim,rgba(52,224,200,.14)) }

      @media(max-width:560px){
        .ktrack-row.three { grid-template-columns:1fr 1fr }
        .ktrack-totals { grid-template-columns:1fr 1fr }
      }
    `;
    document.head.appendChild(st);
  }

  /* ─── MODULE SÉANCES ────────────────────────────────────────── */
  function enhanceSeances() {
    const panel = $("modProgress");
    if (!panel || panel.dataset.ktrackSeances) return;
    panel.dataset.ktrackSeances = "1";

    const tp = panel.querySelector(".tool-panel");
    if (!tp) return;

    // Remplacer le contenu existant
    tp.innerHTML = `
      <h3>📈 Mes séances</h3>
      <p>Enregistre chaque exercice : charge, séries et reps. Ton coach voit tout en temps réel.</p>

      <div id="kseanceDate" style="margin-bottom:14px">
        <input id="workoutDate" type="date" style="width:100%">
      </div>

      <div class="ktrack-form" id="kseanceForm">
        <div class="ktrack-autocomplete">
          <input id="exerciseName" placeholder="Exercice (ex: Développé couché)" autocomplete="off">
          <div class="ktrack-ac-list" id="kseanceAcList" style="display:none"></div>
        </div>
        <div class="ktrack-row three">
          <input id="exerciseSets"  type="number" min="1" placeholder="Séries">
          <input id="exerciseReps"  type="number" min="1" placeholder="Reps">
          <input id="exerciseLoad"  type="number" min="0" step="0.5" placeholder="Charge kg">
        </div>
        <div class="ktrack-row">
          <input id="exerciseRest"  type="number" min="0" placeholder="Repos (sec)">
          <input id="exerciseTempo" type="text"   placeholder="Tempo (ex: 3-1-2-0)">
        </div>
        <input id="exerciseNote" placeholder="Note : ressenti, douleur, PR...">
        <button class="btn btn-primary" id="saveExerciseBtn" type="button">Enregistrer cet exercice</button>
        <div class="tool-status" id="exerciseStatus"></div>
      </div>

      <div class="ktrack-history">
        <h4>Historique</h4>
        <div id="exerciseList"></div>
      </div>
    `;

    // Auto-date
    const wd = $("workoutDate");
    if (wd && !wd.value) wd.value = today();

    // Autocomplete
    hookExerciseAutocomplete();

    // Save
    $("saveExerciseBtn")?.addEventListener("click", saveSeance);
  }

  let exLibraryCache = null;

  async function loadExLibrary() {
    if (exLibraryCache) return exLibraryCache;
    const client = sb(); if (!client) return [];
    try {
      const { data } = await client.from("exercise_library")
        .select("id,name,muscle_group,equipment,level").order("name");
      exLibraryCache = data || [];
      return exLibraryCache;
    } catch(e) { return []; }
  }

  function hookExerciseAutocomplete() {
    const input = $("exerciseName");
    const list  = $("kseanceAcList");
    if (!input || !list) return;
    let focusIdx = -1;

    input.addEventListener("input", async () => {
      const q = input.value.trim().toLowerCase();
      if (q.length < 2) { list.style.display = "none"; return; }
      const exos = await loadExLibrary();
      const matches = exos.filter(e => {
        const text = (e.name + " " + (e.muscle_group || "") + " " + (e.equipment || "")).toLowerCase();
        return q.split(" ").every(w => text.includes(w));
      }).slice(0, 8);

      if (!matches.length) { list.style.display = "none"; return; }
      focusIdx = -1;
      list.innerHTML = matches.map((e, i) => `
        <div class="ktrack-ac-item" data-idx="${i}" data-name="${safe(e.name)}">
          ${safe(e.name)}
          <small>${safe(e.muscle_group || "")} ${e.equipment ? "· " + safe(e.equipment) : ""}</small>
        </div>`).join("");
      list.style.display = "block";
      qsa(".ktrack-ac-item", list).forEach(item => {
        item.addEventListener("mousedown", e => {
          e.preventDefault();
          input.value = item.dataset.name;
          list.style.display = "none";
        });
      });
    });

    input.addEventListener("keydown", e => {
      const items = qsa(".ktrack-ac-item", list);
      if (!items.length) return;
      if (e.key === "ArrowDown") { e.preventDefault(); focusIdx = Math.min(focusIdx + 1, items.length - 1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); focusIdx = Math.max(focusIdx - 1, 0); }
      else if (e.key === "Enter" && focusIdx >= 0) {
        e.preventDefault();
        input.value = items[focusIdx].dataset.name;
        list.style.display = "none";
        focusIdx = -1;
        return;
      } else { return; }
      items.forEach((it, i) => it.classList.toggle("focused", i === focusIdx));
      if (focusIdx >= 0) items[focusIdx].scrollIntoView({ block: "nearest" });
    });

    document.addEventListener("click", e => {
      if (!input.contains(e.target) && !list.contains(e.target)) list.style.display = "none";
    });
  }

  async function saveSeance() {
    const client = sb(); if (!client) return;
    const name = $("exerciseName")?.value.trim();
    if (!name) { setStatus("exerciseStatus", "Renseigne le nom de l'exercice.", true); return; }
    const btn = $("saveExerciseBtn"); if(btn) btn.disabled = true;
    setStatus("exerciseStatus", "Enregistrement…");
    try {
      const { data: s } = await client.auth.getSession();
      const uid = s?.session?.user?.id; if (!uid) throw new Error("Non connecté");
      const { error } = await client.from("workout_exercise_logs").insert({
        user_id: uid,
        log_date:       $("workoutDate")?.value || today(),
        exercise_name:  name,
        sets:           Number($("exerciseSets")?.value  || 0),
        reps:           Number($("exerciseReps")?.value  || 0),
        load_kg:        Number($("exerciseLoad")?.value  || 0),
        rest_seconds:   Number($("exerciseRest")?.value  || 0) || null,
        tempo:          $("exerciseTempo")?.value.trim() || null,
        note:           $("exerciseNote")?.value.trim()  || null,
      });
      if (error) throw new Error(error.message);
      setStatus("exerciseStatus", `✔ ${name} enregistré — Ajouter le suivant ?`);
      // Garder la date, vider seulement les champs exercice
      ["exerciseName","exerciseSets","exerciseReps","exerciseLoad","exerciseRest","exerciseTempo","exerciseNote"]
        .forEach(id => { const el = $(id); if (el) el.value = ""; });
      $("exerciseName")?.focus();
      loadSeanceHistory();
      updateDashboardMetrics();
    } catch(e) {
      setStatus("exerciseStatus", "Erreur : " + e.message, true);
    } finally { if(btn) btn.disabled = false; }
  }

  async function loadSeanceHistory() {
    const client = sb(); const box = $("exerciseList");
    if (!client || !box) return;
    const { data: s } = await client.auth.getSession();
    const uid = s?.session?.user?.id; if (!uid) return;

    const { data } = await client.from("workout_exercise_logs")
      .select("*").eq("user_id", uid)
      .order("log_date", { ascending: false }).order("created_at", { ascending: false })
      .limit(30);

    if (!data?.length) {
      box.innerHTML = `<div class="ktrack-entry"><span>Pas encore de séance. Lance-toi !</span></div>`;
      return;
    }
    // Grouper par date
    const byDate = {};
    (data || []).forEach(e => {
      const d = e.log_date || e.created_at?.slice(0, 10) || "—";
      if (!byDate[d]) byDate[d] = [];
      byDate[d].push(e);
    });
    box.innerHTML = Object.entries(byDate).map(([date, rows]) => `
      <div class="ktrack-day">
        <div class="ktrack-day-label">${fmtDate(date)}</div>
        ${rows.map(e => `
          <div class="ktrack-entry">
            <button class="ktrack-del" data-del="${e.id}" data-table="workout_exercise_logs" title="Supprimer">×</button>
            <b>${safe(e.exercise_name)}</b>
            <div class="ktrack-pills">
              ${e.sets  ? `<span class="ktrack-pill">${e.sets} séries</span>` : ""}
              ${e.reps  ? `<span class="ktrack-pill">${e.reps} reps</span>` : ""}
              ${e.load_kg ? `<span class="ktrack-pill green">${e.load_kg} kg</span>` : ""}
              ${e.rest_seconds ? `<span class="ktrack-pill">${e.rest_seconds}s repos</span>` : ""}
              ${e.tempo ? `<span class="ktrack-pill">${safe(e.tempo)}</span>` : ""}
            </div>
            ${e.note ? `<span>${safe(e.note)}</span>` : ""}
          </div>`).join("")}
      </div>`).join("");
    hookDelButtons(box, loadSeanceHistory);
  }

  /* ─── MODULE NUTRITION ──────────────────────────────────────── */
  function enhanceNutrition() {
    const panel = $("modNutrition");
    if (!panel || panel.dataset.ktrackNutrition) return;
    panel.dataset.ktrackNutrition = "1";

    const tp = panel.querySelector(".tool-panel");
    if (!tp) return;

    tp.innerHTML = `
      <h3>🍽 Mon alimentation</h3>
      <p>Enregistre chaque repas. Ton coach suit tes apports et peut ajuster ta diet.</p>

      <div id="knutriTotals" class="ktrack-totals">
        <div class="ktrack-total-item"><b id="knutriKcal">—</b><span>kcal</span></div>
        <div class="ktrack-total-item"><b id="knutriProt">—</b><span>Protéines g</span></div>
        <div class="ktrack-total-item"><b id="knutriCarbs">—</b><span>Glucides g</span></div>
        <div class="ktrack-total-item"><b id="knutriFat">—</b><span>Lipides g</span></div>
      </div>
      <p style="text-align:center;color:#8A9A93;font-size:12px;margin:-10px 0 14px" id="knutriTotalsLabel">
        Total d'aujourd'hui
      </p>

      <div class="ktrack-form">
        <div class="ktrack-row">
          <input id="foodDate"     type="date">
          <input id="foodMeal"     placeholder="Repas : petit-déj, déjeuner…">
        </div>
        <div class="ktrack-row three">
          <input id="foodCalories" type="number" min="0" placeholder="kcal">
          <input id="foodProtein"  type="number" min="0" placeholder="Prot g">
          <input id="foodCarbs"    type="number" min="0" placeholder="Gluc g">
        </div>
        <div class="ktrack-row">
          <input id="foodFat"      type="number" min="0" placeholder="Lip g">
          <input id="foodContent"  placeholder="Contenu : riz, poulet…">
        </div>
        <button class="btn btn-primary" id="saveFoodBtn" type="button">Enregistrer ce repas</button>
        <div class="tool-status" id="foodStatus"></div>
      </div>

      <div class="ktrack-history">
        <h4>Historique</h4>
        <div id="foodList"></div>
      </div>
    `;

    const fd = $("foodDate");
    if (fd && !fd.value) fd.value = today();

    $("saveFoodBtn")?.addEventListener("click", saveRepas);
    loadNutritionHistory();
  }

  async function saveRepas() {
    const client = sb(); if (!client) return;
    const meal = $("foodMeal")?.value.trim();
    if (!meal) { setStatus("foodStatus", "Renseigne le nom du repas.", true); return; }
    const btn = $("saveFoodBtn"); if(btn) btn.disabled = true;
    setStatus("foodStatus", "Enregistrement…");
    try {
      const { data: s } = await client.auth.getSession();
      const uid = s?.session?.user?.id; if (!uid) throw new Error("Non connecté");
      const { error } = await client.from("nutrition_logs").insert({
        user_id:   uid,
        log_date:  $("foodDate")?.value || today(),
        meal_name: meal,
        calories:  Number($("foodCalories")?.value || 0) || null,
        protein_g: Number($("foodProtein")?.value  || 0) || null,
        carbs_g:   Number($("foodCarbs")?.value    || 0) || null,
        fat_g:     Number($("foodFat")?.value      || 0) || null,
        content:   $("foodContent")?.value.trim()  || null,
      });
      if (error) throw new Error(error.message);
      setStatus("foodStatus", "✔ Repas enregistré !");
      ["foodMeal","foodCalories","foodProtein","foodCarbs","foodFat","foodContent"]
        .forEach(id => { const el = $(id); if (el) el.value = ""; });
      $("foodMeal")?.focus();
      loadNutritionHistory();
      updateDashboardMetrics();
    } catch(e) {
      setStatus("foodStatus", "Erreur : " + e.message, true);
    } finally { if(btn) btn.disabled = false; }
  }

  async function loadNutritionHistory() {
    const client = sb(); const box = $("foodList");
    if (!client || !box) return;
    const { data: s } = await client.auth.getSession();
    const uid = s?.session?.user?.id; if (!uid) return;

    const { data } = await client.from("nutrition_logs")
      .select("*").eq("user_id", uid)
      .order("log_date", { ascending: false }).order("created_at", { ascending: false })
      .limit(30);

    if (!data?.length) {
      box.innerHTML = `<div class="ktrack-entry"><span>Pas encore de repas enregistré. Note ton premier repas ci-dessus.</span></div>`;
      updateNutritionTotals([]);
      return;
    }

    // Totaux du jour
    const todayStr = today();
    const todayItems = data.filter(f => (f.log_date || "").startsWith(todayStr));
    updateNutritionTotals(todayItems);

    // Historique groupé par date
    const byDate = {};
    data.forEach(f => {
      const d = f.log_date || f.created_at?.slice(0, 10) || "—";
      if (!byDate[d]) byDate[d] = [];
      byDate[d].push(f);
    });

    box.innerHTML = Object.entries(byDate).map(([date, rows]) => {
      const totalKcal = sum(rows, "calories");
      const totalProt = sum(rows, "protein_g");
      return `
        <div class="ktrack-day">
          <div class="ktrack-day-label">${fmtDate(date)}${totalKcal ? ` · ${round1(totalKcal)} kcal` : ""}</div>
          ${rows.map(f => `
            <div class="ktrack-entry">
              <button class="ktrack-del" data-del="${f.id}" data-table="nutrition_logs" title="Supprimer">×</button>
              <b>${safe(f.meal_name || "Repas")}</b>
              <div class="ktrack-pills">
                ${f.calories  ? `<span class="ktrack-pill green">${round1(f.calories)} kcal</span>` : ""}
                ${f.protein_g ? `<span class="ktrack-pill">${round1(f.protein_g)}g prot</span>` : ""}
                ${f.carbs_g   ? `<span class="ktrack-pill">${round1(f.carbs_g)}g gluc</span>` : ""}
                ${f.fat_g     ? `<span class="ktrack-pill">${round1(f.fat_g)}g lip</span>` : ""}
              </div>
              ${f.content ? `<span>${safe(f.content)}</span>` : ""}
            </div>`).join("")}
        </div>`;
    }).join("");
    hookDelButtons(box, loadNutritionHistory);
  }

  function updateNutritionTotals(items) {
    const kcal = $("knutriKcal"), prot = $("knutriProt"),
          carbs = $("knutriCarbs"), fat = $("knutriFat");
    if (kcal) kcal.textContent = items.length ? round1(sum(items, "calories"))  : "—";
    if (prot) prot.textContent = items.length ? round1(sum(items, "protein_g")) : "—";
    if (carbs) carbs.textContent = items.length ? round1(sum(items, "carbs_g")) : "—";
    if (fat)  fat.textContent  = items.length ? round1(sum(items, "fat_g"))    : "—";
  }

  /* ─── MODULE HABITUDES ──────────────────────────────────────── */
  const STRESS_OPTS  = ["😌 Faible","😐 Moyen","😤 Élevé","🔥 Très élevé"];
  const ENERGY_OPTS  = ["🪫 Basse","😐 Moyenne","⚡ Bonne","🚀 Excellente"];

  function enhanceHabitudes() {
    const panel = $("modHabits");
    if (!panel || panel.dataset.ktrackHabits) return;
    panel.dataset.ktrackHabits = "1";

    const tp = panel.querySelector(".tool-panel");
    if (!tp) return;

    tp.innerHTML = `
      <h3>😴 Mes habitudes du jour</h3>
      <p>Quelques secondes chaque matin. Ces données entrent dans ton score Kpsul et aident ton coach à ajuster.</p>

      <div class="ktrack-form">
        <input id="habitDate" type="date" style="width:100%">
        <div class="ktrack-row">
          <div>
            <label style="font-size:12px;color:#8A9A93;display:block;margin-bottom:5px">😴 Sommeil (heures)</label>
            <input id="sleepHours" type="number" step="0.5" min="0" max="24" placeholder="ex: 7.5">
          </div>
          <div>
            <label style="font-size:12px;color:#8A9A93;display:block;margin-bottom:5px">💧 Eau (litres)</label>
            <input id="waterLiters" type="number" step="0.1" min="0" placeholder="ex: 2.5">
          </div>
        </div>
        <div>
          <label style="font-size:12px;color:#8A9A93;display:block;margin-bottom:8px">⚡ Niveau d'énergie</label>
          <div class="ktrack-smileys" id="kEnergySmileys">
            ${ENERGY_OPTS.map((o, i) => `<button class="ktrack-smiley" data-energy="${o}" type="button">${o}</button>`).join("")}
          </div>
          <input type="hidden" id="energyLevel">
        </div>
        <div>
          <label style="font-size:12px;color:#8A9A93;display:block;margin-bottom:8px">🧠 Niveau de stress</label>
          <div class="ktrack-smileys" id="kStressSmileys">
            ${STRESS_OPTS.map((o, i) => `<button class="ktrack-smiley" data-stress="${o}" type="button">${o}</button>`).join("")}
          </div>
          <input type="hidden" id="stressLevel">
        </div>
        <div>
          <label style="font-size:12px;color:#8A9A93;display:block;margin-bottom:5px">👟 Pas (optionnel)</label>
          <input id="stepsCount" type="number" min="0" placeholder="ex: 8000">
        </div>
        <input id="digestion" placeholder="Digestion : bonne, lourde, ballonnements… (optionnel)">
        <button class="btn btn-primary" id="saveHabitBtn" type="button">Enregistrer ma journée</button>
        <div class="tool-status" id="habitStatus"></div>
      </div>

      <div class="ktrack-history">
        <h4>Historique</h4>
        <div id="habitList"></div>
      </div>
    `;

    const hd = $("habitDate");
    if (hd && !hd.value) hd.value = today();

    // Smiley selectors
    qsa("[data-energy]").forEach(btn => btn.addEventListener("click", () => {
      qsa("[data-energy]").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const el = $("energyLevel"); if (el) el.value = btn.dataset.energy;
    }));
    qsa("[data-stress]").forEach(btn => btn.addEventListener("click", () => {
      qsa("[data-stress]").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const el = $("stressLevel"); if (el) el.value = btn.dataset.stress;
    }));

    $("saveHabitBtn")?.addEventListener("click", saveHabit);
    loadHabitHistory();
  }

  async function saveHabit() {
    const client = sb(); if (!client) return;
    const sleep = Number($("sleepHours")?.value || 0);
    const water = Number($("waterLiters")?.value || 0);
    if (!sleep && !water) { setStatus("habitStatus", "Renseigne au moins le sommeil ou l'eau.", true); return; }
    const btn = $("saveHabitBtn"); if(btn) btn.disabled = true;
    setStatus("habitStatus", "Enregistrement…");
    try {
      const { data: s } = await client.auth.getSession();
      const uid = s?.session?.user?.id; if (!uid) throw new Error("Non connecté");
      const { error } = await client.from("habit_logs").insert({
        user_id:      uid,
        log_date:     $("habitDate")?.value || today(),
        sleep_hours:  sleep || null,
        water_liters: water || null,
        steps:        Number($("stepsCount")?.value || 0) || null,
        stress_level: $("stressLevel")?.value || null,
        energy_level: $("energyLevel")?.value || null,
        digestion:    $("digestion")?.value.trim() || null,
      });
      if (error) throw new Error(error.message);
      setStatus("habitStatus", "✔ Journée enregistrée !");
      ["sleepHours","waterLiters","stepsCount","digestion"].forEach(id => { const el = $(id); if(el) el.value = ""; });
      ["energyLevel","stressLevel"].forEach(id => { const el = $(id); if(el) el.value = ""; });
      qsa(".ktrack-smiley").forEach(b => b.classList.remove("active"));
      loadHabitHistory();
      updateDashboardMetrics();
    } catch(e) {
      setStatus("habitStatus", "Erreur : " + e.message, true);
    } finally { if(btn) btn.disabled = false; }
  }

  async function loadHabitHistory() {
    const client = sb(); const box = $("habitList");
    if (!client || !box) return;
    const { data: s } = await client.auth.getSession();
    const uid = s?.session?.user?.id; if (!uid) return;

    const { data } = await client.from("habit_logs")
      .select("*").eq("user_id", uid)
      .order("log_date", { ascending: false }).limit(14);

    if (!data?.length) {
      box.innerHTML = `<div class="ktrack-entry"><span>Pas encore d'habitude enregistrée. Commence par ton sommeil d'hier soir.</span></div>`;
      return;
    }
    box.innerHTML = data.map(h => `
      <div class="ktrack-entry">
        <button class="ktrack-del" data-del="${h.id}" data-table="habit_logs" title="Supprimer">×</button>
        <b>${fmtDate(h.log_date)}</b>
        <div class="ktrack-pills">
          ${h.sleep_hours  ? `<span class="ktrack-pill green">${h.sleep_hours}h 😴</span>` : ""}
          ${h.water_liters ? `<span class="ktrack-pill">${h.water_liters}L 💧</span>` : ""}
          ${h.steps        ? `<span class="ktrack-pill">${h.steps} 👟</span>` : ""}
          ${h.energy_level ? `<span class="ktrack-pill">${safe(h.energy_level)}</span>` : ""}
          ${h.stress_level ? `<span class="ktrack-pill">${safe(h.stress_level)}</span>` : ""}
        </div>
        ${h.digestion ? `<span>${safe(h.digestion)}</span>` : ""}
      </div>`).join("");
    hookDelButtons(box, loadHabitHistory);
  }

  /* ─── UTILS ─────────────────────────────────────────────────── */
  function setStatus(id, msg, err = false) {
    const el = $(id); if (!el) return;
    el.textContent = msg || "";
    el.style.color = err ? "#E8735B" : "var(--core,#34E0C8)";
  }

  function hookDelButtons(container, reloadFn) {
    qsa("[data-del]", container).forEach(btn => {
      btn.addEventListener("click", async () => {
        if (!confirm("Supprimer cette entrée ?")) return;
        const client = sb(); if (!client) return;
        const table = btn.dataset.table;
        const id    = btn.dataset.del;
        await client.from(table).delete().eq("id", id);
        reloadFn();
        updateDashboardMetrics();
      });
    });
  }

  async function updateDashboardMetrics() {
    const client = sb(); if (!client) return;
    const { data: s } = await client.auth.getSession();
    const uid = s?.session?.user?.id; if (!uid) return;

    const [foodRes, exRes, habitRes] = await Promise.all([
      client.from("nutrition_logs").select("calories").eq("user_id", uid).order("created_at", { ascending: false }).limit(1),
      client.from("workout_exercise_logs").select("exercise_name").eq("user_id", uid).order("created_at", { ascending: false }).limit(1),
      client.from("habit_logs").select("sleep_hours").eq("user_id", uid).order("created_at", { ascending: false }).limit(1),
    ]);

    const lc = $("lastCalories"), lw = $("lastWorkout"), ls = $("lastSleep");
    if (lc) lc.textContent = foodRes.data?.[0]?.calories ? foodRes.data[0].calories + " kcal" : "—";
    if (lw) lw.textContent = exRes.data?.[0]?.exercise_name || "—";
    if (ls) ls.textContent = habitRes.data?.[0]?.sleep_hours ? habitRes.data[0].sleep_hours + " h" : "—";
  }

  /* ─── INIT ──────────────────────────────────────────────────── */
  function enhance() {
    enhanceSeances();
    enhanceNutrition();
    enhanceHabitudes();
  }

  // Lancer quand l'espace membre devient visible
  const obs = new MutationObserver(() => {
    if (document.body.classList.contains("authed")) enhance();
  });
  obs.observe(document.body, { attributeFilter: ["class"] });

  // Aussi quand un module tracking est ouvert via le router
  document.addEventListener("click", e => {
    const tile = e.target.closest("[data-goto]");
    if (!tile) return;
    const t = tile.dataset.goto;
    if (["modProgress","modNutrition","modHabits"].includes(t)) {
      setTimeout(() => {
        enhance();
        if (t === "modProgress")  loadSeanceHistory();
        if (t === "modNutrition") loadNutritionHistory();
        if (t === "modHabits")    loadHabitHistory();
      }, 150);
    }
  });

  if (document.body.classList.contains("authed")) enhance();
})();
