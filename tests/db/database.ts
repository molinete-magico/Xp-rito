import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";

const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");
const BOOTSTRAP_PATH = path.join(process.cwd(), "tests", "db", "bootstrap.sql");

/**
 * O banco de teste é um PGlite comum: só usamos memória, então não há
 * filesystem para tipar. As migrations também não rodam em `nodefs`, o que
 * evita uma dependência de nativo só para testar.
 */
export type TestDatabase = PGlite & {
  /** Executa cada migration de supabase/migrations em ordem lexicográfica. */
  applyMigrations: () => Promise<void>;
  /** Troca a identidade autenticada e o papel assumido. */
  asUser: (userId: string | null, role?: "authenticated" | "anon") => Promise<void>;
  /** Executa uma query com uma expectativa de erro. Devolve a mensagem. */
  expectDenied: (sql: string) => Promise<string>;
  /**
   * Força o commit da transação corrente. Constraint triggers adiados só
   * reportam erro aqui: sem isto, um teste passa em silêncio e o erro aparece na
   * instrução seguinte, em outro lugar.
   */
  flush: () => Promise<void>;
}

/**
 * Atalho para os testes: `query` devolve `{ rows, fields, affectedRows }` e
 * quase todo teste quer só as linhas. Aqui a forma é `T[]` e o tipo da linha
 * é declarado no ponto de uso.
 */
export async function run<T = Record<string, unknown>>(
  db: TestDatabase,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const { rows } = await db.query<T>(sql, params as never[]);
  return rows;
}

export const FIXTURES = {
  gm: "11111111-1111-4111-8111-111111111111",
  joao: "22222222-2222-4222-8222-222222222222",
  maria: "33333333-3333-4333-8333-333333333333",
} as const;

/**
 * Sobe um Postgres efêmero com o bootstrap + todas as migrations aplicadas.
 * É o mesmo caminho de código usado pelos testes de paridade e de RLS, então uma
 * migration quebrada faz os testes falharem, que é o objetivo.
 */
export async function createTestDatabase(): Promise<TestDatabase> {
  const instance = await PGlite.create();
  const db = instance as unknown as TestDatabase;

  const applyMigrations = async () => {
    await db.exec(await readFile(BOOTSTRAP_PATH, "utf8"));

    const files = (await readdir(MIGRATIONS_DIR))
      .filter((file) => file.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const sql = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
      await db.exec(sql);
    }
  };

  const asUser = async (userId: string | null, role: "authenticated" | "anon" = "authenticated") => {
    await db.exec("reset role");
    if (userId === null) {
      // `{}` e não string vazia: o `auth.uid()` do bootstrap faz
      // `current_setting('request.jwt.claims')::jsonb`, e `''::jsonb` é erro de
      // sintaxe. É também o que o Supabase manda quando não há JWT.
      await db.exec("select set_config('request.jwt.claims', '{}', false)");
      await db.exec(`set role ${role}`);
      return;
    }
    await db.query("select set_config('request.jwt.claims', $1, false)", [
      JSON.stringify({ sub: userId, role }),
    ]);
    await db.exec(`set role ${role}`);
  };

  const expectDenied = async (sql: string) => {
    try {
      await db.query(sql);
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
    throw new Error(
      `Esperava que a operação fosse negada pelo RLS, mas ela foi permitida.\nSQL: ${sql}`,
    );
  };

  const flush = async () => {
    await db.query("select 1");
  };

  Object.assign(instance, { applyMigrations, asUser, expectDenied, flush });
  return db;
}

/**
 * Cria as contas de auth + profiles e um conjunto pequeno de identidades.
 * Devolve os ids para que os testes possam referenciar.
 */
export async function seedFixtures(db: TestDatabase) {
  await db.exec("reset role");

  const insertUser = async (id: string, email: string, username: string, displayName: string) => {
    await db.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)", [
      id,
      email,
      JSON.stringify({ username, display_name: displayName }),
    ]);
  };

  await insertUser(FIXTURES.gm, "mestre@vértice.test", "mestre", "Mestre da mesa");
  await insertUser(FIXTURES.joao, "joao@vértice.test", "joao", "João");
  await insertUser(FIXTURES.maria, "maria@vértice.test", "maria", "Maria");

  await db.query("update public.profiles set role = 'gm' where id = $1", [FIXTURES.gm]);

  const id = async (sql: string, values: unknown[]) => {
    const result = await db.query<{ id: string }>(sql, values as never[]);
    return result.rows[0].id;
  };

  const arthur = await id(
    `insert into public.characters (owner_id, name, username, bio)
     values ($1, 'Arthur Valença', 'arthurvalenca', 'Fotógrafo. Pergunta mais do que responde.')
     returning id`,
    [FIXTURES.joao],
  );

  const helena = await id(
    `insert into public.characters (owner_id, name, username, bio, is_npc)
     values (null, 'Helena Duarte', 'helenaduarte', 'Delegada. Fala pouco, observa tudo.', true)
     returning id`,
    [],
  );

  const instituto = await id(
    `insert into public.organizations (name, username, description, type)
     values ('Instituto Central', 'institutocentral', 'Serviços públicos de registro e protocolo.', 'institution')
     returning id`,
    [],
  );

  const actorOf = async (characterId: string) =>
    (await db.query<{ id: string }>("select id from public.actors where character_id = $1", [characterId]))
      .rows[0].id;

  const actorOfOrg = async (organizationId: string) =>
    (
      await db.query<{ id: string }>("select id from public.actors where organization_id = $1", [
        organizationId,
      ])
    ).rows[0].id;

  return {
    arthurActor: await actorOf(arthur),
    helenaActor: await actorOf(helena),
    institutoActor: await actorOfOrg(instituto),
    arthur,
    helena,
    instituto,
  };
}
