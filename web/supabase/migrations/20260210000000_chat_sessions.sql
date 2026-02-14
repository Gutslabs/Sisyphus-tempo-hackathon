-- Run this in Supabase Dashboard → SQL Editor (or via supabase db push).
-- Chat sessions (one per "conversation", like ChatGPT).
-- Each session has many messages. Sessions are scoped by wallet_address.
CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'New chat',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_wallet ON chat_sessions(wallet_address);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated ON chat_sessions(wallet_address, updated_at DESC);

-- Add session_id to chat_messages (nullable for existing rows).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chat_messages' AND column_name = 'session_id'
  ) THEN
    ALTER TABLE chat_messages ADD COLUMN session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id);

-- Optional: backfill one session per wallet from existing messages without session_id.
-- Run only if you want to keep old messages in a single "Previous chat" session per wallet.
-- INSERT INTO chat_sessions (id, wallet_address, title, created_at, updated_at)
-- SELECT gen_random_uuid(), wallet_address, 'Previous chat', MIN(created_at), MAX(created_at)
-- FROM chat_messages WHERE session_id IS NULL GROUP BY wallet_address;
-- UPDATE chat_messages m SET session_id = s.id FROM chat_sessions s
-- WHERE m.wallet_address = s.wallet_address AND s.title = 'Previous chat' AND m.session_id IS NULL;

COMMENT ON TABLE chat_sessions IS 'One row per AI chat conversation; messages belong to a session.';
