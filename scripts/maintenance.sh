#!/usr/bin/env bash
#
# Active ou désactive le mode maintenance de teampeps.fr.
#
#   scripts/maintenance.sh on       Affiche la page de maintenance
#   scripts/maintenance.sh off      Remet le site en ligne
#   scripts/maintenance.sh status   Indique l'état actuel
#
# Principe : le Service du front est redirigé vers le pod « maintenance »
# en changeant son sélecteur. Le sélecteur d'origine est sauvegardé dans une
# annotation du Service, puis restauré au retour. L'Ingress n'est jamais modifié.
#
# Variables d'environnement :
#   NAMESPACE      Namespace du site                 (défaut : teampeps)
#   FRONT_SERVICE  Service exposé par l'Ingress      (défaut : teampeps-front)
#   RETURN_AT      Heure de retour ISO 8601, optionnelle (ex. 2026-10-30T21:00:00+01:00)
#   CONFIG_FILE    Fichier de config de la page      (défaut : js/config.js)
#   MANIFEST       Manifeste du pod de maintenance   (défaut : k8s/maintenance.yaml)

set -euo pipefail

NAMESPACE="${NAMESPACE:-teampeps}"
FRONT_SERVICE="${FRONT_SERVICE:-teampeps-front}"
RETURN_AT="${RETURN_AT:-}"
CONFIG_FILE="${CONFIG_FILE:-js/config.js}"
MANIFEST="${MANIFEST:-k8s/maintenance.yaml}"

ANNOTATION="teampeps.fr/original-selector"
MAINTENANCE_SELECTOR='{"app":"maintenance"}'

kc() { kubectl -n "$NAMESPACE" "$@"; }

log() { printf '› %s\n' "$*"; }
fail() { printf '✗ %s\n' "$*" >&2; exit 1; }

summary() {
  # Résumé affiché dans l'onglet Actions de GitHub (ignoré en local)
  if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
    printf '%s\n' "$*" >> "$GITHUB_STEP_SUMMARY"
  fi
}

current_selector() {
  kc get svc "$FRONT_SERVICE" -o jsonpath='{.spec.selector}'
}

saved_selector() {
  kc get svc "$FRONT_SERVICE" -o jsonpath="{.metadata.annotations.teampeps\.fr/original-selector}"
}

is_on() {
  [[ "$(current_selector)" == "$MAINTENANCE_SELECTOR" ]]
}

set_selector() {
  kc patch svc "$FRONT_SERVICE" --type=json \
    -p "[{\"op\":\"replace\",\"path\":\"/spec/selector\",\"value\":$1}]" >/dev/null
}

check_port() {
  local target
  target="$(kc get svc "$FRONT_SERVICE" -o jsonpath='{.spec.ports[0].targetPort}')"
  if [[ "$target" != "80" && "$target" != "http" ]]; then
    fail "Le Service $FRONT_SERVICE cible le port « $target » : le pod de maintenance écoute sur 80 (http). Adapte nginx.conf et k8s/maintenance.yaml."
  fi
}

sync_page() {
  local config
  config="$(mktemp)"
  cp "$CONFIG_FILE" "$config"

  if [[ -n "$RETURN_AT" ]]; then
    if ! date -d "$RETURN_AT" >/dev/null 2>&1; then
      fail "RETURN_AT invalide : « $RETURN_AT » (attendu : 2026-10-30T21:00:00+01:00)"
    fi
    printf "\nwindow.MAINTENANCE_CONFIG.returnAt = '%s';\n" "$RETURN_AT" >> "$config"
    log "Heure de retour : $RETURN_AT"
  fi

  log "Mise à jour de la configuration de la page"
  kc create configmap maintenance-config --from-file=config.js="$config" \
    --dry-run=client -o yaml | kc apply -f - >/dev/null
  rm -f "$config"

  log "Déploiement du pod de maintenance"
  kc apply -f "$MANIFEST" >/dev/null
  kc rollout restart deploy/maintenance >/dev/null
  kc rollout status deploy/maintenance --timeout=120s
}

cmd_on() {
  check_port
  sync_page

  if is_on; then
    log "La maintenance était déjà active : page mise à jour."
    summary "### 🟡 Maintenance déjà active · page mise à jour"
    return
  fi

  local original
  original="$(current_selector)"
  [[ -n "$original" ]] || fail "Impossible de lire le sélecteur du Service $FRONT_SERVICE."

  log "Sauvegarde du sélecteur d'origine : $original"
  kc annotate svc "$FRONT_SERVICE" "$ANNOTATION=$original" --overwrite >/dev/null

  log "Bascule du trafic vers la page de maintenance"
  set_selector "$MAINTENANCE_SELECTOR"

  log "Maintenance ACTIVÉE"
  summary "### 🟡 Maintenance activée"
  summary "Le Service \`$FRONT_SERVICE\` pointe vers la page de maintenance."
  if [[ -n "$RETURN_AT" ]]; then
    summary "Retour annoncé : \`$RETURN_AT\`"
  fi
}

cmd_off() {
  if ! is_on; then
    log "La maintenance n'est pas active : rien à faire."
    summary "### 🟢 Le site était déjà en ligne"
    return
  fi

  local original
  original="$(saved_selector)"
  [[ -n "$original" ]] || fail "Sélecteur d'origine introuvable (annotation $ANNOTATION). Restaure-le à la main."

  log "Restauration du sélecteur d'origine : $original"
  set_selector "$original"
  kc annotate svc "$FRONT_SERVICE" "$ANNOTATION-" >/dev/null

  log "Maintenance DÉSACTIVÉE"
  summary "### 🟢 Maintenance désactivée"
  summary "Le Service \`$FRONT_SERVICE\` pointe à nouveau vers le site."
}

cmd_status() {
  if is_on; then
    log "État : MAINTENANCE (sélecteur d'origine sauvegardé : $(saved_selector))"
    summary "### 🟡 Le site est en maintenance"
  else
    log "État : EN LIGNE (sélecteur : $(current_selector))"
    summary "### 🟢 Le site est en ligne"
  fi
}

case "${1:-status}" in
  on) cmd_on ;;
  off) cmd_off ;;
  status) cmd_status ;;
  *) fail "Usage : $0 on|off|status" ;;
esac
