import { cn } from "@/lib/cn";

/**
 * Avatar.
 *
 * Quadrado e com canto mínimo: identidades são tratadas como registros. Sem
 * imagem, as iniciais em mono sobre um tom estável derivado do @handle, de modo
 * que a mesma pessoa tenha sempre a mesma marca.
 */

const TONES = [
  { background: "#e6ddd0", ink: "#5b4a33" },
  { background: "#dde3dc", ink: "#3f5240" },
  { background: "#e0dde6", ink: "#4a4258" },
  { background: "#e8dcd6", ink: "#6b4433" },
  { background: "#d9e2e4", ink: "#33514f" },
  { background: "#e6e2d3", ink: "#57502f" },
] as const;

function toneFor(seed: string) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 100_000;
  }
  return TONES[hash % TONES.length];
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "?";
  const second = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + second).toUpperCase();
}

const sizes = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-[11px]",
  md: "h-10 w-10 text-xs",
  lg: "h-14 w-14 text-sm",
  xl: "h-24 w-24 text-2xl sm:h-28 sm:w-28",
} as const;

export type AvatarSize = keyof typeof sizes;

export function Avatar({
  name,
  username,
  src,
  size = "md",
  className,
  decorative = false,
}: {
  name: string;
  username: string;
  src?: string | null;
  size?: AvatarSize;
  className?: string;
  /** Avatar ao lado do nome: o nome já está no texto, então é decorativo. */
  decorative?: boolean;
}) {
  const tone = toneFor(username);
  const dimensions = size === "xs" ? 24 : size === "sm" ? 32 : size === "md" ? 40 : size === "lg" ? 56 : 96;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden border border-line font-mono font-medium leading-none",
        sizes[size],
        className,
      )}
      style={src ? undefined : { backgroundColor: tone.background, color: tone.ink }}
    >
      {src ? (
        // next/image em um host externo exigiria configurá-lo no next.config;
        // para avatares pequenos, a tag nativa com lazy é suficiente. O resto
        // do site usa next/image normalmente.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={decorative ? "" : `Foto de ${name}`}
          width={dimensions}
          height={dimensions}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
        />
      ) : (
        <span aria-hidden="true">{initialsOf(name)}</span>
      )}
      {src ? null : <span className="sr-only">Sem foto de {name}</span>}
    </span>
  );
}
