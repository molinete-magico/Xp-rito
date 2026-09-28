import type { AccountType } from "@/lib/site";
import { cn } from "@/lib/cn";

/**
 * Carimbo do tipo de conta.
 *
 * Diz se quem escreve é um personagem, um NPC, uma instituição ou um veículo de
 * mídia. Texto em mono, nunca só cor ou ícone, para quem usa leitor de tela.
 */
export function AccountTypeStamp({
  type,
  className,
}: {
  type: AccountType;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center border px-1.5 py-0.5 font-mono text-[10px] leading-none tracking-[0.12em] uppercase",
        type === "npc"
          ? "border-accent/40 text-accent"
          : type === "institution" || type === "media"
            ? "border-line-2 text-ink-2"
            : "border-line text-ink-3",
        className,
      )}
    >
      {type}
    </span>
  );
}

/** @handle em mono. */
export function Handle({
  username,
  className,
  size = "sm",
}: {
  username: string;
  className?: string;
  size?: "xs" | "sm" | "md";
}) {
  return (
    <span
      className={cn(
        "font-mono text-ink-3",
        size === "xs" && "text-[11px]",
        size === "sm" && "text-xs",
        size === "md" && "text-sm",
        className,
      )}
    >
      @{username}
    </span>
  );
}
