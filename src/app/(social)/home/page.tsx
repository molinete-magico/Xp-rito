import { FeedStream } from "@/components/timeline/feed-stream";
import { PublishBar } from "@/components/feed/publish-bar";

/**
 * Feed principal.
 *
 * Tudo que a mesa publicou, do mais recente para o mais antigo. Sem filtro
 * "quem eu sigo" no caminho padrão, porque num grupo pequeno o filtro esconde
 * as publicações que a pessoa veio ler.
 *
 * A tela é pré-renderizada: o cabeçalho e o espaço do compositor saem do deploy
 * e o conteúdo chega no navegador, com o mesmo RLS do servidor.
 */
export default function HomePage() {
  return (
    <>
      <div className="border-b border-line px-4 py-3">
        <h1 className="font-display text-lg text-ink">Início</h1>
      </div>

      <PublishBar />

      <FeedStream scope={{ kind: "recentes" }} basePath="/home" emptyTitle="A rede está em silêncio" />
    </>
  );
}