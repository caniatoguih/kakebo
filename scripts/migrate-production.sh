#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL não está configurada." >&2
  exit 1
fi

deploy_output="$(mktemp)"
trap 'rm -f "$deploy_output"' EXIT

set +e
npx prisma migrate deploy >"$deploy_output" 2>&1
deploy_status=$?
set -e

if [[ "$deploy_status" -eq 0 ]]; then
  cat "$deploy_output"
  npx prisma migrate status
  exit 0
fi

cat "$deploy_output" >&2

if ! grep -q 'P3005' "$deploy_output"; then
  exit "$deploy_status"
fi

echo "Banco existente sem histórico de migrations; validando baseline..."
set +e
npx prisma migrate diff \
  --from-url "$DATABASE_URL" \
  --to-schema-datamodel prisma/schema.prisma \
  --exit-code
diff_status=$?
set -e

case "$diff_status" in
  0)
    echo "Schema do Neon corresponde ao schema Prisma; registrando baseline 0_init."
    npx prisma migrate resolve --applied 0_init
    npx prisma migrate deploy
    npx prisma migrate status
    ;;
  2)
    echo "O schema do Neon diverge do schema Prisma. Baseline cancelado sem alterar o banco." >&2
    exit 2
    ;;
  *)
    echo "Não foi possível comparar o schema do Neon. Baseline cancelado." >&2
    exit "$diff_status"
    ;;
esac
