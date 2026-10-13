#!/bin/bash

# OrderUp Automated PostgreSQL Backup Script
# Usage: ./scripts/backup-db.sh

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="./backups"
BACKUP_FILE="${BACKUP_DIR}/orderup_db_backup_${TIMESTAMP}.sql.gz"

mkdir -p ${BACKUP_DIR}

echo "[INFO] Starting PostgreSQL database backup..."
docker exec -t orderup_postgres_prod pg_dump -U postgres ${POSTGRES_DB:-orderup_db} | gzip > ${BACKUP_FILE}

if [ $? -eq 0 ]; then
  echo "[SUCCESS] Backup successfully saved to ${BACKUP_FILE}"
  # Prune backups older than 14 days
  find ${BACKUP_DIR} -type f -name "*.sql.gz" -mtime +14 -delete
else
  echo "[ERROR] Database backup failed!"
  exit 1
fi
