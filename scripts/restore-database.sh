#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 2 || "$2" != "--confirm" ]]; then
  printf 'Uso: %s backups/arquivo.dump --confirm\n' "$0" >&2
  exit 2
fi

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
backup_path="$(realpath "$1")"
backup_root="$(realpath "${project_dir}/backups")"
[[ "$backup_path" == "$backup_root"/*.dump ]] || { printf 'O backup deve estar em %s\n' "$backup_root" >&2; exit 2; }
[[ -s "$backup_path" ]] || { printf 'Backup vazio ou inexistente.\n' >&2; exit 2; }
[[ -f "${backup_path}.sha256" ]] && sha256sum -c "${backup_path}.sha256"

database_name="${DB_NAME:-kakebo}"
database_user="${DB_USER:-gcaniato}"
compose_file="${COMPOSE_FILE:-${project_dir}/docker-compose.yml}"

docker compose -f "$compose_file" exec -T db pg_restore --list < "$backup_path" > /dev/null
if [[ "$database_name" == "kakebo" ]]; then
  docker compose -f "$compose_file" stop app
fi
restore_status=0
docker compose -f "$compose_file" exec -T db pg_restore \
  -U "$database_user" -d "$database_name" --clean --if-exists --no-owner --no-privileges < "$backup_path" || restore_status=$?
if [[ "$database_name" == "kakebo" ]]; then
  docker compose -f "$compose_file" start app
fi
exit "$restore_status"
