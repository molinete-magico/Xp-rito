import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { requireSupabaseEnv } from "@/lib/env";

/**
 * Cliente do navegador. Usa a key pública `anon`; nenhuma chave de service role
 * pode chegar aqui, porque a autorização real acontece no Postgres.
 */
export function createClient() {
  const { url, anonKey } = requireSupabaseEnv();
  return createBrowserClient<Database>(url, anonKey);
}
