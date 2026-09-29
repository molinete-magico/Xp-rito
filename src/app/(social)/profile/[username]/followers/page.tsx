import { ConnectionsStream } from "@/components/profile/connections-stream";

/**
 * quem segue esta conta.
 *
 * Página de servidor só com a moldura; a lista resolve no navegador, com o
 * RLS de sempre.
 */
export default async function ConnectionsPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;

  return <ConnectionsStream username={username} kind="followers" />;
}
