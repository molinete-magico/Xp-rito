import { afterEach, describe, expect, it } from "vitest";
import { createTestDatabase, FIXTURES, run, seedFixtures, type TestDatabase } from "./db/database.js";

describe("mensagens diretas: cursor de leitura e criação idempotente", () => {
  let db: TestDatabase | null = null;

  afterEach(async () => {
    await db?.close();
    db = null;
  });

  it("não marca como lida uma mensagem que chegou depois do ponto observado", async () => {
    db = await createTestDatabase();
    await db.applyMigrations();
    const f = await seedFixtures(db);

    await db.asUser(FIXTURES.joao);
    const [conversation] = await run<{ id: string }>(
      db,
      "select public.dm_start_direct($1, $2) as id",
      [f.arthurActor, f.helenaActor],
    );

    const firstId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
    const secondId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2";
    // O instante observado é relativo ao relógio, e não fixo: o `last_read_at`
    // nasce em `now()`, na criação da conversa, e o cursor de leitura só anda
    // para frente. Com um horário no passado, `dm_mark_read` recusaria a
    // marcação como retrocesso e nada contaria como não lida — o teste passaria
    // a falhar sozinho conforme o dia.
    const observedAt = new Date(Date.now() + 60_000).toISOString();

    await db.asUser(FIXTURES.gm);
    await run(
      db,
      "insert into public.dm_messages (id, conversation_id, actor_id, content, created_at) values ($1, $2, $3, 'primeira', $4), ($5, $2, $3, 'segunda', $4)",
      [firstId, conversation.id, f.helenaActor, observedAt, secondId],
    );

    await db.asUser(FIXTURES.joao);
    await run(db, "select public.dm_mark_read($1, $2, $3)", [conversation.id, observedAt, firstId]);

    const [unread] = await run<{ unread: number }>(
      db,
      "select unread from public.dm_unread_counts() where conversation_id = $1",
      [conversation.id],
    );

    expect(Number(unread.unread)).toBe(1);
  });

  it("usa o id como desempate quando mensagens têm o mesmo created_at", async () => {
    db = await createTestDatabase();
    await db.applyMigrations();
    const f = await seedFixtures(db);

    await db.asUser(FIXTURES.joao);
    const [conversation] = await run<{ id: string }>(
      db,
      "select public.dm_start_direct($1, $2) as id",
      [f.arthurActor, f.helenaActor],
    );

    const firstId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1";
    const secondId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2";
    // Mesma razão do caso acima: o cursor de leitura nasce em `now()`.
    const observedAt = new Date(Date.now() + 60_000).toISOString();

    await db.asUser(FIXTURES.gm);
    await run(
      db,
      "insert into public.dm_messages (id, conversation_id, actor_id, content, created_at) values ($1, $2, $3, 'antes', $4), ($5, $2, $3, 'depois', $4)",
      [firstId, conversation.id, f.helenaActor, observedAt, secondId],
    );

    await db.asUser(FIXTURES.joao);
    await run(db, "select public.dm_mark_read($1, $2, $3)", [conversation.id, observedAt, firstId]);

    const [unread] = await run<{ unread: number }>(
      db,
      "select unread from public.dm_unread_counts() where conversation_id = $1",
      [conversation.id],
    );

    expect(Number(unread.unread)).toBe(1);
  });

  it("criar a mesma DM duas vezes retorna a mesma conversa e dois participantes", async () => {
    db = await createTestDatabase();
    await db.applyMigrations();
    const f = await seedFixtures(db);

    await db.asUser(FIXTURES.joao);
    const [first] = await run<{ id: string }>(
      db,
      "select public.dm_start_direct($1, $2) as id",
      [f.arthurActor, f.helenaActor],
    );
    const [second] = await run<{ id: string }>(
      db,
      "select public.dm_start_direct($1, $2) as id",
      [f.arthurActor, f.helenaActor],
    );

    const participants = await run<{ actor_id: string }>(
      db,
      "select actor_id from public.dm_participants where conversation_id = $1 order by actor_id",
      [first.id],
    );

    expect(second.id).toBe(first.id);
    expect(participants).toHaveLength(2);
  });
  it("mantém RLS de leitura e escrita por identidade", async () => {
    db = await createTestDatabase();
    await db.applyMigrations();
    const f = await seedFixtures(db);

    await db.asUser(FIXTURES.joao);
    const [conversation] = await run<{ id: string }>(
      db,
      "select public.dm_start_direct($1, $2) as id",
      [f.arthurActor, f.helenaActor],
    );

    const deniedSpeaker = await db.expectDenied(
      "insert into public.dm_messages (conversation_id, actor_id, content) values ('" +
        conversation.id +
        "', '" +
        f.helenaActor +
        "', 'não sou Helena')",
    );
    expect(deniedSpeaker).toMatch(/row-level security|violates row-level security/i);

    await db.asUser(FIXTURES.maria);
    const hidden = await run<{ id: string }>(
      db,
      "select id from public.dm_messages where conversation_id = $1",
      [conversation.id],
    );
    expect(hidden).toHaveLength(0);
  });

});