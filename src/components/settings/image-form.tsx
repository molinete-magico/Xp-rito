"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Check, Loader2 } from "lucide-react";
import { attachIdentityImageAction } from "@/app/actions/profile";
import { buttonClass } from "@/components/ui/button";
import { AVATARS_BUCKET, BANNERS_BUCKET, MAX_AVATAR_BYTES, uploadImage } from "@/lib/media";

/**
 * Upload de foto/capa de identidade.
 *
 * O arquivo vai direto do navegador para o Storage: a sessão autenticada está
 * no fetch e a política do bucket compara o primeiro segmento do caminho com o
 * actor. Só depois disso a Action grava a URL pública na entidade, e o trigger
 * espelha a imagem no actor. Se o upload falhar, o servidor nem é tocado.
 *
 * Compartilhado entre Configurações e o Painel do Mestre: quem pode administrar
 * o actor (dono ou Mestre) tem os mesmos campos de imagem.
 */
export function ImageForm({
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

/** Foto e capa lado a lado para uma identidade. */
export function ImageRow({ actorId }: { actorId: string }) {
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