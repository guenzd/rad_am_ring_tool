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

The plugin creates a public page automatically:

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
