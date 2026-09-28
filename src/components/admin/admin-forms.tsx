"use client";

import { useActionState } from "react";
import { Plus, Save, Trash2, UserCog, UserPlus } from "lucide-react";
import {
  createNpcAction,
  updateNpcAction,
  deleteNpcAction,
  takePlayerCharacterAction,
  grantNpcAction,
  createOrganizationAction,
  updateOrganizationAction,
  deleteOrganizationAction,
} from "@/app/actions/admin";
import { Field, TextArea, TextInput, Select } from "@/components/ui/field";
import { buttonClass } from "@/components/ui/button";
import { ImageRow } from "@/components/settings/image-form";
import { idleState, type ActionState } from "@/lib/validation/schemas";
import { organizationTypeLabels } from "@/lib/site";

/**
 * Formulários do painel.
 *
 * Repetitivos de propósito: um estado por formulário, sem abstração de CRUD,
 * porque cada trecho é pequeno e fácil de auditar. A exclusão é um form próprio
 * com double-check no navegador; as edições abrem em `<details>` para não
 * transformar a lista inteira em campos.
 */

export type NpcDraft = {
  id: string;
  name: string;
  username: string;
  bio: string | null;
  actors?: { id: string } | null;
  actorId?: string;
};
export type OrgDraft = {
  id: string;
  name: string;
  username: string;
  description: string | null;
  type: string;
  actors?: { id: string } | null;
  actorId?: string;
};
export type PlayerCharacterDraft = {
  id: string;
  name: string;
  username: string;
  ownerName: string;
};
export type PlayerSelectItem = {
  id: string;
  display_name: string;
};

export function NpcCreateForm() {
  const [state, formAction, pending] = useActionState(createNpcAction, idleState);

  return (
    <form action={formAction} className="space-y-4 border border-line p-3">
      <p className="label text-ink-3">Novo NPC</p>
      <NpcFields state={state} mode="create" />
      <Feedback state={state} />
      <button type="submit" disabled={pending} className={buttonClass("primary", "sm")}>
        <Plus aria-hidden="true" className="h-3.5 w-3.5" />
        {pending ? "Criando…" : "Criar NPC"}
      </button>
    </form>
  );
}

export function NpcRow({
  npc,
  players,
}: {
  npc: NpcDraft;
  players: PlayerSelectItem[];
}) {
  const [state, formAction, pending] = useActionState(updateNpcAction, idleState);

  return (
    <li className="border-b border-line px-3 py-2 last:border-b-0">
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-sm text-ink">{npc.name}</span>
        <span className="font-mono text-[11px] text-ink-3">@{npc.username}</span>
      </div>

      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-ink-2 hover:underline">Editar</summary>
        <div className="mt-3 space-y-4 border-t border-line pt-3">
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="characterId" value={npc.id} />
            <NpcFields state={state} mode="edit" defaults={npc} />
            <div className="flex items-center justify-between gap-3">
              <Feedback state={state} />
              <button type="submit" disabled={pending} className={buttonClass("outline", "sm")}>
                <Save aria-hidden="true" className="h-3.5 w-3.5" />
                {pending ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </form>
          <section aria-labelledby={`imagens-npc-${npc.id}`}>
            <h3 id={`imagens-npc-${npc.id}`} className="label mb-2 text-ink-3">
              Foto e capa
            </h3>
            <ImageRow actorId={npc.actorId ?? ""} />
          </section>
        </div>
      </details>

      <form action={deleteNpcAction} className="mt-2">
        <input type="hidden" name="characterId" value={npc.id} />
        <button
          type="submit"
          className={buttonClass("danger", "sm")}
          onClick={(event) => {
            if (!confirm(`Apagar ${npc.name} e tudo que publicou?`)) event.preventDefault();
          }}
        >
          <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
          Apagar
        </button>
      </form>

      <NpcOwnerForm npc={npc} players={players} />
    </li>
  );
}

export function PlayerCharacterRow({ character }: { character: PlayerCharacterDraft }) {
  const [state, formAction, pending] = useActionState(takePlayerCharacterAction, idleState);

  return (
    <li className="border-b border-line px-3 py-2 last:border-b-0">
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-sm text-ink">{character.name}</span>
        <span className="font-mono text-[11px] text-ink-3">@{character.username}</span>
      </div>
      <div className="mt-1 flex items-center justify-between gap-3">
        <span className="truncate text-[11px] text-ink-3">de {character.ownerName}</span>
        <form action={formAction}>
          <input type="hidden" name="characterId" value={character.id} />
          <button
            type="submit"
            className={buttonClass("outline", "sm")}
            disabled={pending}
            onClick={(event) => {
              if (!confirm(`Assumir ${character.name}? Ele deixa de ser do(a) jogador(a) e vira NPC.`)) {
                event.preventDefault();
              }
            }}
          >
            <UserCog aria-hidden="true" className="h-3.5 w-3.5" />
            {pending ? "Assumindo…" : "Assumir (vira NPC)"}
          </button>
        </form>
      </div>
      <Feedback state={state} />
    </li>
  );
}

function NpcOwnerForm({
  npc,
  players,
}: {
  npc: NpcDraft;
  players: PlayerSelectItem[];
}) {
  const [state, formAction, pending] = useActionState(grantNpcAction, idleState);

  if (players.length === 0) return null;

  return (
    <form action={formAction} className="mt-3 flex flex-wrap items-end gap-2 border-t border-line pt-3">
      <div className="min-w-[9rem] flex-1">
        <label htmlFor={`dono-npc-${npc.id}`} className="label mb-1 block text-ink-3">
          Entregar a um jogador
        </label>
        <Select id={`dono-npc-${npc.id}`} name="playerId" required>
          {players.map((player) => (
            <option key={player.id} value={player.id}>
              {player.display_name}
            </option>
          ))}
        </Select>
      </div>
      <input type="hidden" name="characterId" value={npc.id} />
      <button type="submit" className={buttonClass("outline", "sm")} disabled={pending}>
        <UserPlus aria-hidden="true" className="h-3.5 w-3.5" />
        {pending ? "Entregando…" : "Entregar"}
      </button>
      <Feedback state={state} />
    </form>
  );
}

export function OrganizationCreateForm() {
  const [state, formAction, pending] = useActionState(createOrganizationAction, idleState);

  return (
    <form action={formAction} className="space-y-4 border border-line p-3">
      <p className="label text-ink-3">Nova organização</p>
      <OrganizationFields state={state} mode="create" />
      <Feedback state={state} />
      <button type="submit" disabled={pending} className={buttonClass("primary", "sm")}>
        <Plus aria-hidden="true" className="h-3.5 w-3.5" />
        {pending ? "Criando…" : "Criar organização"}
      </button>
    </form>
  );
}

export function OrganizationRow({ org }: { org: OrgDraft }) {
  const [state, formAction, pending] = useActionState(updateOrganizationAction, idleState);

  return (
    <li className="border-b border-line px-3 py-2 last:border-b-0">
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-sm text-ink">{org.name}</span>
        <span className="label text-ink-3">
          {org.type in organizationTypeLabels ? organizationTypeLabels[org.type as keyof typeof organizationTypeLabels] : "Entidade"}
        </span>
        <span className="font-mono text-[11px] text-ink-3">@{org.username}</span>
      </div>

      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-ink-2 hover:underline">Editar</summary>
        <div className="mt-3 space-y-4 border-t border-line pt-3">
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="organizationId" value={org.id} />
            <OrganizationFields state={state} mode="edit" defaults={org} />
            <div className="flex items-center justify-between gap-3">
              <Feedback state={state} />
              <button type="submit" disabled={pending} className={buttonClass("outline", "sm")}>
                <Save aria-hidden="true" className="h-3.5 w-3.5" />
                {pending ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </form>
          <section aria-labelledby={`imagens-org-${org.id}`}>
            <h3 id={`imagens-org-${org.id}`} className="label mb-2 text-ink-3">
              Foto e capa
            </h3>
            <ImageRow actorId={org.actorId ?? ""} />
          </section>
        </div>
      </details>

      <form action={deleteOrganizationAction} className="mt-2">
        <input type="hidden" name="organizationId" value={org.id} />
        <button
          type="submit"
          className={buttonClass("danger", "sm")}
          onClick={(event) => {
            if (!confirm(`Apagar ${org.name} e tudo que publicou?`)) event.preventDefault();
          }}
        >
          <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
          Apagar
        </button>
      </form>
    </li>
  );
}

function NpcFields({
  state,
  mode,
  defaults,
}: {
  state: ActionState;
  mode: "create" | "edit";
  defaults?: NpcDraft;
}) {
  return (
    <>
      <Field label="Nome" error={state.errors?.name}>
        {(props) => (
          <TextInput
            {...props}
            name="name"
            defaultValue={mode === "edit" ? defaults?.name : undefined}
            maxLength={80}
            required
          />
        )}
      </Field>
      <Field label="@handle na rede" error={state.errors?.username}>
        {(props) => (
          <TextInput
            {...props}
            name="username"
            defaultValue={mode === "edit" ? defaults?.username : undefined}
            className="font-mono"
            maxLength={30}
            required
          />
        )}
      </Field>
      <Field label="Bio" hint="Máximo de 300 caracteres." error={state.errors?.bio}>
        {(props) => (
          <TextArea
            {...props}
            name="bio"
            rows={2}
            maxLength={300}
            defaultValue={mode === "edit" ? defaults?.bio ?? "" : undefined}
          />
        )}
      </Field>
    </>
  );
}

function OrganizationFields({
  state,
  mode,
  defaults,
}: {
  state: ActionState;
  mode: "create" | "edit";
  defaults?: OrgDraft;
}) {
  return (
    <>
      <Field label="Nome" error={state.errors?.name}>
        {(props) => (
          <TextInput
            {...props}
            name="name"
            defaultValue={mode === "edit" ? defaults?.name : undefined}
            maxLength={80}
            required
          />
        )}
      </Field>

      <Field label="Tipo" error={state.errors?.type}>
        {(props) => (
          <Select
            {...props}
            name="type"
            defaultValue={
              mode === "edit" && defaults?.type
                ? defaults.type
                : "organization"
            }
          >
            {Object.entries(organizationTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <Field label="@handle na rede" error={state.errors?.username}>
        {(props) => (
          <TextInput
            {...props}
            name="username"
            defaultValue={mode === "edit" ? defaults?.username : undefined}
            className="font-mono"
            maxLength={30}
            required
          />
        )}
      </Field>

      <Field label="Descrição" hint="Máximo de 300 caracteres." error={state.errors?.description}>
        {(props) => (
          <TextArea
            {...props}
            name="description"
            rows={2}
            maxLength={300}
            defaultValue={mode === "edit" ? defaults?.description ?? "" : undefined}
          />
        )}
      </Field>
    </>
  );
}

function Feedback({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return state.ok ? (
    <p role="status" className="text-xs text-ink-2">
      {state.message}
    </p>
  ) : (
    <p role="alert" className="border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-danger-strong">
      {state.message}
    </p>
  );
}