import { FeedStream } from "@/components/timeline/feed-stream";

/** Hashtags são minúsculas no banco; a URL pode chegar com acento ou #. */
function normalizeTag(raw: string): string {
  return raw
    .replace(/^#/, "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/**
 * Página de um assunto.
 *
 * Moldura pré-renderizada: o título do hashtag sai do deploy e as publicações
 * chegam no navegador com o mesmo RLS do servidor.
 */
export default async function HashtagPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const tag = normalizeTag(name);

  return (
    <>
      <div className="border-b border-line px-4 py-3">
        <h1 className="font-mono text-lg text-ink">#{tag}</h1>
      </div>

      <FeedStream
        scope={{ kind: "hashtag", name: tag }}
        basePath={`/hashtag/${encodeURIComponent(tag)}`}
        emptyTitle="Nenhuma publicação com este assunto"
      />
    </>
  );
}