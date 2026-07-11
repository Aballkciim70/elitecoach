/* KPSUL — MESSAGERIE TEMPS RÉEL + BADGE NON-LUS */
(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));
  const sb = () => window.sb || null;
  const safe = v => String(v ?? "").replace(/[&<>"']/g, s =>
    ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[s]));
  const fmtTime = d => {
    try {
      const dt = new Date(d);
      const now = new Date();
      const diffDays = Math.floor((now - dt) / 86400000);
      if (diffDays === 0) return dt.toLocaleTimeString("fr-FR", { hour:"2-digit", minute:"2-digit" });
      if (diffDays === 1) return "Hier " + dt.toLocaleTimeString("fr-FR", { hour:"2-digit", minute:"2-digit" });
      return dt.toLocaleDateString("fr-FR", { day:"2-digit", month:"short" }) +
             " " + dt.toLocaleTimeString("fr-FR", { hour:"2-digit", minute:"2-digit" });
    } catch(e) { return ""; }
  };

  let myRole = "client";
  let myId   = null;
  let realtimeChannel = null;
  let unreadCount = 0;
  let moduleIsOpen = false;
  const MSG_STORAGE_KEY = "kpsul_last_read_msg";

  /* ─── STYLE ───────────────────────────────────────────────── */
  function injectStyle() {
    if ($("kmsgStyle")) return;
    const st = document.createElement("style");
    st.id = "kmsgStyle";
    st.textContent = `
      /* Badge non-lus sur la carte */
      .kmsg-badge {
        display:inline-flex;align-items:center;justify-content:center;
        min-width:20px;height:20px;border-radius:99px;
        background:#E8735B;color:#fff;font-size:11px;font-weight:700;
        padding:0 5px;margin-left:8px;
        animation:kmsgBounce .4s ease;
      }
      @keyframes kmsgBounce { 0%{transform:scale(0)} 70%{transform:scale(1.15)} 100%{transform:scale(1)} }
      .mtile h4 .kmsg-badge { font-family:var(--mono,monospace) }

      /* Conteneur messages */
      .kmsg-wrap {
        display:flex;flex-direction:column;gap:0;
        min-height:200px;max-height:55vh;overflow-y:auto;
        padding:4px 0 16px;scroll-behavior:smooth;
      }
      /* Séparateur de date */
      .kmsg-date-sep {
        text-align:center;margin:14px 0 6px;
        font-family:var(--mono,monospace);font-size:10px;letter-spacing:.08em;
        color:#5E6E68;text-transform:uppercase;
      }
      /* Bulle */
      .kmsg-bubble-wrap {
        display:flex;flex-direction:column;
        align-items:flex-start;
        margin:3px 0;
      }
      .kmsg-bubble-wrap.mine { align-items:flex-end }
      .kmsg-bubble {
        max-width:78%;padding:10px 14px;border-radius:18px;
        font-size:15px;line-height:1.45;white-space:pre-wrap;word-break:break-word;
        background:var(--ink-800,#10201D);
        border:1px solid var(--line,#22403A);
        color:var(--paper,#ECEFE9);
      }
      .kmsg-bubble-wrap.mine .kmsg-bubble {
        background:var(--core,#34E0C8);color:#04110E;border-color:transparent;
      }
      .kmsg-bubble-wrap.coach-msg .kmsg-bubble {
        background:rgba(231,217,196,.12);border-color:rgba(231,217,196,.3);
      }
      .kmsg-meta {
        font-size:11px;color:#5E6E68;margin-top:3px;padding:0 4px;
      }
      .kmsg-sender { font-weight:600;color:#8A9A93;font-size:11px }

      /* Zone de saisie */
      .kmsg-input-wrap {
        display:flex;gap:8px;align-items:flex-end;margin-top:14px;
        border-top:1px solid var(--line,#22403A);padding-top:14px;
      }
      .kmsg-input-wrap textarea {
        flex:1;min-height:44px;max-height:120px;resize:none;
        border-radius:14px;padding:11px 14px;font-size:15px;
        transition:border-color .18s;
      }
      .kmsg-send-btn {
        flex:0 0 auto;width:44px;height:44px;border-radius:50%;
        background:var(--core,#34E0C8);border:none;cursor:pointer;
        display:flex;align-items:center;justify-content:center;
        font-size:20px;transition:transform .15s;
      }
      .kmsg-send-btn:hover { transform:scale(1.08) }
      .kmsg-send-btn:disabled { opacity:.5;cursor:not-allowed;transform:none }

      /* Indicateur temps réel */
      .kmsg-live {
        display:inline-flex;align-items:center;gap:6px;
        font-size:11px;color:#8A9A93;margin-bottom:8px;
      }
      .kmsg-live .dot {
        width:7px;height:7px;border-radius:50%;background:#8A9A93;
      }
      .kmsg-live.connected .dot { background:var(--core,#34E0C8);animation:kmsgPulse 2s infinite }
      @keyframes kmsgPulse { 0%,100%{opacity:1} 50%{opacity:.4} }

      /* Notification navigateur (bandeau) */
      .kmsg-notif-bar {
        position:fixed;top:72px;left:50%;transform:translateX(-50%);
        background:var(--ink-800,#10201D);border:1px solid var(--core,#34E0C8);
        border-radius:14px;padding:12px 18px;z-index:300;
        font-size:14px;box-shadow:0 4px 24px rgba(0,0,0,.5);
        display:flex;gap:12px;align-items:center;cursor:pointer;
        animation:kmsgSlideIn .3s ease;
        max-width:calc(100vw - 32px);
      }
      @keyframes kmsgSlideIn { from{opacity:0;transform:translateX(-50%) translateY(-12px)} }
      .kmsg-notif-bar .ico { font-size:20px }
      .kmsg-notif-bar p { margin:0;color:var(--paper,#ECEFE9) }
      .kmsg-notif-bar p small { color:#8A9A93;display:block;font-size:12px }
    `;
    document.head.appendChild(st);
  }

  /* ─── INJECTION DU MODULE ─────────────────────────────────── */
  function enhanceMessages() {
    const panel = $("modMessages");
    if (!panel || panel.dataset.kmsgEnhanced) return;
    panel.dataset.kmsgEnhanced = "1";

    const tp = panel.querySelector(".tool-panel");
    if (!tp) return;

    tp.innerHTML = `
      <h3>💬 Messages</h3>
      <div class="kmsg-live" id="kmsgLive">
        <span class="dot"></span><span id="kmsgLiveLabel">Connexion…</span>
      </div>
      <div class="kmsg-wrap" id="kmsgWrap" aria-live="polite"></div>
      <div class="kmsg-input-wrap">
        <textarea id="kmsgInput" placeholder="Écris ton message…" rows="1"></textarea>
        <button class="kmsg-send-btn" id="kmsgSend" type="button" title="Envoyer">➤</button>
      </div>
      <div class="tool-status" id="kmsgStatus"></div>
    `;

    // Auto-resize textarea
    const ta = $("kmsgInput");
    if (ta) {
      ta.addEventListener("input", () => {
        ta.style.height = "auto";
        ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
      });
      ta.addEventListener("keydown", e => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          sendMessage();
        }
      });
    }

    $("kmsgSend")?.addEventListener("click", sendMessage);
    loadMessages();
    connectRealtime();
  }

  /* ─── CHARGEMENT ──────────────────────────────────────────── */
  async function loadMessages() {
    const client = sb(); if (!client) return;
    const { data: sess } = await client.auth.getSession();
    myId = sess?.session?.user?.id; if (!myId) return;

    const { data: profile } = await client.from("profiles")
      .select("role").eq("id", myId).single();
    myRole = profile?.role || "client";
    const isCoach = ["coach","admin"].includes(myRole);

    let query = client.from("messages").select("*");
    // Coach voit tous les messages de son client sélectionné
    const selectedClient = window.selectedClientId;
    if (isCoach && selectedClient) {
      query = query.eq("user_id", selectedClient);
    } else if (!isCoach) {
      query = query.eq("user_id", myId);
    }
    const { data, error } = await query
      .order("created_at", { ascending: true }).limit(80);

    if (error) { console.warn("kmsg load error", error.message); return; }
    renderMessages(data || [], isCoach);
    markAsRead(data || []);
  }

  function renderMessages(msgs, isCoach) {
    const box = $("kmsgWrap"); if (!box) return;
    if (!msgs.length) {
      box.innerHTML = `<div style="text-align:center;color:#5E6E68;padding:30px 0;font-size:14px">
        Pas encore de message.<br>Commence la conversation 👇</div>`;
      return;
    }

    // Grouper par date
    const groups = [];
    let lastDate = null;
    msgs.forEach(m => {
      const d = m.created_at ? new Date(m.created_at).toLocaleDateString("fr-FR") : "";
      if (d !== lastDate) { groups.push({ type:"sep", label:d }); lastDate = d; }
      groups.push({ type:"msg", data:m });
    });

    box.innerHTML = groups.map(g => {
      if (g.type === "sep") return `<div class="kmsg-date-sep">${safe(g.label)}</div>`;
      const m = g.data;
      const isMine = (m.sender === "coach" && isCoach) || (m.sender === "client" && !isCoach);
      const label = m.sender === "coach" ? "Coach" : "Moi";
      return `
        <div class="kmsg-bubble-wrap ${isMine ? "mine" : (m.sender==="coach" ? "coach-msg" : "")}">
          ${!isMine ? `<span class="kmsg-sender">${safe(m.sender === "coach" ? "Coach" : "Toi")}</span>` : ""}
          <div class="kmsg-bubble">${safe(m.message)}</div>
          <span class="kmsg-meta">${fmtTime(m.created_at)}</span>
        </div>`;
    }).join("");

    // Scroll en bas
    setTimeout(() => { box.scrollTop = box.scrollHeight; }, 50);
  }

  function markAsRead(msgs) {
    if (!msgs.length) return;
    const lastId = msgs[msgs.length - 1]?.id;
    if (lastId) localStorage.setItem(MSG_STORAGE_KEY + "_" + myId, String(lastId));
    updateBadge(0);
    moduleIsOpen = true;
  }

  /* ─── ENVOI ───────────────────────────────────────────────── */
  async function sendMessage() {
    const client = sb(); if (!client) return;
    const ta = $("kmsgInput");
    const text = ta?.value.trim(); if (!text) return;

    const btn = $("kmsgSend"); if(btn) btn.disabled = true;
    ta.value = ""; ta.style.height = "auto";

    const { data: sess } = await client.auth.getSession();
    const uid = sess?.session?.user?.id; if (!uid) { if(btn) btn.disabled = false; return; }

    const isCoach = ["coach","admin"].includes(myRole);
    const targetUid = (isCoach && window.selectedClientId) ? window.selectedClientId : uid;

    const { error } = await client.from("messages").insert({
      user_id: targetUid,
      sender:  isCoach ? "coach" : "client",
      message: text,
    });

    if (error) { $("kmsgStatus").textContent = "Erreur : " + error.message; }
    if(btn) btn.disabled = false;
    ta.focus();
  }

  /* ─── TEMPS RÉEL ─────────────────────────────────────────── */
  function connectRealtime() {
    const client = sb(); if (!client) return;
    if (realtimeChannel) { client.removeChannel(realtimeChannel); realtimeChannel = null; }

    const liveEl = $("kmsgLive"), liveLabel = $("kmsgLiveLabel");

    realtimeChannel = client.channel("kpsul_messages")
      .on("postgres_changes", {
        event:  "INSERT",
        schema: "public",
        table:  "messages",
      }, payload => {
        const msg = payload.new;
        // Recharger seulement si c'est notre conversation
        const isCoach = ["coach","admin"].includes(myRole);
        const relevant = isCoach
          ? (!window.selectedClientId || msg.user_id === window.selectedClientId)
          : msg.user_id === myId;
        if (!relevant) return;

        loadMessages();

        // Si le module est fermé, montrer badge + notif
        if (!moduleIsOpen || !document.body.classList.contains("kpsul-panel-open") ||
            !$("modMessages")?.classList.contains("active")) {
          const fromCoach = msg.sender === "coach";
          if (!isCoach || !fromCoach) {  // pas besoin de notifier le coach de ses propres messages
            updateBadge(++unreadCount);
            showInAppNotif(msg, isCoach);
          }
        }
      })
      .subscribe(status => {
        const connected = status === "SUBSCRIBED";
        if (liveEl) liveEl.classList.toggle("connected", connected);
        if (liveLabel) liveLabel.textContent = connected ? "En direct" : "Reconnexion…";
      });
  }

  /* ─── BADGE ───────────────────────────────────────────────── */
  function updateBadge(count) {
    unreadCount = count;
    // Sur la carte Messages
    const tile = qs('[data-goto="modMessages"] h4') ||
                 qs('[data-goto="modMessages"]');
    if (!tile) return;
    let badge = tile.querySelector(".kmsg-badge");
    if (count <= 0) { badge?.remove(); return; }
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "kmsg-badge";
      (tile.tagName === "H4" ? tile : tile.querySelector("h4") || tile).appendChild(badge);
    }
    badge.textContent = count > 9 ? "9+" : String(count);
  }

  /* ─── NOTIFICATION IN-APP ────────────────────────────────── */
  let notifTimeout = null;
  function showInAppNotif(msg, isCoach) {
    const existing = $("kmsgNotifBar");
    if (existing) existing.remove();
    if (notifTimeout) clearTimeout(notifTimeout);

    const preview = msg.message?.slice(0, 60) + (msg.message?.length > 60 ? "…" : "");
    const from = msg.sender === "coach" ? "Ton coach" : "Client";

    const bar = document.createElement("div");
    bar.id = "kmsgNotifBar";
    bar.className = "kmsg-notif-bar";
    bar.innerHTML = `<span class="ico">💬</span><p><strong>${safe(from)}</strong><small>${safe(preview)}</small></p>`;
    bar.addEventListener("click", () => {
      bar.remove();
      if (window.KpsulRouter) window.KpsulRouter.openModule("modMessages");
    });
    document.body.appendChild(bar);

    notifTimeout = setTimeout(() => bar.remove(), 5000);
  }

  /* ─── HOOK OUVERTURE DU MODULE ───────────────────────────── */
  document.addEventListener("click", e => {
    const tile = e.target.closest("[data-goto]");
    if (tile?.dataset.goto === "modMessages") {
      moduleIsOpen = true;
      updateBadge(0);
      setTimeout(() => {
        enhanceMessages();
        loadMessages();
      }, 180);
    }
  });

  // Quand l'espace membre s'ouvre
  new MutationObserver(() => {
    if (document.body.classList.contains("authed")) {
      moduleIsOpen = false;
      connectRealtime();
    }
  }).observe(document.body, { attributeFilter: ["class"] });

  // Marquer comme fermé si on quitte le module
  document.addEventListener("click", e => {
    if (e.target.closest("#memberBackBtn")) {
      moduleIsOpen = false;
    }
  });

  if (document.body.classList.contains("authed")) connectRealtime();
})();
