import Link from "next/link";
import { redirect } from "next/navigation";
import { requireViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import {
  NpcCreateForm,
  OrganizationCreateForm,
  PlayerCharacterList,
  OrganizationList,
  NpcList,
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
      .select("id, name, username, bio, avatar_url, banner_url, avatar_position_x, avatar_position_y, banner_position_y, actors!inner(id)")
      .eq("is_npc", true)
      .order("name", { ascending: true }),
    supabase
      .from("organizations")
      .select("id, name, username, description, type, avatar_url, banner_url, avatar_position_x, avatar_position_y, banner_position_y, actors!inner(id)")
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
      <header className="border-b border-line pb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="label text-ink-3">Mesa</p>
            <h1 className="mt-1 font-display text-xl text-ink">Painel do Mestre</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-2">
              Administre NPCs, personagens e organizações sem precisar sair da rede.
              As ações abaixo alteram a mesa; mensagens privadas continuam seguindo as regras de identidade e participação.
            </p>
          </div>
          <Link
            href="/messages"
            className="border border-line px-3 py-2 text-sm text-ink-2 hover:bg-sunken"
          >
            Abrir mensagens
          </Link>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <SummaryCard label="NPCs" value={npcs.length} />
          <SummaryCard label="Personagens de jogadores" value={playerCharacters.length} />
          <SummaryCard label="Organizações" value={orgs.length} />
          <SummaryCard label="Jogadores" value={players.length} />
        </dl>
      </header>

      <section aria-labelledby="secao-npcs" className="mt-6">
        <h2 id="secao-npcs" className="label mb-3 text-ink-3">
          Personagens sem dono (NPC)
        </h2>
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="order-2 md:order-1">
            <NpcList npcs={npcs} players={players} />
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
        <PlayerCharacterList characters={playerCharacters} />
      </section>

      <section aria-labelledby="secao-orgs" className="mt-8">
        <h2 id="secao-orgs" className="label mb-3 text-ink-3">
          Organizações
        </h2>
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="order-2 md:order-1">
            <OrganizationList organizations={orgs} />
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

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-line px-3 py-2.5">
      <dt className="text-[11px] text-ink-3">{label}</dt>
      <dd className="mt-0.5 font-mono text-lg text-ink tabular-nums">{value}</dd>
    </div>
  );
}

export async function generateMetadata() {
  return { title: "Painel do Mestre" };
}