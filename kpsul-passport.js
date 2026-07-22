/* ============================================================
   KPSUL PASSEPORT SANTÉ — le dossier chronologique du client.
   Ne fait AUCUNE requête pour les données de base : tout vient
   du noyau KpsulStore (measures, score, workouts, habits).
   Seule exception : les URLs signées des photos (stockage privé).
   ============================================================ */
(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));
  const sb = () => window.sb || null;
  const esc = v => String(v ?? "").replace(/[&<>"']/g, s =>
    ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[s]));
  const round1 = n => Math.round(Number(n || 0) * 10) / 10;
  const monthLabel = ym => {
    const [y, m] = ym.split("-");
    return new Date(Number(y), Number(m) - 1, 1)
      .toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  };

  const photoUrlCache = {};

  /* ─── STYLE ────────────────────────────────────────────────── */
  function injectStyle() {
    if ($("kpassStyle")) return;
    const st = document.createElement("style");
    st.id = "kpassStyle";
    st.textContent = `
      .kpass-hero{border:1px solid rgba(52,224,200,.3);border-radius:20px;
        background:linear-gradient(165deg,rgba(52,224,200,.08),transparent);
        padding:20px;margin-bottom:16px}
      .kpass-hero .tag{font-family:var(--mono,monospace);font-size:10px;
        letter-spacing:.16em;text-transform:uppercase;color:var(--core,#34E0C8)}
      .kpass-hero h3{margin:6px 0 4px;font-family:var(--disp,system-ui);font-size:22px}
      .kpass-hero p{color:#8A9A93;font-size:13px;margin:0;line-height:1.5}

      .kpass-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-bottom:20px}
      .kpass-stat{border:1px solid var(--line,#22403A);border-radius:13px;
        background:rgba(4,10,9,.34);padding:13px;text-align:center}
      .kpass-stat b{display:block;font-family:var(--disp,system-ui);font-size:19px;color:var(--core,#34E0C8)}
      .kpass-stat span{font-size:10.5px;color:#8A9A93;display:block;margin-top:3px}

      .kpass-timeline{position:relative;padding-left:22px;margin-top:6px}
      .kpass-timeline::before{content:"";position:absolute;left:6px;top:6px;bottom:6px;
        width:1px;background:linear-gradient(var(--core,#34E0C8),var(--line,#22403A))}
      .kpass-month{position:relative;margin-bottom:22px}
      .kpass-month::before{content:"";position:absolute;left:-22px;top:4px;
        width:11px;height:11px;border-radius:50%;background:var(--core,#34E0C8);
        box-shadow:0 0 0 4px rgba(52,224,200,.16)}
      .kpass-month-label{font-family:var(--disp,system-ui);font-size:16px;
        text-transform:capitalize;margin:0 0 10px}
      .kpass-card{border:1px solid var(--line,#22403A);border-radius:16px;
        background:rgba(255,255,255,.02);padding:14px;display:flex;gap:13px}
      .kpass-photo{width:64px;height:84px;border-radius:11px;object-fit:cover;
        border:1px solid var(--line,#22403A);flex:0 0 auto;background:#0a1815}
      .kpass-photo-ph{width:64px;height:84px;border-radius:11px;flex:0 0 auto;
        border:1px dashed var(--line,#22403A);display:flex;align-items:center;
        justify-content:center;font-size:20px;color:#3a4a45}
      .kpass-body{flex:1;min-width:0}
      .kpass-row{display:flex;justify-content:space-between;gap:8px;
        padding:5px 0;border-bottom:1px solid rgba(34,64,58,.6);font-size:13px}
      .kpass-row:last-child{border-bottom:none}
      .kpass-row span{color:#8A9A93}
      .kpass-row b{color:var(--paper,#ECEFE9)}
      .kpass-highlight{margin-top:8px;font-size:12.5px;color:var(--core,#34E0C8);
        background:rgba(52,224,200,.08);border-radius:9px;padding:7px 10px;line-height:1.4}

      .kpass-empty{color:#5E6E68;font-size:13px;padding:8px 2px}
      .kpass-more{width:100%;margin-top:6px}
      .kpass-status{font-size:12.5px;color:var(--core,#34E0C8);text-align:center;min-height:16px}

      .kpass-lightbox{position:fixed;inset:0;z-index:400;background:rgba(2,8,7,.92);
        display:flex;align-items:center;justify-content:center;padding:24px}
      .kpass-lightbox img{max-width:100%;max-height:85vh;border-radius:14px}
      .kpass-lightbox-close{position:absolute;top:18px;right:18px;
        width:38px;height:38px;border-radius:50%;border:1px solid var(--line,#22403A);
        background:rgba(4,10,9,.6);color:#ECEFE9;font-size:18px;cursor:pointer}
    `;
    document.head.appendChild(st);
  }

  /* ─── CARTE + PANNEAU ──────────────────────────────────────── */
  function injectCard() {
    if (qs('[data-goto="modKpsulPassport"]')) return;
    const grid = qs(".member-tiles");
    if (!grid) return;
    const card = document.createElement("div");
    card.className = "mtile";
    card.dataset.goto = "modKpsulPassport";
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");
    card.innerHTML = `<div class="tag">Historique</div><h4>📖 Mon Passeport Santé</h4><p>Ton dossier chronologique : photos, poids, score, mois après mois.</p><span class="mtile-go">Ouvrir →</span>`;
    grid.appendChild(card);
  }

  function injectModule() {
    if ($("modKpsulPassport")) return;
    const anchor = qs(".module-panel");
    if (!anchor) return;
    anchor.insertAdjacentHTML("beforebegin", `
      <div class="module-panel" id="modKpsulPassport">
        <div class="tool-panel">
          <div class="kpass-hero">
            <span class="tag">— Depuis le premier jour</span>
            <h3>📖 Ton Passeport Santé</h3>
            <p>Personne ne veut perdre son historique. Chaque mois de suivi enrichit
            ce dossier — poids, photos, score, progression. Il t'appartient.</p>
          </div>
          <div class="kpass-stats" id="kpassStats">
            <div class="kpass-stat"><b>—</b><span>Mois suivis</span></div>
            <div class="kpass-stat"><b>—</b><span>Photos</span></div>
            <div class="kpass-stat"><b>—</b><span>Poids total</span></div>
          </div>
          <div class="kpass-status" id="kpassStatus"></div>
          <div class="kpass-timeline" id="kpassTimeline"><div class="kpass-empty">Chargement…</div></div>
        </div>
      </div>`);
  }

  /* ─── CONSTRUCTION DES MOIS ────────────────────────────────── */
  function buildMonths() {
    const S = window.KpsulStore;
    if (!S || !S.isReady()) return [];

    const measures = S.get("measures");
    const scores   = S.get("score");
    const workouts = S.get("workouts");
    const habits   = S.get("habits");

    const months = {};
    const ensure = ym => months[ym] || (months[ym] = {
      ym, weights: [], waists: [], photos: [], scores: [], sleeps: [], workoutDays: new Set(),
    });

    measures.forEach(m => {
      if (!m.log_date) return;
      const ym = m.log_date.slice(0, 7);
      const bucket = ensure(ym);
      if (m.weight_kg != null) bucket.weights.push({ d: m.log_date, v: Number(m.weight_kg) });
      if (m.waist_cm != null) bucket.waists.push(Number(m.waist_cm));
      if (m.photo_path) bucket.photos.push({ d: m.log_date, path: m.photo_path });
    });
    scores.forEach(s => {
      if (!s.score_date || s.global_score == null) return;
      ensure(s.score_date.slice(0, 7)).scores.push(Number(s.global_score));
    });
    workouts.forEach(w => {
      if (!w.log_date) return;
      ensure(w.log_date.slice(0, 7)).workoutDays.add(w.log_date);
    });
    habits.forEach(h => {
      if (!h.log_date || h.sleep_hours == null) return;
      ensure(h.log_date.slice(0, 7)).sleeps.push(Number(h.sleep_hours));
    });

    const byExoByMonth = {};
    workouts.forEach(w => {
      if (!w.log_date || !w.exercise_name || !w.load_kg) return;
      const ym = w.log_date.slice(0, 7);
      const key = ym + "|" + w.exercise_name;
      byExoByMonth[key] = Math.max(byExoByMonth[key] || 0, Number(w.load_kg));
    });

    const list = Object.values(months).sort((a, b) => b.ym.localeCompare(a.ym));
    list.forEach((m, i) => {
      const prev = list[i + 1];
      m.avgWeight = m.weights.length ? round1(m.weights.reduce((a, b) => a + b.v, 0) / m.weights.length) : null;
      m.deltaWeight = (m.weights.length && prev?.weights.length)
        ? round1(m.weights[m.weights.length - 1].v - prev.weights[prev.weights.length - 1].v) : null;
      m.avgScore = m.scores.length ? Math.round(m.scores.reduce((a, b) => a + b, 0) / m.scores.length) : null;
      m.avgSleep = m.sleeps.length ? round1(m.sleeps.reduce((a, b) => a + b, 0) / m.sleeps.length) : null;
      m.activeDays = m.workoutDays.size;
      m.coverPhoto = m.photos[m.photos.length - 1] || null;

      let bestExo = null, bestDelta = -Infinity;
      Object.keys(byExoByMonth).forEach(key => {
        if (!key.startsWith(m.ym + "|")) return;
        const exo = key.split("|")[1];
        const prevKey = prev ? prev.ym + "|" + exo : null;
        if (prevKey && byExoByMonth[prevKey]) {
          const d = byExoByMonth[key] - byExoByMonth[prevKey];
          if (d > bestDelta && d > 0) { bestDelta = d; bestExo = exo; }
        }
      });
      m.highlight = bestExo ? `💪 ${bestExo} en progression (+${round1(bestDelta)} kg ce mois)` : null;
    });

    return list;
  }

  /* ─── PHOTOS SIGNÉES ───────────────────────────────────────── */
  async function getPhotoUrl(path) {
    if (photoUrlCache[path]) return photoUrlCache[path];
    const client = sb(); if (!client) return null;
    try {
      const { data } = await client.storage.from("progress-photos").createSignedUrl(path, 3600);
      photoUrlCache[path] = data?.signedUrl || null;
      return photoUrlCache[path];
    } catch (e) { return null; }
  }

  /* ─── RENDU ─────────────────────────────────────────────────── */
  let shown = 6;
  const PAGE_SIZE = 6;

  async function render() {
    const box = $("kpassTimeline"); if (!box) return;
    const months = buildMonths();

    const statsEl = $("kpassStats");
    if (statsEl) {
      const totalPhotos = months.reduce((a, m) => a + m.photos.length, 0);
      const weights = months.flatMap(m => m.weights).sort((a, b) => a.d.localeCompare(b.d));
      const totalDelta = weights.length >= 2 ? round1(weights[weights.length - 1].v - weights[0].v) : null;
      statsEl.innerHTML = `
        <div class="kpass-stat"><b>${months.length || "—"}</b><span>Mois suivis</span></div>
        <div class="kpass-stat"><b>${totalPhotos || "—"}</b><span>Photos</span></div>
        <div class="kpass-stat"><b>${totalDelta != null ? (totalDelta >= 0 ? "+" : "") + totalDelta + " kg" : "—"}</b><span>Depuis le début</span></div>`;
    }

    if (!months.length) {
      box.innerHTML = `<div class="kpass-empty">Ton passeport se construit au fil de tes séances, mesures et photos. Reviens dans quelques semaines — chaque mois enrichira ce dossier.</div>`;
      return;
    }

    const slice = months.slice(0, shown);
    box.innerHTML = slice.map(m => `
      <div class="kpass-month">
        <h4 class="kpass-month-label">${esc(monthLabel(m.ym))}</h4>
        <div class="kpass-card">
          ${m.coverPhoto
            ? `<img class="kpass-photo" data-kpass-photo="${esc(m.coverPhoto.path)}" alt="Photo du mois" src="">`
            : `<div class="kpass-photo-ph">📷</div>`}
          <div class="kpass-body">
            <div class="kpass-row"><span>Poids moyen</span><b>${m.avgWeight != null ? m.avgWeight + " kg" + (m.deltaWeight != null ? ` (${m.deltaWeight >= 0 ? "+" : ""}${m.deltaWeight})` : "") : "—"}</b></div>
            <div class="kpass-row"><span>Score moyen</span><b>${m.avgScore != null ? m.avgScore + "%" : "—"}</b></div>
            <div class="kpass-row"><span>Jours de séance</span><b>${m.activeDays || "—"}</b></div>
            <div class="kpass-row"><span>Sommeil moyen</span><b>${m.avgSleep != null ? m.avgSleep + " h" : "—"}</b></div>
            ${m.highlight ? `<div class="kpass-highlight">${esc(m.highlight)}</div>` : ""}
          </div>
        </div>
      </div>`).join("");

    if (months.length > shown) {
      box.insertAdjacentHTML("beforeend",
        `<button class="btn btn-ghost kpass-more" id="kpassMore" type="button">Voir les mois précédents</button>`);
      $("kpassMore")?.addEventListener("click", () => { shown += PAGE_SIZE; render(); });
    }

    qsa("[data-kpass-photo]", box).forEach(async img => {
      const url = await getPhotoUrl(img.dataset.kpassPhoto);
      if (url) { img.src = url; img.style.cursor = "zoom-in"; img.addEventListener("click", () => openLightbox(url)); }
    });
  }

  function openLightbox(url) {
    const box = document.createElement("div");
    box.className = "kpass-lightbox";
    box.innerHTML = `<button class="kpass-lightbox-close" type="button">✕</button><img src="${url}" alt="Photo">`;
    box.addEventListener("click", e => { if (e.target === box || e.target.closest(".kpass-lightbox-close")) box.remove(); });
    document.body.appendChild(box);
  }

  /* ─── INIT ─────────────────────────────────────────────────── */
  function init() {
    injectStyle();
    injectCard();
    injectModule();
  }

  function connectStore() {
    const S = window.KpsulStore;
    if (!S) { setTimeout(connectStore, 400); return; }
    S.subscribe("measures", render);
    S.subscribe("score", render);
    S.subscribe("workouts", render);
    S.subscribe("habits", render);
    S.ready().then(render);
  }

  new MutationObserver(() => {
    if (document.body.classList.contains("authed")) init();
  }).observe(document.body, { attributeFilter: ["class"] });

  document.addEventListener("click", e => {
    if (e.target.closest('[data-goto="modKpsulPassport"]')) setTimeout(() => { init(); render(); }, 180);
  });

  if (document.body.classList.contains("authed")) init();
  connectStore();
})();
