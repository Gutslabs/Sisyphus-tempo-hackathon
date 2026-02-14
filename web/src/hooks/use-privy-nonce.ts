"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useAccount } from "wagmi";
import { getPublicClient } from "@/lib/tempo";

/**
 * Privy embedded wallets can return stale nonces (eg blockTag=latest),
 * causing "nonce too low" on consecutive transactions.
 *
 * This helper:
 * - reads pending nonce from the chain via our public RPC client
 * - keeps a local monotonic counter to avoid going backwards
 * - returns a nonce suitable to pass explicitly to sendTransaction
 */
export function usePrivyNonce() {
  const { address, connector } = useAccount();

  const isPrivyEmbedded = useMemo(() => {
    return typeof connector?.id === "string" && connector.id.startsWith("io.privy.wallet");
  }, [connector?.id]);

  const nextNonceRef = useRef<number | null>(null);

  useEffect(() => {
    // Reset when account/connector changes.
    nextNonceRef.current = null;
  }, [address, connector?.id]);

  const getNextNonce = useCallback(async (): Promise<number | undefined> => {
    if (!isPrivyEmbedded) return undefined;
    if (!address) return undefined;

    const publicClient = getPublicClient();
    const pending = await publicClient.getTransactionCount({
      address,
      blockTag: "pending",
    });
    const chainNonce = Number(pending);
    const local = nextNonceRef.current;
    const nonce = local == null ? chainNonce : Math.max(local, chainNonce);
    nextNonceRef.current = nonce + 1;
    return nonce;
  }, [address, isPrivyEmbedded]);

  return { isPrivyEmbedded, getNextNonce };
}

