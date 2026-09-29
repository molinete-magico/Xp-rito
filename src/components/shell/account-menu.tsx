"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Settings, Shield, User } from "lucide-react";
import { signOutAction } from "@/app/actions/auth";
import { Menu, MenuItem, MenuSeparator } from "@/components/ui/menu";

/**
 * Ações da conta na coluna lateral (desktop).
 *
 * Só o que é da conta: perfil, configurações, painel e sair. A troca de
 * personagem fica no cabeçalho do celular, onde o avatar é o próprio botão.
 */
export function AccountMenu({
  isGm,
  username,
}: {
  isGm: boolean;
  username: string | null;
}) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [, waitTransition] = useTransition();

  function go(href: string, close: () => void) {
    close();
    router.push(href);
  }

  return (
    <Menu
      label="Conta"
      align="start"
      className="w-[220px]"
      trigger={(props) => (
        <button
          {...props}
          type="button"
          className="flex w-full items-center gap-3 rounded-xs px-3 py-2 text-left text-ink-3 transition-colors hover:bg-sunken hover:text-ink"
        >
          <span aria-hidden="true" className="[&>svg]:h-5 [&>svg]:w-5">
            <Settings />
          </span>
          Conta
        </button>
      )}
    >
      {(close) => (
        <>
          {username ? (
            <MenuItem onSelect={() => go(`/profile/${username}`, close)}>
              <User aria-hidden="true" className="h-4 w-4" />
              Ver perfil
            </MenuItem>
          ) : null}
          <MenuItem onSelect={() => go("/settings", close)}>
            <Settings aria-hidden="true" className="h-4 w-4" />
            Configurações
          </MenuItem>
          {isGm ? (
            <MenuItem onSelect={() => go("/admin", close)}>
              <Shield aria-hidden="true" className="h-4 w-4" />
              Painel do Mestre
            </MenuItem>
          ) : null}
          <MenuSeparator />
          <MenuItem
            destructive
            onSelect={() => {
              close();
              if (signingOut) return;
              setSigningOut(true);
              waitTransition(async () => {
                await signOutAction();
                router.refresh();
              });
            }}
          >
            <LogOut aria-hidden="true" className="h-4 w-4" />
            Sair
          </MenuItem>
        </>
      )}
    </Menu>
  );
}
