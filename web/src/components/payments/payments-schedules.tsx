"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
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
} from "@mui/icons-material";
import { explorerTxUrl } from "@/lib/tempo";
import { shortenAddress } from "@/lib/utils";
import { useTempoBalances, useTempoScheduler } from "@/hooks/use-tempo";
import { recordTransaction } from "@/lib/record-tx";
import type { OneTimeScheduleItem, RecurringScheduleItem } from "@/lib/schedule-types";

export function PaymentsSchedules() {
  const { address, refresh: refreshBalances } = useTempoBalances();
  const { executeScheduled, scheduling: schedulerPending } = useTempoScheduler();

  const [oneTimeSchedules, setOneTimeSchedules] = useState<OneTimeScheduleItem[]>([]);
  const [recurringSchedules, setRecurringSchedules] = useState<RecurringScheduleItem[]>([]);
  const [schedulesLoading, setSchedulesLoading] = useState(false);
  const [executingScheduleId, setExecutingScheduleId] = useState<number | null>(null);

  const nowSeconds = Math.floor(Date.now() / 1000);

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

  if (!address) return null;

  return (
    <>
      {/* Scheduled Payments */}
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
          <ScheduledIcon color="action" fontSize="small" />
          <Typography
            variant="subtitle2"
            sx={{
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 1,
              color: "text.secondary",
            }}
          >
            Scheduled Payments
          </Typography>
        </Box>

        {schedulesLoading && oneTimeSchedules.length === 0 ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress size={24} />
          </Box>
        ) : oneTimeSchedules.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
            No one-time scheduled payments.
          </Typography>
        ) : (
          <Stack spacing={2}>
            {oneTimeSchedules.map((s) => (
              <Paper
                key={s.id}
                variant="outlined"
                sx={{ p: 2, borderRadius: 2, opacity: s.executed || s.cancelled ? 0.6 : 1 }}
              >
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    mb: 1,
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: "monospace" }}>
                    {s.amount} {s.tokenSymbol} → {shortenAddress(s.recipient)}
                  </Typography>
                  <Chip
                    label={s.executed ? "Executed" : s.cancelled ? "Cancelled" : "Pending"}
                    size="small"
                    color={s.executed ? "success" : s.cancelled ? "default" : "primary"}
                    sx={{ height: 20, fontSize: "0.65rem", fontWeight: 700 }}
                  />
                </Box>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Typography variant="caption" color="text.secondary">
                    {s.executed || s.cancelled ? "Was: " : "Due: "}
                    {new Date(s.executeAt * 1000).toLocaleString()}
                  </Typography>
                  <Box sx={{ display: "flex", gap: 1 }}>
                    {!s.executed && !s.cancelled && s.executeAt <= nowSeconds && (
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
                          } catch {
                            // ignore; user can retry
                          } finally {
                            setExecutingScheduleId(null);
                          }
                        }}
                        disabled={schedulerPending || executingScheduleId === s.id}
                        sx={{ py: 0, px: 1, fontSize: "0.65rem" }}
                      >
                        Execute
                      </Button>
                    )}
                    {s.creationTxHash ? (
                      <Tooltip title="View creation tx">
                        <IconButton
                          size="small"
                          href={explorerTxUrl(s.creationTxHash)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLinkIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Tooltip>
                    ) : null}
                    {s.executionTxHash ? (
                      <Tooltip title="View execution tx">
                        <IconButton
                          size="small"
                          href={explorerTxUrl(s.executionTxHash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          color="success"
                        >
                          <ExternalLinkIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Tooltip>
                    ) : null}
                  </Box>
                </Box>
              </Paper>
            ))}
          </Stack>
        )}
      </Paper>

      {/* Recurring Payments */}
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
          <RecurringIcon color="action" fontSize="small" />
          <Typography
            variant="subtitle2"
            sx={{
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 1,
              color: "text.secondary",
            }}
          >
            Recurring Payments
          </Typography>
        </Box>

        {schedulesLoading && recurringSchedules.length === 0 ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress size={24} />
          </Box>
        ) : recurringSchedules.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
            No recurring payments.
          </Typography>
        ) : (
          <Stack spacing={2}>
            {recurringSchedules.map((s) => (
              <Paper key={s.id} variant="outlined" sx={{ p: 2, borderRadius: 2, opacity: s.cancelled ? 0.6 : 1 }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: "monospace" }}>
                    {s.amount} {s.tokenSymbol} → {shortenAddress(s.recipient)}
                  </Typography>
                  <Chip
                    label={s.cancelled ? "Cancelled" : "Active"}
                    size="small"
                    color={s.cancelled ? "default" : "primary"}
                    sx={{ height: 20, fontSize: "0.65rem", fontWeight: 700 }}
                  />
                </Box>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Typography variant="caption" color="text.secondary">
                    Next: {new Date(s.nextDueTime * 1000).toLocaleString()}
                    {s.intervalSeconds >= 86400 ? (
                      <Box component="span" sx={{ ml: 1, fontWeight: 600 }}>
                        (every{" "}
                        {s.intervalSeconds >= 2592000
                          ? `${Math.round(s.intervalSeconds / 2592000)}mo`
                          : s.intervalSeconds >= 604800
                            ? `${Math.round(s.intervalSeconds / 604800)}wk`
                            : `${Math.round(s.intervalSeconds / 86400)}d`}
                        )
                      </Box>
                    ) : null}
                  </Typography>
                  <Box sx={{ display: "flex", gap: 1 }}>
                    {s.creationTxHash ? (
                      <Tooltip title="View creation tx">
                        <IconButton
                          size="small"
                          href={explorerTxUrl(s.creationTxHash)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLinkIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Tooltip>
                    ) : null}
                    {s.executionTxHashes.length > 0 ? (
                      <Tooltip title={`Last execution (${s.executionTxHashes.length} total)`}>
                        <IconButton
                          size="small"
                          href={explorerTxUrl(s.executionTxHashes[s.executionTxHashes.length - 1]!)}
                          target="_blank"
                          rel="noopener noreferrer"
                          color="success"
                        >
                          <ExternalLinkIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Tooltip>
                    ) : null}
                  </Box>
                </Box>
              </Paper>
            ))}
          </Stack>
        )}
      </Paper>
    </>
  );
}
