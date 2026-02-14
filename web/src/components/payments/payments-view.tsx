"use client";

import { useMemo, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  TextField,
  MenuItem,
  Button,
  CircularProgress,
  Alert,
  Divider,
  FormControlLabel,
  Checkbox,
  Stack,
} from "@mui/material";
import { Schedule as ScheduleIcon, Loop as RecurringIcon } from "@mui/icons-material";
import { useAccount } from "wagmi";
import type { Address } from "viem";
import { useTempoBalances, useTempoScheduler } from "@/hooks/use-tempo";
import { recordTransaction } from "@/lib/record-tx";
import { PaymentsSchedules } from "./payments-schedules";

const TOKENS = ["pathUSD", "AlphaUSD", "BetaUSD", "ThetaUSD"] as const;
const INTERVALS = [
  { label: "Daily", seconds: 86400 },
  { label: "Weekly", seconds: 604800 },
  { label: "Monthly (30d)", seconds: 2592000 },
] as const;

function toISOUTC(datetimeLocal: string): string {
  if (!datetimeLocal) return "";
  const d = new Date(datetimeLocal);
  return d.toISOString();
}

function dateToUnixSeconds(dateStr: string): number {
  if (!dateStr) return 0;
  return Math.floor(new Date(dateStr + "T00:00:00Z").getTime() / 1000);
}

export function PaymentsView() {
  const { isConnected } = useAccount();
  const { address } = useTempoBalances();
  const { schedulePayments, createRecurringPayment, scheduling } = useTempoScheduler();

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // One-time schedule form
  const [executeAtLocal, setExecuteAtLocal] = useState("");
  const [scheduleTo, setScheduleTo] = useState("");
  const [scheduleAmount, setScheduleAmount] = useState("");
  const [scheduleToken, setScheduleToken] = useState<(typeof TOKENS)[number]>("AlphaUSD");
  const [submittingSchedule, setSubmittingSchedule] = useState(false);

  // Recurring form
  const [intervalSeconds, setIntervalSeconds] = useState<number>(604800);
  const [firstDueDate, setFirstDueDate] = useState("");
  const [recurringTo, setRecurringTo] = useState("");
  const [recurringAmount, setRecurringAmount] = useState("");
  const [recurringToken, setRecurringToken] = useState<(typeof TOKENS)[number]>("AlphaUSD");
  const [hasEndDate, setHasEndDate] = useState(false);
  const [endDate, setEndDate] = useState("");
  const [submittingRecurring, setSubmittingRecurring] = useState(false);

  const minDatetimeLocal = useMemo(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + 1);
    return d.toISOString().slice(0, 16);
  }, []);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const canSubmit = isConnected && Boolean(address) && !scheduling;

  const resetAlerts = () => {
    setError(null);
    setSuccess(null);
  };

  const submitSchedule = async () => {
    resetAlerts();
    if (!address) return;

    const executeAt = toISOUTC(executeAtLocal);
    if (!executeAt || executeAt <= new Date().toISOString()) {
      setError("Please pick a date & time in the future.");
      return;
    }
    const to = scheduleTo.trim();
    if (!to || !to.startsWith("0x") || to.length !== 42) {
      setError("Enter a valid 0x recipient address.");
      return;
    }
    const amt = scheduleAmount.trim();
    if (!amt || Number.isNaN(Number(amt)) || Number(amt) <= 0) {
      setError("Enter a valid amount.");
      return;
    }

    setSubmittingSchedule(true);
    try {
      const results = await schedulePayments([{ token: scheduleToken, amount: amt, to: to as Address }], executeAt);
      results.forEach((r) => {
        recordTransaction({
          wallet_address: address,
          tx_hash: r.hash,
          type: "schedule",
          label: "Schedule payment",
        });
      });
      setSuccess(`Scheduled ${amt} ${scheduleToken} to ${to.slice(0, 10)}… for ${new Date(executeAt).toLocaleString()}.`);
      setExecuteAtLocal("");
      setScheduleTo("");
      setScheduleAmount("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Schedule failed.");
    } finally {
      setSubmittingSchedule(false);
    }
  };

  const submitRecurring = async () => {
    resetAlerts();
    if (!address) return;

    const to = recurringTo.trim();
    if (!to || !to.startsWith("0x") || to.length !== 42) {
      setError("Enter a valid 0x recipient address.");
      return;
    }
    const amt = recurringAmount.trim();
    if (!amt || Number.isNaN(Number(amt)) || Number(amt) <= 0) {
      setError("Enter a valid amount.");
      return;
    }

    const firstDue = firstDueDate ? dateToUnixSeconds(firstDueDate) : 0;
    const end = hasEndDate && endDate ? dateToUnixSeconds(endDate) : 0;
    if (hasEndDate && endDate && end <= firstDue) {
      setError("End date must be after start date.");
      return;
    }

    setSubmittingRecurring(true);
    try {
      const res = await createRecurringPayment(
        recurringToken,
        amt,
        to as Address,
        intervalSeconds,
        end || undefined,
        firstDue || undefined,
      );
      recordTransaction({
        wallet_address: address,
        tx_hash: res.hash,
        type: "recurring",
        label: "Recurring payment",
      });
      const label = INTERVALS.find((i) => i.seconds === intervalSeconds)?.label ?? `${intervalSeconds}s`;
      setSuccess(`Created recurring ${amt} ${recurringToken} to ${to.slice(0, 10)}… (${label}).`);
      setFirstDueDate("");
      setRecurringTo("");
      setRecurringAmount("");
      setHasEndDate(false);
      setEndDate("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Recurring payment failed.");
    } finally {
      setSubmittingRecurring(false);
    }
  };

  if (!isConnected || !address) {
    return (
      <Box sx={{ width: "100%", minWidth: 0, p: { xs: 3, md: 4 } }}>
        <Paper variant="outlined" sx={{ p: 4, borderRadius: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
            Payments
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Connect your wallet to schedule or create recurring payments.
          </Typography>
        </Paper>
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
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Payments
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Create one-time scheduled payments or recurring payments without using the chat input.
        </Typography>
      </Box>

      {error ? <Alert severity="error">{error}</Alert> : null}
      {success ? <Alert severity="success">{success}</Alert> : null}

      <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
          <ScheduleIcon color="primary" fontSize="small" />
          <Typography sx={{ fontWeight: 700 }}>Schedule payment</Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          One-time payment. Tokens are escrowed until the date; anyone can execute after.
        </Typography>

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
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
            label="Token"
            select
            value={scheduleToken}
            onChange={(e) => setScheduleToken(e.target.value as (typeof TOKENS)[number])}
            fullWidth
            size="small"
          >
            {TOKENS.map((t) => (
              <MenuItem key={t} value={t}>
                {t}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Recipient address (0x...)"
            value={scheduleTo}
            onChange={(e) => setScheduleTo(e.target.value)}
            placeholder="0x..."
            required
            fullWidth
            size="small"
            sx={{ gridColumn: { xs: "auto", md: "1 / span 2" } }}
          />
          <TextField
            label="Amount"
            value={scheduleAmount}
            onChange={(e) => setScheduleAmount(e.target.value)}
            type="number"
            inputProps={{ min: 0, step: "any" }}
            required
            fullWidth
            size="small"
          />
          <Box sx={{ display: "flex", justifyContent: "flex-end", alignItems: "center" }}>
            <Button
              variant="contained"
              onClick={submitSchedule}
              disabled={!canSubmit || submittingSchedule}
              sx={{ minWidth: 180 }}
            >
              {submittingSchedule ? <CircularProgress size={20} /> : "Schedule"}
            </Button>
          </Box>
        </Box>
      </Paper>

      <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
          <RecurringIcon color="primary" fontSize="small" />
          <Typography sx={{ fontWeight: 700 }}>Recurring payment</Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Payment is pulled from your wallet at each interval. No escrow.
        </Typography>

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
          <TextField
            select
            label="Interval"
            value={intervalSeconds}
            onChange={(e) => setIntervalSeconds(Number(e.target.value))}
            size="small"
            fullWidth
          >
            {INTERVALS.map((i) => (
              <MenuItem key={i.seconds} value={i.seconds}>
                {i.label}
              </MenuItem>
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

          <Divider sx={{ gridColumn: "1 / -1", my: 0.5 }} />

          <FormControlLabel
            control={<Checkbox checked={hasEndDate} onChange={(e) => setHasEndDate(e.target.checked)} size="small" />}
            label="Set end date"
            sx={{ gridColumn: "1 / -1" }}
          />
          {hasEndDate ? (
            <TextField
              label="End date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              inputProps={{ min: firstDueDate || today }}
              size="small"
              fullWidth
              InputLabelProps={{ shrink: true }}
              sx={{ gridColumn: "1 / -1" }}
            />
          ) : null}

          <TextField
            label="Token"
            select
            value={recurringToken}
            onChange={(e) => setRecurringToken(e.target.value as (typeof TOKENS)[number])}
            fullWidth
            size="small"
          >
            {TOKENS.map((t) => (
              <MenuItem key={t} value={t}>
                {t}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Amount"
            value={recurringAmount}
            onChange={(e) => setRecurringAmount(e.target.value)}
            type="number"
            inputProps={{ min: 0, step: "any" }}
            required
            fullWidth
            size="small"
          />
          <TextField
            label="Recipient address (0x...)"
            value={recurringTo}
            onChange={(e) => setRecurringTo(e.target.value)}
            placeholder="0x..."
            required
            fullWidth
            size="small"
            sx={{ gridColumn: { xs: "auto", md: "1 / span 2" } }}
          />
          <Box sx={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gridColumn: "1 / -1" }}>
            <Button
              variant="contained"
              onClick={submitRecurring}
              disabled={!canSubmit || submittingRecurring}
              sx={{ minWidth: 220 }}
            >
              {submittingRecurring ? <CircularProgress size={20} /> : "Create recurring"}
            </Button>
          </Box>
        </Box>
      </Paper>

      <PaymentsSchedules />
    </Box>
  );
}
