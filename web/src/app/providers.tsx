"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider, CssBaseline } from "@mui/material"; // Fixed imports
import { lightTheme, darkTheme } from "@/lib/theme";
import { config } from "@/lib/wagmi-config";
import type { ReactNode } from "react";
import { useState, useEffect, createContext, useContext } from "react";
import { tempoModerato } from "viem/chains";
import { PrivyWalletBridge } from "./privy-wallet-bridge";

type ColorMode = "light" | "dark";
const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

interface ThemeContextValue {
  mode: ColorMode;
  toggle: () => void;
}

export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function useThemeMode(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useThemeMode must be used within Providers");
  }
  return ctx;
}

export function Providers({ children }: { children: ReactNode }) {
  if (!PRIVY_APP_ID) {
    throw new Error(
      "Missing NEXT_PUBLIC_PRIVY_APP_ID. Set it in web/.env.local (see web/.env.local.example)."
    );
  }

  // Create QueryClient instance inside component to avoid SSR issues
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 1000, // 5 seconds
        refetchOnWindowFocus: false,
      },
    },
  }));

  const [mode, setMode] = useState<ColorMode>("light");

  // hydrate from localStorage (or default to system)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("sisyphus_theme");
    if (stored === "light" || stored === "dark") {
      setMode(stored);
    } else {
      // Default to system preference
      const systemPreference = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      setMode(systemPreference);
    }
  }, []);

  const toggle = () => {
    setMode((prev) => {
      const next = prev === "light" ? "dark" : "light";
      if (typeof window !== "undefined") {
        window.localStorage.setItem("sisyphus_theme", next);
      }
      return next;
    });
  };

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        // Keep Privy only for email login (Tempo passkeys + external wallets are handled by wagmi).
        supportedChains: [tempoModerato],
        defaultChain: tempoModerato,
        loginMethods: ["email"],
        // Customize Privy's appearance
        appearance: {
          theme: mode,
          accentColor: "#676FFF",
        },
        // Create embedded wallets for users who don't have a wallet
        embeddedWallets: {
          ethereum: {
            createOnLogin: "users-without-wallets",
          },
        },
      }}
    >
      <WagmiProvider config={config}>
        <PrivyWalletBridge />
        <QueryClientProvider client={queryClient}>
          <ThemeContext.Provider value={{ mode, toggle }}>
            <ThemeProvider theme={mode === "light" ? lightTheme : darkTheme}>
              <CssBaseline />
              {children}
            </ThemeProvider>
          </ThemeContext.Provider>
        </QueryClientProvider>
      </WagmiProvider>
    </PrivyProvider>
  );
}
