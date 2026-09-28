import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * Botões.
 *
 * Um só sistema: cantos vivos, sem sombra, sem gradiente. A hierarquia vem do
 * peso e do preenchimento, nunca do tamanho.
 */

type Variant = "primary" | "outline" | "quiet" | "danger";
type Size = "sm" | "md";

const base =
  "inline-flex items-center justify-center gap-2 rounded-xs font-medium transition-colors duration-100 disabled:cursor-not-allowed disabled:opacity-45";

const variants: Record<Variant, string> = {
  primary: "bg-ink text-bg hover:bg-ink-2 active:bg-ink-3",
  outline: "border border-line-2 text-ink hover:bg-sunken",
  quiet: "text-ink-2 hover:bg-sunken hover:text-ink",
  danger: "text-danger hover:bg-danger-soft hover:text-danger-strong",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-10 px-4 text-sm",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className,
  ...props
}: React.ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link href={href} className={buttonClass(variant, size, className)} {...props} />;
}
