import { redirect } from "next/navigation";
import { requireViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import {
  NpcCreateForm,
  NpcRow,
  OrganizationCreateForm,
  OrganizationRow,
  PlayerCharacterRow,
  type NpcDraft,
  type OrgDraft,
  type PlayerSelectItem,
} from "@/components/admin/admin-forms";

/**
 * Painel do Mestre.
 *
 * O que não é personagem de jogador é criado aqui: NPCs (personagens sem dono) e
 * organizações. O Mestre também enxerga tudo que é público; para apagar uma
 * publicação, ele sai pelo perfil, como qualquer dono.
 */
export default async function AdminPage() {
  const viewer = await requireViewer();
  if (!viewer.isGm) redirect("/home");

  const supabase = await createClient();
  const [npcResult, orgResult, playerCharsResult, playersResult] = await Promise.all([
    supabase
      .from("characters")
      .select("id, name, username, bio, actors!inner(id)")
      .eq("is_npc", true)
      .order("name", { ascending: true }),
    supabase
      .from("organizations")
      .select("id, name, username, description, type, actors!inner(id)")
      .order("name", { ascending: true }),
    supabase
      .from("characters")
      .select("id, name, username, owner:profiles!characters_owner_id_fkey(display_name, role)")
      .eq("is_npc", false)
      .not("owner_id", "is", null)
      .order("name", { ascending: true }),
    supabase
      .from("profiles")
      .select("id, display_name")
      .eq("role", "player")
      .order("display_name", { ascending: true }),
  ]);

  const npcs = ((npcResult.data ?? []) as NpcDraft[]).map((row) => ({
    ...row,
    actorId: row.actors?.id ?? row.id,
  }));
  const orgs = ((orgResult.data ?? []) as OrgDraft[]).map((row) => ({
    ...row,
    actorId: row.actors?.id ?? row.id,
  }));
  const playerCharacters = ((playerCharsResult.data ?? []) as Array<{
    id: string;
    name: string;
    username: string;
    owner?: { display_name: string; role: string } | null;
  }>)
    .filter((row) => row.owner?.role === "player")
    .map((row) => ({
      id: row.id,
      name: row.name,
      username: row.username,
      ownerName: row.owner?.display_name ?? "Jogador(a)",
    }));
  const players = ((playersResult.data ?? []) as PlayerSelectItem[]).filter((row) => row.id);

  return (
    <div className="px-4 py-5">
      <h1 className="font-display text-lg text-ink">Painel do Mestre</h1>

      <section aria-labelledby="secao-npcs" className="mt-6">
        <h2 id="secao-npcs" className="label mb-3 text-ink-3">
          Personagens sem dono (NPC)
        </h2>
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="order-2 md:order-1">
            <ul className="border border-line">
              {npcs.length === 0 ? (
                <li className="px-3 py-4 text-sm text-ink-2">Nenhum NPC ainda.</li>
              ) : (
                npcs.map((npc) => (
                  <NpcRow key={npc.id} npc={npc} players={players} />
                ))
              )}
            </ul>
          </div>
          <div className="order-1 md:order-2">
            <NpcCreateForm />
          </div>
        </div>
      </section>

      <section aria-labelledby="secao-jogadores" className="mt-8">
        <h2 id="secao-jogadores" className="label mb-3 text-ink-3">
          Personagens de jogadores
        </h2>
        <p className="mb-3 text-xs leading-relaxed text-ink-3">
          O Mestre pode assumir um personagem de jogador (vira NPC) ou entregar
          um NPC a um jogador.
        </p>
        <ul className="border border-line">
          {playerCharacters.length === 0 ? (
            <li className="px-3 py-4 text-sm text-ink-2">Nenhum personagem de jogador ainda.</li>
          ) : (
            playerCharacters.map((character) => (
              <PlayerCharacterRow key={character.id} character={character} />
            ))
          )}
        </ul>
      </section>

      <section aria-labelledby="secao-orgs" className="mt-8">
        <h2 id="secao-orgs" className="label mb-3 text-ink-3">
          Organizações
        </h2>
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="order-2 md:order-1">
            <ul className="border border-line">
              {orgs.length === 0 ? (
                <li className="px-3 py-4 text-sm text-ink-2">Nenhuma organização ainda.</li>
              ) : (
                orgs.map((org) => <OrganizationRow key={org.id} org={org} />)
              )}
            </ul>
          </div>
          <div className="order-1 md:order-2">
            <OrganizationCreateForm />
          </div>
        </div>
      </section>

      <footer className="mt-8 text-xs leading-relaxed text-ink-3">
        A autorização de cada escrita é decidida pelo banco: o RLS aceita
        operações do Mestre sobre qualquer registro, e recusa a de jogadores
        que tentem furar o caminho pelo painel.
      </footer>
    </div>
  );
}

export async function generateMetadata() {
  return { title: "Painel do Mestre" };
}