# Supabase migrations

Run the SQL in `migrations/` from **Supabase Dashboard → SQL Editor** (or `supabase db push` if you use Supabase CLI).

- **20260210000000_chat_sessions.sql** – Creates `chat_sessions` and adds `session_id` to `chat_messages`. Required for multi-session AI chat (new chat / history per conversation).
