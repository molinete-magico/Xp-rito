"use client";

import { useActionState, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Check, Trash2, Loader2 } from "lucide-react";
import {
  attachIdentityImageAction,
  createCharacterAction,
  updateAccountAction,
  updateCharacterAction,
  deleteCharacterAction,
} from "@/app/actions/profile";
import { Field, FormMessage, TextArea, TextInput } from "@/components/ui/field";
import { buttonClass } from "@/components/ui/button";
import {
  AVATARS_BUCKET,
  BANNERS_BUCKET,
  MAX_AVATAR_BYTES,
  uploadImage,
} from "@/lib/media";
import { idleState } from "@/lib/validation/schemas";
import { normalizeUsername } from "@/lib/validation/username";
import type { ActorSummary } from "@/lib/types";

/**
 * Formulários de ajustes.
 *
 * Um `useActionState` por formulário, sem biblioteca: são quatro formulários com
 * um campo de erro cada. O botão de envio mostra o estado pendente e o formulário
 * só é controlado o suficiente para mostrar a prévia do @handle.
 */
export function AccountForm({
  displayName,
  username,
}: {
  displayName: string;
  username: string;
}) {
  const [state, formAction, pending] = useActionState(updateAccountAction, idleState);
  const [handle, setHandle] = useState(username);

  return (
    <form action={formAction} className="space-y-4">
      <Field label="Como a mesa te chama" error={state.errors?.displayName}>
        {(props) => (
          <TextInput {...props} name="displayName" defaultValue={displayName} maxLength={80} required />
        )}
      </Field>

      <Field
        label="Seu @handle"
        hint="É como você aparece como pessoa. Cada personagem tem o próprio."
        error={state.errors?.username}
      >
        {(props) => (
          <div className="flex items-center gap-2">
            <span aria-hidden="true" className="font-mono text-sm text-ink-3">
              @
            </span>
            <TextInput
              {...props}
              name="username"
              value={handle}
              onChange={(event) => setHandle(normalizeUsername(event.target.value))}
              maxLength={30}
              required
              className="font-mono"
            />
          </div>
        )}
      </Field>

      <Feedback state={state} />
      <SubmitRow pending={pending} label="Salvar conta" />
    </form>
  );
}

export function CharacterForm({
  character,
  initialBio,
  canDelete,
}: {
  character: ActorSummary;
  initialBio: string;
  canDelete: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateCharacterAction, idleState);
  const [handle, setHandle] = useState(character.username);

  return (
    <div className="space-y-4">
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="characterId" value={character.entity_id} />

        <Field label="Nome do personagem" error={state.errors?.name}>
          {(props) => (
            <TextInput
              {...props}
              name="name"
              defaultValue={character.display_name}
              maxLength={80}
              required
            />
          )}
        </Field>

        <Field
          label="@handle na rede"
          hint="É este que aparece nas publicações e no link do perfil."
          error={state.errors?.username}
        >
          {(props) => (
            <div className="flex items-center gap-2">
              <span aria-hidden="true" className="font-mono text-sm text-ink-3">
                @
              </span>
              <TextInput
                {...props}
                name="username"
                value={handle}
                onChange={(event) => setHandle(normalizeUsername(event.target.value))}
                maxLength={30}
                required
                className="font-mono"
              />
            </div>
          )}
        </Field>

        <Field
          label="Bio"
          hint="Máximo de 300 caracteres. Uma frase basta."
          error={state.errors?.bio}
        >
          {(props) => (
            <TextArea {...props} name="bio" rows={3} maxLength={300} defaultValue={initialBio} />
          )}
        </Field>

        <Feedback state={state} />
        <SubmitRow pending={pending} label="Salvar personagem" />
      </form>

      <ImageRow actorId={character.id} />

      {canDelete ? (
        <details className="border border-line px-3 py-2">
          <summary className="cursor-pointer text-sm text-ink-2">Sair deste personagem</summary>
          <p className="mt-2 text-xs leading-relaxed text-ink-3">
            O personagem, as publicações e as curtidas dele são apagados. Não dá para desfazer.
          </p>
          <form action={deleteCharacterAction} className="mt-3">
            <input type="hidden" name="characterId" value={character.entity_id} />
            <button
              type="submit"
              className={buttonClass("danger", "sm")}
              onClick={(event) => {
                if (!confirm("Apagar este personagem e tudo que ele publicou?")) event.preventDefault();
              }}
            >
              <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
              Apagar personagem
            </button>
          </form>
        </details>
      ) : null}
    </div>
  );
}

export function NewCharacterForm() {
  const [state, formAction, pending] = useActionState(createCharacterAction, idleState);
  const [handle, setHandle] = useState("");

  return (
    <form action={formAction} className="space-y-4">
      <Field label="Nome do personagem" error={state.errors?.name}>
        {(props) => <TextInput {...props} name="name" maxLength={80} required />}
      </Field>

      <Field label="@handle na rede" error={state.errors?.username}>
        {(props) => (
          <div className="flex items-center gap-2">
            <span aria-hidden="true" className="font-mono text-sm text-ink-3">
              @
            </span>
            <TextInput
              {...props}
              name="username"
              value={handle}
              onChange={(event) => setHandle(normalizeUsername(event.target.value))}
              maxLength={30}
              required
              className="font-mono"
            />
          </div>
        )}
      </Field>

      <Field label="Bio" hint="Opcional. Pode preencher depois." error={state.errors?.bio}>
        {(props) => <TextArea {...props} name="bio" rows={2} maxLength={300} />}
      </Field>

      <Feedback state={state} />
      <SubmitRow pending={pending} label="Criar personagem" />
    </form>
  );
}

function ImageRow({ actorId }: { actorId: string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <ImageForm
        label="Foto"
        hint="Quadrada, até 5 MB."
        bucket={AVATARS_BUCKET}
        fields={{ actorId, kind: "avatar" }}
      />
      <ImageForm
        label="Capa"
        hint="Proporção larga, até 5 MB."
        bucket={BANNERS_BUCKET}
        fields={{ actorId, kind: "banner" }}
      />
    </div>
  );
}

/**
 * Upload da foto/capa.
 *
 * O arquivo vai direto do navegador para o Storage: a sessão autenticada está no
 * fetch e a política do bucket compara o primeiro segmento do caminho com o
 * actor que o usuário controla. Só depois disso chamamos a Action que grava a
 * URL pública no banco. Se o upload falhar, o servidor nem é tocado.
 */
function ImageForm({
  label,
  hint,
  bucket,
  fields,
}: {
  label: string;
  hint: string;
  bucket: string;
  fields: { actorId: string; kind: "avatar" | "banner" };
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);

  async function onFile(file: File) {
    setPending(true);
    const uploaded = await uploadImage(file, {
      bucket,
      ownerId: fields.actorId,
      maxBytes: MAX_AVATAR_BYTES,
    });
    if (!uploaded.ok) {
      setStatus({ ok: false, message: uploaded.error });
      setPending(false);
      return;
    }
    const form = new FormData();
    form.set("actorId", fields.actorId);
    form.set("kind", fields.kind);
    form.set("storagePath", uploaded.storagePath);
    const outcome = await attachIdentityImageAction(form);
    setStatus({
      ok: outcome.ok,
      message: outcome.ok ? (outcome.message ?? "Imagem atualizada.") : (outcome.message ?? "Não foi possível salvar a imagem."),
    });
    setPending(false);
    if (outcome.ok) router.refresh();
  }

  return (
    <form
      className="border border-line p-3"
      onSubmit={(event) => {
        event.preventDefault();
        const file = inputRef.current?.files?.[0];
        if (file) void onFile(file);
      }}
    >
      <p className="label text-ink-3">{label}</p>
      <p className="mt-0.5 text-xs text-ink-3">{hint}</p>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        required
        className="mt-2 block w-full text-xs text-ink-2 file:mr-3 file:rounded-xs file:border file:border-line-2 file:bg-surface file:px-2 file:py-1 file:text-xs file:text-ink hover:file:bg-sunken"
      />

      <button type="submit" disabled={pending} className={buttonClass("outline", "sm", "mt-3")}>
        {pending ? (
          <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Camera aria-hidden="true" className="h-3.5 w-3.5" />
        )}
        {pending ? "Enviando…" : `Enviar ${label.toLowerCase()}`}
      </button>

      {status ? (
        <p role="status" className={`mt-2 text-xs ${status.ok ? "text-ink-2" : "text-red-800"}`}>
          {status.ok ? <Check aria-hidden="true" className="mr-1 inline h-3 w-3" /> : null}
          {status.message}
        </p>
      ) : null}
    </form>
  );
}

function Feedback({ state }: { state: { ok: boolean; message?: string } }) {
  if (!state.message) return null;
  return state.ok ? (
    <p role="status" className="text-xs text-ink-2">
      <Check aria-hidden="true" className="mr-1 inline h-3 w-3" />
      {state.message}
    </p>
  ) : (
    <FormMessage>{state.message}</FormMessage>
  );
}

function SubmitRow({ pending, label }: { pending: boolean; label: string }) {
  return (
    <button type="submit" disabled={pending} className={buttonClass("primary", "md")}>
      {pending ? "Salvando…" : label}
    </button>
  );
}
