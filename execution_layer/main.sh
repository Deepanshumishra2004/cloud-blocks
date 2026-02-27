#!/bin/bash
set -e

echo  "starting the pod"
aws s3 cp s3://$S3_BUCKET/repls/$REPL_ID/ /workspace/ --recursive \
  || echo "no snapshot found, starting fresh"

cd /app/ws-server && bun agent.ts