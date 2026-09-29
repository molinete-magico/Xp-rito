"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { AccountTypeStamp } from "@/components/ui/account-type";
import { useSession } from "@/components/shell/session-provider";
import { accountTypeOf } from "@/lib/site";
import type { ActorSummary } from "@/lib/types";

/**
 * Troca de identidade.
 *
 * Quem tem várias identidades escolhe com quem está publicando. O cookie é
 * httpOnly e o RLS decide se a identidade pertence à pessoa; a troca aqui é
 * conveniência de interface.
 */
export function IdentitySwitcher({
  identities,
  activeActorId,
  size = "sm",
}: {
  identities: ActorSummary[];
  activeActorId: string | null;
  size?: "sm" | "md";
}) {
  const router = useRouter();
  const { setActiveActor } = useSession();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);

  const active = identities.find((actor) => actor.id === activeActorId) ?? identities[0] ?? null;

  if (!active) return null;

  function choose(actorId: string) {
    setSwitchError(null);
    startTransition(async () => {
      const allowed = await setActiveActor(actorId);
      if (allowed) {
        setOpen(false);
        router.refresh();
      } else {
        setSwitchError("Não foi possível trocar de identidade.");
        setOpen(true);
      }
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex w-full items-center gap-2.5 rounded-xs border border-line bg-surface px-2 py-1.5 text-left transition-colors hover:bg-sunken"
      >
        <Avatar
          name={active.display_name}
          username={active.username}
          src={active.avatar_url}
          size={size}
          decorative
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-ink">{active.display_name}</span>
          <span className="block truncate font-mono text-[11px] text-ink-3">@{active.username}</span>
        </span>
      </button>

      {switchError ? <p role="alert" className="mt-1 text-xs text-danger">{switchError}</p> : null}

      {open ? (
        <>
          <button
            type="button"
            aria-label="Fechar"
            className="fixed inset-0 z-30 cursor-default"
            onClick={() => setOpen(false)}
          />
          <ul
            role="listbox"
            aria-label="Identidades"
            className="absolute z-40 mt-1.5 w-full min-w-56 border border-line bg-surface shadow-[0_8px_24px_-16px_rgba(0,0,0,0.45)]"
          >
            {identities.map((actor) => {
              const selected = actor.id === active.id;
              return (
                <li key={actor.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    disabled={pending}
                    onClick={() => choose(actor.id)}
                    className="flex w-full items-center gap-2.5 px-2.5 py-2 text-left transition-colors hover:bg-sunken disabled:opacity-50"
                  >
                    <Avatar
                      name={actor.display_name}
                      username={actor.username}
                      src={actor.avatar_url}
                      size="sm"
                      decorative
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-ink">{actor.display_name}</span>
                      <span className="mt-0.5 flex items-center gap-1.5">
                        <AccountTypeStamp type={accountTypeOf(actor)} />
                        <span className="truncate font-mono text-[11px] text-ink-3">
                          @{actor.username}
                        </span>
                      </span>
                    </span>
                    {selected ? <Check aria-hidden="true" className="h-4 w-4 text-accent" /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
    </div>
  );
}
