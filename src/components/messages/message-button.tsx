"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { startDirectAction } from "@/app/actions/messages";
import { buttonClass } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { useSession } from "@/components/shell/session-provider";
import { dmSenderChoice, dmVoiceIdentities } from "@/lib/data/identities";
import { accountTypeLabels, accountTypeOf } from "@/lib/site";

/**
 * Mensagem para um perfil.
 *
 * Abre a conversa direta e leva direto até ela. A recusa do banco aparece ao lado
 * do botão em vez de sumir com ele: o motivo importa quando a conversa não abre
 * (falta personagem próprio, ou a conta é a própria pessoa).
 *
 * Quem tem mais de um personagem com quem falar escolhe qual manda a primeira
 * mensagem: o Mestre abre a conversa como Autumn ou como o NPC. A escolha fica
 * num `<select>` ao lado do botão e some sozinha quando há só uma voz possível,
 * porque ai não há o que escolher.
 */
export function MessageButton({ targetActorId }: { targetActorId: string }) {
  const router = useRouter();
  const { viewer } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const voices = viewer ? dmVoiceIdentities(viewer) : [];
  const [senderId, setSenderId] = useState<string | null>(null);
  // Sem escolha explícita, a action decide (personagem ativo, ou o primeiro).
  const sender = viewer ? dmSenderChoice(viewer, senderId) : null;

  function open() {
    setError(null);
    startTransition(async () => {
      const result = await startDirectAction(targetActorId, senderId ?? undefined);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      router.push(`/messages/${result.conversationId}`);
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex items-center gap-2">
        {voices.length > 1 ? (
          <>
            <label htmlFor={`abrir-com-${targetActorId}`} className="sr-only">
              Abrir a conversa como
            </label>
            <Select
              id={`abrir-com-${targetActorId}`}
              value={sender?.id ?? ""}
              onChange={(event) => setSenderId(event.currentTarget.value)}
              className="max-w-[9.5rem]"
            >
              {voices.map((voice) => (
                <option key={voice.id} value={voice.id}>
                  {voice.display_name}
                </option>
              ))}
            </Select>
          </>
        ) : null}

        <button
          type="button"
          onClick={open}
          disabled={pending || !sender}
          className={buttonClass("outline", "sm")}
        >
          <MessageCircle aria-hidden="true" className="h-3.5 w-3.5" />
          {pending ? "Abrindo…" : "Mensagem"}
        </button>
      </div>

      {error ? (
        <span role="alert" className="text-xs text-danger">
          {error}
        </span>
      ) : null}
    </div>
  );
}
