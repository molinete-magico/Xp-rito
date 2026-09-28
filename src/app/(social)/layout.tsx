import { requireViewer } from "@/lib/session";
import { loadSuggestions, loadPopularHashtags } from "@/lib/data/actors";
import { AppShell } from "@/components/shell/app-shell";
import { SidePanel } from "@/components/shell/side-panel";
import { createClient } from "@/lib/supabase/server";
import { site } from "@/lib/site";

// Área autenticada: cada requisição depende das cookies e da sessão. Nunca
// tornar isto estático, porque uma página pré-renderizada sem usuário seria
// conteúdo errado para todo mundo.
export const dynamic = "force-dynamic";

/**
 * Layout da rede social.
 *
 * Carrega o que é comum a todas as telas: quem está entrando, o contador de não
 * lidas e quem vale a pena seguir. Cada página carrega só o seu conteúdo. Como
 * `getViewer` é memoizado por requisição, a página que também chamar
 * `requireViewer` não repete a consulta.
 */
export default async function SocialLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireViewer();
  const supabase = await createClient();

  const actorIds = viewer.identities.map((actor) => actor.id);

  const [suggestions, hashtags, unread] = await Promise.all([
    loadSuggestions(viewer),
    loadPopularHashtags(),
    actorIds.length > 0
      ? supabase.rpc("count_unread_notifications").then(({ data }) =>
          typeof data === "number" ? data : 0,
        )
      : Promise.resolve(0),
  ]);

  return (
    <AppShell
      identities={viewer.identities}
      activeActorId={viewer.activeActorId}
      isGm={viewer.isGm}
      initialUnread={unread}
      sidePanel={<SidePanel suggestions={suggestions} hashtags={hashtags} />}
    >
      {children}
    </AppShell>
  );
}

export async function generateMetadata() {
  return { title: { default: site.name, template: `%s · ${site.name}` } };
}
