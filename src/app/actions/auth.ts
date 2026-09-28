"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { signInSchema, signUpSchema, fieldErrors, type ActionState } from "@/lib/validation/schemas";
import { ACTIVE_ACTOR_COOKIE } from "@/lib/session";

/**
 * Autenticação.
 *
 * Criptografia, sessão e recuperação de senha são do Supabase Auth: não há
 * hash de senha nem comparação no código. O formulário valida para dar retorno
 * útil; a Action revalida porque payload de cliente é entrada não confiável.
 */

export async function signInAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!isSupabaseConfigured) {
    return { ok: false, message: "Supabase não configurado. Veja .env.example." };
  }

  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { ok: false, message: "E-mail ou senha incorretos." };
  }

  redirect("/home");
}

export async function signUpAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!isSupabaseConfigured) {
    return { ok: false, message: "Supabase não configurado. Veja .env.example." };
  }

  const parsed = signUpSchema.safeParse({
    displayName: formData.get("displayName"),
    username: formData.get("username"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { username: parsed.data.username, display_name: parsed.data.displayName },
      // O link de confirmação volta para o app; a redefinição real ocorre na
      // página própria, que valida o token de recovery com o Auth.
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/reset-password`,
    },
  });

  if (error) {
    return { ok: false, message: translateAuthError(error.message) };
  }

  // Sem sessão ativa: o Supabase exigiu confirmação por e-mail.
  if (!data.session) {
    return {
      ok: true,
      message: "Conta criada. Confirme o e-mail que enviamos para entrar na rede.",
    };
  }

  revalidatePath("/home");
  redirect("/home");
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function requestResetAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!isSupabaseConfigured) {
    return { ok: false, message: "Supabase não configurado. Veja .env.example." };
  }

  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { ok: false, errors: { email: "Informe o e-mail da conta." } };

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/reset-password`,
  });

  // Resposta idêntica exista a conta ou não: não revelamos quem tem cadastro.
  return { ok: true, message: "Se houver uma conta com esse e-mail, o link de redefinição já saiu." };
}

export async function updatePasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");

  if (password.length < 8) {
    return { ok: false, errors: { password: "A senha precisa de ao menos 8 caracteres." } };
  }
  if (password !== confirmation) {
    return { ok: false, errors: { confirmation: "As senhas não conferem." } };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { ok: false, message: "O link expirou. Peça uma redefinição nova." };
  }

  redirect("/home");
}

/** Troca a identidade com quem se está publicando. */
export async function setActiveActorAction(actorId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // A autorização é a mesma do banco usada para publicar: se can_manage_actor
  // é falso, a identidade não entra no cookie e nada muda na interface.
  const { data: allowed } = await supabase.rpc("can_manage_actor", { target: actorId });

  if (allowed) {
    const cookieStore = await cookies();
    cookieStore.set(ACTIVE_ACTOR_COOKIE, actorId, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  revalidatePath("/", "layout");
}

/** Mensagens do Auth em português, sem vazar detalhes internos. */
function translateAuthError(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes("already registered") || normalized.includes("already been registered")) {
    return "Já existe uma conta com esse e-mail.";
  }
  if (normalized.includes("password should be")) {
    return "A senha precisa de ao menos 8 caracteres.";
  }
  if (normalized.includes("email address") && normalized.includes("invalid")) {
    return "E-mail inválido.";
  }
  if (normalized.includes("rate limit") || normalized.includes("too many")) {
    return "Muitas tentativas. Aguarde um instante e tente de novo.";
  }
  return "Não foi possível criar a conta agora.";
}
