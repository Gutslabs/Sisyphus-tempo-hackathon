"use client";

import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Drawer,
  Divider,
  Switch,
  IconButton,
} from "@mui/material";
import {
  Dashboard as DashboardIcon,
  Chat as ChatIcon,
  Schedule as PaymentsIcon,
  ReceiptLong as TxIcon,
  Circle as CircleIcon,
  ChevronRight as ChevronRightIcon,
  ChevronLeft as ChevronLeftIcon,
} from "@mui/icons-material";
import type { View } from "@/app/page";
import { useThemeMode } from "@/app/providers";
import { useState, useEffect } from "react";

const NAV_ITEMS: { id: View; label: string; icon: React.ReactNode }[] = [
  { id: "dashboard", label: "Dashboard", icon: <DashboardIcon /> },
  { id: "chat", label: "AI Chat", icon: <ChatIcon /> },
  { id: "payments", label: "Payments", icon: <PaymentsIcon /> },
  { id: "tx", label: "TX", icon: <TxIcon /> },
];

interface SidebarProps {
  activeView: View;
  onViewChange: (view: View) => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
  desktopCollapsed: boolean;
  onDesktopToggle: () => void;
}

type SidebarVariant = "permanent" | "temporary";

const DRAWER_WIDTH = 240;

function SidebarContent({
  activeView,
  onViewChange,
  variant,
  collapsed = false,
}: Pick<SidebarProps, "activeView" | "onViewChange"> & {
  variant: SidebarVariant;
  collapsed?: boolean;
}) {
  const { mode, toggle } = useThemeMode();
  const [mounted, setMounted] = useState(false);


  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Logo */}
      <Box
        sx={{
          p: 3,
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          justifyContent: variant === "temporary" ? "flex-start" : { xs: "center", lg: "flex-start" },
        }}
      >
        <Box
          sx={(theme) => ({
            width: 32,
            height: 32,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: theme.palette.mode === "dark" ? "#ffffff" : theme.palette.primary.main,
            color: theme.palette.mode === "dark" ? "#000000" : "#ffffff",
          })}
        >
          <TxIcon sx={{ fontSize: 18 }} />
        </Box>
        <Typography
          variant="h6"
          sx={{
            fontSize:
              variant === "temporary"
                ? { xs: "1rem", sm: "1.05rem" }
                : { xs: "0.95rem", lg: "1.1rem" },
            fontWeight: 600,
            letterSpacing: 0.5,
            color: "text.primary",
            display: variant === "temporary" ? "block" : { xs: "none", lg: "block" },
          }}
        >
          SISYPHUS
        </Typography>
      </Box>

      <Divider sx={{ mx: 2, mb: 2 }} />

      {/* Navigation */}
      <List sx={{ px: variant === "temporary" ? 2 : { xs: 1, lg: 2 } }}>
        {NAV_ITEMS.map((item) => (
          <ListItem key={item.id} disablePadding sx={{ mb: 0.5 }}>
            <ListItemButton
              onClick={() => onViewChange(item.id)}
              selected={activeView === item.id}
              sx={{
                borderRadius: 10,
                "&.Mui-selected": {
                  backgroundColor: "rgba(0, 0, 0, 0.06)",
                  color: "primary.main",
                  "& .MuiListItemIcon-root": {
                    color: "primary.main",
                  },
                  "&:hover": {
                    backgroundColor: "rgba(0, 0, 0, 0.1)",
                  },
                },
                "&:hover": {
                  backgroundColor: "rgba(0, 0, 0, 0.04)",
                },
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: variant === "temporary" ? 40 : { xs: 0, lg: 40 },
                  justifyContent: "center",
                }}
              >
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{
                  variant: "body2",
                  fontWeight: activeView === item.id ? 600 : 500,
                }}
                sx={{
                  display: variant === "temporary" ? "block" : { xs: "none", lg: "block" },
                }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      <Box sx={{ mt: "auto", p: variant === "temporary" ? 3 : { xs: 3, md: 1.5, lg: 3 }, display: "flex", flexDirection: "column", gap: 2 }}>


        {/* Theme toggle */}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: variant === "temporary" ? "space-between" : { xs: "space-between", md: "center", lg: "space-between" }, gap: 1 }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: variant === "temporary" ? "block" : { xs: "block", md: "none", lg: "block" } }}
          >
            {mounted && mode === "dark" ? "Dark" : "Light"} mode
          </Typography>
          <Switch
            checked={mode === "dark"}
            onChange={toggle}
            size="small"
          />
        </Box>

        {/* Network indicator */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, justifyContent: variant === "temporary" ? "flex-start" : { xs: "flex-start", md: "center", lg: "flex-start" } }}>
          <CircleIcon sx={{ fontSize: 8, color: "success.main" }} />
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              fontWeight: 500,
              fontSize:
                variant === "temporary" ? { xs: "0.7rem", sm: "0.75rem" } : { xs: "0.6rem", md: "0.7rem" },
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              display: variant === "temporary" ? "block" : { xs: "block", md: "none", lg: "block" },
            }}
          >
            Tempo Moderato
          </Typography>
        </Box>
      </Box>


    </Box>
  );
}

export function Sidebar({
  activeView,
  onViewChange,
  mobileOpen,
  onMobileClose,
  desktopCollapsed,
  onDesktopToggle,
}: SidebarProps) {
  return (
    <>
      {/* Mobile / tablet temporary drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onMobileClose}
        ModalProps={{ keepMounted: true }}
        sx={(theme) => ({
          display: { xs: "block", md: "none" },
          "& .MuiDrawer-paper": {
            width: DRAWER_WIDTH,
            boxSizing: "border-box",
            borderRight: "1px solid",
            borderColor: "divider",
            backgroundColor: theme.palette.background.paper,
          },
        })}
      >
        <SidebarContent
          variant="temporary"
          collapsed={false}
          activeView={activeView}
          onViewChange={(v) => {
            onViewChange(v);
            onMobileClose();
          }}
        />
      </Drawer>

      {/* Desktop permanent drawer (md+), width toggled by desktopCollapsed */}
      <Drawer
        variant="permanent"
        sx={(theme) => ({
          display: { xs: "none", md: "block" },
          width: desktopCollapsed ? 0 : { md: 72, lg: DRAWER_WIDTH },
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: desktopCollapsed ? 0 : { md: 72, lg: DRAWER_WIDTH },
            boxSizing: "border-box",
            borderRight: "1px solid",
            borderColor: "divider",
            backgroundColor: theme.palette.background.paper,
          },
        })}
      >
        <SidebarContent
          variant="permanent"
          activeView={activeView}
          onViewChange={onViewChange}
        />
      </Drawer>

      {/* Desktop collapse handle (always visible on md+) */}
      <Box
        sx={{
          display: { xs: "none", md: "flex" },
          alignItems: "center",
          justifyContent: "center",
          width: 16,
          flexShrink: 0,
        }}
      >
        <IconButton
          size="small"
          onClick={onDesktopToggle}
          sx={(theme) => ({
            bgcolor: theme.palette.background.paper,
            boxShadow: 1,
            "&:hover": { bgcolor: theme.palette.action.hover },
            ...(desktopCollapsed && {
              animation: "pulse 2s infinite",
              "@keyframes pulse": {
                "0%": {
                  boxShadow: `0 0 0 0 ${theme.palette.primary.main}`,
                },
                "70%": {
                  boxShadow: `0 0 0 10px ${theme.palette.mode === "dark" ? "rgba(255, 255, 255, 0)" : "rgba(0, 0, 0, 0)"}`,
                },
                "100%": {
                  boxShadow: `0 0 0 0 ${theme.palette.mode === "dark" ? "rgba(255, 255, 255, 0)" : "rgba(0, 0, 0, 0)"}`,
                },
              },
            }),
          })}
        >
          {desktopCollapsed ? (
            <ChevronRightIcon fontSize="small" />
          ) : (
            <ChevronLeftIcon fontSize="small" />
          )}
        </IconButton>
      </Box>
    </>
  );
}
