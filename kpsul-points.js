/* ============================================================
   KPSUL POINTS — un point gagné chaque jour où le score dépasse
   le seuil. Calculé depuis KpsulStore (aucune nouvelle requête
   pour les données de base). Les récompenses sont des PALIERS
   déclaratifs (à débloquer avec toi, coach — pas de paiement
   automatisé, juste une vitrine motivante et honnête).
   ============================================================ */
(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));
  const sb = () => window.sb || null;
  const esc = v => String(v ?? "").replace(/[&<>"']/g, s =>
    ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[s]));

  const THRESHOLD = 60; // score du jour ≥ 60% = 1 point gagné

  // Paliers de récompenses — à ajuster librement par le coach,
  // aucune automatisation financière : c'est le coach qui les honore.
  const REWARDS = [
    { at: 5,   label: "🎉 Premier palier",           detail: "Continue, ton dossier prend forme." },
    { at: 15,  label: "💧 Bilan hydratation offert",  detail: "Demande-le à ton coach." },
    { at: 30,  label: "📋 Bilan nutritionnel offert", detail: "Un mois de régularité, ça se fête." },
    { at: 60,  label: "🏋️ Séance de coaching offerte",detail: "Deux mois de sérieux — bravo." },
    { at: 100, label: "🥇 Analyse corporelle complète",detail: "Le palier des habitués." },
    { at: 200, label: "👑 Mois d'abonnement offert",   detail: "Une vraie fidélité, un vrai geste en retour." },
  ];

  /* ─── STYLE ────────────────────────────────────────────────── */
  function injectStyle() {
    if ($("kptsStyle")) return;
    const st = document.createElement("style");
    st.id = "kptsStyle";
    st.textContent = `
      .kpts-hero{border:1px solid rgba(52,224,200,.3);border-radius:20px;
        background:linear-gradient(165deg,rgba(52,224,200,.09),transparent);
        padding:22px;margin-bottom:18px;text-align:center}
      .kpts-hero .tag{font-family:var(--mono,monospace);font-size:10px;
        letter-spacing:.16em;text-transform:uppercase;color:var(--core,#34E0C8)}
      .kpts-count{font-family:var(--disp,system-ui);font-size:52px;color:var(--core,#34E0C8);
        margin:8px 0 2px;line-height:1}
      .kpts-count small{font-size:16px;color:#8A9A93;font-weight:400}
      .kpts-rule{color:#8A9A93;font-size:12.5px;margin:6px 0 0}

      .kpts-progress{border:1px solid var(--line,#22403A);border-radius:14px;
        background:rgba(4,10,9,.34);padding:14px;margin-bottom:18px}
      .kpts-progress-top{display:flex;justify-content:space-between;font-size:13px;margin-bottom:8px}
      .kpts-progress-top b{color:var(--core,#34E0C8)}
      .kpts-bar{height:9px;border-radius:99px;background:#07110f;border:1px solid var(--line,#22403A);overflow:hidden}
      .kpts-bar i{display:block;height:100%;background:linear-gradient(90deg,var(--core,#34E0C8),var(--shell,#E7D9C4));
        transition:width .5s ease}

      .kpts-h{font-family:var(--mono,monospace);font-size:11px;letter-spacing:.12em;
        text-transform:uppercase;color:#8A9A93;margin:18px 0 10px}
      .kpts-reward{display:flex;align-items:center;gap:12px;border:1px solid var(--line,#22403A);
        border-radius:14px;background:rgba(255,255,255,.02);padding:13px;margin-bottom:8px}
      .kpts-reward.done{border-color:rgba(52,224,200,.4);background:rgba(52,224,200,.06)}
      .kpts-reward .ico{width:38px;height:38px;border-radius:50%;flex:0 0 auto;
        display:flex;align-items:center;justify-content:center;font-size:18px;
        border:1px solid var(--line,#22403A);background:rgba(4,10,9,.4)}
      .kpts-reward.done .ico{border-color:var(--core,#34E0C8);background:rgba(52,224,200,.14)}
      .kpts-reward b{display:block;font-size:14px}
      .kpts-reward span{display:block;color:#8A9A93;font-size:12px;margin-top:2px}
      .kpts-reward .pts{margin-left:auto;font-family:var(--mono,monospace);font-size:11px;
        color:#8A9A93;flex:0 0 auto;white-space:nowrap}
      .kpts-reward.done .pts{color:var(--core,#34E0C8)}
      .kpts-empty{color:#5E6E68;font-size:13px}
    `;
    document.head.appendChild(st);
  }

  /* ─── CARTE + PANNEAU ──────────────────────────────────────── */
  function injectCard() {
    if (qs('[data-goto="modKpsulPoints"]')) return;
    const grid = qs(".member-tiles");
    if (!grid) return;
    const card = document.createElement("div");
    card.className = "mtile";
    card.dataset.goto = "modKpsulPoints";
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");
    card.innerHTML = `<div class="tag">Récompenses</div><h4>🏆 Kpsul Points</h4><p>Un point chaque jour où ton score dépasse ${THRESHOLD}%.</p><span class="mtile-go">Ouvrir →</span>`;
    grid.appendChild(card);
  }

  function injectModule() {
    if ($("modKpsulPoints")) return;
    const anchor = qs(".module-panel");
    if (!anchor) return;
    anchor.insertAdjacentHTML("beforebegin", `
      <div class="module-panel" id="modKpsulPoints">
        <div class="tool-panel">
          <div class="kpts-hero">
            <span class="tag">— Ton investissement te revient</span>
            <div class="kpts-count" id="kptsCount">— <small>points</small></div>
            <p class="kpts-rule">1 point à chaque jour où ton Kpsul Score dépasse ${THRESHOLD} %.</p>
          </div>
          <div class="kpts-progress">
            <div class="kpts-progress-top"><span>Prochain palier</span><b id="kptsNext">—</b></div>
            <div class="kpts-bar"><i id="kptsBar" style="width:0%"></i></div>
          </div>
          <div class="kpts-h">Paliers de récompenses</div>
          <div id="kptsRewards"><div class="kpts-empty">Chargement…</div></div>
        </div>
      </div>`);
  }

  /* ─── CALCUL ───────────────────────────────────────────────── */
  function computePoints() {
    const S = window.KpsulStore;
    if (!S || !S.isReady()) return 0;
    const scores = S.get("score"); // [{score_date, global_score}]
    return scores.filter(s => Number(s.global_score) >= THRESHOLD).length;
  }

  function render() {
    const pts = computePoints();
    const countEl = $("kptsCount");
    if (countEl) countEl.innerHTML = `${pts} <small>point${pts > 1 ? "s" : ""}</small>`;

    const next = REWARDS.find(r => r.at > pts);
    const nextEl = $("kptsNext"), barEl = $("kptsBar");
    if (next) {
      const prevAt = [...REWARDS].reverse().find(r => r.at <= pts)?.at || 0;
      const pct = Math.round(((pts - prevAt) / (next.at - prevAt)) * 100);
      if (nextEl) nextEl.textContent = `${next.label} — ${next.at - pts} pt(s) restant(s)`;
      if (barEl) barEl.style.width = Math.max(4, pct) + "%";
    } else {
      if (nextEl) nextEl.textContent = "Tous les paliers actuels sont débloqués 🎉";
      if (barEl) barEl.style.width = "100%";
    }

    const box = $("kptsRewards");
    if (box) box.innerHTML = REWARDS.map(r => `
      <div class="kpts-reward ${pts >= r.at ? "done" : ""}">
        <div class="ico">${pts >= r.at ? "✅" : "🔒"}</div>
        <div><b>${esc(r.label)}</b><span>${esc(r.detail)}</span></div>
        <div class="pts">${r.at} pts</div>
      </div>`).join("");
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
    S.subscribe("score", render);
    S.ready().then(render);
  }

  new MutationObserver(() => {
    if (document.body.classList.contains("authed")) init();
  }).observe(document.body, { attributeFilter: ["class"] });

  document.addEventListener("click", e => {
    if (e.target.closest('[data-goto="modKpsulPoints"]')) setTimeout(() => { init(); render(); }, 180);
  });

  if (document.body.classList.contains("authed")) init();
  connectStore();
})();
