#!/usr/bin/env bash
# Nightly backup of the database and uploaded media. Keeps 14 days.
#   crontab -e →  15 2 * * *  /var/www/projects/vvip/VVIp-Website/deploy/backup.sh >> /var/www/projects/vvip/VVIp-Website/logs/backup.log 2>&1
#
# Restore:
#   gunzip -c db-YYYYMMDD-HHMM.sql.gz | mariadb -u root vvip_cms
#   tar -xzf media-YYYYMMDD-HHMM.tar.gz -C /var/www/projects/vvip/VVIp-Website/storage
set -euo pipefail
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
set -a; . "$APP_DIR/.env"; set +a
DEST="${BACKUP_DIR:-$HOME/backups/vvip}"   # outside the web root
STAMP="$(date +%Y%m%d-%H%M)"
mkdir -p "$DEST"
umask 077
# --single-transaction gives a consistent InnoDB snapshot without locking the site
mysqldump --single-transaction --routines --triggers --default-character-set=utf8mb4 \
  -h "$DATABASE_HOST" -P "${DATABASE_PORT:-3306}" -u "$DATABASE_USER" -p"$DATABASE_PASSWORD" "$DATABASE_NAME" \
  | gzip -9 > "$DEST/db-$STAMP.sql.gz"
tar -czf "$DEST/media-$STAMP.tar.gz" -C "$(dirname "$UPLOAD_DIR")" "$(basename "$UPLOAD_DIR")"
find "$DEST" -name 'db-*.sql.gz' -mtime +14 -delete
find "$DEST" -name 'media-*.tar.gz' -mtime +14 -delete
echo "$(date -Is) backup ok: $DEST/db-$STAMP.sql.gz ($(du -h "$DEST/db-$STAMP.sql.gz" | cut -f1)), media-$STAMP.tar.gz"
