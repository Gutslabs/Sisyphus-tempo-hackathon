"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  Link,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
} from "@mui/material";
import { OpenInNew as ExternalLinkIcon, ReceiptLong as TxIcon } from "@mui/icons-material";
import { useAccount } from "wagmi";
import { useTempoBalances } from "@/hooks/use-tempo";
import { explorerTxUrl } from "@/lib/tempo";
import type { TransactionRow } from "@/app/api/tempo/transactions/route";

const TYPE_LABELS: Record<TransactionRow["type"], string> = {
  send: "Send",
  swap: "Swap",
  schedule: "Schedule",
  recurring: "Recurring",
  limit_order: "Limit order",
  cancel_order: "Cancel order",
  execute_scheduled: "Execute scheduled",
};

export function TxView() {
  const { isConnected } = useAccount();
  const { address } = useTempoBalances();
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTxs = useCallback(async (wallet: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tempo/transactions?wallet=${encodeURIComponent(wallet)}`);
      const data = await res.json();
      if (!res.ok) {
        setError((data as { error?: string }).error ?? "Failed to load transactions");
        setTransactions([]);
        return;
      }
      setTransactions((data.transactions ?? []) as TransactionRow[]);
    } catch {
      setError("Failed to load transactions");
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (address) {
      fetchTxs(address);
    } else {
      setTransactions([]);
      setLoading(false);
    }
  }, [address, fetchTxs]);

  if (!isConnected || !address) {
    return (
      <Box
        sx={(theme) => ({
          width: "100%",
          minWidth: 0,
          p: { xs: 3, md: 4 },
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          flex: 1,
          bgcolor: theme.palette.background.default,
        })}
      >
        <TxIcon sx={{ fontSize: 64, color: "divider", mb: 2 }} />
        <Typography variant="body1" color="text.secondary" textAlign="center">
          Connect your wallet to see your transaction history.
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={(theme) => ({
        width: "100%",
        minWidth: 0,
        p: { xs: 3, md: 4 },
        display: "flex",
        flexDirection: "column",
        gap: 2,
        bgcolor: theme.palette.background.default,
      })}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1, flexWrap: "wrap" }}>
        <TxIcon color="primary" />
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          All transactions
        </Typography>
      </Box>
      <Typography variant="body2" color="text.secondary">
        Every on-chain transaction you perform from this platform is listed here.
      </Typography>

      {error && (
        <Typography variant="body2" color="error">
          {error}
        </Typography>
      )}

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : transactions.length === 0 ? (
        <Paper
          variant="outlined"
          sx={(theme) => ({
            p: 6,
            textAlign: "center",
            borderRadius: 2,
            bgcolor: theme.palette.background.paper,
          })}
        >
          <TxIcon sx={{ fontSize: 48, color: "divider", mb: 1 }} />
          <Typography variant="body2" color="text.secondary">
            No transactions yet. Send, swap, schedule, or place orders from AI Chat or Dashboard to see them here.
          </Typography>
        </Paper>
      ) : (
        <TableContainer
          data-tour="tx-table"
          component={Paper}
          variant="outlined"
          sx={(theme) => ({
            borderRadius: 2,
            bgcolor: theme.palette.background.paper,
            overflowX: "auto",
            maxHeight: { xs: 360, md: 480 },
          })}
        >
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Time</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Tx hash</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {transactions.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell sx={{ fontFamily: "monospace", fontSize: "0.85rem" }}>
                    {new Date(tx.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={tx.label ?? TYPE_LABELS[tx.type] ?? tx.type}
                      size="small"
                      variant="outlined"
                      sx={{ fontWeight: 500 }}
                    />
                  </TableCell>
                  <TableCell sx={{ fontFamily: "monospace", fontSize: "0.8rem" }}>
                    {tx.tx_hash.slice(0, 10)}…{tx.tx_hash.slice(-8)}
                  </TableCell>
                  <TableCell align="right">
                    <Link
                      href={explorerTxUrl(tx.tx_hash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, fontSize: "0.85rem" }}
                    >
                      Explorer <ExternalLinkIcon sx={{ fontSize: 14 }} />
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
