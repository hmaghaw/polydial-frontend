#!/bin/sh
# Writes runtime config for the SPA from container env vars, so one image runs in any environment.
set -eu
esc() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'; }
case "$(echo "${USE_MOCKS:-false}" | tr '[:upper:]' '[:lower:]')" in true|1|yes) MOCKS=true ;; *) MOCKS=false ;; esac
cat > /usr/share/nginx/html/env.js <<JS
window.__ENV__ = { API_BASE_URL: "$(esc "${API_BASE_URL:-https://api.polydial.com}")", USE_MOCKS: ${MOCKS}, APP_NAME: "$(esc "${APP_NAME:-PolyDial}")" };
JS
echo "env.js written (API_BASE_URL=${API_BASE_URL:-} USE_MOCKS=${MOCKS})"
