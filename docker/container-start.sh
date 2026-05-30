#!/bin/sh
set -eu

PROJECT_ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"

if ! command -v container >/dev/null 2>&1; then
  printf '%s\n' "Apple container CLI is not installed. Install it from https://github.com/apple/container/releases" >&2
  exit 1
fi

set -a
if [ -f "$PROJECT_ROOT/.env" ]; then
  . "$PROJECT_ROOT/.env"
fi
set +a

WORDPRESS_PORT="${WORDPRESS_PORT:-8080}"
WORDPRESS_DB_NAME="${WORDPRESS_DB_NAME:-wordpress}"
WORDPRESS_DB_USER="${WORDPRESS_DB_USER:-wordpress}"
WORDPRESS_DB_PASSWORD="${WORDPRESS_DB_PASSWORD:-wordpress}"
MARIADB_ROOT_PASSWORD="${MARIADB_ROOT_PASSWORD:-root}"
WORDPRESS_IMAGE="${CONTAINER_WORDPRESS_IMAGE:-docker.io/library/wordpress:7.0.0-php8.2-apache}"
MARIADB_IMAGE="${CONTAINER_MARIADB_IMAGE:-docker.io/library/mariadb:10.11}"

NETWORK="${CONTAINER_NETWORK:-rad-am-ring}"
DB_CONTAINER="${CONTAINER_DB_NAME:-rad-am-ring-db}"
WP_CONTAINER="${CONTAINER_WORDPRESS_NAME:-rad-am-ring-wordpress}"
DB_VOLUME="${CONTAINER_DB_VOLUME:-rad-am-ring-db-data}"
WP_VOLUME="${CONTAINER_WORDPRESS_VOLUME:-rad-am-ring-wordpress-data}"

container_exists() {
  container list --all --quiet | grep -Fx "$1" >/dev/null 2>&1
}

network_exists() {
  container network list --quiet | grep -Fx "$1" >/dev/null 2>&1
}

volume_exists() {
  container volume list --quiet | grep -Fx "$1" >/dev/null 2>&1
}

container_ipv4() {
  address="$(container inspect "$1" | plutil -extract 0.networks.0.ipv4Address raw -o - -)"
  printf '%s\n' "${address%/*}"
}

container system start --enable-kernel-install

network_exists "$NETWORK" || container network create "$NETWORK"
volume_exists "$DB_VOLUME" || container volume create "$DB_VOLUME"
volume_exists "$WP_VOLUME" || container volume create "$WP_VOLUME"

if container_exists "$DB_CONTAINER"; then
  container start "$DB_CONTAINER" >/dev/null 2>&1 || true
else
  container run \
    --name "$DB_CONTAINER" \
    --detach \
    --network "$NETWORK" \
    --env "MARIADB_DATABASE=$WORDPRESS_DB_NAME" \
    --env "MARIADB_USER=$WORDPRESS_DB_USER" \
    --env "MARIADB_PASSWORD=$WORDPRESS_DB_PASSWORD" \
    --env "MARIADB_ROOT_PASSWORD=$MARIADB_ROOT_PASSWORD" \
    --volume "$DB_VOLUME:/var/lib/mysql" \
    "$MARIADB_IMAGE"
fi

if ! container_exists "$DB_CONTAINER"; then
  printf '%s\n' "MariaDB container was not created." >&2
  exit 1
fi

printf '%s' "Waiting for MariaDB"
until container exec "$DB_CONTAINER" healthcheck.sh --connect --innodb_initialized >/dev/null 2>&1; do
  printf '.'
  sleep 2
done
printf '\n'

DB_HOST="$(container_ipv4 "$DB_CONTAINER")"

if container_exists "$WP_CONTAINER"; then
  container start "$WP_CONTAINER" >/dev/null 2>&1 || true
else
  container run \
    --name "$WP_CONTAINER" \
    --detach \
    --network "$NETWORK" \
    --publish "$WORDPRESS_PORT:80" \
    --env "WORDPRESS_DB_HOST=$DB_HOST:3306" \
    --env "WORDPRESS_DB_NAME=$WORDPRESS_DB_NAME" \
    --env "WORDPRESS_DB_USER=$WORDPRESS_DB_USER" \
    --env "WORDPRESS_DB_PASSWORD=$WORDPRESS_DB_PASSWORD" \
    --env "WORDPRESS_DEBUG=${WORDPRESS_DEBUG:-1}" \
    --env "WORDPRESS_CONFIG_EXTRA=define( 'WP_DEBUG_LOG', true );
define( 'WP_DEBUG_DISPLAY', false );
define( 'SCRIPT_DEBUG', true );" \
    --volume "$WP_VOLUME:/var/www/html" \
    --volume "$PROJECT_ROOT:/var/www/html/wp-content/plugins/rad-am-ring-plugin" \
    "$WORDPRESS_IMAGE"
fi

printf '%s\n' "WordPress container is starting: http://localhost:$WORDPRESS_PORT"
