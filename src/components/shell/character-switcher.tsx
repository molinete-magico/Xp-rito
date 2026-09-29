"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, LogOut, Settings, Shield, User } from "lucide-react";
import { signOutAction } from "@/app/actions/auth";
import { Avatar } from "@/components/ui/avatar";
import { AccountTypeStamp, Handle } from "@/components/ui/account-type";
import { Menu, MenuItem, MenuLabel, MenuSeparator } from "@/components/ui/menu";
import { useSession } from "@/components/shell/session-provider";
import { accountTypeOf } from "@/lib/site";
import type { ActorSummary } from "@/lib/types";

/**
 * Troca de personagem, no cabeçalho do celular.
 *
 * O avatar abre o menu com as identidades que o RLS libera — personagens do
 * jogador, NPCs e organizações do Mestre —, marca com quem se está falando e
 * refaz a página depois de trocar, para o feed e o compositor passarem a
 * responder pelo novo perfil imediatamente.
 */
export function CharacterSwitcher({
  identities,
  activeActorId,
  isGm,
}: {
  identities: ActorSummary[];
  activeActorId: string | null;
  isGm: boolean;
}) {
  const router = useRouter();
  const { setActiveActor } = useSession();
  const [busy, waitTransition] = useTransition();
  const [signingOut, setSigningOut] = useState(false);

  const active = identities.find((actor) => actor.id === activeActorId) ?? identities[0] ?? null;
  const mine = identities.filter(
    (actor) => actor.entity_type === "character" && actor.is_npc !== true && actor.id !== active?.id,
  );
  const npcs = identities.filter(
    (actor) => actor.entity_type === "character" && actor.is_npc === true && actor.id !== active?.id,
  );
  const organizations = identities.filter(
    (actor) => actor.entity_type === "organization" && actor.id !== active?.id,
  );

  function switchTo(actorId: string, close: () => void) {
    close();
    waitTransition(async () => {
      const allowed = await setActiveActor(actorId);
      if (allowed) router.refresh();
    });
  }

  function signOut(close: () => void) {
    close();
    if (signingOut) return;
    setSigningOut(true);
    waitTransition(async () => {
      await signOutAction();
      router.refresh();
    });
  }

  return (
    <Menu
      label="Conta"
      align="end"
      trigger={(props) => (
        <button {...props} type="button" aria-label="Conta" className="rounded-full p-1 transition-colors hover:bg-sunken">
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
        </button>
      )}
    >
        {(close) => (
          <>
            {active ? (
              <>
                <MenuLabel>Falando como</MenuLabel>
                <div className="flex items-center gap-2.5 bg-sunken px-3 py-2.5">
                  <Avatar
                    name={active.display_name}
                    username={active.username}
                    src={active.avatar_url}
                    size="md"
                    decorative
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-medium text-ink">{active.display_name}</span>
                      <AccountTypeStamp type={accountTypeOf(active)} />
                    </span>
                    <Handle username={active.username} size="xs" />
                  </span>
                  <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-accent" />
                </div>
              </>
            ) : (
              <>
                <MenuLabel>Sem identidade ainda</MenuLabel>
                <p className="px-3 py-2 text-xs leading-relaxed text-ink-3">
                  Crie seu primeiro personagem em Configurações para poder publicar.
                </p>
              </>
            )}

            {mine.length > 0 ? (
              <>
                <MenuSeparator />
                <MenuLabel>Seus personagens</MenuLabel>
                {mine.map((actor) => (
                  <SwitchRow
                    key={actor.id}
                    actor={actor}
                    disabled={busy}
                    onSelect={() => switchTo(actor.id, close)}
                  />
                ))}
              </>
            ) : null}

            {isGm && npcs.length > 0 ? (
              <>
                <MenuSeparator />
                <MenuLabel>NPCs da mesa</MenuLabel>
                {npcs.map((actor) => (
                  <SwitchRow
                    key={actor.id}
                    actor={actor}
                    disabled={busy}
                    onSelect={() => switchTo(actor.id, close)}
                  />
                ))}
              </>
            ) : null}

            {isGm && organizations.length > 0 ? (
              <>
                <MenuSeparator />
                <MenuLabel>Organizações</MenuLabel>
                {organizations.map((actor) => (
                  <SwitchRow
                    key={actor.id}
                    actor={actor}
                    disabled={busy}
                    onSelect={() => switchTo(actor.id, close)}
                  />
                ))}
              </>
            ) : null}

            <MenuSeparator />
            <MenuItem
              onSelect={() => {
                close();
                router.push(`/profile/${active?.username ?? ""}`);
              }}
            >
              <User aria-hidden="true" className="h-4 w-4" />
              Ver perfil
            </MenuItem>
            <MenuItem
              onSelect={() => {
                close();
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
                  router.push("/admin");
                }}
              >
                <Shield aria-hidden="true" className="h-4 w-4" />
                Painel do Mestre
              </MenuItem>
            ) : null}
            <MenuSeparator />
            <MenuItem destructive onSelect={() => signOut(close)}>
              <LogOut aria-hidden="true" className="h-4 w-4" />
              Sair
            </MenuItem>
          </>
        )}
      </Menu>
  );
}

/** Uma identidade candidata a virar o perfil ativo. */
function SwitchRow({
  actor,
  disabled,
  onSelect,
}: {
  actor: ActorSummary;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <MenuItem onSelect={onSelect}>
      <span className="sr-only">Publicar como</span>
      <Avatar name={actor.display_name} username={actor.username} src={actor.avatar_url} size="xs" decorative />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate">{actor.display_name}</span>
          <AccountTypeStamp type={accountTypeOf(actor)} />
        </span>
        <span className="block font-mono text-[11px] text-ink-3">@{actor.username}</span>
      </span>
      {disabled ? <span className="text-xs text-ink-3">…</span> : null}
    </MenuItem>
  );
}