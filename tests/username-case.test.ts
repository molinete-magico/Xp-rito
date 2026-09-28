import { describe, expect, it } from "vitest";
import { usernameField } from "@/lib/validation/schemas";

/**
 * Campo de @ no nível do formulário.
 *
 * A caixa é livre e preservada: quem digita "Mesomorphie" mantém "Mesomorphie",
 * e "Mesomorphie" e "mesomorphie" são a mesma conta — a unicidade frente à caixa
 * é dever do banco (índice em lower(username)), não daqui. A validação continua
 * recusando o que fira o formato real (acento, ponto no lugar errado).
 */

describe("usernameField preserva a caixa digitada", () => {
  it.each([
    ["Mesomorphie", "Mesomorphie"],
    ["MESOMORPHIE", "MESOMORPHIE"],
    ["mesomorphie", "mesomorphie"],
    ["mEsOmOrPhIe", "mEsOmOrPhIe"],
    ["@Mesomorphie", "Mesomorphie"],
    ["File.first", "File.first"],
  ])("aceita %s e conserva a forma", (value, expected) => {
    const parsed = usernameField.safeParse(value);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data).toBe(expected);
  });

  it.each(["", "ab", "Àbc", "a..b", ".abc", "abc.", "a-b"])(
    "recusa formatos inválidos %s",
    (value) => {
      const parsed = usernameField.safeParse(value);
      expect(parsed.success).toBe(false);
    },
  );
});