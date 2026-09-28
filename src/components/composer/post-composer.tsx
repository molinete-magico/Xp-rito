"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { createPostAction } from "@/app/actions/posts";
import { Avatar } from "@/components/ui/avatar";
import { IdentitySwitcher } from "@/components/composer/identity-switcher";
import { MediaUploader, type PendingMedia } from "@/components/composer/media-uploader";
import { useSession } from "@/components/shell/session-provider";
import { FormMessage, TextArea } from "@/components/ui/field";
import { buttonClass } from "@/components/ui/button";
import { idleState } from "@/lib/validation/schemas";
import { cn } from "@/lib/cn";
import type { ActorSummary } from "@/lib/types";

const MAX_LENGTH = 1000;

/**
 * Compositor de publicação.
 *
 * Server Action com `useActionState`: o envio é um POST de verdade, o estado de
 * erro volta pelo servidor e o formulário continua funcionando se o JavaScript
 * demorar. Ctrl/Cmd+Enter publica.
 */
export function PostComposer({
  identities: explicitIdentities,
  activeActorId: explicitActiveActorId,
  compact = false,
  placeholder,
}: {
  identities?: ActorSummary[];
  activeActorId?: string | null;
  compact?: boolean;
  placeholder?: string;
}) {
  const router = useRouter();
  const session = useSession();
  const identities = explicitIdentities ?? session.viewer?.identities ?? [];
  const activeActorId =
    explicitActiveActorId !== undefined
      ? explicitActiveActorId
      : (session.viewer?.activeActorId ?? null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(createPostAction, idleState);
  const [content, setContent] = useState("");
  const [media, setMedia] = useState<PendingMedia[]>([]);

  const active = identities.find((actor) => actor.id === activeActorId) ?? identities[0] ?? null;
  const over = content.length > MAX_LENGTH;
  const remaining = MAX_LENGTH - content.length;
  const canSubmit = !over && (content.trim().length > 0 || media.length > 0) && !pending;

  // `useActionState` devolve um objeto novo a cada envio. Quando o último estado
  // vira sucesso, limpamos conteúdo e mídia durante o render; o trabalho de DOM
  // (reset e foco) fica no efeito.
  const [handled, setHandled] = useState(state);
  const justSucceeded = state !== handled && state.ok;
  if (justSucceeded) {
    setHandled(state);
    setContent("");
    setMedia([]);
  }

  useEffect(() => {
    if (!state.ok) return;
    formRef.current?.reset();
    textareaRef.current?.focus();
    window.dispatchEvent(new Event("xpirito:refresh"));
    router.refresh();
  }, [state.ok, router]);

  useEffect(() => {
    const node = textareaRef.current;
    if (!node) return;

    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        if (canSubmit) formRef.current?.requestSubmit();
      }
    }

    node.addEventListener("keydown", onKeyDown);
    return () => node.removeEventListener("keydown", onKeyDown);
  }, [canSubmit]);

  if (!active) {
    return (
      <div className="px-4 py-6">
        <p className="text-sm leading-relaxed text-ink-2">
          Você ainda não tem nenhuma identidade. Crie um personagem para começar a publicar.
        </p>
      </div>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="px-4 py-3">
      <input type="hidden" name="actorId" value={active.id} />
      <input type="hidden" name="media" value={JSON.stringify(media)} />

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
            ref={textareaRef}
            name="content"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            rows={compact ? 2 : 3}
            placeholder={placeholder ?? `O que está acontecendo, ${active.display_name.split(" ")[0]}?`}
            aria-label="Texto da publicação"
            aria-invalid={over}
            className={cn(
              "border-0 bg-transparent px-0 py-1 text-[15px] focus:outline-none",
              compact && "min-h-16",
            )}
          />

          <MediaUploader ownerActorId={active.id} media={media} onChange={setMedia} disabled={pending} />

          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
            <span
              className={cn(
                "font-mono text-[11px] tabular-nums",
                over ? "text-danger" : remaining < 100 ? "text-ink-2" : "text-ink-3",
              )}
              aria-live="polite"
            >
              {over ? `+${-remaining} além do limite` : remaining}
            </span>

            <button type="submit" disabled={!canSubmit} className={buttonClass("primary", "sm")}>
              <Send aria-hidden="true" className="h-3.5 w-3.5" />
              {pending ? "Publicando…" : "Publicar"}
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
