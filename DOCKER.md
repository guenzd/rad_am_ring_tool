# Local Docker Test Environment

This repo can run as a mounted WordPress plugin in Docker.

## Requirements

- Docker
- Docker Compose v2 (`docker compose`)

## Start WordPress

```sh
cp .env.example .env
docker compose up -d
```

Open:

- WordPress: http://localhost:8080
- Admin: http://localhost:8080/wp-admin/

On the first run, install WordPress in the browser, then activate **Rad am Ring** from **Plugins**.

## One-command setup

To install WordPress and activate the plugin from the terminal:

```sh
sh docker/init-wordpress.sh
```

Default login:

- User: `admin`
- Password: `password`

## Useful Commands

```sh
docker compose ps
docker compose logs -f wordpress
docker compose run --rm wp-cli plugin status rad-am-ring-plugin
docker compose run --rm wp-cli plugin activate rad-am-ring-plugin
docker compose run --rm wp-cli db query 'SHOW TABLES LIKE "%rar%";'
docker compose down
```

## Automated Tests

The core queue and prognosis rules can be tested without Docker:

```sh
npm test
npm run lint:js
```

See `TESTING.md` for an explanation of the covered cases.

## Public Race Page

The plugin creates a public page automatically. In the local Docker/Apple Container
environment WordPress usually runs without pretty permalinks, so use the `page_id`
URL:

- http://localhost:8080/?page_id=4

If pretty permalinks are enabled, the same page is also available at:

- http://localhost:8080/rad-am-ring-live/

You can also create a normal WordPress page manually and add this shortcode:

```text
[rad_am_ring_public]
```

It always shows the latest race as a public, read-only dashboard.

## Finished Race Export

After a race has ended, reload it in the admin dashboard and use **Excel Export**.
The download is a semicolon-separated CSV that opens in Excel with these columns:

- `Uhrzeit`
- `Fahrer`
- `Rundenzeit`

To delete the test database and WordPress files:

```sh
docker compose down -v
```

## Apple Container CLI

macOS 26 on Apple Silicon can run this project with Apple's `container` CLI, but it is not a Docker Compose replacement. Use this path when you want to run the same WordPress/MariaDB stack through Apple's container runtime.

Install Apple's signed package from:

- https://github.com/apple/container/releases

Then start WordPress:

```sh
cp .env.example .env
sh docker/container-start.sh
```

Install WordPress and activate the plugin:

```sh
sh docker/container-init-wordpress.sh
```

Run WP-CLI commands:

```sh
sh docker/container-wp-cli.sh plugin status rad-am-ring-plugin
sh docker/container-wp-cli.sh db query 'SHOW TABLES LIKE "%rar%";'
```

Stop and remove the Apple `container` containers:

```sh
sh docker/container-stop.sh
```

Delete the Apple `container` volumes too:

```sh
sh docker/container-stop.sh --volumes
```
