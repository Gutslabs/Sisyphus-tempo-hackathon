"use client";

import { useCallback } from "react";
import { useAccount, useSendTransaction } from "wagmi";
import { type Address, encodeFunctionData, decodeEventLog, keccak256, toBytes } from "viem";
import {
    TIP20_FACTORY_ADDRESS,
    TIP20_FACTORY_ABI,
    TEMPO_EXCHANGE_ADDRESS,
    EXCHANGE_ABI,
    explorerTxUrl,
    getPublicClient,
    findToken,
    scanForToken,
    saveTokenToStorage,
} from "@/lib/tempo";
import { usePrivyNonce } from "./use-privy-nonce";

export interface DeployTokenResult {
    tokenAddress: Address;
    name: string;
    symbol: string;
    hash: string;
    explorerUrl: string;
}

export interface CreatePairResult {
    pairKey: string;
    baseTokenSymbol: string;
    quoteToken: Address;
    hash: string;
    explorerUrl: string;
}



export function useTempoDeployment() {
    const { address } = useAccount();
    const { sendTransactionAsync, isPending } = useSendTransaction();
    const { getNextNonce } = usePrivyNonce();

    // Deploy a new TIP-20 Token
    const deployToken = useCallback(
        async (
            name: string,
            symbol: string,
            currency: string = "USD"
        ): Promise<DeployTokenResult> => {
            if (!address) throw new Error("Wallet not connected");

            // Random salt for uniqueness 
            const salt = crypto.getRandomValues(new Uint8Array(32));
            const saltHex = "0x" + Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('') as `0x${string}`;

            const PATH_USD = "0x20c0000000000000000000000000000000000000" as Address;

            const hash = await sendTransactionAsync({
                to: TIP20_FACTORY_ADDRESS,
                data: encodeFunctionData({
                    abi: TIP20_FACTORY_ABI,
                    functionName: "createToken",
                    args: [name, symbol, currency, PATH_USD, address, saltHex],
                }),
                nonce: await getNextNonce(),
            });

            const publicClient = getPublicClient();
            const receipt = await publicClient.waitForTransactionReceipt({ hash });

            let tokenAddress: Address | null = null;

            for (const log of receipt.logs) {
                try {
                    const decoded = decodeEventLog({
                        abi: TIP20_FACTORY_ABI,
                        data: log.data,
                        topics: log.topics,
                    });
                    if (decoded.eventName === "TokenCreated") {
                        tokenAddress = decoded.args.token;
                        break;
                    }
                } catch { }
            }

            if (!tokenAddress) throw new Error("Token deployed but address not found in logs.");

            // Save to local storage for future lookups
            saveTokenToStorage({
                address: tokenAddress,
                name,
                symbol,
                decimals: 6, // TIP-20 default
                deployer: address
            });

            return {
                tokenAddress,
                name,
                symbol,
                hash,
                explorerUrl: explorerTxUrl(hash),
            };
        },
        [address, sendTransactionAsync, getNextNonce]
    );

    // Mint tokens
    const mintToken = useCallback(
        async (tokenSymbol: string, amount: string, recipient: Address): Promise<{ hash: string, explorerUrl: string }> => {
            if (!address) throw new Error("Wallet not connected");

            let token = findToken(tokenSymbol);
            if (!token) {
                const scanned = await scanForToken(tokenSymbol, address);
                if (scanned) {
                    token = { name: tokenSymbol, symbol: tokenSymbol, address: scanned.address, decimals: scanned.decimals };
                }
            }
            if (!token) throw new Error(`Token "${tokenSymbol}" not found.`);

            // We assume 6 decimals for deployed tokens unless found in static list (TIP-20 default is 6)
            const decimals = token.decimals || 6;
            const parsedAmount = BigInt(parseFloat(amount) * (10 ** decimals));

            // Call mint on the token contract
            // ABI for mint(address,uint256) and grantRole(bytes32,address) and hasRole(bytes32,address)
            const mintAbi = [
                {
                    name: "mint",
                    type: "function",
                    stateMutability: "nonpayable",
                    inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }],
                    outputs: []
                },
                {
                    name: "grantRole",
                    type: "function",
                    stateMutability: "nonpayable",
                    inputs: [{ name: "role", type: "bytes32" }, { name: "account", type: "address" }],
                    outputs: []
                },
                {
                    name: "hasRole",
                    type: "function",
                    stateMutability: "view",
                    inputs: [{ name: "role", type: "bytes32" }, { name: "account", type: "address" }],
                    outputs: [{ name: "", type: "bool" }]
                }
            ] as const;

            const publicClient = getPublicClient();
            const ISSUER_ROLE = keccak256(toBytes("ISSUER_ROLE"));

            // Check if user has ISSUER_ROLE
            let hasRole = false;
            try {
                hasRole = await publicClient.readContract({
                    address: token.address,
                    abi: mintAbi,
                    functionName: "hasRole",
                    args: [ISSUER_ROLE, address]
                });
            } catch (e) {
                hasRole = false; // Force grant attempt even if node check fails
            }

            if (!hasRole) {
                try {
                    // Grant role first
                    const grantHash = await sendTransactionAsync({
                        to: token.address,
                        data: encodeFunctionData({
                            abi: mintAbi,
                            functionName: "grantRole",
                            args: [ISSUER_ROLE, address]
                        }),
                        nonce: await getNextNonce(),
                    });
                    await publicClient.waitForTransactionReceipt({ hash: grantHash });
                } catch (e) {
                    // If granting fails we still attempt mint; contract will revert if unauthorized.
                }
            }

            const hash = await sendTransactionAsync({
                to: token.address,
                data: encodeFunctionData({
                    abi: mintAbi,
                    functionName: "mint",
                    args: [recipient, parsedAmount]
                }),
                nonce: await getNextNonce(),
            });

            return { hash, explorerUrl: explorerTxUrl(hash) };
        },
        [address, sendTransactionAsync, getNextNonce]
    );

    // Create Trading Pair
    const createPair = useCallback(
        async (baseTokenInput: string): Promise<CreatePairResult> => {
            if (!address) throw new Error("Wallet not connected");

            let token = findToken(baseTokenInput);
            let baseAddress: Address | null = null;

            if (token) {
                baseAddress = token.address;
            } else if (baseTokenInput.startsWith("0x")) {
                baseAddress = baseTokenInput as Address;
            } else {
                // Scan logs if not found in static list
                const scanned = await scanForToken(baseTokenInput, address);
                if (scanned) {
                    baseAddress = scanned.address;
                    token = {
                        name: baseTokenInput,
                        symbol: baseTokenInput,
                        address: scanned.address,
                        decimals: scanned.decimals
                    };
                }
            }

            if (!baseAddress) throw new Error(`Token "${baseTokenInput}" not found in your deployed tokens or static list.`);

            const hash = await sendTransactionAsync({
                to: TEMPO_EXCHANGE_ADDRESS,
                data: encodeFunctionData({
                    abi: EXCHANGE_ABI,
                    functionName: "createPair",
                    args: [baseAddress]
                }),
                nonce: await getNextNonce(),
            });

            const publicClient = getPublicClient();
            const receipt = await publicClient.waitForTransactionReceipt({ hash });

            let pairKey = "";
            let quoteToken: Address = "0x0000000000000000000000000000000000000000";

            for (const log of receipt.logs) {
                try {
                    const decoded = decodeEventLog({
                        abi: EXCHANGE_ABI,
                        data: log.data,
                        topics: log.topics,
                    });
                    if (decoded.eventName === "PairCreated") {
                        pairKey = decoded.args.key;
                        quoteToken = decoded.args.quote;
                        break;
                    }
                } catch { }
            }

            if (!pairKey) throw new Error("Pair created but key not found in logs.");

            return {
                pairKey,
                baseTokenSymbol: token?.symbol ?? baseTokenInput,
                quoteToken,
                hash,
                explorerUrl: explorerTxUrl(hash)
            };
        },
        [address, sendTransactionAsync, getNextNonce]
    );

    return { deployToken, mintToken, createPair, isDeploying: isPending };
}
