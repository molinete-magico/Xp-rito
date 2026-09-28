/**
 * Datas em pt-BR, com duas camadas: uma legível ("há 3 h") para a lista e uma
 * exata (title/`dateTime`) para quem quer o valor preciso.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

const relative = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto", style: "narrow" });
const absoluteDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
const absoluteFull = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function relativeTime(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";

  const delta = then - now;
  const magnitude = Math.abs(delta);

  if (magnitude < MINUTE) return "agora";
  if (magnitude < HOUR) return relative.format(Math.round(delta / MINUTE), "minute");
  if (magnitude < DAY) return relative.format(Math.round(delta / HOUR), "hour");
  if (magnitude < WEEK) return relative.format(Math.round(delta / DAY), "day");
  return absoluteDate.format(new Date(iso));
}

export function fullTimestamp(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : absoluteFull.format(date);
}

/** Contadores compactos para curtidas e seguidores: 1,2 mil. */
export function compactNumber(value: number): string {
  return new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}
