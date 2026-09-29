"use client";

import Link from "next/link";
import { SideNav, BottomNav } from "@/components/shell/navigation";
import { CharacterSwitcher } from "@/components/shell/character-switcher";
import { SidePanel } from "@/components/shell/side-panel";
import { UnreadProvider } from "@/components/shell/unread-provider";
import { useSession } from "@/components/shell/session-provider";
import { site } from "@/lib/site";

/**
 * Moldura da rede.
 *
 * Shell pré-renderizado: a estrutura (colunas, navegação) é estática e não
 * espera o servidor. A identidade, o contador de não lidas e o painel de
 * descoberta são resolvidos aqui no navegador, com o mesmo RLS do servidor.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { viewer, isLoading } = useSession();

  if (!isLoading && !viewer) return null;

  const identities = viewer?.identities ?? [];
  const activeActorId = viewer?.activeActorId ?? null;
  const isGm = viewer?.isGm ?? false;
  const actorIds = identities.map((actor) => actor.id);

  return (
    <UnreadProvider initial={0} actorIds={actorIds}>
      <div className="min-h-dvh">
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-ink focus:px-3 focus:py-2 focus:text-bg"
        >
          Ir para o conteúdo
        </a>

        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface px-4 py-2.5 lg:hidden">
          <Link href="/home" className="font-display text-base leading-none text-ink">
            {site.name}
          </Link>
          {viewer ? (
            <CharacterSwitcher
              identities={identities}
              activeActorId={activeActorId}
              isGm={isGm}
            />
          ) : (
            <span className="label text-ink-3">{isLoading ? "…" : "sem identidade"}</span>
          )}
        </header>

        <div className="mx-auto flex w-full max-w-[1120px]">
          <aside className="sticky top-0 hidden h-dvh w-[240px] shrink-0 flex-col border-r border-line px-3 py-4 lg:flex xl:w-[264px]">
            <SideNav identities={identities} activeActorId={activeActorId} isGm={isGm} />
          </aside>

          <main id="conteudo" className="min-w-0 flex-1 border-line pb-20 lg:border-x lg:pb-0">
            {children}
          </main>

          <aside className="sticky top-0 hidden h-dvh w-[320px] shrink-0 overflow-y-auto py-4 pl-5 lg:block">
            <SidePanel />
          </aside>
        </div>

        <BottomNav identities={identities} activeActorId={activeActorId} />
      </div>
    </UnreadProvider>
  );
}