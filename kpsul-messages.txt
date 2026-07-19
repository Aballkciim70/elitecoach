/* ============================================================
   KPSUL — MESSAGERIE V2
   Conversation persistante client ↔ coach, historique, non-lus
   et actualisation Supabase Realtime.
   Nécessite window.sb.
   ============================================================ */
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const sb = () => window.sb || null;
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));

  let sessionUser = null;
  let currentRole = "client";
  let selectedClientId = null;
  let selectedClientName = "";
  let clientChannel = null;
  let adminChannel = null;
  let refreshTimer = null;

  function injectStyles() {
    if ($("kpsulMessagingStyles")) return;

    const style = document.createElement("style");
    style.id = "kpsulMessagingStyles";
    style.textContent = `
      .km-shell{display:grid;gap:12px}
      .km-head{display:flex;justify-content:space-between;align-items:center;gap:12px}
      .km-head h3{margin:0;font-family:var(--disp,system-ui)}
      .km-sub{color:var(--muted,#8A9A93);font-size:13px}
      .km-thread{
        height:min(58vh,540px);overflow-y:auto;border:1px solid var(--line,#22403A);
        border-radius:18px;padding:14px;background:rgba(4,10,9,.38);
        display:flex;flex-direction:column;gap:9px;scroll-behavior:smooth
      }
      .km-empty{margin:auto;text-align:center;color:var(--muted,#8A9A93);max-width:260px}
      .km-row{display:flex}
      .km-row.mine{justify-content:flex-end}
      .km-row.theirs{justify-content:flex-start}
      .km-bubble{max-width:82%;border:1px solid var(--line,#22403A);border-radius:17px;
        padding:10px 12px;background:var(--ink-800,#10201D)}
      .km-row.mine .km-bubble{background:rgba(52,224,200,.12);border-color:rgba(52,224,200,.38);
        border-bottom-right-radius:5px}
      .km-row.theirs .km-bubble{border-bottom-left-radius:5px}
      .km-body{white-space:pre-wrap;overflow-wrap:anywhere;color:var(--paper,#ECEFE9);font-size:14.5px}
      .km-meta{display:flex;gap:8px;align-items:center;margin-top:5px;color:var(--muted,#8A9A93);
        font-size:10.5px;font-family:var(--mono,monospace)}
      .km-compose{display:grid;grid-template-columns:1fr auto;gap:9px;align-items:end}
      .km-compose textarea{min-height:52px;max-height:160px;resize:vertical}
      .km-compose button{height:52px}
      .km-status{min-height:18px;font-size:12.5px;color:var(--core,#34E0C8)}
      .km-status.err{color:var(--err,#E8735B)}
      .km-admin{display:grid;grid-template-columns:320px 1fr;gap:14px;margin-top:14px}
      .km-conversations,.km-admin-thread{border:1px solid var(--line,#22403A);border-radius:18px;
        background:var(--ink-800,#10201D);padding:14px;min-width:0}
      .km-search{margin-bottom:10px}
      .km-conv-list{display:grid;gap:8px;max-height:590px;overflow:auto}
      .km-conv{width:100%;text-align:left;border:1px solid var(--line,#22403A);border-radius:14px;
        background:var(--ink-900,#0B1413);padding:12px;color:var(--paper,#ECEFE9);cursor:pointer}
      .km-conv.active{border-color:var(--core,#34E0C8);box-shadow:0 0 0 3px rgba(52,224,200,.12)}
      .km-conv-top{display:flex;justify-content:space-between;gap:8px}
      .km-conv b{font-family:var(--disp,system-ui)}
      .km-conv small{display:block;color:var(--muted,#8A9A93);margin-top:3px;overflow:hidden;
        white-space:nowrap;text-overflow:ellipsis}
      .km-badge{display:inline-grid;place-items:center;min-width:22px;height:22px;border-radius:99px;
        background:var(--core,#34E0C8);color:#04110E;font:700 11px var(--mono,monospace);padding:0 6px}
      .km-admin-title{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:10px}
      .km-admin-title h4{margin:0;font-family:var(--disp,system-ui)}
      @media(max-width:850px){
        .km-admin{grid-template-columns:1fr}
        .km-conv-list{max-height:300px}
        .km-thread{height:50vh}
      }
      @media(max-width:560px){
        .km-compose{grid-template-columns:1fr}
        .km-compose button{width:100%}
        .km-bubble{max-width:90%}
      }
    `;
    document.head.appendChild(style);
  }

  async function getSession() {
    const client = sb();
    if (!client) throw new Error("Supabase n’est pas disponible.");

    const { data, error } = await client.auth.getSession();
    if (error) throw error;

    sessionUser = data?.session?.user || null;
    if (!sessionUser) throw new Error("Utilisateur non connecté.");

    const { data: profile, error: profileError } = await client
      .from("profiles")
      .select("role,full_name,email")
      .eq("id", sessionUser.id)
      .maybeSingle();

    if (profileError) throw profileError;
    currentRole = profile?.role || "client";
    return { user: sessionUser, profile };
  }

  function formatDate(value) {
    if (!value) return "";
    return new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
    }).format(new Date(value));
  }

  function ensureClientUI() {
    injectStyles();
    const panel = $("modMessages");
    if (!panel || panel.dataset.messagingV2 === "1") return;

    panel.dataset.messagingV2 = "1";
    panel.innerHTML = `
      <div class="tool-panel">
        <div class="km-shell">
          <div class="km-head">
            <div>
              <h3>💬 Discussion avec ton coach</h3>
              <div class="km-sub">Toute la conversation est conservée et réapparaît à chaque connexion.</div>
            </div>
            <button class="btn btn-ghost" id="kmClientRefresh" type="button">Actualiser</button>
          </div>

          <div class="km-thread" id="kmClientThread" aria-live="polite">
            <div class="km-empty">Chargement de la conversation…</div>
          </div>

          <div class="km-compose">
            <textarea id="kmClientInput" maxlength="4000"
              placeholder="Écris ton message au coach…"></textarea>
            <button class="btn btn-primary" id="kmClientSend" type="button">Envoyer</button>
          </div>
          <div class="km-status" id="kmClientStatus"></div>
        </div>
      </div>
    `;

    $("kmClientSend")?.addEventListener("click", sendClientMessage);
    $("kmClientRefresh")?.addEventListener("click", loadClientConversation);
    $("kmClientInput")?.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendClientMessage();
      }
    });
  }

  function ensureAdminUI() {
    injectStyles();

    let host = $("kpsulAdminMessaging");
    if (!host) {
      const detailMessages = $("detailMessages");
      const adminRoot = $("adminDashboard");
      host = document.createElement("div");
      host.id = "kpsulAdminMessaging";
      host.className = "v2-panel";

      if (detailMessages) {
        detailMessages.parentElement?.insertBefore(host, detailMessages);
      } else if (adminRoot) {
        adminRoot.querySelector(".wrap")?.appendChild(host);
      }
    }

    if (!host || host.dataset.messagingV2 === "1") return;
    host.dataset.messagingV2 = "1";
    host.innerHTML = `
      <h3>💬 Messagerie clients</h3>
      <p>Sélectionne un élève pour retrouver toute la discussion et répondre.</p>

      <div class="km-admin">
        <div class="km-conversations">
          <input class="km-search" id="kmAdminSearch" placeholder="Rechercher un client…">
          <div class="km-conv-list" id="kmAdminList">
            <div class="km-empty">Chargement des conversations…</div>
          </div>
        </div>

        <div class="km-admin-thread">
          <div class="km-admin-title">
            <h4 id="kmAdminClientTitle">Choisis une conversation</h4>
            <button class="btn btn-ghost" id="kmAdminRefresh" type="button">Actualiser</button>
          </div>
          <div class="km-thread" id="kmAdminThread">
            <div class="km-empty">Sélectionne un client à gauche.</div>
          </div>
          <div class="km-compose" style="margin-top:10px">
            <textarea id="kmAdminInput" maxlength="4000"
              placeholder="Répondre à l’élève…" disabled></textarea>
            <button class="btn btn-primary" id="kmAdminSend" type="button" disabled>Envoyer</button>
          </div>
          <div class="km-status" id="kmAdminStatus"></div>
        </div>
      </div>
    `;

    $("kmAdminSearch")?.addEventListener("input", renderAdminConversationList);
    $("kmAdminRefresh")?.addEventListener("click", async () => {
      await loadAdminConversationList();
      if (selectedClientId) await openAdminConversation(selectedClientId, selectedClientName);
    });
    $("kmAdminSend")?.addEventListener("click", sendAdminMessage);
    $("kmAdminInput")?.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendAdminMessage();
      }
    });
  }

  function renderThread(target, rows, ownerId) {
    if (!target) return;

    if (!rows.length) {
      target.innerHTML = `<div class="km-empty">Aucun message. Commence la discussion.</div>`;
      return;
    }

    target.innerHTML = rows.map((message) => {
      const mine = message.sender_id === ownerId ||
        (!message.sender_id && message.sender === "client" && currentRole === "client") ||
        (!message.sender_id && message.sender === "coach" && currentRole !== "client");

      const author = mine ? "Moi" :
        (message.sender === "coach" || message.sender_role === "coach" ? "Coach" : "Client");

      return `
        <div class="km-row ${mine ? "mine" : "theirs"}">
          <div class="km-bubble">
            <div class="km-body">${esc(message.message || message.body || "")}</div>
            <div class="km-meta">
              <span>${esc(author)}</span>
              <span>${esc(formatDate(message.created_at))}</span>
              ${mine && message.read_at ? "<span>✓ Lu</span>" : ""}
            </div>
          </div>
        </div>
      `;
    }).join("");

    target.scrollTop = target.scrollHeight;
  }

  async function markConversationRead(clientId) {
    const client = sb();
    if (!client || !sessionUser || !clientId) return;

    const query = client
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("client_id", clientId)
      .is("read_at", null)
      .neq("sender_id", sessionUser.id);

    const { error } = await query;
    if (error) console.warn("Messagerie : marquage lu", error);
  }

  async function loadClientConversation() {
    ensureClientUI();
    const status = $("kmClientStatus");

    try {
      if (status) status.textContent = "Chargement…";
      await getSession();

      const { data, error } = await sb()
        .from("messages")
        .select("id,client_id,user_id,sender_id,receiver_id,sender,sender_role,message,body,created_at,read_at")
        .eq("client_id", sessionUser.id)
        .order("created_at", { ascending: true });

      if (error) throw error;

      renderThread($("kmClientThread"), data || [], sessionUser.id);
      await markConversationRead(sessionUser.id);
      subscribeClient(sessionUser.id);
      if (status) status.textContent = "";
    } catch (error) {
      console.error("Messagerie client :", error);
      if (status) {
        status.textContent = "Erreur : " + (error.message || error);
        status.classList.add("err");
      }
    }
  }

  async function sendClientMessage() {
    const input = $("kmClientInput");
    const status = $("kmClientStatus");
    const body = input?.value.trim();

    if (!body) return;

    try {
      if (status) status.textContent = "Envoi…";
      await getSession();

      const { error } = await sb().from("messages").insert({
        client_id: sessionUser.id,
        user_id: sessionUser.id,
        sender_id: sessionUser.id,
        receiver_id: null,
        sender: "client",
        sender_role: "client",
        message: body,
        body
      });

      if (error) throw error;
      input.value = "";
      if (status) status.textContent = "Message envoyé.";
      await loadClientConversation();
    } catch (error) {
      if (status) {
        status.textContent = "Erreur : " + (error.message || error);
        status.classList.add("err");
      }
    }
  }

  let adminConversationRows = [];

  async function loadAdminConversationList() {
    ensureAdminUI();
    const list = $("kmAdminList");

    try {
      await getSession();
      if (!["admin", "coach"].includes(currentRole)) return;

      const [{ data: profiles, error: profilesError }, { data: messages, error: messagesError }] =
        await Promise.all([
          sb().from("profiles").select("id,full_name,email,role").eq("role", "client").order("created_at"),
          sb().from("messages")
            .select("id,client_id,user_id,sender_id,sender,message,body,created_at,read_at")
            .order("created_at", { ascending: false })
        ]);

      if (profilesError) throw profilesError;
      if (messagesError) throw messagesError;

      adminConversationRows = (profiles || []).map((profile) => {
        const rows = (messages || []).filter((message) =>
          (message.client_id || message.user_id) === profile.id
        );
        const last = rows[0] || null;
        const unread = rows.filter((message) =>
          !message.read_at && message.sender_id !== sessionUser.id &&
          (message.sender === "client" || !message.sender_id)
        ).length;

        return { profile, last, unread };
      }).sort((a, b) => {
        const da = a.last?.created_at ? new Date(a.last.created_at).getTime() : 0;
        const db = b.last?.created_at ? new Date(b.last.created_at).getTime() : 0;
        return db - da;
      });

      renderAdminConversationList();
      subscribeAdmin();
    } catch (error) {
      console.error("Liste conversations :", error);
      if (list) list.innerHTML = `<div class="km-empty">Erreur : ${esc(error.message || error)}</div>`;
    }
  }

  function renderAdminConversationList() {
    const list = $("kmAdminList");
    if (!list) return;

    const search = ($("kmAdminSearch")?.value || "").trim().toLowerCase();
    const rows = adminConversationRows.filter(({ profile }) =>
      !search ||
      (profile.full_name || "").toLowerCase().includes(search) ||
      (profile.email || "").toLowerCase().includes(search)
    );

    if (!rows.length) {
      list.innerHTML = `<div class="km-empty">Aucune conversation trouvée.</div>`;
      return;
    }

    list.innerHTML = rows.map(({ profile, last, unread }) => `
      <button class="km-conv ${selectedClientId === profile.id ? "active" : ""}"
        type="button" data-km-client="${esc(profile.id)}"
        data-km-name="${esc(profile.full_name || profile.email || "Client")}">
        <div class="km-conv-top">
          <b>${esc(profile.full_name || profile.email || "Client")}</b>
          ${unread ? `<span class="km-badge">${unread}</span>` : ""}
        </div>
        <small>${esc(last?.message || last?.body || "Aucun message")}</small>
        <small>${esc(formatDate(last?.created_at))}</small>
      </button>
    `).join("");

    list.querySelectorAll("[data-km-client]").forEach((button) => {
      button.addEventListener("click", () =>
        openAdminConversation(button.dataset.kmClient, button.dataset.kmName)
      );
    });
  }

  async function openAdminConversation(clientId, name) {
    selectedClientId = clientId;
    selectedClientName = name || "Client";
    renderAdminConversationList();

    const title = $("kmAdminClientTitle");
    const input = $("kmAdminInput");
    const send = $("kmAdminSend");
    const status = $("kmAdminStatus");

    if (title) title.textContent = selectedClientName;
    if (input) input.disabled = false;
    if (send) send.disabled = false;

    try {
      if (status) status.textContent = "Chargement…";

      const { data, error } = await sb()
        .from("messages")
        .select("id,client_id,user_id,sender_id,receiver_id,sender,sender_role,message,body,created_at,read_at")
        .eq("client_id", clientId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      renderThread($("kmAdminThread"), data || [], sessionUser.id);
      await markConversationRead(clientId);
      if (status) status.textContent = "";
      await loadAdminConversationList();
    } catch (error) {
      if (status) {
        status.textContent = "Erreur : " + (error.message || error);
        status.classList.add("err");
      }
    }
  }

  async function sendAdminMessage() {
    const input = $("kmAdminInput");
    const status = $("kmAdminStatus");
    const body = input?.value.trim();

    if (!selectedClientId || !body) return;

    try {
      if (status) status.textContent = "Envoi…";
      await getSession();

      const { error } = await sb().from("messages").insert({
        client_id: selectedClientId,
        user_id: selectedClientId,
        sender_id: sessionUser.id,
        receiver_id: selectedClientId,
        sender: "coach",
        sender_role: currentRole,
        message: body,
        body
      });

      if (error) throw error;
      input.value = "";
      if (status) status.textContent = "Message envoyé.";
      await openAdminConversation(selectedClientId, selectedClientName);
    } catch (error) {
      if (status) {
        status.textContent = "Erreur : " + (error.message || error);
        status.classList.add("err");
      }
    }
  }

  function subscribeClient(clientId) {
    const client = sb();
    if (!client) return;

    if (clientChannel) client.removeChannel(clientChannel);
    clientChannel = client
      .channel(`kpsul-messages-client-${clientId}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "messages",
        filter: `client_id=eq.${clientId}`
      }, () => {
        clearTimeout(refreshTimer);
        refreshTimer = setTimeout(loadClientConversation, 120);
      })
      .subscribe();
  }

  function subscribeAdmin() {
    const client = sb();
    if (!client || adminChannel) return;

    adminChannel = client
      .channel("kpsul-messages-admin")
      .on("postgres_changes", {
        event: "*", schema: "public", table: "messages"
      }, () => {
        clearTimeout(refreshTimer);
        refreshTimer = setTimeout(async () => {
          await loadAdminConversationList();
          if (selectedClientId) {
            await openAdminConversation(selectedClientId, selectedClientName);
          }
        }, 120);
      })
      .subscribe();
  }

  function hookOpenEvents() {
    document.addEventListener("click", (event) => {
      const messageCard = event.target.closest?.(
        '[data-goto="modMessages"],[data-module="modMessages"]'
      );

      if (messageCard) setTimeout(loadClientConversation, 80);

      const adminMessageTarget = event.target.closest?.(
        '[data-open-admin="dMessages"],[data-jump-detail="dMessages"]'
      );

      if (adminMessageTarget) setTimeout(loadAdminConversationList, 100);
    }, true);
  }

  async function start() {
    ensureClientUI();
    ensureAdminUI();
    hookOpenEvents();

    try {
      await getSession();
      if (currentRole === "client") {
        await loadClientConversation();
      } else {
        await loadAdminConversationList();
      }
    } catch (error) {
      console.warn("Messagerie Kpsul en attente de connexion :", error);
    }

    window.KpsulMessages = {
      refreshClient: loadClientConversation,
      refreshAdmin: loadAdminConversationList,
      openClient: openAdminConversation
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
