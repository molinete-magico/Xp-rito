import { redirect } from "next/navigation";
import { requireViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import {
  NpcCreateForm,
  NpcRow,
  OrganizationCreateForm,
  OrganizationRow,
  type NpcDraft,
  type OrgDraft,
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
  const [npcResult, orgResult] = await Promise.all([
    supabase
      .from("characters")
      .select("id, name, username, bio")
      .eq("is_npc", true)
      .order("name", { ascending: true }),
    supabase
      .from("organizations")
      .select("id, name, username, description, type")
      .order("name", { ascending: true }),
  ]);

  const npcs = (npcResult.data ?? []) as NpcDraft[];
  const orgs = (orgResult.data ?? []) as OrgDraft[];

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
                npcs.map((npc) => <NpcRow key={npc.id} npc={npc} />)
              )}
            </ul>
          </div>
          <div className="order-1 md:order-2">
            <NpcCreateForm />
          </div>
        </div>
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