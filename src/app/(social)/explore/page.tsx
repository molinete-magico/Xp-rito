import { FeedStream } from "@/components/timeline/feed-stream";

/**
 * Explorar.
 *
 * Tudo que a mesa escreveu, do mais recente para o mais antigo. A tela é
 * estática; a leitura acontece no navegador, com as mesmas regras do servidor.
 */
export default function ExplorePage() {
  return (
    <>
      <div className="border-b border-line px-4 py-3">
        <h1 className="font-display text-lg text-ink">Explorar</h1>
      </div>

      <FeedStream scope={{ kind: "recentes" }} basePath="/explore" emptyTitle="Nada para explorar ainda" />
    </>
  );
}