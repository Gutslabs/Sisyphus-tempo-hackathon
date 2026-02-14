# Supabase migrations

Run the SQL in `migrations/` from **Supabase Dashboard → SQL Editor** (or `supabase db push` if you use Supabase CLI).

- **20260209000000_core_tables.sql** – Creates core tables used by the app (`chat_messages`, `transactions`, `limit_orders`).
- **20260210000000_chat_sessions.sql** – Creates `chat_sessions` and adds `session_id` to `chat_messages`. Required for multi-session AI chat (new chat / history per conversation).
