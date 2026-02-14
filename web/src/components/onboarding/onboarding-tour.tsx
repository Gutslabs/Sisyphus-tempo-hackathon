"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Box, Button, Chip, Paper, Portal, Stack, Typography } from "@mui/material";
import { useAccount } from "wagmi";

type ViewId = "dashboard" | "chat" | "payments" | "tx";

type TourStep = {
  id: string;
  title: string;
  body: string;
  target: string; // CSS selector
  view?: ViewId; // which hash-view should be active
};

const STORAGE_DONE = "sisyphus_onboarding_v1_done";
const STORAGE_ACTIVE = "sisyphus_onboarding_active";

function currentView(): ViewId {
  const raw = typeof window === "undefined" ? "dashboard" : window.location.hash.slice(1) || "dashboard";
  const seg = raw.split("/")[0]?.toLowerCase() ?? "dashboard";
  if (seg === "chat" || seg === "payments" || seg === "tx" || seg === "dashboard") return seg;
  return "dashboard";
}

function goView(v: ViewId) {
  window.location.hash = v;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function OnboardingTour() {
  const { isConnected } = useAccount();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const retryTimer = useRef<number | null>(null);
  const raf = useRef<number | null>(null);

  useEffect(() => setMounted(true), []);

  const steps = useMemo<TourStep[]>(() => {
    const list: TourStep[] = [];

    if (!isConnected) {
      list.push({
        id: "wallet-connect",
        title: "Connect your wallet",
        body: "Connect with email (embedded wallet), passkey, or MetaMask to get started. After you connect, we'll grab faucet funds and walk through the app.",
        target: "[data-tour='wallet-connect']",
        view: "dashboard",
      });
      return list;
    }

    list.push({
      id: "wallet-ready",
      title: "Wallet connected",
      body: "You're connected to Tempo Moderato. Next, grab faucet funds for testnet actions.",
      target: "[data-tour='wallet-area']",
      view: "dashboard",
    });
    list.push({
      id: "faucet",
      title: "Get faucet funds",
      body: "Request testnet tokens to try swaps, limit orders, and payments.",
      target: "[data-tour='faucet']",
      view: "dashboard",
    });
    list.push({
      id: "nav-chat",
      title: "AI Chat",
      body: "This is where you tell the agent what you want to do.",
      target: "[data-tour='nav-chat']",
      view: "dashboard",
    });
    list.push({
      id: "chat-input",
      title: "Ask the agent",
      body: "Try: “What can you do on Tempo?” or “Swap 100 AlphaUSD to BetaUSD”.",
      target: "[data-tour='chat-input']",
      view: "chat",
    });
    list.push({
      id: "chat-upload",
      title: "Upload CSV / Excel / PDF",
      body: "You can drag-and-drop files or attach them to let the agent parse recipients and amounts.",
      target: "[data-tour='chat-upload']",
      view: "chat",
    });
    list.push({
      id: "nav-payments",
      title: "Payments page",
      body: "Create scheduled and recurring payments here (without using the chat input).",
      target: "[data-tour='nav-payments']",
      view: "chat",
    });
    list.push({
      id: "payments-create",
      title: "Create a payment",
      body: "Choose one-time (escrowed) or recurring (pulled each interval), then set recipient and amount.",
      target: "[data-tour='payments-create']",
      view: "payments",
    });
    list.push({
      id: "payments-schedules",
      title: "Track your schedules",
      body: "See pending / due schedules and active recurring payments, and execute due ones when ready.",
      target: "[data-tour='payments-schedules']",
      view: "payments",
    });
    list.push({
      id: "nav-tx",
      title: "Transaction history",
      body: "All on-chain actions you run from the app show up here.",
      target: "[data-tour='nav-tx']",
      view: "payments",
    });
    list.push({
      id: "tx-table",
      title: "Explorer links",
      body: "Open any tx in the Tempo explorer for full details.",
      target: "[data-tour='tx-table']",
      view: "tx",
    });
    list.push({
      id: "nav-dashboard",
      title: "Dashboard",
      body: "Balances and open limit orders live here.",
      target: "[data-tour='nav-dashboard']",
      view: "tx",
    });
    list.push({
      id: "dashboard-orders",
      title: "Manage orders",
      body: "See your open bids/asks and cancel them anytime.",
      target: "[data-tour='dashboard-orders']",
      view: "dashboard",
    });

    return list;
  }, [isConnected]);

  // Decide whether to auto-start.
  useEffect(() => {
    if (!mounted) return;
    if (typeof window === "undefined") return;

    const force = new URL(window.location.href).searchParams.get("tour") === "1";
    const done = window.localStorage.getItem(STORAGE_DONE) === "1";

    // Start once for new users, or always when forced via ?tour=1.
    if (force || !done) {
      setOpen(true);
      setIdx(0);
      window.localStorage.setItem(STORAGE_ACTIVE, "1");
      // Clean up the query param so refreshes don't keep restarting.
      if (force) {
        const url = new URL(window.location.href);
        url.searchParams.delete("tour");
        window.history.replaceState({}, "", url.toString());
      }
    }
  }, [mounted]);

  // Keep the sidebar from auto-collapsing while the tour is active.
  useEffect(() => {
    if (!mounted) return;
    if (!open) {
      window.localStorage.removeItem(STORAGE_ACTIVE);
      return;
    }
    window.localStorage.setItem(STORAGE_ACTIVE, "1");
  }, [mounted, open]);

  const step = steps[idx] ?? null;

  const close = (markDone: boolean) => {
    setOpen(false);
    setTargetRect(null);
    if (markDone && typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_DONE, "1");
    }
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_ACTIVE);
    }
  };

  // Resolve + track target position
  useEffect(() => {
    if (!mounted || !open || !step) return;

    const sync = async () => {
      if (step.view && currentView() !== step.view) {
        goView(step.view);
      }

      let tries = 0;
      const tryFind = () => {
        tries += 1;
        const el = document.querySelector(step.target) as HTMLElement | null;
        if (!el) {
          if (tries < 25) {
            retryTimer.current = window.setTimeout(tryFind, 120);
            return;
          }
          // Skip steps that can't be anchored (e.g. responsive layouts).
          setIdx((v) => Math.min(v + 1, steps.length - 1));
          return;
        }

        try {
          el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
        } catch {
          // ignore
        }

        const update = () => {
          const r = el.getBoundingClientRect();
          setTargetRect(r);
          raf.current = window.requestAnimationFrame(update);
        };

        if (raf.current) window.cancelAnimationFrame(raf.current);
        update();
      };

      tryFind();
    };

    sync();

    return () => {
      if (retryTimer.current) window.clearTimeout(retryTimer.current);
      retryTimer.current = null;
      if (raf.current) window.cancelAnimationFrame(raf.current);
      raf.current = null;
    };
  }, [mounted, open, step, steps.length]);

  if (!mounted || !open || !step || !targetRect) return null;

  const pad = 10;
  const hl = {
    top: clamp(targetRect.top - pad, 8, window.innerHeight - 8),
    left: clamp(targetRect.left - pad, 8, window.innerWidth - 8),
    width: clamp(targetRect.width + pad * 2, 24, window.innerWidth - 16),
    height: clamp(targetRect.height + pad * 2, 24, window.innerHeight - 16),
  };

  const cardW = 360;
  const preferBelow = hl.top + hl.height + 16 + 220 < window.innerHeight;
  const rawTop = preferBelow ? hl.top + hl.height + 14 : hl.top - 14 - 220;
  const rawLeft = hl.left + Math.min(hl.width - 40, 24);
  const cardTop = clamp(rawTop, 12, window.innerHeight - 12 - 220);
  const cardLeft = clamp(rawLeft, 12, window.innerWidth - 12 - cardW);

  const isLast = idx >= steps.length - 1;
  const canBack = idx > 0;

  return (
    <Portal>
      {/* Highlight with outside dim (click-through) */}
      <Box
        sx={{
          position: "fixed",
          top: hl.top,
          left: hl.left,
          width: hl.width,
          height: hl.height,
          borderRadius: 2,
          zIndex: 1400,
          pointerEvents: "none",
          boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
          outline: "1px solid rgba(255,255,255,0.18)",
          background: "rgba(255,255,255,0.03)",
          backdropFilter: "blur(1px)",
        }}
      />

      {/* Tooltip card */}
      <Box
        sx={{
          position: "fixed",
          top: cardTop,
          left: cardLeft,
          width: cardW,
          zIndex: 1500,
          pointerEvents: "auto",
        }}
      >
        <Paper
          elevation={10}
          sx={{
            borderRadius: 3,
            overflow: "hidden",
            border: "1px solid",
            borderColor: "divider",
            backgroundImage: "none",
          }}
        >
          <Box sx={{ p: 2.25, pb: 1.25 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
              <Typography sx={{ fontWeight: 900, letterSpacing: 0.2 }}>{step.title}</Typography>
              <Chip size="small" label={`${idx + 1}/${steps.length}`} variant="outlined" />
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {step.body}
            </Typography>
          </Box>

          <Box sx={{ px: 2.25, pb: 2.25 }}>
            <Stack direction="row" spacing={1} justifyContent="space-between">
              <Button
                variant="text"
                color="inherit"
                onClick={() => close(true)}
                sx={{ fontWeight: 800 }}
              >
                Skip
              </Button>
              <Stack direction="row" spacing={1}>
                <Button
                  variant="outlined"
                  disabled={!canBack}
                  onClick={() => setIdx((v) => Math.max(0, v - 1))}
                  sx={{ fontWeight: 900, borderRadius: 999 }}
                >
                  Back
                </Button>
                <Button
                  variant="contained"
                  onClick={() => {
                    if (isLast) close(true);
                    else setIdx((v) => Math.min(steps.length - 1, v + 1));
                  }}
                  sx={{ fontWeight: 900, borderRadius: 999 }}
                >
                  {isLast ? "Done" : "Next"}
                </Button>
              </Stack>
            </Stack>
          </Box>
        </Paper>
      </Box>
    </Portal>
  );
}
