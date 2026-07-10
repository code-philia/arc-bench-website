#!/bin/bash

set -euo pipefail

base_pid=""

cleanup() {
  if [[ -n "${base_pid}" ]] && kill -0 "${base_pid}" 2>/dev/null; then
    kill "${base_pid}" 2>/dev/null || true
    wait "${base_pid}" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

"${APP_PATH}/mixins/scripts/run.sh" &
base_pid=$!

# Give supervisord a short head start so device/appium processes are spawned
# before the runner starts polling for adb connectivity.
sleep 5

"$@"
