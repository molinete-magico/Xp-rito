import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    await supabase.from("profiles").select("id", { count: "exact", head: true });
  } catch {
    // Bene que o cron siga respondendo mesmo se o banco estiver indisponível.
  }

  return new Response("ok", { status: 200, headers: { "cache-control": "no-store" } });
}