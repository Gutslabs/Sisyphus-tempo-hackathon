"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAccount, useSendTransaction } from "wagmi";
import { type Address, encodeFunctionData, parseUnits, decodeEventLog } from "viem";
import {
  TEMPO_TOKENS, ERC20_ABI, EXCHANGE_ABI, TEMPO_EXCHANGE_ADDRESS,
  PAYMENT_SCHEDULER_ADDRESS, PAYMENT_SCHEDULER_ABI,
  findToken, explorerTxUrl, getPublicClient, priceToTick, type TempoToken,
  getStoredTokens, formatTokenAmount, type StoredToken
} from "@/lib/tempo";

export interface TokenBalance {
  token: TempoToken;
  raw: bigint;
  formatted: string;
}

export interface SendResult {
  hash: string;
  explorerUrl: string;
}

// Batch send result - single TX with multiple transfers
export interface BatchSendResult {
  hash: string;
  explorerUrl: string;
  transferCount: number;
  isBatch: true;
}

// ── useTempoBalances ──────────────────────────────────────────
export function useTempoBalances() {
  const { address, isConnected } = useAccount();
  const [balances, setBalances] = useState<TokenBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stable address ref - prevents flickering when Wagmi reinitializes
  const stableAddressRef = useRef<Address | undefined>(undefined);
  if (address) stableAddressRef.current = address;
  const stableAddress = stableAddressRef.current;

  const refresh = useCallback(async (): Promise<TokenBalance[] | null> => {
    if (!stableAddress) return null;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tempo/balance?address=${stableAddress}`);
      const data = await res.json();
      if (data.error) { setError(data.error); return null; }

      const results: TokenBalance[] = (data.balances ?? []).map(
        (b: { symbol: string; raw: string; formatted: string }) => {
          const token = TEMPO_TOKENS.find((t) => t.symbol === b.symbol) ?? TEMPO_TOKENS[0];
          return { token, raw: BigInt(b.raw), formatted: b.formatted };
        },
      );

      // Fetch dynamic tokens from local storage
      const storedTokens = getStoredTokens(stableAddress);
      if (storedTokens.length > 0) {
        // Filter out tokens already in static list and de-duplicate by address
        const byAddress = new Map<string, StoredToken>();
        for (const st of storedTokens) {
          const addr = st.address.toLowerCase();
          if (TEMPO_TOKENS.some((tt) => tt.address.toLowerCase() === addr)) continue;
          if (!byAddress.has(addr)) byAddress.set(addr, st);
        }
        const uniqueStored = Array.from(byAddress.values());

        if (uniqueStored.length > 0) {
          const client = getPublicClient();

          const dynamicBalances: TokenBalance[] = [];

          for (const t of uniqueStored) {
            const decimals = t.decimals || 6;
            let raw: bigint = 0n;

            // 1. Önce Tempo'nun native token.getBalance API'sini dene
            try {
              const tempoBalance = await client.token.getBalance({
                token: t.address,
                account: stableAddress,
              });
              raw = tempoBalance as bigint;
            } catch {
              // 2. Fallback: standart ERC-20 balanceOf
              try {
                const erc20Balance = await client.readContract({
                  address: t.address,
                  abi: ERC20_ABI,
                  functionName: "balanceOf",
                  args: [stableAddress],
                });
                raw = erc20Balance as bigint;
              } catch {
                raw = 0n;
              }
            }

            dynamicBalances.push({
              token: { ...t, decimals },
              raw,
              formatted: formatTokenAmount(raw, decimals),
            });
          }

          results.push(...dynamicBalances);
        }
      }

      setBalances(results);
      return results;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to fetch balances";
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, [stableAddress]);

  useEffect(() => {
    if (isConnected && stableAddress) {
      refresh();
      const id = setInterval(refresh, 10000);
      return () => clearInterval(id);
    }
  }, [isConnected, stableAddress, refresh]);

  return { balances, loading, error, refresh, address: stableAddress };
}

// ── useTempoFaucet ────────────────────────────────────────────
// Calls server-side faucet API to fund account with testnet tokens
export function useTempoFaucet() {
  const { address } = useAccount();
  const [funding, setFunding] = useState(false);
  const [funded, setFunded] = useState(false);

  const requestFunds = useCallback(async (targetAddress?: string) => {
    const walletAddress = targetAddress ?? address;
    if (!walletAddress) throw new Error("No wallet address");

    setFunding(true);
    try {
      const res = await fetch("/api/tempo/faucet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: walletAddress }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setFunded(true);
      return data;
    } finally {
      setFunding(false);
    }
  }, [address]);

  return { requestFunds, funding, funded };
}

// ── useTempoSend ──────────────────────────────────────────────
export function useTempoSend() {
  const { connector } = useAccount();
  const { sendTransactionAsync, isPending } = useSendTransaction();

  // Check if current connector supports batch transactions (Passkey / WebAuthn)
  const supportsBatchTx = connector?.name === "WebAuthn" || connector?.id === "webAuthn";
  const isPrivyEmbedded = typeof connector?.id === "string" && connector.id.startsWith("io.privy.wallet");

  /**
   * Send a single token transfer
   */
  const sendPayment = useCallback(async (
    tokenSymbol: string,
    amount: string,
    to: Address,
  ): Promise<SendResult> => {
    const token = findToken(tokenSymbol);
    if (!token) throw new Error(`Token not found: ${tokenSymbol}`);

    const parsedAmount = parseUnits(amount, token.decimals);

    const hash = await sendTransactionAsync({
      to: token.address,
      data: encodeFunctionData({
        abi: ERC20_ABI,
        functionName: "transfer",
        args: [to, parsedAmount],
      }),
    });

    return { hash, explorerUrl: explorerTxUrl(hash) };
  }, [sendTransactionAsync]);

  /**
   * Send multiple transfers.
   *
   * - Passkey wallet: Uses Tempo's batch TX (calls array) - single TX, single biometric prompt
   * - MetaMask/Injected: Sequential transfers (one approval per TX)
   *
   * Returns either:
   * - BatchSendResult (single hash) for Passkey batch TX
   * - SendResult[] (multiple hashes) for sequential transfers
   */
  const sendParallel = useCallback(async (
    transfers: { tokenSymbol: string; amount: string; to: Address }[],
    onProgress?: (completed: number, total: number, lastResult: SendResult) => void,
  ): Promise<SendResult[] | BatchSendResult> => {
    // Prepare transfer calls
    const calls = transfers.map(({ tokenSymbol, amount, to }) => {
      const token = findToken(tokenSymbol);
      if (!token) throw new Error(`Token not found: ${tokenSymbol}`);
      const parsedAmount = parseUnits(amount, token.decimals);

      return {
        to: token.address as Address,
        data: encodeFunctionData({
          abi: ERC20_ABI,
          functionName: "transfer",
          args: [to, parsedAmount],
        }),
      };
    });

    // Passkey: Use batch transaction (single TX with calls array)
    if (supportsBatchTx) {
      const hash = await sendTransactionAsync({
        // @ts-expect-error - Tempo-specific `calls` property for batch transactions
        calls,
      });

      const result: BatchSendResult = {
        hash,
        explorerUrl: explorerTxUrl(hash),
        transferCount: transfers.length,
        isBatch: true,
      };

      // Report completion
      onProgress?.(transfers.length, transfers.length, { hash, explorerUrl: explorerTxUrl(hash) });

      return result;
    }

    // MetaMask/Injected: Sequential transfers
    const results: SendResult[] = [];
    const publicClient = getPublicClient();

    for (let i = 0; i < calls.length; i++) {
      const call = calls[i];

      const hash = await sendTransactionAsync({
        to: call.to,
        data: call.data,
      });

      const result: SendResult = { hash, explorerUrl: explorerTxUrl(hash) };
      results.push(result);
      onProgress?.(results.length, transfers.length, result);

      // Privy embedded wallet providers can struggle with pending nonce tracking.
      // Waiting for receipt avoids "nonce too low" on back-to-back transactions.
      if (isPrivyEmbedded) {
        await publicClient.waitForTransactionReceipt({ hash });
      } else {
        // Small delay between TX submissions to avoid rate limits
        if (i < calls.length - 1) {
          await new Promise((r) => setTimeout(r, 300));
        }
      }
    }

    return results;
  }, [sendTransactionAsync, supportsBatchTx, isPrivyEmbedded]);

  return { sendPayment, sendParallel, sending: isPending, supportsBatchTx };
}

// ── Re-export trading hooks from split module ─────────────────
export {
  useTempoSwap,
  useTempoLimitOrder,
  useTempoScheduler,
  type SwapResult,
  type LimitOrderResult,
  type ScheduledPaymentResult,
  type RecurringPaymentResult,
} from "./use-tempo-trading";

export {
  useTempoDeployment,
  type DeployTokenResult,
  type CreatePairResult,
} from "./use-tempo-deployment";
