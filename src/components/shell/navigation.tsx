"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Compass, Home, Mail, Search, Settings, Shield, User } from "lucide-react";
import { NavItem, UnreadBadge } from "@/components/shell/nav-item";
import { useUnread } from "@/components/shell/unread-provider";
import { useDmUnread } from "@/components/shell/dm-unread-provider";
import { site } from "@/lib/site";
import { cn } from "@/lib/cn";
import type { ActorSummary } from "@/lib/types";

/** Coluna 1 do desktop: marca, navegação e menu da conta. */
export function SideNav({
  identities,
  activeActorId,
  isGm,
}: {
  identities: ActorSummary[];
  activeActorId: string | null;
  isGm: boolean;
}) {
  const unread = useUnread();
  const dmUnread = useDmUnread();
  const active = identities.find((actor) => actor.id === activeActorId) ?? identities[0] ?? null;
  const profileHref = active ? `/profile/${active.username}` : "#";

  return (
    <>
      <Link href="/home" className="mb-6 block px-3" aria-label={`${site.name}, ir para o início`}>
        <span className="font-display text-xl leading-none text-ink">{site.name}</span>
      </Link>

      <nav aria-label="Navegação principal" className="flex flex-col gap-0.5">
        <NavItem href="/home" label="Início" icon={<Home />} exact />
        <NavItem href="/explore" label="Explorar" icon={<Compass />} />
        <NavItem href="/search" label="Buscar" icon={<Search />} />
        <NavItem href="/notifications" label="Notificações" icon={<Bell />} badge={unread} />
        <NavItem
          href="/messages"
          label="Mensagens"
          icon={<Mail />}
          badge={dmUnread}
          badgeLabel="mensagens não lidas"
        />
        <NavItem href={profileHref} label="Perfil" icon={<User />} />
        <NavItem href="/settings" label="Configurações" icon={<Settings />} />
      </nav>

      {isGm ? (
        <div className="mt-auto border-t border-line pt-3">
          <NavItem href="/admin" label="Painel do Mestre" icon={<Shield />} />
        </div>
      ) : null}
    </>
  );
}

/** Barra inferior do celular. */
export function BottomNav({
  identities,
  activeActorId,
}: {
  identities: ActorSummary[];
  activeActorId: string | null;
}) {
  const unread = useUnread();
  const dmUnread = useDmUnread();
  const active = identities.find((actor) => actor.id === activeActorId) ?? identities[0] ?? null;

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface lg:hidden"
    >
      <BottomItem href="/home" label="Início" icon={<Home />} exact />
      <BottomItem href="/explore" label="Explorar" icon={<Compass />} />
      <BottomItem
        href="/messages"
        label="Mensagens"
        icon={<Mail />}
        badge={dmUnread}
        badgeLabel="mensagens não lidas"
      />
      <BottomItem href="/notifications" label="Notificações" icon={<Bell />} badge={unread} />
      <BottomItem
        href={active ? `/profile/${active.username}` : "/settings"}
        label="Perfil"
        icon={<User />}
      />
    </nav>
  );
}

function BottomItem({
  href,
  label,
  icon,
  exact = false,
  badge,
  badgeLabel,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  exact?: boolean;
  badge?: number;
  badgeLabel?: string;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] transition-colors",
        active ? "text-ink" : "text-ink-3",
      )}
    >
      <span aria-hidden="true" className="[&>svg]:h-5 [&>svg]:w-5">
        {icon}
      </span>
      {label}
      {active ? <span aria-hidden="true" className="absolute top-0 h-0.5 w-8 bg-accent" /> : null}
      {badge ? (
        <span className="absolute top-1.5 right-[20%]">
          <UnreadBadge value={badge} label={badgeLabel} />
        </span>
      ) : null}
    </Link>
  );
}
