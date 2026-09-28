import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, run } from "./db/database";
import { extractHashtags } from "@/lib/text/content";

/**
 * Paridade de hashtag.
 *
 * O Postgres e o TypeScript trazem a mesma expressão regular em duas
 * linguagens; o teste garante que nunca divirjam. Cobre acentos, sufixos de
 * palavra, repetição, texto vazio e o caractere de bloqueio, que são os casos de
 * contorno que uma implementação só de regex costuma errar.
 */

const CORPUS = [
  "olá #Várzea e #abc, #abc #x1_y fim#nao #ação #a#b",
  "sem hashtag nenhuma",
  "#sozinho",
  "texto #meio fim",
  "abc#def",
  "a#1b#2c",
  "traço-fim#nao",
  "http://exemplo.com/#page #real",
  "#underline_ok e #_init e #final_",
  "#ä #æ #œ #ß #ç",
  "#greek_α #greek_β",
  "#cyrillic_я #cyrillic_Ж",
  "",
  "  #espaço  ",
  "hashtag com #espaço marcado",
  "#",
  "##duplo",
  "#abc#def",
  "#" + "a".repeat(50) + " e #" + "a".repeat(51),
  "número #2026 épico",
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

describe("paridade de hashtags com extract_hashtags do Postgres", () => {
  it.each(CORPUS.map((value) => [value]))("extrai %j igual nos dois lados", async (text: string) => {
    const ts = extractHashtags(text);
    const [row] = await run<{ tags: string[] }>(DB.db, "select public.extract_hashtags($1) as tags", [text]);

    expect(ts).toEqual(row.tags);
  });
});