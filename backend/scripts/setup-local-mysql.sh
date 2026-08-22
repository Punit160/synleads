#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BACKEND="$ROOT/backend"

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
DB_NAME="${DB_NAME:-leadflow}"
DB_USER="${DB_USER:-leadflow}"
DB_PASS="${DB_PASS:-leadflow}"
MYSQL_ADMIN="${MYSQL_ADMIN:-root}"
MYSQL_ADMIN_PASS="${MYSQL_ADMIN_PASS:-}"

echo "Setting up local MySQL at ${DB_HOST}:${DB_PORT}/${DB_NAME} ..."

if [ -n "$MYSQL_ADMIN_PASS" ]; then
  MYSQL_CMD=(mysql -h"$DB_HOST" -P"$DB_PORT" -u"$MYSQL_ADMIN" -p"$MYSQL_ADMIN_PASS")
else
  MYSQL_CMD=(mysql -h"$DB_HOST" -P"$DB_PORT" -u"$MYSQL_ADMIN")
fi

"${MYSQL_CMD[@]}" <<SQL
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
CREATE USER IF NOT EXISTS '${DB_USER}'@'127.0.0.1' IDENTIFIED BY '${DB_PASS}';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'127.0.0.1';
FLUSH PRIVILEGES;
SQL

ENV_FILE="$BACKEND/.env"
if [ ! -f "$ENV_FILE" ]; then
  cp "$BACKEND/.env.example" "$ENV_FILE"
fi

# Ensure .env points at local MySQL
grep -q '^DATABASE_URL=' "$ENV_FILE" && \
  sed -i '' "s|^DATABASE_URL=.*|DATABASE_URL=\"mysql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}\"|" "$ENV_FILE" || \
  echo "DATABASE_URL=\"mysql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}\"" >> "$ENV_FILE"

if [ -n "$MYSQL_ADMIN_PASS" ]; then
  SHADOW_URL="mysql://${MYSQL_ADMIN}:${MYSQL_ADMIN_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
else
  SHADOW_URL="mysql://${MYSQL_ADMIN}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
fi

grep -q '^SHADOW_DATABASE_URL=' "$ENV_FILE" && \
  sed -i '' "s|^SHADOW_DATABASE_URL=.*|SHADOW_DATABASE_URL=\"${SHADOW_URL}\"|" "$ENV_FILE" || \
  echo "SHADOW_DATABASE_URL=\"${SHADOW_URL}\"" >> "$ENV_FILE"

cd "$BACKEND"
npx prisma migrate deploy
npm run db:seed

echo ""
echo "Local MySQL ready: ${DB_HOST}:${DB_PORT}/${DB_NAME}"
echo "Restart backend if it is already running: npm run dev"
