/* KPSUL — PONT NOYAU ↔ TABLEAU DE BORD (démo de partage)
   Alimente les 4 métriques d'accueil depuis le store central.
   Ces valeurs viennent de 3 modules différents (mesures, nutrition,
   habitudes) : dès que l'un d'eux écrit, le store prévient et ces
   cases se mettent à jour SANS rechargement. Preuve que tout est
   connecté par une seule source de vérité. */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);

  function paint() {
    const S = window.KpsulStore;
    if (!S || !S.isReady()) return;

    const weight = S.getLatest("weight");
    const cal    = S.getLatest("calories");
    const sleep  = S.getLatest("sleep");
    const workout = S.getLatest("lastWorkout");

    // IDs du pont de l'index (déjà présents dans le tableau de bord)
    const set = (id, val) => { const el = $(id); if (el && val != null && val !== "") el.textContent = val; };
    set("lastWeight",   weight  != null ? weight + " kg"  : null);
    set("lastCalories", cal     != null ? Math.round(cal) + " kcal" : null);
    set("lastSleep",    sleep   != null ? sleep + " h"    : null);
    set("lastWorkout",  workout || null);
  }

  function connect() {
    const S = window.KpsulStore;
    if (!S) { setTimeout(connect, 400); return; }
    // Se mettre à jour quand N'IMPORTE quelle donnée change
    S.subscribe("measures", paint);
    S.subscribe("meals",    paint);
    S.subscribe("habits",   paint);
    S.subscribe("workouts", paint);
    S.ready().then(paint);
  }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", connect);
  else connect();
})();
