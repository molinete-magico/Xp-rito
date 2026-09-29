import { ConnectionsStream } from "@/components/profile/connections-stream";

/**
 * contas que esta pessoa segue.
 *
 * Página de servidor só com a moldura; a lista resolve no navegador, com o
 * RLS de sempre.
 */
export default async function ConnectionsPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;

  return <ConnectionsStream username={username} kind="following" />;
}
