"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { X } from "lucide-react";
import {
  MAX_MEDIA_PER_POST,
  MAX_POST_MEDIA_BYTES,
  POST_MEDIA_BUCKET,
  removeObject,
  uploadImage,
} from "@/lib/media";
import { cn } from "@/lib/cn";

/**
 * Anexos de mídia.
 *
 * O upload acontece antes da publicação, direto para o Storage, e o caminho vai
 * no formulário. Se a pessoa desistir, o objeto órfão é removido por aqui.
 *
 * A primeira imagem exige descrição: é o campo anunciado por leitores de tela e
 * que o banco gravaria vazio em `alt_text`.
 */
export type PendingMedia = {
  storagePath: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  width: number | null;
  height: number | null;
  altText: string;
  preview: string;
};

export function MediaUploader({
  ownerActorId,
  media,
  onChange,
  disabled,
}: {
  /** O primeiro segmento do caminho é o actor que publica, que é o que a
   *  política do bucket confere. Passar outra coisa faz o upload ser recusado. */
  ownerActorId: string;
  media: PendingMedia[];
  onChange: (next: PendingMedia[]) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const full = media.length >= MAX_MEDIA_PER_POST;

  async function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])];
    event.target.value = "";
    if (files.length === 0) return;

    setError(null);
    setBusy(true);

    const accepted: PendingMedia[] = [];

    for (const file of files.slice(0, MAX_MEDIA_PER_POST - media.length)) {
      const result = await uploadImage(file, {
        bucket: POST_MEDIA_BUCKET,
        ownerId: ownerActorId,
        maxBytes: MAX_POST_MEDIA_BYTES,
      });

      if (!result.ok) {
        setError(result.error);
        continue;
      }

      accepted.push({
        storagePath: result.storagePath,
        mediaType: result.mediaType,
        width: result.width || null,
        height: result.height || null,
        altText: "",
        preview: URL.createObjectURL(file),
      });
    }

    if (accepted.length > 0) onChange([...media, ...accepted]);
    setBusy(false);
  }

  function removeAt(index: number) {
    const item = media[index];
    URL.revokeObjectURL(item.preview);
    void removeObject(POST_MEDIA_BUCKET, item.storagePath);
    onChange(media.filter((_, position) => position !== index));
  }

  function setAltAt(index: number, altText: string) {
    onChange(media.map((item, position) => (position === index ? { ...item, altText } : item)));
  }

  return (
    <div className="mt-3 space-y-3">
      {media.length > 0 ? (
        <ul className={cn("grid gap-2", media.length === 1 ? "grid-cols-1" : "grid-cols-2")}>
          {media.map((item, index) => (
            <li key={item.storagePath} className="border border-line">
              <div className="relative">
                <Image
                  src={item.preview}
                  alt=""
                  width={320}
                  height={200}
                  className="h-40 w-full bg-sunken object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeAt(index)}
                  aria-label="Remover imagem"
                  className="absolute top-1.5 right-1.5 flex h-7 w-7 items-center justify-center bg-ink/85 text-bg"
                >
                  <X aria-hidden="true" className="h-4 w-4" />
                </button>
              </div>
              <input
                type="text"
                value={item.altText}
                onChange={(event) => setAltAt(index, event.target.value)}
                maxLength={300}
                required={index === 0}
                placeholder="Descreva a imagem"
                aria-label={`Descrição da imagem ${index + 1}`}
                className="w-full border-t border-line bg-surface px-2 py-1.5 text-xs text-ink placeholder:text-ink-3 focus:outline-none"
              />
            </li>
          ))}
        </ul>
      ) : null}

      {!full ? (
        <div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={disabled || busy}
            className="label inline-flex items-center gap-2 rounded-xs border border-dashed border-line-2 px-3 py-2 text-ink-2 transition-colors hover:bg-sunken hover:text-ink disabled:opacity-50"
          >
            {busy ? "Enviando…" : "Anexar imagem"}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            onChange={onPick}
            className="sr-only"
            tabIndex={-1}
          />
          <p className="mt-1.5 text-[11px] text-ink-3">
            Até {MAX_MEDIA_PER_POST} imagens, {MEDIA_SIZE_TEXT} cada. Fotos e PNG viram WebP
            no envio; GIF animado segue como está. A primeira precisa de descrição.
          </p>
        </div>
      ) : (
        <p className="text-[11px] text-ink-3">Limite de {MAX_MEDIA_PER_POST} imagens atingido.</p>
      )}

      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const MEDIA_SIZE_TEXT = `${Math.round(MAX_POST_MEDIA_BYTES / (1024 * 1024))} MB`;
