/* KPSUL -- PÉDAGOGIE : corps, évolution, journal compréhension */
(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));
  const sb = () => window.sb || null;

  const safe = v => String(v ?? "").replace(/[&<>"']/g, s => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  }[s]));

  const bodyMap = {
    pectoraux: "PECTORAUX\n\nRôle : pousser et rapprocher le bras vers l’avant.\n\nExercices : développé couché, développé incliné, pompes, écartés.\n\nErreur fréquente : laisser les épaules prendre tout le travail.",
    dos: "DOS\n\nRôle : tirer, stabiliser les épaules, améliorer la posture.\n\nExercices : tirage vertical, rowing, tractions.\n\nAstuce : pense à tirer avec les coudes.",
    epaules: "ÉPAULES\n\nRôle : lever, pousser et stabiliser le bras.\n\nZones : deltoïde antérieur, latéral, postérieur.\n\nErreur fréquente : mettre trop lourd sans contrôle.",
    quadriceps: "QUADRICEPS\n\nRôle : tendre le genou.\n\nExercices : squat, presse, leg extension, fentes.",
    ischios: "ISCHIOS\n\nRôle : fléchir le genou et aider l’extension de hanche.\n\nExercices : leg curl, soulevé de terre roumain.",
    fessiers: "FESSIERS\n\nRôle : extension de hanche, stabilité du bassin, puissance.\n\nExercices : hip thrust, squat, fentes.",
    biceps: "BICEPS\n\nRôle : flexion du coude, assistance aux tirages.\n\nExercices : curl incliné, curl marteau.",
    triceps: "TRICEPS\n\nRôle : extension du coude, poussée.\n\nExercices : extension corde, barre au front, dips.",
    gainage: "GAINAGE\n\nRôle : stabiliser le tronc et transmettre la force.\n\nExercices : planche, dead bug, pallof press."
  };

  function injectPanels() {
    const anchor = qs(".module-panel");
    if (!anchor) return;

    if (!$("modKpsulBody")) {
      anchor.insertAdjacentHTML("beforebegin", `
        <div class="module-panel" id="modKpsulBody">
          <div class="tool-panel">
            <h3>🧠 Comprendre mon corps</h3>
            <p>Choisis une zone pour comprendre son rôle, les exercices associés et les erreurs fréquentes.</p>
            <div class="kpsulx-body-grid">
              ${Object.keys(bodyMap).map(z => `<button class="kpsulx-body-btn" data-body="${z}" type="button">${z}</button>`).join("")}
            </div>
            <div class="kpsulx-body-info" id="bodyInfo">Choisis une zone.</div>
          </div>
        </div>
      `);
    }

    if (!$("modKpsulEvolution")) {
      anchor.insertAdjacentHTML("beforebegin", `
        <div class="module-panel" id="modKpsulEvolution">
          <div class="tool-panel">
            <h3>📈 Mon évolution</h3>
            <p>Ta chronologie complète : repas, séances, programmes, documents et questions.</p>
            <div class="kpsulx-timeline" id="evolutionTimeline">
              <div class="kpsulx-event"><time>Départ</time><div><b>Ton parcours commence ici</b><span>Les prochaines données apparaîtront automatiquement.</span></div></div>
            </div>
          </div>
        </div>
      `);
    }

    if (!$("modKpsulUnderstanding")) {
      anchor.insertAdjacentHTML("beforebegin", `
        <div class="module-panel" id="modKpsulUnderstanding">
          <div class="tool-panel">
            <h3>📝 Journal compréhension</h3>
            <p>Pose une question sur ton programme. L’assistant explique sans modifier les choix du coach.</p>
            <textarea id="understandingQuestion" placeholder="Ex : pourquoi j’ai du développé incliné ?"></textarea>
            <button class="btn btn-primary" id="saveUnderstanding" type="button" style="margin-top:10px">Enregistrer ma question</button>
            <div class="kpsulx-status" id="understandingStatus"></div>
            <div class="kpsulx-answer" id="understandingAnswer">Aucune question pour l’instant.</div>
            <div class="kpsulx-list" id="understandingList"></div>
          </div>
        </div>
      `);
    }
  }

  function openModule(id) {
    const panel = $(id);
    if (!panel) {
      alert("Module indisponible : " + id);
      return;
    }

    document.body.classList.add("kpsul-panel-open");

    qsa(".module-panel").forEach(p => p.classList.toggle("active", p.id === id));
    qsa(".module-tab").forEach(t => t.classList.toggle("active", t.dataset.module === id));

    panel.scrollIntoView({ behavior: "smooth", block: "start" });

    if (id === "modKpsulEvolution") loadTimeline();
    if (id === "modKpsulUnderstanding") loadUnderstanding();
  }

  function hookTiles() {
    qsa("[data-goto]").forEach(tile => {
      if (tile.dataset.pedHooked) return;
      tile.dataset.pedHooked = "1";

      tile.addEventListener("click", () => openModule(tile.dataset.goto));

      tile.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openModule(tile.dataset.goto);
        }
      });
    });
  }

  function hookBodyButtons() {
    qsa("[data-body]").forEach(btn => {
      if (btn.dataset.bodyHooked) return;
      btn.dataset.bodyHooked = "1";

      btn.addEventListener("click", () => {
        qsa("[data-body]").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        $("bodyInfo").textContent = bodyMap[btn.dataset.body] || "Zone non renseignée.";
      });
    });
  }

  async function userId() {
    const client = sb();
    if (!client) return null;
    const { data } = await client.auth.getSession();
    return data?.session?.user?.id || null;
  }

  async function loadTimeline() {
    const client = sb();
    const uid = await userId();
    const box = $("evolutionTimeline");
    if (!client || !uid || !box) return;

    box.innerHTML = `<div class="kpsulx-item"><b>Chargement…</b></div>`;

    const tables = [
      ["nutrition_logs", "Repas renseigné", r => `${r.meal_name || "Repas"} · ${r.calories || 0} kcal`],
      ["workout_exercise_logs", "Séance renseignée", r => `${r.exercise_name || "Exercice"} · ${r.sets || 0} séries · ${r.reps || 0} reps`],
      ["programs", "Programme reçu", r => r.titre || r.title || "Programme"],
      ["client_documents", "Document reçu", r => r.title || r.file_name || "Document"],
      ["understanding_logs", "Question posée", r => r.question || "Question"]
    ];

    let events = [];

    for (const [table, title, format] of tables) {
      const { data } = await client.from(table).select("*").eq("user_id", uid).order("created_at", { ascending:false }).limit(5);
      (data || []).forEach(r => events.push({
        date: r.created_at || r.log_date,
        title,
        text: format(r)
      }));
    }

    events.sort((a,b) => new Date(b.date || 0) - new Date(a.date || 0));
    events = events.slice(0, 15);

    if (!events.length) {
      box.innerHTML = `<div class="kpsulx-event"><time>Départ</time><div><b>Ton parcours commence ici</b><span>Ajoute tes premières données.</span></div></div>`;
      return;
    }

    box.innerHTML = events.map(e => `
      <div class="kpsulx-event">
        <time>${safe(e.date ? new Date(e.date).toLocaleDateString("fr-FR") : "--")}</time>
        <div><b>${safe(e.title)}</b><span>${safe(e.text)}</span></div>
      </div>
    `).join("");
  }

  function scientificAnswer(q) {
    if (typeof window.scientificAnswer === "function") return window.scientificAnswer(q);

    return `Réponse pédagogique Kpsul :

Je peux t’aider à comprendre ton programme, un muscle, une consigne, la récupération, le tempo, le RPE ou la nutrition.

Je ne peux pas modifier ton programme, remplacer un exercice ou changer une consigne importante sans validation du coach.

Question :
${q}`;
  }

  async function saveUnderstanding() {
    const client = sb();
    const uid = await userId();
    const q = $("understandingQuestion")?.value.trim();

    if (!q) {
      $("understandingStatus").textContent = "Écris une question.";
      return;
    }

    if (!client || !uid) {
      $("understandingStatus").textContent = "Connecte-toi pour enregistrer.";
      return;
    }

    const answer = scientificAnswer(q);
    $("understandingAnswer").textContent = answer;
    $("understandingStatus").textContent = "Enregistrement…";

    const { error } = await client.from("understanding_logs").insert({
      user_id: uid,
      question: q,
      mood: "question",
      answer
    });

    if (error) {
      $("understandingStatus").textContent = "Erreur : " + error.message;
      return;
    }

    $("understandingQuestion").value = "";
    $("understandingStatus").textContent = "Question enregistrée ✔";
    loadUnderstanding();
  }

  async function loadUnderstanding() {
    const client = sb();
    const uid = await userId();
    const box = $("understandingList");
    if (!client || !uid || !box) return;

    const { data, error } = await client.from("understanding_logs")
      .select("*")
      .eq("user_id", uid)
      .order("created_at", { ascending:false })
      .limit(20);

    if (error) {
      box.innerHTML = `<div class="kpsulx-item kpsulx-red"><b>Erreur</b><span>${safe(error.message)}</span></div>`;
      return;
    }

    if (!data?.length) {
      box.innerHTML = `<div class="kpsulx-item"><b>Aucune question</b><span>Tes questions apparaîtront ici.</span></div>`;
      return;
    }

    box.innerHTML = data.map(r => `
      <div class="kpsulx-item">
        <b>${safe(new Date(r.created_at).toLocaleDateString("fr-FR"))}</b>
        <span>${safe(r.question)}</span>
        <span>${safe(r.answer)}</span>
      </div>
    `).join("");
  }

  function init() {
    injectPanels();
    hookTiles();
    hookBodyButtons();

    $("saveUnderstanding")?.addEventListener("click", saveUnderstanding);

    setTimeout(() => {
      hookTiles();
      hookBodyButtons();
    }, 700);
  }

  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", init)
    : init();
})();