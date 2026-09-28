import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireViewer } from "@/lib/session";
import { loadActorByUsername } from "@/lib/data/actors";
import { loadPosts } from "@/lib/data/posts";
import { ProfileHeader } from "@/components/profile/profile-header";
import { PostComposer } from "@/components/composer/post-composer";
import { PostTimeline } from "@/components/timeline/post-timeline";
import { PostFeedSkeleton } from "@/components/timeline/post-feed-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { accountTypeLabels, accountTypeOf } from "@/lib/site";
import type { ActorSummary } from "@/lib/types";
import type { Viewer } from "@/lib/session";
import type { PostScope } from "@/lib/data/posts";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  return { title: `@${username}` };
}

type Tab = "posts" | "respostas" | "reposts";

const tabs: { id: Tab; label: string }[] = [
  { id: "posts", label: "Publicações" },
  { id: "respostas", label: "Respostas" },
  { id: "reposts", label: "Reposts" },
];

const emptyTitle: Record<Tab, string> = {
  posts: "Nada publicado ainda",
  respostas: "Nenhuma resposta",
  reposts: "Nenhum repost",
};

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ tab?: string; cursor?: string }>;
}) {
  const [{ username }, query] = await Promise.all([params, searchParams]);
  const viewer = await requireViewer();
  const profile = await loadActorByUsername(viewer, username.toLowerCase());

  if (!profile) notFound();

  const tab = tabs.find((item) => item.id === query.tab)?.id ?? "posts";
  const typeLabel = accountTypeLabels[accountTypeOf(profile)];

  const scope: PostScope =
    tab === "respostas"
      ? { kind: "respostas-do-ator", actorId: profile.id }
      : tab === "reposts"
        ? { kind: "reposts-do-ator", actorId: profile.id }
        : { kind: "ator", actorId: profile.id };

  const emptyTitleForTab = emptyTitle[tab];

  return (
    <div>
      <ProfileHeader profile={profile} typeLabel={typeLabel} />

      {profile.viewer.isSelf ? (
        <div className="border-t border-line">
          <PostComposer
            identities={viewer.identities}
            activeActorId={viewer.activeActorId}
            compact
            placeholder={`O que está acontecendo, ${profile.display_name.split(" ")[0]}?`}
          />
        </div>
      ) : null}

      <nav aria-label="Seções do perfil" className="flex border-y border-line">
        {tabs.map((item) => {
          const active = item.id === tab;
          return (
            <a
              key={item.id}
              href={`/profile/${profile.username}?tab=${item.id}`}
              aria-current={active ? "page" : undefined}
              className={`label flex-1 border-b-2 px-3 py-3 text-center transition-colors ${
                active ? "border-accent text-ink" : "border-transparent text-ink-3 hover:text-ink-2"
              }`}
            >
              {item.label}
            </a>
          );
        })}
      </nav>

      <Suspense fallback={<PostFeedSkeleton />}>
        <ProfileFeed
          viewer={viewer}
          profile={profile}
          scope={scope}
          tab={tab}
          cursor={query.cursor}
          emptyTitle={emptyTitleForTab}
        />
      </Suspense>
    </div>
  );
}

async function ProfileFeed({
  viewer,
  profile,
  scope,
  tab,
  cursor,
  emptyTitle,
}: {
  viewer: Viewer;
  profile: ActorSummary;
  scope: PostScope;
  tab: Tab;
  cursor?: string;
  emptyTitle: string;
}) {
  const page = await loadPosts(viewer, scope, { cursor });

  return (
    <PostTimeline
      posts={page.posts}
      nextCursor={page.nextCursor}
      hasMore={page.hasMore}
      basePath={`/profile/${profile.username}?tab=${tab}`}
      empty={<EmptyState title={emptyTitle} />}
    />
  );
}