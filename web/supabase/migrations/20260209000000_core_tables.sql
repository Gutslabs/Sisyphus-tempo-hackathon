-- Core tables for Sisyphus (Supabase/Postgres).
-- Run from Supabase Dashboard -> SQL Editor (or via supabase db push).
--
-- Note: 20260210000000_chat_sessions.sql adds `chat_sessions` and attaches `session_id`
-- (FK -> chat_sessions) onto `chat_messages`. This file is intentionally dated earlier so
-- `chat_messages` exists before that migration runs.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Chat messages (messages are scoped by wallet_address; sessions are added in the next migration).
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  action JSONB NULL,
  action_result JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_wallet ON chat_messages(wallet_address);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(wallet_address, created_at);

-- Transaction history (used by the TX view).
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  tx_hash TEXT NOT NULL,
  type TEXT NOT NULL,
  label TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transactions_wallet ON transactions(wallet_address);
CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions(wallet_address, created_at DESC);

-- Local index for on-chain limit orders (improves UX: "Bid 1", "Ask 2", cancel by label, etc.)
CREATE TABLE IF NOT EXISTS limit_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  on_chain_order_id TEXT NOT NULL,
  token TEXT NOT NULL,
  amount TEXT NOT NULL,
  is_bid BOOLEAN NOT NULL,
  price DOUBLE PRECISION NOT NULL,
  tick INTEGER NULL,
  tx_hash TEXT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_limit_orders_wallet ON limit_orders(wallet_address);
CREATE INDEX IF NOT EXISTS idx_limit_orders_wallet_status ON limit_orders(wallet_address, status);

