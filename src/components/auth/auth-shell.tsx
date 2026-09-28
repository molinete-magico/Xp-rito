import Link from "next/link";
import { site } from "@/lib/site";

/**
 * Moldura das telas de entrada.
 *
 * Fora do shell social de propósito: quem está aqui ainda não tem sessão nem
 * identidade. Uma coluna só, com a marca e o formulário.
 */
export function AuthShell({
  title,
  children,
  footer,
}: {
  title: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-4 py-3">
        <Link href="/" className="block" aria-label={`${site.name}, voltar ao início`}>
          <span className="font-display text-lg leading-none text-ink">{site.name}</span>
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-10">
        <h1 className="font-display text-2xl leading-tight text-ink">{title}</h1>

        <div className="mt-7">{children}</div>
      </main>

      <footer className="px-4 py-6">
        <div className="mx-auto flex w-full max-w-sm items-center justify-end">
          <p className="text-xs text-ink-3">{footer}</p>
        </div>
      </footer>
    </div>
  );
}