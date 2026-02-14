"use client";

import { createConfig } from "@privy-io/wagmi";
import { http } from "wagmi";
import { tempoModerato } from "viem/chains";

const TEMPO_RPC_DIRECT = "https://rpc.moderato.tempo.xyz";

// In the browser, use our API proxy so eth_call, eth_getTransactionCount, eth_sendRawTransaction
// don't hit CORS / ERR_EMPTY_RESPONSE from rpc.moderato.tempo.xyz
function getTempoRpcUrl(): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/api/tempo/rpc`;
  }
  return TEMPO_RPC_DIRECT;
}

export const config = createConfig({
  chains: [tempoModerato],
  transports: {
    [tempoModerato.id]: http(getTempoRpcUrl()),
  },
});

// Type exports for consumers
export type WagmiConfig = typeof config;
