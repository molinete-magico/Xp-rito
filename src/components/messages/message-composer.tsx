"use client";

import { useActionState, useEffect, useRef } from "react";
import { Send } from "lucide-react";
import { sendMessageAction } from "@/app/actions/messages";
import { idleState } from "@/lib/validation/schemas";
import { buttonClass } from "@/components/ui/button";

const MAX = 4000;

/**
 * Compositor da conversa.
 *
 * A mensagem entra na tela antes de o banco responder e some se ele recusar, como
 * o resto das interações do projeto: `onPending` mostra, `onSettled` desfaz ou
 * confirma. Envio é Enter e quebra de linha é Shift+Enter, que é o que se espera
 * de um chat; a caixa cresce até um teto para não engolir a conversa.
 */
export function MessageComposer({
  conversationId,
  onPending,
  onSettled,
}: {
  conversationId: string;
  /** Mostra a mensagem na hora e devolve o id temporário. */
  onPending: (content: string) => string;
  /** `true` confirmou (a lista recarrega), `false` desfaz pelo id. */
  onSettled: (ok: boolean, optimisticId: string) => void;
}) {
  const [state, formAction, pending] = useActionState(sendMessageAction, idleState);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inFlight = useRef<string | null>(null);
  const wasPending = useRef(false);

  // A Action terminou: confirma ou desfaz a mensagem que já estava na tela.
  useEffect(() => {
    if (wasPending.current && !pending) {
      const id = inFlight.current;
      inFlight.current = null;
      if (id) {
        if (state.ok && textareaRef.current) textareaRef.current.value = "";
        onSettled(state.ok, id);
      }
    }
    wasPending.current = pending;
  }, [pending, state, onSettled]);

  return (
    <form
      action={formAction}
      className="border-t border-line bg-surface px-4 py-3"
      onSubmit={(event) => {
        const content = textareaRef.current?.value.trim();
        // Vazio não vai ao banco: a mensagem otimista mostraria e voltaria.
        if (!content) {
          event.preventDefault();
          return;
        }
        onPending(content);
      }}
    >
      <input type="hidden" name="conversationId" value={conversationId} />

      <label htmlFor={`composer-${conversationId}`} className="sr-only">
        Escreva uma mensagem
      </label>
      <div className="flex items-end gap-2">
        <textarea
          id={`composer-${conversationId}`}
          ref={textareaRef}
          name="content"
          rows={1}
          maxLength={MAX}
          placeholder="Escreva uma mensagem"
          onInput={(event) => {
            const field = event.currentTarget;
            field.style.height = "auto";
            field.style.height = `${Math.min(field.scrollHeight, 200)}px`;
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          className="max-h-[200px] w-full resize-none rounded-xs border border-line-2 bg-surface px-3 py-2 text-sm leading-relaxed text-ink placeholder:text-ink-3 focus:border-ink focus:outline-none"
        />
        <button type="submit" disabled={pending} className={buttonClass("primary", "sm", "shrink-0")}>
          <Send aria-hidden="true" className="h-3.5 w-3.5" />
          <span className="sr-only">Enviar</span>
        </button>
      </div>

      {state.errors?.content || state.message ? (
        <p role="alert" className="mt-2 text-xs text-danger">
          {state.errors?.content ?? state.message}
        </p>
      ) : null}
    </form>
  );
}
