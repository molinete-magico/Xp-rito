import { createClient } from "@/lib/supabase/client";

/**
 * Mídia no Supabase Storage.
 *
 * Nada de blob no Postgres: o banco guarda só o caminho. O upload vai direto do
 * navegador para o Storage, e quem pode escrever em cada pasta é decidido pelas
 * políticas do bucket. O primeiro segmento do caminho é o actor (avatar/banner)
 * ou o post (mídia de publicação), e a política verifica a posse no Postgres.
 *
 * JPG/PNG/WEBP são reencodados para WebP aqui mesmo, no navegador, com uma
 * largura/altura máximas por uso: cabem mais imagens no banco e o tráfego cai.
 * GIF animado fica como está, porque o canvas não anima.
 */

export const AVATARS_BUCKET = "avatars";
export const BANNERS_BUCKET = "banners";
export const POST_MEDIA_BUCKET = "post-media";

export const ACCEPTED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export type AcceptedMimeType = (typeof ACCEPTED_MIME_TYPES)[number];

export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
export const MAX_POST_MEDIA_BYTES = 8 * 1024 * 1024;
export const MAX_MEDIA_PER_POST = 4;

/** Qualidade do WebP gerado: bom equilíbrio entre tamanho e nitidez. */
export const WEBP_QUALITY = 0.8;

/** Maior aresta permitida após compressão, por tipo de pasta. */
export const AVATAR_PREVIEW_EDGE = 512;
export const BANNER_PREVIEW_EDGE = 1600;
export const POST_MEDIA_PREVIEW_EDGE = 1920;

const PREVIEW_EDGE_BY_BUCKET: Record<string, number> = {
  [AVATARS_BUCKET]: AVATAR_PREVIEW_EDGE,
  [BANNERS_BUCKET]: BANNER_PREVIEW_EDGE,
  [POST_MEDIA_BUCKET]: POST_MEDIA_PREVIEW_EDGE,
};

export function publicUrl(bucket: string, path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return "";
  return `${base}/storage/v1/object/public/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}`;
}

export type UploadResult =
  | { ok: true; storagePath: string; mediaType: AcceptedMimeType; width: number; height: number }
  | { ok: false; error: string };

/**
 * Valida, comprime e envia uma imagem.
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

  const supabase = createClient();
  const ownerId = options.ownerId;
  const bucket = options.bucket;

  if (file.type === "image/gif") {
    return storeOriginal(supabase, file, bucket, ownerId, "gif");
  }

  const edge = PREVIEW_EDGE_BY_BUCKET[bucket];
  const converted = edge ? await encodeWebP(file, edge, WEBP_QUALITY) : null;

  if (converted && converted.blob.size <= options.maxBytes && converted.blob.size > 0) {
    return storeImage(supabase, converted.blob, bucket, ownerId, "webp", {
      mediaType: "image/webp",
      width: converted.width,
      height: converted.height,
    });
  }

  // Conversão falharia (arquivo estranho) ou não valeria a pena: sobe o original.
  return storeOriginal(supabase, file, bucket, ownerId, extensionFor(file.type as AcceptedMimeType));
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

/**
 * Reencoda uma imagem estática para WebP no navegador, reduzindo a maior aresta
 * para `maxEdge` (a imagem menor fica do tamanho dela). Retorna `null` se não
 * der para decodificar — nesse caso o arquivo original segue intacto.
 *
 * O navegador já aplica a orientação do EXIF ao desenhar, então fotos de celular
 * ficam em pé sozinhas.
 */
export function encodeWebP(
  file: File,
  maxEdge: number,
  quality = WEBP_QUALITY,
): Promise<{ blob: Blob; width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) {
        URL.revokeObjectURL(url);
        resolve(null);
        return;
      }
      context.drawImage(image, 0, 0, width, height);
      URL.revokeObjectURL(url);

      canvas.toBlob(
        (blob) => resolve(blob ? { blob, width, height } : null),
        "image/webp",
        quality,
      );
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };

    image.src = url;
  });
}

async function storeImage(
  supabase: ReturnType<typeof createClient>,
  data: Blob,
  bucket: string,
  ownerId: string,
  extension: string,
  meta: { mediaType: "image/webp"; width: number; height: number },
): Promise<UploadResult> {
  const storagePath = `${ownerId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage
    .from(bucket)
    .upload(storagePath, data, { contentType: meta.mediaType, upsert: false });

  if (error) {
    return { ok: false, error: "Não foi possível enviar a imagem." };
  }

  return { ok: true, storagePath, mediaType: meta.mediaType, width: meta.width, height: meta.height };
}

async function storeOriginal(
  supabase: ReturnType<typeof createClient>,
  file: File,
  bucket: string,
  ownerId: string,
  extension: string,
): Promise<UploadResult> {
  const dimensions = await readDimensions(file);
  const storagePath = `${ownerId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage
    .from(bucket)
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