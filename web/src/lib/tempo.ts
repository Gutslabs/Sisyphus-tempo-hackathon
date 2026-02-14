import {
  createClient, createPublicClient, http, publicActions,
  type Address, type PublicClient,
} from "viem";
import { tempoModerato } from "viem/chains";
import { tempoActions, withFeePayer } from "viem/tempo";

// ── Re-export chain ──────────────────────────────────────────
export { tempoModerato };

export const TEMPO_EXPLORER = "https://explore.moderato.tempo.xyz";
export const TEMPO_FAUCET_URL = "https://docs.tempo.xyz/quickstart/faucet";
export const TEMPO_SPONSOR_URL = "https://sponsor.moderato.tempo.xyz";
export const TEMPO_RPC = "https://rpc.moderato.tempo.xyz";
export const TEMPO_CHAIN_ID = tempoModerato.id; // 42431

// ── Token Registry ────────────────────────────────────────────
export interface TempoToken {
  name: string;
  symbol: string;
  address: Address;
  decimals: number;
}

export const TEMPO_TOKENS: TempoToken[] = [
  {
    name: "pathUSD",
    symbol: "pathUSD",
    address: "0x20C0000000000000000000000000000000000000",
    decimals: 6,
  },
  {
    name: "AlphaUSD",
    symbol: "AlphaUSD",
    address: "0x20C0000000000000000000000000000000000001",
    decimals: 6,
  },
  {
    name: "BetaUSD",
    symbol: "BetaUSD",
    address: "0x20C0000000000000000000000000000000000002",
    decimals: 6,
  },
  {
    name: "ThetaUSD",
    symbol: "ThetaUSD",
    address: "0x20C0000000000000000000000000000000000003",
    decimals: 6,
  },
];

// Token icons URL
export function tokenIconUrl(address: Address): string {
  return `https://tokenlist.tempo.xyz/icon/${TEMPO_CHAIN_ID}/${address.toLowerCase()}`;
}

// Token list API
export const TOKEN_LIST_URL = `https://tokenlist.tempo.xyz/list/${TEMPO_CHAIN_ID}`;

type TokenCreatedArgs = {
  token: Address;
  name: string;
  symbol: string;
  admin: Address;
};

// ── ERC-20 ABI (minimal, for raw fallback) ───────────────────
export const ERC20_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    name: "symbol",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

// ── Tempo Public Client (read-only, with Tempo extensions) ───
// In the browser we use our API proxy to avoid CORS / ERR_EMPTY_RESPONSE from rpc.moderato.tempo.xyz
let _publicClient: ReturnType<typeof createTempoPublicClient> | null = null;

function getRpcUrl(): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/api/tempo/rpc`;
  }
  return process.env.TEMPO_RPC_URL ?? TEMPO_RPC;
}

function createTempoPublicClient() {
  const url = getRpcUrl();
  return createClient({
    chain: tempoModerato,
    transport: http(url),
  })
    .extend(publicActions)
    .extend(tempoActions());
}

// ── Stored Tokens (Local Storage Cache) ───────────────────────
export interface StoredToken {
  address: Address;
  name: string;
  symbol: string;
  decimals: number;
  deployer: Address;
}

const STORAGE_KEY = "tempo_deployed_tokens_v1";

export function getStoredTokens(deployer?: Address): StoredToken[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const all = JSON.parse(raw) as StoredToken[];
    if (deployer) {
      return all.filter(t => t.deployer.toLowerCase() === deployer.toLowerCase());
    }
    return all;
  } catch {
    return [];
  }
}

export function saveTokenToStorage(token: StoredToken) {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    let all = raw ? JSON.parse(raw) as StoredToken[] : [];
    // Remove duplicate if exists (by symbol and deployer)
    all = all.filter(t => !(t.symbol === token.symbol && t.deployer.toLowerCase() === token.deployer.toLowerCase()));
    all.push(token);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch (e) {
    // Ignore storage failures; app will still function without cached token.
  }
}

// ── Helpers ───────────────────────────────────────────────────

// Helper to scan for token by symbol deployed by user (or find in storage)
export async function scanForToken(symbol: string, deployer: Address): Promise<{ address: Address, decimals: number } | null> {
  // 1. Try Local Storage first
  const stored = getStoredTokens(deployer).find(t => t.symbol.toLowerCase() === symbol.toLowerCase());
  if (stored) {
    return { address: stored.address, decimals: stored.decimals };
  }

  // 2. Fallback to RPC Scan (limited to recent blocks)
  const publicClient = getPublicClient();
  try {
    const latestBlock = await publicClient.getBlockNumber();
    const fromBlock = (latestBlock - 10000n) > 0n ? (latestBlock - 10000n) : 0n;

    const logs = await publicClient.getLogs({
      address: TIP20_FACTORY_ADDRESS,
      event: {
        type: 'event',
        name: 'TokenCreated',
        inputs: [
          { type: 'address', name: 'token', indexed: true },
          { type: 'string', name: 'name', indexed: false },
          { type: 'string', name: 'symbol', indexed: false },
          { type: 'string', name: 'currency', indexed: false },
          { type: 'address', name: 'quoteToken', indexed: false },
          { type: 'address', name: 'admin', indexed: false },
          { type: 'bytes32', name: 'salt', indexed: false },
        ]
      },
      fromBlock: fromBlock, // optimization
      toBlock: 'latest'
    });

    // Filter by admin (deployer) and symbol
    const found = logs.find(log => {
      const args = log.args as unknown as TokenCreatedArgs;
      return args.admin.toLowerCase() === deployer.toLowerCase() &&
        args.symbol.toLowerCase() === symbol.toLowerCase();
    });

    if (found) {
      const args = found.args as unknown as TokenCreatedArgs;
      const tokenAddr = args.token;
      // Cache it for next time
      saveTokenToStorage({
        address: tokenAddr,
        name: args.name,
        symbol: args.symbol,
        decimals: 6, // TIP-20 default is 6
        deployer: deployer
      });
      return { address: tokenAddr, decimals: 6 };
    }
  } catch (e) {
    // Swallow RPC/log scan errors; caller will handle null result.
  }
  return null;
}

export function getPublicClient() {
  if (!_publicClient) {
    _publicClient = createTempoPublicClient();
  }
  return _publicClient;
}

// ── Helpers ───────────────────────────────────────────────────

export function parseTokenAmount(amount: string | number, decimals: number): bigint {
  const str = String(amount);
  const [whole, frac = ""] = str.split(".");
  const padded = frac.padEnd(decimals, "0").slice(0, decimals);
  return BigInt(whole + padded);
}

export function formatTokenAmount(raw: bigint, decimals: number): string {
  const str = raw.toString().padStart(decimals + 1, "0");
  const whole = str.slice(0, str.length - decimals) || "0";
  const frac = str.slice(str.length - decimals);
  const trimmed = frac.replace(/0+$/, "");
  return trimmed ? `${whole}.${trimmed}` : whole;
}

export function findToken(symbolOrAddress: string): TempoToken | undefined {
  const lower = symbolOrAddress.toLowerCase();
  return TEMPO_TOKENS.find(
    (t) => t.symbol.toLowerCase() === lower || t.address.toLowerCase() === lower,
  );
}

export function explorerTxUrl(hash: string): string {
  return `${TEMPO_EXPLORER}/tx/${hash}`;
}

export function explorerAddressUrl(address: string): string {
  return `${TEMPO_EXPLORER}/address/${address}`;
}

// ── Payment Scheduler (on-chain scheduled & recurring) ─────────
export const PAYMENT_SCHEDULER_ADDRESS: Address =
  "0x325EDdf3daB4cD51b2690253a11D3397850a7Bd2" as Address;

export const PAYMENT_SCHEDULER_ABI = [
  {
    name: "createScheduled",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address", internalType: "address" },
      { name: "recipient", type: "address", internalType: "address" },
      { name: "amount", type: "uint256", internalType: "uint256" },
      { name: "executeAt", type: "uint256", internalType: "uint256" },
    ],
    outputs: [{ name: "id", type: "uint256", internalType: "uint256" }],
  },
  {
    name: "createRecurring",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address", internalType: "address" },
      { name: "recipient", type: "address", internalType: "address" },
      { name: "amount", type: "uint256", internalType: "uint256" },
      { name: "intervalSeconds", type: "uint256", internalType: "uint256" },
      { name: "endTime", type: "uint256", internalType: "uint256" },
      { name: "firstDueTime", type: "uint256", internalType: "uint256" },
    ],
    outputs: [{ name: "id", type: "uint256", internalType: "uint256" }],
  },
  {
    name: "executeScheduled",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "id", type: "uint256", internalType: "uint256" }],
    outputs: [],
  },
  {
    name: "executeRecurring",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "id", type: "uint256", internalType: "uint256" }],
    outputs: [],
  },
  {
    name: "cancelScheduled",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "id", type: "uint256", internalType: "uint256" }],
    outputs: [],
  },
  {
    name: "cancelRecurring",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "id", type: "uint256", internalType: "uint256" }],
    outputs: [],
  },
  {
    name: "nextOneTimeId",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
  },
  {
    name: "nextRecurringId",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
  },
  {
    name: "oneTimeSchedules",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    outputs: [
      { name: "payer", type: "address", internalType: "address" },
      { name: "token", type: "address", internalType: "address" },
      { name: "recipient", type: "address", internalType: "address" },
      { name: "amount", type: "uint256", internalType: "uint256" },
      { name: "executeAt", type: "uint256", internalType: "uint256" },
      { name: "executed", type: "bool", internalType: "bool" },
      { name: "cancelled", type: "bool", internalType: "bool" },
    ],
  },
  {
    name: "recurringSchedules",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    outputs: [
      { name: "payer", type: "address", internalType: "address" },
      { name: "token", type: "address", internalType: "address" },
      { name: "recipient", type: "address", internalType: "address" },
      { name: "amount", type: "uint256", internalType: "uint256" },
      { name: "intervalSeconds", type: "uint256", internalType: "uint256" },
      { name: "nextDueTime", type: "uint256", internalType: "uint256" },
      { name: "endTime", type: "uint256", internalType: "uint256" },
      { name: "cancelled", type: "bool", internalType: "bool" },
    ],
  },
  {
    name: "OneTimeScheduled",
    type: "event",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "payer", type: "address", indexed: true },
      { name: "token", type: "address", indexed: false },
      { name: "recipient", type: "address", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
      { name: "executeAt", type: "uint256", indexed: false },
    ],
  },
  {
    name: "OneTimeExecuted",
    type: "event",
    inputs: [{ name: "id", type: "uint256", indexed: true }],
  },
  {
    name: "RecurringScheduled",
    type: "event",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "payer", type: "address", indexed: true },
      { name: "token", type: "address", indexed: false },
      { name: "recipient", type: "address", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
      { name: "intervalSeconds", type: "uint256", indexed: false },
      { name: "nextDueTime", type: "uint256", indexed: false },
      { name: "endTime", type: "uint256", indexed: false },
    ],
  },
  {
    name: "RecurringExecuted",
    type: "event",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "nextDueTime", type: "uint256", indexed: false },
    ],
  },
] as const;

// ── Tempo Stablecoin DEX (Exchange) ─────────────────────────────
// Singleton at 0xdec0...; swap & quote between USD stablecoins
export const TEMPO_EXCHANGE_ADDRESS: Address =
  "0xDEc0000000000000000000000000000000000000" as Address;

// ── TIP-20 Factory ──────────────────────────────────────────────
export const TIP20_FACTORY_ADDRESS: Address =
  "0x20Fc000000000000000000000000000000000000" as Address;

export const TIP20_FACTORY_ABI = [
  {
    name: "createToken",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "name", type: "string" },
      { name: "symbol", type: "string" },
      { name: "currency", type: "string" },
      { name: "quoteToken", type: "address" },
      { name: "admin", type: "address" },
      { name: "salt", type: "bytes32" },
    ],
    outputs: [{ name: "token", type: "address" }],
  },
  {
    name: "predictToken",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "name", type: "string" },
      { name: "symbol", type: "string" },
      { name: "currency", type: "string" },
      { name: "quoteToken", type: "address" },
      { name: "admin", type: "address" },
      { name: "salt", type: "bytes32" },
    ],
    outputs: [{ name: "token", type: "address" }],
  },
  {
    name: "TokenCreated",
    type: "event",
    inputs: [
      { name: "token", type: "address", indexed: true },
      { name: "name", type: "string", indexed: false },
      { name: "symbol", type: "string", indexed: false },
      { name: "currency", type: "string", indexed: false },
      { name: "quoteToken", type: "address", indexed: false },
      { name: "admin", type: "address", indexed: false },
      { name: "salt", type: "bytes32", indexed: false },
    ],
  },
] as const;

export const EXCHANGE_ABI = [
  {
    name: "quoteSwapExactAmountIn",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "tokenIn", type: "address" },
      { name: "tokenOut", type: "address" },
      { name: "amountIn", type: "uint128" },
    ],
    outputs: [{ name: "amountOut", type: "uint128" }],
  },
  {
    name: "swapExactAmountIn",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokenIn", type: "address" },
      { name: "tokenOut", type: "address" },
      { name: "amountIn", type: "uint128" },
      { name: "minAmountOut", type: "uint128" },
    ],
    outputs: [{ name: "amountOut", type: "uint128" }],
  },
  {
    name: "createPair",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "base", type: "address" }],
    outputs: [{ name: "key", type: "bytes32" }],
  },
  {
    name: "place",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint128" },
      { name: "isBid", type: "bool" },
      { name: "tick", type: "int16" },
    ],
    outputs: [{ name: "orderId", type: "uint128" }],
  },
  {
    name: "cancel",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "orderId", type: "uint128" }],
    outputs: [],
  },
  {
    name: "OrderPlaced",
    type: "event",
    inputs: [
      { name: "orderId", type: "uint128", indexed: true },
      { name: "maker", type: "address", indexed: true },
      { name: "token", type: "address", indexed: true },
      { name: "amount", type: "uint128", indexed: false },
      { name: "isBid", type: "bool", indexed: false },
      { name: "tick", type: "int16", indexed: false },
      { name: "flipTick", type: "int16", indexed: false },
    ],
  },
  {
    name: "PairCreated",
    type: "event",
    inputs: [
      { name: "key", type: "bytes32", indexed: true },
      { name: "base", type: "address", indexed: true },
      { name: "quote", type: "address", indexed: true },
    ],
  },
] as const;

/** Tick = (price - 1) * 100_000. TICK_SPACING is 10; ticks must be multiple of 10. Range ±2000 (±2%). */
export function priceToTick(price: number): number {
  const tick = Math.round((price - 1) * 100_000);
  const spacing = 10;
  const rounded = Math.round(tick / spacing) * spacing;
  return Math.max(-2000, Math.min(2000, rounded));
}
