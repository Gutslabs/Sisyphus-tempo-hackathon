"use client";

import { Box, Container, Typography, Button } from "@mui/material";
import Link from "next/link";
import { LandingChat } from "@/components/landing/landing-chat";

export default function LandingPage() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "/";

  return (
    <Box
      sx={(theme) => ({
        minHeight: "100vh",
        bgcolor: theme.palette.background.default,
        color: theme.palette.text.primary,
        display: "flex",
        flexDirection: "column",
      })}
    >
      <Container
        maxWidth="lg"
        sx={{
          py: { xs: 4, sm: 6 },
          flex: 1,
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          alignItems: { xs: "stretch", md: "center" },
          gap: { xs: 4, sm: 6 },
        }}
      >
        {/* Left: hero copy */}
        <Box
          sx={{
            flex: { xs: "0 0 auto", md: "0 0 40%" },
            textAlign: { xs: "center", md: "left" },
          }}
        >
          <Typography
            variant="h3"
            sx={{
              fontWeight: 700,
              mb: { xs: 1.5, sm: 2 },
              fontSize: { xs: "2.25rem", sm: "2.75rem", md: "3.25rem" },
              lineHeight: 1.05,
              letterSpacing: -0.5,
            }}
          >
            Sisyphus on Tempo
          </Typography>
          <Typography
            variant="body1"
            color="text.secondary"
            sx={{
              mb: { xs: 2.5, sm: 3 },
              fontSize: { xs: "0.95rem", sm: "1rem" },
              maxWidth: { xs: 520, md: "unset" },
              mx: { xs: "auto", md: 0 },
            }}
          >
            Type what you want to do and the agent will simulate swaps, limit orders, and payments on Tempo.
          </Typography>
          <Box
            sx={{
              display: "flex",
              justifyContent: { xs: "center", md: "flex-start" },
              flexWrap: "wrap",
              gap: 1.5,
              mt: { xs: 0.5, sm: 1 },
            }}
          >
            <Button component={Link} href={appUrl} variant="contained" size="small">
              Go to dashboard
            </Button>
          </Box>
        </Box>

        {/* Right: simplified AI chat (no sidebar, single session) */}
        <Box
          sx={(theme) => ({
            flex: { xs: "1 1 auto", md: "0 0 60%" },
            width: "100%",
            // Keep a consistent frame but adapt to viewport height on small devices.
            height: { xs: "60vh", sm: 520, md: 520 },
            minHeight: { xs: 360, sm: 420 },
            borderRadius: 3,
            overflow: "hidden",
            border: "1px solid",
            borderColor: theme.palette.divider,
            display: "flex",
          })}
        >
          <LandingChat />
        </Box>
      </Container>
    </Box>
  );
}
