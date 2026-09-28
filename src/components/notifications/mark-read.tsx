"use client";

import { useEffect } from "react";
import { markAllNotificationsReadAction } from "@/app/actions/notifications";

/**
 * Marca as notificações desta página como lidas assim que monta.
 *
 * O efeito não toca em estado: dispara a Action uma vez, o servidor marca e a
 * revalidação refaz a página e o contador. Re-montar dispara a Action de novo,
 * mas `read: false` já foi varrido, então o efeito colateral é idempotente.
 */
export function MarkReadOnView() {
  useEffect(() => {
    void markAllNotificationsReadAction();
  }, []);

  return null;
}
