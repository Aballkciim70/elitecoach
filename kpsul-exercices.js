/* =====================================================
   KPSUL — BIBLIOTHÈQUE D’EXERCICES PRO
   Fichier : kpsul-exercices.js
   Rôle : bibliothèque complète, coach + client
   ===================================================== */

(() => {
  "use strict";

  const KEX = {
    version: "1.0.1",
    tables: {
      exercises: "exercise_library",
      variants: "exercise_variants",
      mistakes: "exercise_mistakes",
      media: "exercise_media",
      faq: "exercise_faq",
      references: "exercise_references",
      coachNotes: "exercise_coach_notes"
    },
    state: {
      user: null,
      role: "client",
      isCoach: false,
      exercises: [],
      selected: null,
      linked: {
        variants: [],
        mistakes: [],
        media: [],
        faq: [],
        references: [],
        coachNotes: []
      },
      filters: {
        search: "",
        muscle: "",
        equipment: "",
        level: "",
        goal: "",
        type: ""
      }
    }
  };

  const $ = id => document.getElementById(id);
  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));
  const sb = () => window.sb || null;

  const safe = value => String(value ?? "").replace(/[&<>"']/g, s => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[s]));

  const clean = value => String(value ?? "").trim();

  const splitList = value => clean(value)
    .split(",")
    .map(v => v.trim())
    .filter(Boolean);

  const MUSCLES = [
    "Pectoraux",
    "Dos",
    "Trapèzes",
    "Épaules",
    "Deltoïde antérieur",
    "Deltoïde latéral",
    "Deltoïde postérieur",
    "Biceps",
    "Triceps",
    "Avant-bras",
    "Abdominaux",
    "Obliques",
    "Lombaires",
    "Quadriceps",
    "Ischios",
    "Fessiers",
    "Adducteurs",
    "Abducteurs",
    "Mollets",
    "Tibial antérieur",
    "Full body"
  ];

  const EQUIPMENT = [
    "Poids du corps",
    "Haltères",
    "Barre",
    "Machine",
    "Poulie",
    "Smith machine",
    "Élastique",
    "Kettlebell",
    "Banc",
    "TRX",
    "Anneaux",
    "Landmine",
    "Médecine ball",
    "Sled",
    "Cardio machine",
    "Autre"
  ];

  const LEVELS = ["débutant", "intermédiaire", "avancé"];

  const GOALS = [
    "hypertrophie",
    "force",
    "puissance",
    "endurance",
    "mobilité",
    "réathlétisation",
    "santé",
    "perte de gras",
    "prise de masse",
    "technique"
  ];

  const MOVEMENT_TYPES = [
    "polyarticulaire",
    "isolation",
    "gainage",
    "mobilité",
    "cardio",
    "correctif",
    "explosif",
    "unilatéral",
    "bilatéral"
  ];

  function optionList(items, selected = "") {
    return items.map(item => `
      <option value="${safe(item)}" ${item === selected ? "selected" : ""}>
        ${safe(item)}
      </option>
    `).join("");
  }

  function notify(id, message, error = false) {
    const el = $(id);
    if (!el) return;
    el.textContent = message || "";
    el.classList.toggle("kex-error", !!error);
  }

  function injectStyle() {
    if ($("kexStyle")) return;

    const st = document.createElement("style");
    st.id = "kexStyle";
    st.textContent = `
      .kex-shell{display:grid;gap:18px}
      .kex-header{border:1px solid rgba(52,224,200,.32);border-radius:22px;background:linear-gradient(160deg,rgba(52,224,200,.07),rgba(255,255,255,.02));padding:20px}
      .kex-header h3{font-family:var(--disp,system-ui);font-size:26px;margin-bottom:8px}
      .kex-header p{color:#8A9A93;font-size:14px}
      .kex-filters{display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:10px;margin-top:16px}
      .kex-layout{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.1fr);gap:16px;align-items:start}
      .kex-panel{border:1px solid var(--line,#22403A);border-radius:18px;background:rgba(4,10,9,.32);padding:16px}
      .kex-actions{display:flex;flex-wrap:wrap;gap:10px;margin:12px 0}
      .kex-status{min-height:18px;color:var(--core,#34E0C8);font-size:13px;margin:8px 0}
      .kex-error{color:#E8735B!important}
      .kex-list{display:grid;gap:10px}
      .kex-card{border:1px solid var(--line,#22403A);border-radius:16px;background:rgba(255,255,255,.025);padding:14px;cursor:pointer;transition:.18s border-color,.18s transform,.18s box-shadow;text-align:left;color:inherit;width:100%}
      .kex-card:hover,.kex-card.active{border-color:var(--core,#34E0C8);box-shadow:0 0 0 3px rgba(52,224,200,.12);transform:translateY(-1px)}
      .kex-card b{display:block;font-family:var(--disp,system-ui);font-size:17px}
      .kex-card span{display:block;color:#8A9A93;font-size:13px;margin-top:4px}
      .kex-back{display:inline-flex;align-items:center;gap:6px;margin:0 0 14px;border:1px solid var(--line,#22403A);background:none;color:var(--core,#34E0C8);border-radius:99px;padding:8px 15px;font-family:var(--mono,monospace);font-size:11px;letter-spacing:.06em;cursor:pointer}
      .kex-back:hover{border-color:var(--core,#34E0C8)}
      .kex-tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
      .kex-tag{border:1px solid var(--line,#22403A);border-radius:999px;padding:4px 9px;font-size:11px;color:var(--core,#34E0C8);font-family:var(--mono,monospace)}
      .kex-detail{border:1px solid rgba(52,224,200,.32);border-radius:20px;background:linear-gradient(160deg,rgba(52,224,200,.06),rgba(255,255,255,.02));padding:18px}
      .kex-detail h3{font-family:var(--disp,system-ui);font-size:28px;line-height:1.1;margin-bottom:8px}
      .kex-muted{color:#8A9A93;font-size:14px}
      .kex-media{width:100%;max-height:320px;object-fit:cover;border:1px solid var(--line,#22403A);border-radius:16px;background:#07110f;margin:14px 0}
      .kex-section{border-top:1px solid var(--line,#22403A);padding-top:14px;margin-top:14px}
      .kex-section h4{font-family:var(--disp,system-ui);font-size:18px;margin-bottom:6px}
      .kex-section p,.kex-section li{color:#C6D0CB;font-size:14px;white-space:pre-wrap}
      .kex-section ul{display:grid;gap:8px;padding-left:18px}
      .kex-grid-2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
      .kex-form{display:grid;gap:10px}
      .kex-form-box{border:1px solid rgba(52,224,200,.32);border-radius:20px;background:rgba(52,224,200,.035);padding:18px;margin-top:18px}
      .kex-danger{border-color:#E8735B!important;color:#E8735B!important;background:transparent!important}
      .kex-mini-card{border:1px solid var(--line,#22403A);border-radius:14px;background:rgba(255,255,255,.025);padding:12px;margin-top:8px}
      .kex-mini-card b{display:block;font-family:var(--disp,system-ui)}
      .kex-mini-card span{display:block;color:#8A9A93;font-size:13px;margin-top:4px}
      @media(max-width:900px){.kex-layout,.kex-filters,.kex-grid-2{grid-template-columns:1fr}}
    `;
    document.head.appendChild(st);
  }

  async function loadCurrentUser() {
    const client = sb();
    if (!client) return null;

    const { data } = await client.auth.getSession();
    const user = data?.session?.user || null;

    KEX.state.user = user;

    if (!user) {
      KEX.state.role = "visitor";
      KEX.state.isCoach = false;
      return null;
    }

    const { data: profile } = await client
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    KEX.state.role = profile?.role || "client";
    KEX.state.isCoach = ["coach", "admin"].includes(KEX.state.role);

    return user;
  }

  function requireClient() {
    const client = sb();
    if (!client) {
      console.warn("KPSUL exercices : Supabase indisponible.");
      return null;
    }
    return client;
  }

  function injectModule() {
    const anchor = qs(".module-panel");
    if (!anchor) return;

    const tabs = qs(".module-tabs");
    if (tabs && !qs('[data-module="modKpsulExercisesPro"]')) {
      tabs.insertAdjacentHTML("beforeend",
        `<button class="module-tab" data-module="modKpsulExercisesPro" type="button">Exercices pro</button>`
      );
    }

    if ($("modKpsulExercisesPro")) return;

    anchor.insertAdjacentHTML("beforebegin", `
      <div class="module-panel" id="modKpsulExercisesPro">
        <div class="tool-panel kex-shell">
          <div class="kex-header">
            <h3>📚 Bibliothèque exercices</h3>
            <p>
              Base pédagogique Kpsul : exercices, muscles, variantes, erreurs fréquentes,
              biomécanique, médias, FAQ et consignes coach.
            </p>

            <div class="kex-filters">
              <input id="kexSearch" placeholder="Rechercher un exercice, muscle, objectif...">

              <select id="kexMuscleFilter">
                <option value="">Tous les muscles</option>
                ${optionList(MUSCLES)}
              </select>

              <select id="kexEquipmentFilter">
                <option value="">Tout le matériel</option>
                ${optionList(EQUIPMENT)}
              </select>

              <select id="kexLevelFilter">
                <option value="">Tous niveaux</option>
                ${optionList(LEVELS)}
              </select>

              <select id="kexGoalFilter">
                <option value="">Tous objectifs</option>
                ${optionList(GOALS)}
              </select>

              <select id="kexTypeFilter">
                <option value="">Tous types</option>
                ${optionList(MOVEMENT_TYPES)}
              </select>
            </div>
          </div>

          <div class="kex-layout">
            <div class="kex-panel">
              <div class="kex-actions">
                <button class="btn btn-ghost" id="kexReload" type="button">Rafraîchir</button>
                <button class="btn btn-primary" id="kexCreate" type="button" style="display:none">
                  Ajouter un exercice
                </button>
              </div>

              <div class="kex-status" id="kexStatus"></div>
              <div class="kex-list" id="kexList"></div>
            </div>

            <div class="kex-detail" id="kexDetail">
              <h3>Sélectionne un exercice</h3>
              <p class="kex-muted">La fiche complète apparaîtra ici.</p>
            </div>
          </div>

          <div id="kexCoachFormZone"></div>
        </div>
      </div>
    `);
  }

  function hookTabs() {
    qsa("[data-module]").forEach(btn => {
      if (btn.dataset.kexTabHooked) return;
      btn.dataset.kexTabHooked = "1";

      btn.addEventListener("click", () => {
        const target = btn.dataset.module;

        qsa(".module-tab").forEach(b => {
          b.classList.toggle("active", b.dataset.module === target);
        });

        qsa(".module-panel").forEach(p => {
          p.classList.toggle("active", p.id === target);
        });

        if (target === "modKpsulExercisesPro") loadExercises();
      });
    });
  }

  function hookFilters() {
    [
      "kexSearch",
      "kexMuscleFilter",
      "kexEquipmentFilter",
      "kexLevelFilter",
      "kexGoalFilter",
      "kexTypeFilter"
    ].forEach(id => {
      const el = $(id);
      if (!el || el.dataset.kexHooked) return;
      el.dataset.kexHooked = "1";

      el.addEventListener("input", () => {
        updateFilters();
        renderExerciseList();
      });

      el.addEventListener("change", () => {
        updateFilters();
        renderExerciseList();
      });
    });

    $("kexReload")?.addEventListener("click", loadExercises);
    $("kexCreate")?.addEventListener("click", () => openExerciseForm(null));
  }

  function updateFilters() {
    KEX.state.filters.search = clean($("kexSearch")?.value).toLowerCase();
    KEX.state.filters.muscle = clean($("kexMuscleFilter")?.value);
    KEX.state.filters.equipment = clean($("kexEquipmentFilter")?.value);
    KEX.state.filters.level = clean($("kexLevelFilter")?.value);
    KEX.state.filters.goal = clean($("kexGoalFilter")?.value);
    KEX.state.filters.type = clean($("kexTypeFilter")?.value);
  }

  function exerciseMatchesFilters(ex) {
    const f = KEX.state.filters;

    const searchable = [
      ex.name,
      ex.category,
      ex.muscle_group,
      ex.description,
      ex.breathing,
      ex.coach_tip,
      ex.main_muscle,
      ex.equipment,
      ex.level,
      ex.goal,
      ex.movement_type,
      ex.short_description,
      ex.execution_steps,
      ex.common_mistakes,
      ex.variants,
      ex.coach_cues,
      ex.science_notes,
      ...(ex.secondary_muscles || [])
    ].join(" ").toLowerCase();

    if (f.search) {
      const terms = f.search.toLowerCase().split(/\s+/).filter(Boolean);
      const words = searchable.split(/[\s,()\u00b7·-]+/).filter(Boolean);
      const near = (a, b) => {
        if (a === b || a.startsWith(b) || b.startsWith(a)) return true;
        if (Math.abs(a.length - b.length) > 1 || Math.min(a.length, b.length) < 4) return false;
        let i = 0, j = 0, diff = 0;
        while (i < a.length && j < b.length) {
          if (a[i] === b[j]) { i++; j++; continue; }
          diff++; if (diff > 1) return false;
          if (a.length > b.length) i++;
          else if (b.length > a.length) j++;
          else { i++; j++; }
        }
        return diff + (a.length - i) + (b.length - j) <= 1;
      };
      const ok = terms.every(t => searchable.includes(t) || words.some(w => near(w, t)));
      if (!ok) return false;
    }
    if (f.muscle && (ex.muscle_group || ex.main_muscle) !== f.muscle && !(ex.secondary_muscles || []).includes(f.muscle)) return false;
    if (f.equipment && ex.equipment !== f.equipment) return false;
    if (f.level && ex.level !== f.level) return false;
    if (f.goal && ex.goal !== f.goal) return false;
    if (f.type && ex.movement_type !== f.type) return false;

    return true;
  }

  async function loadExercises() {
    const client = requireClient();
    if (!client) return;

    notify("kexStatus", "Chargement de la bibliothèque…");

    const { data, error } = await client
      .from(KEX.tables.exercises)
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      notify("kexStatus", "Erreur : " + error.message, true);
      return;
    }

    KEX.state.exercises = data || [];

    if (KEX.state.isCoach) notify("kexStatus", `${KEX.state.exercises.length} exercice(s) chargé(s).`);
    else notify("kexStatus", "");
    renderExerciseList();
  }

  async function loadLinkedData(exerciseId) {
    const client = requireClient();
    if (!client || !exerciseId) return;

    const load = async table => {
      const { data, error } = await client
        .from(table)
        .select("*")
        .eq("exercise_id", exerciseId)
        .order("created_at", { ascending: false });

      if (error) return [];
      return data || [];
    };

    const [variants, mistakes, media, faq, references, coachNotes] = await Promise.all([
      load(KEX.tables.variants),
      load(KEX.tables.mistakes),
      load(KEX.tables.media),
      load(KEX.tables.faq),
      load(KEX.tables.references),
      load(KEX.tables.coachNotes)
    ]);

    KEX.state.linked = { variants, mistakes, media, faq, references, coachNotes };
  }

  function renderExerciseList() {
    const box = $("kexList");
    if (!box) return;

    const rows = KEX.state.exercises.filter(exerciseMatchesFilters);

    if (!rows.length) {
      box.innerHTML = `
        <div class="kex-card">
          <b>Aucun exercice trouvé</b>
          <span>Ajoute un exercice côté coach ou modifie les filtres.</span>
        </div>
      `;
      return;
    }

    box.innerHTML = rows.map(ex => `
      <button class="kex-card ${KEX.state.selected?.id === ex.id ? "active" : ""}"
        data-kex-id="${safe(ex.id)}" type="button">
        <b>${safe(ex.name)}</b>
        <span>${safe(ex.short_description || "Fiche exercice Kpsul")}</span>
        <div class="kex-tags">
          ${ex.main_muscle ? `<small class="kex-tag">${safe(ex.main_muscle)}</small>` : ""}
          ${ex.equipment ? `<small class="kex-tag">${safe(ex.equipment)}</small>` : ""}
          ${ex.level ? `<small class="kex-tag">${safe(ex.level)}</small>` : ""}
          ${ex.goal ? `<small class="kex-tag">${safe(ex.goal)}</small>` : ""}
          ${ex.status === "draft" ? `<small class="kex-tag">brouillon</small>` : ""}
        </div>
      </button>
    `).join("");

    qsa("[data-kex-id]").forEach(card => {
      card.addEventListener("click", async () => {
        const ex = KEX.state.exercises.find(item => item.id === card.dataset.kexId);
        if (!ex) return;

        KEX.state.selected = ex;
        renderExerciseList();

        await loadLinkedData(ex.id);
        renderExerciseDetail(ex);
      });
    });
  }

  function renderMedia(ex) {
    const linked = KEX.state.linked.media || [];

    if (linked.length) {
      return linked.map(m => {
        if (m.media_type === "image" || m.media_type === "gif") {
          return `<img class="kex-media" src="${safe(m.url)}" alt="${safe(ex.name)}">`;
        }
        return `<video class="kex-media" src="${safe(m.url)}" controls playsinline></video>`;
      }).join("");
    }

    if (!ex.media_url) return "";

    if (ex.media_type === "image" || ex.media_type === "gif") {
      return `<img class="kex-media" src="${safe(ex.media_url)}" alt="${safe(ex.name)}">`;
    }

    return `<video class="kex-media" src="${safe(ex.media_url)}" controls playsinline></video>`;
  }

  function renderMiniList(title, rows, emptyText, renderRow) {
    if (!rows || !rows.length) {
      return `
        <div class="kex-section">
          <h4>${safe(title)}</h4>
          <p>${safe(emptyText)}</p>
        </div>
      `;
    }

    return `
      <div class="kex-section">
        <h4>${safe(title)}</h4>
        <div>${rows.map(renderRow).join("")}</div>
      </div>
    `;
  }

  function explainWhyExercise(ex) {
    return `Cet exercice peut être choisi par ton coach pour travailler principalement ${ex.main_muscle || "un groupe musculaire précis"}.

Son intérêt dépend de son placement dans ton programme : ordre de séance, volume, intensité, tempo, récupération et objectif global.

Objectif indiqué : ${ex.goal || "non renseigné"}.
Type de mouvement : ${ex.movement_type || "non renseigné"}.
Matériel : ${ex.equipment || "non renseigné"}.

Kpsul explique la logique générale de l’exercice, mais ne modifie jamais le programme ni les consignes importantes du coach.`;
  }

  function pedagogicAnswer(ex) {
    const mistakes = (KEX.state.linked.mistakes || [])
      .map(m => `- ${m.mistake}${m.correction ? " → correction : " + m.correction : ""}`)
      .join("\n");

    const variants = (KEX.state.linked.variants || [])
      .map(v => `- ${v.name}${v.note ? " : " + v.note : ""}`)
      .join("\n");

    return `Réponse pédagogique Kpsul

Exercice : ${ex.name}

Muscle principal :
${ex.main_muscle || "Non renseigné"}

Pourquoi cet exercice peut être utile :
${ex.science_notes || explainWhyExercise(ex)}

Ce que tu devrais chercher à ressentir :
Une tension contrôlée sur le muscle principal, sans douleur articulaire inhabituelle.

Erreurs possibles :
${mistakes || ex.common_mistakes || "Non renseigné"}

Variantes possibles :
${variants || ex.variants || "Non renseigné"}

Rappel :
L’application explique. Le coach décide.`;
  }

  function renderExerciseDetail(ex) {
    const box = $("kexDetail");
    if (!box) return;

    if (!ex) {
      box.innerHTML = `<h3>Sélectionne un exercice</h3><p class="kex-muted">La fiche complète apparaîtra ici.</p>`;
      return;
    }

    const linked = KEX.state.linked;

    const muscle = ex.muscle_group || ex.main_muscle || "";
    const desc = ex.description || ex.short_description || "Fiche exercice Kpsul.";
    box.innerHTML = `
      <button class="kex-back" id="kexBackToList" type="button">← Retour à la liste</button>
      <h3>${safe(ex.name)}</h3>
      <p class="kex-muted">${safe(desc)}</p>

      <div class="kex-tags">
        ${ex.category ? `<small class="kex-tag">${safe(ex.category)}</small>` : ""}
        ${muscle ? `<small class="kex-tag">${safe(muscle)}</small>` : ""}
        ${ex.equipment ? `<small class="kex-tag">${safe(ex.equipment)}</small>` : ""}
        ${ex.level ? `<small class="kex-tag">${safe(ex.level)}</small>` : ""}
        ${ex.movement_type ? `<small class="kex-tag">${safe(ex.movement_type)}</small>` : ""}
        ${ex.goal ? `<small class="kex-tag">${safe(ex.goal)}</small>` : ""}
      </div>

      ${renderMedia(ex)}

      <div class="kex-section">
        <h4>Muscle principal</h4>
        <p>${safe(muscle || "—")}</p>
      </div>

      <div class="kex-section">
        <h4>Exécution</h4>
        <p>${safe(ex.description || ex.execution_steps || "Non renseigné.")}</p>
      </div>
      ${ex.breathing ? `<div class="kex-section"><h4>Respiration</h4><p>${safe(ex.breathing)}</p></div>` : ""}
      ${ex.tempo ? `<div class="kex-section"><h4>Tempo</h4><p>${safe(ex.tempo)} <span style="color:#8A9A93;font-size:12px">(descente – pause basse – montée – pause haute)</span></p></div>` : ""}
      ${ex.coach_tip ? `<div class="kex-section"><h4>💡 Conseil coach</h4><p>${safe(ex.coach_tip)}</p></div>` : ""}

      ${renderMiniList(
        "Erreurs détaillées",
        linked.mistakes,
        "Aucune erreur détaillée enregistrée.",
        m => `
          <div class="kex-mini-card">
            <b>${safe(m.mistake)}</b>
            <span>${safe(m.consequence || "")}</span>
            <span>${safe(m.correction || "")}</span>
          </div>
        `
      )}

      <div class="kex-section">
        <h4>Variantes</h4>
        <p>${safe(ex.variants || "Non renseigné.")}</p>
      </div>

      ${renderMiniList(
        "Variantes détaillées",
        linked.variants,
        "Aucune variante détaillée enregistrée.",
        v => `
          <div class="kex-mini-card">
            <b>${safe(v.name)}</b>
            <span>${safe(v.difficulty || "")} ${safe(v.equipment || "")}</span>
            <span>${safe(v.note || "")}</span>
          </div>
        `
      )}

      <div class="kex-section">
        <h4>Pourquoi mon coach peut m’avoir mis cet exercice ?</h4>
        <p>${safe(explainWhyExercise(ex))}</p>
      </div>

      <div class="kex-section">
        <h4>Consignes coach</h4>
        <p>${safe(ex.coach_cues || "Ton coach pourra ajouter ici ses consignes.")}</p>
      </div>

      ${renderMiniList(
        "Notes coach personnalisées",
        linked.coachNotes,
        "Aucune note coach personnalisée.",
        n => `
          <div class="kex-mini-card">
            <b>Note coach</b>
            <span>${safe(n.note)}</span>
          </div>
        `
      )}

      <div class="kex-section">
        <h4>Science / biomécanique</h4>
        <p>${safe(ex.science_notes || "Aucune note scientifique enregistrée pour l’instant.")}</p>
      </div>

      <div class="kex-section">
        <h4>Sécurité</h4>
        <p>${safe(ex.safety_notes || "Respecte les consignes du coach. En cas de douleur inhabituelle, signale-la.")}</p>
      </div>

      ${renderMiniList(
        "Questions fréquentes",
        linked.faq,
        "Aucune FAQ enregistrée.",
        f => `
          <div class="kex-mini-card">
            <b>${safe(f.question)}</b>
            <span>${safe(f.answer)}</span>
          </div>
        `
      )}

      ${renderMiniList(
        "Références",
        linked.references,
        "Aucune référence enregistrée.",
        r => `
          <div class="kex-mini-card">
            <b>${safe(r.title)}</b>
            <span>${safe(r.source || "")}</span>
            <span>${safe(r.note || "")}</span>
          </div>
        `
      )}

      <div class="kex-actions">
        <button class="btn btn-ghost" id="kexAsk" type="button">Pourquoi cet exercice ?</button>
        <button class="btn btn-primary" id="kexEdit" type="button" style="display:${KEX.state.isCoach ? "inline-flex" : "none"}">Modifier</button>
      </div>

      <div class="kex-section" id="kexAnswerBox" style="display:none"></div>
    `;

    $("kexAsk")?.addEventListener("click", () => {
      const answer = $("kexAnswerBox");
      if (!answer) return;

      answer.style.display = "block";
      answer.innerHTML = `
        <h4>Assistant pédagogique</h4>
        <p>${safe(pedagogicAnswer(ex))}</p>
      `;
    });

    $("kexEdit")?.addEventListener("click", () => openExerciseForm(ex));
    $("kexBackToList")?.addEventListener("click", () => {
      KEX.state.selected = null;
      renderExerciseDetail(null);
      $("kexList")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function injectCoachForm() {
    const zone = $("kexCoachFormZone");
    if (!zone || $("kexForm")) return;

    zone.innerHTML = `
      <div class="kex-form-box" id="kexForm" style="display:none">
        <h3 id="kexFormTitle">Ajouter un exercice</h3>

        <div class="kex-form">
          <input id="kexName" placeholder="Nom de l’exercice">

          <div class="kex-grid-2">
            <input id="kexCategory" placeholder="Catégorie : Push, Pull, Legs...">
            <select id="kexMainMuscle">
              <option value="">Muscle principal</option>
              ${optionList(MUSCLES)}
            </select>
          </div>

          <input id="kexSecondaryMuscles" placeholder="Muscles secondaires séparés par virgule">

          <div class="kex-grid-2">
            <select id="kexEquipment">
              <option value="">Matériel</option>
              ${optionList(EQUIPMENT)}
            </select>

            <select id="kexLevel">
              <option value="">Niveau</option>
              ${optionList(LEVELS)}
            </select>
          </div>

          <div class="kex-grid-2">
            <select id="kexMovementType">
              <option value="">Type de mouvement</option>
              ${optionList(MOVEMENT_TYPES)}
            </select>

            <select id="kexGoal">
              <option value="">Objectif</option>
              ${optionList(GOALS)}
            </select>
          </div>

          <textarea id="kexShort" placeholder="Description courte"></textarea>
          <textarea id="kexExecution" placeholder="Exécution étape par étape"></textarea>
          <textarea id="kexMistakes" placeholder="Erreurs fréquentes"></textarea>
          <textarea id="kexVariants" placeholder="Variantes générales"></textarea>
          <textarea id="kexCoachCues" placeholder="Consignes coach"></textarea>
          <textarea id="kexScience" placeholder="Notes scientifiques / biomécanique"></textarea>
          <textarea id="kexSafety" placeholder="Notes sécurité"></textarea>

          <div class="kex-grid-2">
            <input id="kexMediaUrl" placeholder="URL vidéo / GIF / image">
            <select id="kexMediaType">
              <option value="video">Vidéo</option>
              <option value="gif">GIF</option>
              <option value="image">Image</option>
            </select>
          </div>

          <select id="kexStatusSelect">
            <option value="draft">Brouillon</option>
            <option value="published">Publié</option>
          </select>

          <div class="kex-actions">
            <button class="btn btn-primary" id="kexSave" type="button">Enregistrer</button>
            <button class="btn btn-ghost" id="kexCancel" type="button">Annuler</button>
            <button class="btn kex-danger" id="kexDelete" type="button">Supprimer</button>
          </div>

          <div class="kex-status" id="kexFormStatus"></div>
        </div>
      </div>

      <div class="kex-form-box" id="kexLinkedForm" style="display:none">
        <h3>Ajouter des détails à l’exercice</h3>

        <div class="kex-grid-2">
          <div>
            <h4>Variante</h4>
            <input id="kexVariantName" placeholder="Nom de variante">
            <input id="kexVariantDifficulty" placeholder="Difficulté">
            <input id="kexVariantEquipment" placeholder="Matériel">
            <textarea id="kexVariantNote" placeholder="Note"></textarea>
            <button class="btn btn-ghost" id="kexAddVariant" type="button">Ajouter variante</button>
          </div>

          <div>
            <h4>Erreur fréquente</h4>
            <input id="kexMistakeName" placeholder="Erreur">
            <textarea id="kexMistakeConsequence" placeholder="Conséquence"></textarea>
            <textarea id="kexMistakeCorrection" placeholder="Correction"></textarea>
            <button class="btn btn-ghost" id="kexAddMistake" type="button">Ajouter erreur</button>
          </div>
        </div>

        <div class="kex-grid-2">
          <div>
            <h4>FAQ</h4>
            <input id="kexFaqQuestion" placeholder="Question">
            <textarea id="kexFaqAnswer" placeholder="Réponse"></textarea>
            <button class="btn btn-ghost" id="kexAddFaq" type="button">Ajouter FAQ</button>
          </div>

          <div>
            <h4>Média</h4>
            <input id="kexMediaLinkedUrl" placeholder="URL">
            <input id="kexMediaAngle" placeholder="Angle : face, profil...">
            <textarea id="kexMediaNote" placeholder="Note"></textarea>
            <button class="btn btn-ghost" id="kexAddMedia" type="button">Ajouter média</button>
          </div>
        </div>

        <div>
          <h4>Référence scientifique</h4>
          <input id="kexRefTitle" placeholder="Titre">
          <input id="kexRefSource" placeholder="Source">
          <input id="kexRefUrl" placeholder="URL">
          <textarea id="kexRefNote" placeholder="Note"></textarea>
          <button class="btn btn-ghost" id="kexAddReference" type="button">Ajouter référence</button>
        </div>

        <div>
          <h4>Note coach</h4>
          <textarea id="kexCoachNote" placeholder="Ta consigne personnelle"></textarea>
          <button class="btn btn-primary" id="kexAddCoachNote" type="button">Ajouter note coach</button>
        </div>

        <div class="kex-status" id="kexLinkedStatus"></div>
      </div>
    `;
  }

  function fillForm(ex) {
    $("kexName").value = ex?.name || "";
    $("kexCategory").value = ex?.category || "";
    $("kexMainMuscle").value = ex?.main_muscle || "";
    $("kexSecondaryMuscles").value = (ex?.secondary_muscles || []).join(", ");
    $("kexEquipment").value = ex?.equipment || "";
    $("kexLevel").value = ex?.level || "";
    $("kexMovementType").value = ex?.movement_type || "";
    $("kexGoal").value = ex?.goal || "";
    $("kexShort").value = ex?.short_description || "";
    $("kexExecution").value = ex?.execution_steps || "";
    $("kexMistakes").value = ex?.common_mistakes || "";
    $("kexVariants").value = ex?.variants || "";
    $("kexCoachCues").value = ex?.coach_cues || "";
    $("kexScience").value = ex?.science_notes || "";
    $("kexSafety").value = ex?.safety_notes || "";
    $("kexMediaUrl").value = ex?.media_url || "";
    $("kexMediaType").value = ex?.media_type || "video";
    $("kexStatusSelect").value = ex?.status || "draft";
  }

  function openExerciseForm(ex = null) {
    if (!KEX.state.isCoach) return;

    KEX.state.selected = ex;

    $("kexForm").style.display = "block";
    $("kexLinkedForm").style.display = ex ? "block" : "none";
    $("kexFormTitle").textContent = ex ? "Modifier l’exercice" : "Ajouter un exercice";
    $("kexDelete").style.display = ex ? "inline-flex" : "none";

    fillForm(ex);
    notify("kexFormStatus", "");

    $("kexForm").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function formPayload() {
    return {
      name: clean($("kexName").value),
      category: clean($("kexCategory").value) || null,
      main_muscle: clean($("kexMainMuscle").value) || null,
      secondary_muscles: splitList($("kexSecondaryMuscles").value),
      equipment: clean($("kexEquipment").value) || null,
      level: clean($("kexLevel").value) || null,
      movement_type: clean($("kexMovementType").value) || null,
      goal: clean($("kexGoal").value) || null,
      short_description: clean($("kexShort").value) || null,
      execution_steps: clean($("kexExecution").value) || null,
      common_mistakes: clean($("kexMistakes").value) || null,
      variants: clean($("kexVariants").value) || null,
      coach_cues: clean($("kexCoachCues").value) || null,
      science_notes: clean($("kexScience").value) || null,
      safety_notes: clean($("kexSafety").value) || null,
      media_url: clean($("kexMediaUrl").value) || null,
      media_type: clean($("kexMediaType").value) || "video",
      status: clean($("kexStatusSelect").value) || "draft",
      updated_at: new Date().toISOString()
    };
  }

  async function saveExercise() {
    const client = requireClient();
    if (!client) return;

    const payload = formPayload();

    if (!payload.name) {
      notify("kexFormStatus", "Le nom de l’exercice est obligatoire.", true);
      return;
    }

    notify("kexFormStatus", "Enregistrement…");

    const user = KEX.state.user || await loadCurrentUser();
    let result;

    if (KEX.state.selected?.id) {
      result = await client
        .from(KEX.tables.exercises)
        .update(payload)
        .eq("id", KEX.state.selected.id)
        .select()
        .single();
    } else {
      payload.created_by = user?.id || null;

      result = await client
        .from(KEX.tables.exercises)
        .insert(payload)
        .select()
        .single();
    }

    if (result.error) {
      notify("kexFormStatus", "Erreur : " + result.error.message, true);
      return;
    }

    KEX.state.selected = result.data;

    notify("kexFormStatus", "Exercice enregistré ✔");

    await loadExercises();
    await loadLinkedData(result.data.id);
    renderExerciseDetail(result.data);

    $("kexLinkedForm").style.display = "block";
  }

  async function deleteExercise() {
    const client = requireClient();
    if (!client || !KEX.state.selected?.id) return;

    if (!confirm("Supprimer définitivement cet exercice ?")) return;

    const { error } = await client
      .from(KEX.tables.exercises)
      .delete()
      .eq("id", KEX.state.selected.id);

    if (error) {
      notify("kexFormStatus", "Erreur : " + error.message, true);
      return;
    }

    KEX.state.selected = null;
    $("kexForm").style.display = "none";
    $("kexLinkedForm").style.display = "none";

    renderExerciseDetail(null);
    await loadExercises();
  }

  async function insertLinked(table, payload) {
    const client = requireClient();
    if (!client || !KEX.state.selected?.id) return;

    payload.exercise_id = KEX.state.selected.id;

    const { error } = await client.from(table).insert(payload);

    if (error) {
      notify("kexLinkedStatus", "Erreur : " + error.message, true);
      return;
    }

    notify("kexLinkedStatus", "Ajout enregistré ✔");

    await loadLinkedData(KEX.state.selected.id);
    renderExerciseDetail(KEX.state.selected);
  }

  function hookLinkedForms() {
    $("kexAddVariant")?.addEventListener("click", () => {
      insertLinked(KEX.tables.variants, {
        name: clean($("kexVariantName").value),
        difficulty: clean($("kexVariantDifficulty").value) || null,
        equipment: clean($("kexVariantEquipment").value) || null,
        note: clean($("kexVariantNote").value) || null
      });
    });

    $("kexAddMistake")?.addEventListener("click", () => {
      insertLinked(KEX.tables.mistakes, {
        mistake: clean($("kexMistakeName").value),
        consequence: clean($("kexMistakeConsequence").value) || null,
        correction: clean($("kexMistakeCorrection").value) || null
      });
    });

    $("kexAddFaq")?.addEventListener("click", () => {
      insertLinked(KEX.tables.faq, {
        question: clean($("kexFaqQuestion").value),
        answer: clean($("kexFaqAnswer").value)
      });
    });

    $("kexAddMedia")?.addEventListener("click", () => {
      insertLinked(KEX.tables.media, {
        media_type: "video",
        url: clean($("kexMediaLinkedUrl").value),
        angle: clean($("kexMediaAngle").value) || null,
        note: clean($("kexMediaNote").value) || null
      });
    });

    $("kexAddReference")?.addEventListener("click", () => {
      insertLinked(KEX.tables.references, {
        title: clean($("kexRefTitle").value),
        source: clean($("kexRefSource").value) || null,
        url: clean($("kexRefUrl").value) || null,
        note: clean($("kexRefNote").value) || null
      });
    });

    $("kexAddCoachNote")?.addEventListener("click", () => {
      insertLinked(KEX.tables.coachNotes, {
        coach_id: KEX.state.user?.id || null,
        note: clean($("kexCoachNote").value)
      });
    });
  }

  function hookCoachButtons() {
    $("kexSave")?.addEventListener("click", saveExercise);
    $("kexCancel")?.addEventListener("click", () => {
      $("kexForm").style.display = "none";
      $("kexLinkedForm").style.display = "none";
    });
    $("kexDelete")?.addEventListener("click", deleteExercise);
    hookLinkedForms();
  }

  async function activateCoachMode() {
    await loadCurrentUser();

    if (!KEX.state.isCoach) return;

    const createBtn = $("kexCreate");
    if (createBtn) createBtn.style.display = "inline-flex";

    injectCoachForm();
    hookCoachButtons();
  }

  function exposeApi() {
    window.KpsulExercises = {
      reload: loadExercises,
      open: async id => {
        const ex = KEX.state.exercises.find(e => e.id === id);
        if (!ex) return;
        KEX.state.selected = ex;
        await loadLinkedData(id);
        renderExerciseDetail(ex);
      },
      state: KEX.state
    };
  }

  async function init() {
    injectStyle();
    injectModule();
    hookTabs();
    hookFilters();

    await activateCoachMode();

    setTimeout(() => {
      loadExercises();
    }, 500);

    exposeApi();
  }

  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", init)
    : init();

})();
