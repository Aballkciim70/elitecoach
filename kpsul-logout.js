/* KPSUL — DÉCONNEXION INSTANTANÉE
   Problème : sb.auth.signOut() attend une réponse des serveurs (USA)
   pendant plusieurs secondes, écran figé. Solution : on vide la session
   localement et on recharge TOUT DE SUITE ; l'appel réseau part en
   arrière-plan sans bloquer l'utilisateur. */
(() => {
  "use strict";

  const sb = () => window.sb || null;
  let leaving = false;

  function purgeLocalSession() {
    // Efface les jetons Supabase du stockage (préfixe sb-… / supabase.auth.token)
    try {
      for (const store of [localStorage, sessionStorage]) {
        const kill = [];
        for (let i = 0; i < store.length; i++) {
          const k = store.key(i);
          if (k && (/^sb-/.test(k) || k.includes("supabase.auth") || k.startsWith("kpsul2fa_"))) kill.push(k);
        }
        kill.forEach(k => { try { store.removeItem(k); } catch (_) {} });
      }
    } catch (_) {}
    // Réinitialise l'espace de travail pour ne pas rouvrir l'admin au retour
    try { sessionStorage.setItem("kpsul.activeWorkspace.v1", "client"); } catch (_) {}
  }

  function instantLogout() {
    if (leaving) return;
    leaving = true;

    // 1. Couper proprement le temps réel du noyau (évite les blocages)
    try {
      const c = sb();
      if (c?.removeAllChannels) c.removeAllChannels();
      else if (c?.getChannels) c.getChannels().forEach(ch => c.removeChannel(ch));
    } catch (_) {}

    // 2. Feedback immédiat (aucun écran figé)
    try {
      const btns = document.querySelectorAll("#logoutBtn, [data-logout]");
      btns.forEach(b => { b.textContent = "Déconnexion…"; b.disabled = true; });
    } catch (_) {}

    // 3. Vider la session localement — l'utilisateur est déjà "déconnecté"
    purgeLocalSession();

    // 4. Lancer le signOut réseau en arrière-plan (sans l'attendre)
    try { sb()?.auth?.signOut({ scope: "local" }); } catch (_) {}

    // 5. Recharger immédiatement : page propre, état déconnecté
    setTimeout(() => { try { location.reload(); } catch (_) { location.href = "/"; } }, 60);
  }

  // Intercepter le clic AVANT le handler d'origine (capture)
  document.addEventListener("click", e => {
    if (e.target.closest("#logoutBtn, [data-logout]")) {
      e.preventDefault();
      e.stopImmediatePropagation();
      instantLogout();
    }
  }, true);

  window.KpsulLogout = instantLogout;
})();
