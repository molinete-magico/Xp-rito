"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, LogOut, PlusCircle, Settings, Shield, User } from "lucide-react";
import { setActiveActorAction, signOutAction } from "@/app/actions/auth";
import { Avatar } from "@/components/ui/avatar";
import { AccountTypeStamp } from "@/components/ui/account-type";
import { Menu, MenuItem, MenuLabel, MenuSeparator } from "@/components/ui/menu";
import { accountTypeOf, site } from "@/lib/site";
import type { ActorSummary } from "@/lib/types";

/**
 * Menu da conta, no canto da coluna lateral.
 *
 * Mostra com quem se está publicando e dá as três saídas que existem: trocar de
 * identidade, ajustar a conta e sair.
 */
export function AccountMenuClient({
  identities,
  activeActorId,
  isGm,
  onNavigate,
}: {
  identities: ActorSummary[];
  activeActorId: string | null;
  isGm: boolean;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const active = identities.find((actor) => actor.id === activeActorId) ?? identities[0] ?? null;

  return (
    <Menu
      label="Conta"
      align="start"
      className="w-full"
      trigger={(props) => (
        <button
          {...props}
          type="button"
          className="flex w-full items-center gap-2.5 rounded-xs px-2 py-2 text-left transition-colors hover:bg-sunken"
        >
          {active ? (
            <Avatar
              name={active.display_name}
              username={active.username}
              src={active.avatar_url}
              size="sm"
              decorative
            />
          ) : (
            <span className="flex h-8 w-8 items-center justify-center border border-line text-xs text-ink-3">
              ?
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm text-ink">
              {active?.display_name ?? "Sem identidade"}
            </span>
            <span className="block truncate font-mono text-[11px] text-ink-3">
              {active ? `@${active.username}` : "crie um personagem"}
            </span>
          </span>
          <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-ink-3" />
        </button>
      )}
    >
      {(close) => (
        <>
          {active ? (
            <>
              <MenuLabel>Falando como</MenuLabel>
              <MenuItem
                onSelect={() => {
                  close();
                  onNavigate?.();
                  router.push(`/profile/${active.username}`);
                }}
              >
                <span className="flex flex-col items-start">
                  <span className="flex items-center gap-1.5">
                    {active.display_name}
                    <AccountTypeStamp type={accountTypeOf(active)} />
                  </span>
                  <span className="font-mono text-[11px] text-ink-3">@{active.username}</span>
                </span>
              </MenuItem>
              <MenuItem
                onSelect={() => {
                  close();
                  onNavigate?.();
                  router.push(`/profile/${active.username}`);
                }}
              >
                <User aria-hidden="true" className="h-4 w-4" />
                Ver perfil
              </MenuItem>
            </>
          ) : null}

          {identities.length > 1 ? (
            <>
              <MenuSeparator />
              <MenuLabel>Trocar identidade</MenuLabel>
              {identities
                .filter((actor) => actor.id !== active?.id)
                .map((actor) => (
                  <form key={actor.id} action={setActiveActorAction.bind(null, actor.id)}>
                    <button
                      type="submit"
                      disabled={pending}
                      onClick={close}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-sunken"
                    >
                      <Avatar
                        name={actor.display_name}
                        username={actor.username}
                        src={actor.avatar_url}
                        size="xs"
                        decorative
                      />
                      <span className="truncate">{actor.display_name}</span>
                    </button>
                  </form>
                ))}
            </>
          ) : null}

          <MenuSeparator />
          <MenuItem
            onSelect={() => {
              close();
              onNavigate?.();
              router.push("/settings");
            }}
          >
            <Settings aria-hidden="true" className="h-4 w-4" />
            Configurações
          </MenuItem>

          {isGm ? (
            <MenuItem
              onSelect={() => {
                close();
                onNavigate?.();
                router.push("/admin");
              }}
            >
              <Shield aria-hidden="true" className="h-4 w-4" />
              Painel do Mestre
            </MenuItem>
          ) : null}

          <MenuSeparator />
          <MenuItem
            destructive
            onSelect={() => {
              close();
              if (busy) return;
              setBusy(true);
              startTransition(async () => {
                await signOutAction();
                router.refresh();
              });
            }}
          >
            <LogOut aria-hidden="true" className="h-4 w-4" />
            Sair
          </MenuItem>
        </>
      )}
    </Menu>
  );
}

/** Ligação para a própria página, usada no estado "nenhuma identidade ainda". */
export function CreateIdentityLink() {
  return (
    <Link href="/settings" className="flex items-center gap-2 text-sm text-ink-2 hover:text-ink">
      <PlusCircle aria-hidden="true" className="h-4 w-4" />
      Criar personagem
    </Link>
  );
}

export function Brand() {
  return (
    <Link href="/home" className="block" aria-label={`${site.name}, ir para o início`}>
      <span className="font-display text-lg leading-none text-ink">{site.name}</span>
    </Link>
  );
}
