import Link from "next/link";
import { Search } from "lucide-react";
import { requireViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { toActorCard } from "@/lib/data/identities";
import { Avatar } from "@/components/ui/avatar";
import { AccountTypeStamp, Handle } from "@/components/ui/account-type";
import { FollowButton } from "@/components/profile/follow-button";
import { TextInput } from "@/components/ui/field";
import { buttonClass } from "@/components/ui/button";
import { accountTypeOf } from "@/lib/site";
import type { ActorSummary } from "@/lib/types";

const SEARCH_ACTOR_FIELDS =
  "id, display_name, username, avatar_url, banner_url, avatar_position_x, avatar_position_y, banner_position_y, entity_type, character:characters(id, is_npc), organization:organizations(id, type)";

type SearchRow = {
  id: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
  banner_url: string | null;
  avatar_position_x: number;
  avatar_position_y: number;
  banner_position_y: number;
  entity_type: "character" | "organization";
  character?: { id?: string; is_npc: boolean } | null;
  organization?: { id?: string; type: string } | null;
};

/**
 * Busca de contas.
 *
 * Página de servidor: o dono da sessão (qualquer papel) procura personagens,
 * NPCs e organizações pelo nome ou @. Os contadores de seguidores e o estado
 * "seguindo" de cada resultado vêm em duas consultas, sem N+1.
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const viewer = await requireViewer();
  const term = (q ?? "").trim();
  const selfId = viewer.activeActorId;

  let results: ActorSummary[] = [];
  const followerCounts = new Map<string, number>();
  const following = new Set<string>();

  if (term) {
    const supabase = await createClient();
    const escaped = term.replace(/[_%]/g, (match) => `\\${match}`);
    const { data } = await supabase
      .from("actors")
      .select(SEARCH_ACTOR_FIELDS)
      .or(`display_name.ilike.%${escaped}%,username.ilike.%${escaped}%`)
      .order("display_name", { ascending: true })
      .limit(20);

    results = ((data ?? []) as unknown as SearchRow[]).map((row) => toActorCard(row as never));

    if (results.length > 0) {
      const ids = results.map((actor) => actor.id);
      const [followers, mine] = await Promise.all([
        supabase
          .from("follows")
          .select("follower_id, following_id")
          .in("following_id", ids),
        selfId
          ? supabase.from("follows").select("following_id").eq("follower_id", selfId)
          : Promise.resolve({ data: [] }),
      ]);

      for (const row of (followers.data ?? []) as { following_id: string }[]) {
        followerCounts.set(row.following_id, (followerCounts.get(row.following_id) ?? 0) + 1);
      }
      for (const row of (mine.data ?? []) as { following_id: string }[]) {
        following.add(row.following_id);
      }
    }
  }

  return (
    <>
      <div className="border-b border-line px-4 py-3">
        <h1 className="font-display text-lg text-ink">Buscar</h1>
        <p className="mt-0.5 text-xs text-ink-3">
          Encontre personagens, NPCs e organizações pelo nome ou pelo @.
        </p>
      </div>

      <form action="/search" method="get" role="search" className="flex items-center gap-2 px-4 py-3">
        <label className="sr-only" htmlFor="buscar-q">
          Buscar conta
        </label>
        <div className="relative flex-1">
          <span aria-hidden="true" className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-3">
            <Search className="h-4 w-4" />
          </span>
          <TextInput
            id="buscar-q"
            name="q"
            defaultValue={term}
            placeholder="Nome ou @handle"
            autoComplete="off"
            className="w-full pl-8"
          />
        </div>
        <button type="submit" className={buttonClass("outline", "sm")}>
          Buscar
        </button>
      </form>

      <ul>
        {results.map((actor) => {
          const isSelf = selfId === actor.id;
          const isFollowing = following.has(actor.id);
          const followers = followerCounts.get(actor.id) ?? 0;
          return (
            <li key={actor.id} className="flex items-center gap-3 border-b border-line px-4 py-3">
              <Link
                href={`/profile/${actor.username}`}
                className="flex min-w-0 flex-1 items-center gap-3"
              >
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
                    initialFollowing={isFollowing}
                    initialFollowers={followers}
                  />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {term ? (
        results.length === 0 ? (
          <p className="px-4 py-6 text-sm text-ink-3">
            Nenhuma conta para “{term}”. Tente outro nome.
          </p>
        ) : (
          <p className="px-4 py-3 text-xs text-ink-3">
            {results.length === 20 ? "Primeiras " : ""}
            {results.length} {results.length === 1 ? "conta encontrada" : "contas encontradas"}
          </p>
        )
      ) : (
        <p className="px-4 py-6 text-sm text-ink-3">
          Digite um nome ou um @ para começar.
        </p>
      )}
    </>
  );
}