/* ============================================================
   KPSUL CONTEXT V1 — SÉPARATION STRICTE CLIENT / ADMIN
   À charger EN DERNIER, après tous les autres scripts.
   ============================================================ */
(() => {
  "use strict";

  const CLIENT_ROOT = "#member";
  const ADMIN_ROOT = "#adminDashboard";
  const ADMIN_ROLES = new Set(["admin", "coach"]);
  const STORAGE_KEY = "kpsul.activeWorkspace.v1";

  const state = {
    ready: false,
    sessionUserId: null,
    accountRole: "client",
    activeWorkspace: "client",
    selectedClientId: null
  };

  const listeners = new Set();
  let applying = false;

  const $ = (id) => document.getElementById(id);
  const sb = () => window.sb || null;

  function setSelectedClient(v) {
    state.selectedClientId = v ?? null;
    try { window.selectedClientId = state.selectedClientId; }
    catch (_) { /* pont index en lecture seule : l'état interne fait foi */ }
  }

  function snapshot() {
    return Object.freeze({
      ready: state.ready,
      sessionUserId: state.sessionUserId,
      accountRole: state.accountRole,
      activeWorkspace: state.activeWorkspace,
      selectedClientId: state.selectedClientId,
      isClientWorkspace: state.activeWorkspace === "client",
      isAdminWorkspace: state.activeWorkspace === "admin",
      canUseAdmin: ADMIN_ROLES.has(state.accountRole),

      // Dans l'espace client, la cible est TOUJOURS le compte connecté.
      clientSubjectId:
        state.activeWorkspace === "client"
          ? state.sessionUserId
          : state.selectedClientId
    });
  }

  function emit(reason) {
    const detail = {...snapshot(), reason};
    window.dispatchEvent(new CustomEvent("kpsul:context-change", {detail}));
    listeners.forEach(fn => {
      try { fn(detail); } catch (error) { console.error(error); }
    });
  }

  function rememberWorkspace(workspace) {
    try { sessionStorage.setItem(STORAGE_KEY, workspace); } catch (_) {}
  }

  function resetPanels(root) {
    if (!root) return;
    root.querySelectorAll(".module-panel.active, .detail-panel.active")
      .forEach(panel => panel.classList.remove("active"));
  }

  function applyDom(reason = "apply") {
    if (applying) return;
    applying = true;

    try {
      const body = document.body;
      const clientRoot = document.querySelector(CLIENT_ROOT);
      const adminRoot = document.querySelector(ADMIN_ROOT);
      const adminMode = state.activeWorkspace === "admin";

      body.dataset.kpsulWorkspace = state.activeWorkspace;
      body.classList.toggle("admin-mode", adminMode);
      body.classList.toggle("kpsul-client-workspace", !adminMode);
      body.classList.toggle("kpsul-admin-workspace", adminMode);

      if (clientRoot) {
        clientRoot.dataset.workspace = "client";
        clientRoot.setAttribute("aria-hidden", String(adminMode));
        clientRoot.inert = adminMode;
      }

      if (adminRoot) {
        adminRoot.dataset.workspace = "admin";
        adminRoot.setAttribute("aria-hidden", String(!adminMode));
        adminRoot.inert = !adminMode;
      }

      if (adminMode) {
        document.body.classList.remove("kpsul-panel-open");
        resetPanels(clientRoot);
      } else {
        document.body.classList.remove("kpsul-admin-panel-open");

        // L'identifiant client sélectionné n'a aucune valeur dans l'espace client.
        setSelectedClient(null);
        resetPanels(adminRoot);
      }

      const switchAdmin = $("coachSwitchBtn");
      if (switchAdmin) {
        switchAdmin.hidden = !ADMIN_ROLES.has(state.accountRole) || adminMode;
        switchAdmin.setAttribute("aria-hidden", String(switchAdmin.hidden));
      }

      const viewClient = $("viewClientSiteBtn");
      if (viewClient) {
        viewClient.hidden = !adminMode;
        viewClient.setAttribute("aria-hidden", String(viewClient.hidden));
      }

      // Nettoie les modules manifestement montés dans le mauvais arbre.
      document.querySelectorAll(
        `${CLIENT_ROOT} .admin-zone, ${CLIENT_ROOT} .admin-module-panel, ${CLIENT_ROOT} #modCoachCrm`
      ).forEach(el => {
        el.hidden = true;
        el.setAttribute("aria-hidden", "true");
        el.inert = true;
      });

      document.querySelectorAll(
        `${ADMIN_ROOT} #modToday, ${ADMIN_ROOT} #modAlerts, ${ADMIN_ROOT} #modMotivation, ${ADMIN_ROOT} #modKpsulIndex`
      ).forEach(el => {
        if (el.closest("#kpsulCoachZone")) {
          // Hébergé volontairement côté admin (zone coach) : reste visible.
          el.hidden = false;
          el.inert = false;
          el.removeAttribute("aria-hidden");
          return;
        }
        el.hidden = true;
        el.setAttribute("aria-hidden", "true");
        el.inert = true;
      });
    } finally {
      applying = false;
    }

    emit(reason);
  }

  function setWorkspace(workspace, options = {}) {
    const next = workspace === "admin" ? "admin" : "client";

    if (next === "admin" && !ADMIN_ROLES.has(state.accountRole)) {
      console.warn("KpsulContext : accès admin refusé.");
      return false;
    }

    state.activeWorkspace = next;

    if (next === "client") setSelectedClient(null);

    rememberWorkspace(next);
    applyDom(options.reason || "workspace");

    if (options.scroll !== false) {
      const target = document.querySelector(next === "admin" ? ADMIN_ROOT : CLIENT_ROOT);
      setTimeout(() => target?.scrollIntoView({behavior:"smooth", block:"start"}), 30);
    }

    return true;
  }

  function selectClient(clientId) {
    if (state.activeWorkspace !== "admin" || !ADMIN_ROLES.has(state.accountRole)) {
      console.warn("KpsulContext : sélection client refusée hors espace admin.");
      return false;
    }

    setSelectedClient(clientId || null);
    emit("selected-client");
    return true;
  }

  function getClientId() {
    if (state.activeWorkspace === "client") return state.sessionUserId;
    return state.selectedClientId;
  }

  function requireClient() {
    if (state.activeWorkspace !== "client") {
      throw new Error("Action client refusée : l'espace actif est l'administration.");
    }
    if (!state.sessionUserId) throw new Error("Aucun utilisateur connecté.");
    return state.sessionUserId;
  }

  function requireAdmin() {
    if (state.activeWorkspace !== "admin") {
      throw new Error("Action admin refusée : l'espace actif est le profil client.");
    }
    if (!ADMIN_ROLES.has(state.accountRole)) {
      throw new Error("Le compte n'a pas les droits administrateur.");
    }
    return true;
  }

  async function readIdentity() {
    const client = sb();
    if (!client) return;

    const {data, error} = await client.auth.getSession();
    if (error) throw error;

    const session = data?.session;
    state.sessionUserId = session?.user?.id || null;

    if (!state.sessionUserId) {
      state.accountRole = "client";
      state.activeWorkspace = "client";
      state.selectedClientId = null;
      state.ready = true;
      applyDom("signed-out");
      return;
    }

    const {data: profiles, error: profileError} = await client
      .from("profiles")
      .select("id,role")
      .eq("id", state.sessionUserId)
      .limit(1);

    if (profileError) throw profileError;

    state.accountRole = profiles?.[0]?.role || "client";
    state.ready = true;

    let saved = "client";
    try { saved = sessionStorage.getItem(STORAGE_KEY) || "client"; } catch (_) {}

    // Par sécurité, chaque nouvelle session démarre dans le profil client.
    // L'administration ne s'ouvre qu'après une action explicite.
    state.activeWorkspace =
      saved === "admin" && ADMIN_ROLES.has(state.accountRole)
        ? "admin"
        : "client";

    if (state.activeWorkspace === "client") setSelectedClient(null);

    applyDom("identity");
  }

  function bindNavigationCapture() {
    document.addEventListener("click", event => {
      const adminButton = event.target.closest?.("#coachSwitchBtn, #openRealAdminBtn");
      if (adminButton) {
        event.preventDefault();
        event.stopImmediatePropagation();

        if (setWorkspace("admin", {reason:"admin-button"})) {
          try { window.loadCrmAdmin?.(); } catch (_) {}
          try { window.KpsulCoachCrm?.refresh?.(); } catch (_) {}
          try { window.Kpsul2FA?.refresh?.(); } catch (_) {}
        }
        return;
      }

      const clientButton = event.target.closest?.("#viewClientSiteBtn");
      if (clientButton) {
        event.preventDefault();
        event.stopImmediatePropagation();
        setWorkspace("client", {reason:"client-button"});
        return;
      }

      // Une carte client ne peut pas ouvrir un panneau situé dans l'admin.
      const clientCard = event.target.closest?.(`${CLIENT_ROOT} [data-goto]`);
      if (clientCard) {
        const targetId = clientCard.dataset.goto;
        const target = targetId ? $(targetId) : null;
        if (target && target.closest(ADMIN_ROOT)) {
          event.preventDefault();
          event.stopImmediatePropagation();
          console.warn("KpsulContext : module admin bloqué depuis le profil client.");
          return;
        }
      }

      // Une commande admin ne peut pas être utilisée dans le profil client.
      const adminAction = event.target.closest?.(
        `${ADMIN_ROOT} button, ${ADMIN_ROOT} [data-detail], ${ADMIN_ROOT} [data-client-id]`
      );
      if (adminAction && state.activeWorkspace !== "admin") {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, true);
  }

  function bindSelectedClientTracking() {
    document.addEventListener("click", event => {
      if (state.activeWorkspace !== "admin") return;

      const item = event.target.closest?.(
        "[data-client-id], [data-client], .client-row, .admin-client-item"
      );
      if (!item) return;

      const id =
        item.dataset.clientId ||
        item.dataset.client ||
        item.getAttribute("data-id");

      if (id) selectClient(id);
    }, true);
  }

  function bindAuth() {
    const client = sb();
    if (!client?.auth) return;

    client.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        state.sessionUserId = null;
        state.accountRole = "client";
        state.activeWorkspace = "client";
        state.selectedClientId = null;
        state.ready = true;
        rememberWorkspace("client");
        applyDom("auth-signout");
        return;
      }

      // Ne conserve jamais un ancien client sélectionné lors d'un changement de session.
      setSelectedClient(null);
      readIdentity().catch(error => console.error("KpsulContext", error));
    });
  }

  function observeDom() {
    let scheduled = false;

    new MutationObserver(() => {
      if (scheduled || applying) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        applyDom("dom-mutation");
      });
    }).observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  function installCss() {
    if ($("kpsulContextCss")) return;

    const style = document.createElement("style");
    style.id = "kpsulContextCss";
    style.textContent = `
      body[data-kpsul-workspace="client"] ${ADMIN_ROOT}{
        display:none!important;
        visibility:hidden!important;
        pointer-events:none!important;
      }

      body[data-kpsul-workspace="admin"] ${CLIENT_ROOT}{
        display:none!important;
        visibility:hidden!important;
        pointer-events:none!important;
      }

      body[data-kpsul-workspace="client"] ${CLIENT_ROOT}{
        display:block!important;
        visibility:visible!important;
      }

      body[data-kpsul-workspace="admin"] ${ADMIN_ROOT}{
        display:block!important;
        visibility:visible!important;
      }

      ${CLIENT_ROOT} .admin-zone,
      ${CLIENT_ROOT} .admin-module-panel,
      ${CLIENT_ROOT} #modCoachCrm{
        display:none!important;
      }
    `;
    document.head.appendChild(style);
  }

  window.KpsulContext = Object.freeze({
    get state() { return snapshot(); },
    setWorkspace,
    openClient: options => setWorkspace("client", options),
    openAdmin: options => setWorkspace("admin", options),
    selectClient,
    getClientId,
    requireClient,
    requireAdmin,
    isClient: () => state.activeWorkspace === "client",
    isAdmin: () => state.activeWorkspace === "admin",
    subscribe(fn) {
      if (typeof fn !== "function") return () => {};
      listeners.add(fn);
      return () => listeners.delete(fn);
    }
  });

  async function start() {
    installCss();
    bindNavigationCapture();
    bindSelectedClientTracking();
    bindAuth();
    observeDom();

    try {
      await readIdentity();
    } catch (error) {
      console.error("KpsulContext : initialisation impossible", error);
      state.activeWorkspace = "client";
      state.selectedClientId = null;
      applyDom("initialization-error");
    }
  }

  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", start, {once:true})
    : start();
})();
