"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

/** Item de navegação. O estado ativo vem do caminho, não de estado local. */
export function NavItem({
  href,
  label,
  icon,
  badge,
  exact = false,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
  exact?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 border-l-2 py-2.5 pl-3 text-sm transition-colors",
        active
          ? "border-accent text-ink"
          : "border-transparent text-ink-2 hover:bg-sunken hover:text-ink",
      )}
    >
      <span aria-hidden="true" className="shrink-0 [&>svg]:h-[18px] [&>svg]:w-[18px]">
        {icon}
      </span>
      <span className="flex-1">{label}</span>
      {badge ? <UnreadBadge value={badge} /> : null}
    </Link>
  );
}

export function UnreadBadge({ value }: { value: number }) {
  if (value < 1) return null;
  return (
    <span className="min-w-5 bg-accent px-1.5 py-0.5 text-center font-mono text-[10px] leading-none text-bg tabular-nums">
      {value > 99 ? "99+" : value}
      <span className="sr-only"> notificações não lidas</span>
    </span>
  );
}
