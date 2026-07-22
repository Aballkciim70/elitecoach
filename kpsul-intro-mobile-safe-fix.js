/* ============================================================
   KPSUL — INTRO MOBILE SAFE FIX
   Empêche l'accueil de défiler et d'apparaître derrière l'intro.
   À charger après tous les autres scripts.
   ============================================================ */
(() => {
  "use strict";

  const INTRO_ID = "kpsulIntro";
  const SKIP_ID = "introSkip";
  const LOCK_CLASS = "kpsul-intro-open";
  const STYLE_ID = "kpsulIntroMobileSafeCss";

  function installCss() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      html.${LOCK_CLASS},
      body.${LOCK_CLASS}{
        overflow:hidden!important;
        overscroll-behavior:none!important;
        height:100%!important;
        max-height:100%!important;
        touch-action:none!important;
      }

      body.${LOCK_CLASS}{
        position:fixed!important;
        inset:0!important;
        width:100%!important;
      }

      #${INTRO_ID}{
        position:fixed!important;
        top:0!important;
        right:0!important;
        bottom:0!important;
        left:0!important;
        width:100vw!important;
        height:100vh!important;
        min-height:100vh!important;
        min-height:100svh!important;
        min-height:100dvh!important;
        z-index:2147483647!important;
        background:#030807!important;
        opacity:1;
        visibility:visible;
        overflow:hidden!important;
        isolation:isolate!important;
        transform:translateZ(0);
        -webkit-transform:translateZ(0);
        -webkit-overflow-scrolling:auto;
      }

      #${INTRO_ID}::before{
        content:"";
        position:absolute;
        inset:-2px;
        z-index:-1;
        background:
          radial-gradient(
            circle at 50% 45%,
            rgba(52,224,200,.13),
            transparent 30%
          ),
          #030807;
      }

      #${INTRO_ID}.hide{
        opacity:0!important;
        visibility:hidden!important;
        pointer-events:none!important;
      }

      #${INTRO_ID}:not(.hide){
        display:grid!important;
        pointer-events:auto!important;
      }
    `;
    document.head.appendChild(style);
  }

  let savedScrollY = 0;

  function lockPage() {
    const intro = document.getElementById(INTRO_ID);
    if (!intro || intro.classList.contains("hide")) return;

    savedScrollY = window.scrollY || 0;

    document.documentElement.classList.add(LOCK_CLASS);
    document.body.classList.add(LOCK_CLASS);
    document.body.style.top = `-${savedScrollY}px`;
  }

  function unlockPage() {
    document.documentElement.classList.remove(LOCK_CLASS);
    document.body.classList.remove(LOCK_CLASS);
    document.body.style.removeProperty("top");

    window.scrollTo(0, savedScrollY);
  }

  function hideIntro() {
    const intro = document.getElementById(INTRO_ID);
    if (!intro) return;

    intro.classList.add("hide");
    unlockPage();

    try {
      sessionStorage.setItem("kpsulIntroSeen", "1");
    } catch (_) {}
  }

  function start() {
    installCss();

    const intro = document.getElementById(INTRO_ID);
    const skip = document.getElementById(SKIP_ID);

    if (!intro) return;

    if (intro.classList.contains("hide")) {
      unlockPage();
      return;
    }

    lockPage();

    /*
     * Remplace proprement l'ancien clic sans casser le bouton.
     */
    skip?.addEventListener(
      "click",
      (event) => {
        event.preventDefault();
        event.stopPropagation();
        hideIntro();
      },
      true
    );

    /*
     * Si l'ancien script ajoute la classe hide après 4,3 secondes,
     * on libère immédiatement le scroll.
     */
    const observer = new MutationObserver(() => {
      if (intro.classList.contains("hide")) {
        unlockPage();
        observer.disconnect();
      }
    });

    observer.observe(intro, {
      attributes: true,
      attributeFilter: ["class"]
    });

    window.addEventListener("pagehide", unlockPage, { once: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }

  window.KpsulIntroFix = Object.freeze({
    hide: hideIntro,
    lock: lockPage,
    unlock: unlockPage
  });
})();
