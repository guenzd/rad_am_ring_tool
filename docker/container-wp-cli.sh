#!/bin/sh
set -eu

PROJECT_ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"

set -a
if [ -f "$PROJECT_ROOT/.env" ]; then
  . "$PROJECT_ROOT/.env"
fi
set +a

NETWORK="${CONTAINER_NETWORK:-rad-am-ring}"
WP_CONTAINER="${CONTAINER_WORDPRESS_NAME:-rad-am-ring-wordpress}"
WP_CLI_PHAR="${CONTAINER_WP_CLI_PHAR:-/tmp/wp-cli.phar}"
WP_CLI_URL="${CONTAINER_WP_CLI_URL:-https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar}"

container_exists() {
  container list --all --quiet | grep -Fx "$1" >/dev/null 2>&1
}

if ! container_exists "$WP_CONTAINER"; then
  "$PROJECT_ROOT/docker/container-start.sh"
fi

container start "$WP_CONTAINER" >/dev/null 2>&1 || true

if ! container exec "$WP_CONTAINER" test -f "$WP_CLI_PHAR" >/dev/null 2>&1; then
  container exec "$WP_CONTAINER" php -r "copy('$WP_CLI_URL', '$WP_CLI_PHAR');"
fi

container exec --workdir /var/www/html "$WP_CONTAINER" php "$WP_CLI_PHAR" --allow-root "$@"
