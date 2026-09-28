import { requireViewer } from "@/lib/session";
import { loadPosts } from "@/lib/data/posts";
import { PostComposer } from "@/components/composer/post-composer";
import { PostTimeline } from "@/components/timeline/post-timeline";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";

/**
 * Feed principal.
 *
 * Tudo que a mesa publicou, do mais recente para o mais antigo. Sem filtro
 * "quem eu sigo" no caminho padrão, porque num grupo pequeno o filtro esconde as
 * publicações que a pessoa veio ler.
 */
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const { cursor } = await searchParams;
  const viewer = await requireViewer();
  const page = await loadPosts(viewer, { kind: "recentes" }, { cursor });

  return (
    <>
      <div className="border-b border-line px-4 py-3">
        <h1 className="font-display text-lg text-ink">Início</h1>
      </div>

      {viewer.identities.length > 0 ? (
        <div className="border-b border-line">
          <PostComposer identities={viewer.identities} activeActorId={viewer.activeActorId} />
        </div>
      ) : (
        <div className="border-b border-line px-4 py-5">
          <p className="text-sm text-ink-2">
            Você entrou, mas ainda não tem personagem na mesa.
          </p>
          <ButtonLink href="/settings" size="sm" className="mt-3">
            Criar personagem
          </ButtonLink>
        </div>
      )}

      <PostTimeline
        posts={page.posts}
        nextCursor={page.nextCursor}
        hasMore={page.hasMore}
        basePath="/home"
        empty={
          <EmptyState title="A rede está em silêncio" />
        }
      />
    </>
  );
}
