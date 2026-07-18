# Local Development

This guide covers native local development for the Project Management service.
For the full multi-service Docker workflow, see [Docker workflows](docker.md).

## Prerequisites

- Node.js 20 or newer. Node 22 is used by CI and Docker images.
- npm.
- PostgreSQL 16, either installed locally or run through Docker.
- A populated `.env` file.
- Optional sibling repos for integrated development:
  - `../reasoning-engine`
  - `../envoy-email-service`

## Install Dependencies

```bash
npm ci
```

The project depends on a local generated Foursquare package under `.api/`, so do
not remove that directory when installing dependencies.

## Environment Setup

Create `.env` from the example:

```bash
cp .env.example .env
node ace generate:key
```

Paste the generated key into `APP_KEY`.

Important local variables:

| Variable                    | Local purpose                                                |
| --------------------------- | ------------------------------------------------------------ |
| `NODE_ENV`                  | Usually `development` for native local development.          |
| `APP_ENV`                   | Usually `local`; used for application behavior decisions.    |
| `HOST`                      | Usually `localhost` for native development.                  |
| `PORT`                      | Defaults to `8080` in `.env.example`.                        |
| `APP_URL`                   | Must match the browser URL used by callbacks and middleware. |
| `DB_*`                      | PostgreSQL connection settings.                              |
| `REASONING_ENGINE_URL`      | Reasoning service base URL, usually `http://localhost:8081`. |
| `EMAIL_SERVICE_URL`         | Email service base URL, usually `http://localhost:8083`.     |
| `FOURSQUARE_PLACES_API_KEY` | Required for live vendor-place search.                       |
| `GOOGLE_CLIENT_*`           | Required for Google auth and Google inbox flows.             |
| `MICROSOFT_CLIENT_*`        | Required for Microsoft auth and Microsoft inbox flows.       |
| `PASSWORD_AUTH_ENABLED`     | Enables the legacy password auth path when set to `true`.    |

Do not commit `.env` or any secret values.

## Database Setup

Run migrations:

```bash
npm run migrate
```

Seed local data:

```bash
npm run seed
```

If you are using the Docker-provided database from `run-docker.sh --local`, the
script sets `DB_HOST=localhost` and runs migrations and seeders for you.

## Start Just This Service

Start the Adonis development server:

```bash
npm run dev
```

The app should be available at:

```text
http://localhost:8080
```

This only starts Project Management. Flows that call reasoning or email require
those services to be reachable at the URLs configured in `.env`.

## Start Dependencies In Docker And App Natively

Use this mode when you want fast local app reloads while still running the
database and sibling services in containers:

```bash
npm run dev:local
```

Equivalent command:

```bash
sh run-docker.sh --local
```

This starts Postgres, `reasoning-engine`, and `envoy-email-service` in Docker,
runs migrations and seeders locally, then starts `npm run dev`.

## Production-Style Local Start

Build and run the compiled app:

```bash
npm run build
npm start
```

Production Docker images run migrations from `entrypoint.sh` before starting
`node bin/server.js`.
