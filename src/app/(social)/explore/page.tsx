import Link from "next/link";
import { FeedStream } from "@/components/timeline/feed-stream";

type ExploreFilter = "tudo" | "posts" | "respostas";

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const params = await searchParams;
  const filter: ExploreFilter =
    params.filter === "posts" || params.filter === "respostas" ? params.filter : "tudo";

  const scope =
    filter === "posts"
      ? { kind: "recentes" as const }
      : filter === "respostas"
        ? { kind: "respostas-recentes" as const }
        : { kind: "explorar" as const };

  const basePath = filter === "tudo" ? "/explore" : "/explore?filter=" + filter;

  return (
    <>
      <div className="border-b border-line">
        <div className="px-4 py-3">
          <h1 className="font-display text-lg text-ink">Explorar</h1>
          <p className="mt-1 text-xs text-ink-3">
            Descubra o que está acontecendo na mesa, incluindo publicações e respostas.
          </p>
        </div>

        <nav className="grid grid-cols-3" aria-label="Filtro do explorar">
          {(["tudo", "posts", "respostas"] as const).map((value) => {
            const label = value === "tudo" ? "Tudo" : value === "posts" ? "Publicações" : "Respostas";
            const href = value === "tudo" ? "/explore" : "/explore?filter=" + value;
            return (
              <Link
                key={value}
                href={href}
                className={`border-t border-line px-3 py-3 text-center text-sm transition-colors hover:bg-sunken ${filter === value ? "font-medium text-ink" : "text-ink-3"}`}
                aria-current={filter === value ? "page" : undefined}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </div>

      <FeedStream
        key={filter}
        scope={scope}
        basePath={basePath}
        emptyTitle={filter === "respostas" ? "Nenhuma resposta encontrada" : "Nada para explorar ainda"}
      />
    </>
  );
}