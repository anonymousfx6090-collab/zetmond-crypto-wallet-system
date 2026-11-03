#!/usr/bin/env bash
set -euo pipefail
# Explicitly select the managed local daemon, never an inherited remote Docker endpoint.
docker() {
  command env -u DOCKER_HOST -u DOCKER_CONTEXT -u DOCKER_TLS -u DOCKER_TLS_VERIFY -u DOCKER_CERT_PATH \
    docker --host=unix:///var/run/docker.sock "$@"
}
# Local development only. Preserve this named volume; never use for production funds/data.
if ! docker container inspect zetmond-auth-postgres >/dev/null 2>&1; then
  docker run -d --name zetmond-auth-postgres \
    -e POSTGRES_USER=zetmond -e POSTGRES_PASSWORD=local-development-only -e POSTGRES_DB=zetmond_auth \
    -v zetmond-auth-data:/var/lib/postgresql/data -p 127.0.0.1:5432:5432 postgres:17-alpine
else
  docker start zetmond-auth-postgres >/dev/null
fi
for attempt in {1..30}; do
  if docker exec zetmond-auth-postgres pg_isready -U zetmond -d zetmond_auth >/dev/null 2>&1; then
    if ! docker exec zetmond-auth-postgres psql -U zetmond -d postgres -Atc "SELECT 1 FROM pg_database WHERE datname='zetmond_auth_test'" | rg -q '^1$'; then
      docker exec zetmond-auth-postgres createdb -U zetmond zetmond_auth_test
    fi
    echo 'Local PostgreSQL ready; development and isolated test databases available.'
    exit 0
  fi
  sleep 1
done
echo 'PostgreSQL did not become ready; inspect the container logs.' >&2
exit 1
