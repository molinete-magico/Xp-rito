"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * Campos de formulário.
 *
 * Rótulo sempre visível (não placeholder), erro ligado por `aria-describedby`
 * e `aria-invalid`, texto de apoio opcional. Sem biblioteca de formulário: são
 * quatro elementos e a validação já vive no Zod.
 */

const control =
  "w-full rounded-xs border border-line-2 bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus:border-ink focus:outline-none disabled:opacity-50";

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: (props: { id: string; "aria-invalid": boolean; "aria-describedby": string | undefined }) => React.ReactNode;
  className?: string;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="label block text-ink-2">
        {label}
      </label>
      {children({ id, "aria-invalid": Boolean(error), "aria-describedby": describedBy })}
      {hint ? (
        <p id={hintId} className="text-xs leading-relaxed text-ink-3">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function TextInput({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn(control, className)} {...props} />;
}

export function TextArea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea className={cn(control, "resize-none leading-relaxed", className)} {...props} />;
}

export function Select({ className, ...props }: React.ComponentProps<"select">) {
  return <select className={cn(control, "appearance-none pr-8", className)} {...props} />;
}

/** Caixa de seleção com rótulo. */
export function Checkbox({
  label,
  description,
  ...props
}: React.ComponentProps<"input"> & { label: string; description?: string }) {
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 h-4 w-4 shrink-0 rounded-xs border border-line-2 accent-[var(--accent)]"
        {...props}
      />
      <label htmlFor={id} className="text-sm">
        <span className="text-ink">{label}</span>
        {description ? <span className="mt-0.5 block text-xs text-ink-3">{description}</span> : null}
      </label>
    </div>
  );
}

export function FormMessage({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;
  return (
    <div
      className="flex items-start justify-between gap-3 border border-accent/40 bg-accent-soft px-3 py-2 text-sm text-accent-strong"
      role="alert"
    >
      <span>{children}</span>
      <button
        type="button"
        onClick={() => setVisible(false)}
        className="text-xs text-accent-strong underline underline-offset-2"
      >
        Fechar
      </button>
    </div>
  );
}
