import { cn } from "@/lib/cn";

/**
 * Estados vazios. Onde não há conteúdo, a tela explica o que é aquilo e o que
 * fazer a respeito.
 */
export function EmptyState({
  title,
  action,
  className,
}: {
  title: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("px-6 py-14 text-center", className)}>
      <div className="mx-auto mb-4 h-px w-10 bg-line-2" />
      <h2 className="text-base text-ink">{title}</h2>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

/** Erro de leitura: distingue "não deu" de "não existe". */
export function ErrorState({
  title = "Não foi possível carregar",
  action,
}: {
  title?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="px-6 py-14 text-center" role="alert">
      <p className="label text-danger">Erro</p>
      <h2 className="mt-2 text-base text-ink">{title}</h2>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function Spinner({ label = "Carregando" }: { label?: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2 text-ink-3">
      <span className="h-3 w-3 animate-spin rounded-full border border-line-2 border-t-ink" />
      <span className="sr-only">{label}</span>
    </span>
  );
}
