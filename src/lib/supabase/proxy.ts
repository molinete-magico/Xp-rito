import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextResponse as NextResponseType } from "next/server";
import type { NextRequest } from "next/server";
import type { Database } from "@/types/database";

const PUBLIC_ROUTES = ["/login", "/register", "/forgot-password", "/reset-password"];

function isPublicRoute(pathname: string) {
  return PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

/**
 * Renovação da sessão.
 *
 * `getUser()` revalida o JWT com o Supabase Auth (não confia no cookie) e
 * devolve cookies renovados quando o token está prestes a expirar. É também o
 * único ponto onde escrevemos cookies durante o ciclo de render.
 *
 * O proxy NÃO decide autorização: apenas redireciona quem não tem sessão para a
 * tela de entrada. Quem é o Mestre e quem é dono de cada identidade é perguntado
 * ao Postgres, no RLS.
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
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && !isPublicRoute(pathname)) {
    const target = request.nextUrl.clone();
    target.pathname = "/login";
    target.search = `?proximo=${encodeURIComponent(pathname + request.nextUrl.search)}`;
    return NextResponse.redirect(target);
  }

  if (user && isPublicRoute(pathname)) {
    const target = request.nextUrl.clone();
    target.pathname = "/home";
    target.search = "";
    return NextResponse.redirect(target);
  }

  return response;
}
