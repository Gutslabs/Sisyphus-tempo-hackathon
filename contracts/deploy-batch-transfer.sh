#!/usr/bin/env bash
# Deploy BatchTransfer to Tempo Moderato. Put your burner key in contracts/.env as PRIVATE_KEY=0x...
set -euo pipefail
cd "$(dirname "$0")"

if [[ -f .env ]]; then
  set -a
  source .env
  set +a
fi

if [[ -z "${PRIVATE_KEY:-}" ]] || [[ "${PRIVATE_KEY:-}" == "0x" ]]; then
  echo "Missing PRIVATE_KEY. Add to contracts/.env: PRIVATE_KEY=0x..."
  exit 1
fi

RPC_URL="${TEMPO_RPC_URL:-https://rpc.moderato.tempo.xyz}"

echo "Deploying BatchTransfer to: ${RPC_URL}"
forge create src/BatchTransfer.sol:BatchTransfer \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  --broadcast

echo ""
echo "Next:"
echo "1) Copy the deployed contract address above."
echo "2) Set it in web/.env.local as NEXT_PUBLIC_BATCH_TRANSFER_ADDRESS=0x..."

