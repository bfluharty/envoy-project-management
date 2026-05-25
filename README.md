# envoy-project-management

## Running Envoy Locally with Docker

### Prerequisites

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/)
2. Clone [reasoning-engine](https://github.com/bfluharty/reasoning-engine) and save in the same parent folder as this repo.
3. In both repos, create `.env` file by copying `.env.example` and filling in secrets.

### Running Envoy

1. In this repo, run `./run-docker.sh` - as you make changes, the services will rebuild automatically.
2. When finished, use `CTRL-C` and then press any key to stop the container.

_Note:_
If any updates are made to dependencies for either service, run `docker-compose build <service-name>` and then re-run the script.
