import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, run, seedFixtures, type TestDatabase } from "./db/database";
import { FIXTURES } from "./db/database";

/**
 * Conversas ocultas: o caminho de volta.
 *
 * "Some da minha caixa" não tinha volta — a conversa saía de `dm_inbox` e não
 * existia função nenhuma que a trouxesse de volta. Estes testes travam o
 * complemento entre as duas listas, que é a parte que dá errado fácil:
 *
 *   - `dm_inbox` entra com `not p.hidden` sobre as identidades do usuário;
 *   - `dm_hidden` entra com o oposto — ao menos uma linha oculta e NENHUMA
 *     visível.
 *
 * A distinção importa porque o Mestre tem vários personagens na mesma conversa e
 * `dm_start_direct` reexibe só a linha de quem pediu. Uma conversa pode estar
 * visível por uma identidade e oculta por outra; se `dm_hidden` não excluisse
 * esse caso, a mesma conversa apareceria nas duas listas ao mesmo tempo.
 *
 * O banco é o Postgres de verdade (PGlite) com as migrations aplicadas, então o
 * que está travado aqui é o SQL que roda em produção.
 */

const DB: { db: TestDatabase } = { db: null as never };
let fx: Awaited<ReturnType<typeof seedFixtures>>;

beforeAll(async () => {
  const db = await createTestDatabase();
  await db.applyMigrations();
  fx = await seedFixtures(db);
  DB.db = db;
});

afterAll(async () => {
  if (DB.db) await DB.db.close();
});

/** Cria uma identidade do Mestre com personagem próprio (ele já tem o NPC). */
async function gmOwnCharacter(username: string, name: string): Promise<string> {
  await DB.db.exec("reset role");
  const [row] = await run<{ id: string }>(
    DB.db,
    `insert into public.characters (owner_id, name, username)
     values ($1, $2, $3) returning id`,
    [FIXTURES.gm, name, username],
  );
  const [actor] = await run<{ id: string }>(DB.db, "select id from public.actors where character_id = $1", [
    row.id,
  ]);
  return actor.id;
}

/** Ids que uma das listas devolve, na ordem em que o banco devolveu. */
async function idsOf(fn: "dm_inbox" | "dm_hidden", limit?: number): Promise<string[]> {
  const rows =
    fn === "dm_inbox"
      ? await run<{ id: string }>(DB.db, "select id from public.dm_inbox($1)", [limit ?? 50])
      : await run<{ id: string }>(DB.db, "select id from public.dm_hidden($1)", [limit ?? 50]);
  return rows.map((row) => row.id);
}

type Participant = {
  id: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
  banner_url: string | null;
  avatar_position_x: number;
  avatar_position_y: number;
  banner_position_y: number;
  entity_type: string;
  character: { id: string; is_npc: boolean } | null;
  organization: { id: string; type: string } | null;
};

async function hiddenRows(conversationId: string): Promise<{ actor_id: string; hidden: boolean }[]> {
  return run<{ actor_id: string; hidden: boolean }>(
    DB.db,
    "select actor_id, hidden from public.dm_participants where conversation_id = $1 order by actor_id",
    [conversationId],
  );
}

describe("ocultar e reexibir conversa", () => {
  it("esconder tira da caixa e reexibir traz de volta, com prévia e não lidas", async () => {
    // João abre conversa com o NPC do Mestre e recebe uma mensagem.
    await DB.db.asUser(FIXTURES.joao);
    const [convo] = await run<{ id: string }>(
      DB.db,
      "select public.dm_start_direct($1, $2) as id",
      [fx.arthurActor, fx.helenaActor],
    );
    expect(convo.id).toBeTruthy();

    await DB.db.asUser(FIXTURES.gm);
    await run(
      DB.db,
      `insert into public.dm_messages (conversation_id, actor_id, content, created_at)
       values ($1, $2, 'Primeira mensagem', now() - interval '1 hour')`,
      [convo.id, fx.helenaActor],
    );
    // João lê o que já existia; a mensagem seguinte é a única não lida. O cursor
    // de leitura marca até um ponto da conversa, então a leitura precisa dizer
    // onde parou.
    await DB.db.asUser(FIXTURES.joao);
    await run(
      DB.db,
      `select public.dm_mark_read(
         $1,
         (select max(created_at) from public.dm_messages where conversation_id = $1),
         (select id from public.dm_messages where conversation_id = $1
           order by created_at desc, id desc limit 1))`,
      [convo.id],
    );
    await DB.db.asUser(FIXTURES.gm);
    await run(
      DB.db,
      `insert into public.dm_messages (conversation_id, actor_id, content, created_at)
       values ($1, $2, 'Nova depois de lida', now() + interval '1 second')`,
      [convo.id, fx.helenaActor],
    );

    await DB.db.asUser(FIXTURES.joao);
    expect(await idsOf("dm_inbox")).toContain(convo.id);
    expect(await idsOf("dm_hidden")).not.toContain(convo.id);

    await run(DB.db, "select public.dm_hide($1)", [convo.id]);

    expect(await idsOf("dm_inbox")).not.toContain(convo.id);
    expect(await idsOf("dm_hidden")).toEqual([convo.id]);

    // A linha de ocultada carrega o mesmo contexto da linha da caixa, senão a
    // pessoa não reconhece qual conversa está devolvendo.
    const [row] = await run<{ preview: string; unread: string; participants: unknown }>(
      DB.db,
      "select preview, unread, participants from public.dm_hidden(50) where id = $1",
      [convo.id],
    );
    expect(row.preview).toBe("Nova depois de lida");
    expect(Number(row.unread)).toBe(1);
    expect(row.participants).toHaveLength(2);

    await run(DB.db, "select public.dm_unhide($1)", [convo.id]);

    expect(await idsOf("dm_inbox")).toContain(convo.id);
    expect(await idsOf("dm_hidden")).not.toContain(convo.id);
    // O selo de não lidas da navegação volta a contar junto.
    const [count] = await run<{ unread: string }>(
      DB.db,
      "select unread from public.dm_unread_counts() where conversation_id = $1",
      [convo.id],
    );
    expect(Number(count.unread)).toBe(1);
  });

  it("esconder é por conta própria: a linha do outro participante não muda", async () => {
    await DB.db.asUser(FIXTURES.joao);
    const [convo] = await run<{ id: string }>(
      DB.db,
      "select public.dm_start_direct($1, $2) as id",
      [fx.arthurActor, fx.helenaActor],
    );
    await run(DB.db, "select public.dm_hide($1)", [convo.id]);

    const rows = await hiddenRows(convo.id);
    const byActor = new Map(rows.map((row) => [row.actor_id, row.hidden]));

    expect(byActor.get(fx.arthurActor)).toBe(true);
    expect(byActor.get(fx.helenaActor)).toBe(false);

    // O Mestre continua vendo a conversa na caixa dele.
    await DB.db.asUser(FIXTURES.gm);
    expect(await idsOf("dm_inbox")).toContain(convo.id);
    expect(await idsOf("dm_hidden")).not.toContain(convo.id);
  });

  it("quem não participa não vê a oculta alheia nem reexibe conversa de outro", async () => {
    await DB.db.asUser(FIXTURES.joao);
    const [convo] = await run<{ id: string }>(
      DB.db,
      "select public.dm_start_direct($1, $2) as id",
      [fx.arthurActor, fx.helenaActor],
    );
    await run(DB.db, "select public.dm_hide($1)", [convo.id]);

    await DB.db.asUser(FIXTURES.maria);
    expect(await idsOf("dm_hidden")).not.toContain(convo.id);

    // Reexibir conversa alheia não toca em nada: a chamada é silenciosa, como
    // `dm_hide` com alvo desconhecido.
    await run(DB.db, "select public.dm_unhide($1)", [convo.id]);

    await DB.db.asUser(FIXTURES.joao);
    expect(await idsOf("dm_hidden")).toContain(convo.id);
  });

  it("conversa visível por uma identidade não é lista como oculta", async () => {
    // Grupo com duas identidades do Mestre (personagem próprio + NPC) e o João.
    const gmOwn = await gmOwnCharacter("mestreproprio", "Mestre");
    await DB.db.asUser(FIXTURES.gm);
    const [group] = await run<{ id: string }>(
      DB.db,
      "select public.dm_create_group($1, 'Mesa de teste', $2) as id",
      [gmOwn, [fx.helenaActor, fx.arthurActor]],
    );

    await run(DB.db, "select public.dm_hide($1)", [group.id]);
    // `dm_hide` esconde para todas as identidades do usuário, por desenho.
    const allHidden = (await hiddenRows(group.id)).filter((row) => row.hidden);
    expect(allHidden).toHaveLength(2);
    expect(await idsOf("dm_hidden")).toContain(group.id);
    expect(await idsOf("dm_inbox")).not.toContain(group.id);

    // O estado parcial que `dm_start_direct` produz ao reexibir: só a linha de
    // quem pediu volta. Preparado direto no banco porque não há RPC que faça
    // isso linha a linha.
    await DB.db.exec("reset role");
    await run(
      DB.db,
      "update public.dm_participants set hidden = false where conversation_id = $1 and actor_id = $2",
      [group.id, fx.helenaActor],
    );

    await DB.db.asUser(FIXTURES.gm);
    expect(await idsOf("dm_inbox")).toContain(group.id);
    expect(await idsOf("dm_hidden")).not.toContain(group.id);
  });

  it("não devolve nada para quem não tem conversa oculta, nem para o anônimo", async () => {
    const own = await gmOwnCharacter("semoculta", "Sem oculta");
    await DB.db.asUser(FIXTURES.gm);
    await run(DB.db, "select public.dm_start_direct($1, $2)", [own, fx.arthurActor]);

    // Só conversa visível: a lista de ocultas fica vazia e a seção some da tela.
    expect(await idsOf("dm_inbox")).toContain(
      (await run<{ id: string }>(DB.db, "select id from public.dm_inbox(50) order by last_message_at desc limit 1"))[0].id,
    );
    expect(await idsOf("dm_hidden")).toEqual([]);

    // Anônimo não tem identidade nenhuma, então não vê oculta de ninguém.
    await DB.db.asUser(null, "anon");
    expect(await idsOf("dm_hidden")).toEqual([]);
  });

  it("a lista de ocultas devolve o mesmo objeto de participantes que a caixa", async () => {
    await DB.db.asUser(FIXTURES.joao);
    const [convo] = await run<{ id: string }>(
      DB.db,
      "select public.dm_start_direct($1, $2) as id",
      [fx.arthurActor, fx.institutoActor],
    );

    // O objeto é conferido antes de esconder, e de novo depois: é a extração da
    // função compartilhada que não pode mudar o formato, porque é o `toCard` da
    // tela que consome os dois.
    const [before] = await run<{ participants: Participant[] }>(
      DB.db,
      "select participants from public.dm_inbox(50) where id = $1",
      [convo.id],
    );
    expect(before.participants.map((p) => p.display_name).sort()).toEqual([
      "Arthur Valença",
      "Instituto Central",
    ]);
    const person = before.participants.find((p) => p.entity_type === "character");
    const org = before.participants.find((p) => p.entity_type === "organization");

    // Personagem e organização continuam se distinguindo no objeto: é o que a
    // tela usa para escolher entre foto e emblema.
    expect(person).toMatchObject({ character: { is_npc: false }, organization: null });
    expect(org).toMatchObject({ character: null, organization: { type: "institution" } });
    expect(Object.keys(before.participants[0]).sort()).toEqual([
      "avatar_position_x",
      "avatar_position_y",
      "avatar_url",
      "banner_position_y",
      "banner_url",
      "character",
      "display_name",
      "entity_type",
      "id",
      "organization",
      "username",
    ]);

    await run(DB.db, "select public.dm_hide($1)", [convo.id]);

    const [after] = await run<{ participants: Participant[] }>(
      DB.db,
      "select participants from public.dm_hidden(50) where id = $1",
      [convo.id],
    );
    expect(after.participants).toEqual(before.participants);
  });

  it("dm_conversation_participants é inacessível fora das duas listas", async () => {
    // A função é detalhe de como `dm_inbox` e `dm_hidden` montam a linha. O
    // execute revogado corta a chamada; a trava `is_dm_participant` cortaria a
    // leitura mesmo sem o revoke. Qualquer uma das duas camadas impede o
    // vazamento, e as duas juntas existem.
    await DB.db.asUser(FIXTURES.maria);
    const denied = await DB.db
      .query("select public.dm_conversation_participants(gen_random_uuid()) as p")
      .then(() => null)
      .catch((error: Error) => error.message);
    expect(denied).toBeTruthy();
  });
});
