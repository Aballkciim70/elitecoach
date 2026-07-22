/* KPSUL UX V4 — regroupe l'existant selon le parcours client/coach. */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const esc = value => String(value || "").replace(/[&<>\"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const groups = [
    {id:"evolution",icon:"📈",title:"Mon évolution",desc:"Poids, mensurations, photos, objectifs et historique.",modules:[
      ["modKpsulMesures","Mensurations & photos","Suivre le corps et comparer les mesures."],
      ["modKpsulEvolution","Historique complet","Voir la chronologie de ta progression."],
      ["modGoals","Objectifs","Définir ta cible et ton échéance."],
      ["modKpsulIndex","Évolution du Score Kpsul","Comprendre la tendance globale."]]},
    {id:"training",icon:"🏋️",title:"Mon entraînement",desc:"Programme, séance, exercices, performances et technique.",modules:[
      ["modProgram","Programme","Consulter le plan attribué par le coach."],
      ["modProgress","Séances & performances","Enregistrer charges, séries et répétitions."],
      ["modKpsulExercisesPro","Bibliothèque d’exercices","Technique, muscles et conseils."],
      ["modKpsulProgramsTable","Programmes avancés","Retrouver les plans et leur progression."],
      ["modKpsulBody","Comprendre mon corps","Mieux exécuter chaque mouvement."]]},
    {id:"nutrition",icon:"🥗",title:"Nutrition",desc:"Repas, calories, macros, hydratation et habitudes.",modules:[
      ["modNutrition","Journal alimentaire","Repas, calories et macronutriments."],
      ["modHabits","Hydratation & habitudes","Eau, sommeil, pas, énergie et digestion."]]},
    {id:"coach",icon:"💬",title:"Mon coach",desc:"Échanges, connaissances, questions et documents reçus.",modules:[
      ["modMessages","Messagerie","Échanger directement avec ton coach."],
      ["modAssistant","Assistant pédagogique","Comprendre la science de ton plan."],
      ["modScienceHub","Centre de connaissances","Quiz, mythes et cartes scientifiques."],
      ["modKpsulUnderstanding","Journal de compréhension","Conserver tes questions et déclics."],
      ["modDocuments","Documents reçus","Bilans, programmes, PDF et fichiers."],
      ["modKpsulForum","Communauté","Échanger avec les membres invités."]]},
    {id:"planning",icon:"📅",title:"Planning",desc:"Créneaux, réservations, suivis et visios.",modules:[
      ["modBookingSlots","Agenda & réservations","Voir et réserver les créneaux ouverts."]]},
    {id:"space",icon:"⚙️",title:"Mon espace",desc:"Profil, sécurité, abonnement et déconnexion.",modules:[
      ["modKpsulPassport","Profil & passeport","Retrouver les informations de ton compte."],
      ["modKpsul2FA","Sécurité 2FA","Protéger l’accès à ton espace."]]},
  ];

  function existingModules(list){ return list.filter(([id]) => $(id)); }
  function openModule(id){
    if (window.KpsulRouter?.openModule) window.KpsulRouter.openModule(id);
    else document.querySelector(`[data-goto="${CSS.escape(id)}"]`)?.click();
  }
  function renderCategory(shell, group){
    const modules = existingModules(group.modules);
    shell.innerHTML = `<section class="kux-category active"><div class="kux-category-head"><button class="kux-back" type="button">← Accueil</button><div><h2>${group.icon} ${esc(group.title)}</h2><p>${esc(group.desc)}</p></div></div><div class="kux-module-grid">${modules.map(([id,title,desc])=>`<button class="kux-module" type="button" data-kux-open="${esc(id)}"><b>${esc(title)}</b><span>${esc(desc)}</span><i>Ouvrir →</i></button>`).join("")}</div></section>`;
    shell.querySelector(".kux-back")?.addEventListener("click", buildHome);
    shell.querySelectorAll("[data-kux-open]").forEach(btn => btn.addEventListener("click",()=>openModule(btn.dataset.kuxOpen)));
  }
  function buildHome(){
    const shell = $("kuxShell"); if(!shell) return;
    const name = ($("memberHello")?.textContent || "Bienvenue").replace(/^Bonjour\s*/i, "");
    const today = new Intl.DateTimeFormat("fr-FR",{weekday:"long",day:"numeric",month:"long"}).format(new Date());
    shell.innerHTML = `<div class="kux-shell"><div class="kux-head"><div><h2>Bonjour ${esc(name === "Ton espace" ? "" : name)}</h2><p>Voici l’essentiel pour avancer aujourd’hui.</p></div><span class="kux-date">${esc(today)}</span></div><div class="kux-today"><button class="kux-today-card primary" type="button" data-kux-direct="modProgram"><span>Séance du jour</span><b>Consulter mon programme</b><small>Commence par les consignes préparées par ton coach.</small><div class="kux-progress"><i></i></div></button><button class="kux-today-card" type="button" data-kux-direct="modKpsulIndex"><span>Score Kpsul</span><b>Voir mon score</b><small>Ton indicateur global de progression.</small></button><button class="kux-today-card" type="button" data-kux-direct="modNutrition"><span>Nutrition</span><b id="kuxCalories">Journal du jour</b><small>Renseigne repas, calories et macros.</small></button><button class="kux-today-card" type="button" data-kux-direct="modBookingSlots"><span>Planning</span><b>Mes rendez-vous</b><small>Consulte les prochains créneaux.</small></button></div><div class="kux-nav">${groups.filter(g=>existingModules(g.modules).length).map(g=>`<button class="kux-nav-card" type="button" data-kux-group="${g.id}"><span class="kux-nav-icon">${g.icon}</span><h3>${esc(g.title)}</h3><p>${esc(g.desc)}</p><em>${existingModules(g.modules).length} fonction${existingModules(g.modules).length>1?"s":""} →</em></button>`).join("")}</div></div>`;
    shell.querySelectorAll("[data-kux-group]").forEach(btn=>btn.addEventListener("click",()=>renderCategory(shell,groups.find(g=>g.id===btn.dataset.kuxGroup))));
    shell.querySelectorAll("[data-kux-direct]").forEach(btn=>btn.addEventListener("click",()=>openModule(btn.dataset.kuxDirect)));
  }
  function relabelAdmin(){
    const labels={dOverview:"Vue d’ensemble",dMeals:"Nutrition",dExercises:"Entraînement",dHabits:"Habitudes",dGoals:"Objectifs",dMessages:"Coaching",dProgram:"Programme",dPhotos:"Progression",dPlanning:"Planning",dDocs:"Documents",dAI:"IA Coach"};
    document.querySelectorAll("#adminDashboard .detail-tab[data-detail]").forEach(btn=>{if(labels[btn.dataset.detail])btn.textContent=labels[btn.dataset.detail]});
    const kpis=[["crmClients","Clients"],["crmMeals","Activité nutrition"],["crmExercises","Activité entraînement"],["crmMessages","Messages"]];
    kpis.forEach(([id,label])=>{const span=$(id)?.nextElementSibling;if(span)span.textContent=label});
  }
  function init(){
    const card=document.querySelector("#member .member-card"); if(!card||$("kuxShell")) return;
    const shell=document.createElement("div"); shell.id="kuxShell"; card.insertBefore(shell,card.querySelector(".member-tiles"));
    $("member")?.classList.add("kux-ready");
    buildHome(); relabelAdmin();
    $("memberBackBtn")?.addEventListener("click",()=>setTimeout(buildHome,30));
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",init); else init();
  new MutationObserver(()=>{if(!$("kuxShell"))init();relabelAdmin()}).observe(document.body,{childList:true,subtree:true});
})();
