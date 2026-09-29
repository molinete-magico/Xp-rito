"use client";

import { usePathname } from "next/navigation";
import { InboxStream } from "@/components/messages/inbox-stream";

export function MessagesShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const inConversation = pathname !== "/messages";

  if (!inConversation) {
    return (
      <section>
        <header className="interface-header">
          <h1 className="font-display text-lg text-ink">Mensagens</h1>
        </header>
        <InboxStream />
      </section>
    );
  }

  return (
    <section className="grid min-h-[calc(100dvh-3.5rem)] lg:h-dvh lg:grid-cols-[minmax(240px,320px)_minmax(0,1fr)]">
      <aside className="hidden overflow-y-auto border-r border-line lg:block">
        <header className="interface-header">
          <h1 className="font-display text-lg text-ink">Mensagens</h1>
        </header>
        <InboxStream />
      </aside>
      <main className="min-w-0">{children}</main>
    </section>
  );
}
