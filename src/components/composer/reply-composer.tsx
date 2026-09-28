"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { replyAction } from "@/app/actions/posts";
import { Avatar } from "@/components/ui/avatar";
import { IdentitySwitcher } from "@/components/composer/identity-switcher";
import { useSession } from "@/components/shell/session-provider";
import { FormMessage, TextArea } from "@/components/ui/field";
import { buttonClass } from "@/components/ui/button";
import { idleState } from "@/lib/validation/schemas";
import type { ActorSummary } from "@/lib/types";

/**
 * Resposta a uma publicação.
 *
 * Sem imagem: a resposta é curta e é lida no meio de uma conversa. Quando não
 * recebe identidades, usa a sessão do navegador.
 */
export function ReplyComposer({
  postId,
  authorName,
  identities: explicitIdentities,
  activeActorId: explicitActiveActorId,
}: {
  postId: string;
  authorName: string;
  identities?: ActorSummary[];
  activeActorId?: string | null;
}) {
  const router = useRouter();
  const session = useSession();
  const identities = explicitIdentities ?? session.viewer?.identities ?? [];
  const activeActorId =
    explicitActiveActorId !== undefined ? explicitActiveActorId : (session.viewer?.activeActorId ?? null);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(replyAction, idleState);
  const [content, setContent] = useState("");

  const active = identities.find((actor) => actor.id === activeActorId) ?? identities[0] ?? null;

  const [handled, setHandled] = useState(state);
  const justSucceeded = state !== handled && state.ok;
  if (justSucceeded) {
    setHandled(state);
    setContent("");
  }

  useEffect(() => {
    if (!state.ok) return;
    formRef.current?.reset();
    window.dispatchEvent(new Event("xpirito:refresh"));
    router.refresh();
  }, [state.ok, router]);

  if (!active) return null;

  return (
    <form ref={formRef} action={formAction} className="px-4 py-3">
      <input type="hidden" name="postId" value={postId} />
      <input type="hidden" name="actorId" value={active.id} />

      {state.message ? (
        <div className="mb-3">
          <FormMessage>{state.message}</FormMessage>
        </div>
      ) : null}
      {state.errors?.content ? (
        <p role="alert" className="mb-2 text-xs text-danger">
          {state.errors.content}
        </p>
      ) : null}

      <div className="flex gap-3">
        <Avatar
          name={active.display_name}
          username={active.username}
          src={active.avatar_url}
          size="sm"
          decorative
        />

        <div className="min-w-0 flex-1">
          <TextArea
            name="content"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            rows={2}
            maxLength={1000}
            placeholder={`Responder ${authorName.split(" ")[0]}…`}
            aria-label={`Responder a publicação de ${authorName}`}
            className="border-0 bg-transparent px-0 py-1 text-[15px] focus:outline-none"
          />

          <div className="mt-2 flex items-center gap-2 border-t border-line pt-2">
            <span className="font-mono text-[11px] text-ink-3 tabular-nums" aria-live="polite">
              {1000 - content.length}
            </span>
            <button
              type="submit"
              disabled={pending || content.trim().length === 0}
              className={buttonClass("primary", "sm", "ml-auto")}
            >
              <Send aria-hidden="true" className="h-3.5 w-3.5" />
              {pending ? "Enviando…" : "Responder"}
            </button>
          </div>

          {identities.length > 1 ? (
            <div className="mt-3 max-w-56">
              <IdentitySwitcher identities={identities} activeActorId={active.id} size="sm" />
            </div>
          ) : null}
        </div>
      </div>
    </form>
  );
}
