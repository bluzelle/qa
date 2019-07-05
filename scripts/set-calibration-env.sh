#!/usr/bin/env bash
set -e
set -o pipefail

MULTIPLIER=5

TEST_SUITE=${1:-test}
AVERAGE=$(npm run profile | tail -1)
ROUNDED_AVERAGE=$(printf "%.0f\n" "$AVERAGE")
KEY_CREATION_TIMEOUT_MULTIPLIER=$((ROUNDED_AVERAGE*$MULTIPLIER))

echo "Swarm speed calibration script"
echo "Average operation time: $AVERAGE"
echo "Multiplying by $MULTIPLIER to set as KEY_CREATION_TIMEOUT_MULTIPLIER"
echo "Setting KEY_CREATION_TIMEOUT_MULTIPLIER to be $KEY_CREATION_TIMEOUT_MULTIPLIER"
export KEY_CREATION_TIMEOUT_MULTIPLIER="$KEY_CREATION_TIMEOUT_MULTIPLIER"

echo "Running 'npm run $TEST_SUITE'"
npm run "$TEST_SUITE"
