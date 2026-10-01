"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Users } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { AccountTypeStamp, Handle } from "@/components/ui/account-type";
import { Menu, MenuLabel, MenuSeparator } from "@/components/ui/menu";
import { useSession } from "@/components/shell/session-provider";
import { preferredActiveActorId } from "@/lib/data/identities";
import { accountTypeOf } from "@/lib/site";
import type { ActorSummary } from "@/lib/types";

/**
 * Elenco de identidades.
 *
 * Trocar de personagem é a mesma ação em três lugares — o menu do celular, a
 * caixinha do compositor e o botão do Mestre na coluna da esquerda — então a
 * lista vive aqui e os três desenham a mesma. Ela precisa se comportar bem com
 * muita gente: o grupo do Mestre costuma ter NPC demais para caber numa caixa,
 * e quem some do fundo da lista é justamente quem se procura.
 *
 * O agrupamento também é o mesmo nos três, porque é a mesma função: os
 * personagens do Mestre e os NPCs da mesa se procuram em listas diferentes, já
 * que são coisas diferentes.
 */

/**
 * Troca de identidade.
 *
 * Quem decide é o banco: `setActiveActor` da sessão só escreve o espelho local
 * quando o cookie foi aceito, e serializa as trocas para que duas escolhas
 * seguidas não se embaralhem. A tela espera a resposta em vez de trocar na hora
 * — trocar para Mad e, no pior caso, a página voltar para Autumn no próximo
 * carregamento é pior do que o meio segundo de espera. Quando a troca é
 * recusada, a identidade anterior continua marcada e a pessoa lê o motivo, com
 * o menu ainda aberto: fechar antes seria mostrar o erro em uma lista que a
 * pessoa já não está mais vendo.
 */
export function useIdentitySwitch() {
  const router = useRouter();
  const { viewer, setActiveActor } = useSession();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const identities = viewer?.identities ?? [];
  const activeActorId =
    viewer?.activeActorId ?? (identities.length > 0 ? preferredActiveActorId(identities) : null);
  const isGm = viewer?.isGm ?? false;

  /** @param onSettled Fecha o menu só quando a troca deu certo. */
  function switchTo(actorId: string, onSettled?: () => void) {
    if (actorId === activeActorId) {
      onSettled?.();
      return;
    }

    setError(null);
    startTransition(async () => {
      const allowed = await setActiveActor(actorId);
      if (allowed) {
        router.refresh();
        onSettled?.();
        return;
      }
      setError("Não foi possível trocar de personagem.");
    });
  }

  return { switchTo, pending, error, activeActorId, identities, isGm, clearError: () => setError(null) };
}

export function IdentityRoster({
  identities,
  activeActorId,
  isGm = false,
  onSelect,
  disabled = false,
  error = null,
}: {
  identities: ActorSummary[];
  activeActorId: string | null;
  /** NPCs e organizações só entram para quem é Mestre. */
  isGm?: boolean;
  onSelect: (actorId: string) => void;
  disabled?: boolean;
  /** Recusa do banco, mostrada na língua de quem tentou trocar. */
  error?: string | null;
}) {
  const active =
    identities.find((actor) => actor.id === activeActorId)
    ?? identities.find((actor) => actor.id === preferredActiveActorId(identities))
    ?? null;

  if (!active) {
    return (
      <p className="px-3 py-2 text-xs leading-relaxed text-ink-3">
        Crie seu primeiro personagem em Configurações para poder publicar.
      </p>
    );
  }

  const mine = identities.filter(
    (actor) => actor.entity_type === "character" && actor.is_npc !== true && actor.id !== active.id,
  );
  const npcs = isGm
    ? identities.filter(
        (actor) => actor.entity_type === "character" && actor.is_npc === true && actor.id !== active.id,
      )
    : [];
  const organizations = isGm
    ? identities.filter((actor) => actor.entity_type === "organization" && actor.id !== active.id)
    : [];

  return (
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

      {mine.length > 0 ? (
        <>
          <MenuSeparator />
          <MenuLabel>Seus personagens</MenuLabel>
          {mine.map((actor) => (
            <RosterRow
              key={actor.id}
              actor={actor}
              disabled={disabled}
              onSelect={() => onSelect(actor.id)}
            />
          ))}
        </>
      ) : null}

      {npcs.length > 0 ? (
        <>
          <MenuSeparator />
          <MenuLabel>NPCs da mesa</MenuLabel>
          {npcs.map((actor) => (
            <RosterRow
              key={actor.id}
              actor={actor}
              disabled={disabled}
              onSelect={() => onSelect(actor.id)}
            />
          ))}
        </>
      ) : null}

      {organizations.length > 0 ? (
        <>
          <MenuSeparator />
          <MenuLabel>Organizações</MenuLabel>
          {organizations.map((actor) => (
            <RosterRow
              key={actor.id}
              actor={actor}
              disabled={disabled}
              onSelect={() => onSelect(actor.id)}
            />
          ))}
        </>
      ) : null}

      {error ? (
        <p role="alert" className="border-t border-line px-3 py-2 text-xs leading-relaxed text-danger">
          {error}
        </p>
      ) : null}
    </>
  );
}

function RosterRow({
  actor,
  disabled,
  onSelect,
}: {
  actor: ActorSummary;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onSelect}
      disabled={disabled}
      className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-sunken disabled:opacity-50"
    >
      <span className="sr-only">Publicar como</span>
      <Avatar name={actor.display_name} username={actor.username} src={actor.avatar_url} size="xs" decorative />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate" data-identity-name>
            {actor.display_name}
          </span>
          <AccountTypeStamp type={accountTypeOf(actor)} />
        </span>
        <span className="block font-mono text-[11px] text-ink-3">@{actor.username}</span>
      </span>
      {disabled ? <span className="text-xs text-ink-3">…</span> : null}
    </button>
  );
}

/**
 * Botão do elenco na coluna da esquerda, acima do Painel do Mestre.
 *
 * No desktop o único lugar para trocar de personagem era a caixinha do
 * compositor, que some em /mensagens, em /admin e em qualquer página sem
 * compositor — e é justamente o Painel do Mestre que fica sem caminho para os
 * NPCs. O botão fica na seção do Mestre e o menu abre para cima, porque a
 * seção é presa na base da coluna e um menu para baixo sairia da tela.
 */
export function IdentityRosterButton() {
  const { switchTo, pending, error, identities, activeActorId, isGm } = useIdentitySwitch();
  const active = identities.find((actor) => actor.id === activeActorId) ?? identities[0] ?? null;
  if (!active) return null;

  const characters = identities.filter((actor) => actor.entity_type === "character").length;

  return (
    <Menu
      label="Personagens"
      placement="top"
      trigger={(props) => (
        <button
          {...props}
          type="button"
          aria-label={`Personagens, falando como ${active.display_name}`}
          className="flex w-full items-center gap-3 border-l-2 border-transparent py-2.5 pl-3 text-sm text-ink-2 transition-colors hover:bg-sunken hover:text-ink"
        >
          <Users aria-hidden="true" className="h-[18px] w-[18px] shrink-0" />
          <span className="min-w-0 flex-1 truncate text-left">{active.display_name}</span>
          {characters > 1 ? (
            <span className="shrink-0 font-mono text-[10px] text-ink-3 tabular-nums">{characters}</span>
          ) : null}
        </button>
      )}
    >
      {(close) => (
        <IdentityRoster
          identities={identities}
          activeActorId={activeActorId}
          isGm={isGm}
          disabled={pending}
          error={error}
          onSelect={(actorId) => switchTo(actorId, close)}
        />
      )}
    </Menu>
  );
}
