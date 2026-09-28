import { PostFeedSkeleton } from "@/components/timeline/post-feed-skeleton";

/**
 * Estado de carregamento das rotas sob demanda (ajustes, painel do Mestre).
 *
 * Com uma fronteira Suspense aqui, a navegação mostra esta silhueta no instante
 * em que a pessoa clica, enquanto o servidor responde — nada de tela em branco
 * esperando a função esquentar.
 */
export default function SocialLoading() {
  return (
    <div aria-hidden="true">
      <div className="border-b border-line px-4 py-3">
        <span className="block h-5 w-36 animate-pulse rounded-sm bg-sunken" />
      </div>
      <PostFeedSkeleton rows={4} />
    </div>
  );
}