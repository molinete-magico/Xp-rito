"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/components/shell/session-provider";
import { loadActorByUsername } from "@/lib/data/actors";
import { loadPosts, type PostScope, type PostPage } from "@/lib/data/posts";
import { ProfileHeader } from "@/components/profile/profile-header";
import { PostComposer } from "@/components/composer/post-composer";
import { PostTimeline } from "@/components/timeline/post-timeline";
import { PostFeedSkeleton } from "@/components/timeline/post-feed-skeleton";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { accountTypeLabels, accountTypeOf } from "@/lib/site";
import { cn } from "@/lib/cn";
import type { BrowserClient } from "@/lib/session-client";
import type { Viewer } from "@/lib/session";
import type { ActorProfile } from "@/lib/types";

const TABS = [
  { id: "posts", label: "Publicações" },
  { id: "respostas", label: "Respostas" },
  { id: "reposts", label: "Reposts" },
] as const;

type Tab = (typeof TABS)[number]["id"];

const EMPTY_TITLES: Record<Tab, string> = {
  posts: "Nada publicado ainda",
  respostas: "Nenhuma resposta",
  reposts: "Nenhum repost",
};

function scopeForTab(tab: Tab, actorId: string): PostScope {
  if (tab === "respostas") return { kind: "respostas-do-ator", actorId };
  if (tab === "reposts") return { kind: "reposts-do-ator", actorId };
  return { kind: "ator", actorId };
}

/**
 * Perfil no navegador.
 *
 * O shell da página é estático; esta leitura resolve a conta, o cabeçalho e as
 * abas com o RLS do servidor, e a timeline vai trocando conforme a aba.
 */
export function ProfileStream({
  username,
  placeholder,
}: {
  username: string;
  placeholder?: string;
}) {
  const { viewer, client, isLoading } = useSession();
  const [actor, setActor] = useState<ActorProfile | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>("posts");
  const [feedState, setFeedState] = useState<{ key: string; page: PostPage | null }>({
    key: "",
    page: null,
  });
  const [failed, setFailed] = useState(false);

  const feedKey = actor && viewer ? `${actor.id}:${tab}:${viewer.activeActorId ?? ""}` : null;

  // Ajustar o estado durante o render quando a chave muda evita cascata: em vez
  // de resetar no efeito, marcamos a nova chave e a busca começa ali embaixo.
  if (feedKey !== null && feedState.key !== feedKey) {
    setFeedState({ key: feedKey, page: null });
  }
  const feed = feedState.key === feedKey ? feedState.page : null;

  useEffect(() => {
    if (!client || !viewer || isLoading) return;
    let cancelled = false;

    (async () => {
      const next = await loadActorByUsername(client, viewer, username);
      if (!cancelled) setActor(next);
    })().catch(() => {
      if (!cancelled) setActor(null);
    });

    return () => {
      cancelled = true;
    };
  }, [client, viewer, isLoading, username]);

  useEffect(() => {
    if (!client || !viewer || !actor || !feedKey) return;
    if (feed !== null) return;

    let cancelled = false;

    (async () => {
      const page = await loadPosts(client, viewer, scopeForTab(tab, actor.id), {});
      if (cancelled) return;
      setFailed(false);
      setFeedState((current) => (current.key === feedKey ? { key: feedKey, page } : current));
    })().catch(() => {
      if (!cancelled) setFailed(true);
    });

    return () => {
      cancelled = true;
    };
  }, [client, viewer, actor, tab, feedKey, feed]);

  useEffect(() => {
    if (!client || !viewer) return;
    const onRefresh = () => {
      setFeedState((current) => ({ key: current.key, page: null }));
    };
    window.addEventListener("xpirito:refresh", onRefresh);
    return () => window.removeEventListener("xpirito:refresh", onRefresh);
  }, [client, viewer]);

  if (!viewer || isLoading) return <ProfileSkeleton />;

  if (actor === undefined) return <ProfileSkeleton />;

  if (actor === null) return <EmptyState title="Conta não encontrada" />;

  const typeLabel = accountTypeLabels[accountTypeOf(actor)];

  return (
    <div>
      <ProfileHeader profile={actor} typeLabel={typeLabel} />

      {actor.viewer.isSelf ? (
        <div className="border-t border-line">
          {viewer.identities.length > 0 ? (
            <PostComposer placeholder={placeholder} />
          ) : (
            <p className="px-4 py-4 text-sm text-ink-2">
              Você ainda não tem personagem. Crie um para publicar.
            </p>
          )}
        </div>
      ) : null}

      <nav aria-label="Seções do perfil" className="flex border-y border-line">
        {TABS.map((item) => {
          const active = item.id === tab;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "label flex-1 border-b-2 px-3 py-3 text-center transition-colors",
                active
                  ? "border-ink text-ink"
                  : "border-transparent text-ink-3 hover:text-ink-2",
              )}
            >
              {item.label}
            </button>
          );
        })}
      </nav>

      {feed === null ? (
        failed ? (
          <ErrorState />
        ) : (
          <PostFeedSkeleton />
        )
      ) : (
        <PostTimeline
          posts={feed.posts}
          nextCursor={feed.nextCursor}
          hasMore={feed.hasMore}
          basePath={""}
          onLoadMore={() => {
            void loadMoreFeed(client, viewer, tab, actor.id, feed, setFeedState);
          }}
          empty={<EmptyState title={EMPTY_TITLES[tab]} />}
        />
      )}
    </div>
  );
}

async function loadMoreFeed(
  client: BrowserClient | null,
  viewer: Viewer | null,
  tab: Tab,
  actorId: string,
  current: PostPage,
  setFeedState: React.Dispatch<React.SetStateAction<{ key: string; page: PostPage | null }>>,
) {
  if (!client || !viewer || !current.nextCursor) return;
  const next = await loadPosts(client, viewer, scopeForTab(tab, actorId), {
    cursor: current.nextCursor,
  }).catch(() => null);
  if (!next) return;
  setFeedState((state) => ({
    key: state.key,
    page: {
      posts: [...current.posts, ...next.posts],
      nextCursor: next.nextCursor,
      hasMore: next.hasMore,
    },
  }));
}

function ProfileSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="h-28 animate-pulse bg-sunken" />
      <div className="flex gap-4 px-4 py-3">
        <span className="size-16 shrink-0 animate-pulse rounded-full bg-sunken" />
        <div className="flex-1 pt-4 space-y-2">
          <span className="block h-3 w-40 animate-pulse rounded-sm bg-sunken" />
          <span className="block h-2.5 w-24 animate-pulse rounded-sm bg-sunken" />
        </div>
      </div>
      <PostFeedSkeleton rows={4} />
    </div>
  );
}