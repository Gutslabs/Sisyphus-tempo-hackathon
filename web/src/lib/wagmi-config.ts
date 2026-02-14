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

/**
 * Wagmi configuration for Tempo blockchain with dual connector support:
 * 1. webAuthn (Passkey) - default, supports batch transactions via `calls` array
 * 2. injected (MetaMask) - optional fallback, does NOT support batch TX
 */
export const config = createConfig({
  connectors: [
    // Passkey connector - biometric auth with batch TX support
    // Passkey connector - biometric auth with batch TX support
    // Passkey connector - biometric auth with batch TX support
    ...(typeof window !== "undefined"
      ? [
        webAuthn({
          keyManager: KeyManager.localStorage(),
          // Note: For production, switch to KeyManager.http('/keys') with a server backend
        }),
      ]
      : []),
    // MetaMask / other injected wallets
    // injected(),
  ],
  chains: [tempoModerato],
  // Enable MetaMask auto-detection
  multiInjectedProviderDiscovery: true,
  transports: {
    [tempoModerato.id]: http(getTempoRpcUrl()),
  },
});

// Type exports for consumers
export type WagmiConfig = typeof config;
