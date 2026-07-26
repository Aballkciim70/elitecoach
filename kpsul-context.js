/* ============================================================
   KPSUL CONTEXT V2 — ÉTAT UNIQUEMENT, SANS CONFLIT D'INTERFACE

   Rôle :
   - mémoriser l'utilisateur connecté ;
   - lire son rôle client / coach / admin ;
   - connaître l'espace actuellement affiché ;
   - conserver le client sélectionné dans l'administration ;
   - informer les autres modules avec "kpsul:context-change".

   Ce fichier NE DOIT PAS :
   - afficher ou masquer #member / #adminDashboard ;
   - modifier body.authed ou body.admin-mode ;
   - utiliser hidden, inert ou aria-hidden sur les modules ;
   - intercepter ou bloquer les clics ;
   - réorganiser le DOM.

   L'affichage reste entièrement géré par index.html et les modules existants.
   ============================================================ */
(() => {
  "use strict";

  if (window.KpsulContext?.version === "2.0.0") return;

  const ADMIN_ROLES = new Set(["admin", "coach"]);
  const STORAGE_KEY = "kpsul.activeWorkspace.v2";

  const state = {
    ready: false,
    sessionUserId: null,
    accountRole: "client",
    activeWorkspace: document.body?.classList.contains("admin-mode")
      ? "admin"
      : "client",
    selectedClientId: null
  };

  const listeners = new Set();
  let authSubscription = null;
  let bodyObserver = null;

  const getSupabase = () => window.sb || null;

  function canUseAdmin() {
    return ADMIN_ROLES.has(state.accountRole);
  }

  function snapshot() {
    const adminWorkspace = state.activeWorkspace === "admin";

    return Object.freeze({
      ready: state.ready,
      sessionUserId: state.sessionUserId,
      accountRole: state.accountRole,
      activeWorkspace: state.activeWorkspace,
      selectedClientId: state.selectedClientId,

      isClientWorkspace: !adminWorkspace,
      isAdminWorkspace: adminWorkspace,
      canUseAdmin: canUseAdmin(),

      clientSubjectId: adminWorkspace
        ? state.selectedClientId
        : state.sessionUserId
    });
  }

  function emit(reason = "update") {
    const detail = Object.freeze({
      ...snapshot(),
      reason
    });

    window.dispatchEvent(
      new CustomEvent("kpsul:context-change", { detail })
    );

    listeners.forEach((listener) => {
      try {
        listener(detail);
      } catch (error) {
        console.error("KpsulContext listener :", error);
      }
    });
  }

  function rememberWorkspace(workspace) {
    try {
      sessionStorage.setItem(STORAGE_KEY, workspace);
    } catch (_) {}
  }

  function readWorkspaceFromDom() {
    const workspace = document.body?.classList.contains("admin-mode")
      ? "admin"
      : "client";

    /*
     * Un utilisateur sans droit admin ne peut jamais être considéré
     * comme étant dans l'espace admin, même si une classe résiduelle existe.
     */
    return workspace === "admin" && !canUseAdmin()
      ? "client"
      : workspace;
  }

  function syncWorkspaceFromDom(reason = "dom-workspace") {
    const next = readWorkspaceFromDom();

    if (next === state.activeWorkspace) return false;

    state.activeWorkspace = next;

    if (next === "client") {
      state.selectedClientId = null;
    }

    rememberWorkspace(next);
    emit(reason);
    return true;
  }

  /*
   * Met à jour uniquement l'état interne.
   * Cette fonction ne touche jamais au DOM.
   */
  function setWorkspace(workspace, options = {}) {
    const next = workspace === "admin" ? "admin" : "client";

    if (next === "admin" && !canUseAdmin()) {
      console.warn("KpsulContext : accès admin refusé pour ce rôle.");
      return false;
    }

    if (state.activeWorkspace === next) return true;

    state.activeWorkspace = next;

    if (next === "client") {
      state.selectedClientId = null;
    }

    rememberWorkspace(next);
    emit(options.reason || "workspace-state");
    return true;
  }

  function selectClient(clientId) {
    if (!canUseAdmin()) {
      console.warn("KpsulContext : sélection client refusée.");
      return false;
    }

    const nextId = clientId || null;

    if (state.selectedClientId === nextId) return true;

    state.selectedClientId = nextId;
    emit("selected-client");
    return true;
  }

  function getClientId() {
    return state.activeWorkspace === "admin"
      ? state.selectedClientId
      : state.sessionUserId;
  }

  function requireClient() {
    if (state.activeWorkspace !== "client") {
      throw new Error(
        "Action client refusée : l'espace actif est l'administration."
      );
    }

    if (!state.sessionUserId) {
      throw new Error("Aucun utilisateur connecté.");
    }

    return state.sessionUserId;
  }

  function requireAdmin() {
    if (!canUseAdmin()) {
      throw new Error("Le compte n'a pas les droits administrateur.");
    }

    if (state.activeWorkspace !== "admin") {
      throw new Error(
        "Action admin refusée : l'espace actif est le profil client."
      );
    }

    return true;
  }

  async function readIdentity(reason = "identity") {
    const client = getSupabase();

    if (!client?.auth) {
      state.ready = true;
      syncWorkspaceFromDom("no-supabase");
      emit("no-supabase");
      return;
    }

    const { data, error } = await client.auth.getSession();

    if (error) throw error;

    const userId = data?.session?.user?.id || null;
    state.sessionUserId = userId;
    state.selectedClientId = null;

    if (!userId) {
      state.accountRole = "client";
      state.activeWorkspace = "client";
      state.ready = true;
      rememberWorkspace("client");
      emit("signed-out");
      return;
    }

    const { data: profiles, error: profileError } = await client
      .from("profiles")
      .select("id,role")
      .eq("id", userId)
      .limit(1);

    if (profileError) throw profileError;

    state.accountRole = profiles?.[0]?.role || "client";
    state.ready = true;

    /*
     * L'interface existante reste la source de vérité pour l'espace affiché.
     * Le contexte se contente de la lire.
     */
    state.activeWorkspace = readWorkspaceFromDom();
    rememberWorkspace(state.activeWorkspace);
    emit(reason);
  }

  function bindWorkspaceObservation() {
    if (!document.body || bodyObserver) return;

    /*
     * Observation très limitée : uniquement la classe du body.
     * Contrairement à l'ancienne version, aucune modification du DOM,
     * aucun subtree et aucune boucle applyDom().
     */
    bodyObserver = new MutationObserver(() => {
      syncWorkspaceFromDom("body-class");
    });

    bodyObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ["class"]
    });
  }

  function bindSelectedClientTracking() {
    /*
     * Lecture passive des clics : aucun preventDefault(),
     * aucun stopPropagation() et aucun blocage.
     */
    document.addEventListener("click", (event) => {
      if (!canUseAdmin()) return;

      const item = event.target.closest?.(
        "[data-client-id], [data-client], .client-row, .admin-client-item"
      );

      if (!item) return;

      const clientId =
        item.dataset.clientId ||
        item.dataset.client ||
        item.getAttribute("data-id");

      if (clientId) selectClient(clientId);
    });
  }

  function bindAuth() {
    const client = getSupabase();

    if (!client?.auth?.onAuthStateChange || authSubscription) return;

    const result = client.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        state.sessionUserId = null;
        state.accountRole = "client";
        state.activeWorkspace = "client";
        state.selectedClientId = null;
        state.ready = true;
        rememberWorkspace("client");
        emit("auth-signout");
        return;
      }

      readIdentity("auth-session").catch((error) => {
        console.error("KpsulContext auth :", error);
      });
    });

    authSubscription = result?.data?.subscription || result?.subscription || null;
  }

  window.KpsulContext = Object.freeze({
    version: "2.0.0",

    get state() {
      return snapshot();
    },

    /*
     * Ces méthodes mettent à jour le contexte seulement.
     * Pour changer visuellement d'espace, les boutons et fonctions
     * déjà présents dans index.html restent responsables.
     */
    setWorkspace,
    openClient: (options) => setWorkspace("client", options),
    openAdmin: (options) => setWorkspace("admin", options),

    syncWorkspace: () => syncWorkspaceFromDom("manual-sync"),
    refreshIdentity: () => readIdentity("manual-refresh"),

    selectClient,
    getClientId,
    requireClient,
    requireAdmin,

    isClient: () => state.activeWorkspace === "client",
    isAdmin: () => state.activeWorkspace === "admin",

    subscribe(listener) {
      if (typeof listener !== "function") return () => {};

      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },

    destroy() {
      bodyObserver?.disconnect();
      bodyObserver = null;

      try {
        authSubscription?.unsubscribe?.();
      } catch (_) {}

      authSubscription = null;
      listeners.clear();
    }
  });

  async function start() {
    bindWorkspaceObservation();
    bindSelectedClientTracking();
    bindAuth();

    try {
      await readIdentity("initialization");
    } catch (error) {
      console.error("KpsulContext : initialisation impossible", error);

      state.ready = true;
      state.activeWorkspace = "client";
      state.selectedClientId = null;
      emit("initialization-error");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
