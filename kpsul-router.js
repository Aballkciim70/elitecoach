/* KPSUL -- ROUTER CENTRAL MODULES */
(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));

  const aliases = {
    modKpsulIndex: "modKpsulScore",
    modKpsulProgram: "modKpsulProgramsTable",
    modKpsulPrograms: "modKpsulProgramsTable",
    modKpsulMeasures: "modKpsulMesures"
  };

  function resolve(id) {
    return aliases[id] || id;
  }

  function openModule(rawId) {
    const id = resolve(rawId);
    const panel = $(id);

    if (!panel) {
      console.warn("KPSUL ROUTER -- module absent :", rawId, "→", id);
      return false;
    }

    document.body.classList.add("kpsul-panel-open");

    qsa(".module-panel").forEach(p => {
      p.classList.toggle("active", p.id === id);
    });

    qsa(".module-tab").forEach(t => {
      t.classList.toggle("active", resolve(t.dataset.module) === id);
    });

    panel.scrollIntoView({ behavior: "smooth", block: "start" });

    if (id === "modKpsulScore" && typeof window.loadClientScore === "function") {
      window.loadClientScore();
    }

    return true;
  }

  const originalAlert = window.alert;
  window.alert = function(message) {
    if (String(message || "").startsWith("Module indisponible")) {
      console.warn("Alerte module bloquée :", message);
      return;
    }
    originalAlert(message);
  };

  document.addEventListener("click", e => {
    const tile = e.target.closest("[data-goto]");
    if (!tile) return;

    const target = tile.dataset.goto;
    if (!target) return;

    e.preventDefault();
    e.stopImmediatePropagation();

    openModule(target);
  }, true);

  document.addEventListener("keydown", e => {
    const tile = e.target.closest("[data-goto]");
    if (!tile) return;

    if (e.key !== "Enter" && e.key !== " ") return;

    e.preventDefault();
    e.stopImmediatePropagation();

    openModule(tile.dataset.goto);
  }, true);

  window.KpsulRouter = { openModule };
})();