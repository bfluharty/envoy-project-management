# envoy-project-management

## Running Envoy locally with Docker
1. Clone [reasoning-engine](https://github.com/bfluharty/reasoning-engine) and save in the same folder as this repo.

2. In both repos, create `.env` file by copying `.env.example` and filling in secrets.
3. In this repo, run `./run-docker.sh` - as you make changes, the service will rebuild itself automatically.
3. When finished, `CTRL-C` will stop the container.