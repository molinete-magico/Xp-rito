import { requireViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { AccountForm, CharacterForm, NewCharacterForm } from "@/components/settings/forms";
import { AccountTypeStamp } from "@/components/ui/account-type";
import { accountTypeOf } from "@/lib/site";

/**
 * Ajustes.
 *
 * A conta e as identidades ficam em seções separadas porque são coisas
 * diferentes: uma é o login, as outras são quem a pessoa interpreta. Quem não é
 * Mestre tem no máximo um ou dois personagens; a seção de criar some para o
 * Mestre, cujos NPCs são geridos no painel.
 */
export default async function SettingsPage() {
  const viewer = await requireViewer();
  const supabase = await createClient();

  // A bio vive no personagem, não no espelho `actors` do feed. Este é o lugar
  // barato de ler a origem para pré-preencher o formulário sem inflar o payload
  // de ActorSummary em todos os embeds.
  const { data: ownedCharacters } = await supabase
    .from("characters")
    .select("id, bio")
    .eq("owner_id", viewer.userId);
  const bioOf = new Map((ownedCharacters ?? []).map((row) => [row.id, row.bio ?? ""]));

  const owned = viewer.identities.filter((actor) => !actor.is_npc);
  const others = viewer.identities.filter((actor) => actor.is_npc);

  return (
    <div className="px-4 py-5">
      <h1 className="font-display text-lg text-ink">Configurações</h1>

      <section aria-labelledby="secao-conta" className="mt-6">
        <h2 id="secao-conta" className="label mb-3 text-ink-3">
          Conta
        </h2>
        <AccountForm displayName={viewer.profile.display_name} username={viewer.profile.username} />
      </section>

      <section aria-labelledby="secao-identidades" className="mt-8">
        <h2 id="secao-identidades" className="label mb-3 text-ink-3">
          Seus personagens
        </h2>

        {owned.length === 0 ? (
          <p className="border border-line px-3 py-4 text-sm text-ink-2">
            Você ainda não tem personagem. Crie o primeiro abaixo.
          </p>
        ) : (
          <div className="space-y-6">
            {owned.map((actor) => (
              <article key={actor.id} className="border border-line p-3">
                <div className="mb-3 flex items-center gap-2">
                  <h3 className="text-sm text-ink">{actor.display_name}</h3>
                  <AccountTypeStamp type={accountTypeOf(actor)} />
                </div>
                <CharacterForm character={actor} initialBio={bioOf.get(actor.entity_id) ?? ""} canDelete />
              </article>
            ))}
          </div>
        )}
      </section>

      {others.length > 0 ? (
        <section aria-labelledby="secao-outros" className="mt-8">
          <h2 id="secao-outros" className="label mb-2 text-ink-3">
            Identidades do Mestre
          </h2>
          <ul className="border border-line">
            {others.map((actor) => (
              <li key={actor.id} className="flex items-center gap-2 border-b border-line px-3 py-2 last:border-b-0">
                <span className="text-sm text-ink">{actor.display_name}</span>
                <AccountTypeStamp type={accountTypeOf(actor)} />
                <a
                  href={`/profile/${actor.username}`}
                  className="ml-auto font-mono text-[11px] text-ink-3 hover:underline"
                >
                  @{actor.username}
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-ink-3">
            NPCs e instituições se editam no painel do Mestre.
          </p>
        </section>
      ) : null}

      {!viewer.isGm ? (
        <section aria-labelledby="secao-novo" className="mt-8">
          <h2 id="secao-novo" className="label mb-3 text-ink-3">
            Novo personagem
          </h2>
          <NewCharacterForm />
        </section>
      ) : null}

      <footer className="mt-10 border-t border-line pt-4">
        <p className="text-xs leading-relaxed text-ink-3">
          {viewer.isGm
            ? "Como Mestre, você pode criar NPCs, instituições e veículos no painel."
            : "Cada personagem tem @handle próprio, e é ele que aparece nas publicações."}
        </p>
        <p className="mt-2 text-[11px] text-ink-3">
          Sessão de {viewer.profile.display_name} · {viewer.isGm ? "Mestre" : "jogador"}
        </p>
      </footer>
    </div>
  );
}
