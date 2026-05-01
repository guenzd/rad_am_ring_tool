#!/bin/sh
set -eu

URL="${WORDPRESS_URL:-http://localhost:${WORDPRESS_PORT:-8080}}"
TITLE="${WORDPRESS_TITLE:-Rad am Ring Test}"
ADMIN_USER="${WORDPRESS_ADMIN_USER:-admin}"
ADMIN_PASSWORD="${WORDPRESS_ADMIN_PASSWORD:-password}"
ADMIN_EMAIL="${WORDPRESS_ADMIN_EMAIL:-admin@example.test}"

docker compose up -d db wordpress

until docker compose run --rm wp-cli core is-installed >/dev/null 2>&1; do
  if docker compose run --rm wp-cli core version >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

if ! docker compose run --rm wp-cli core is-installed >/dev/null 2>&1; then
  docker compose run --rm wp-cli core install \
    --url="$URL" \
    --title="$TITLE" \
    --admin_user="$ADMIN_USER" \
    --admin_password="$ADMIN_PASSWORD" \
    --admin_email="$ADMIN_EMAIL" \
    --skip-email
fi

docker compose run --rm wp-cli plugin activate rad-am-ring-plugin

printf '%s\n' "WordPress is ready: $URL/wp-admin/"
printf '%s\n' "Login: $ADMIN_USER / $ADMIN_PASSWORD"
