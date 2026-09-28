import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextResponse as NextResponseType } from "next/server";
import type { NextRequest } from "next/server";
import type { Database } from "@/types/database";

const PUBLIC_ROUTES = ["/login", "/register", "/forgot-password", "/reset-password"];

function isPublicRoute(pathname: string) {
  return PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

/**
 * Renovação da sessão — checagem otimista.
 *
 * O proxy roda em todas as rotas, inclusive nos prefetch de links. Por isso a
 * leitura aqui é apenas do cookie (getSession decodifica o JWT localmente); só
 * quando o token está perto de vencer o SDK conversa com o Supabase Auth para
 * renová-lo. A validação de verdade acontece onde os dados moram: no Postgres,
 * via RLS, e no `getUser()` das leituras geradas sob demanda.
 *
 * O proxy NÃO decide autorização: apenas redireciona quem não tem sessão para a
 * tela de entrada. Quem é o Mestre e quem é dono de cada identidade é perguntado
 * ao Postgres.
 */
export async function refreshSession(request: NextRequest): Promise<NextResponseType> {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Sem configuração não há sessão para renovar: deixa a página de configuração
  // explicar o que falta em vez de redirecionar em laço.
  if (!url || !anonKey) {
    return response;
  }

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const { pathname } = request.nextUrl;
  const hasSession = Boolean(session?.access_token);

  if (!hasSession && !isPublicRoute(pathname)) {
    const target = request.nextUrl.clone();
    target.pathname = "/login";
    target.search = `?proximo=${encodeURIComponent(pathname + request.nextUrl.search)}`;
    return NextResponse.redirect(target);
  }

  if (hasSession && isPublicRoute(pathname)) {
    const target = request.nextUrl.clone();
    target.pathname = "/home";
    target.search = "";
    return NextResponse.redirect(target);
  }

  return response;
}