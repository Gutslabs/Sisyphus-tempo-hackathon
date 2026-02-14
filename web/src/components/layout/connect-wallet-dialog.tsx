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

interface ConnectWalletDialogProps {
    open: boolean;
    onClose: () => void;
}

export function ConnectWalletDialog({ open, onClose }: ConnectWalletDialogProps) {
    const theme = useTheme();
    const { login } = usePrivy();
    const handlePasskey = () => {
        login({ loginMethods: ["passkey"] });
        onClose();
    };
    const handleEmail = () => {
        login({ loginMethods: ["email"] });
        onClose();
    };
    const handleWallet = () => {
        login({ loginMethods: ["wallet"] });
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
                            onClick={handlePasskey}
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
                                primary="Continue with Passkey"
                                secondary="Biometric / security key"
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
                                primary="Continue with Email"
                                secondary="One-time code"
                                primaryTypographyProps={{ fontWeight: 600 }}
                            />
                        </ListItemButton>
                    </ListItem>

                    <ListItem disablePadding>
                        <ListItemButton
                            onClick={handleWallet}
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
