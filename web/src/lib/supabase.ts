import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

// When URL/key are missing (e.g. build without env), use a no-op mock so prerender doesn't throw
function createMockSupabase(): SupabaseClient {
  const empty = { data: null, error: null };
  const chain: Record<string, unknown> = {};
  const ret = () => chain;
  ["select", "insert", "update", "delete", "eq", "order", "limit", "match"].forEach((k) => (chain[k] = ret));
  chain.single = () => Promise.resolve(empty);
  chain.then = (resolve: (v: { data: null; error: null }) => void) => {
    resolve(empty);
    return Promise.resolve(empty);
  };
  return { from: () => chain } as unknown as SupabaseClient;
}

export const supabase: SupabaseClient =
  supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith("http")
    ? createClient(supabaseUrl, supabaseAnonKey)
    : createMockSupabase();
