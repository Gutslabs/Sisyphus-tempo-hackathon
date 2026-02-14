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
    Divider,
    Box,
    IconButton,
    // Button, // Unused
    useTheme,
    alpha,
} from "@mui/material";
import {
    Fingerprint as FingerprintIcon,
    Wallet as WalletIcon,
    Close as CloseIcon,
    // Login as LoginIcon, // Unused
    PersonAdd as PersonAddIcon,
} from "@mui/icons-material";
import { useConnect } from "wagmi";
import { usePrivy } from "@privy-io/react-auth";
import { useMemo } from "react";

interface ConnectWalletDialogProps {
    open: boolean;
    onClose: () => void;
}

export function ConnectWalletDialog({ open, onClose }: ConnectWalletDialogProps) {
    const theme = useTheme();
    const { connectors, connect } = useConnect();
    const { login } = usePrivy();

    // Filter connectors
    const webAuthnConnector = useMemo(() => connectors.find((c) => c.id === "webAuthn"), [connectors]);
    // const injectedConnector = useMemo(() => connectors.find((c) => c.id === "injected"), [connectors]); // Unused with Privy

    // Handler for connecting via Wagmi (Passkeys)
    const handleWagmiConnect = (connector: typeof webAuthnConnector, register: boolean = false) => {
        if (!connector) return;

        // For registration (Sign Up), we need to pass capabilities with type: 'sign-up'.
        // For login, we pass nothing (assertion mode).
        const connectParams = {
            connector,
            ...(register ? {
                capabilities: {
                    type: "sign-up",
                    label: "Tempo User", // Optional label
                }
            } : {})
        };

        // @ts-expect-error - capabilities types might differ slightly in wagmi/core vs react
        connect(connectParams, {
            onSuccess: (data) => console.log("Connect Success:", data),
            onError: (error) => console.error("Connect Error:", error),
        });
        onClose();
    };

    // Handler for Privy (Connect Wallet)
    const handlePrivyLogin = () => {
        login();
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
                        Use your face, fingerprint, or security key to access your account securely.
                    </Typography>
                </Box>

                <List sx={{ px: 2, pb: 3 }}>
                    {/* Sign Up with Passkey */}
                    <ListItem disablePadding sx={{ mb: 1.5 }}>
                        <ListItemButton
                            onClick={() => handleWagmiConnect(webAuthnConnector, true)}
                            disabled={!webAuthnConnector}
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
                                <PersonAddIcon />
                            </ListItemIcon>
                            <ListItemText
                                primary="Sign Up with Passkey"
                                secondary="Create a new account"
                                primaryTypographyProps={{ fontWeight: 600 }}
                            />
                        </ListItemButton>
                    </ListItem>

                    {/* Sign In with Passkey */}
                    <ListItem disablePadding sx={{ mb: 2 }}>
                        <ListItemButton
                            onClick={() => handleWagmiConnect(webAuthnConnector, false)}
                            disabled={!webAuthnConnector}
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
                                primary="Log In with Passkey"
                                secondary="Use existing passkey"
                                primaryTypographyProps={{ fontWeight: 600 }}
                            />
                        </ListItemButton>
                    </ListItem>

                    <Divider sx={{ my: 2 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ px: 1 }}>
                            OR
                        </Typography>
                    </Divider>

                    {/* Privy Connect Wallet */}
                    <ListItem disablePadding>
                        <ListItemButton
                            onClick={handlePrivyLogin}
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
