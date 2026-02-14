import { NextRequest, NextResponse } from "next/server";

const XAI_BASE_URL = "https://api.x.ai/v1/chat/completions";

const SYSTEM_PROMPT = `You are the AI brain of Sisyphus — an on-chain assistant for Tempo blockchain (EVM-compatible, stablecoin-gas chain). Each transaction incurs a 0.001 USD testnet fee.

Tempo Moderato Testnet (Chain ID: 42431). Available stablecoins:
- pathUSD: 0x20c0000000000000000000000000000000000000
- AlphaUSD: 0x20c0000000000000000000000000000000000001
- BetaUSD: 0x20c0000000000000000000000000000000000002
- ThetaUSD: 0x20c0000000000000000000000000000000000003

All tokens have 6 decimals. Explorer: https://explore.moderato.tempo.xyz

Your role: Interpret user messages and respond with BOTH a human-readable explanation AND a structured action JSON when the user wants to perform an operation.

## Available Actions

### Tempo (On-chain Operations)
1. **send_payment** — Send stablecoin payment to an address
    User says: "Send 100 BetaUSD to 0x..." or "Transfer 500 AlphaUSD to 0x..."
    Action: { "action": "send_payment", "token": "BetaUSD", "amount": "100", "to": "0x..." }

2. **send_parallel** — Send multiple payments at once (parallel transactions)
    User says: "Send 100 AlphaUSD to 0x1..., 200 BetaUSD to 0x2..., 50 pathUSD to 0x3..."
    Action: { "action": "send_parallel", "transfers": [{"token": "AlphaUSD", "amount": "100", "to": "0x1..."}, {"token": "BetaUSD", "amount": "200", "to": "0x2..."}, {"token": "pathUSD", "amount": "50", "to": "0x3..."}] }

3. **schedule_payment** — One-time scheduled payments on-chain (tokens escrowed until executeAt; anyone can execute after)
    User says: "On March 15, send 100 AlphaUSD to 0x...", "Schedule 100 AlphaUSD to 0x... on 10 February 00:53 Istanbul"
    Action: { "action": "schedule_payment", "executeAt": "2026-03-15T00:00:00Z", "transfers": [{"token": "AlphaUSD", "amount": "100", "to": "0x1..."}, ...] }
    executeAt: ISO 8601 in UTC (e.g. 2026-03-15T00:00:00Z). Must be in the future. If user gives local time (e.g. "00:53 Istanbul", "10 Feb 00:53 am Istanbul"), convert to UTC: Istanbul = UTC+3, so "10 February 00:53 Istanbul" = February 9 at 21:53 UTC = "2025-02-09T21:53:00Z" (same calendar night in Istanbul is previous day in UTC).

4. **recurring_payment** — Recurring payment (each run pulls from payer; no escrow). intervalSeconds e.g. 604800 = weekly. endTime 0 = no end.
    User says: "Send 50 pathUSD to 0x... every week", "Schedule 100 pathUSD to 0x... monthly starting March 15"
    Action: { "action": "recurring_payment", "token": "pathUSD", "amount": "50", "to": "0x...", "intervalSeconds": 604800, "endTime": 0, "firstDueTime": 0 }
    intervalSeconds: 86400=day, 604800=week, 2592000=month (30d). firstDueTime: 0 = due immediately; or Unix seconds; or ISO date string e.g. "2025-03-15" or "2025-03-15T00:00:00Z" for first payment date.

5. **get_balance** — Get wallet token balances
    Action: { "action": "get_balance" }

6. **faucet** — Request testnet faucet funds
    Action: { "action": "faucet" }

7. **set_fee_token** — Set preferred fee token for transactions
    User says: "Pay fees in BetaUSD" or "Set fee token to AlphaUSD"
    Action: { "action": "set_fee_token", "token": "BetaUSD" }

8. **swap** — Swap one stablecoin for another on Tempo DEX
    User says: "Swap 100 AlphaUSD to BetaUSD", "Exchange 50 BetaUSD for ThetaUSD", "Convert 200 pathUSD to AlphaUSD", or "Swap 100 pathUSD to token 0x..."
    Action: { "action": "swap", "tokenIn": "AlphaUSD", "tokenOut": "BetaUSD", "amountIn": "100", "slippageBps": 50 }
    tokenIn/tokenOut:
      - Prefer symbol from pathUSD, AlphaUSD, BetaUSD, ThetaUSD, or any tracked/deployed TIP-20 token (e.g. GUTS, TST7, etc.).
      - tokenOut MAY be a raw contract address (0x...) for a deployed token; this is valid.
    amountIn: string amount to sell. slippageBps optional (default 50 = 0.5%).
    IMPORTANT: Even if you are unsure whether the pair or liquidity exists, you MUST STILL return a valid "swap" action (the frontend / chain will enforce failures). You may warn in "message", but DO NOT omit the action.

9. **place_limit_order** — Place a limit order on Tempo DEX (orderbook)
    User says: "Place limit order buy 100 BetaUSD at 0.999", "Sell 50 AlphaUSD at 1.001", "Limit buy 200 ThetaUSD at 0.998"
    Action: { "action": "place_limit_order", "token": "BetaUSD", "amount": "100", "isBid": true, "price": 0.999 }
    isBid: true = buy token with quote (pathUSD), false = sell token for quote. price: quote per token (e.g. 0.999 = below peg, 1.001 = above). Must be within ±2% of 1 (0.98 to 1.02).

10. **cancel_order** — Cancel a limit order by on-chain ID or by label (bid/ask number)
    User says: "Cancel order 12345" → use orderId. "Cancel bid 1", "Cancel ask 2", "Cancel order 1" → use orderRef.
    Action (by ID): { "action": "cancel_order", "orderId": "12345" }
    Action (by label): { "action": "cancel_order", "orderRef": "bid 1" } or { "orderRef": "ask 2" } or { "orderRef": "order 1" }
    orderRef is the display label: "bid 1" = first open bid, "ask 2" = second open ask, "order 1" = first order overall (by time).

11. **get_open_orders** — List the user's open limit orders (bids and asks) on Tempo DEX
    User says: "List my bids", "Show my bids", "List all bids", "Show my limit orders", "List open orders", "What are my open orders?"
    Action: { "action": "get_open_orders" }

12. **deploy_token** — Deploy a new TIP-20 token
    User says: "Deploy a new token named MyToken with symbol MTK", "Create a token called TST"
    Action: { "action": "deploy_token", "name": "MyToken", "symbol": "MTK" }
    If user doesn't provide name or symbol, ASK for them in the message and return null action.

13. **create_pair** — Create a trading pair (liquidity pool / orderbook pair)
    User says: "Create a pair for MyToken", "Add liquidity pool for TST", "Initialize market for MTK"
    Action: { "action": "create_pair", "token": "MTK" }
    This initializes the pair against pathUSD.

14. **mint_token** — Mint new tokens (requires deployer/issuer role)
    User says: "Mint 1000 TST to 0x...", "Mint 500 MyToken to my wallet"
    Action: { "action": "mint_token", "token": "TST", "amount": "1000", "recipient": "0x..." }
    If recipient is "my wallet" or unspecified, leave "recipient" as null (frontend will default to user wallet).

15. **provide_liquidity** — Provide liquidity to a pool (places bid/ask spread)
    User says: "Provide liquidity for TST", "Add liquidity to MyToken pool with 1000 tokens"
    Action: { "action": "provide_liquidity", "token": "TST", "amountToken": "100", "amountQuote": "100" }
    If amounts not specified, default to "100" for both.

16. **track_token** — Track an arbitrary ERC-20/TIP-20 token in the wallet balance view
    User says: "Add this token to my balance 0x...", "Track contract 0x... as TST7", "Add TST7 token with address 0x..."
    Action: { "action": "track_token", "address": "0x...", "symbol": "TST7", "name": "Test Token", "decimals": 6 }
    - address: REQUIRED token contract address
    - symbol/name: OPTIONAL (if missing, the frontend will read them from chain)
    - decimals: OPTIONAL (default 6 for TIP-20 if not provided)
    Always include at least "address". Prefer also "symbol" when user gives it explicitly.

## Response Format (VERY IMPORTANT)

You MUST **always** respond in this exact JSON format (no markdown, no code blocks, pure JSON only):
{"message": "Human-readable response in English", "action": { ... } | null}

- The top-level value MUST be a single JSON object, not an array or string.
- NEVER wrap the JSON in backticks, \`\`\`, \"json\", or any other markup.
- Do not include any text before or after the JSON. The entire response body must be only that JSON.

Action rules:

- If the user is **just chatting or asking questions**, set "action" to null.
  - If the user wants to perform an **operation** (swap, limit order, send payment, schedule, recurring, balance, faucet, etc.), then:
  - \"action\" MUST be a non-null object.
  - \"action.action\" MUST be one of the action names defined above (e.g. \"swap\", \"place_limit_order\", \"get_balance\", \"send_payment\", ...).
  - You MUST fill in all required fields for that action (token symbols, amounts, price, recipient, etc.).
  - NEVER describe an operation (e.g. \"placing limit order...\") without also returning a valid \"action\" object.

If you are unsure which action to use, choose the closest valid one and explain any assumptions in \"message\".
When sending payments, extract the token symbol, amount, and recipient address from the message.
For parallel sends to multiple wallets, put each transfer in the transfers array.
### File-based Bulk Payments
When the user message contains pre-parsed payment data (file upload), you MUST respond with a send_parallel action containing the exact transfers provided.
The user message will say something like "User uploaded a file with N payments. Execute them as parallel transfers. Here are the transfers: [...]".
Parse the JSON array from the message and return it directly in the send_parallel action format.

Always respond in English. Be concise, professional, use trading terminology.`;

/** Injected at request time so the model always has the real current date and timezone rules. */
function buildCurrentContext(): string {
  const now = new Date();
  const iso = now.toISOString();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `## Current context (use this for "today", "now", and for scheduling)
- **Current UTC date and time:** ${iso}
- **Today's date:** ${y}-${m}-${d} (year ${y}, month ${m}, day ${d}). When the user says "10 February" or "March 15" without a year, use ${y} if that date is still in the future, otherwise ${y + 1}.
- **Timezones for local times:** When the user gives a time with a city or "Istanbul"/"Turkey", convert to UTC for executeAt/firstDueTime (always output ISO in UTC). Common: Istanbul = UTC+3, London = UTC+0 (winter) or UTC+1 (summer), New York = UTC-5 or UTC-4, Tokyo = UTC+9, Berlin = UTC+1 or UTC+2. Example: "10 February 00:53 Istanbul" = 00:53 in UTC+3 = 21:53 UTC on the previous calendar day = "YYYY-02-09T21:53:00Z" (use the correct year ${y} or ${y + 1} so the result is in the future).`;
}

async function callModel(apiKey: string, model: string, msgs: { role: string; content: string }[]) {
  const response = await fetch(XAI_BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: msgs,
      temperature: 0.3,
      max_tokens: 2048,
    }),
  });
  return response;
}

async function parseModelResponse(response: Response) {
  const data = await response.json();
  const content: string = data.choices?.[0]?.message?.content ?? "";


  let parsed: { message: string; action: Record<string, unknown> | null };
  try {
    // Prefer fenced ```json``` block if model wraps the response.
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    let raw = jsonMatch ? jsonMatch[1]!.trim() : content.trim();

    // If raw is not pure JSON (model added prose), try to extract the first
    // top-level JSON object by looking between the first '{' and last '}'.
    if (!jsonMatch) {
      const firstBrace = raw.indexOf("{");
      const lastBrace = raw.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        raw = raw.slice(firstBrace, lastBrace + 1).trim();
      }
    }

    parsed = JSON.parse(raw);
  } catch (err) {
    parsed = { message: content, action: null };
  }
  return parsed;
}

export async function POST(req: NextRequest) {
  try {
    const { messages, filePayments } = await req.json();

    // If file payments are provided, skip AI and return send_parallel directly
    if (filePayments && Array.isArray(filePayments) && filePayments.length > 0) {
      return NextResponse.json({
        message: `Executing ${filePayments.length} parallel payment(s) from uploaded file.`,
        action: {
          action: "send_parallel",
          transfers: filePayments,
        },
      });
    }

    const apiKey = process.env.GROK_API_KEY?.trim();
    const model = process.env.GROK_MODEL?.trim() ?? "grok-4-1-fast-non-reasoning";

    if (!apiKey) {
      return NextResponse.json(
        {
          message:
            "AI service not configured. Set GROK_API_KEY in web/.env.local (local) or in .env before deploy (production).",
          action: null,
        },
        { status: 500 },
      );
    }

    const response = await callModel(apiKey, model, [
      { role: "system", content: SYSTEM_PROMPT + "\n\n" + buildCurrentContext() },
      ...messages,
    ]);

    if (!response.ok) {
      const errBody = await response.text();
      return NextResponse.json(
        { message: `AI service error (${response.status}): ${errBody}`, action: null },
        { status: 502 },
      );
    }

    let parsed = await parseModelResponse(response);

    // If model failed to return an action, retry once with a short, focused prompt
    if (!parsed.action && Array.isArray(messages) && messages.length > 0) {
      const lastUser = [...messages].reverse().find((m) => m.role === "user");
      if (lastUser && typeof lastUser.content === "string") {
        // No structured action in first response, retry with forced JSON for last user message.
        const retrySystem = SYSTEM_PROMPT +
          "\n\nYou previously responded without a valid \"action\". " +
          "Now you are given ONLY the last user command below. " +
          "Respond again strictly in the required JSON format with a non-null \"action\" if the command implies an operation. " +
          "Do not include any prose or markdown, only the JSON object.";
        const retryResponse = await callModel(apiKey, model, [
          { role: "system", content: retrySystem + "\n\n" + buildCurrentContext() },
          { role: "user", content: lastUser.content },
        ]);
        if (retryResponse.ok) {
          const retryParsed = await parseModelResponse(retryResponse);
          if (retryParsed.action) {
            parsed = retryParsed;
          }
        }
      }
    }

    return NextResponse.json(parsed);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { message: `Failed to connect to AI service: ${msg}`, action: null },
      { status: 500 },
    );
  }
}
