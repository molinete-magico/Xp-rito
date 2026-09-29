import Image from "next/image";
import { publicUrl, POST_MEDIA_BUCKET } from "@/lib/media";
import type { PostMediaView } from "@/lib/types";
import { cn } from "@/lib/cn";

/**
 * Mídia da publicação.
 *
 * As dimensões vêm do banco (medidas no cliente antes do upload), então o espaço
 * é reservado e a página não salta quando a imagem carrega. O texto alternativo
 * é obrigatório na interface: imagem sem descrição não entra.
 */
export function PostMedia({
  media,
  className,
}: {
  media: PostMediaView[];
  className?: string;
}) {
  if (media.length === 0) return null;

  if (media.length === 1) {
    return (
      <div className={cn("mt-3", className)}>
        <MediaFigure item={media[0]} priority />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "mt-3 grid gap-px overflow-hidden border border-line bg-line",
        media.length === 2 ? "grid-cols-2" : "grid-cols-2 grid-rows-2",
        className,
      )}
    >
      {media.map((item, index) => (
        <MediaFigure
          key={item.id}
          item={item}
          priority={index === 0}
          className={cn("bg-surface", media.length === 3 && index === 0 && "row-span-2")}
          compact
        />
      ))}
    </div>
  );
}

function MediaFigure({
  item,
  priority,
  compact,
  className,
}: {
  item: PostMediaView;
  priority?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const src = publicUrl(POST_MEDIA_BUCKET, item.storage_path);
  const ratio =
    item.width !== null && item.height !== null && item.width > 0 && item.height > 0
      ? item.width / item.height
      : 4 / 3;

  return (
    <figure className={cn("relative overflow-hidden bg-surface", className)}>
      {compact ? (
        <Image
          src={src}
          alt={item.alt_text}
          fill
          sizes="(min-width: 1024px) 300px, 50vw"
          priority={priority}
          className="object-contain object-left"
        />
      ) : (
        <div className="relative h-auto max-h-[32rem] w-full overflow-hidden" style={{ aspectRatio: String(ratio) }}>
          <Image
            src={src}
            alt={item.alt_text}
            fill
            sizes="(min-width: 1024px) 600px, 100vw"
            priority={priority}
            className="object-contain"
          />
        </div>
      )}
    </figure>
  );
}
