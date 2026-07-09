#!/bin/bash
# نشر سيرفر ألعاب الروم على Google Cloud Run (مشروع linkup-dc45f)
set -euo pipefail
cd "$(dirname "$0")"
PROJECT="${GCLOUD_PROJECT:-linkup-dc45f}"
REGION="${GCLOUD_REGION:-us-central1}"
SERVICE="linkup-room-games"

gcloud run deploy "$SERVICE" \
  --source . \
  --project "$PROJECT" \
  --region "$REGION" \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --min-instances 0 \
  --max-instances 10 \
  --quiet

echo ""
echo "✅ انسخ الرابط أعلاه إلى EXPO_PUBLIC_ROOM_GAMES_SERVER في التطبيق"
