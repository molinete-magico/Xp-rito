"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * Menu suspenso.
 *
 * Comportamento de menu de verdade: `Escape` fecha, setas navegam, clique fora
 * fecha e o foco volta para o gatilho. Sem biblioteca, porque o comportamento
 * padrão de um `role="menu"` cabe em algumas dezenas de linhas.
 */

export function Menu({
  trigger,
  label,
  children,
  align = "start",
  className,
}: {
  trigger: (props: {
    onClick: () => void;
    "aria-expanded": boolean;
    "aria-haspopup": "menu";
    "aria-controls"?: string;
    ref: React.Ref<HTMLButtonElement>;
  }) => React.ReactNode;
  label: string;
  children: (close: () => void) => React.ReactNode;
  align?: "start" | "end";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;

      const items = panelRef.current?.querySelectorAll<HTMLElement>("[role='menuitem']");
      if (!items || items.length === 0) return;
      event.preventDefault();

      const current = document.activeElement;
      const index = [...items].indexOf(current as HTMLElement);
      const next = event.key === "ArrowDown" ? index + 1 : index - 1;
      items[(next + items.length) % items.length]?.focus();
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className={cn("relative", className)}>
      {trigger({
        onClick: () => setOpen((value) => !value),
        "aria-expanded": open,
        "aria-haspopup": "menu",
        "aria-controls": open ? menuId : undefined,
        ref: triggerRef,
      })}
      {open ? (
        <div
          id={menuId}
          ref={panelRef}
          role="menu"
          aria-label={label}
          className={cn(
            "animate-rise absolute z-40 mt-1.5 min-w-56 border border-line bg-surface shadow-[0_8px_24px_-16px_rgba(0,0,0,0.45)]",
            align === "end" ? "right-0" : "left-0",
          )}
        >
          {children(() => setOpen(false))}
        </div>
      ) : null}
    </div>
  );
}

export function MenuItem({
  onSelect,
  children,
  active,
  destructive,
}: {
  onSelect: () => void;
  children: React.ReactNode;
  active?: boolean;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors",
        destructive ? "text-danger hover:bg-danger-soft hover:text-danger-strong" : "text-ink hover:bg-sunken",
        active && "bg-sunken",
      )}
    >
      {children}
    </button>
  );
}

export function MenuSeparator() {
  return <div className="my-1 h-px bg-line" role="separator" />;
}

export function MenuLabel({ children }: { children: React.ReactNode }) {
  return <p className="px-3 pt-2.5 pb-1.5 label">{children}</p>;
}
