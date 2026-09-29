"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { MessageCircle, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { startDirectAction } from "@/app/actions/messages";
import { useSession } from "@/components/shell/session-provider";
import { Avatar } from "@/components/ui/avatar";
import { buttonClass } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { ACTOR_FIELDS } from "@/lib/data/messages";
import { dmSenderChoice, dmVoiceIdentities, toActorCard } from "@/lib/data/identities";
import type { ActorSummary } from "@/lib/types";

export function NewMessageButton() {
  const [open, setOpen] = useState(false);

  return open ? (
    <NewMessageDialog onClose={() => setOpen(false)} />
  ) : (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className={buttonClass("outline", "sm")}
    >
      <MessageCircle aria-hidden="true" className="h-3.5 w-3.5" />
      Nova mensagem
    </button>
  );
}

function NewMessageDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { client, viewer } = useSession();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ActorSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const requestId = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const voices = viewer ? dmVoiceIdentities(viewer) : [];
  const [senderId, setSenderId] = useState<string | null>(null);
  const sender = viewer ? dmSenderChoice(viewer, senderId) : null;

  useEffect(() => {
    inputRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !pending) onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, pending]);

  useEffect(() => {
    if (!client || !viewer) return;
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    const currentRequest = ++requestId.current;
    const handle = window.setTimeout(async () => {
      setLoading(true);
      const pattern = `%${term.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
      const { data, error: queryError } = await client
        .from("actors")
        .select(ACTOR_FIELDS)
        .eq("entity_type", "character")
        .or(`display_name.ilike.${pattern},username.ilike.${pattern}`)
        .order("display_name")
        .limit(20);

      if (currentRequest !== requestId.current) return;
      setLoading(false);
      if (queryError) {
        setResults([]);
        setError("Não foi possível buscar destinatários.");
        return;
      }
      setError(null);
      setResults((data ?? []).map(toActorCard));
    }, 250);

    return () => window.clearTimeout(handle);
  }, [client, viewer, query]);

  function openConversation(targetActorId: string) {
    if (!sender) return;
    setError(null);
    startTransition(async () => {
      const result = await startDirectAction(targetActorId, sender.id);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      onClose();
      router.push(`/messages/${result.conversationId}`);
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-6"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !pending) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-message-title"
        className="max-h-[90dvh] w-full max-w-md overflow-y-auto border border-line bg-surface p-5"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="new-message-title" className="font-display text-base text-ink">Nova mensagem</h2>
          <button type="button" onClick={onClose} disabled={pending} aria-label="Fechar" className="p-1.5 text-ink-3 hover:bg-sunken">
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>

        {voices.length > 1 ? (
          <div className="mb-4">
            <label htmlFor="new-message-sender" className="label text-ink-2">Enviando como</label>
            <Select id="new-message-sender" value={sender?.id ?? ""} onChange={(event) => setSenderId(event.currentTarget.value)} className="mt-1.5 w-full">
              {voices.map((voice) => <option key={voice.id} value={voice.id}>{voice.display_name}</option>)}
            </Select>
          </div>
        ) : null}

        <label htmlFor="new-message-search" className="sr-only">Buscar destinatário</label>
        <div className="flex items-center gap-2 border border-line-2 px-3 py-2">
          <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-ink-3" />
          <input
            ref={inputRef}
            id="new-message-search"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="Nome ou @username"
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-3"
          />
        </div>

        {error ? <p role="alert" className="mt-2 text-xs text-danger">{error}</p> : null}
        {query.trim().length < 2 ? (
          <p className="mt-4 text-sm text-ink-3">Digite pelo menos 2 caracteres para buscar.</p>
        ) : loading ? (
          <p className="mt-4 text-sm text-ink-3" role="status">Buscando…</p>
        ) : results.length === 0 ? (
          <p className="mt-4 text-sm text-ink-3">Nenhum personagem encontrado.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line border-y border-line">
            {results.map((actor) => (
              <li key={actor.id}>
                <button
                  type="button"
                  disabled={pending || !sender}
                  onClick={() => openConversation(actor.id)}
                  className="flex w-full items-center gap-3 px-2 py-3 text-left hover:bg-sunken disabled:opacity-50"
                >
                  <Avatar name={actor.display_name} username={actor.username} src={actor.avatar_url} size="sm" decorative />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-ink">{actor.display_name}</span>
                    <span className="block truncate font-mono text-[11px] text-ink-3">@{actor.username}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}