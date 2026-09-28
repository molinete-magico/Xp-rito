import { SessionProvider } from "@/components/shell/session-provider";
import { AppShell } from "@/components/shell/app-shell";
import { site } from "@/lib/site";

/**
 * Layout da rede social.
 *
 * Moldura pré-renderizada: entre autenticação, identidade ativa, painel de
 * descoberta e contador de não lidas ficam no navegador (SessionProvider +
 * AppShell), porque dependem da sessão que só o cliente conhece. Quem precisa
 * do servidor — perfil, hashtag, post, ajustes — continua dinâmico, mas as
 * telas de feed saem estáticas do deploy.
 */
export default function SocialLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AppShell>{children}</AppShell>
    </SessionProvider>
  );
}

export async function generateMetadata() {
  return { title: { default: site.name, template: `%s · ${site.name}` } };
}