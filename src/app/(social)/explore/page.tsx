import { requireViewer } from "@/lib/session";
import { loadPosts } from "@/lib/data/posts";
import { PostTimeline } from "@/components/timeline/post-timeline";
import { EmptyState } from "@/components/ui/empty-state";

/**
 * Explorar.
 *
 * Só duas leituras, ambas consultas diretas: tudo que a mesa escreveu e as
 * respostas do dono do personagem.
 */
export default async function ExplorePage({
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
        <h1 className="font-display text-lg text-ink">Explorar</h1>
      </div>

      <PostTimeline
        posts={page.posts}
        nextCursor={page.nextCursor}
        hasMore={page.hasMore}
        basePath="/explore"
        empty={
          <EmptyState title="Nada para explorar ainda" />
        }
      />
    </>
  );
}
