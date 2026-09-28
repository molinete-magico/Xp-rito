import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireViewer } from "@/lib/session";
import { loadPostById, loadReplies } from "@/lib/data/posts";
import { createClient } from "@/lib/supabase/server";
import { PostCard } from "@/components/post/post-card";
import { ReplyComposer } from "@/components/composer/reply-composer";
import { EmptyState } from "@/components/ui/empty-state";
import { fullTimestamp } from "@/lib/format/datetime";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireViewer();
  const client = await createClient();
  const post = await loadPostById(client, viewer, id);
  if (!post) return { title: "Publicação" };

  const text = post.reposted ? post.reposted.post.content : post.content;
  return {
    title: text ? text.slice(0, 60) : `Publicação de ${post.author.display_name}`,
    description: (text ?? "").slice(0, 160),
  };
}

/**
 * Página de uma publicação.
 *
 * O "voltar" é para quem entrou por link; quem veio do feed usa o navegador. As
 * respostas vêm em ordem cronológica, da mais antiga para a mais nova.
 */
export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireViewer();
  const client = await createClient();
  const post = await loadPostById(client, viewer, id);

  if (!post) notFound();

  const replies = await loadReplies(client, viewer, id);

  return (
    <>
      <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
        <Link
          href="/home"
          className="flex items-center gap-1.5 text-sm text-ink-2 transition-colors hover:text-ink"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          Voltar
        </Link>
      </div>

      <PostCard post={post} variant="detail" hideContext />

      <p className="border-y border-line px-4 py-1.5 label text-ink-3">
        {replies.length === 0
          ? "nenhuma resposta"
          : `${replies.length} ${replies.length === 1 ? "resposta" : "respostas"}`}
      </p>

      {viewer.identities.length > 0 ? (
        <div className="border-b border-line">
          <ReplyComposer
            postId={post.id}
            identities={viewer.identities}
            activeActorId={viewer.activeActorId}
            authorName={post.author.display_name}
          />
        </div>
      ) : (
        <p className="border-b border-line px-4 py-4 text-sm text-ink-2">
          Crie um personagem para poder responder.
        </p>
      )}

      {replies.length === 0 ? (
        <EmptyState title="Ninguém respondeu" />
      ) : (
        replies.map((reply) => <PostCard key={reply.id} post={reply} />)
      )}

      <p className="px-4 py-6 text-center text-[11px] text-ink-3">
        Publicada em {fullTimestamp(post.created_at)}
      </p>
    </>
  );
}
