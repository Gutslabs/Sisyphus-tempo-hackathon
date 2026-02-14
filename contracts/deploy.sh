#!/usr/bin/env bash
# Load .env and deploy PaymentScheduler to Tempo. Put your burner key in .env as PRIVATE_KEY=0x...
set -e
cd "$(dirname "$0")"
if [[ -f .env ]]; then
  set -a
  source .env
  set +a
fi
if [[ -z "$PRIVATE_KEY" ]] || [[ "$PRIVATE_KEY" == "0x" ]]; then
  echo "Missing PRIVATE_KEY. Add to .env: PRIVATE_KEY=0x..."
  exit 1
fi
forge create src/PaymentScheduler.sol:PaymentScheduler \
  --rpc-url https://rpc.moderato.tempo.xyz \
  --private-key "$PRIVATE_KEY" \
  --broadcast
