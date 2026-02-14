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
  FormControlLabel,
  Checkbox,
} from "@mui/material";
import type { Address } from "viem";

const TOKENS = ["pathUSD", "AlphaUSD", "BetaUSD", "ThetaUSD"];
const INTERVALS = [
  { label: "Daily", seconds: 86400 },
  { label: "Weekly", seconds: 604800 },
  { label: "Monthly (30d)", seconds: 2592000 },
];

function dateToUnixSeconds(dateStr: string): number {
  if (!dateStr) return 0;
  return Math.floor(new Date(dateStr + "T00:00:00Z").getTime() / 1000);
}

type RecurringPaymentDialogProps = {
  open: boolean;
  onClose: () => void;
  onCreate: (
    token: string,
    amount: string,
    to: Address,
    intervalSeconds: number,
    endTime?: number,
    firstDueTime?: number,
  ) => Promise<unknown>;
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
  onRecordTxs?: (items: { hash: string; type: "recurring" }[]) => void;
};

export function RecurringPaymentDialog({
  open,
  onClose,
  onCreate,
  onSuccess,
  onError,
  onRecordTxs,
}: RecurringPaymentDialogProps) {
  const [firstDueDate, setFirstDueDate] = useState("");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [token, setToken] = useState("AlphaUSD");
  const [intervalSeconds, setIntervalSeconds] = useState(604800);
  const [hasEndDate, setHasEndDate] = useState(false);
  const [endDate, setEndDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
    const firstDue = firstDueDate ? dateToUnixSeconds(firstDueDate) : 0;
    const end = hasEndDate && endDate ? dateToUnixSeconds(endDate) : 0;
    if (hasEndDate && endDate && end <= firstDue) {
      onError?.("End date must be after start date.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await onCreate(token, amt, addr as Address, intervalSeconds, end || undefined, firstDue || undefined);
      const hash = result != null && typeof result === "object" && "hash" in result ? (result as { hash: string }).hash : undefined;
      if (onRecordTxs && hash) {
        onRecordTxs([{ hash, type: "recurring" }]);
      }
      onSuccess?.(`Recurring ${amt} ${token} to ${addr.slice(0, 10)}... (${INTERVALS.find((i) => i.seconds === intervalSeconds)?.label ?? "custom"}).`);
      setFirstDueDate("");
      setTo("");
      setAmount("");
      setEndDate("");
      onClose();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Recurring payment failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) onClose();
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 2 } }}>
      <form onSubmit={handleSubmit}>
        <DialogTitle sx={{ fontWeight: 600 }}>Recurring payment</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Payment is pulled from your wallet at each interval. No escrow.
          </Typography>
          <TextField
            select
            label="Interval"
            value={intervalSeconds}
            onChange={(e) => setIntervalSeconds(Number(e.target.value))}
            size="small"
            fullWidth
          >
            {INTERVALS.map((i) => (
              <MenuItem key={i.seconds} value={i.seconds}>{i.label}</MenuItem>
            ))}
          </TextField>
          <TextField
            label="First payment date (optional)"
            type="date"
            value={firstDueDate}
            onChange={(e) => setFirstDueDate(e.target.value)}
            inputProps={{ min: today }}
            size="small"
            fullWidth
            InputLabelProps={{ shrink: true }}
            helperText="Leave empty for first run immediately"
          />
          <FormControlLabel
            control={<Checkbox checked={hasEndDate} onChange={(e) => setHasEndDate(e.target.checked)} size="small" />}
            label="Set end date"
          />
          {hasEndDate && (
            <TextField
              label="End date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              inputProps={{ min: firstDueDate || today }}
              size="small"
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          )}
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
            {submitting ? <CircularProgress size={20} /> : "Create recurring"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
