"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { Send } from "lucide-react";
import { sendMessageAction } from "@/app/actions/messages";
import { idleState } from "@/lib/validation/schemas";
import { buttonClass } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Select } from "@/components/ui/field";
import type { ActorSummary } from "@/lib/types";

const MAX = 4000;

/**
 * Compositor da conversa.
 *
 * A mensagem entra na tela antes de o banco responder e some se ele recusar, como
 * o resto das interações do projeto: `onPending` mostra, `onSettled` desfaz ou
 * confirma. Envio é Enter e quebra de linha é Shift+Enter, que é o que se espera
 * de um chat; a caixa cresce até um teto para não engolir a conversa.
 *
 * Com mais de um personagem na conversa, quem escreve escolhe de quem é a fala.
 * Só aparece o seletor quando há escolha de verdade: com um personagem só, um
 * `<select>` na tela seria ruído. O componente é remontado por conversa (o `key`
 * vem do pai), então trocar de thread nunca leva o remetente da conversa anterior
 * junto — nem precisa guardar nada em disco para isso.
 */
export function MessageComposer({
  conversationId,
  speakers,
  activeActorId,
  onPending,
  onSettled,
}: {
  conversationId: string;
  /** Personagens com que quem está na conversa pode falar (banco é a autoridade). */
  speakers: ActorSummary[];
  /** Personagem com que a pessoa está aberta, para já começar nele quando dá. */
  activeActorId: string | null;
  /** Mostra a mensagem na hora, com este remetente, e devolve o id temporário. */
  onPending: (sender: ActorSummary, content: string) => string;
  /** `true` confirmou (a lista recarrega), `false` desfaz pelo id. */
  onSettled: (ok: boolean, optimisticId: string) => void;
}) {
  const [state, formAction, pending] = useActionState(sendMessageAction, idleState);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inFlight = useRef<string | null>(null);
  const wasPending = useRef(false);
  const [senderId, setSenderId] = useState<string>("");

  // Começa no personagem ativo, se ele estiver na conversa; senão no primeiro
  // disponível. `speakers` muda quando a conversa carrega, e aí a lista manda.
  const chosen = useMemo(
    () => speakers.find((speaker) => speaker.id === senderId)
      ?? speakers.find((speaker) => speaker.id === activeActorId)
      ?? speakers[0]
      ?? null,
    [speakers, senderId, activeActorId],
  );

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
        if (!content || !chosen) {
          event.preventDefault();
          return;
        }
        // O id devolvido é o que amarra a mensagem otimista à resposta do banco.
        // Sem guardar aqui, `inFlight` fica vazio, o efeito de conclusão não tem o
        // que confirmar, e a mensagem otimista nunca sai da tela: quando a versão
        // real chega pelo Realtime, a pessoa vê a mesma mensagem duas vezes.
        inFlight.current = onPending(chosen, content);
      }}
    >
      <input type="hidden" name="conversationId" value={conversationId} />
      <input type="hidden" name="senderActorId" value={chosen?.id ?? ""} />

      <label htmlFor={`composer-${conversationId}`} className="sr-only">
        Escreva uma mensagem
      </label>
      <div className="flex items-end gap-2">
        {speakers.length > 1 ? (
          <div className="flex min-w-0 shrink-0 items-center gap-1.5">
            {chosen ? (
              <Avatar
                name={chosen.display_name}
                username={chosen.username}
                src={chosen.avatar_url}
                size="sm"
                decorative
              />
            ) : null}
            <label htmlFor={`sender-${conversationId}`} className="sr-only">
              Enviar como
            </label>
            <Select
              id={`sender-${conversationId}`}
              name="senderEscolhido"
              value={chosen?.id ?? ""}
              onChange={(event) => setSenderId(event.currentTarget.value)}
              className="max-w-[9.5rem]"
            >
              {speakers.map((speaker) => (
                <option key={speaker.id} value={speaker.id}>
                  {speaker.display_name}
                </option>
              ))}
            </Select>
          </div>
        ) : null}

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
        <button type="submit" disabled={pending || !chosen} className={buttonClass("primary", "sm", "shrink-0")}>
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
