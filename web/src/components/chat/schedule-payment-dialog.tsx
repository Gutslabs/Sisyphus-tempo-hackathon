"use client";

import { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Box,
  Typography,
  CircularProgress,
} from "@mui/material";
import type { Address } from "viem";

const TOKENS = ["pathUSD", "AlphaUSD", "BetaUSD", "ThetaUSD"];

function toISOUTC(datetimeLocal: string): string {
  if (!datetimeLocal) return "";
  const d = new Date(datetimeLocal);
  return d.toISOString();
}

type SchedulePaymentDialogProps = {
  open: boolean;
  onClose: () => void;
  onSchedule: (transfers: { token: string; amount: string; to: Address }[], executeAt: string) => Promise<unknown[]>;
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
  onRecordTxs?: (items: { hash: string; type: "schedule" }[]) => void;
};

export function SchedulePaymentDialog({
  open,
  onClose,
  onSchedule,
  onSuccess,
  onError,
  onRecordTxs,
}: SchedulePaymentDialogProps) {
  const [executeAtLocal, setExecuteAtLocal] = useState("");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [token, setToken] = useState("AlphaUSD");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const executeAt = toISOUTC(executeAtLocal);
    if (!executeAt || executeAt <= new Date().toISOString()) {
      onError?.("Please pick a date and time in the future.");
      return;
    }
    const addr = to.trim();
    if (!addr || !addr.startsWith("0x") || addr.length !== 42) {
      onError?.("Enter a valid 0x wallet address.");
      return;
    }
    const amt = amount.trim();
    if (!amt || Number.isNaN(Number(amt)) || Number(amt) <= 0) {
      onError?.("Enter a valid amount.");
      return;
    }
    setSubmitting(true);
    try {
      const results = await onSchedule(
        [{ token, amount: amt, to: addr as Address }],
        executeAt,
      );
      if (onRecordTxs && Array.isArray(results)) {
        const items = results
          .map((r) => (r as { hash?: string }).hash)
          .filter((h): h is string => Boolean(h))
          .map((hash) => ({ hash, type: "schedule" as const }));
        if (items.length) onRecordTxs(items);
      }
      onSuccess?.(`Scheduled ${amt} ${token} to ${addr.slice(0, 10)}... for ${new Date(executeAt).toLocaleString()}.`);
      setExecuteAtLocal("");
      setTo("");
      setAmount("");
      onClose();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Schedule failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) onClose();
  };

  const minDatetimeLocal = (() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + 1);
    return d.toISOString().slice(0, 16);
  })();

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 2 } }}>
      <form onSubmit={handleSubmit}>
        <DialogTitle sx={{ fontWeight: 600 }}>Schedule payment</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            One-time payment. Tokens are escrowed until the date; anyone can execute after.
          </Typography>
          <TextField
            label="Date & time"
            type="datetime-local"
            value={executeAtLocal}
            onChange={(e) => setExecuteAtLocal(e.target.value)}
            inputProps={{ min: minDatetimeLocal }}
            required
            fullWidth
            size="small"
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="Recipient address (0x...)"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="0x..."
            required
            fullWidth
            size="small"
          />
          <Box sx={{ display: "flex", gap: 2 }}>
            <TextField
              label="Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              type="number"
              inputProps={{ min: 0, step: "any" }}
              required
              fullWidth
              size="small"
            />
            <TextField
              select
              label="Token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              size="small"
              sx={{ minWidth: 140 }}
            >
              {TOKENS.map((t) => (
                <MenuItem key={t} value={t}>{t}</MenuItem>
              ))}
            </TextField>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleClose} disabled={submitting}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={submitting}>
            {submitting ? <CircularProgress size={20} /> : "Schedule"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
