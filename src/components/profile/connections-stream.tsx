"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useSession } from "@/components/shell/session-provider";
import { loadActorByUsername, loadConnections, type Connection, type ConnectionKind } from "@/lib/data/actors";
import { Avatar } from "@/components/ui/avatar";
import { AccountTypeStamp, Handle } from "@/components/ui/account-type";
import { FollowButton } from "@/components/profile/follow-button";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { accountTypeOf } from "@/lib/site";

/**
 * Conexões de uma conta.
 *
 * A moldura é estática; a lista resolve no navegador com o mesmo RLS do
 * servidor, como as timelines. "Seguidores" e "Seguindo" são a mesma tela com o
 * lado trocado, e o cabeçalho volta para o perfil de onde se veio.
 */
export function ConnectionsStream({
  username,
  kind,
}: {
  username: string;
  kind: ConnectionKind;
}) {
  const { viewer, client, isLoading } = useSession();
  const [connections, setConnections] = useState<Connection[] | null>(null);
  const [owner, setOwner] = useState<{ display_name: string; username: string } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!client || !viewer || isLoading) return;
    let cancelled = false;

    (async () => {
      try {
        const profile = await loadActorByUsername(client, viewer, username);
        if (cancelled) return;
        if (!profile) {
          setConnections([]);
          return;
        }
        setOwner({ display_name: profile.display_name, username: profile.username });
        const list = await loadConnections(client, viewer, profile.id, kind);
        if (!cancelled) {
          setFailed(false);
          setConnections(list);
        }
      } catch {
        if (!cancelled) {
          setFailed(true);
          setConnections([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [client, viewer, isLoading, username, kind]);

  const title = kind === "followers" ? "Seguidores" : "Seguindo";
  const selfId = viewer?.activeActorId ?? null;


  return (
    <div>
      <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
        <Link
          href={`/profile/${username}`}
          className="flex items-center gap-1.5 text-sm text-ink-2 transition-colors hover:text-ink"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          Voltar
        </Link>
        <h1 className="text-sm font-medium text-ink">
          {title}
          {owner ? <span className="font-normal text-ink-3"> · {owner.display_name}</span> : null}
        </h1>
      </div>

      {isLoading || connections === null ? (
        <ListSkeleton />
      ) : failed ? (
        <ErrorState />
      ) : connections.length === 0 ? (
        <EmptyState
          title={kind === "followers" ? "Nenhum seguidor ainda" : "Não segue ninguém ainda"}
        />
      ) : (
        <ul>
          {connections.map((connection) => {
            const actor = connection.actor;
            const isSelf = selfId === actor.id;
            return (
              <li
                key={actor.id}
                className="flex items-center gap-3 border-b border-line px-4 py-3"
              >
                <Link href={`/profile/${actor.username}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar
                    name={actor.display_name}
                    username={actor.username}
                    src={actor.avatar_url}
                    size="md"
                    decorative
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-medium text-ink">
                        {actor.display_name}
                      </span>
                      <AccountTypeStamp type={accountTypeOf(actor)} />
                    </span>
                    <span className="block">
                      <Handle username={actor.username} size="xs" />
                    </span>
                  </span>
                </Link>

                {isSelf ? (
                  <span className="shrink-0 text-xs text-ink-3">você</span>
                ) : selfId ? (
                  <div className="shrink-0">
                    <FollowButton
                      targetActorId={actor.id}
                      initialFollowing={connection.following}
                      initialFollowers={0}
                      showCount={false}
                      onChange={(next) => {
                        // Desfazer o vínculo tira a linha, como no Twitter.
                        if (!next) {
                          setConnections((current) =>
                            current
                              ? current.filter((row) => row.actor.id !== actor.id)
                              : current,
                          );
                        }
                      }}
                    />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ListSkeleton() {
  return (
    <ul aria-hidden="true">
      {[0, 1, 2, 3].map((row) => (
        <li key={row} className="flex items-center gap-3 border-b border-line px-4 py-3">
          <span className="size-10 shrink-0 animate-pulse rounded-full bg-sunken" />
          <span className="flex-1 space-y-2">
            <span className="block h-3 w-32 animate-pulse rounded-sm bg-sunken" />
            <span className="block h-2.5 w-20 animate-pulse rounded-sm bg-sunken" />
          </span>
        </li>
      ))}
    </ul>
  );
}
