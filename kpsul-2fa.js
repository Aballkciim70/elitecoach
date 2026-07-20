/* KPSUL — ESPACE COACH PROTÉGÉ (2FA TOTP via Supabase MFA)
   V2 : vit dans le tableau de bord admin (#adminDashboard),
   plus aucune carte dans l'espace membre. */
(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const qs = (s, r = document) => r.querySelector(s);
  const safe = v => String(v ?? "").replace(/[&<>"']/g, s =>
    ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[s]));
  const sb = () => window.sb || null;

  let isCoach = false;
  let factorId = null;      // facteur TOTP vérifié existant
  let enrollingId = null;   // facteur en cours d'inscription

  /* ─── STYLE ────────────────────────────────────────────────── */
  function injectStyle() {
    if ($("k2faStyle")) return;
    const st = document.createElement("style");
    st.id = "k2faStyle";
    st.textContent = `
      .k2fa-box {
        border:1px solid rgba(52,224,200,.3);border-radius:16px;
        background:rgba(52,224,200,.05);padding:18px;margin-bottom:16px;
      }
      .k2fa-box p { color:#C6D0CB;font-size:14px;margin:0 0 12px;line-height:1.5 }
      .k2fa-qr {
        display:block;width:200px;height:200px;margin:14px auto;
        background:#fff;border-radius:14px;padding:10px;
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
      .k2fa-ok { text-align:center;padding:20px 10px }
      .k2fa-ok .ico { font-size:42px;display:block;margin-bottom:10px }
      .k2fa-ok b { font-family:var(--disp,system-ui);font-size:20px;display:block;margin-bottom:6px }
      .k2fa-ok span { color:#8A9A93;font-size:13px }
      .k2fa-danger { margin-top:18px;text-align:center }
      .k2fa-danger button {
        background:none;border:1px solid var(--line,#22403A);color:#8A9A93;
        border-radius:99px;padding:8px 15px;font-size:12px;cursor:pointer;
      }
      .k2fa-danger button:hover { border-color:#E8735B;color:#E8735B }
    `;
    document.head.appendChild(st);
  }

  /* ─── PANNEAU (contenu seul, placé par kpsul-admin-layout) ─── */
  function injectModule() {
    if ($("modKpsul2FA")) return;
    const holder = document.createElement("div");
    holder.className = "module-panel";
    holder.id = "modKpsul2FA";
    holder.innerHTML = `
      <div class="tool-panel">
        <h3>🔐 Sécurité de l'espace coach</h3>
        <div id="k2faContent"><p style="color:#8A9A93">Chargement…</p></div>
      </div>`;
    // Point d'ancrage : slot du dashboard admin si présent, sinon corps (invisible hors admin)
    const slot = $("kpsulSlot2fa") || $("adminDashboard") || document.body;
    slot.appendChild(holder);
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

    const { data: factors } = await client.auth.mfa.listFactors();
    const verified = (factors?.totp || []).find(f => f.status === "verified");
    factorId = verified?.id || null;

    const { data: aal } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    const current = aal?.currentLevel;

    if (!factorId) return { state: "enroll" };            // pas encore de 2FA
    if (current === "aal2") return { state: "unlocked" }; // déjà validé cette session
    return { state: "challenge" };                        // 2FA active, code requis
  }

  async function applyState() {
    injectStyle();
    injectModule();
    const { state } = await refreshState();
    // Coach SANS 2FA configurée : accès autorisé (anti-lockout), il pourra l'activer.
    const unlocked = state === "unlocked" || (isCoach && state === "enroll");
    document.body.classList.toggle("kpsul-aal2", unlocked);
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
      setTimeout(() => $("k2faCode")?.focus(), 120);
      return;
    }

    if (state === "unlocked") {
      box.innerHTML = `
        <div class="k2fa-ok">
          <span class="ico">✅</span>
          <b>Espace coach déverrouillé</b>
          <span>${factorId ? "Ta session est protégée par la double authentification." : "Active la 2FA ci-dessous pour verrouiller ton espace."}</span>
        </div>
        ${factorId ? `
        <div class="k2fa-danger">
          <button id="k2faDisable" type="button">Désactiver la double authentification</button>
        </div>` : `
        <div class="k2fa-box">
          <button class="btn btn-primary" id="k2faEnrollBtn" type="button" style="width:100%">Activer la 2FA maintenant</button>
          <div id="k2faEnrollZone"></div>
          <div class="k2fa-status" id="k2faStatus"></div>
        </div>`}`;
      $("k2faEnrollBtn")?.addEventListener("click", startEnroll);
      $("k2faDisable")?.addEventListener("click", disableMfa);
      return;
    }

    box.innerHTML = `<p style="color:#8A9A93">Connecte-toi pour accéder à cet espace.</p>`;
  }

  /* ─── INSCRIPTION 2FA ──────────────────────────────────────── */
  async function startEnroll() {
    const client = sb(); if (!client) return;
    setStatus("Génération du QR code…");
    const { data, error } = await client.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "kpsul-coach"
    });
    if (error) { setStatus("Erreur : " + error.message, true); return; }
    enrollingId = data.id;

    const zone = $("k2faEnrollZone");
    if (zone) {
      zone.innerHTML = `
        <img class="k2fa-qr" src="${data.totp.qr_code}" alt="QR code 2FA">
        <p style="text-align:center;color:#8A9A93;font-size:12px;margin:0 0 4px">Si le scan ne marche pas, entre cette clé manuellement :</p>
        <div class="k2fa-secret">${safe(data.totp.secret)}</div>
        <input class="k2fa-code-input" id="k2faEnrollCode" inputmode="numeric" maxlength="6" placeholder="••••••" autocomplete="one-time-code">
        <button class="btn btn-primary" id="k2faConfirmBtn" type="button" style="width:100%;margin-top:12px">Confirmer le code</button>`;
      $("k2faConfirmBtn")?.addEventListener("click", confirmEnroll);
      $("k2faEnrollCode")?.addEventListener("input", e => {
        if (e.target.value.length === 6) confirmEnroll();
      });
    }
    setStatus("Scanne le QR puis entre le code à 6 chiffres.");
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
    if (e2) { setStatus("Code invalide — réessaie.", true); return; }
    setStatus("✅ Double authentification activée !");
    factorId = enrollingId;
    enrollingId = null;
    document.body.classList.add("kpsul-aal2");
    setTimeout(() => renderPanel("unlocked"), 900);
  }

  /* ─── DÉVERROUILLAGE (connexions suivantes) ───────────────── */
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
    if (e2) { setStatus("Code invalide — réessaie.", true); const i=$("k2faCode"); if(i){i.value="";i.focus();} return; }
    document.body.classList.add("kpsul-aal2");
    setStatus("✅ Déverrouillé !");
    setTimeout(() => renderPanel("unlocked"), 500);
    document.dispatchEvent(new CustomEvent("kpsul:aal2-unlocked"));
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
  window.Kpsul2FA = { refresh: applyState };

  new MutationObserver(() => {
    if (document.body.classList.contains("authed")) applyState();
    else document.body.classList.remove("kpsul-aal2");
  }).observe(document.body, { attributeFilter: ["class"] });

  if (document.body.classList.contains("authed")) applyState();
})();
