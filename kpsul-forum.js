/* KPSUL — FORUM COMMUNAUTÉ (sur invitation) */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));
  const safe = v => String(v ?? "").replace(/[&<>"']/g, s => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[s]));
  const when = d => { try { const x = new Date(d); return x.toLocaleDateString("fr-FR") + " · " + x.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }); } catch (e) { return ""; } };

  const getSb = () => window.sb || null;
  let me = null;            // { id, full_name, role, forum_member }
  let currentPost = null;   // post ouvert

  const isCoach = () => !!me && ["coach", "admin"].includes(me.role);
  const hasAccess = () => !!me && (me.forum_member === true || isCoach());

  function status(id, msg, err = false) {
    const el = $(id); if (!el) return;
    el.textContent = msg || "";
    el.classList.toggle("kpsulx-error", !!err);
  }

  /* ---------- styles (auto-injectés) ---------- */
  function injectStyle() {
    if ($("kpsulForumStyle")) return;
    const st = document.createElement("style");
    st.id = "kpsulForumStyle";
    st.textContent = `
      .kforum-post{border:1px solid var(--line,#22403A);border-radius:14px;background:rgba(255,255,255,.025);padding:14px;cursor:pointer;transition:border-color .18s}
      .kforum-post:hover{border-color:var(--core,#34E0C8)}
      .kforum-post.pinned{border-color:rgba(231,217,196,.55)}
      .kforum-post b{display:block;font-family:var(--disp,system-ui);font-size:16px}
      .kforum-post .kmeta{display:block;color:#8A9A93;font-size:12px;margin-top:5px}
      .kforum-pin{font-family:var(--mono,monospace);font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#E7D9C4;margin-right:8px}
      .kforum-reply{border:1px solid var(--line,#22403A);border-radius:12px;background:rgba(4,10,9,.36);padding:12px;margin-top:10px}
      .kforum-reply b{font-size:14px;color:var(--core,#34E0C8)}
      .kforum-reply p{color:#C6D0CB;font-size:14px;margin:6px 0 0;white-space:pre-wrap}
      .kforum-reply .kmeta{color:#5E6E68;font-size:11px;display:block;margin-top:6px}
      .kforum-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
      .kforum-mini{border:1px solid var(--line,#22403A);background:none;color:#8A9A93;border-radius:99px;padding:5px 12px;font-size:12px;cursor:pointer}
      .kforum-mini:hover{border-color:var(--core,#34E0C8);color:var(--core,#34E0C8)}
      .kforum-mini.kdanger:hover{border-color:#E8735B;color:#E8735B}
      .kforum-back{margin-bottom:12px}
      .kforum-body{color:#C6D0CB;font-size:14.5px;white-space:pre-wrap;margin:10px 0}
    `;
    document.head.appendChild(st);
  }

  /* ---------- injection côté membre ---------- */
  function injectClientModule() {
    const tabs = qs(".module-tabs");
    if (tabs && !qs('[data-module="modKpsulForum"]')) {
      tabs.insertAdjacentHTML("beforeend",
        `<button class="module-tab" data-module="modKpsulForum" type="button">Communauté</button>`);
    }
    const anchor = qs(".module-panel");
    if (!anchor || $("modKpsulForum")) return;
    anchor.insertAdjacentHTML("beforebegin", `
      <div class="module-panel" id="modKpsulForum">
        <div class="tool-panel">
          <h3>🤝 Communauté kpsul</h3>
          <p>Un espace entre passionnés pour se motiver, partager ses séances et se dépasser ensemble. Respect et bienveillance obligatoires — le coach veille.</p>
          <div id="kforumGate"></div>
          <div id="kforumHome" style="display:none">
            <div class="kpsulx-form">
              <input id="kforumTitle" placeholder="Titre de ton sujet (ex : Première séance jambes 🔥)">
              <textarea id="kforumBody" placeholder="Ton message : une victoire, une question, un objectif de la semaine..."></textarea>
              <button class="btn btn-primary" id="kforumPublish" type="button">Publier</button>
              <div class="kpsulx-status" id="kforumStatus"></div>
            </div>
            <div class="kpsulx-list" id="kforumList" style="margin-top:16px"></div>
          </div>
          <div id="kforumThread" style="display:none"></div>
        </div>
      </div>`);
  }

  /* ---------- injection côté coach (fiche client) ---------- */
  function injectAdminModule() {
    const tabs = qs(".detail-tabs");
    if (tabs && !qs('[data-detail="dKpsulForum"]')) {
      tabs.insertAdjacentHTML("beforeend",
        `<button class="detail-tab" data-detail="dKpsulForum" type="button">Forum</button>`);
    }
    const anchor = qs(".detail-panel");
    if (!anchor || $("dKpsulForum")) return;
    anchor.insertAdjacentHTML("beforebegin", `
      <div class="detail-panel" id="dKpsulForum">
        <div class="v2-panel">
          <h3>🤝 Accès au forum</h3>
          <p>Le forum est sur invitation. Active-le pour les clients prêts à participer à la communauté.</p>
          <div class="kpsulx-item" style="margin-top:12px">
            <b id="kforumAdminState">—</b>
            <span id="kforumAdminHint">Sélectionne un client pour voir son statut.</span>
          </div>
          <div class="kforum-actions">
            <button class="btn btn-primary" id="kforumToggle" type="button" style="display:none">Activer le forum</button>
          </div>
          <div class="kpsulx-status" id="kforumAdminStatus"></div>
        </div>
      </div>`);
  }

  /* ---------- onglets (même mécanique que le reste, avec garde) ---------- */
  function hookTabs() {
    qsa("[data-module]").forEach(btn => {
      if (btn.dataset.kforumHooked) return; btn.dataset.kforumHooked = "1";
      btn.addEventListener("click", () => {
        const t = btn.dataset.module;
        qsa(".module-tab").forEach(b => b.classList.toggle("active", b.dataset.module === t));
        qsa(".module-panel").forEach(p => p.classList.toggle("active", p.id === t));
        if (t === "modKpsulForum") refreshForum();
      });
    });
    qsa("[data-detail]").forEach(btn => {
      if (btn.dataset.kforumHooked) return; btn.dataset.kforumHooked = "1";
      btn.addEventListener("click", () => {
        const t = btn.dataset.detail;
        qsa(".detail-tab").forEach(b => b.classList.toggle("active", b.dataset.detail === t));
        qsa(".detail-panel").forEach(p => p.classList.toggle("active", p.id === t));
        if (t === "dKpsulForum") refreshAdminPanel();
      });
    });
  }

  /* ---------- données ---------- */
  async function loadMe() {
    const sb = getSb(); if (!sb) return null;
    try {
      const { data: s } = await sb.auth.getSession();
      const uid = s?.session?.user?.id; if (!uid) return null;
      const { data, error } = await sb.from("profiles").select("id, full_name, role, forum_member").eq("id", uid).single();
      if (error) { console.warn("kforum profil", error.message); return null; }
      me = data; return me;
    } catch (e) { console.warn("kforum session", e); return null; }
  }

  async function refreshForum() {
    injectStyle();
    await loadMe();
    const gate = $("kforumGate"), home = $("kforumHome"), thread = $("kforumThread");
    if (!gate || !home || !thread) return;
    thread.style.display = "none";
    if (!hasAccess()) {
      home.style.display = "none";
      gate.innerHTML = `<div class="kpsulx-item kpsulx-yellow"><b>Forum sur invitation</b><span>${me ? "Demande à ton coach de t'ouvrir l'accès à la communauté — il l'active en un clic." : "Connecte-toi pour accéder à la communauté."}</span></div>`;
      return;
    }
    gate.innerHTML = "";
    home.style.display = "";
    await loadPosts();
  }

  async function loadPosts() {
    const sb = getSb(), box = $("kforumList"); if (!sb || !box) return;
    box.innerHTML = `<div class="kpsulx-item"><b>Chargement…</b></div>`;
    const { data, error } = await sb.from("forum_posts")
      .select("*").order("pinned", { ascending: false }).order("created_at", { ascending: false }).limit(50);
    if (error) { box.innerHTML = `<div class="kpsulx-item kpsulx-red"><b>Forum indisponible</b><span>${safe(error.message)}</span></div>`; return; }
    if (!data?.length) { box.innerHTML = `<div class="kpsulx-item"><b>Aucun sujet pour l'instant</b><span>Lance la première discussion — un objectif, une victoire, une question.</span></div>`; return; }
    box.innerHTML = data.map(p => `
      <div class="kforum-post ${p.pinned ? "pinned" : ""}" data-kforum-open="${p.id}">
        <b>${p.pinned ? '<span class="kforum-pin">📌 Épinglé</span>' : ""}${safe(p.title)}</b>
        <span class="kmeta">${safe(p.author_name || "Membre")} · ${when(p.created_at)}</span>
      </div>`).join("");
    qsa("[data-kforum-open]", box).forEach(el => el.addEventListener("click", () => openPost(data.find(x => String(x.id) === el.dataset.kforumOpen))));
  }

  async function openPost(post) {
    if (!post) return;
    currentPost = post;
    const sb = getSb(), home = $("kforumHome"), thread = $("kforumThread");
    home.style.display = "none"; thread.style.display = "";
    const canModerate = isCoach();
    const canDelete = canModerate || post.user_id === me?.id;
    thread.innerHTML = `
      <button class="kforum-mini kforum-back" id="kforumBack" type="button">← Retour aux sujets</button>
      <div class="kpsulx-panel">
        <h3>${post.pinned ? '<span class="kforum-pin">📌</span> ' : ""}${safe(post.title)}</h3>
        <span class="kmeta" style="color:#8A9A93;font-size:12px">${safe(post.author_name || "Membre")} · ${when(post.created_at)}</span>
        <div class="kforum-body">${safe(post.body || "")}</div>
        <div class="kforum-actions">
          ${canModerate ? `<button class="kforum-mini" id="kforumPin" type="button">${post.pinned ? "Désépingler" : "📌 Épingler"}</button>` : ""}
          ${canDelete ? `<button class="kforum-mini kdanger" id="kforumDelete" type="button">Supprimer le sujet</button>` : ""}
        </div>
      </div>
      <div id="kforumReplies"></div>
      <div class="kpsulx-form" style="margin-top:14px">
        <textarea id="kforumReplyBody" placeholder="Réponds, encourage, partage ton expérience..."></textarea>
        <button class="btn btn-primary" id="kforumReply" type="button">Répondre</button>
        <div class="kpsulx-status" id="kforumThreadStatus"></div>
      </div>`;
    $("kforumBack").addEventListener("click", () => { thread.style.display = "none"; home.style.display = ""; loadPosts(); });
    $("kforumReply").addEventListener("click", sendReply);
    if (canModerate) $("kforumPin")?.addEventListener("click", togglePin);
    if (canDelete) $("kforumDelete")?.addEventListener("click", deletePost);
    await loadReplies();
  }

  async function loadReplies() {
    const sb = getSb(), box = $("kforumReplies"); if (!sb || !box || !currentPost) return;
    const { data, error } = await sb.from("forum_replies").select("*").eq("post_id", currentPost.id).order("created_at", { ascending: true });
    if (error) { box.innerHTML = `<div class="kpsulx-item kpsulx-red"><b>Réponses indisponibles</b><span>${safe(error.message)}</span></div>`; return; }
    box.innerHTML = (data || []).map(r => `
      <div class="kforum-reply">
        <b>${safe(r.author_name || "Membre")}</b>
        <p>${safe(r.body)}</p>
        <span class="kmeta">${when(r.created_at)}${(isCoach() || r.user_id === me?.id) ? ` · <a href="#" data-kforum-delreply="${r.id}" style="color:#E8735B">supprimer</a>` : ""}</span>
      </div>`).join("") || `<div class="kpsulx-item"><b>Pas encore de réponse</b><span>Sois le premier à encourager.</span></div>`;
    qsa("[data-kforum-delreply]", box).forEach(a => a.addEventListener("click", async e => {
      e.preventDefault();
      const sb2 = getSb(); if (!sb2) return;
      await sb2.from("forum_replies").delete().eq("id", a.dataset.kforumDelreply);
      loadReplies();
    }));
  }

  async function publishPost() {
    const sb = getSb(); if (!sb || !me) return;
    const title = $("kforumTitle")?.value.trim(), body = $("kforumBody")?.value.trim();
    if (!title) { status("kforumStatus", "Donne un titre à ton sujet.", true); return; }
    status("kforumStatus", "Publication…");
    const { error } = await sb.from("forum_posts").insert({ user_id: me.id, author_name: me.full_name || "Membre", title, body });
    if (error) { status("kforumStatus", "Erreur : " + error.message, true); return; }
    $("kforumTitle").value = ""; $("kforumBody").value = "";
    status("kforumStatus", "Sujet publié ✔");
    loadPosts();
  }

  async function sendReply() {
    const sb = getSb(); if (!sb || !me || !currentPost) return;
    const body = $("kforumReplyBody")?.value.trim();
    if (!body) { status("kforumThreadStatus", "Écris ta réponse d'abord.", true); return; }
    status("kforumThreadStatus", "Envoi…");
    const { error } = await sb.from("forum_replies").insert({ post_id: currentPost.id, user_id: me.id, author_name: me.full_name || "Membre", body });
    if (error) { status("kforumThreadStatus", "Erreur : " + error.message, true); return; }
    $("kforumReplyBody").value = "";
    status("kforumThreadStatus", "");
    loadReplies();
  }

  async function togglePin() {
    const sb = getSb(); if (!sb || !currentPost) return;
    const { error } = await sb.from("forum_posts").update({ pinned: !currentPost.pinned }).eq("id", currentPost.id);
    if (!error) { currentPost.pinned = !currentPost.pinned; openPost(currentPost); }
  }

  async function deletePost() {
    const sb = getSb(); if (!sb || !currentPost) return;
    if (!confirm("Supprimer ce sujet et toutes ses réponses ?")) return;
    const { error } = await sb.from("forum_posts").delete().eq("id", currentPost.id);
    if (!error) { $("kforumThread").style.display = "none"; $("kforumHome").style.display = ""; loadPosts(); }
  }

  /* ---------- panneau coach ---------- */
  async function refreshAdminPanel() {
    const sb = getSb(); if (!sb) return;
    const uid = window.selectedClientId;
    const state = $("kforumAdminState"), hint = $("kforumAdminHint"), btn = $("kforumToggle");
    if (!state || !btn) return;
    if (!uid) { state.textContent = "—"; hint.textContent = "Sélectionne un client pour voir son statut."; btn.style.display = "none"; return; }
    const { data, error } = await sb.from("profiles").select("id, full_name, forum_member").eq("id", uid).single();
    if (error || !data) { state.textContent = "Client introuvable"; btn.style.display = "none"; return; }
    const active = data.forum_member === true;
    state.textContent = (data.full_name || "Ce client") + (active ? " a accès au forum ✔" : " n'a pas encore accès");
    hint.textContent = active ? "Tu peux retirer l'accès à tout moment." : "Active-le pour l'inviter dans la communauté.";
    btn.textContent = active ? "Retirer l'accès" : "Activer le forum";
    btn.style.display = "";
    btn.onclick = async () => {
      status("kforumAdminStatus", "Mise à jour…");
      const { error: e2 } = await sb.from("profiles").update({ forum_member: !active }).eq("id", uid);
      if (e2) { status("kforumAdminStatus", "Erreur : " + e2.message, true); return; }
      status("kforumAdminStatus", !active ? "Accès activé ✔" : "Accès retiré ✔");
      refreshAdminPanel();
    };
  }

  /* ---------- init ---------- */
  function init() {
    injectStyle();
    injectClientModule();
    injectAdminModule();
    hookTabs();
    $("kforumPublish")?.addEventListener("click", publishPost);
    document.addEventListener("kpsul:client-selected", () => setTimeout(refreshAdminPanel, 150));
    setTimeout(refreshForum, 700);
  }
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", init) : init();
})();
