/* ============================================================
   KPSUL AUTH V1 — AUTHENTIFICATION CENTRALISÉE

   Responsabilité unique :
   - écouter la session Supabase ;
   - effectuer UNE seule déconnexion ;
   - informer l'interface et le contexte ;
   - ne pas gérer les modules, panneaux ou espaces admin/client.
   ============================================================ */
(() => {
  "use strict";

  if (window.KpsulAuth?.version === "1.0.0") return;

  let logoutRunning = false;
  let subscription = null;

  function client() {
    return window.sb || null;
  }

  function updateUi(session) {
    try {
      window.KpsulAuthUI?.setSession?.(session || null);
    } catch (error) {
      console.error("KpsulAuth UI :", error);
    }
  }

  function emit(type, session = null, error = null) {
    window.dispatchEvent(
      new CustomEvent("kpsul:auth-change", {
        detail: Object.freeze({
          type,
          session,
          user: session?.user || null,
          error: error || null
        })
      })
    );
  }

  function setButtonsLoading(loading) {
    document
      .querySelectorAll("#logoutBtn, [data-logout]")
      .forEach((button) => {
        button.disabled = loading;
        button.toggleAttribute("aria-busy", loading);

        if (button.id === "logoutBtn" || button.hasAttribute("data-logout")) {
          button.textContent = loading ? "Déconnexion…" : "Se déconnecter";
        }
      });
  }

  function clearFallbackTokens() {
    try {
      [localStorage, sessionStorage].forEach((storage) => {
        const keys = [];

        for (let index = 0; index < storage.length; index += 1) {
          const key = storage.key(index);

          if (
            key &&
            (
              /^sb-.*-auth-token$/.test(key) ||
              key === "supabase.auth.token"
            )
          ) {
            keys.push(key);
          }
        }

        keys.forEach((key) => storage.removeItem(key));
      });
    } catch (error) {
      console.warn("KpsulAuth : nettoyage de secours impossible.", error);
    }
  }

  async function getSession() {
    const sb = client();

    if (!sb?.auth) return null;

    const { data, error } = await sb.auth.getSession();

    if (error) throw error;
    return data?.session || null;
  }

  async function logout() {
    if (logoutRunning) return false;

    const sb = client();

    if (!sb?.auth?.signOut) {
      console.error("KpsulAuth : client Supabase indisponible.");
      return false;
    }

    logoutRunning = true;
    setButtonsLoading(true);

    try {
      /*
       * Une seule fonction de tout le projet appelle signOut().
       * L'interface sera mise à jour par onAuthStateChange.
       */
      const { error } = await sb.auth.signOut({ scope: "local" });

      if (error) throw error;

      /*
       * Secours visuel au cas où le navigateur tarde à émettre l'événement.
       * Cette opération est idempotente et ne relance pas signOut().
       */
      updateUi(null);
      emit("SIGNED_OUT", null);
      return true;
    } catch (error) {
      console.error("KpsulAuth : échec de la déconnexion.", error);
      clearFallbackTokens();
      updateUi(null);
      emit("SIGNED_OUT_FALLBACK", null, error);
      return false;
    } finally {
      logoutRunning = false;
      setButtonsLoading(false);
    }
  }

  async function initialize() {
    const sb = client();

    if (!sb?.auth) {
      console.error("KpsulAuth : Supabase n'est pas initialisé.");
      return;
    }

    try {
      const session = await getSession();
      updateUi(session);
      emit("INITIAL_SESSION", session);
    } catch (error) {
      console.error("KpsulAuth : lecture de session impossible.", error);
      updateUi(null);
      emit("SESSION_ERROR", null, error);
    }

    if (subscription) return;

    const result = sb.auth.onAuthStateChange((event, session) => {
      updateUi(session);
      emit(event || "AUTH_CHANGED", session);

      /*
       * Le contexte lit le rôle et la session, sans modifier le DOM.
       */
      window.KpsulContext?.refreshIdentity?.().catch?.((error) => {
        console.error("KpsulAuth → Context :", error);
      });
    });

    subscription = result?.data?.subscription || result?.subscription || null;
  }

  window.KpsulAuth = Object.freeze({
    version: "1.0.0",
    initialize,
    getSession,
    logout,

    get isLoggingOut() {
      return logoutRunning;
    },

    destroy() {
      try {
        subscription?.unsubscribe?.();
      } catch (_) {}

      subscription = null;
    }
  });

  /*
   * kpsul-auth.js est chargé après le grand script inline :
   * window.sb et window.KpsulAuthUI sont donc normalement déjà disponibles.
   */
  initialize();
})();