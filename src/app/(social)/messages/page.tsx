import { InboxStream } from "@/components/messages/inbox-stream";

/**
 * Mensagens.
 *
 * Moldura estática; a caixa (e a abertura de conversas) acontece no navegador,
 * com o mesmo RLS do servidor. Só personagem que a pessoa tem e é dela tem caixa
 * de entrada — NPC e organização não têm dono, e é isso que impede o Mestre de
 * ler a conversa dos jogadores.
 */
export default function MessagesPage() {
  return (
    <>
      <div className="border-b border-line px-4 py-3">
        <h1 className="font-display text-lg text-ink">Mensagens</h1>
      </div>

      <InboxStream />
    </>
  );
}
