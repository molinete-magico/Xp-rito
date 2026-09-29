"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { startDirectAction } from "@/app/actions/messages";
import { buttonClass } from "@/components/ui/button";

/**
 * Mensagem para um perfil.
 *
 * Abre a conversa direta e leva direto até ela. A recusa do banco aparece ao lado
 * do botão em vez de sumir com ele: o motivo importa quando a conversa não abre
 * (falta personagem próprio, ou a conta é a própria pessoa).
 */
export function MessageButton({ targetActorId }: { targetActorId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function open() {
    setError(null);
    startTransition(async () => {
      const result = await startDirectAction(targetActorId);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      router.push(`/messages/${result.conversationId}`);
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={open}
        disabled={pending}
        className={buttonClass("outline", "sm")}
      >
        <MessageCircle aria-hidden="true" className="h-3.5 w-3.5" />
        {pending ? "Abrindo…" : "Mensagem"}
      </button>

      {error ? (
        <span role="alert" className="text-xs text-danger">
          {error}
        </span>
      ) : null}
    </div>
  );
}
