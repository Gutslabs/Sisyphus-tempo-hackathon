"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  Event as ScheduledIcon,
  Repeat as RecurringIcon,
  OpenInNew as ExternalLinkIcon,
  PlayArrow as PlayIcon,
  ExpandMore as ExpandMoreIcon,
  Refresh as RefreshIcon,
} from "@mui/icons-material";
import { explorerTxUrl } from "@/lib/tempo";
import { shortenAddress } from "@/lib/utils";
import { useTempoBalances, useTempoScheduler } from "@/hooks/use-tempo";
import { recordTransaction } from "@/lib/record-tx";
import type { OneTimeScheduleItem, RecurringScheduleItem } from "@/lib/schedule-types";
import { alpha } from "@mui/material";

export function PaymentsSchedules() {
  const { address, refresh: refreshBalances } = useTempoBalances();
  const { executeScheduled, scheduling: schedulerPending } = useTempoScheduler();

  const [oneTimeSchedules, setOneTimeSchedules] = useState<OneTimeScheduleItem[]>([]);
  const [recurringSchedules, setRecurringSchedules] = useState<RecurringScheduleItem[]>([]);
  const [schedulesLoading, setSchedulesLoading] = useState(false);
  const [executingScheduleId, setExecutingScheduleId] = useState<number | null>(null);

  const [nowSeconds, setNowSeconds] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const t = setInterval(() => setNowSeconds(Math.floor(Date.now() / 1000)), 15_000);
    return () => clearInterval(t);
  }, []);

  const [scheduledFilter, setScheduledFilter] = useState<"pending" | "all" | "done">("pending");
  const [recurringFilter, setRecurringFilter] = useState<"active" | "all">("active");

  const fetchSchedules = useCallback(async (wallet: string) => {
    setSchedulesLoading(true);
    try {
      const res = await fetch(`/api/tempo/schedules?wallet=${encodeURIComponent(wallet)}`);
      const data = await res.json();
      if (data.oneTime) setOneTimeSchedules(data.oneTime);
      else setOneTimeSchedules([]);
      if (data.recurring) setRecurringSchedules(data.recurring);
      else setRecurringSchedules([]);
    } catch {
      setOneTimeSchedules([]);
      setRecurringSchedules([]);
    } finally {
      setSchedulesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!address) {
      setOneTimeSchedules([]);
      setRecurringSchedules([]);
      return;
    }
    fetchSchedules(address);
    const interval = setInterval(() => fetchSchedules(address), 30_000);
    return () => clearInterval(interval);
  }, [address, fetchSchedules]);

  const scheduledVisible = useMemo(() => {
    if (scheduledFilter === "all") return oneTimeSchedules;
    if (scheduledFilter === "done") return oneTimeSchedules.filter((s) => s.executed || s.cancelled);
    return oneTimeSchedules.filter((s) => !s.executed && !s.cancelled);
  }, [oneTimeSchedules, scheduledFilter]);

  const recurringVisible = useMemo(() => {
    if (recurringFilter === "all") return recurringSchedules;
    return recurringSchedules.filter((s) => !s.cancelled);
  }, [recurringSchedules, recurringFilter]);

  const pendingCount = oneTimeSchedules.filter((s) => !s.executed && !s.cancelled).length;
  const activeRecurringCount = recurringSchedules.filter((s) => !s.cancelled).length;

  const relativeTime = (unix: number) => {
    const diff = unix - nowSeconds;
    const abs = Math.abs(diff);
    const mins = Math.round(abs / 60);
    const hrs = Math.round(abs / 3600);
    const days = Math.round(abs / 86400);
    const label = abs < 3600 ? `${mins}m` : abs < 86400 ? `${hrs}h` : `${days}d`;
    return diff >= 0 ? `in ${label}` : `${label} ago`;
  };

  if (!address) return null;

  return (
    <>
      <Paper
        data-tour="payments-schedules"
        variant="outlined"
        sx={(theme) => ({
          borderRadius: 3,
          overflow: "hidden",
          bgcolor: theme.palette.background.paper,
        })}
      >
        <Box
          sx={(theme) => ({
            px: { xs: 2, md: 2.5 },
            py: { xs: 1.5, md: 2 },
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 2,
            borderBottom: `1px solid ${theme.palette.divider}`,
            background:
              theme.palette.mode === "dark"
                ? `linear-gradient(180deg, ${alpha("#ffffff", 0.05)}, ${alpha("#ffffff", 0.0)})`
                : `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.04)}, transparent)`,
          })}
        >
          <Box>
            <Typography sx={{ fontWeight: 900 }}>Your payment schedules</Typography>
            <Typography variant="caption" color="text.secondary">
              {pendingCount} scheduled pending, {activeRecurringCount} recurring active
            </Typography>
          </Box>
          <Tooltip title="Refresh">
            <IconButton
              size="small"
              onClick={() => address && fetchSchedules(address)}
              disabled={schedulesLoading || !address}
            >
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>

        <Accordion defaultExpanded disableGutters elevation={0} sx={{ "&:before": { display: "none" } }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ flex: 1, minWidth: 0 }}>
              <ScheduledIcon fontSize="small" color="action" />
              <Typography sx={{ fontWeight: 900 }}>Scheduled</Typography>
              <Chip label={`${pendingCount} pending`} size="small" variant="outlined" />
            </Stack>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0 }}>
            <Stack direction="row" spacing={1} sx={{ mb: 1.5, flexWrap: "wrap" }}>
              <Chip
                label="Pending"
                size="small"
                color={scheduledFilter === "pending" ? "primary" : "default"}
                variant={scheduledFilter === "pending" ? "filled" : "outlined"}
                onClick={() => setScheduledFilter("pending")}
              />
              <Chip
                label="Done"
                size="small"
                color={scheduledFilter === "done" ? "primary" : "default"}
                variant={scheduledFilter === "done" ? "filled" : "outlined"}
                onClick={() => setScheduledFilter("done")}
              />
              <Chip
                label="All"
                size="small"
                color={scheduledFilter === "all" ? "primary" : "default"}
                variant={scheduledFilter === "all" ? "filled" : "outlined"}
                onClick={() => setScheduledFilter("all")}
              />
            </Stack>

            {schedulesLoading && oneTimeSchedules.length === 0 ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
                <CircularProgress size={22} />
              </Box>
            ) : scheduledVisible.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: "center" }}>
                Nothing here yet.
              </Typography>
            ) : (
              <Stack spacing={1.25}>
                {scheduledVisible.map((s) => {
                  const isPending = !s.executed && !s.cancelled;
                  const isDue = isPending && s.executeAt <= nowSeconds;
                  return (
                    <Paper
                      key={s.id}
                      variant="outlined"
                      sx={(theme) => ({
                        p: 1.5,
                        borderRadius: 2.25,
                        opacity: s.executed || s.cancelled ? 0.6 : 1,
                        borderColor: isDue ? theme.palette.success.main : undefined,
                        bgcolor: isDue ? alpha(theme.palette.success.main, 0.06) : undefined,
                      })}
                    >
                      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1.5 }}>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography sx={{ fontWeight: 900, fontFamily: "monospace" }} noWrap>
                            {s.amount} {s.tokenSymbol} → {shortenAddress(s.recipient)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                            Due: {new Date(s.executeAt * 1000).toLocaleString()} ({relativeTime(s.executeAt)})
                          </Typography>
                        </Box>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Chip
                            label={s.executed ? "Executed" : s.cancelled ? "Cancelled" : isDue ? "Due now" : "Pending"}
                            size="small"
                            color={s.executed ? "success" : s.cancelled ? "default" : isDue ? "success" : "primary"}
                            sx={{ height: 22, fontSize: "0.7rem", fontWeight: 800 }}
                          />
                          {isDue ? (
                            <Button
                              size="small"
                              variant="contained"
                              color="success"
                              startIcon={<PlayIcon sx={{ fontSize: 14 }} />}
                              onClick={async () => {
                                setExecutingScheduleId(s.id);
                                try {
                                  const result = await executeScheduled(s.id);
                                  if (result?.hash) {
                                    recordTransaction({
                                      wallet_address: address,
                                      tx_hash: result.hash,
                                      type: "execute_scheduled",
                                    });
                                  }
                                  fetchSchedules(address);
                                  refreshBalances();
                                } finally {
                                  setExecutingScheduleId(null);
                                }
                              }}
                              disabled={schedulerPending || executingScheduleId === s.id}
                              sx={{ borderRadius: 999, fontWeight: 900 }}
                            >
                              Execute
                            </Button>
                          ) : null}
                          <Tooltip title="Open tx">
                            <span>
                              <IconButton
                                size="small"
                                href={explorerTxUrl(s.executionTxHash ?? s.creationTxHash ?? "")}
                                target="_blank"
                                rel="noopener noreferrer"
                                disabled={!s.executionTxHash && !s.creationTxHash}
                              >
                                <ExternalLinkIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </Stack>
                      </Box>
                    </Paper>
                  );
                })}
              </Stack>
            )}
          </AccordionDetails>
        </Accordion>

        <Divider />

        <Accordion defaultExpanded disableGutters elevation={0} sx={{ "&:before": { display: "none" } }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ flex: 1, minWidth: 0 }}>
              <RecurringIcon fontSize="small" color="action" />
              <Typography sx={{ fontWeight: 900 }}>Recurring</Typography>
              <Chip label={`${activeRecurringCount} active`} size="small" variant="outlined" />
            </Stack>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0 }}>
            <Stack direction="row" spacing={1} sx={{ mb: 1.5, flexWrap: "wrap" }}>
              <Chip
                label="Active"
                size="small"
                color={recurringFilter === "active" ? "primary" : "default"}
                variant={recurringFilter === "active" ? "filled" : "outlined"}
                onClick={() => setRecurringFilter("active")}
              />
              <Chip
                label="All"
                size="small"
                color={recurringFilter === "all" ? "primary" : "default"}
                variant={recurringFilter === "all" ? "filled" : "outlined"}
                onClick={() => setRecurringFilter("all")}
              />
            </Stack>

            {schedulesLoading && recurringSchedules.length === 0 ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
                <CircularProgress size={22} />
              </Box>
            ) : recurringVisible.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: "center" }}>
                Nothing here yet.
              </Typography>
            ) : (
              <Stack spacing={1.25}>
                {recurringVisible.map((s) => (
                  <Paper key={s.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2.25, opacity: s.cancelled ? 0.6 : 1 }}>
                    <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1.5 }}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 900, fontFamily: "monospace" }} noWrap>
                          {s.amount} {s.tokenSymbol} → {shortenAddress(s.recipient)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                          Next: {new Date(s.nextDueTime * 1000).toLocaleString()} ({relativeTime(s.nextDueTime)})
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Chip
                          label={s.cancelled ? "Cancelled" : "Active"}
                          size="small"
                          color={s.cancelled ? "default" : "primary"}
                          sx={{ height: 22, fontSize: "0.7rem", fontWeight: 800 }}
                        />
                        <Tooltip title="Open tx">
                          <span>
                            <IconButton
                              size="small"
                              href={explorerTxUrl(s.executionTxHashes[s.executionTxHashes.length - 1] ?? s.creationTxHash ?? "")}
                              target="_blank"
                              rel="noopener noreferrer"
                              disabled={s.executionTxHashes.length === 0 && !s.creationTxHash}
                            >
                              <ExternalLinkIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Stack>
                    </Box>
                  </Paper>
                ))}
              </Stack>
            )}
          </AccordionDetails>
        </Accordion>
      </Paper>
    </>
  );
}
