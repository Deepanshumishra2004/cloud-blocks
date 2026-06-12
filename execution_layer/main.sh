#!/bin/bash
set -e
set -o pipefail

echo  "starting the pod"
TYPE_LOWER=$(echo "${REPL_TYPE:-}" | tr '[:upper:]' '[:lower:]')
SNAPSHOT_PREFIX="workspace/$USER_ID/$REPL_ID/"
LEGACY_SNAPSHOT_PREFIX="repls/$REPL_ID/"
TEMPLATE_PREFIX="template/$TYPE_LOWER/"

R2_ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

if [ -n "$TYPE_LOWER" ] && aws s3 ls "s3://$S3_BUCKET/$SNAPSHOT_PREFIX" --endpoint-url "$R2_ENDPOINT" >/dev/null 2>&1; then
  echo "restoring snapshot from r2://$S3_BUCKET/$SNAPSHOT_PREFIX"
  aws s3 cp "s3://$S3_BUCKET/$SNAPSHOT_PREFIX" /workspace/ --recursive --endpoint-url "$R2_ENDPOINT"
elif aws s3 ls "s3://$S3_BUCKET/$LEGACY_SNAPSHOT_PREFIX" --endpoint-url "$R2_ENDPOINT" >/dev/null 2>&1; then
  echo "restoring legacy snapshot from r2://$S3_BUCKET/$LEGACY_SNAPSHOT_PREFIX"
  aws s3 cp "s3://$S3_BUCKET/$LEGACY_SNAPSHOT_PREFIX" /workspace/ --recursive --endpoint-url "$R2_ENDPOINT"
elif [ -n "$TYPE_LOWER" ] && aws s3 ls "s3://$S3_BUCKET/$TEMPLATE_PREFIX" --endpoint-url "$R2_ENDPOINT" >/dev/null 2>&1; then
  echo "new repl, cloning template from r2://$S3_BUCKET/$TEMPLATE_PREFIX"
  aws s3 cp "s3://$S3_BUCKET/$TEMPLATE_PREFIX" /workspace/ --recursive --endpoint-url "$R2_ENDPOINT"
else
  echo "no snapshot/template found, starting fresh"
fi

cd /app/ws-server
exec bun run start
