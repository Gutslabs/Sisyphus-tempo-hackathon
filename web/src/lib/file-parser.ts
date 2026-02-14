/**
 * Parse payment files (CSV/TXT) into structured payment data.
 *
 * Supported CSV columns (flexible order, auto-detected from header):
 *   ethereum_wallet / address / wallet / to  → recipient address
 *   amount                                   → payment amount
 *   token_ticker / token                     → token symbol
 *   wallet_label / label / name              → optional label
 *
 * Also supports headerless files:
 *   address,amount,token       per line
 *   address amount token       per line (whitespace-separated)
 *
 * Default token: "BetaUSD" if not specified per line.
 */

export interface ParsedPayment {
  address: string;
  amount: string;
  token: string;
  label?: string;
}

export interface ParseResult {
  payments: ParsedPayment[];
  errors: string[];
  total: number;
}

const ETH_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const KNOWN_TOKENS = ["pathusd", "alphausd", "betausd", "thetausd"];
const DEFAULT_TOKEN = "BetaUSD";

// Column name aliases for auto-detection
const ADDRESS_ALIASES = ["ethereum_wallet", "address", "wallet", "recipient", "to", "wallet_address"];
const AMOUNT_ALIASES = ["amount", "value", "qty", "quantity"];
const TOKEN_ALIASES = ["token_ticker", "token", "ticker", "symbol", "coin"];
const LABEL_ALIASES = ["wallet_label", "label", "name", "tag", "note", "description"];

function normalizeToken(raw: string): string | null {
  const lower = raw.trim().toLowerCase();
  const idx = KNOWN_TOKENS.indexOf(lower);
  if (idx === -1) return null;
  return ["pathUSD", "AlphaUSD", "BetaUSD", "ThetaUSD"][idx];
}

interface ColumnMap {
  address: number;
  amount: number;
  token: number;
  label: number;
}

function detectColumns(headerParts: string[]): ColumnMap | null {
  const lower = headerParts.map((h) => h.toLowerCase().trim());

  const addressIdx = lower.findIndex((h) => ADDRESS_ALIASES.includes(h));
  const amountIdx = lower.findIndex((h) => AMOUNT_ALIASES.includes(h));
  const tokenIdx = lower.findIndex((h) => TOKEN_ALIASES.includes(h));
  const labelIdx = lower.findIndex((h) => LABEL_ALIASES.includes(h));

  // Must have at least address and amount
  if (addressIdx === -1 || amountIdx === -1) return null;

  return {
    address: addressIdx,
    amount: amountIdx,
    token: tokenIdx,
    label: labelIdx,
  };
}

function isHeaderRow(parts: string[]): boolean {
  const first = parts[0]?.toLowerCase().trim() ?? "";
  return ADDRESS_ALIASES.includes(first) || AMOUNT_ALIASES.includes(first) || TOKEN_ALIASES.includes(first);
}

function parseLineWithColumns(parts: string[], cols: ColumnMap, lineNum: number): ParsedPayment | string {
  const address = parts[cols.address]?.trim() ?? "";
  const amountRaw = parts[cols.amount]?.trim() ?? "";
  const tokenRaw = cols.token >= 0 ? (parts[cols.token]?.trim() ?? DEFAULT_TOKEN) : DEFAULT_TOKEN;
  const label = cols.label >= 0 ? (parts[cols.label]?.trim() ?? undefined) : undefined;

  if (!ETH_ADDRESS_RE.test(address)) {
    return `Line ${lineNum}: Invalid address "${address}"`;
  }

  const num = parseFloat(amountRaw);
  if (isNaN(num) || num <= 0) {
    return `Line ${lineNum}: Invalid amount "${amountRaw}"`;
  }

  const token = normalizeToken(tokenRaw);
  if (!token) {
    return `Line ${lineNum}: Unknown token "${tokenRaw}". Use: pathUSD, AlphaUSD, BetaUSD, ThetaUSD`;
  }

  return { address, amount: amountRaw, token, label: label || undefined };
}

function parseLineSimple(line: string, lineNum: number): ParsedPayment | string {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//")) {
    return "";
  }

  const parts = trimmed.includes(",")
    ? trimmed.split(",").map((s) => s.trim())
    : trimmed.split(/\s+/);

  if (parts.length < 2) {
    return `Line ${lineNum}: Expected at least address and amount, got "${trimmed}"`;
  }

  const address = parts[0];
  const amount = parts[1];
  const tokenRaw = parts[2] ?? DEFAULT_TOKEN;

  if (!ETH_ADDRESS_RE.test(address)) {
    return `Line ${lineNum}: Invalid address "${address}"`;
  }

  const num = parseFloat(amount);
  if (isNaN(num) || num <= 0) {
    return `Line ${lineNum}: Invalid amount "${amount}"`;
  }

  const token = normalizeToken(tokenRaw);
  if (!token) {
    return `Line ${lineNum}: Unknown token "${tokenRaw}". Use: pathUSD, AlphaUSD, BetaUSD, ThetaUSD`;
  }

  // If there's a 4th column, treat it as label
  const label = parts[3]?.trim() || undefined;

  return { address, amount, token, label };
}

export function parsePaymentFile(content: string, filename: string): ParseResult {
  const lines = content.split(/\r?\n/);
  const payments: ParsedPayment[] = [];
  const errors: string[] = [];

  if (lines.length === 0) return { payments, errors, total: 0 };

  // Try to detect header columns
  const firstLineParts = lines[0].includes(",")
    ? lines[0].split(",").map((s) => s.trim())
    : lines[0].split(/\s+/);

  const columnMap = isHeaderRow(firstLineParts) ? detectColumns(firstLineParts) : null;
  const startIdx = columnMap ? 1 : 0;

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith("#") || line.startsWith("//")) continue;

    let result: ParsedPayment | string;

    if (columnMap) {
      const parts = line.includes(",")
        ? line.split(",").map((s) => s.trim())
        : line.split(/\s+/);
      result = parseLineWithColumns(parts, columnMap, i + 1);
    } else {
      result = parseLineSimple(line, i + 1);
    }

    if (typeof result === "string") {
      if (result) errors.push(result);
    } else {
      payments.push(result);
    }
  }

  return { payments, errors, total: payments.length };
}

/**
 * Generate a human-readable summary of parsed payments.
 */
export function summarizePayments(result: ParseResult): string {
  if (result.total === 0) {
    return `No valid payments found.${result.errors.length > 0 ? ` Errors:\n${result.errors.join("\n")}` : ""}`;
  }

  // Group by token
  const byToken: Record<string, { count: number; totalAmount: number }> = {};
  for (const p of result.payments) {
    if (!byToken[p.token]) byToken[p.token] = { count: 0, totalAmount: 0 };
    byToken[p.token].count++;
    byToken[p.token].totalAmount += parseFloat(p.amount);
  }

  const lines = [`Parsed ${result.total} payment(s) from file:`];
  for (const [token, info] of Object.entries(byToken)) {
    lines.push(`  ${info.count}x ${token} — Total: ${info.totalAmount.toFixed(2)} ${token}`);
  }

  if (result.errors.length > 0) {
    lines.push(`\n${result.errors.length} error(s) skipped:`);
    result.errors.slice(0, 5).forEach((e) => lines.push(`  ${e}`));
    if (result.errors.length > 5) lines.push(`  ... and ${result.errors.length - 5} more`);
  }

  return lines.join("\n");
}

/**
 * Generate a detailed table-style preview of all payments (with labels).
 */
export function formatPaymentTable(payments: ParsedPayment[]): string {
  const lines: string[] = [];
  const hasLabels = payments.some((p) => p.label);

  lines.push(`Sending ${payments.length} payment(s):\n`);

  // Header
  if (hasLabels) {
    lines.push(`  #   Recipient                                     Amount        Token       Label`);
    lines.push(`  ${"─".repeat(95)}`);
  } else {
    lines.push(`  #   Recipient                                     Amount        Token`);
    lines.push(`  ${"─".repeat(72)}`);
  }

  for (let i = 0; i < payments.length; i++) {
    const p = payments[i];
    const idx = String(i + 1).padStart(2, " ");
    const addr = `${p.address.slice(0, 6)}...${p.address.slice(-4)}`;
    const amt = parseFloat(p.amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    if (hasLabels) {
      lines.push(`  ${idx}. ${addr}  ${amt.padStart(14)}  ${p.token.padEnd(10)}  ${p.label ?? ""}`);
    } else {
      lines.push(`  ${idx}. ${addr}  ${amt.padStart(14)}  ${p.token}`);
    }
  }

  // Totals
  const byToken: Record<string, number> = {};
  for (const p of payments) {
    byToken[p.token] = (byToken[p.token] ?? 0) + parseFloat(p.amount);
  }
  lines.push(`\n  Totals:`);
  for (const [token, total] of Object.entries(byToken)) {
    lines.push(`    ${total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${token}`);
  }

  return lines.join("\n");
}
