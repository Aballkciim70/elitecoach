/* ============================================================
   KPSUL — DÉCONNEXION STABLE V2
   Un seul gestionnaire, aucune double navigation, aucun gel.
   ============================================================ */
(() => {
  "use strict";

  let logoutRunning = false;

  function getSupabaseClient() {
    return window.sb || null;
  }

  function setLoadingState() {
    document
      .querySelectorAll("#logoutBtn, #authBtn, [data-logout]")
      .forEach((button) => {
        if (!button) return;
        button.disabled = true;
        button.setAttribute("aria-busy", "true");

        if (button.id === "logoutBtn" || button.hasAttribute("data-logout")) {
          button.textContent = "Déconnexion…";
        }
      });
  }

  function clearOnlyFallbackAuthTokens() {
    /*
     * Utilisé seulement si Supabase ne répond pas.
     * On ne supprime PAS toutes les clés Kpsul.
     */
    try {
      [localStorage, sessionStorage].forEach((storage) => {
        const keys = [];

        for (let i = 0; i < storage.length; i += 1) {
          const key = storage.key(i);

          if (
            key &&
            (
              /^sb-[^-]+-auth-token$/.test(key) ||
              key === "supabase.auth.token"
            )
          ) {
            keys.push(key);
          }
        }

        keys.forEach((key) => storage.removeItem(key));
      });
    } catch (error) {
      console.warn("Nettoyage local de secours impossible :", error);
    }
  }

  function navigateToLoggedOutPage() {
    try {
      sessionStorage.setItem("kpsul.activeWorkspace.v1", "client");
    } catch (_) {}

    /*
     * Une seule navigation.
     * Le paramètre évite qu'iOS restaure une ancienne page depuis son cache.
     */
    const target = `/?loggedout=1&t=${Date.now()}`;
    window.location.href = target;
  }

  async function stableLogout() {
    if (logoutRunning) return;
    logoutRunning = true;

    setLoadingState();

    const client = getSupabaseClient();

    try {
      /*
       * On ferme les canaux sans attendre.
       * Cela ne doit jamais empêcher la déconnexion.
       */
      try {
        if (typeof client?.removeAllChannels === "function") {
          client.removeAllChannels();
        }
      } catch (_) {}

      if (client?.auth?.signOut) {
        const timeout = new Promise((_, reject) => {
          setTimeout(
            () => reject(new Error("Délai de déconnexion dépassé")),
            2500
          );
        });

        /*
         * Maximum 2,5 secondes.
         * Pas de boucle, pas de reload simultané.
         */
        await Promise.race([
          client.auth.signOut({ scope: "local" }),
          timeout
        ]);
      } else {
        clearOnlyFallbackAuthTokens();
      }
    } catch (error) {
      console.warn("Déconnexion Supabase incomplète :", error);
      clearOnlyFallbackAuthTokens();
    } finally {
      navigateToLoggedOutPage();
    }
  }

  /*
   * Capture : neutralise les anciens gestionnaires présents dans index.html.
   * Il ne reste donc qu'une seule procédure de déconnexion.
   */
  document.addEventListener(
    "click",
    (event) => {
      const target = event.target.closest?.(
        "#logoutBtn, [data-logout], #authBtn"
      );

      if (!target) return;

      /*
       * authBtn ouvre la connexion quand l'utilisateur n'est pas connecté.
       * On ne l'intercepte que lorsqu'il sert réellement à se déconnecter.
       */
      if (
        target.id === "authBtn" &&
        !document.body.classList.contains("authed")
      ) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
      stableLogout();
    },
    true
  );

  window.KpsulLogout = stableLogout;
})();
