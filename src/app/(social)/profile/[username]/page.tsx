import { ProfileStream } from "@/components/profile/profile-stream";

/**
 * Página de perfil.
 *
 * Moldura pré-renderizada; quem é essa conta, seus contadores e a timeline
 * chegam no navegador com as mesmas regras do RLS do servidor.
 */
export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;

  return (
    <ProfileStream
      username={username}
      placeholder={`O que está acontecendo, ${username.split(" ")[0]}?`}
    />
  );
}