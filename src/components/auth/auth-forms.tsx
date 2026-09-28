"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  requestResetAction,
  signInAction,
  signUpAction,
  updatePasswordAction,
} from "@/app/actions/auth";
import { Field, TextInput } from "@/components/ui/field";
import { buttonClass } from "@/components/ui/button";
import { idleState, type ActionState } from "@/lib/validation/schemas";
import { normalizeUsername } from "@/lib/validation/username";
import { Check } from "lucide-react";

/**
 * Formulários de entrada.
 *
 * O mesmo trio de ações em todas as telas: submeter é um POST de verdade (a
 * página funciona sem JavaScript), o erro volta renderizado pelo estado da
 * Action e a navegação acontece no servidor por `redirect`.
 */
export function LoginForm() {
  const [state, formAction, pending] = useActionState(signInAction, idleState);

  return (
    <form action={formAction} className="space-y-4">
      <Field label="E-mail" error={state.errors?.email}>
        {(props) => (
          <TextInput
            {...props}
            name="email"
            type="email"
            autoComplete="email"
            placeholder="voce@exemplo.com"
            required
          />
        )}
      </Field>

      <Field label="Senha" error={state.errors?.password}>
        {(props) => (
          <TextInput {...props} name="password" type="password" autoComplete="current-password" required />
        )}
      </Field>

      <Feedback state={state} />

      <button type="submit" disabled={pending} className={buttonClass("primary", "md", "w-full")}>
        {pending ? "Entrando…" : "Entrar"}
      </button>

      <div className="flex items-center justify-between text-xs text-ink-3">
        <Link href="/forgot-password" className="hover:underline">
          Esqueceu a senha?
        </Link>
        <Link href="/register" className="text-ink hover:underline">
          Criar conta
        </Link>
      </div>
    </form>
  );
}

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(signUpAction, idleState);

  return (
    <form action={formAction} className="space-y-4">
      <Field label="Como a mesa te chama" error={state.errors?.displayName}>
        {(props) => (
          <TextInput {...props} name="displayName" placeholder="Alexandre Duarte" required />
        )}
      </Field>

      <Field
        label="Seu @handle"
        hint="Minúsculas, números, ponto e sublinhado. É como você assina na rede."
        error={state.errors?.username}
      >
        {(props) => (
          <TextInput
            {...props}
            name="username"
            placeholder="alexandre"
            className="font-mono"
            onChange={(event) => {
              event.currentTarget.value = normalizeUsername(event.currentTarget.value);
            }}
            required
          />
        )}
      </Field>

      <Field label="E-mail" error={state.errors?.email}>
        {(props) => (
          <TextInput {...props} name="email" type="email" autoComplete="email" placeholder="voce@exemplo.com" required />
        )}
      </Field>

      <Field label="Senha" hint="Ao menos 8 caracteres." error={state.errors?.password}>
        {(props) => (
          <TextInput {...props} name="password" type="password" autoComplete="new-password" required />
        )}
      </Field>

      <Feedback state={state} />

      <button type="submit" disabled={pending} className={buttonClass("primary", "md", "w-full")}>
        {pending ? "Criando…" : "Criar conta"}
      </button>

      <p className="text-center text-xs text-ink-3">
        Já faz parte?{" "}
        <Link href="/login" className="text-ink hover:underline">
          Entrar
        </Link>
      </p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestResetAction, idleState);

  return (
    <form action={formAction} className="space-y-4">
      <Field label="E-mail" error={state.errors?.email}>
        {(props) => (
          <TextInput {...props} name="email" type="email" autoComplete="email" required />
        )}
      </Field>

      <Feedback state={state} />

      <button type="submit" disabled={pending} className={buttonClass("primary", "md", "w-full")}>
        {pending ? "Enviando…" : "Enviar link de redefinição"}
      </button>

      <p className="text-center text-xs text-ink-3">
        Lembrou a senha?{" "}
        <Link href="/login" className="text-ink hover:underline">
          Entrar
        </Link>
      </p>
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(updatePasswordAction, idleState);

  return (
    <form action={formAction} className="space-y-4">
      <Field label="Nova senha" hint="Ao menos 8 caracteres." error={state.errors?.password}>
        {(props) => (
          <TextInput {...props} name="password" type="password" autoComplete="new-password" required />
        )}
      </Field>

      <Field label="Repetir a senha" error={state.errors?.confirmation}>
        {(props) => (
          <TextInput {...props} name="confirmation" type="password" autoComplete="new-password" required />
        )}
      </Field>

      <Feedback state={state} />

      <button type="submit" disabled={pending} className={buttonClass("primary", "md", "w-full")}>
        {pending ? "Salvando…" : "Salvar nova senha"}
      </button>
    </form>
  );
}

function Feedback({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return state.ok ? (
    <p role="status" className="text-xs text-ink-2">
      <Check aria-hidden="true" className="mr-1 inline h-3 w-3" />
      {state.message}
    </p>
  ) : (
    <p role="alert" className="border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-danger-strong">
      {state.message}
    </p>
  );
}