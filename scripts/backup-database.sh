#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
backup_dir="${BACKUP_DIR:-${project_dir}/backups}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
database_name="${DB_NAME:-kakebo}"
database_user="${DB_USER:-gcaniato}"
output="${backup_dir}/kakebo-${timestamp}.dump"

mkdir -p "$backup_dir"
docker compose -f "${COMPOSE_FILE:-${project_dir}/docker-compose.yml}" exec -T db \
  pg_dump -U "$database_user" -d "$database_name" -Fc > "$output"
test -s "$output"
sha256sum "$output" > "${output}.sha256"
printf 'Backup criado: %s\n' "$output"
