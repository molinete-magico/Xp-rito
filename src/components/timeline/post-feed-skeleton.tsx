import { cn } from "@/lib/cn";

/**
 * Esqueleto do feed.
 *
 * Renderizado como fallback durante o streaming das páginas: mostra a silhueta
 * de publicações enquanto o servidor ainda resolve a primeira carga. Sem dados,
 * sem estado — só a "roupa" da timeline espelhando o PostCard.
 */
export function PostFeedSkeleton({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("divide-y divide-line", className)} aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="animate-pulse px-4 py-4">
          <div className="flex gap-3">
            <span className="size-10 shrink-0 rounded-xs border border-line bg-sunken" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-baseline gap-2">
                <span className="h-3 w-24 rounded-sm bg-sunken" />
                <span className="h-2.5 w-16 rounded-sm bg-sunken" />
              </div>
              <span className="block h-3 w-3/4 rounded-sm bg-sunken" />
              <span className="block h-3 w-full rounded-sm bg-sunken" />
              <div className="flex items-center gap-5 pt-2">
                {Array.from({ length: 4 }, (_, icon) => (
                  <span key={icon} className="h-3.5 w-6 rounded-sm bg-sunken" />
                ))}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}