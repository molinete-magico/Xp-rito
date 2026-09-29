"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquarePlus, X } from "lucide-react";
import { useSession } from "@/components/shell/session-provider";
import { Checkbox, Field, FormMessage, TextInput } from "@/components/ui/field";
import { buttonClass } from "@/components/ui/button";
import { createGroupAction } from "@/app/actions/messages";
import { loadMessageCandidates } from "@/lib/data/messages";
import { idleState } from "@/lib/validation/schemas";
import type { ActorSummary } from "@/lib/types";

/**
 * Abrir uma conversa em grupo.
 *
 * Os candidatos são as contas que a pessoa já segue: o banco aceitaria qualquer
 * conta existente, mas convidar a mesa inteira por um clique errado é o tipo de
 * coisa que não se desfaz. Escolher o nome e os participantes é formulário, então
 * a ação entra por `useActionState` e devolve o id da conversa para navegar.
 */
export function NewGroupButton({ iconOnly = false }: { iconOnly?: boolean }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={iconOnly ? buttonClass("quiet", "sm", "px-2") : buttonClass("outline", "sm")}
        aria-label="Nova conversa em grupo"
      >
        <MessageSquarePlus aria-hidden="true" className="h-3.5 w-3.5" />
        {iconOnly ? null : "Nova conversa"}
      </button>
    );
  }

  return <NewGroupDialog onClose={() => setOpen(false)} />;
}

function NewGroupDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { viewer, client } = useSession();
  const [state, formAction, pending] = useActionState(createGroupAction, idleState);
  const [candidates, setCandidates] = useState<ActorSummary[] | null>(null);

  useEffect(() => {
    if (!client || !viewer) return;
    void loadMessageCandidates(client, viewer)
      .then(setCandidates)
      .catch(() => setCandidates([]));
  }, [client, viewer]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !pending) onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, pending]);

  useEffect(() => {
    if (state.ok && state.conversationId) {
      onClose();
      router.push(`/messages/${state.conversationId}`);
    }
  }, [state, onClose, router]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-6"
      onClick={(event) => {
        if (event.target === event.currentTarget && !pending) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Nova conversa em grupo"
        className="max-h-[90dvh] w-full max-w-md overflow-y-auto border border-line bg-surface p-5"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-base text-ink">Nova conversa</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="text-ink-3 hover:text-ink disabled:opacity-50"
            aria-label="Fechar"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>

        <form action={formAction} className="space-y-4">
          <Field label="Nome da conversa" error={state.errors?.title}>
            {(props) => <TextInput {...props} name="title" maxLength={60} autoFocus />}
          </Field>

          <fieldset className="space-y-2">
            <legend className="label mb-2 text-ink-2">Quem participa</legend>
            {state.errors?.members ? (
              <p role="alert" className="text-xs text-danger">
                {state.errors.members}
              </p>
            ) : null}

            {candidates === null ? (
              <p className="text-sm text-ink-3">Carregando…</p>
            ) : candidates.length === 0 ? (
              <p className="text-sm text-ink-3">
                Siga alguém para poder convidar. Ninguém que você não segue aparece aqui.
              </p>
            ) : (
              <ul className="max-h-64 space-y-1 overflow-y-auto border border-line p-2">
                {candidates.map((actor) => (
                  <li key={actor.id}>
                    <Checkbox
                      name="members"
                      value={actor.id}
                      label={actor.display_name}
                      description={`@${actor.username}`}
                    />
                  </li>
                ))}
              </ul>
            )}
          </fieldset>

          {state.message ? <FormMessage>{state.message}</FormMessage> : null}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} disabled={pending} className={buttonClass("quiet", "sm")}>
              Cancelar
            </button>
            <button type="submit" disabled={pending} className={buttonClass("primary", "sm")}>
              {pending ? "Abrindo…" : "Abrir conversa"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
