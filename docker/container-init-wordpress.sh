#!/bin/sh
set -eu

PROJECT_ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"

URL="${WORDPRESS_URL:-http://localhost:${WORDPRESS_PORT:-8080}}"
TITLE="${WORDPRESS_TITLE:-Rad am Ring Test}"
ADMIN_USER="${WORDPRESS_ADMIN_USER:-admin}"
ADMIN_PASSWORD="${WORDPRESS_ADMIN_PASSWORD:-password}"
ADMIN_EMAIL="${WORDPRESS_ADMIN_EMAIL:-admin@example.test}"

"$PROJECT_ROOT/docker/container-start.sh"

until "$PROJECT_ROOT/docker/container-wp-cli.sh" core is-installed >/dev/null 2>&1; do
  if "$PROJECT_ROOT/docker/container-wp-cli.sh" core version >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

if ! "$PROJECT_ROOT/docker/container-wp-cli.sh" core is-installed >/dev/null 2>&1; then
  "$PROJECT_ROOT/docker/container-wp-cli.sh" core install \
    --url="$URL" \
    --title="$TITLE" \
    --admin_user="$ADMIN_USER" \
    --admin_password="$ADMIN_PASSWORD" \
    --admin_email="$ADMIN_EMAIL" \
    --skip-email
fi

"$PROJECT_ROOT/docker/container-wp-cli.sh" plugin activate rad-am-ring-plugin

printf '%s\n' "WordPress is ready: $URL/wp-admin/"
printf '%s\n' "Login: $ADMIN_USER / $ADMIN_PASSWORD"
