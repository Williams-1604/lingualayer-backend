#!/usr/bin/env bash
# Daily Postgres backup (issue #14). Dumps DATABASE_URL to a compressed
# file and uploads it to S3 (or a Backblaze B2 bucket via its S3-compatible
# endpoint - set BACKUP_S3_ENDPOINT_URL). Requires `pg_dump` and the AWS CLI
# (or an S3-compatible equivalent) on PATH. Logs size and duration in a
# form Prometheus's node_exporter textfile collector can pick up if
# BACKUP_METRICS_TEXTFILE is set - see #12 for the app's own /metrics.
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${BACKUP_S3_BUCKET:?BACKUP_S3_BUCKET is required}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
filename="lingualayer-${timestamp}.sql.gz"
tmpfile="$(mktemp -t lingualayer-backup.XXXXXX)"

start_epoch="$(date +%s)"
pg_dump "${DATABASE_URL}" | gzip > "${tmpfile}"
end_epoch="$(date +%s)"

duration_s=$((end_epoch - start_epoch))
size_bytes=$(wc -c < "${tmpfile}" | tr -d ' ')

s3_endpoint_args=()
if [ -n "${BACKUP_S3_ENDPOINT_URL:-}" ]; then
  s3_endpoint_args=(--endpoint-url "${BACKUP_S3_ENDPOINT_URL}")
fi

aws s3 cp "${s3_endpoint_args[@]}" "${tmpfile}" "s3://${BACKUP_S3_BUCKET}/${filename}"
rm -f "${tmpfile}"

echo "[backup] uploaded ${filename} (${size_bytes} bytes, ${duration_s}s)"

if [ -n "${BACKUP_METRICS_TEXTFILE:-}" ]; then
  {
    echo "# HELP lingualayer_backup_size_bytes Size of the most recent backup"
    echo "# TYPE lingualayer_backup_size_bytes gauge"
    echo "lingualayer_backup_size_bytes ${size_bytes}"
    echo "# HELP lingualayer_backup_duration_seconds Duration of the most recent backup"
    echo "# TYPE lingualayer_backup_duration_seconds gauge"
    echo "lingualayer_backup_duration_seconds ${duration_s}"
    echo "# HELP lingualayer_backup_last_success_timestamp Unix timestamp of the last successful backup"
    echo "# TYPE lingualayer_backup_last_success_timestamp gauge"
    echo "lingualayer_backup_last_success_timestamp ${end_epoch}"
  } > "${BACKUP_METRICS_TEXTFILE}"
fi

# Retention: delete backups older than RETENTION_DAYS.
cutoff_epoch=$(( $(date +%s) - RETENTION_DAYS * 86400 ))
aws s3 ls "${s3_endpoint_args[@]}" "s3://${BACKUP_S3_BUCKET}/" | while read -r line; do
  obj_date=$(echo "$line" | awk '{print $1" "$2}')
  obj_name=$(echo "$line" | awk '{print $4}')
  [ -z "${obj_name}" ] && continue
  obj_epoch=$(date -u -d "${obj_date}" +%s 2>/dev/null || date -u -j -f "%Y-%m-%d %H:%M:%S" "${obj_date}" +%s 2>/dev/null || echo 0)
  if [ "${obj_epoch}" -gt 0 ] && [ "${obj_epoch}" -lt "${cutoff_epoch}" ]; then
    echo "[backup] pruning expired backup: ${obj_name}"
    aws s3 rm "${s3_endpoint_args[@]}" "s3://${BACKUP_S3_BUCKET}/${obj_name}"
  fi
done
