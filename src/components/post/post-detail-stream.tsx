"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useSession } from "@/components/shell/session-provider";
import { loadPostById, loadReplies } from "@/lib/data/posts";
import { PostCard } from "@/components/post/post-card";
import { ReplyComposer } from "@/components/composer/reply-composer";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { PostFeedSkeleton } from "@/components/timeline/post-feed-skeleton";
import { fullTimestamp } from "@/lib/format/datetime";
import type { PostCard as PostCardData } from "@/lib/types";

/**
 * Publicação no navegador.
 *
 * A moldura estática traz o "voltar"; o post em si, as respostas e quem pode
 * responder são resolvidos aqui. Re-monta sempre que o post muda de estado
 * (denúncia, resposta nova) via evento do compositor.
 */
export function PostDetailStream({ postId }: { postId: string }) {
  const { viewer, client, isLoading } = useSession();
  const [post, setPost] = useState<PostCardData | null | undefined>(undefined);
  const [replies, setReplies] = useState<PostCardData[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!client || !viewer || isLoading) return;
    let cancelled = false;

    (async () => {
      const [loadedPost, loadedReplies] = await Promise.all([
        loadPostById(client, viewer, postId),
        loadReplies(client, viewer, postId),
      ]);
      if (cancelled) return;
      setFailed(false);
      setPost(loadedPost);
      setReplies(loadedReplies);
    })().catch(() => {
      if (!cancelled) setFailed(true);
    });

    return () => {
      cancelled = true;
    };
  }, [client, viewer, isLoading, postId]);

  useEffect(() => {
    if (!client || !viewer) return;
    const onRefresh = () => {
      setFailed(false);
      void Promise.all([
        loadPostById(client, viewer, postId),
        loadReplies(client, viewer, postId),
      ]).then(
        ([loadedPost, loadedReplies]) => {
          setPost(loadedPost);
          setReplies(loadedReplies);
        },
        () => setFailed(true),
      );
    };
    window.addEventListener("xpirito:refresh", onRefresh);
    return () => window.removeEventListener("xpirito:refresh", onRefresh);
  }, [client, viewer, postId]);

  if (failed) return <ErrorState />;

  if (!viewer || isLoading || post === undefined) {
    return (
      <div>
        <HeaderSkeleton />
        <PostFeedSkeleton rows={2} />
      </div>
    );
  }

  if (post === null) return <EmptyState title="Publicação não encontrada" />;

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

      <p className="label border-y border-line px-4 py-1.5 text-ink-3">
        {replies.length === 0
          ? "nenhuma resposta"
          : `${replies.length} ${replies.length === 1 ? "resposta" : "respostas"}`}
      </p>

      {viewer.identities.length > 0 ? (
        <div className="border-b border-line">
          <ReplyComposer
            postId={post.id}
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

function HeaderSkeleton() {
  return (
    <div className="flex items-center gap-2 border-b border-line px-4 py-2.5" aria-hidden="true">
      <span className="h-4 w-14 animate-pulse rounded-sm bg-sunken" />
    </div>
  );
}