#!/usr/bin/env bash
# Confere um APK do No Prumo: pacote, versão (igual ao app.json), nome Prumo e assinatura.
# Uso: bash scripts/check-apk.sh caminho/do/app.apk
set -euo pipefail

APK="$1"
EXPECTED_PKG="com.meuorganizador.app"
EXPECTED_SHA="fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c"

SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
BT="$(ls -d "$SDK"/build-tools/* 2>/dev/null | sort -V | tail -1)"
[ -x "$BT/aapt2" ] || { echo "Não achei o aapt2 em \$ANDROID_HOME/build-tools"; exit 2; }

VER="$(node -p "require('./app.json').expo.version")"
CODE="$(node -p "require('./app.json').expo.android.versionCode")"

BADGING="$("$BT/aapt2" dump badging "$APK")"
pkg="$(sed -n "s/^package: name='\([^']*\)'.*/\1/p" <<<"$BADGING")"
vc="$(sed -n "s/^package:.* versionCode='\([^']*\)'.*/\1/p" <<<"$BADGING")"
vn="$(sed -n "s/^package:.* versionName='\([^']*\)'.*/\1/p" <<<"$BADGING")"
label="$(sed -n "s/^application-label:'\([^']*\)'.*/\1/p" <<<"$BADGING")"
sha="$("$BT/apksigner" verify --print-certs "$APK" | sed -n 's/.*SHA-256 digest: //p' | head -1)"
size="$(du -h "$APK" | cut -f1)"

fail=0
row() { # nome, achado, esperado
  if [ "$2" = "$3" ]; then ok="ok"; else ok="ERRADO (esperado $3)"; fail=1; fi
  printf '| %s | %s | %s |\n' "$1" "$2" "$ok"
}

{
  echo "### Conferência do APK"
  echo
  echo "| Item | No APK | Situação |"
  echo "|---|---|---|"
  row "Pacote" "$pkg" "$EXPECTED_PKG"
  row "versionCode" "$vc" "$CODE"
  row "versionName" "$vn" "$VER"
  row "Nome" "$label" "Prumo"
  row "Assinatura (SHA-256)" "${sha:0:12}…" "${EXPECTED_SHA:0:12}…"
  [ "$sha" = "$EXPECTED_SHA" ] || fail=1
  echo
  echo "Tamanho: $size"
} | tee -a "${GITHUB_STEP_SUMMARY:-/dev/null}"

exit $fail
