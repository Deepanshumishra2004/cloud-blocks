#!/bin/bash
set -e
set -o pipefail

echo  "starting the pod"
TYPE_LOWER=$(echo "${REPL_TYPE:-}" | tr '[:upper:]' '[:lower:]')
SNAPSHOT_PREFIX="workspace/$USER_ID/$REPL_ID/"
LEGACY_SNAPSHOT_PREFIX="repls/$REPL_ID/"
TEMPLATE_PREFIX="template/$TYPE_LOWER/"
PREVIEW_LOG_DIR="/workspace/.cloudblocks"
PREVIEW_LOG_FILE="$PREVIEW_LOG_DIR/preview.log"

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

start_preview() {
  cd /workspace
  mkdir -p "$PREVIEW_LOG_DIR"
  : > "$PREVIEW_LOG_FILE"

  if [ ! -f package.json ]; then
    echo "no package.json found, skipping preview startup" | tee -a "$PREVIEW_LOG_FILE"
    return
  fi

  # Allow the Vite dev server to accept requests from the repl ingress hostname
  export __VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS="repl-${REPL_ID}.127.0.0.1.nip.io"
  export HOSTNAME="0.0.0.0"

  echo "installing workspace dependencies" | tee -a "$PREVIEW_LOG_FILE"
  if [ -f bun.lock ]; then
    bun install --frozen-lockfile 2>&1 | tee -a "$PREVIEW_LOG_FILE"
  else
    bun install 2>&1 | tee -a "$PREVIEW_LOG_FILE"
  fi

  # Each template runs on its native default port.
  # The ws-server proxy (PREVIEW_PORT=3002) forwards external traffic to these ports.
  case "$TYPE_LOWER" in
    react)
      echo "starting react dev server on 0.0.0.0:5173" | tee -a "$PREVIEW_LOG_FILE"
      bun run dev --host 0.0.0.0 >>"$PREVIEW_LOG_FILE" 2>&1 &
      ;;
    next)
      echo "starting next dev server on 0.0.0.0:3000" | tee -a "$PREVIEW_LOG_FILE"
      bun x next dev --hostname 0.0.0.0 >>"$PREVIEW_LOG_FILE" 2>&1 &
      ;;
    *)
      echo "preview startup not configured for repl type: $TYPE_LOWER" | tee -a "$PREVIEW_LOG_FILE"
      return
      ;;
  esac

  PREVIEW_PID=$!
}

cleanup() {
  if [ -n "${PREVIEW_PID:-}" ]; then
    kill "$PREVIEW_PID" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT

case "$TYPE_LOWER" in
  react|next)
    start_preview
    ;;
esac

cd /app/ws-server && bun agent.ts
