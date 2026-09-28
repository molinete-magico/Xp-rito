import { describe, expect, it } from "vitest";
import { usernameField } from "@/lib/validation/schemas";

/**
 * Campo de @ no nível do formulário.
 *
 * A formatação aceita maiúsculas e o símbolo @ na digitação: quem digita
 * "Mesorphie" ou "@mesorphie" recebe por baixo o handle canônico em minúsculas.
 * A validação acontece depois da normalização; o que ferir o formato real
 * (acento, ponto no lugar errado) continua recusado.
 */

describe("usernameField aceita caixa alta e normaliza", () => {
  it.each(["Mesorphie", "MESORPHIE", "mEsOrPhIe", "@mesorphie", "@Mesorphie"])(
    "aceita %s e devolve minúsculas",
    (value) => {
      const parsed = usernameField.safeParse(value);
      expect(parsed.success).toBe(true);
      if (parsed.success) expect(parsed.data).toBe("mesorphie");
    },
  );

  it.each(["", "ab", "Àbc", "a..b", ".abc", "abc."])(
    "recusa formatos inválidos %s",
    (value) => {
      const parsed = usernameField.safeParse(value);
      expect(parsed.success).toBe(false);
    },
  );
});