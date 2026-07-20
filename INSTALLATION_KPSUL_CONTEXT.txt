KPSUL CONTEXT V1 — CORRECTION CENTRALE CLIENT / ADMIN

CAUSE TROUVÉE

Le fichier index utilise actuellement le même rôle Supabase pour deux choses différentes :

1. les autorisations du compte :
   currentProfileRole = admin / coach / client

2. l'espace actuellement affiché :
   body.admin-mode ou absence de admin-mode

Le compte admin peut donc consulter l'espace client, mais plusieurs modules continuent
à se comporter comme des modules admin parce qu'ils lisent uniquement le rôle du compte.

Le fichier actuel utilise aussi une variable globale selectedClientId côté administration.
Elle doit être vidée immédiatement lors du retour dans l'espace client.

CORRECTION

Le nouveau fichier crée une seule source de vérité :

window.KpsulContext.state

Exemple dans l'espace client :

accountRole        = "admin"
activeWorkspace    = "client"
sessionUserId      = identifiant du compte connecté
selectedClientId   = null
clientSubjectId    = sessionUserId

Exemple dans l'administration :

accountRole        = "admin"
activeWorkspace    = "admin"
selectedClientId   = client choisi
clientSubjectId    = selectedClientId

PROTECTIONS AJOUTÉES

- #member est l'arbre client.
- #adminDashboard est l'arbre admin.
- un seul arbre peut être visible et actif à la fois ;
- l'arbre caché devient inert : clics et navigation clavier impossibles ;
- selectedClientId est supprimé en quittant l'administration ;
- les boutons de changement d'espace passent par KpsulContext ;
- les anciens gestionnaires de clic sont bloqués avant leur exécution ;
- un module admin monté dans #member est masqué ;
- une carte client ne peut pas ouvrir un panneau admin ;
- le contexte est réappliqué après les injections dynamiques des autres fichiers.

INSTALLATION

1. Place kpsul-context.js à la racine du dépôt.

2. Dans index.html, ajoute cette ligne TOUT EN BAS, juste avant </body> :

<script src="kpsul-context.js"></script>

3. Cette ligne doit être APRÈS tous les autres scripts, notamment après :

<script src="kpsul-coach-crm.js"></script>
<script src="kpsul-motivation.js"></script>

4. Commit puis redéploie.

5. Recharge le site sans cache.

AUCUN SQL À EXÉCUTER.

IMPORTANT POUR LES PROCHAINS MODULES

Module client :

const uid = window.KpsulContext.requireClient();

Module admin :

window.KpsulContext.requireAdmin();
const clientId = window.KpsulContext.getClientId();

Ne plus décider du type d'espace uniquement avec :

profile.role === "admin"

Le rôle donne une autorisation.
activeWorkspace indique l'interface réellement ouverte.
