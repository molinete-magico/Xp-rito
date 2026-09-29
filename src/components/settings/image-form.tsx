"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Camera, Check, Loader2, RotateCcw } from "lucide-react";
import { attachIdentityImageAction, setImageFocusAction } from "@/app/actions/profile";
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

/**
 * Foco de corte da imagem.
 *
 * Clique na prévia para dizer de onde a foto/capa deve "cortar": a foto guarda
 * x e y, a capa só o vertical (a faixa é larga). Salva na hora, com o mesmo
 * caminho de autorização do upload.
 */
export function PositionControl({
  actorId,
  kind,
  imageUrl,
  x,
  y,
}: {
  actorId: string;
  kind: "avatar" | "banner";
  imageUrl: string | null | undefined;
  /** Horizontal em %; ignorado no banner (sempre 50). */
  x?: number;
  /** Vertical em %. */
  y?: number;
}) {
  const router = useRouter();
  const previewRef = useRef<HTMLDivElement>(null);
  const [posX, setPosX] = useState(x ?? 50);
  const [posY, setPosY] = useState(y ?? 50);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!imageUrl) return null;

  const shownX = kind === "avatar" ? posX : 50;
  const label = kind === "avatar" ? "Foco da foto" : "Foco da capa";
  const hint =
    kind === "avatar"
      ? "Clique no ponto da imagem que deve aparecer no centro."
      : "Clique na altura que deve ficar visível.";

  async function persist(nx: number, ny: number) {
    setSaving(true);
    setError(null);
    const form = new FormData();
    form.set("actorId", actorId);
    form.set("kind", kind);
    form.set("x", String(kind === "avatar" ? nx : 50));
    form.set("y", String(ny));
    const outcome = await setImageFocusAction(form);
    setSaving(false);
    if (outcome.ok) {
      router.refresh();
    } else {
      setPosX(x ?? 50);
      setPosY(y ?? 50);
      setError(outcome.message ?? "Não foi possível salvar a posição.");
    }
  }

  function onClick(event: React.MouseEvent<HTMLDivElement>) {
    const rect = previewRef.current?.getBoundingClientRect();
    if (!rect) return;
    const nx = clampPercent(((event.clientX - rect.left) / rect.width) * 100);
    const ny = clampPercent(((event.clientY - rect.top) / rect.height) * 100);
    setPosX(nx);
    setPosY(ny);
    void persist(kind === "avatar" ? nx : 50, ny);
  }

  return (
    <div className="border border-line p-3">
      <p className="flex items-baseline justify-between gap-2">
        <span className="label text-ink-3">{label}</span>
        <button
          type="button"
          disabled={saving}
          onClick={() => {
            setPosX(50);
            setPosY(50);
            void persist(50, 50);
          }}
          className="inline-flex items-center gap-1 text-[11px] text-ink-3 transition-colors hover:text-ink disabled:opacity-50"
        >
          <RotateCcw aria-hidden="true" className="h-3 w-3" />
          Centralizar
        </button>
      </p>
      <p className="mt-0.5 text-xs text-ink-3">{hint}</p>

      <div
        ref={previewRef}
        role="button"
        tabIndex={0}
        aria-label={`${label}: ajuste onde a imagem corta`}
        onClick={onClick}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            const rect = previewRef.current?.getBoundingClientRect();
            if (!rect) return;
            const nx = kind === "avatar" ? 50 : 50;
            const ny = kind === "avatar" ? 50 : 50;
            setPosX(nx);
            setPosY(ny);
            void persist(nx, ny);
          }
        }}
        className="relative mt-2 cursor-crosshair overflow-hidden border border-line bg-sunken"
        style={{
          aspectRatio: kind === "avatar" ? "1 / 1" : "3 / 1",
          maxHeight: kind === "avatar" ? 160 : 120,
          width: "100%",
        }}
      >
        <Image
          src={imageUrl}
          alt=""
          fill
          sizes="(min-width: 1024px) 320px, 100vw"
          className="object-cover"
          style={{ objectPosition: `${shownX}% ${posY}%` }}
        />
        <span
          aria-hidden="true"
          className="absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_2px_rgba(0,0,0,0.4)]"
          style={{ left: `${shownX}%`, top: `${posY}%` }}
        />
        {saving ? (
          <Loader2 aria-hidden="true" className="absolute top-1.5 right-1.5 h-4 w-4 animate-spin text-white drop-shadow" />
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="mt-2 text-xs text-red-800">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

/** Foto e capa para uma identidade, com o ajuste de foco de cada uma. */
export function ImageRow({
  actorId,
  avatarUrl,
  bannerUrl,
  avatarX = 50,
  avatarY = 50,
  bannerY = 50,
}: {
  actorId: string;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  avatarX?: number;
  avatarY?: number;
  bannerY?: number;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <ImageForm
        label="Foto"
        hint="Até 5 MB. Você ajusta o corte ao lado."
        bucket={AVATARS_BUCKET}
        fields={{ actorId, kind: "avatar" }}
      />
      <ImageForm
        label="Capa"
        hint="Proporção larga, até 5 MB."
        bucket={BANNERS_BUCKET}
        fields={{ actorId, kind: "banner" }}
      />
      <PositionControl kind="avatar" actorId={actorId} imageUrl={avatarUrl} x={avatarX} y={avatarY} />
      <PositionControl kind="banner" actorId={actorId} imageUrl={bannerUrl} y={bannerY} />
    </div>
  );
}