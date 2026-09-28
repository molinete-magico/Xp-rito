"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleFollowAction } from "@/app/actions/posts";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/**
 * Seguir / deixar de seguir.
 *
 * Otimista como o resto das interações: o rótulo muda na hora e volta se o banco
 * disser que não. Uma recusa do RLS aparece como mensagem em vez de sumir com o
 * botão.
 */
export function FollowButton({
  targetActorId,
  initialFollowing,
  initialFollowers,
}: {
  targetActorId: string;
  initialFollowing: boolean;
  initialFollowers: number;
}) {
  const router = useRouter();
  const [following, setFollowing] = useState(initialFollowing);
  const [count, setCount] = useState(initialFollowers);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !following;
    setFollowing(next);
    setCount((value) => value + (next ? 1 : -1));
    setError(null);

    startTransition(async () => {
      const result = await toggleFollowAction(targetActorId);
      if ("error" in result) {
        setFollowing(!next);
        setCount((value) => value + (next ? -1 : 1));
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={following}
        className={buttonClass(following ? "outline" : "primary", "sm")}
      >
        {pending ? "…" : following ? "Seguindo" : "Seguir"}
      </button>

      <span className="text-xs text-ink-3 tabular-nums" aria-live="polite">
        {error ? (
          <span role="alert" className="text-danger">
            {error}
          </span>
        ) : (
          `${count} ${count === 1 ? "seguidor" : "seguidores"}`
        )}
      </span>
    </div>
  );
}

export function Stat({
  value,
  label,
  className,
}: {
  value: number;
  label: string;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-baseline gap-1.5", className)}>
      <span className="tabular-nums text-ink">{value}</span>
      <span className="text-ink-3">{label}</span>
    </span>
  );
}
