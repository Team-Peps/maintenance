/**
 * Configuration de la page de maintenance.
 * Modifie ce fichier avant chaque maintenance : aucun build n'est nécessaire.
 */
window.MAINTENANCE_CONFIG = {
  /** Version affichée à côté de « Patch notes » (laisser vide pour masquer). */
  version: "peps_site_v1.0",

  /**
   * Heure de retour prévue, au format ISO 8601 avec fuseau.
   * Exemple : '2026-10-30T21:00:00+01:00'. Mettre null pour afficher « très vite ».
   */
  returnAt: null,

  /** Adresse de contact affichée en pied de page (laisser vide pour masquer). */
  contactEmail: "",

  /** Liens affichés sous les patch notes (laisser vide pour masquer un lien). */
  links: {
    discord: "https://discord.gg/T92qhMUyRV",
    x: "",
    twitch: "",
  },

  /**
   * Étapes du déploiement affichées dans le terminal.
   * status : 'done' (OK), 'running' (en cours) ou 'pending' (en attente).
   */
  steps: [
    { label: "passage en mode maintenance", status: "done" },
    { label: "sauvegarde de la base de données", status: "done" },
    { label: "sauvegarde des fichiers", status: "done" },
    { label: "build front", status: "done" },
    { label: "build API", status: "done" },
    { label: "migration de la base de données", status: "done" },
    { label: "mise en ligne de la nouvelle version", status: "running" },
    { label: "tests de santé", status: "pending" },
  ],

  /**
   * Notes de patch.
   * type : 'new' (Nouveau), 'improvement' (Amélio) ou 'fix' (Fix).
   */
  notes: [
    { type: "new", text: "Ajout d'un easter egg" },
    { type: "improvement", text: "Nerf du gain d'exp pour le BattlePEPS" },
    {
      type: "improvement",
      text: "Ajout de 1000 pepscoins à l'utilisateur Féfé",
    },
    { type: "fix", text: "Amélioration de performance" },
    { type: "fix", text: "Correction de bugs" },
  ],

  /**
   * Vérification automatique du retour du site (optionnelle).
   * url : une route qui répond 200 quand le site est revenu et qui autorise
   * les requêtes depuis la page de maintenance (même domaine ou CORS),
   * par exemple '/api/actuator/health'. Mettre null pour désactiver.
   */
  healthCheck: {
    url: null,
    intervalSeconds: 30,
    redirectTo: "https://teampeps.fr",
  },
};
