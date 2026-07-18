# Docker Workflows

The repository includes a Docker Compose workflow for running the full local
Envoy stack.

## Required Repo Layout

The Compose file expects sibling repositories in the same parent directory:

```text
envoy/
  envoy-project-management/
  reasoning-engine/
  envoy-email-service/
```

Each service should have its own `.env` file created from its `.env.example`.

## Full Stack

Run every local service in Docker:

```bash
./run-docker.sh
```

The script:

1. Builds Compose images.
2. Removes the project-management `node_modules` Docker volume so dependency
   installs are fresh for the current lockfile.
3. Starts PostgreSQL.
4. Waits until PostgreSQL is healthy.
5. Starts `reasoning-engine` and `envoy-email-service`.
6. Runs Project Management migrations in a one-off container.
7. Runs Project Management seeders in a one-off container.
8. Starts the Project Management development container with live reload.

Stop with `CTRL-C`. The script traps exit signals and runs `docker compose down`.

## Local App Mode

Run dependencies in Docker and this app natively:

```bash
./run-docker.sh --local
```

This mode starts PostgreSQL, `reasoning-engine`, and `envoy-email-service` in
Docker, then runs migrations, seeders, and `npm run dev` on the host. It is
useful when local filesystem performance is better outside Docker.

The npm alias is:

```bash
npm run dev:local
```

## Service Ports

| Service            | Port   | Notes                                     |
| ------------------ | ------ | ----------------------------------------- |
| Project Management | `8080` | Main Adonis/Inertia app.                  |
| Reasoning Engine   | `8081` | Sibling LLM workflow service.             |
| Email Service      | `8083` | Sibling email integration service.        |
| PostgreSQL         | `5432` | Uses credentials from this repo's `.env`. |

## Compose Services

| Service              | Purpose                                                                                 |
| -------------------- | --------------------------------------------------------------------------------------- |
| `project-management` | Builds from `Dockerfile.dev`, mounts this repo, and runs `npm run dev`.                 |
| `reasoning-engine`   | Builds from `../reasoning-engine/Dockerfile.dev` and mounts the sibling reasoning repo. |
| `email-service`      | Builds from `../envoy-email-service/Dockerfile.dev`.                                    |
| `postgres`           | Runs PostgreSQL 16 with a persisted `postgres_data` volume.                             |

## Rebuilding After Dependency Changes

If `package.json` or `package-lock.json` changes in this repo or a sibling
service, rebuild the affected service:

```bash
docker compose build project-management
docker compose build reasoning-engine
docker compose build email-service
```

Then re-run:

```bash
./run-docker.sh
```

## Production Image

Build the production image:

```bash
docker build -t envoy-project-management .
```

Run it against reachable production-style dependencies:

```bash
docker run --rm -p 8080:8080 --env-file .env envoy-project-management
```

The production entrypoint runs database migrations with `--force` until the
database is ready, then starts `node bin/server.js`.

## Troubleshooting

If Postgres state is stale, reset the Compose database volume:

```bash
docker compose down -v
```

If dependencies inside the dev container are stale, rebuild the image or remove
the relevant `node_modules` volume:

```bash
docker compose build project-management
docker volume rm -f envoy-project-management_project_management_node_modules
```

If a port is already in use, stop the process using that port or change the
corresponding port mapping and environment value.
