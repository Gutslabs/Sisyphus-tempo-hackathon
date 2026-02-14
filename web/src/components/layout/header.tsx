"use client";

import { useAccount, useChainId, useDisconnect, useSwitchChain } from "wagmi";
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  Chip,
  IconButton,
  Tooltip,
} from "@mui/material";
import {
  Wallet as WalletIcon,
  Logout as LogoutIcon,
  OpenInNew as ExternalLinkIcon,
  WaterDrop as FaucetIcon,
  Menu as MenuIcon,
} from "@mui/icons-material";
import { useState, useEffect } from "react";
import { shortenAddress } from "@/lib/utils";
import { useTempoFaucet, useTempoBalances } from "@/hooks/use-tempo";
import { ConnectWalletDialog } from "./connect-wallet-dialog";
import { tempoModerato } from "viem/chains";

const TEMPO_EXPLORER = "https://explore.moderato.tempo.xyz";

interface HeaderProps {
  onMenuClick: () => void;
}

import { usePrivy } from "@privy-io/react-auth";

export function Header({ onMenuClick }: HeaderProps) {
  const { address, isConnected, connector } = useAccount();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { logout } = usePrivy();
  const { requestFunds, funding: faucetLoading } = useTempoFaucet();
  const { refresh: refreshBalances } = useTempoBalances();

  const [connectOpen, setConnectOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [switchAttempted, setSwitchAttempted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Best-effort: when a user connects an external wallet on a different network,
  // prompt them to switch to Tempo Moderato once per connection session.
  useEffect(() => {
    if (!mounted) return;
    if (!isConnected) {
      setSwitchAttempted(false);
      return;
    }
    if (chainId === tempoModerato.id) {
      setSwitchAttempted(false);
      return;
    }
    if (switchAttempted) return;
    setSwitchAttempted(true);
    try {
      switchChain({ chainId: tempoModerato.id });
    } catch {
      // ignore (user rejected / connector doesn't support switching)
    }
  }, [mounted, isConnected, chainId, switchAttempted, switchChain]);

  const isPasskeyWallet = connector?.name === "WebAuthn" || connector?.id === "webAuthn";

  const handleLogout = async () => {
    disconnect();
    await logout();
    // Force reload to clear any lingering state if needed, though logout() usually handles it
    // window.location.reload(); 
  };

  return (
    <AppBar position="static" color="inherit" elevation={0}>
      <Toolbar
        sx={{
          justifyContent: "space-between",
          minHeight: 64,
          px: { xs: 2, md: 3 },
        }}
      >
        {/* Mobile menu button */}
        <Box sx={{ display: { xs: "flex", md: "none" }, alignItems: "center", mr: 1 }}>
          <IconButton
            edge="start"
            color="inherit"
            aria-label="open navigation"
            onClick={onMenuClick}
            size="small"
          >
            <MenuIcon />
          </IconButton>
        </Box>
        {/* Wallet */}
        <Box
          data-tour="wallet-area"
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: { xs: 1, sm: 1.5, md: 2 },
            ml: "auto",
            flexWrap: "wrap",
          }}
        >
          {!mounted ? null : !isConnected ? (
            <Box>
              <Button
                data-tour="wallet-connect"
                variant="contained"
                startIcon={<WalletIcon />}
                onClick={() => setConnectOpen(true)}
              >
                Connect
              </Button>
              <ConnectWalletDialog open={connectOpen} onClose={() => setConnectOpen(false)} />
            </Box>
          ) : (
            address && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <Chip
                  label={isPasskeyWallet ? "Passkey" : "External"}
                  size="small"
                  variant="outlined"
                  sx={{ fontSize: "0.65rem", height: 20 }}
                />
                <Button
                  data-tour="faucet"
                  variant="contained"
                  size="small"
                  startIcon={<FaucetIcon sx={{ fontSize: 16 }} />}
                  onClick={async () => {
                    try {
                      await requestFunds();
                      setTimeout(() => refreshBalances(), 3000);
                    } catch (err) {
                      console.error(err);
                    }
                  }}
                  disabled={faucetLoading}
                  sx={{ fontSize: "0.75rem", py: 0.5 }}
                >
                  {faucetLoading ? "Funding..." : "Get faucet"}
                </Button>
                <Tooltip title="View on Explorer">
                  <Button
                    href={`${TEMPO_EXPLORER}/address/${address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="outlined"
                    color="inherit"
                    size="small"
                    startIcon={<Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "success.main" }} />}
                    endIcon={<ExternalLinkIcon sx={{ fontSize: 12 }} />}
                    sx={{ fontFamily: "monospace", fontSize: "0.75rem", borderRadius: 10 }}
                  >
                    {shortenAddress(address)}
                  </Button>
                </Tooltip>
                <IconButton size="small" onClick={handleLogout} color="inherit">
                  <LogoutIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Box>
            )
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
}
