"use client";

import type { ReactNode } from "react";
import {
  Box,
  Typography,
  Paper,
  Avatar,
  Stack,
  Chip,
  Button,
} from "@mui/material";
import {
  SmartToy as BotIcon,
  Person as UserIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as XCircleIcon,
  Error as AlertCircleIcon,
  OpenInNew as ExternalLinkIcon,
  WaterDrop as DropletsIcon,
  NorthEast as ArrowUpRightIcon,
} from "@mui/icons-material";
import type {
  TokenBalance, SendResult, BatchSendResult, SwapResult, LimitOrderResult,
  DeployTokenResult, CreatePairResult
} from "@/hooks/use-tempo";
import { type ChatMessage as ChatMessageType } from "@/hooks/use-chat-history";
import type { Address } from "viem";
import { ERC20_ABI, getPublicClient, saveTokenToStorage } from "@/lib/tempo";

// ── Types ─────────────────────────────────────────────────────

export interface ActionContext {
  balances: TokenBalance[];
  sendPayment: (token: string, amount: string, to: Address) => Promise<SendResult>;
  sendParallel: (transfers: { tokenSymbol: string; amount: string; to: Address }[]) => Promise<SendResult[] | BatchSendResult>;
  swap: (tokenIn: string, tokenOut: string, amountIn: string, slippageBps?: number) => Promise<SwapResult>;
  placeLimitOrder: (token: string, amount: string, isBid: boolean, price: number) => Promise<LimitOrderResult>;
  cancelOrder: (orderId: string) => Promise<{ hash: string; explorerUrl: string }>;
  schedulePayments: (transfers: { token: string; amount: string; to: Address }[], executeAt: string) => Promise<unknown[]>;
  createRecurringPayment: (token: string, amount: string, to: Address, intervalSeconds: number, endTime?: number, firstDueTime?: number) => Promise<unknown>;
  /** Refresh balances and return the latest list if available. */
  refreshBalances: () => Promise<TokenBalance[] | null>;
  requestFunds: () => Promise<unknown>;
  deployToken: (name: string, symbol: string) => Promise<DeployTokenResult>;
  mintToken: (tokenSymbol: string, amount: string, recipient: Address) => Promise<{ hash: string; explorerUrl: string }>;
  createPair: (baseToken: string) => Promise<CreatePairResult>;
  provideLiquidity: (tokenSymbol: string, amountToken: string, amountQuote: string) => Promise<{ hash: string; explorerUrl: string }[]>;
  walletAddress?: string;
  setStatus?: (text: string | null) => void;
}

// ── ChatMessage Component ─────────────────────────────────────

export function ChatMessage({ message }: { message: ChatMessageType }) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  return (
    <Box sx={{ display: "flex", gap: { xs: 1.5, sm: 2 }, flexDirection: isUser ? "row-reverse" : "row", alignItems: "flex-start" }}>
      <Avatar
        sx={(theme) => ({
          bgcolor: (() => {
            const isDark = theme.palette.mode === "dark";
            if (isUser) return theme.palette.primary.main;
            if (isSystem) return isDark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.08)";
            return theme.palette.primary.main;
          })(),
          color: isSystem ? "text.primary" : undefined,
          width: { xs: 28, sm: 32 },
          height: { xs: 28, sm: 32 },
        })}
      >
        {isUser ? <UserIcon sx={{ fontSize: 18 }} /> : isSystem ? <AlertCircleIcon sx={{ fontSize: 18 }} /> : <BotIcon sx={{ fontSize: 18 }} />}
      </Avatar>
      <Box
        sx={{
          maxWidth: { xs: "100%", sm: "86%", md: "80%" },
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: isUser ? "flex-end" : "flex-start",
          gap: 1,
        }}
      >
        <Paper
          elevation={0}
          sx={(theme) => {
            const isDark = theme.palette.mode === "dark";
            const userBg = isDark ? "#303134" : "#f1f3f4";
            const aiBg = isDark ? "#202124" : "#f8f9fa";
            const systemBg = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.03)";
            return {
              p: { xs: 1.5, sm: 2 },
              borderRadius: 3,
              bgcolor: isUser ? userBg : isSystem ? systemBg : aiBg,
              color: theme.palette.text.primary,
              whiteSpace: "pre-line",
              overflowWrap: "anywhere",
              fontSize: { xs: "0.88rem", sm: "0.9rem" },
              lineHeight: 1.5,
            };
          }}
        >
          {message.content}
        </Paper>

        {message.action && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
            <Chip
              label={String(message.action.action)}
              size="small"
              sx={{ height: 18, fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase" }}
            />
            {message.actionResult && (
              message.actionResult.success ? (
                <Typography variant="caption" color="success.main" sx={{ display: "flex", alignItems: "center", gap: 0.5, fontWeight: 600 }}>
                  <CheckCircleIcon sx={{ fontSize: 12 }} /> Success
                </Typography>
              ) : (
                <Typography variant="caption" color="error.main" sx={{ display: "flex", alignItems: "center", gap: 0.5, fontWeight: 600 }}>
                  <XCircleIcon sx={{ fontSize: 12 }} /> {message.actionResult.error}
                </Typography>
              )
            )}
          </Box>
        )}

        {message.actionResult?.data != null && (
          <Box sx={{ mt: 1 }}>
            {renderActionData(message.action, message.actionResult.data)}
          </Box>
        )}
      </Box>
    </Box>
  );
}

// ── renderActionData ──────────────────────────────────────────

function renderActionData(action: Record<string, unknown> | null | undefined, data: unknown): ReactNode {
  if (data == null) return null;

  const d = data as Record<string, unknown>;

  // Batch transaction result
  if (d.isBatch && d.hash && d.explorerUrl) {
    const result = data as BatchSendResult;
    return (
      <Button
        variant="outlined"
        size="small"
        href={result.explorerUrl}
        target="_blank"
        rel="noopener noreferrer"
        startIcon={<ArrowUpRightIcon />}
        endIcon={<ExternalLinkIcon sx={{ fontSize: 12 }} />}
        sx={{ borderRadius: 2, textTransform: "none", fontSize: "0.7rem" }}
      >
        Batch TX ({result.transferCount}): {result.hash.slice(0, 10)}...{result.hash.slice(-8)}
      </Button>
    );
  }

  // Single transaction hash
  if (d.hash && d.explorerUrl && !d.isBatch) {
    const result = data as SendResult;
    return (
      <Button
        variant="outlined"
        size="small"
        href={result.explorerUrl}
        target="_blank"
        rel="noopener noreferrer"
        startIcon={<ArrowUpRightIcon />}
        endIcon={<ExternalLinkIcon sx={{ fontSize: 12 }} />}
        sx={{ borderRadius: 2, textTransform: "none", fontSize: "0.7rem" }}
      >
        TX: {result.hash.slice(0, 10)}...{result.hash.slice(-8)}
      </Button>
    );
  }

  // Sequential send results (array of hashes)
  if (Array.isArray(data) && data.length > 0 && (data[0] as SendResult)?.hash) {
    return (
      <Stack spacing={0.5}>
        {(data as SendResult[]).map((r, i) => (
          <Button
            key={i}
            variant="outlined"
            size="small"
            href={r.explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            startIcon={<ArrowUpRightIcon />}
            sx={{ borderRadius: 2, textTransform: "none", fontSize: "0.65rem", justifyContent: "flex-start" }}
          >
            TX {i + 1}: {r.hash.slice(0, 10)}...{r.hash.slice(-6)}
          </Button>
        ))}
      </Stack>
    );
  }

  // Balance results
  if (Array.isArray(data) && data.length > 0 && (data[0] as { token?: unknown })?.token) {
    const list = data as Array<{ token: { symbol: string }; formatted: string }>;
    return (
      <Paper
        variant="outlined"
        sx={(theme) => ({
          p: 2,
          borderRadius: 2,
          bgcolor: theme.palette.mode === "dark" ? "#18191c" : "#f8f9fa",
        })}
      >
        <Stack spacing={1}>
          {list.map((b, i) => (
            <Box key={i} sx={{ display: "flex", justifyContent: "space-between" }}>
              <Typography variant="caption" fontWeight={600}>{b.token.symbol}</Typography>
              <Typography variant="caption" fontFamily="monospace">{b.formatted}</Typography>
            </Box>
          ))}
        </Stack>
      </Paper>
    );
  }

  // Swap result
  if (action?.action === "swap" && d.tokenIn != null) {
    const r = data as SwapResult;
    return (
      <Button
        variant="outlined"
        size="small"
        href={r.explorerUrl}
        target="_blank"
        rel="noopener noreferrer"
        startIcon={<ArrowUpRightIcon />}
        sx={{ borderRadius: 2, textTransform: "none", fontSize: "0.7rem", color: "success.main", borderColor: "success.main" }}
      >
        Swapped {r.amountIn} {r.tokenIn} → {r.amountOut} {r.tokenOut}
      </Button>
    );
  }

  // Limit order result
  if (action?.action === "place_limit_order" && d.side != null) {
    const r = data as LimitOrderResult;
    return (
      <Button
        variant="outlined"
        size="small"
        href={r.explorerUrl}
        target="_blank"
        rel="noopener noreferrer"
        startIcon={<ArrowUpRightIcon />}
        sx={{ borderRadius: 2, textTransform: "none", fontSize: "0.7rem", color: "success.main", borderColor: "success.main" }}
      >
        Limit {r.side}: {r.amount} {r.token} @ {r.price}
      </Button>
    );
  }

  // Cancel order result
  if (action?.action === "cancel_order" && d.hash) {
    const r = data as { hash: string; explorerUrl: string };
    return (
      <Button
        variant="outlined"
        size="small"
        href={r.explorerUrl}
        target="_blank"
        rel="noopener noreferrer"
        sx={{ borderRadius: 2, textTransform: "none", fontSize: "0.7rem" }}
      >
        Order cancelled
      </Button>
    );
  }

  // Faucet result
  if (action?.action === "faucet") {
    const faucetData = data as Record<string, unknown> | null;
    return (
      <Chip
        icon={<DropletsIcon />}
        label={faucetData?.funded ? "Testnet funds sent!" : "Faucet request submitted"}
        color="success"
        size="small"
        sx={{ borderRadius: 2 }}
      />
    );
  }

  // Open orders list
  if (action?.action === "get_open_orders" && d.orders) {
    const orders = (d.orders as Array<{ label: string; token: string; amount: string; is_bid: boolean; price: number }>) ?? [];
    if (orders.length === 0) {
      return <Typography variant="caption" color="text.secondary">No open limit orders.</Typography>;
    }
    return (
      <Paper
        variant="outlined"
        sx={(theme) => ({
          p: 2,
          borderRadius: 2,
          bgcolor: theme.palette.mode === "dark" ? "#18191c" : "#f8f9fa",
        })}
      >
        <Typography variant="caption" fontWeight={700} sx={{ display: "block", mb: 1 }}>Open orders</Typography>
        <Stack spacing={0.5}>
          {orders.map((o) => (
            <Box key={o.label} sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Chip label={o.label} size="small" color={o.is_bid ? "success" : "error"} sx={{ height: 18, fontSize: "0.65rem" }} />
              <Typography variant="caption" fontFamily="monospace">
                {o.is_bid ? "Buy" : "Sell"} {o.amount} {o.token} @ {Number(o.price).toFixed(3)}
              </Typography>
            </Box>
          ))}
        </Stack>
      </Paper>
    );
  }



  // Deploy Token Result
  if (action?.action === "deploy_token" && d.tokenAddress) {
    const r = data as DeployTokenResult;
    return (
      <Button
        variant="outlined"
        size="small"
        href={r.explorerUrl}
        target="_blank"
        rel="noopener noreferrer"
        startIcon={<ArrowUpRightIcon />}
        sx={{ borderRadius: 2, textTransform: "none", fontSize: "0.7rem", color: "success.main", borderColor: "success.main" }}
      >
        Deployed {r.symbol}: {r.tokenAddress.slice(0, 6)}...{r.tokenAddress.slice(-4)}
      </Button>
    );
  }

  // Create Pair Result
  if (action?.action === "create_pair" && d.pairKey) {
    const r = data as CreatePairResult;
    return (
      <Button
        variant="outlined"
        size="small"
        href={r.explorerUrl}
        target="_blank"
        rel="noopener noreferrer"
        startIcon={<ArrowUpRightIcon />}
        sx={{ borderRadius: 2, textTransform: "none", fontSize: "0.7rem", color: "success.main", borderColor: "success.main" }}
      >
        Pair Created: {r.baseTokenSymbol}/pathUSD
      </Button>
    );
  }

  // Fallback JSON view
  return (
    <Paper
      variant="outlined"
      sx={(theme) => {
        const isDark = theme.palette.mode === "dark";
        return {
          p: 1.5,
          borderRadius: 2,
          bgcolor: isDark ? "#202124" : "#f8f9fa",
          maxHeight: 120,
          overflow: "auto",
        };
      }}
    >
      <Typography
        component="pre"
        variant="caption"
        fontFamily="monospace"
        sx={(theme) => ({
          fontSize: "0.7rem",
          whiteSpace: "pre-wrap",
          color: theme.palette.text.secondary,
        })}
      >
        {JSON.stringify(data, null, 2)}
      </Typography>
    </Paper>
  );
}

// ── Utility helpers ───────────────────────────────────────────

function toUnixSeconds(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "number" && !Number.isNaN(value) && Number.isFinite(value)) return Math.floor(value);
  if (typeof value === "string") {
    const ms = Date.parse(value);
    if (!Number.isNaN(ms)) return Math.floor(ms / 1000);
  }
  return 0;
}

function toInteger(value: unknown, defaultVal: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isNaN(n) && Number.isFinite(n)) return Math.floor(n);
  return defaultVal;
}

// ── normalizeAction ───────────────────────────────────────────

/** Normalize API action: ensure it's an object and fix common model typos (e.g. schedule_payments -> schedule_payment). */
export function normalizeAction(raw: unknown): Record<string, unknown> | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = { ...(raw as Record<string, unknown>) };
  const a = obj.action;
  if (typeof a !== "string") return null;

  // Trading-agent actions are intentionally removed from this app.
  // If the model ever emits them, ignore so the UI doesn't attempt to call a non-existent backend.
  const disabled = new Set([
    "add_strategy",
    "remove_strategy",
    "pause_strategy",
    "resume_strategy",
    "start_agent",
    "stop_agent",
    "kill",
    "resume_agent",
    "status",
    "get_strategies",
    "get_positions",
    "get_performance",
  ]);
  if (disabled.has(a)) return null;

  const normalized: Record<string, string> = {
    schedule_payments: "schedule_payment",
    recurring_payments: "recurring_payment",
    get_open_order: "get_open_orders",
    send_payments: "send_parallel",
    add_token_to_balance: "track_token",
    add_token: "track_token",
    track_contract: "track_token",
  };
  obj.action = normalized[a] ?? a;
  return obj;
}

// ── executeAction ─────────────────────────────────────────────

export async function executeAction(action: Record<string, unknown>, ctx: ActionContext): Promise<unknown> {
  const actionName = action.action;
  if (typeof actionName !== "string") {
    throw new Error("Invalid action: missing or invalid action type.");
  }
  switch (actionName) {
    case "get_open_orders": {
      const wallet = ctx.walletAddress;
      if (!wallet) return { orders: [], message: "Connect wallet to see open orders." };
      const res = await fetch(`/api/tempo/orders?wallet=${encodeURIComponent(wallet)}`);
      const data = await res.json();
      if (!res.ok) return { orders: [], error: data.error ?? "Failed to fetch orders." };
      return { orders: data.orders ?? [] };
    }

    case "send_payment": {
      ctx.setStatus?.(`Sending ${String(action.amount ?? "")} ${String(action.token ?? "")}...`);
      const result = await ctx.sendPayment(
        action.token as string,
        action.amount as string,
        action.to as Address,
      );
      setTimeout(() => ctx.refreshBalances(), 2000);
      return result;
    }

    case "send_parallel": {
      ctx.setStatus?.("Sending multiple payments in parallel...");
      const rawTransfers = action.transfers;
      if (!Array.isArray(rawTransfers) || rawTransfers.length === 0) {
        throw new Error("send_parallel requires a non-empty transfers array.");
      }
      const transfers = rawTransfers.map((t: Record<string, unknown>) => ({
        tokenSymbol: String(t?.token ?? ""),
        amount: String(t?.amount ?? ""),
        to: (t?.to ?? "") as Address,
      }));
      const results = await ctx.sendParallel(transfers);
      setTimeout(() => ctx.refreshBalances(), 2000);
      return results;
    }

    case "schedule_payment": {
      const executeAt = action.executeAt as string;
      const rawTransfers = action.transfers;
      if (!executeAt || typeof executeAt !== "string") {
        throw new Error("schedule_payment requires executeAt (ISO date string).");
      }
      if (!Array.isArray(rawTransfers) || rawTransfers.length === 0) {
        throw new Error("schedule_payment requires a non-empty transfers array.");
      }
      const transfers = rawTransfers.map((t: Record<string, unknown>) => ({
        token: String(t?.token ?? ""),
        amount: String(t?.amount ?? ""),
        to: (t?.to ?? "") as Address,
      }));
      const results = await ctx.schedulePayments(transfers, executeAt);
      setTimeout(() => ctx.refreshBalances(), 2000);
      return {
        scheduled: true,
        executeAt,
        transferCount: results.length,
        results,
        note: `Scheduled ${results.length} payment(s) on-chain for ${new Date(executeAt).toLocaleString()}.`,
      };
    }

    case "recurring_payment": {
      const token = action.token as string;
      const amount = String(action.amount ?? "");
      const to = action.to as Address;
      const intervalSeconds = toInteger(action.intervalSeconds, 7 * 24 * 3600);
      const endTime = toUnixSeconds(action.endTime);
      const firstDueTime = toUnixSeconds(action.firstDueTime);
      const result = await ctx.createRecurringPayment(token, amount, to, intervalSeconds, endTime || undefined, firstDueTime || undefined);
      setTimeout(() => ctx.refreshBalances(), 2000);
      return result;
    }

    case "get_balance": {
      const updated = await ctx.refreshBalances();
      const list = Array.isArray(updated) && updated.length > 0 ? updated : ctx.balances;
      return list.map((b) => ({
        token: { symbol: b.token.symbol, address: b.token.address },
        formatted: b.formatted,
        raw: b.raw.toString(),
      }));
    }

    case "swap": {
      ctx.setStatus?.(`Swapping ${String(action.amountIn ?? "")} ${String(action.tokenIn ?? "")} to ${String(action.tokenOut ?? "")}...`);
      const tokenIn = action.tokenIn as string;
      const tokenOut = action.tokenOut as string;
      const amountIn = String(action.amountIn ?? "");
      const slippageBps = typeof action.slippageBps === "number" ? action.slippageBps : 50;
      const result = await ctx.swap(tokenIn, tokenOut, amountIn, slippageBps);
      setTimeout(() => ctx.refreshBalances(), 2000);
      return result;
    }

    case "place_limit_order": {
      const token = action.token as string;
      const amount = String(action.amount ?? "");
      const isBid = action.isBid === true;
      const price = Number(action.price ?? 1);
      ctx.setStatus?.(
        `Placing ${isBid ? "buy" : "sell"} limit order: ${amount} ${token} @ ${price}...`,
      );
      const result = await ctx.placeLimitOrder(token, amount, isBid, price);
      setTimeout(() => ctx.refreshBalances(), 2000);
      return result;
    }

    case "cancel_order": {
      let onChainOrderId = String(action.orderId ?? "").trim();
      const orderRef = action.orderRef != null ? String(action.orderRef).trim() : "";
      const wallet = ctx.walletAddress;

      if (orderRef && wallet) {
        const res = await fetch(
          `/api/tempo/orders?wallet=${encodeURIComponent(wallet)}&ref=${encodeURIComponent(orderRef)}`,
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error((err as { error?: string }).error ?? `Order not found: ${orderRef}`);
        }
        const data = await res.json();
        onChainOrderId = (data as { on_chain_order_id?: string }).on_chain_order_id ?? "";
      }

      if (!onChainOrderId) {
        throw new Error("Specify order by ID (e.g. 12345) or by label (e.g. bid 1, ask 2).");
      }

      ctx.setStatus?.(`Cancelling order ${onChainOrderId}...`);
      const result = await ctx.cancelOrder(onChainOrderId);

      if (wallet) {
        try {
          await fetch("/api/tempo/orders", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ wallet_address: wallet, on_chain_order_id: onChainOrderId }),
          });
        } catch { /* best effort */ }
      }
      return result;
    }

    case "faucet": {
      ctx.setStatus?.("Requesting faucet funds...");
      const faucetResult = await ctx.requestFunds();
      setTimeout(() => ctx.refreshBalances(), 3000);
      return { funded: true, ...(faucetResult as Record<string, unknown>) };
    }

    case "set_fee_token": {
      const token = action.token as string;
      if (typeof window !== "undefined") {
        localStorage.setItem("sisyphus_fee_token", token);
      }
      return { feeToken: token, status: "set" };
    }

    case "deploy_token": {
      const name = action.name as string;
      const symbol = action.symbol as string;
      ctx.setStatus?.(`Deploying token ${symbol} (${name})...`);
      return ctx.deployToken(name, symbol);
    }

    case "mint_token": {
      const token = action.token as string;
      const amount = String(action.amount ?? "");
      const recipient = (action.recipient as Address) || ctx.walletAddress as Address;
      ctx.setStatus?.(`Minting ${amount} ${token}...`);
      return ctx.mintToken(token, amount, recipient);
    }

    case "create_pair": {
      const token = action.token as string;
      ctx.setStatus?.(`Creating trading pair for ${token}...`);
      return ctx.createPair(token);
    }

    case "provide_liquidity": {
      const token = action.token as string;
      const amountToken = String(action.amountToken ?? "");
      const amountQuote = String(action.amountQuote ?? "");
      ctx.setStatus?.(`Providing liquidity for ${token} with ${amountToken} tokens...`);
      return ctx.provideLiquidity(token, amountToken, amountQuote);
    }

    case "track_token": {
      const wallet = ctx.walletAddress;
      if (!wallet) {
        throw new Error("Connect your wallet before tracking tokens.");
      }

      const rawAddress = (action.address ?? action.tokenAddress ?? action.token) as string | undefined;
      if (!rawAddress || typeof rawAddress !== "string" || !rawAddress.startsWith("0x")) {
        throw new Error("track_token requires a valid token contract address (0x...).");
      }
      const address = rawAddress as Address;

      let symbol =
        typeof action.symbol === "string" && action.symbol.trim().length > 0
          ? (action.symbol as string).trim()
          : "";
      let name =
        typeof action.name === "string" && action.name.trim().length > 0
          ? (action.name as string).trim()
          : symbol;
      let decimals: number | undefined =
        typeof action.decimals === "number" && Number.isFinite(action.decimals as number)
          ? Number(action.decimals as number)
          : undefined;

      // Try to read missing metadata from chain
      if (!symbol || decimals == null) {
        const client = getPublicClient();
        try {
          const [onChainSymbol, onChainDecimals] = await Promise.all([
            client.readContract({
              address,
              abi: ERC20_ABI,
              functionName: "symbol",
              args: [],
            }),
            client.readContract({
              address,
              abi: ERC20_ABI,
              functionName: "decimals",
              args: [],
            }),
          ]);
          if (!symbol && typeof onChainSymbol === "string") {
            symbol = onChainSymbol;
          }
          if (decimals == null && typeof onChainDecimals === "bigint") {
            decimals = Number(onChainDecimals);
          } else if (decimals == null && typeof onChainDecimals === "number") {
            decimals = onChainDecimals;
          }
        } catch (e) {
          if (decimals == null) {
            decimals = 6;
          }
        }
      }

      if (!symbol) symbol = "TOKEN";
      if (!name) name = symbol;
      if (decimals == null) decimals = 6;

      // Persist in local storage under this wallet so balances hook picks it up
      saveTokenToStorage({
        address,
        name,
        symbol,
        decimals,
        deployer: wallet as Address,
      });

      // Optionally refresh balances so next get_balance / dashboard shows it
      await ctx.refreshBalances();

      return {
        tracked: true,
        address,
        symbol,
        name,
        decimals,
      };
    }

    default:
      throw new Error(`Unknown action: ${String(action.action)}`);
  }
}
