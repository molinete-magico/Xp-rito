/**
 * Leitura das variáveis públicas do Supabase.
 *
 * `SUPABASE_SERVICE_ROLE_KEY` NÃO é lido aqui, nem existe no escopo do Next.js:
 * o bundle do cliente nunca deve enxergar uma chave privilegiada. O build falha
 * cedo se as duas variáveis públicas estiverem ausentes, o que prefere um erro
 * claro a uma aplicação que quebra em runtime.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const env = {
  NEXT_PUBLIC_SUPABASE_URL: url,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
} as const;

export const isSupabaseConfigured = Boolean(url && anonKey);

export class MissingSupabaseEnvError extends Error {
  constructor() {
    super(
      "NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY não estão definidas. Copie .env.example para .env.local e preencha os valores do seu projeto Supabase.",
    );
    this.name = "MissingSupabaseEnvError";
  }
}

export function requireSupabaseEnv() {
  if (!isSupabaseConfigured) {
    throw new MissingSupabaseEnvError();
  }
  return { url: url as string, anonKey: anonKey as string };
}
