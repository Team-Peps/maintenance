# Team Peps · Page de maintenance

Page affichée quand [teampeps.fr](https://teampeps.fr) est en maintenance. Elle reprend la DA du site : fond sombre, jaune `#F2C832`, Barlow Condensed et coins rabotés.

Elle présente :

- un terminal qui déroule les étapes du déploiement ligne par ligne, avec une barre de progression ;
- les notes de patch de la nouvelle version ;
- l'heure de retour prévue, avec le temps restant ;
- un bouton « Réessayer » et les liens vers les réseaux.

La page fonctionne en HTML, CSS et JavaScript, sans framework. Le CSS est généré avec Tailwind CSS v4 et déjà compilé dans `css/style.css`. Le dossier se déploie tel quel, sans build.

## Préparer une maintenance

Tout se règle dans [`js/config.js`](js/config.js). Aucun build n'est nécessaire.

| Clé | Rôle |
| --- | --- |
| `version` | Version affichée à côté de « Patch notes » |
| `returnAt` | Heure de retour au format ISO avec fuseau, par exemple `'2026-10-30T21:00:00+01:00'`. Avec `null`, la page affiche « très vite ». |
| `steps` | Étapes du terminal. `status` vaut `done`, `running` ou `pending`. |
| `notes` | Notes de patch. `type` vaut `new`, `improvement` ou `fix`. |
| `links` | Liens Discord, X et Twitch. Un lien vide est masqué. |
| `contactEmail` | E-mail de contact dans le pied de page. Vide, il est masqué. |
| `healthCheck` | Optionnel. La page interroge `url` toutes les `intervalSeconds` secondes et redirige vers `redirectTo` dès que la route répond 200. |

> La route de `healthCheck` doit être appelable depuis la page de maintenance : même domaine, ou CORS autorisé. Par exemple, un endpoint Spring Boot Actuator.

## Développement

```bash
npm install
npm run watch   # recompile css/style.css à chaque modification
npm run serve   # sert le dossier en local
```

Si tu ajoutes des classes Tailwind dans `index.html` ou dans `js/`, relance `npm run build` et commite `css/style.css`.

Les couleurs, polices et animations de la DA sont définies dans le bloc `@theme` de [`css/input.css`](css/input.css) : `bg-peps-yellow`, `font-display`, `animate-caret`, etc.

## Mise en ligne

Pour les moteurs de recherche, la page doit idéalement répondre avec le code **503** et un en-tête `Retry-After`. Exemple avec nginx :

```nginx
location / {
    return 503;
}

error_page 503 @maintenance;

location @maintenance {
    root /usr/share/nginx/maintenance;
    add_header Retry-After 3600 always;
    try_files /index.html =503;
}

location ~ ^/(css|js)/ {
    root /usr/share/nginx/maintenance;
}
```

## Structure

```
index.html        structure de la page
css/input.css     source Tailwind v4 (thème Team Peps)
css/style.css     CSS compilé, à commiter
js/config.js      contenu de la maintenance (à modifier)
js/main.js        logique : terminal, notes, heure de retour, vérification
```
