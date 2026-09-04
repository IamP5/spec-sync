#!/usr/bin/env bash
# Manual start/stop of a Cloud SQL instance (overrides the Cloud Scheduler jobs from
# infra/modules/cloud-sql-schedule). Usage: cloudsql.sh start|stop|status <instance>
# Waits for any in-flight operation first, since the API rejects concurrent changes (409).
set -euo pipefail

: "${GCP_PROJECT_ID:?Set GCP_PROJECT_ID}"
action="${1:?start|stop|status}"
instance="${2:?instance name}"

wait_for_operations() {
  local op
  for op in $(gcloud sql operations list --instance "$instance" --project "$GCP_PROJECT_ID" \
      --filter 'status!=DONE' --format 'value(name)'); do
    echo "waiting for operation ${op}..."
    gcloud sql operations wait "$op" --project "$GCP_PROJECT_ID" --timeout=unlimited >/dev/null
  done
}

status() {
  gcloud sql instances describe "$instance" --project "$GCP_PROJECT_ID" \
    --format 'value(name,state,settings.activationPolicy,ipAddresses[0].ipAddress)'
}

case "$action" in
  start|stop)
    policy=ALWAYS; [[ "$action" == stop ]] && policy=NEVER
    wait_for_operations
    # Start/stop can exceed gcloud's default wait, so submit async and wait without a limit.
    op=$(gcloud sql instances patch "$instance" --project "$GCP_PROJECT_ID" \
      --activation-policy "$policy" --quiet --async --format 'value(name)')
    echo "${action}: waiting for operation ${op}..."
    gcloud sql operations wait "$op" --project "$GCP_PROJECT_ID" --timeout=unlimited >/dev/null
    status
    ;;
  status) status ;;
  *) echo "unknown action: $action" >&2; exit 2 ;;
esac
