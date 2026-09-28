import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireViewer } from "@/lib/session";
import { loadPosts } from "@/lib/data/posts";
import { createClient } from "@/lib/supabase/server";
import { PostTimeline } from "@/components/timeline/post-timeline";
import { PostFeedSkeleton } from "@/components/timeline/post-feed-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { hashtagPath } from "@/lib/text/content";
import type { Viewer } from "@/lib/session";

/** Hashtags são minúsculas no banco; a URL pode chegar com acento ou #. */
function normalizeTag(raw: string): string {
  return raw
    .replace(/^#/, "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

export async function generateMetadata({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  return { title: `#${normalizeTag(name)}` };
}

export default async function HashtagPage({
  params,
  searchParams,
}: {
  params: Promise<{ name: string }>;
  searchParams: Promise<{ cursor?: string }>;
}) {
  const [{ name }, { cursor }] = await Promise.all([params, searchParams]);
  const viewer = await requireViewer();
  const tag = normalizeTag(name);

  return (
    <>
      <div className="border-b border-line px-4 py-3">
        <h1 className="font-mono text-lg text-ink">#{tag}</h1>
      </div>

      <Suspense fallback={<PostFeedSkeleton />}>
        <HashtagFeed viewer={viewer} tag={tag} cursor={cursor} />
      </Suspense>
    </>
  );
}

async function HashtagFeed({
  viewer,
  tag,
  cursor,
}: {
  viewer: Viewer;
  tag: string;
  cursor?: string;
}) {
  const page = await loadPosts(await createClient(), viewer, { kind: "hashtag", name: tag }, { cursor });

  if (page.posts.length === 0 && !cursor) notFound();

  return (
    <PostTimeline
      posts={page.posts}
      nextCursor={page.nextCursor}
      hasMore={page.hasMore}
      basePath={hashtagPath(tag)}
      empty={<EmptyState title="Nenhuma publicação com este assunto" />}
    />
  );
}