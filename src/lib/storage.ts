/**
 * Identidade ativa.
 *
 * No servidor a identidade ativa é um cookie httpOnly (não visível ao cliente).
 * No navegador guardamos o mesmo valor em `localStorage` com a mesma chave: é o
 * espelho que alimenta o menu da conta, o avatar do topo e o compositor sem
 * depender de recarregar a página.
 */
export const ACTIVE_ACTOR_STORAGE_KEY = "vertice-identidade";

export function readActiveActor(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(ACTIVE_ACTOR_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function writeActiveActor(actorId: string): void {
  try {
    window.localStorage.setItem(ACTIVE_ACTOR_STORAGE_KEY, actorId);
  } catch {
    // Sem storage (modo privado) a identidade ativa só vale para a sessão atual.
  }
}