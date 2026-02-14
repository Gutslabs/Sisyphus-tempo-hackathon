"use client";

import { useEffect } from "react";
import { usePrivy, useWallets, type ConnectedWallet } from "@privy-io/react-auth";
import type { Connector, CreateConnectorFn } from "wagmi";
import { connect as connectAction } from "wagmi/actions";
import { injected } from "wagmi/connectors";
import { tempoModerato } from "viem/chains";
import { config } from "@/lib/wagmi-config";

const PRIVY_CONNECTOR_PREFIX = "io.privy.wallet";

function toPrivyConnectorId(wallet: ConnectedWallet): string {
  // Matches @privy-io/wagmi behavior:
  // walletClientType === 'privy' -> `${meta.id}.${address}`
  if (wallet.walletClientType === "privy" || wallet.walletClientType === "privy-v2")
    return `${wallet.meta.id}.${wallet.address}`;
  return wallet.meta.id;
}

function chainIdFromEip155(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const m = value.match(/^eip155:(\d+)$/);
  return m ? Number(m[1]) : null;
}

/**
 * Bridge Privy's embedded wallet (created on email login) into wagmi so the app can transact
 * with either:
 * - Tempo passkey wallet (wagmi/tempo webAuthn connector)
 * - MetaMask / injected wallets (wagmi injected connector)
 * - Privy embedded wallet (email login)
 */
export function PrivyWalletBridge() {
  const { ready: privyReady, authenticated } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();

  useEffect(() => {
    if (!privyReady || !walletsReady) return;

    const privyWallets = wallets.filter(
      (w) => w.walletClientType === "privy" || w.walletClientType === "privy-v2",
    );
    const existing = [...config.connectors];

    // Preserve all non-Privy connectors (Tempo passkey + MetaMask + mipd detected wallets).
    const nonPrivy = existing.filter((c) => !String(c.id).startsWith(PRIVY_CONNECTOR_PREFIX));
    const existingById = new Map(existing.map((c) => [String(c.id), c]));

    let cancelled = false;

    (async () => {
      const privyConnectors = [];

      for (const wallet of privyWallets) {
        const id = toPrivyConnectorId(wallet);
        const reused = existingById.get(id);
        if (reused) {
          privyConnectors.push(reused);
          continue;
        }

        // Ensure embedded wallet is on Tempo Moderato. Privy notes that switching chains
        // does not update existing provider instances, so we switch before requesting one.
        try {
          const currentChain = chainIdFromEip155(wallet.chainId);
          if (currentChain !== tempoModerato.id) {
            await wallet.switchChain(tempoModerato.id);
          }
        } catch {
          // Ignore; if switching fails, we still attempt to build the provider.
        }

        const provider = await wallet.getEthereumProvider();
        const connectorFn = injected({
          target: {
            provider,
            id,
            name: wallet.meta.name,
            icon: wallet.meta.icon,
          },
        });
        const internal = (config as unknown as {
          _internal: { connectors: { setup: (fn: CreateConnectorFn) => Connector } };
        })._internal;
        const connector = internal.connectors.setup(connectorFn as unknown as CreateConnectorFn);
        privyConnectors.push(connector);
      }

      if (cancelled) return;

      const internal = (config as unknown as {
        _internal: { connectors: { setState: (value: readonly Connector[]) => void } };
      })._internal;
      internal.connectors.setState([...nonPrivy, ...privyConnectors]);

      // If user authenticated via email and wagmi has no active connection yet, select the embedded wallet.
      if (
        authenticated &&
        config.state.status === "disconnected" &&
        privyWallets.length > 0 &&
        privyConnectors.length > 0
      ) {
        const connector = privyConnectors[0]!;
        try {
          await connectAction(config, { connector, chainId: tempoModerato.id });
        } catch {
          // Ignore if already connected or connect fails; user can still connect manually.
        }
      }
    })().catch((e) => {
      console.warn("PrivyWalletBridge failed:", e);
    });

    return () => {
      cancelled = true;
    };
  }, [privyReady, walletsReady, authenticated, wallets]);

  return null;
}
