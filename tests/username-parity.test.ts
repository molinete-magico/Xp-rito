import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase } from "./db/database";
import { isValidUsername } from "@/lib/validation/username";

/**
 * Paridade do @handle.
 *
 * A única verdade é o domínio `public.username_t` no Postgres; o espelho em
 * TypeScript precisa decidir exatamente a mesma coisa. O corpus abaixo passa o
 * mesmo valor pelos dois lados: se divergirem, há bug de um dos lados.
 *
 * A casa do PG é um cast para o domínio, que executa as constraints; não
 * precisamos de tabela nem de dados.
 */

const CORPUS = [
  "arthur",
  "abc",
  "Mesomorphie",
  "MESOMORPHIE",
  "helena_duarte",
  "a.b.c",
  "x1_y",
  "a1",
  "ab",
  "",
  "Abc",
  "Àbc",
  "abc def",
  "@abc",
  ".abc",
  "abc.",
  "a..b",
  "a.b.",
  "a*",
  "a-b",
  "a@b",
  "a".repeat(30),
  "a".repeat(31),
  "ábc",
  "héloïse",
  "a.b_c.d",
  "_abc",
  "abc_",
  "a. b",
  "a\nb",
];

const DB: { db: Awaited<ReturnType<typeof createTestDatabase>> } = { db: null as never };

beforeAll(async () => {
  const db = await createTestDatabase();
  await db.applyMigrations();
  DB.db = db;
});

afterAll(async () => {
  if (DB.db) await DB.db.close();
});

describe("paridade de username com o domínio do banco", () => {
  it.each(CORPUS.map((value) => [value]))("decide %s igual nos dois lados", async (value: string) => {
    const ts = isValidUsername(value);

    let pg = true;
    try {
      await DB.db.query(`select cast($1 as public.username_t)`, [value]);
    } catch {
      pg = false;
    }

    expect(ts).toBe(pg);
  });
});