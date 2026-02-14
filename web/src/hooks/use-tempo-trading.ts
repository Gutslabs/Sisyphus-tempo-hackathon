"use client";

import { useState, useCallback } from "react";
import { useAccount, useSendTransaction } from "wagmi";
import { type Address, encodeFunctionData, parseUnits, decodeEventLog } from "viem";
import {
    TEMPO_TOKENS, ERC20_ABI, EXCHANGE_ABI, TEMPO_EXCHANGE_ADDRESS,
    PAYMENT_SCHEDULER_ADDRESS, PAYMENT_SCHEDULER_ABI,
    findToken, scanForToken, explorerTxUrl, getPublicClient, priceToTick, getStoredTokens,
} from "@/lib/tempo";

// ── useTempoSwap ────────────────────────────────────────────────
// Swap stablecoins on Tempo DEX (0xdec0...)

export interface SwapResult {
    hash: string;
    explorerUrl: string;
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    amountOut: string;
}

export function useTempoSwap() {
    const { address } = useAccount();
    const { sendTransactionAsync, isPending } = useSendTransaction();

    /**
     * Get expected output amount for a swap (view call, no TX)
     */
    const getQuote = useCallback(async (
        tokenInSymbol: string,
        tokenOutSymbol: string,
        amountIn: string,
    ): Promise<bigint> => {
        let tokenIn = findToken(tokenInSymbol);
        let tokenOut = findToken(tokenOutSymbol);

        // Fallback scan if address is available (for view calls, we might not have address easily if not passed, 
        // but this is inside a hook with useAccount. However, getQuote is a callback. 
        // If wallet not connected, we can't scan effectively for "my deployed tokens", 
        // but we can't do much else. For now, strict on findToken if no address, or strict on findToken for view?)
        // Actually, getQuote is usually called when wallet IS connected in this app context.
        // But scanForToken requires an owner/deployer address to filter logs efficiently.
        // If we don't have it, we might skip.

        // Check if we can find them via scan if symbol is given
        if (!tokenIn && address) {
            const found = await scanForToken(tokenInSymbol, address);
            if (found) tokenIn = { name: tokenInSymbol, symbol: tokenInSymbol, address: found.address, decimals: found.decimals };
        }
        if (!tokenOut && address) {
            const found = await scanForToken(tokenOutSymbol, address);
            if (found) tokenOut = { name: tokenOutSymbol, symbol: tokenOutSymbol, address: found.address, decimals: found.decimals };
        }

        // If user passed a raw contract address for a tracked token, resolve from local storage
        if (!tokenOut && tokenOutSymbol.startsWith("0x")) {
            const all = getStoredTokens();
            const match = all.find((t) => t.address.toLowerCase() === tokenOutSymbol.toLowerCase());
            if (match) {
                tokenOut = {
                    name: match.name,
                    symbol: match.symbol,
                    address: match.address,
                    decimals: match.decimals,
                };
            } else {
                // Fallback: assume TIP-20 with 6 decimals
                tokenOut = {
                    name: tokenOutSymbol,
                    symbol: tokenOutSymbol,
                    address: tokenOutSymbol as Address,
                    decimals: 6,
                };
            }
        }

        if (!tokenIn) throw new Error(`Token not found: ${tokenInSymbol}`);
        if (!tokenOut) throw new Error(`Token not found: ${tokenOutSymbol}`);

        const amountInRaw = parseUnits(amountIn, tokenIn.decimals);
        // Contract uses uint128; ensure we don't exceed (viem will encode)
        const amountIn128 = amountInRaw > BigInt("0xffffffffffffffffffffffffffffffff") ? BigInt("0xffffffffffffffffffffffffffffffff") : amountInRaw;

        const publicClient = getPublicClient();
        const amountOut = await publicClient.readContract({
            address: TEMPO_EXCHANGE_ADDRESS,
            abi: EXCHANGE_ABI,
            functionName: "quoteSwapExactAmountIn",
            args: [tokenIn.address, tokenOut.address, amountIn128],
        });
        return amountOut;
    }, []);

    /**
     * Execute swap: sell amountIn of tokenIn for at least minAmountOut of tokenOut.
     * If the DEX has no allowance for tokenIn, approves the exchange first (TIP-20 / ERC-20).
     * If slippageBps not provided, uses 0.5% (50 bps).
     */
    const swap = useCallback(async (
        tokenInSymbol: string,
        tokenOutSymbol: string,
        amountIn: string,
        slippageBps: number = 50,
    ): Promise<SwapResult> => {
        if (!address) throw new Error("Wallet not connected");

        let tokenIn = findToken(tokenInSymbol);
        let tokenOut = findToken(tokenOutSymbol);

        if (!tokenIn) {
            const found = await scanForToken(tokenInSymbol, address);
            if (found) tokenIn = { name: tokenInSymbol, symbol: tokenInSymbol, address: found.address, decimals: found.decimals };
        }
        if (!tokenOut) {
            const found = await scanForToken(tokenOutSymbol, address);
            if (found) tokenOut = { name: tokenOutSymbol, symbol: tokenOutSymbol, address: found.address, decimals: found.decimals };
        }

        // Allow passing contract address for dynamic tokens as tokenOutSymbol
        if (!tokenOut && tokenOutSymbol.startsWith("0x")) {
            const all = getStoredTokens();
            const match = all.find((t) => t.address.toLowerCase() === tokenOutSymbol.toLowerCase());
            if (match) {
                tokenOut = {
                    name: match.name,
                    symbol: match.symbol,
                    address: match.address,
                    decimals: match.decimals,
                };
            } else {
                tokenOut = {
                    name: tokenOutSymbol,
                    symbol: tokenOutSymbol,
                    address: tokenOutSymbol as Address,
                    decimals: 6,
                };
            }
        }

        if (!tokenIn) throw new Error(`Token not found: ${tokenInSymbol}`);
        if (!tokenOut) throw new Error(`Token not found: ${tokenOutSymbol}`);

        const amountInRaw = parseUnits(amountIn, tokenIn.decimals);
        const amountIn128 = amountInRaw > BigInt("0xffffffffffffffffffffffffffffffff") ? BigInt("0xffffffffffffffffffffffffffffffff") : amountInRaw;

        const publicClient = getPublicClient();
        const currentAllowance = await publicClient.readContract({
            address: tokenIn.address,
            abi: ERC20_ABI,
            functionName: "allowance",
            args: [address, TEMPO_EXCHANGE_ADDRESS],
        });

        if (currentAllowance < amountIn128) {
            await sendTransactionAsync({
                to: tokenIn.address,
                data: encodeFunctionData({
                    abi: ERC20_ABI,
                    functionName: "approve",
                    args: [TEMPO_EXCHANGE_ADDRESS, amountIn128],
                }),
            });
        }

        const amountOutExpected = await getQuote(tokenInSymbol, tokenOutSymbol, amountIn);
        const minAmountOut = (amountOutExpected * BigInt(10000 - slippageBps)) / BigInt(10000);

        const hash = await sendTransactionAsync({
            to: TEMPO_EXCHANGE_ADDRESS,
            data: encodeFunctionData({
                abi: EXCHANGE_ABI,
                functionName: "swapExactAmountIn",
                args: [tokenIn.address, tokenOut.address, amountIn128, minAmountOut],
            }),
        });

        const amountOutFormatted = (Number(amountOutExpected) / 10 ** tokenOut.decimals).toFixed(tokenOut.decimals);

        return {
            hash,
            explorerUrl: explorerTxUrl(hash),
            tokenIn: tokenInSymbol,
            tokenOut: tokenOutSymbol,
            amountIn,
            amountOut: amountOutFormatted,
        };
    }, [address, getQuote, sendTransactionAsync]);

    return { swap, getQuote, swapping: isPending };
}

// ── useTempoLimitOrder ─────────────────────────────────────────
// Place / cancel limit orders on Tempo DEX. pathUSD is used as quote token for all pairs.

export interface LimitOrderResult {
    orderId: string;
    hash: string;
    explorerUrl: string;
    token: string;
    amount: string;
    side: "buy" | "sell";
    price: number;
}

const PATH_USD = TEMPO_TOKENS[0]!; // pathUSD, quote token for DEX pairs

export function useTempoLimitOrder() {
    const { address } = useAccount();
    const { sendTransactionAsync, isPending } = useSendTransaction();

    const ensureAllowance = useCallback(
        async (tokenAddress: Address, spender: Address, amountRaw: bigint) => {
            if (!address) return;
            const publicClient = getPublicClient();
            const current = await publicClient.readContract({
                address: tokenAddress,
                abi: ERC20_ABI,
                functionName: "allowance",
                args: [address, spender],
            });
            if (current < amountRaw) {
                const hash = await sendTransactionAsync({
                    to: tokenAddress,
                    data: encodeFunctionData({
                        abi: ERC20_ABI,
                        functionName: "approve",
                        args: [spender, amountRaw],
                    }),
                });
                await publicClient.waitForTransactionReceipt({ hash });
            }
        },
        [address, sendTransactionAsync],
    );

    /**
     * Place a limit order. price is in quote per token (e.g. 0.999 = buy below peg, 1.001 = sell above peg).
     * isBid true = buy token with quote (pathUSD), false = sell token for quote.
     */
    const placeLimitOrder = useCallback(
        async (
            tokenSymbol: string,
            amount: string,
            isBid: boolean,
            price: number,
        ): Promise<LimitOrderResult> => {
            if (!address) throw new Error("Wallet not connected");

            let token = findToken(tokenSymbol);
            if (!token) {
                const found = await scanForToken(tokenSymbol, address);
                if (found) token = { name: tokenSymbol, symbol: tokenSymbol, address: found.address, decimals: found.decimals };
            }
            if (!token) throw new Error(`Token not found: ${tokenSymbol}`);

            const amountRaw = parseUnits(amount, token.decimals);
            const amount128 = amountRaw > BigInt("0xffffffffffffffffffffffffffffffff") ? BigInt("0xffffffffffffffffffffffffffffffff") : amountRaw;
            const tick = priceToTick(price);

            const maxAllowance = 2n ** 256n - 1n;
            if (isBid) {
                // DEX pulls quote (pathUSD) from user.
                await ensureAllowance(PATH_USD.address, TEMPO_EXCHANGE_ADDRESS, maxAllowance);
            } else {
                // DEX pulls base token from user (ask = sell token for quote).
                await ensureAllowance(token.address, TEMPO_EXCHANGE_ADDRESS, maxAllowance);
            }

            const hash = await sendTransactionAsync({
                to: TEMPO_EXCHANGE_ADDRESS,
                data: encodeFunctionData({
                    abi: EXCHANGE_ABI,
                    functionName: "place",
                    args: [token.address, amount128, isBid, tick],
                }),
            });

            const publicClient = getPublicClient();
            const receipt = await publicClient.waitForTransactionReceipt({ hash });
            let orderId = "";

            // First try: decode from receipt logs directly
            for (const log of receipt.logs) {
                try {
                    const decoded = decodeEventLog({
                        abi: EXCHANGE_ABI,
                        data: log.data,
                        topics: log.topics,
                    });
                    if (decoded.eventName === "OrderPlaced" && decoded.args?.orderId != null) {
                        orderId = String(decoded.args.orderId);
                        break;
                    }
                } catch {
                    // not our event
                }
            }

            // Fallback (more robust): extract the first indexed topic from a log emitted by the exchange.
            // Many indexers encode the first indexed parameter as topics[1]. For OrderPlaced, that's orderId.
            if (!orderId) {
                const exchangeLog = receipt.logs.find(
                    (l) => String(l.address).toLowerCase() === TEMPO_EXCHANGE_ADDRESS.toLowerCase() && Array.isArray(l.topics) && l.topics.length >= 2,
                );
                const topic1 = exchangeLog?.topics?.[1];
                if (typeof topic1 === "string" && topic1.startsWith("0x")) {
                    try {
                        orderId = BigInt(topic1).toString();
                    } catch {
                        // ignore
                    }
                }
            }

            // Fallback: query OrderPlaced logs for this block and maker/token
            if (!orderId) {
                try {
                    const logs = await publicClient.getLogs({
                        address: TEMPO_EXCHANGE_ADDRESS,
                        event: {
                            type: "event",
                            name: "OrderPlaced",
                            inputs: [
                                { name: "orderId", type: "uint128", indexed: true },
                                { name: "maker", type: "address", indexed: true },
                                { name: "token", type: "address", indexed: true },
                                { name: "amount", type: "uint128", indexed: false },
                                { name: "isBid", type: "bool", indexed: false },
                                { name: "tick", type: "int16", indexed: false },
                                { name: "flipTick", type: "int16", indexed: false },
                            ],
                        } as const,
                        fromBlock: receipt.blockNumber,
                        toBlock: receipt.blockNumber,
                    });

                    const match = logs.find(
                        (log) =>
                            String(log.args?.maker).toLowerCase() === address.toLowerCase() &&
                            String(log.args?.token).toLowerCase() === token.address.toLowerCase(),
                    );
                    if (match && match.args?.orderId != null) {
                        orderId = String(match.args.orderId);
                    }
          } catch (e) {
            // Best-effort; if we can't read logs, we still return DB order.
          }
            }

            // Persist order to DB even if orderId could not be decoded yet.
            // Backend can still infer it later from tx_hash if needed.
            if (address) {
                try {
                    await fetch("/api/tempo/orders", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            wallet_address: address,
                            on_chain_order_id: orderId || null,
                            token: tokenSymbol,
                            amount,
                            is_bid: isBid,
                            price,
                            tick,
                            tx_hash: hash,
                        }),
                    });
          } catch (e) {
            // Ignore DB persistence errors; on-chain order is already placed.
          }
            }

            return {
                orderId,
                hash,
                explorerUrl: explorerTxUrl(hash),
                token: tokenSymbol,
                amount,
                side: isBid ? "buy" : "sell",
                price,
            };
        },
        [address, ensureAllowance, sendTransactionAsync],
    );

    const cancelOrder = useCallback(
        async (orderId: string): Promise<{ hash: string; explorerUrl: string }> => {
            const id = BigInt(orderId);
            const hash = await sendTransactionAsync({
                to: TEMPO_EXCHANGE_ADDRESS,
                data: encodeFunctionData({
                    abi: EXCHANGE_ABI,
                    functionName: "cancel",
                    args: [id],
                }),
            });
            return { hash, explorerUrl: explorerTxUrl(hash) };
        },
        [sendTransactionAsync],
    );

    const provideLiquidity = useCallback(
        async (tokenSymbol: string, amountToken: string, amountQuote: string): Promise<{ hash: string, explorerUrl: string }[]> => {
            // Place bid (buy token for quote) at 0.999
            const bidResult = await placeLimitOrder(tokenSymbol, amountToken, true, 0.999);
            // Place ask (sell token for quote) at 1.001
            const askResult = await placeLimitOrder(tokenSymbol, amountToken, false, 1.001);

            return [
                { hash: bidResult.hash, explorerUrl: bidResult.explorerUrl },
                { hash: askResult.hash, explorerUrl: askResult.explorerUrl }
            ];
        },
        [placeLimitOrder]
    );

    return { placeLimitOrder, cancelOrder, provideLiquidity, placing: isPending };
}

// ── useTempoScheduler ─────────────────────────────────────────
// On-chain scheduled (one-time) and recurring payments via PaymentScheduler contract.

export interface ScheduledPaymentResult {
    scheduleId: string;
    token: string;
    amount: string;
    to: string;
    executeAt: number;
    hash: string;
    explorerUrl: string;
}

export interface RecurringPaymentResult {
    scheduleId: string;
    token: string;
    amount: string;
    to: string;
    intervalSeconds: number;
    endTime: number;
    hash: string;
    explorerUrl: string;
}

export function useTempoScheduler() {
    const { address } = useAccount();
    const { sendTransactionAsync, isPending } = useSendTransaction();
    const maxAllowance = 2n ** 256n - 1n;

    const ensureAllowance = useCallback(
        async (tokenAddress: Address, amountRaw: bigint) => {
            if (!address) return;
            const publicClient = getPublicClient();
            const current = await publicClient.readContract({
                address: tokenAddress,
                abi: ERC20_ABI,
                functionName: "allowance",
                args: [address, PAYMENT_SCHEDULER_ADDRESS],
            });
            if (current < amountRaw) {
                const hash = await sendTransactionAsync({
                    to: tokenAddress,
                    data: encodeFunctionData({
                        abi: ERC20_ABI,
                        functionName: "approve",
                        args: [PAYMENT_SCHEDULER_ADDRESS, maxAllowance],
                    }),
                });
                await publicClient.waitForTransactionReceipt({ hash });
            }
        },
        [address, sendTransactionAsync],
    );

    /**
     * Create one-time scheduled payments. Tokens are escrowed; anyone can execute after executeAt.
     * executeAt: ISO date string (e.g. "2026-03-15T00:00:00Z") or Unix timestamp in seconds.
     * ISO strings without "Z" or timezone are treated as UTC (model outputs UTC per prompt).
     */
    const schedulePayments = useCallback(
        async (
            transfers: { token: string; amount: string; to: Address }[],
            executeAt: string,
        ): Promise<ScheduledPaymentResult[]> => {
            if (!address) throw new Error("Wallet not connected");

            let executeAtSeconds: number;
            if (executeAt.includes("T")) {
                const iso = executeAt.trim();
                const hasTimezone = /[Zz]$|[-+]\d{2}:?\d{2}$/.test(iso);
                const toParse = hasTimezone ? iso : `${iso.replace(/\.\d{3}$/, "")}Z`;
                executeAtSeconds = Math.floor(new Date(toParse).getTime() / 1000);
            } else {
                executeAtSeconds = parseInt(executeAt, 10);
            }
            const nowSeconds = Math.floor(Date.now() / 1000);
            if (executeAtSeconds <= nowSeconds) {
                throw new Error("executeAt must be in the future");
            }

            const results: ScheduledPaymentResult[] = [];

            for (const t of transfers) {
                let token = findToken(t.token);
                if (!token) {
                    const found = await scanForToken(t.token, address);
                    if (found) token = { name: t.token, symbol: t.token, address: found.address, decimals: found.decimals };
                }
                if (!token) throw new Error(`Token not found: ${t.token}`);
                const amountRaw = parseUnits(t.amount, token.decimals);

                await ensureAllowance(token.address, amountRaw);

                const hash = await sendTransactionAsync({
                    to: PAYMENT_SCHEDULER_ADDRESS,
                    data: encodeFunctionData({
                        abi: PAYMENT_SCHEDULER_ABI,
                        functionName: "createScheduled",
                        args: [token.address, t.to, amountRaw, BigInt(executeAtSeconds)],
                    }),
                });

                results.push({
                    scheduleId: "", // optional: could read from event
                    token: t.token,
                    amount: t.amount,
                    to: t.to,
                    executeAt: executeAtSeconds,
                    hash,
                    explorerUrl: explorerTxUrl(hash),
                });
            }

            return results;
        },
        [address, ensureAllowance, sendTransactionAsync],
    );

    /**
     * Create recurring payment. Each run pulls from payer (no escrow). firstDueTime 0 = due now.
     * endTime 0 = no end. intervalSeconds e.g. 7 * 24 * 3600 for weekly.
     */
    const createRecurringPayment = useCallback(
        async (
            tokenSymbol: string,
            amount: string,
            to: Address,
            intervalSeconds: number,
            endTime: number = 0,
            firstDueTime: number = 0,
        ): Promise<RecurringPaymentResult> => {
            if (!address) throw new Error("Wallet not connected");

            let token = findToken(tokenSymbol);
            if (!token) {
                const found = await scanForToken(tokenSymbol, address);
                if (found) token = { name: tokenSymbol, symbol: tokenSymbol, address: found.address, decimals: found.decimals };
            }
            if (!token) throw new Error(`Token not found: ${tokenSymbol}`);
            const amountRaw = parseUnits(amount, token.decimals);

            await ensureAllowance(token.address, amountRaw);

            // Coerce to integers so BigInt() never receives NaN
            const intervalSec = Number.isFinite(intervalSeconds) && !Number.isNaN(intervalSeconds) ? Math.floor(Number(intervalSeconds)) : 0;
            const end = Number.isFinite(endTime) && !Number.isNaN(endTime) ? Math.floor(Number(endTime)) : 0;
            const firstDue = Number.isFinite(firstDueTime) && !Number.isNaN(firstDueTime) ? Math.floor(Number(firstDueTime)) : 0;
            if (intervalSec <= 0) throw new Error("intervalSeconds must be a positive number (e.g. 2592000 for 30 days)");

            const hash = await sendTransactionAsync({
                to: PAYMENT_SCHEDULER_ADDRESS,
                data: encodeFunctionData({
                    abi: PAYMENT_SCHEDULER_ABI,
                    functionName: "createRecurring",
                    args: [
                        token.address,
                        to,
                        amountRaw,
                        BigInt(intervalSec),
                        BigInt(end),
                        BigInt(firstDue),
                    ],
                }),
            });

            return {
                scheduleId: "",
                token: tokenSymbol,
                amount,
                to,
                intervalSeconds,
                endTime,
                hash,
                explorerUrl: explorerTxUrl(hash),
            };
        },
        [address, ensureAllowance, sendTransactionAsync],
    );

    /**
     * Execute a one-time scheduled payment. Callable by anyone once executeAt has passed.
     */
    const executeScheduled = useCallback(
        async (scheduleId: number): Promise<{ hash: string; explorerUrl: string }> => {
            const hash = await sendTransactionAsync({
                to: PAYMENT_SCHEDULER_ADDRESS,
                data: encodeFunctionData({
                    abi: PAYMENT_SCHEDULER_ABI,
                    functionName: "executeScheduled",
                    args: [BigInt(scheduleId)],
                }),
            });
            return { hash, explorerUrl: explorerTxUrl(hash) };
        },
        [sendTransactionAsync],
    );

    return {
        schedulePayments,
        createRecurringPayment,
        executeScheduled,
        scheduling: isPending,
    };
}
