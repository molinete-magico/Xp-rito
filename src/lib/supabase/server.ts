import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { requireSupabaseEnv } from "@/lib/env";

/**
 * Cliente para Server Components e Server Actions.
 *
 * A sessão vive em cookies httpOnly; o RLS roda com o JWT do usuário, então
 * qualquer leitura aqui já é filtrada pelo banco. Este cliente não tem
 * `service_role` e não consegue passar por cima de nenhuma política.
 *
 * Em Server Components não é possível escrever cookies, então a renovação da
 * sessão é responsabilidade do `proxy.ts`. `setAll` só é usado em Server
 * Actions, onde é permitido.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = requireSupabaseEnv();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Component: sem escrita de cookies. O proxy renova a sessão.
        }
      },
    },
  });
}
