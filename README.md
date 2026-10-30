# Team Peps · Page de maintenance

Page affichée quand [teampeps.fr](https://teampeps.fr) est en maintenance. Elle reprend la DA du site : fond sombre, jaune `#F2C832`, Barlow Condensed et coins rabotés.

Elle présente :

- un terminal qui déroule les étapes du déploiement ligne par ligne, avec une barre de progression ;
- les notes de patch de la nouvelle version ;
- l'heure de retour prévue, avec le temps restant ;
- un bouton « Réessayer » et les liens vers les réseaux.

La page fonctionne en HTML, CSS et JavaScript, sans framework. Le CSS est généré avec Tailwind CSS v4 et déjà compilé dans `css/style.css`. Le dossier se déploie tel quel, sans build, ou via l'image Docker fournie.

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

## Activer la maintenance depuis GitHub

Le workflow **Mode maintenance** (onglet *Actions* → *Mode maintenance* → *Run workflow*) propose trois actions :

| Action | Effet |
| --- | --- |
| `on` | Met à jour la page avec `js/config.js` et l'heure de retour saisie, puis redirige le trafic vers la page de maintenance. |
| `off` | Remet le site en ligne. |
| `status` | Indique si le site est en maintenance. |

### Fonctionnement

Le pod `maintenance` (nginx) tourne en permanence dans le namespace du site, sans recevoir de trafic. Pour activer la maintenance, `scripts/maintenance.sh` change le **sélecteur du Service du front**, qui pointe alors vers ce pod. Le sélecteur d'origine est sauvegardé dans l'annotation `teampeps.fr/original-selector`, puis restauré par `off`.

L'Ingress n'est jamais modifié. Toutes les URL répondent `503` avec un en-tête `Retry-After`, ce qui est le bon signal pour les moteurs de recherche.

### Mise en place (une seule fois)

Même principe que le dépôt du front : pas de RBAC, le workflow utilise le kubeconfig stocké dans GitHub.

1. **Secret GitHub** : dans *Settings → Environments → prod*, ajoute le secret `KUBE_CONFIG`, le kubeconfig **encodé en base64** (le même format que `peps-frontend`). Dans cet environnement, tu peux exiger une validation avant chaque bascule (*Required reviewers*).

   ```bash
   base64 -w0 ~/.kube/config
   ```

2. **Discord (optionnel)** : ajoute le secret `DISCORD_WEBHOOK_URL` (celui du front) dans l'environnement *prod*. Un message est publié à chaque `on` (avec l'heure de retour si elle est renseignée) et à chaque `off`. Sans secret, la notification est ignorée. Pour un appel depuis un autre workflow, transmets-le aussi dans `secrets:`.

3. **Variables (optionnel)** : dans *Settings → Secrets and variables → Actions → Variables*, `K8S_NAMESPACE` et `FRONT_SERVICE` valent par défaut `peps-prod` et `peps-frontend` (le Service créé par le chart Helm du front).

4. **Image** : le workflow **Image de la page** publie `ghcr.io/team-peps/maintenance:latest` à chaque modification de la page sur `main`. Le pod réutilise le secret de pull `ghcr-pull-secret` du front.

> Le runner GitHub doit pouvoir joindre l'API Kubernetes (port 6443). Si ce port est filtré, utilise un runner auto-hébergé dans le cluster (Actions Runner Controller) et remplace `runs-on: ubuntu-latest` par le label de ce runner.

### Depuis un autre workflow

Le workflow est réutilisable, par exemple pour encadrer le déploiement du front :

```yaml
jobs:
  maintenance-on:
    uses: Team-Peps/maintenance/.github/workflows/maintenance.yml@main
    with:
      action: "on"
    secrets:
      KUBE_CONFIG: ${{ secrets.KUBE_CONFIG }}
      DISCORD_WEBHOOK_URL: ${{ secrets.DISCORD_WEBHOOK_URL }}

  deploy:
    needs: maintenance-on
    # ... déploiement, migrations, tests

  maintenance-off:
    needs: deploy
    uses: Team-Peps/maintenance/.github/workflows/maintenance.yml@main
    with:
      action: "off"
    secrets:
      KUBE_CONFIG: ${{ secrets.KUBE_CONFIG }}
      DISCORD_WEBHOOK_URL: ${{ secrets.DISCORD_WEBHOOK_URL }}
```

Si le dépôt `maintenance` est privé, autorise son accès aux autres dépôts de l'organisation : *Settings → Actions → General → Access*.

> Un `helm upgrade` du front réapplique le Service du chart (`app: peps-frontend`) : le sélecteur d'origine revient et le site repasse en ligne dès ce moment-là. Pratique pour finir une maintenance avec un déploiement, mais ne lance pas `on` avant un déploiement du front sans appeler `off` ensuite. L'annotation de sauvegarde est alors obsolète, et le prochain `on` l'écrase.

### En local

```bash
NAMESPACE=peps-prod FRONT_SERVICE=peps-frontend RETURN_AT=2026-10-30T21:00:00+01:00 \
  scripts/maintenance.sh on
scripts/maintenance.sh status
scripts/maintenance.sh off
```

## Structure

```
index.html                         structure de la page
css/input.css                      source Tailwind v4 (thème Team Peps)
css/style.css                      CSS compilé, à commiter
js/config.js                       contenu de la maintenance (à modifier)
js/main.js                         logique : terminal, notes, heure de retour, vérification
nginx.conf, Dockerfile             image servie dans le cluster (503 + Retry-After)
k8s/maintenance.yaml               pod de la page de maintenance
scripts/maintenance.sh             bascule on / off / status
.github/workflows/maintenance.yml  workflow « Mode maintenance »
.github/workflows/build-image.yml  publication de l'image sur GHCR
```
