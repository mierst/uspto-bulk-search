#!/bin/bash
# Daily SQLite backup with 7-day retention
# Add to cron: 0 3 * * * /opt/uspto-search/deploy/backup.sh

BACKUP_DIR=/opt/uspto-search-data/backups
DB_PATH=/opt/uspto-search-data/uspto-search.db
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

if [ -f "$DB_PATH" ]; then
    sqlite3 "$DB_PATH" ".backup ${BACKUP_DIR}/backup-${TIMESTAMP}.db"
    echo "Backup created: backup-${TIMESTAMP}.db"
fi

# Remove backups older than 7 days
find "$BACKUP_DIR" -name "backup-*.db" -mtime +7 -delete
echo "Old backups cleaned up"
