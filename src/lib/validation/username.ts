/**
 * Formato do @handle.
 *
 * O banco define a regra uma única vez, no domínio `public.username_t`
 * (supabase/migrations/20260928000100_init_schema.sql). Estas funções são o
 * espelho em TypeScript, e `tests/username-parity.test.ts` executa um corpus
 * pelos dois lados para garantir que nunca divirjam.
 */

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;

/** Letras minúsculas, dígitos, ponto e sublinhado. Sem acentos, sem hífen. */
export const USERNAME_PATTERN = /^[a-z0-9._]+$/;

export type UsernameProblem =
  | "vazio"
  | "curto"
  | "longo"
  | "caracteres"
  | "ponto-inicial"
  | "ponto-final"
  | "ponto-duplo";

export function checkUsername(value: string): UsernameProblem | null {
  if (value.length === 0) return "vazio";
  if (value.length < USERNAME_MIN) return "curto";
  if (value.length > USERNAME_MAX) return "longo";
  if (!USERNAME_PATTERN.test(value)) return "caracteres";
  if (value.startsWith(".")) return "ponto-inicial";
  if (value.endsWith(".")) return "ponto-final";
  if (value.includes("..")) return "ponto-duplo";
  return null;
}

export const usernameProblems: Record<UsernameProblem, string> = {
  vazio: "Escolha um @.",
  curto: `Use ao menos ${USERNAME_MIN} caracteres.`,
  longo: `Use no máximo ${USERNAME_MAX} caracteres.`,
  caracteres: "Use apenas letras minúsculas, números, ponto e sublinhado.",
  "ponto-inicial": "O @ não pode começar com ponto.",
  "ponto-final": "O @ não pode terminar com ponto.",
  "ponto-duplo": "Não use dois pontos seguidos.",
};

export function isValidUsername(value: string): boolean {
  return checkUsername(value) === null;
}

/** Normaliza entrada do usuário: minúsculas, sem @, sem espaços nas bordas. */
export function normalizeUsername(value: string): string {
  return value
    .trim()
    .replace(/^@+/, "")
    .toLowerCase()
    .replace(/\s+/g, "");
}
