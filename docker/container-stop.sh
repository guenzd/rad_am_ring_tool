#!/bin/sh
set -eu

set -a
if [ -f "$(dirname -- "$0")/../.env" ]; then
  . "$(dirname -- "$0")/../.env"
fi
set +a

NETWORK="${CONTAINER_NETWORK:-rad-am-ring}"
DB_CONTAINER="${CONTAINER_DB_NAME:-rad-am-ring-db}"
WP_CONTAINER="${CONTAINER_WORDPRESS_NAME:-rad-am-ring-wordpress}"
DB_VOLUME="${CONTAINER_DB_VOLUME:-rad-am-ring-db-data}"
WP_VOLUME="${CONTAINER_WORDPRESS_VOLUME:-rad-am-ring-wordpress-data}"

container stop "$WP_CONTAINER" "$DB_CONTAINER" >/dev/null 2>&1 || true
container delete "$WP_CONTAINER" "$DB_CONTAINER" >/dev/null 2>&1 || true
container network delete "$NETWORK" >/dev/null 2>&1 || true

if [ "${1:-}" = "--volumes" ]; then
  container volume delete "$WP_VOLUME" "$DB_VOLUME" >/dev/null 2>&1 || true
fi
