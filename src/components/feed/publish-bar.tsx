"use client";

import { PostComposer } from "@/components/composer/post-composer";
import { useSession } from "@/components/shell/session-provider";
import { ButtonLink } from "@/components/ui/button";

/**
 * Frente da área de publicação.
 *
 * O shell do feed é estático; quem decide entre o compositor (tem personagem)
 * e a chamada "crie um personagem" (entrou sem identidade) é a sessão, aqui no
 * navegador.
 */
export function PublishBar() {
  const { viewer, isLoading } = useSession();

  if (isLoading) {
    return (
      <div className="border-b border-line px-4 py-4" aria-hidden="true">
        <div className="flex items-center gap-3">
          <span className="size-9 animate-pulse rounded-full bg-sunken" />
          <span className="h-8 flex-1 animate-pulse rounded-sm bg-sunken" />
        </div>
      </div>
    );
  }

  if (!viewer || viewer.identities.length === 0) {
    return (
      <div className="border-b border-line px-4 py-5">
        <p className="text-sm text-ink-2">
          Você entrou, mas ainda não tem personagem na mesa.
        </p>
        <ButtonLink href="/settings" size="sm" className="mt-3">
          Criar personagem
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="border-b border-line">
      <PostComposer />
    </div>
  );
}