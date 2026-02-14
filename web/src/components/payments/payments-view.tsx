"use client";

import { useMemo, useState } from "react";
import {
  Box,
  Avatar,
  Chip,
  Grid,
  InputAdornment,
  Paper,
  Snackbar,
  Tabs,
  Tab,
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
import { Schedule as ScheduleIcon, Loop as RecurringIcon, Bolt as BoltIcon } from "@mui/icons-material";
import { useAccount } from "wagmi";
import type { Address } from "viem";
import { useTempoBalances, useTempoScheduler } from "@/hooks/use-tempo";
import { recordTransaction } from "@/lib/record-tx";
import { PaymentsSchedules } from "./payments-schedules";
import { findToken, tokenIconUrl } from "@/lib/tempo";
import { alpha } from "@mui/material";

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
  const { address, balances } = useTempoBalances();
  const { schedulePayments, createRecurringPayment, scheduling } = useTempoScheduler();

  const [toast, setToast] = useState<{ message: string; severity: "success" | "error" } | null>(null);
  const closeToast = () => setToast(null);

  const [tab, setTab] = useState<"schedule" | "recurring">("schedule");

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

  const submitSchedule = async () => {
    if (!address) return;

    const executeAt = toISOUTC(executeAtLocal);
    if (!executeAt || executeAt <= new Date().toISOString()) {
      setToast({ severity: "error", message: "Pick a date & time in the future." });
      return;
    }
    const to = scheduleTo.trim();
    if (!to || !to.startsWith("0x") || to.length !== 42) {
      setToast({ severity: "error", message: "Enter a valid 0x recipient address." });
      return;
    }
    const amt = scheduleAmount.trim();
    if (!amt || Number.isNaN(Number(amt)) || Number(amt) <= 0) {
      setToast({ severity: "error", message: "Enter a valid amount." });
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
      setToast({
        severity: "success",
        message: `Scheduled ${amt} ${scheduleToken} to ${to.slice(0, 10)}… for ${new Date(executeAt).toLocaleString()}.`,
      });
      setExecuteAtLocal("");
      setScheduleTo("");
      setScheduleAmount("");
    } catch (e) {
      setToast({ severity: "error", message: e instanceof Error ? e.message : "Schedule failed." });
    } finally {
      setSubmittingSchedule(false);
    }
  };

  const submitRecurring = async () => {
    if (!address) return;

    const to = recurringTo.trim();
    if (!to || !to.startsWith("0x") || to.length !== 42) {
      setToast({ severity: "error", message: "Enter a valid 0x recipient address." });
      return;
    }
    const amt = recurringAmount.trim();
    if (!amt || Number.isNaN(Number(amt)) || Number(amt) <= 0) {
      setToast({ severity: "error", message: "Enter a valid amount." });
      return;
    }

    const firstDue = firstDueDate ? dateToUnixSeconds(firstDueDate) : 0;
    const end = hasEndDate && endDate ? dateToUnixSeconds(endDate) : 0;
    if (hasEndDate && endDate && end <= firstDue) {
      setToast({ severity: "error", message: "End date must be after start date." });
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
      setToast({
        severity: "success",
        message: `Created recurring ${amt} ${recurringToken} to ${to.slice(0, 10)}… (${label}).`,
      });
      setFirstDueDate("");
      setRecurringTo("");
      setRecurringAmount("");
      setHasEndDate(false);
      setEndDate("");
    } catch (e) {
      setToast({ severity: "error", message: e instanceof Error ? e.message : "Recurring payment failed." });
    } finally {
      setSubmittingRecurring(false);
    }
  };

  const scheduleBalance = useMemo(() => {
    return balances.find((b) => b.token.symbol === scheduleToken)?.formatted ?? null;
  }, [balances, scheduleToken]);

  const recurringBalance = useMemo(() => {
    return balances.find((b) => b.token.symbol === recurringToken)?.formatted ?? null;
  }, [balances, recurringToken]);

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
      data-tour="payments-page"
      sx={(theme) => ({
        width: "100%",
        minWidth: 0,
        p: { xs: 3, md: 4 },
        display: "flex",
        flexDirection: "column",
        gap: 2.5,
        bgcolor: theme.palette.background.default,
      })}
    >
      <Box sx={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: 0.2 }}>
            Payments
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Create scheduled or recurring payments. Lists refresh every 30s.
          </Typography>
        </Box>
        <Chip
          icon={<BoltIcon />}
          label="Tempo Moderato"
          size="small"
          variant="outlined"
          sx={{ fontWeight: 700 }}
        />
      </Box>

      <Grid container spacing={2.5} alignItems="stretch">
        <Grid size={{ xs: 12, lg: 5 }}>
          <Paper
            data-tour="payments-create"
            variant="outlined"
            sx={(theme) => ({
              p: { xs: 2, md: 2.5 },
              borderRadius: 3,
              height: "100%",
              background:
                theme.palette.mode === "dark"
                  ? `linear-gradient(180deg, ${alpha("#ffffff", 0.05)}, ${alpha("#ffffff", 0.02)})`
                  : `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.06)}, ${alpha("#ffffff", 0.9)})`,
            })}
          >
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
              <Typography sx={{ fontWeight: 800 }}>Create payment</Typography>
              <Tabs
                data-tour="payments-tabs"
                value={tab}
                onChange={(_, v) => setTab(v)}
                variant="scrollable"
                scrollButtons={false}
                sx={{
                  minHeight: 36,
                  "& .MuiTab-root": { minHeight: 36, textTransform: "none", fontWeight: 700, px: 1.25 },
                }}
              >
                <Tab
                  value="schedule"
                  label="One-time"
                  icon={<ScheduleIcon fontSize="small" />}
                  iconPosition="start"
                />
                <Tab
                  value="recurring"
                  label="Recurring"
                  icon={<RecurringIcon fontSize="small" />}
                  iconPosition="start"
                />
              </Tabs>
            </Stack>

            {tab === "schedule" ? (
              <>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Escrowed until the due time. Uses your local timezone.
                </Typography>

                <Stack spacing={1.75}>
                  <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1.5 }}>
                    <TextField
                      label="Due date & time"
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
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <Avatar
                              src={(() => {
                                const tok = findToken(t);
                                return tok ? tokenIconUrl(tok.address) : undefined;
                              })()}
                              sx={{ width: 18, height: 18 }}
                            />
                            <span>{t}</span>
                          </Stack>
                        </MenuItem>
                      ))}
                    </TextField>
                  </Box>

                  <TextField
                    label="Recipient"
                    value={scheduleTo}
                    onChange={(e) => setScheduleTo(e.target.value)}
                    placeholder="0x..."
                    required
                    fullWidth
                    size="small"
                    helperText="Paste an address. Example: 0xabc…"
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
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                            {scheduleToken}
                          </Typography>
                        </InputAdornment>
                      ),
                    }}
                    helperText={scheduleBalance ? `Available: ${Number(scheduleBalance).toLocaleString()} ${scheduleToken}` : " "}
                  />

                  <Box
                    sx={(theme) => ({
                      p: 1.25,
                      borderRadius: 2,
                      border: `1px dashed ${theme.palette.divider}`,
                      bgcolor: alpha(theme.palette.background.paper, 0.3),
                    })}
                  >
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                      Summary
                    </Typography>
                    <Typography sx={{ fontWeight: 800, fontFamily: "monospace" }}>
                      {scheduleAmount || "0"} {scheduleToken} → {scheduleTo ? `${scheduleTo.slice(0, 10)}…` : "0x…"}
                    </Typography>
                  </Box>

                  <Button
                    variant="contained"
                    onClick={submitSchedule}
                    disabled={!canSubmit || submittingSchedule}
                    fullWidth
                    sx={{ borderRadius: 999, py: 1.1, fontWeight: 800 }}
                  >
                    {submittingSchedule ? <CircularProgress size={20} /> : "Schedule payment"}
                  </Button>
                </Stack>
              </>
            ) : (
              <>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Pulled from your wallet at each interval. No escrow.
                </Typography>

                <Stack spacing={1.75}>
                  <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1.5 }}>
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
                      label="First payment date"
                      type="date"
                      value={firstDueDate}
                      onChange={(e) => setFirstDueDate(e.target.value)}
                      inputProps={{ min: today }}
                      size="small"
                      fullWidth
                      InputLabelProps={{ shrink: true }}
                      helperText="Leave empty to start immediately"
                    />
                  </Box>

                  <Divider />

                  <FormControlLabel
                    control={<Checkbox checked={hasEndDate} onChange={(e) => setHasEndDate(e.target.checked)} size="small" />}
                    label="Set end date"
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
                    />
                  ) : null}

                  <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1.5 }}>
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
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                              {recurringToken}
                            </Typography>
                          </InputAdornment>
                        ),
                      }}
                      helperText={recurringBalance ? `Available: ${Number(recurringBalance).toLocaleString()} ${recurringToken}` : " "}
                    />
                  </Box>

                  <TextField
                    label="Recipient"
                    value={recurringTo}
                    onChange={(e) => setRecurringTo(e.target.value)}
                    placeholder="0x..."
                    required
                    fullWidth
                    size="small"
                  />

                  <Box
                    sx={(theme) => ({
                      p: 1.25,
                      borderRadius: 2,
                      border: `1px dashed ${theme.palette.divider}`,
                      bgcolor: alpha(theme.palette.background.paper, 0.3),
                    })}
                  >
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                      Summary
                    </Typography>
                    <Typography sx={{ fontWeight: 800, fontFamily: "monospace" }}>
                      {recurringAmount || "0"} {recurringToken} → {recurringTo ? `${recurringTo.slice(0, 10)}…` : "0x…"}
                    </Typography>
                  </Box>

                  <Button
                    variant="contained"
                    onClick={submitRecurring}
                    disabled={!canSubmit || submittingRecurring}
                    fullWidth
                    sx={{ borderRadius: 999, py: 1.1, fontWeight: 800 }}
                  >
                    {submittingRecurring ? <CircularProgress size={20} /> : "Create recurring payment"}
                  </Button>
                </Stack>
              </>
            )}
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, lg: 7 }}>
          <PaymentsSchedules />
        </Grid>
      </Grid>

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={4500}
        onClose={closeToast}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        {toast ? (
          <Alert onClose={closeToast} severity={toast.severity} variant="filled" sx={{ borderRadius: 2 }}>
            {toast.message}
          </Alert>
        ) : null}
      </Snackbar>
    </Box>
  );
}
