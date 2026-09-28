import { createClient } from "@/lib/supabase/client";

/**
 * Mídia no Supabase Storage.
 *
 * Nada de blob no Postgres: o banco guarda só o caminho. O upload vai direto do
 * navegador para o Storage, e quem pode escrever em cada pasta é decidido pelas
 * políticas do bucket. O primeiro segmento do caminho é o actor (avatar/banner)
 * ou o post (mídia de publicação), e a política verifica a posse no Postgres.
 *
 * Limite de tipo e tamanho é aplicado duas vezes: aqui, para dar retorno
 * imediato, e no bucket, que é quem realmente recusa.
 */

export const AVATARS_BUCKET = "avatars";
export const BANNERS_BUCKET = "banners";
export const POST_MEDIA_BUCKET = "post-media";

export const ACCEPTED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export type AcceptedMimeType = (typeof ACCEPTED_MIME_TYPES)[number];

export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
export const MAX_POST_MEDIA_BYTES = 8 * 1024 * 1024;
export const MAX_MEDIA_PER_POST = 4;

export function publicUrl(bucket: string, path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return "";
  return `${base}/storage/v1/object/public/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}`;
}

export type UploadResult =
  | { ok: true; storagePath: string; mediaType: AcceptedMimeType; width: number; height: number }
  | { ok: false; error: string };

/**
 * Valida, mede e envia uma imagem.
 *
 * O caminho é derivado do id do dono e de um valor aleatório, nunca do nome
 * original do arquivo, que traria extensão e caracteres controlados pelo usuário
 * para dentro da URL pública.
 */
export async function uploadImage(
  file: File,
  options: { bucket: string; ownerId: string; maxBytes: number },
): Promise<UploadResult> {
  if (!ACCEPTED_MIME_TYPES.includes(file.type as AcceptedMimeType)) {
    return { ok: false, error: "Use JPG, PNG, WEBP ou GIF." };
  }
  if (file.size > options.maxBytes) {
    const limit = Math.round(options.maxBytes / (1024 * 1024));
    return { ok: false, error: `A imagem passa de ${limit} MB.` };
  }
  if (file.size === 0) {
    return { ok: false, error: "Arquivo vazio." };
  }

  const dimensions = await readDimensions(file);
  const extension = extensionFor(file.type as AcceptedMimeType);
  const storagePath = `${options.ownerId}/${crypto.randomUUID()}.${extension}`;

  const supabase = createClient();
  const { error } = await supabase.storage
    .from(options.bucket)
    .upload(storagePath, file, { contentType: file.type, upsert: false });

  if (error) {
    return { ok: false, error: "Não foi possível enviar a imagem." };
  }

  return {
    ok: true,
    storagePath,
    mediaType: file.type as AcceptedMimeType,
    width: dimensions.width,
    height: dimensions.height,
  };
}

export async function removeObject(bucket: string, path: string): Promise<void> {
  const supabase = createClient();
  await supabase.storage.from(bucket).remove([path]);
}

/** Dimensões reais do arquivo: o layout reserva o espaço certo antes de carregar. */
export function readDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      // Sem dimensões o layout cai para a proporção padrão: a imagem aparece
      // assim mesmo, com menos proteção contra deslocamento raro.
      resolve({ width: 0, height: 0 });
    };

    image.src = url;
  });
}

function extensionFor(mime: AcceptedMimeType): string {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
  }
}
