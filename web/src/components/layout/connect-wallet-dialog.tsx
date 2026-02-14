"use client";

import {
    Dialog,
    DialogTitle,
    DialogContent,
    List,
    ListItem,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Typography,
    Box,
    IconButton,
    useTheme,
    alpha,
} from "@mui/material";
import {
    Email as EmailIcon,
    Fingerprint as FingerprintIcon,
    Wallet as WalletIcon,
    Close as CloseIcon,
} from "@mui/icons-material";
import { usePrivy } from "@privy-io/react-auth";
import { useConnect } from "wagmi";
import { useMemo } from "react";

interface ConnectWalletDialogProps {
    open: boolean;
    onClose: () => void;
}

export function ConnectWalletDialog({ open, onClose }: ConnectWalletDialogProps) {
    const theme = useTheme();
    const { ready, authenticated, login, linkEmail } = usePrivy();
    const { connectors, connect, isPending } = useConnect();
    const webAuthnConnector = useMemo(() => connectors.find((c) => c.id === "webAuthn"), [connectors]);
    const injectedConnector = useMemo(() => connectors.find((c) => c.id === "injected"), [connectors]);

    const handlePasskeyLogin = () => {
        if (!webAuthnConnector) return;
        connect({ connector: webAuthnConnector });
        onClose();
    };

    const handlePasskeySignup = () => {
        if (!webAuthnConnector) return;
        // @ts-expect-error - wagmi/tempo connector supports capabilities for passkey registration
        connect({ connector: webAuthnConnector, capabilities: { type: "sign-up", label: "Tempo User" } });
        onClose();
    };

    const handleEmail = () => {
        if (!ready) return;
        if (authenticated) {
            linkEmail();
        } else {
            login({ loginMethods: ["email"] });
        }
        onClose();
    };
    const handleWallet = () => {
        if (!injectedConnector) return;
        connect({ connector: injectedConnector });
        onClose();
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullWidth
            maxWidth="xs"
            PaperProps={{
                sx: {
                    borderRadius: 4,
                    backgroundImage: "none",
                    bgcolor: theme.palette.background.paper,
                    boxShadow: theme.shadows[20],
                    overflow: "hidden"
                }
            }}
        >
            <Box sx={{ p: 2, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <DialogTitle sx={{ p: 0, fontWeight: 700, fontSize: "1.1rem" }}>
                    Log in or Sign up
                </DialogTitle>
                <IconButton onClick={onClose} size="small">
                    <CloseIcon fontSize="small" />
                </IconButton>
            </Box>

            <DialogContent sx={{ p: 0 }}>
                <Box sx={{ px: 3, pb: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                        Sign in with passkey or email, or connect an external wallet.
                    </Typography>
                </Box>

                <List sx={{ px: 2, pb: 3 }}>
                    <ListItem disablePadding sx={{ mb: 1.5 }}>
                        <ListItemButton
                            onClick={handlePasskeySignup}
                            disabled={!webAuthnConnector || isPending}
                            sx={{
                                borderRadius: 3,
                                border: `1px solid ${theme.palette.divider}`,
                                py: 1.5,
                                transition: "all 0.2s",
                                "&:hover": {
                                    borderColor: theme.palette.primary.main,
                                    bgcolor: alpha(theme.palette.primary.main, 0.04),
                                    transform: "translateY(-1px)",
                                    boxShadow: 2
                                }
                            }}
                        >
                            <ListItemIcon sx={{ minWidth: 40, color: "primary.main" }}>
                                <FingerprintIcon />
                            </ListItemIcon>
                            <ListItemText
                                primary="Create Passkey"
                                secondary="Biometric / security key"
                                primaryTypographyProps={{ fontWeight: 600 }}
                            />
                        </ListItemButton>
                    </ListItem>

                    <ListItem disablePadding sx={{ mb: 1.5 }}>
                        <ListItemButton
                            onClick={handlePasskeyLogin}
                            disabled={!webAuthnConnector || isPending}
                            sx={{
                                borderRadius: 3,
                                border: `1px solid ${theme.palette.divider}`,
                                py: 1.5,
                                transition: "all 0.2s",
                                "&:hover": {
                                    borderColor: theme.palette.primary.main,
                                    bgcolor: alpha(theme.palette.primary.main, 0.04),
                                    transform: "translateY(-1px)",
                                    boxShadow: 2
                                }
                            }}
                        >
                            <ListItemIcon sx={{ minWidth: 40, color: "primary.main" }}>
                                <FingerprintIcon />
                            </ListItemIcon>
                            <ListItemText
                                primary="Use Passkey"
                                secondary="Sign in with existing passkey"
                                primaryTypographyProps={{ fontWeight: 600 }}
                            />
                        </ListItemButton>
                    </ListItem>

                    <ListItem disablePadding sx={{ mb: 1.5 }}>
                        <ListItemButton
                            onClick={handleEmail}
                            sx={{
                                borderRadius: 3,
                                border: `1px solid ${theme.palette.divider}`,
                                py: 1.5,
                                transition: "all 0.2s",
                                "&:hover": {
                                    borderColor: theme.palette.primary.main,
                                    bgcolor: alpha(theme.palette.primary.main, 0.04),
                                    transform: "translateY(-1px)",
                                    boxShadow: 2
                                }
                            }}
                        >
                            <ListItemIcon sx={{ minWidth: 40, color: "primary.main" }}>
                                <EmailIcon />
                            </ListItemIcon>
                            <ListItemText
                                primary={authenticated ? "Link Email" : "Continue with Email"}
                                secondary={authenticated ? "Add email to your account" : "One-time code"}
                                primaryTypographyProps={{ fontWeight: 600 }}
                            />
                        </ListItemButton>
                    </ListItem>

                    <ListItem disablePadding>
                        <ListItemButton
                            onClick={handleWallet}
                            disabled={!injectedConnector || isPending}
                            sx={{
                                borderRadius: 3,
                                bgcolor: theme.palette.mode === "dark" ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)",
                                py: 1.5,
                                transition: "all 0.2s",
                                "&:hover": {
                                    bgcolor: theme.palette.mode === "dark" ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.08)",
                                    transform: "translateY(-1px)",
                                }
                            }}
                        >
                            <ListItemIcon sx={{ minWidth: 40, color: theme.palette.text.primary }}>
                                <WalletIcon />
                            </ListItemIcon>
                            <ListItemText
                                primary="Connect Wallet"
                                secondary="MetaMask, Coinbase, etc."
                                primaryTypographyProps={{ fontWeight: 600 }}
                            />
                        </ListItemButton>
                    </ListItem>
                </List>
            </DialogContent>

            <Box sx={{ p: 2, bgcolor: alpha(theme.palette.primary.main, 0.03), borderTop: `1px solid ${theme.palette.divider}`, textAlign: "center" }}>
                <Typography variant="caption" color="text.secondary">
                    Powered by <strong>Tempo</strong>
                </Typography>
            </Box>
        </Dialog >
    );
}
