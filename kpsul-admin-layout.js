/* KPSUL — ORGANISATION DE L'ESPACE ADMIN (v2 générique)
   Regroupe DANS le tableau de bord admin (#adminDashboard) :
   1. la sécurité 2FA (modKpsul2FA)
   2. le CRM Mes clients (modKpsulCRM)
   3. TOUTE autre carte coach trouvée dans l'espace membre
      (classe .admin-zone), quel que soit le module qui l'a créée —
      leurs panneaux s'ouvrent en accordéon directement dans l'admin.
   Verrouille l'ensemble tant que la 2FA n'est pas validée. */
(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));

  /* ─── STYLE ────────────────────────────────────────────────── */
  function injectStyle() {
    if ($("kalStyle")) return;
    const st = document.createElement("style");
    st.id = "kalStyle";
    st.textContent = `
      #kpsulCoachZone { margin-top: 8px }
      #kpsulSlot2fa .module-panel,
      #kpsulSlotCrm .module-panel {
        display:block !important; position:static; margin:0 0 22px;
      }
      .kal-h {
        font-family: var(--mono, monospace); font-size: 11px;
        letter-spacing: .14em; text-transform: uppercase;
        color: var(--core, #34E0C8); margin: 26px 0 12px;
        display: flex; align-items: center; gap: 10px;
      }
      .kal-h::after { content:""; flex:1; height:1px; background: var(--line, #22403A) }

      #kalToolsGrid { margin: 0 0 8px }
      #kalToolsGrid .mtile { display:block }

      .kal-acc { display:none }
      .kal-acc.kal-acc-open { display:block }
      .kal-acc .module-panel {
        display:block !important; position:static; margin:12px 0 22px;
      }
      .kal-acc-close {
        display:inline-flex; margin:0 0 10px;
        border:1px solid var(--line,#22403A); background:none;
        color:var(--core,#34E0C8); border-radius:99px; padding:8px 15px;
        font-family:var(--mono,monospace); font-size:11px; letter-spacing:.06em;
        cursor:pointer;
      }

      body.admin-mode:not(.kpsul-aal2) .kal-locked { display: none !important }
    `;
    document.head.appendChild(st);
  }

  /* ─── STRUCTURE ────────────────────────────────────────────── */
  function ensureZone() {
    const dash = $("adminDashboard");
    if (!dash) return null;

    let zone = $("kpsulCoachZone");
    if (!zone) {
      zone = document.createElement("div");
      zone.id = "kpsulCoachZone";
      zone.innerHTML = `
        <div class="kal-h">🔐 Sécurité</div>
        <div id="kpsulSlot2fa"></div>
        <div class="kal-locked">
          <div class="kal-h">👥 Clients</div>
          <div id="kpsulSlotCrm"></div>
          <div id="kpsulSlotTools" style="display:none">
            <div class="kal-h">🛠 Autres outils coach</div>
            <div id="kalToolsGrid" class="member-tiles"></div>
            <div id="kalAccHolder"></div>
          </div>
        </div>`;
      dash.appendChild(zone);
      hookToolsGrid();
    }

    Array.from(dash.children).forEach(ch => {
      if (ch.id !== "kpsulCoachZone") ch.classList.add("kal-locked");
    });
    return zone;
  }

  /* ─── RELOCALISATION ───────────────────────────────────────── */
  function relocate() {
    injectStyle();
    const zone = ensureZone();
    if (!zone) return;

    const p2fa = $("modKpsul2FA");
    if (p2fa && p2fa.parentElement !== $("kpsulSlot2fa")) $("kpsulSlot2fa").appendChild(p2fa);
    const pcrm = $("modKpsulCRM");
    if (pcrm && pcrm.parentElement !== $("kpsulSlotCrm")) $("kpsulSlotCrm").appendChild(pcrm);

    const strays = qsa("#member .mtile.admin-zone, #member .kpsul-lock-card");
    strays.forEach(card => {
      if (card.classList.contains("kpsul-lock-card") ||
          ["modKpsulCRM","modKpsul2FA"].includes(card.dataset.goto)) {
        card.remove();
        return;
      }
      if (card.dataset.goto) {
        card.dataset.kalGoto = card.dataset.goto;
        card.removeAttribute("data-goto");
      }
      $("kalToolsGrid")?.appendChild(card);
    });
    if ($("kalToolsGrid")?.children.length) $("kpsulSlotTools").style.display = "";
  }

  /* ─── ACCORDÉON DES PANNEAUX COACH ─────────────────────────── */
  function hookToolsGrid() {
    $("kalToolsGrid")?.addEventListener("click", e => {
      const card = e.target.closest("[data-kal-goto]");
      if (!card) return;
      const id = card.dataset.kalGoto;
      const panel = $(id);
      const holder = $("kalAccHolder");
      if (!panel || !holder) return;

      let acc = holder.querySelector(`[data-kal-acc="${id}"]`);
      if (!acc) {
        acc = document.createElement("div");
        acc.className = "kal-acc";
        acc.dataset.kalAcc = id;
        const close = document.createElement("button");
        close.className = "kal-acc-close";
        close.type = "button";
        close.textContent = "← Fermer";
        close.addEventListener("click", () => acc.classList.remove("kal-acc-open"));
        acc.appendChild(close);
        acc.appendChild(panel);
        holder.appendChild(acc);
      }
      qsa(".kal-acc", holder).forEach(a => a.classList.toggle("kal-acc-open", a === acc));
      acc.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  /* ─── ENTRÉE DANS L'ADMIN ──────────────────────────────────── */
  function onEnterAdmin() {
    relocate();
    window.Kpsul2FA?.refresh?.();
    if (document.body.classList.contains("kpsul-aal2")) {
      window.KpsulCRM?.open?.();
    }
  }

  /* ─── HOOKS ────────────────────────────────────────────────── */
  document.addEventListener("click", e => {
    if (e.target.closest("#coachSwitchBtn")) setTimeout(onEnterAdmin, 220);
  });

  document.addEventListener("kpsul:aal2-unlocked", () => {
    if (document.body.classList.contains("admin-mode")) {
      setTimeout(() => window.KpsulCRM?.open?.(), 150);
    }
  });

  new MutationObserver(() => {
    if (document.body.classList.contains("authed")) relocate();
    if (document.body.classList.contains("admin-mode") &&
        document.body.classList.contains("kpsul-aal2") &&
        !window.__kalCrmLoaded) {
      window.__kalCrmLoaded = true;
      window.KpsulCRM?.open?.();
    }
    if (!document.body.classList.contains("admin-mode")) {
      window.__kalCrmLoaded = false;
    }
  }).observe(document.body, { attributeFilter: ["class"] });

  const grid = () => document.querySelector("#member .member-tiles");
  const tilesObs = new MutationObserver(() => {
    if (document.querySelector("#member .mtile.admin-zone, #member .kpsul-lock-card")) relocate();
  });
  function watchTiles() {
    const g = grid();
    if (g) tilesObs.observe(g, { childList: true });
  }
  watchTiles();
  new MutationObserver(watchTiles).observe(document.body, { attributeFilter: ["class"] });

  if (document.body.classList.contains("authed")) relocate();
})();
