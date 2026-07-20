/* KPSUL -- ESPACE COACH PROTÉGÉ (2FA TOTP via Supabase MFA) */
(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));
  const sb = () => window.sb || null;
  const safe = v => String(v ?? "").replace(/[&<>"']/g, s =>
    ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[s]));

  let isCoach = false;
  let factorId = null;      // facteur TOTP vérifié existant
  let enrollingId = null;   // facteur en cours d'inscription

  /* ─── STYLE ────────────────────────────────────────────────── */
  function injectStyle() {
    if ($("k2faStyle")) return;
    const st = document.createElement("style");
    st.id = "k2faStyle";
    st.textContent = `
      /* Tant que la 2FA n'est pas validée, l'espace coach est masqué */
      body.admin:not(.kpsul-aal2) .admin-zone { display:none !important }
      /* Carte cadenas : visible seulement pour un coach non déverrouillé */
      .kpsul-lock-card { display:none }
      body.admin:not(.kpsul-aal2) .kpsul-lock-card { display:block }
      body.kpsul-aal2 .kpsul-lock-card { display:none }

      .k2fa-box {
        border:1px solid rgba(52,224,200,.3);border-radius:16px;
        background:rgba(52,224,200,.05);padding:18px;margin-bottom:16px;
      }
      .k2fa-box p { color:#C6D0CB;font-size:14px;margin:0 0 12px;line-height:1.5 }
      .k2fa-qr {
        display:block !important;width:200px;height:200px;margin:14px auto;
        background:#fff;border-radius:14px;padding:10px;
        opacity:1 !important;visibility:visible !important;
        position:relative;z-index:2;object-fit:contain;
      }
      #k2faEnrollZone {
        display:block !important;min-height:0;overflow:visible !important;
      }
      .k2fa-secret {
        font-family:var(--mono,monospace);font-size:12px;color:#8A9A93;
        text-align:center;word-break:break-all;
        background:rgba(4,10,9,.4);border:1px dashed var(--line,#22403A);
        border-radius:10px;padding:10px;margin:10px 0;
      }
      .k2fa-code-input {
        width:100%;text-align:center;font-family:var(--mono,monospace);
        font-size:26px;letter-spacing:.35em;padding:14px;
      }
      .k2fa-status { font-size:13px;min-height:18px;margin-top:10px;color:var(--core,#34E0C8) }
      .k2fa-status.err { color:#E8735B }
      .k2fa-steps { color:#8A9A93;font-size:13px;margin:0 0 14px;padding-left:18px }
      .k2fa-steps li { margin-bottom:6px }
      .k2fa-ok {
        text-align:center;padding:24px 10px;
      }
      .k2fa-ok .ico { font-size:42px;display:block;margin-bottom:10px }
      .k2fa-ok b { font-family:var(--disp,system-ui);font-size:20px;display:block;margin-bottom:6px }
      .k2fa-ok span { color:#8A9A93;font-size:13px }
      .k2fa-danger { margin-top:20px;text-align:center }
      .k2fa-danger button {
        background:none;border:1px solid var(--line,#22403A);color:#8A9A93;
        border-radius:99px;padding:8px 15px;font-size:12px;cursor:pointer;
      }
      .k2fa-danger button:hover { border-color:#E8735B;color:#E8735B }
    `;
    document.head.appendChild(st);
  }

  /* ─── INJECTION ────────────────────────────────────────────── */
  function injectCard() {
    if (qs('[data-goto="modKpsul2FA"]')) return;
    const grid = qs(".member-tiles");
    if (!grid) return;
    const card = document.createElement("div");
    card.className = "mtile kpsul-lock-card";
    card.dataset.goto = "modKpsul2FA";
    card.setAttribute("role","button");
    card.setAttribute("tabindex","0");
    card.style.borderColor = "rgba(52,224,200,.45)";
    card.innerHTML = `<div class="tag">Sécurité</div><h4>🔐 Espace coach verrouillé</h4><p>Vérifie ton identité pour accéder aux outils coach.</p><span class="mtile-go">Déverrouiller →</span>`;
    grid.appendChild(card);
  }

  function injectModule() {
    if ($("modKpsul2FA")) return;
    const anchor = qs(".module-panel");
    if (!anchor) return;
    anchor.insertAdjacentHTML("beforebegin", `
      <div class="module-panel" id="modKpsul2FA">
        <div class="tool-panel">
          <h3>🔐 Espace coach</h3>
          <div id="k2faContent"><p style="color:#8A9A93">Chargement…</p></div>
        </div>
      </div>`);
  }

  /* ─── ÉTAT MFA ─────────────────────────────────────────────── */
  async function refreshState() {
    const client = sb(); if (!client) return { state: "none" };
    const { data: sess } = await client.auth.getSession();
    const uid = sess?.session?.user?.id;
    if (!uid) return { state: "none" };

    const { data: profile } = await client.from("profiles")
      .select("role").eq("id", uid).single();
    isCoach = ["coach","admin"].includes(profile?.role);
    if (!isCoach) return { state: "notcoach" };

    // Facteurs existants
    const { data: factors } = await client.auth.mfa.listFactors();
    const verified = (factors?.totp || []).find(f => f.status === "verified");
    factorId = verified?.id || null;

    // Niveau d'assurance actuel
    const { data: aal } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    const current = aal?.currentLevel;

    if (!factorId) return { state: "enroll" };            // pas encore de 2FA
    if (current === "aal2") return { state: "unlocked" }; // déjà validé cette session
    return { state: "challenge" };                        // 2FA active, code requis
  }

  async function applyState() {
    const { state } = await refreshState();
    document.body.classList.toggle("kpsul-aal2",
      state === "unlocked" || (!factorId && state === "notcoach"));
    // un coach SANS 2FA configurée : accès autorisé (sinon il serait enfermé dehors)
    if (isCoach && state === "enroll") document.body.classList.add("kpsul-aal2");
    renderPanel(state);
  }

  /* ─── RENDUS ───────────────────────────────────────────────── */
  function renderPanel(state) {
    const box = $("k2faContent"); if (!box) return;

    if (state === "notcoach") {
      box.innerHTML = `<p style="color:#8A9A93">Cet espace est réservé au coach.</p>`;
      return;
    }

    if (state === "enroll") {
      box.innerHTML = `
        <div class="k2fa-box">
          <p><b>Active la double authentification</b> pour verrouiller ton espace coach. À chaque connexion, un code à 6 chiffres te sera demandé en plus du mot de passe.</p>
          <ol class="k2fa-steps">
            <li>Installe une app d'authentification (Google Authenticator, Authy, ou l'app Mots de passe d'Apple).</li>
            <li>Appuie sur « Générer mon QR code ».</li>
            <li>Scanne le QR avec ton app, puis entre le code à 6 chiffres.</li>
          </ol>
          <button class="btn btn-primary" id="k2faEnrollBtn" type="button" style="width:100%">Générer mon QR code</button>
          <div id="k2faEnrollZone"></div>
          <div class="k2fa-status" id="k2faStatus"></div>
        </div>`;
      $("k2faEnrollBtn")?.addEventListener("click", startEnroll);
      return;
    }

    if (state === "challenge") {
      box.innerHTML = `
        <div class="k2fa-box">
          <p><b>Vérification requise.</b> Entre le code à 6 chiffres de ton app d'authentification pour déverrouiller l'espace coach.</p>
          <input class="k2fa-code-input" id="k2faCode" inputmode="numeric" maxlength="6" placeholder="••••••" autocomplete="one-time-code">
          <button class="btn btn-primary" id="k2faVerifyBtn" type="button" style="width:100%;margin-top:12px">Déverrouiller</button>
          <div class="k2fa-status" id="k2faStatus"></div>
        </div>`;
      $("k2faVerifyBtn")?.addEventListener("click", verifyChallenge);
      $("k2faCode")?.addEventListener("input", e => {
        if (e.target.value.length === 6) verifyChallenge();
      });
      setTimeout(() => $("k2faCode")?.focus(), 100);
      return;
    }

    if (state === "unlocked") {
      box.innerHTML = `
        <div class="k2fa-ok">
          <span class="ico">✅</span>
          <b>Espace coach déverrouillé</b>
          <span>Ta session est protégée par la double authentification.${factorId ? "" : " Pense à activer la 2FA ci-dessous pour verrouiller ton espace."}</span>
        </div>
        <div class="kcrm-actions" style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center">
          <button class="btn btn-primary" id="k2faGoCrm" type="button">👥 Mes clients</button>
          <button class="btn btn-ghost" id="k2faGoAdmin" type="button">🛠 Admin</button>
        </div>
        ${factorId ? `
        <div class="k2fa-danger">
          <button id="k2faDisable" type="button">Désactiver la double authentification</button>
        </div>` : `
        <div class="k2fa-box" style="margin-top:18px">
          <p>La 2FA n'est pas encore active sur ton compte.</p>
          <button class="btn btn-primary" id="k2faEnrollBtn" type="button" style="width:100%">Activer la 2FA maintenant</button>
          <div id="k2faEnrollZone"></div>
          <div class="k2fa-status" id="k2faStatus"></div>
        </div>`}`;
      $("k2faGoCrm")?.addEventListener("click", () => window.KpsulRouter?.openModule("modKpsulCRM"));
      $("k2faGoAdmin")?.addEventListener("click", () => window.KpsulRouter?.openModule("modAdmin"));
      $("k2faEnrollBtn")?.addEventListener("click", startEnroll);
      $("k2faDisable")?.addEventListener("click", disableMfa);
      return;
    }

    box.innerHTML = `<p style="color:#8A9A93">Connecte-toi pour accéder à cet espace.</p>`;
  }
/* ─── INSCRIPTION 2FA ──────────────────────────────────────── */
  function normalizeQrSource(qrCode) {
    const raw = String(qrCode || "").trim();
    if (!raw) return "";

    // Supabase peut renvoyer soit une data URL, soit le SVG brut.
    if (/^(data:image\/|https?:\/\/|blob:)/i.test(raw)) return raw;
    if (raw.startsWith("<svg")) {
      return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(raw);
    }
    return raw;
  }

  async function clearPendingTotpFactors(client) {
    const { data, error } = await client.auth.mfa.listFactors();
    if (error) throw error;

    const pending = (data?.totp || []).filter(f => f.status !== "verified");
    for (const factor of pending) {
      const { error: removeError } = await client.auth.mfa.unenroll({
        factorId: factor.id
      });

      // On continue seulement si le facteur a bien été nettoyé.
      if (removeError) throw removeError;
    }
  }

  async function startEnroll() {
    const client = sb();
    if (!client) {
      setStatus("Erreur : connexion Supabase indisponible.", true);
      return;
    }

    const btn = $("k2faEnrollBtn");
    if (btn) btn.disabled = true;

    const zone = $("k2faEnrollZone");
    if (zone) zone.innerHTML = "";

    setStatus("Génération du QR code…");

    try {
      // Supprime les anciennes inscriptions abandonnées qui provoquent
      // notamment l'erreur mfa_factor_name_conflict.
      await clearPendingTotpFactors(client);

      const { data, error } = await client.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `kpsul-coach-${Date.now()}`
      });

      if (error) throw error;
      if (!data?.id || !data?.totp) {
        throw new Error("Supabase n'a pas renvoyé les données du QR code.");
      }

      enrollingId = data.id;

      const qrSource = normalizeQrSource(data.totp.qr_code);
      const secret = data.totp.secret || "";

      if (!qrSource) {
        throw new Error("Le QR code reçu est vide.");
      }

      if (!zone) {
        throw new Error("La zone d'affichage du QR code est introuvable.");
      }

      zone.innerHTML = `
        <div style="margin-top:16px">
          <img class="k2fa-qr" id="k2faQrImage" src="${safe(qrSource)}" alt="QR code 2FA">
          <p style="text-align:center;color:#8A9A93;font-size:12px;margin:0 0 4px">Si le scan ne marche pas, entre cette clé manuellement :</p>
          <div class="k2fa-secret">${safe(secret)}</div>
          <input class="k2fa-code-input" id="k2faEnrollCode" inputmode="numeric" pattern="[0-9]*" maxlength="6" placeholder="••••••" autocomplete="one-time-code">
          <button class="btn btn-primary" id="k2faConfirmBtn" type="button" style="width:100%;margin-top:12px">Confirmer le code</button>
        </div>`;

      const qrImage = $("k2faQrImage");
      qrImage?.addEventListener("error", () => {
        setStatus("Le QR code a été généré mais son image ne peut pas être affichée. Utilise la clé manuelle ci-dessus.", true);
      }, { once: true });

      $("k2faConfirmBtn")?.addEventListener("click", confirmEnroll);
      $("k2faEnrollCode")?.addEventListener("input", e => {
        e.target.value = e.target.value.replace(/\D/g, "").slice(0, 6);
        if (e.target.value.length === 6) confirmEnroll();
      });

      setStatus("Scanne le QR puis entre le code à 6 chiffres.");
      setTimeout(() => {
        zone.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);

    } catch (error) {
      console.error("Kpsul2FA enroll", error);
      enrollingId = null;
      setStatus("Erreur : " + (error?.message || "impossible de générer le QR code."), true);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function confirmEnroll() {
    const client = sb(); if (!client || !enrollingId) return;
    const code = $("k2faEnrollCode")?.value.trim();
    if (!code || code.length !== 6) { setStatus("Entre les 6 chiffres.", true); return; }
    setStatus("Vérification…");
    const { data: ch, error: e1 } = await client.auth.mfa.challenge({ factorId: enrollingId });
    if (e1) { setStatus("Erreur : " + e1.message, true); return; }
    const { error: e2 } = await client.auth.mfa.verify({
      factorId: enrollingId, challengeId: ch.id, code
    });
    if (e2) { setStatus("Code invalide -- réessaie.", true); return; }
    setStatus("✅ Double authentification activée !");
    factorId = enrollingId;
    enrollingId = null;
    document.body.classList.add("kpsul-aal2");
    setTimeout(() => renderPanel("unlocked"), 900);
  }

  /* ─── DÉVERROUILLAGE (connexion suivante) ─────────────────── */
  async function verifyChallenge() {
    const client = sb(); if (!client || !factorId) return;
    const code = $("k2faCode")?.value.trim();
    if (!code || code.length !== 6) { setStatus("Entre les 6 chiffres.", true); return; }
    const btn = $("k2faVerifyBtn"); if (btn) btn.disabled = true;
    setStatus("Vérification…");
    const { data: ch, error: e1 } = await client.auth.mfa.challenge({ factorId });
    if (e1) { setStatus("Erreur : " + e1.message, true); if(btn) btn.disabled=false; return; }
    const { error: e2 } = await client.auth.mfa.verify({
      factorId, challengeId: ch.id, code
    });
    if (btn) btn.disabled = false;
    if (e2) { setStatus("Code invalide -- réessaie.", true); const i=$("k2faCode"); if(i){i.value="";i.focus();} return; }
    document.body.classList.add("kpsul-aal2");
    setStatus("✅ Déverrouillé !");
    setTimeout(() => renderPanel("unlocked"), 600);
  }

  /* ─── DÉSACTIVATION ────────────────────────────────────────── */
  async function disableMfa() {
    if (!confirm("Désactiver la double authentification ?\n\nTon espace coach ne sera plus protégé par un code.")) return;
    const client = sb(); if (!client || !factorId) return;
    const { error } = await client.auth.mfa.unenroll({ factorId });
    if (error) { alert("Erreur : " + error.message); return; }
    factorId = null;
    renderPanel("unlocked");
  }
function setStatus(msg, err = false) {
    const el = $("k2faStatus"); if (!el) return;
    el.textContent = msg || "";
    el.classList.toggle("err", !!err);
  }

  /* ─── INIT ─────────────────────────────────────────────────── */
  function init() {
    injectStyle();
    injectCard();
    injectModule();
    applyState();
  }

  new MutationObserver(() => {
    if (document.body.classList.contains("authed")) init();
    else document.body.classList.remove("kpsul-aal2");
  }).observe(document.body, { attributeFilter: ["class"] });

  document.addEventListener("click", e => {
    const tile = e.target.closest("[data-goto]");
    if (tile?.dataset.goto === "modKpsul2FA") {
      setTimeout(() => { init(); }, 150);
    }
  });

  if (document.body.classList.contains("authed")) init();
})();
