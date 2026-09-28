import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { AccountTypeStamp, Handle } from "@/components/ui/account-type";
import { accountTypeOf } from "@/lib/site";
import { hashtagPath } from "@/lib/text/content";
import { compactNumber } from "@/lib/format/datetime";
import type { ActorSummary } from "@/lib/types";

/**
 * Painel de descoberta.
 *
 * Sem busca e sem algoritmo: quem vale a pena seguir e o que a mesa está falando
 * agora.
 */
export function SidePanel({
  suggestions,
  hashtags,
}: {
  suggestions: ActorSummary[];
  hashtags: { name: string; posts: number }[];
}) {
  if (suggestions.length === 0 && hashtags.length === 0) return null;

  return (
    <div className="space-y-6">
      {hashtags.length > 0 ? (
        <section aria-labelledby="painel-tags">
          <h2 id="painel-tags" className="label mb-2 px-1 text-ink-3">
            Assuntos do momento
          </h2>
          <ul className="border border-line">
            {hashtags.map((tag) => (
              <li key={tag.name} className="border-b border-line last:border-b-0">
                <Link
                  href={hashtagPath(tag.name)}
                  className="flex items-baseline justify-between gap-2 px-3 py-2 transition-colors hover:bg-sunken"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-mono text-[13px] text-ink">#{tag.name}</span>
                    <span className="label text-ink-3">
                      {tag.posts} {tag.posts === 1 ? "publicação" : "publicações"}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {suggestions.length > 0 ? (
        <section aria-labelledby="painel-sugestoes">
          <h2 id="painel-sugestoes" className="label mb-2 px-1 text-ink-3">
            Para acompanhar
          </h2>
          <ul className="border border-line">
            {suggestions.map((actor) => (
              <li key={actor.id} className="border-b border-line last:border-b-0">
                <Link
                  href={`/profile/${actor.username}`}
                  className="flex items-center gap-2.5 px-3 py-2.5 transition-colors hover:bg-sunken"
                >
                  <Avatar
                    name={actor.display_name}
                    username={actor.username}
                    src={actor.avatar_url}
                    size="sm"
                    decorative
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-ink">{actor.display_name}</span>
                    <span className="mt-0.5 flex items-center gap-1.5">
                      <AccountTypeStamp type={accountTypeOf(actor)} />
                      <Handle username={actor.username} size="xs" />
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="px-1 text-[11px] leading-relaxed text-ink-3">
        A rede é da mesa: tudo que aparece aqui foi escrito por quem está na mesa.
        {suggestions.length > 0 ? ` ${compactNumber(suggestions.length)} contas por aqui.` : ""}
      </p>
    </div>
  );
}
