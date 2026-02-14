"use client";

import { createConfig, http } from "wagmi";
import { tempoModerato } from "viem/chains";
import { KeyManager, webAuthn } from "wagmi/tempo";
import { injected } from "wagmi/connectors";

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
  connectors: [
    ...(typeof window !== "undefined"
      ? [
        // Tempo passkey connector (WebAuthn)
        webAuthn({
          keyManager: KeyManager.localStorage(),
        }),
        // External wallets (MetaMask, Coinbase extension, etc.)
        injected(),
      ]
      : []),
  ],
  chains: [tempoModerato],
  multiInjectedProviderDiscovery: true,
  transports: {
    [tempoModerato.id]: http(getTempoRpcUrl()),
  },
});

// Type exports for consumers
export type WagmiConfig = typeof config;
