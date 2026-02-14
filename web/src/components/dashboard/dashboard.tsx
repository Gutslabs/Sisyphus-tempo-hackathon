"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount } from "wagmi";
import { 
  Box, 
  Typography, 
  Grid, 
  Paper, 
  IconButton, 
  Avatar, 
  Chip, 
  Tooltip, 
  CircularProgress,
  Stack,
} from "@mui/material";
import { 
  AccountBalanceWallet as WalletIcon, 
  OpenInNew as ExternalLinkIcon,
  History as ActivityIcon,
  Close as CloseIcon,
} from "@mui/icons-material";
import { useTempoBalances, useTempoLimitOrder } from "@/hooks/use-tempo";
import { tokenIconUrl, explorerAddressUrl, getPublicClient, EXCHANGE_ABI, TEMPO_EXCHANGE_ADDRESS } from "@/lib/tempo";
import { decodeEventLog, type Hash } from "viem";
import { recordTransaction } from "@/lib/record-tx";

type OpenOrder = {
  id: string;
  label: string;
  on_chain_order_id: string;
  token: string;
  amount: string;
  is_bid: boolean;
  price: number;
  tx_hash: string | null;
  created_at: string;
};

export function Dashboard() {
  const [mounted, setMounted] = useState(false);
  const { isConnected } = useAccount();
  const { balances, loading: balancesLoading, error: balanceError, address } = useTempoBalances();

  useEffect(() => {
    setMounted(true);
  }, []);
  const { cancelOrder, placing: cancelPending } = useTempoLimitOrder();
  const [openOrders, setOpenOrders] = useState<OpenOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const resolveOrderId = useCallback(async (order: OpenOrder): Promise<string | null> => {
    if (order.on_chain_order_id && order.on_chain_order_id !== "") return order.on_chain_order_id;
    if (!order.tx_hash) return null;
    try {
      const client = getPublicClient();
      const receipt = await client.getTransactionReceipt({ hash: order.tx_hash as Hash });
      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({
            abi: EXCHANGE_ABI,
            data: log.data,
            topics: log.topics,
          });
          if (decoded.eventName === "OrderPlaced" && decoded.args?.orderId != null) {
            return String(decoded.args.orderId);
          }
        } catch {
          // ignore non-matching logs
        }
      }

      // Fallback: grab first indexed topic from a log emitted by the exchange.
      const exchangeLog = receipt.logs.find(
        (l) =>
          String(l.address).toLowerCase() === TEMPO_EXCHANGE_ADDRESS.toLowerCase() &&
          Array.isArray(l.topics) &&
          l.topics.length >= 2,
      );
      const topic1 = exchangeLog?.topics?.[1];
      if (typeof topic1 === "string" && topic1.startsWith("0x")) {
        try {
          return BigInt(topic1).toString();
        } catch {
          // ignore
        }
      }
    } catch (e) {
      // Ignore order ID resolution failures; order may still exist on-chain.
    }
    return null;
  }, []);

  const fetchOpenOrders = useCallback(async (wallet: string) => {
    setOrdersLoading(true);
    try {
      const res = await fetch(`/api/tempo/orders?wallet=${encodeURIComponent(wallet)}`);
      const data = await res.json();
      if (data.orders) setOpenOrders(data.orders);
      else setOpenOrders([]);
    } catch {
      setOpenOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (address) {
      fetchOpenOrders(address);
      const interval = setInterval(() => {
        fetchOpenOrders(address);
      }, 30_000);
      return () => clearInterval(interval);
    } else {
      setOpenOrders([]);
    }
  }, [address, fetchOpenOrders]);

  const totalBalance = balances.reduce((sum, b) => sum + Number(b.formatted), 0);

  if (!mounted) return null;

  return (
    <Box
      sx={{
        width: "100%",
        minWidth: 0,
        p: { xs: 2, md: 4 },
        display: "flex",
        flexDirection: "column",
        gap: { xs: 3, md: 4 },
      }}
    >
      
      {/* Wallet & Balances Header */}
      {isConnected && address && (
        <Paper
          elevation={0}
          sx={(theme) => ({
            p: { xs: 2, md: 3 },
            borderRadius: 3,
            bgcolor: theme.palette.background.paper,
          })}
        >
          <Box
            sx={{
              display: "flex",
              flexDirection: { xs: "column", sm: "row" },
              alignItems: { xs: "flex-start", sm: "center" },
              justifyContent: "space-between",
              gap: 2,
              mb: { xs: 2, md: 4 },
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <Avatar sx={{ bgcolor: "primary.main", width: 48, height: 48 }}>
                <WalletIcon />
              </Avatar>
              <Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>Tempo Wallet</Typography>
                  <Tooltip title="View on Explorer">
                    <IconButton size="small" href={explorerAddressUrl(address)} target="_blank">
                      <ExternalLinkIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Total Balance: <Box component="span" sx={{ fontWeight: 600, color: "text.primary" }}>${totalBalance.toFixed(2)}</Box>
                </Typography>
              </Box>
            </Box>
          </Box>

          {balanceError && (
            <Typography variant="body2" color="error" sx={{ mb: 2 }}>
              Error loading balances: {balanceError}
            </Typography>
          )}
          <Grid container spacing={1.5}>
            {balances.map((b) => (
              <Grid size={{ xs: 6, sm: 4, md: 3, lg: 2 }} key={b.token.address}>
                <Paper
                  variant="outlined"
                  sx={(theme) => ({
                    p: 1.5,
                    borderRadius: 2,
                    bgcolor: theme.palette.mode === "dark" ? "#18191c" : theme.palette.background.default,
                    display: "flex",
                    flexDirection: "column",
                    gap: 0.5,
                  })}
                >
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                      <Avatar
                        src={tokenIconUrl(b.token.address)}
                        sx={{ width: 18, height: 18 }}
                      />
                      <Typography variant="caption" sx={{ fontWeight: 600, color: "text.secondary" }}>
                        {b.token.symbol}
                      </Typography>
                    </Box>
                  </Box>
                  <Typography
                    variant="body1"
                    sx={{ fontWeight: 700, fontFamily: "monospace", lineHeight: 1.2 }}
                  >
                    {Number(b.formatted) > 0
                      ? Number(b.formatted).toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })
                      : "0.00"}
                  </Typography>
                </Paper>
              </Grid>
            ))}
            {balances.length === 0 && !balancesLoading && !balanceError && (
              <Grid size={12}>
                <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: "center" }}>
                  No token balances found. Use &quot;Get faucet&quot; in the header to request testnet tokens.
                </Typography>
              </Grid>
            )}
            {balancesLoading && balances.length === 0 && (
              <Grid size={12}>
                <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
                  <CircularProgress size={24} />
                </Box>
              </Grid>
            )}
          </Grid>
        </Paper>
      )}

      {/* Open Limit Orders - Bid row and Ask row, full width */}
      <Paper
        elevation={0}
        sx={(theme) => ({
          p: { xs: 2, md: 3 },
          borderRadius: 3,
          width: "100%",
          bgcolor: theme.palette.background.paper,
        })}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 3 }}>
          <ActivityIcon color="action" fontSize="small" />
          <Typography variant="subtitle2" sx={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "text.secondary" }}>
            Open Limit Orders
          </Typography>
        </Box>

        {ordersLoading && openOrders.length === 0 ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}><CircularProgress size={24} /></Box>
        ) : openOrders.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
            No open orders.
          </Typography>
        ) : (
          <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, gap: 3 }}>
            {/* Bids column - 50% */}
            <Box sx={{ flex: 1, minWidth: 0, borderRight: { md: 1 }, borderColor: "divider", pr: { md: 2 } }}>
              <Typography variant="caption" sx={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "text.secondary", display: "block", mb: 1.5 }}>
                Bids
              </Typography>
              {openOrders.filter((o) => o.is_bid).length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: "center" }}>No bids.</Typography>
              ) : (
                <Stack spacing={2}>
                  {openOrders.filter((o) => o.is_bid).map((order) => (
                    <Paper key={order.id} variant="outlined" sx={{ p: 2, borderRadius: 2, display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 2, minWidth: 0 }}>
                        <Chip label={order.label} size="small" color="success" sx={{ height: 20, fontSize: "0.65rem", fontWeight: 700 }} />
                        <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: "monospace" }} noWrap>
                          Buy {order.amount} {order.token} @ {Number(order.price).toFixed(3)}
                        </Typography>
                      </Box>
                      <Box sx={{ display: "flex", gap: 1, flexShrink: 0 }}>
                        {order.tx_hash && (
                          <Tooltip title="View on Explorer">
                            <IconButton size="small" href={`https://explore.moderato.tempo.xyz/tx/${order.tx_hash}`} target="_blank">
                              <ExternalLinkIcon sx={{ fontSize: 14 }} />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title="Cancel Order">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={async () => {
                              setCancellingId(order.id);
                              try {
                                const idToUse = await resolveOrderId(order);
                                if (!idToUse) {
                                  throw new Error("On-chain order id not found for this order.");
                                }
                                const result = await cancelOrder(idToUse);
                                if (address && result?.hash) {
                                  recordTransaction({
                                    wallet_address: address,
                                    tx_hash: result.hash,
                                    type: "cancel_order",
                                  });
                                }
                                // Best-effort: mark as cancelled in DB, but always optimistically update UI.
                                await fetch(`/api/tempo/orders`, {
                                  method: "PATCH",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ wallet_address: address, on_chain_order_id: idToUse }),
                                }).catch(() => {});
                                // Optimistic local removal so cancelled order disappears immediately.
                                setOpenOrders((prev) => prev.filter((o) => o.id !== order.id));
                              } catch (e) {
                                // Ignore cancel failures; order may still exist on-chain.
                              } finally { setCancellingId(null); }
                            }}
                            disabled={cancelPending || cancellingId === order.id}
                          >
                            <CloseIcon sx={{ fontSize: 18 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Paper>
                  ))}
                </Stack>
              )}
            </Box>
            {/* Asks column - 50% */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "text.secondary", display: "block", mb: 1.5 }}>
                Asks
              </Typography>
              {openOrders.filter((o) => !o.is_bid).length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: "center" }}>No asks.</Typography>
              ) : (
                <Stack spacing={2}>
                  {openOrders.filter((o) => !o.is_bid).map((order) => (
                    <Paper key={order.id} variant="outlined" sx={{ p: 2, borderRadius: 2, display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 2, minWidth: 0 }}>
                        <Chip label={order.label} size="small" color="error" sx={{ height: 20, fontSize: "0.65rem", fontWeight: 700 }} />
                        <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: "monospace" }} noWrap>
                          Sell {order.amount} {order.token} @ {Number(order.price).toFixed(3)}
                        </Typography>
                      </Box>
                      <Box sx={{ display: "flex", gap: 1, flexShrink: 0 }}>
                        {order.tx_hash && (
                          <Tooltip title="View on Explorer">
                            <IconButton size="small" href={`https://explore.moderato.tempo.xyz/tx/${order.tx_hash}`} target="_blank">
                              <ExternalLinkIcon sx={{ fontSize: 14 }} />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title="Cancel Order">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={async () => {
                              setCancellingId(order.id);
                              try {
                                const idToUse = await resolveOrderId(order);
                                if (!idToUse) {
                                  throw new Error("On-chain order id not found for this order.");
                                }
                                const result = await cancelOrder(idToUse);
                                if (address && result?.hash) {
                                  recordTransaction({
                                    wallet_address: address,
                                    tx_hash: result.hash,
                                    type: "cancel_order",
                                  });
                                }
                                await fetch(`/api/tempo/orders`, {
                                  method: "PATCH",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ wallet_address: address, on_chain_order_id: idToUse }),
                                }).catch(() => {});
                                setOpenOrders((prev) => prev.filter((o) => o.id !== order.id));
                              } catch (e) {
                                // Ignore cancel failures; order may still exist on-chain.
                              } finally { setCancellingId(null); }
                            }}
                            disabled={cancelPending || cancellingId === order.id}
                          >
                            <CloseIcon sx={{ fontSize: 18 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Paper>
                  ))}
                </Stack>
              )}
            </Box>
          </Box>
        )}
      </Paper>
    </Box>
  );
}
