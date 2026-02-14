/**
 * Record a transaction to the platform TX history (persisted in Supabase).
 * Call this after any on-chain tx so it appears on the TX page.
 */
export type TransactionType =
  | "send"
  | "swap"
  | "schedule"
  | "recurring"
  | "limit_order"
  | "cancel_order"
  | "execute_scheduled";

export async function recordTransaction(payload: {
  wallet_address: string;
  tx_hash: string;
  type: TransactionType;
  label?: string | null;
}): Promise<void> {
  try {
    await fetch("/api/tempo/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    // Best effort
  }
}

/**
 * Extract tx hash(es) from an action result and record each. Used after executeAction in chat.
 */
export function recordTxFromActionResult(
  wallet: string | null | undefined,
  action: Record<string, unknown> | null | undefined,
  data: unknown,
): void {
  if (!wallet) return;
  const a = action?.action;
  if (typeof a !== "string") return;
  const d = data as Record<string, unknown> | undefined;
  if (!d) return;

  const list: { hash: string; type: TransactionType; label?: string }[] = [];

  if (a === "send_payment" && d.hash) {
    list.push({ hash: String(d.hash), type: "send" });
  }
  if (a === "send_parallel") {
    if (d && (d as Record<string, unknown>).isBatch && (d as Record<string, unknown>).hash) {
      list.push({
        hash: String((d as Record<string, unknown>).hash),
        type: "send",
        label: "Batch send",
      });
    } else if (Array.isArray(data) && data.length > 0) {
      (data as Array<{ hash?: string }>).forEach((r) => {
        if (r?.hash) list.push({ hash: r.hash, type: "send" });
      });
    }
  }
  if (a === "schedule_payment" && Array.isArray(d.results)) {
    (d.results as Array<{ hash?: string }>).forEach((r) => {
      if (r?.hash) list.push({ hash: r.hash, type: "schedule" });
    });
  }
  if (a === "recurring_payment" && d.hash) {
    list.push({ hash: String(d.hash), type: "recurring" });
  }
  if (a === "swap" && d.hash) {
    list.push({ hash: String(d.hash), type: "swap" });
  }
  if (a === "place_limit_order" && d.hash) {
    list.push({ hash: String(d.hash), type: "limit_order" });
  }
  if (a === "cancel_order" && d.hash) {
    list.push({ hash: String(d.hash), type: "cancel_order" });
  }

  // Map protocol-management actions onto existing coarse types, using labels for detail.
  if (a === "deploy_token" && d.hash) {
    list.push({ hash: String(d.hash), type: "limit_order", label: "Deploy token" });
  }

  if (a === "mint_token" && d.hash) {
    list.push({ hash: String(d.hash), type: "send", label: "Mint token" });
  }

  if (a === "create_pair" && d.hash) {
    list.push({ hash: String(d.hash), type: "limit_order", label: "Create pair" });
  }

  if (a === "provide_liquidity" && Array.isArray(data)) {
    (data as Array<{ hash?: string }>).forEach((r) => {
      if (r?.hash) list.push({ hash: r.hash, type: "limit_order", label: "Provide liquidity" });
    });
  }

  list.forEach((r) => {
    recordTransaction({
      wallet_address: wallet,
      tx_hash: r.hash,
      type: r.type,
      label: r.label ?? null,
    });
  });
}
