# envoy-project-management

## Running Envoy locally with Docker
1. Clone [reasoning-engine](https://github.com/bfluharty/reasoning-engine) and save in the same parent folder as this repo.

2. In both repos, create `.env` file by copying `.env.example` and filling in secrets.
3. In this repo, run `./run-docker.sh` - as you make changes, the services will rebuild automatically.
4. When finished, `CTRL-C` will stop the container.

*Note:*
If any updates are made to dependencies for either service, run `docker-compose build <service-name>` and then re-run the script.