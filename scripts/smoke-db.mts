import {
  createTestDatabase,
  run,
  seedFixtures,
  FIXTURES,
  type TestDatabase,
} from "../tests/db/database.js";

/**
 * Smoke do banco: aplica as migrations num Postgres efêmero e confere os
 * invariantes de que a interface depende.
 *
 * Nota sobre RLS: uma política de UPDATE que não casa filtra a linha em
 * silêncio, e o comando "passa" com 0 linhas afetadas. Erro de política só
 * aparece no `with check` de INSERT/UPDATE. Por isso os testes checam o estado
 * da linha depois da tentativa, em vez de confiar no código de saída.
 *
 * Constraint trigger adiado: o erro só aparece no COMMIT. Por isso o `flush()`
 * depois de cada INSERT que pode falhar.
 */

type Check = { check: string; ok: boolean; detail: string };
const results: Check[] = [];

function check(label: string, ok: boolean, detail = "") {
  results.push({ check: label, ok, detail });
}

/** Executa algo e devolve a mensagem do primeiro erro, ou `null` se passou. */
async function capture(action: () => Promise<unknown>): Promise<string | null> {
  try {
    await action();
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

/** INSERT + commit: os dois são necessários para ver erro adiado. */
async function insert(
  db: TestDatabase,
  sql: string,
  params: unknown[] = [],
): Promise<string | null> {
  return capture(async () => {
    await run(db, sql, params);
    await db.flush();
  });
}

try {
  const db = await createTestDatabase();
  await db.applyMigrations();
  console.log("migrations OK");

  const f = await seedFixtures(db);
  console.log("actors:", Object.keys(f).join(", "));

  const actors = await run<{ username: string; display_name: string; entity_type: string; bio: string | null }>(
    db,
    "select username, display_name, entity_type, bio from public.actors order by username",
  );
  console.table(actors);
  check("actors espelham personagens e organizações", actors.length === 3, `${actors.length} actors`);

  const [tagged] = await run<{ tags: string[] }>(db, "select public.extract_hashtags($1) as tags", [
    "olá #Várzea e #abc, #abc #x1_y fim#nao #ação #a#b",
  ]);
  console.log("hashtags:", tagged.tags);
  check(
    "hashtags extraem sem duplicar nem pegar sufixo de palavra",
    JSON.stringify(tagged.tags) === JSON.stringify(["várzea", "abc", "x1_y", "ação", "a"]),
    tagged.tags.join(", "),
  );

  // --- escrita com o jogador comum ------------------------------------------
  await db.asUser(FIXTURES.joao);

  const [post] = await run<{ id: string }>(
    db,
    "insert into public.posts (actor_id, content) values ($1, $2) returning id",
    [f.arthurActor, "Alguém viu os carros na avenida? #vereda"],
  );
  const postId = post.id;

  const linked = await run<{ name: string }>(
    db,
    "select h.name from public.post_hashtags ph join public.hashtags h on h.id = ph.hashtag_id where ph.post_id = $1",
    [postId],
  );
  console.log("hashtags persistidas:", linked.map((row) => row.name));
  check("hashtag do post vira linha", linked.length === 1 && linked[0].name === "vereda");

  // RLS: editar NPC filtra a linha sem levantar erro.
  await run(db, "update public.characters set bio = 'hackeado' where id = $1", [f.helena]);
  const [npc] = await run<{ bio: string }>(db, "select bio from public.characters where id = $1", [f.helena]);
  check("jogador não edita NPC", npc.bio !== "hackeado", `bio = ${npc.bio}`);

  const [canManage] = await run<{ ok: boolean }>(db, "select public.can_manage_actor($1) as ok", [
    f.helenaActor,
  ]);
  check("jogador não gerencia identidade alheia", canManage.ok === false);

  const hijack = await capture(() =>
    run(db, "insert into public.posts (actor_id, content) values ($1, 'roubo') returning id", [
      f.helenaActor,
    ]),
  );
  check(
    "publicar como NPC alheio é recusado pelo RLS",
    hijack !== null && hijack.includes("row-level security"),
    firstLine(hijack) ?? "passou sem erro",
  );

  // --- invariantes de conteúdo ----------------------------------------------
  const empty = await insert(db, "insert into public.posts (actor_id, content) values ($1, '   ') returning id", [
    f.arthurActor,
  ]);
  check("post só com espaços é recusado", empty !== null, firstLine(empty) ?? "passou");

  const nothing = await insert(db, "insert into public.posts (actor_id, content) values ($1, null) returning id", [
    f.arthurActor,
  ]);
  check("post sem texto e sem imagem é recusado", nothing !== null, firstLine(nothing) ?? "passou");

  // Post só com imagem: publicação e anexo na mesma transação.
  const [imageOnly] = await run<{ id: string }>(
    db,
    "select public.publish_post($1, null, null, null, $2) as id",
    [
      f.arthurActor,
      JSON.stringify([
        {
          storagePath: `${f.arthurActor}/foto.png`,
          mediaType: "image/png",
          width: 800,
          height: 600,
          altText: "Uma foto",
        },
      ]),
    ],
  );
  check("post só com imagem é aceito", Boolean(imageOnly.id), imageOnly.id);

  const [media] = await run<{ n: number }>(
    db,
    "select count(*)::int as n from public.post_media where post_id = $1",
    [imageOnly.id],
  );
  check("mídia foi anexada", media.n === 1, `${media.n} linha(s)`);

  // --- repost: sem texto, sem mídia própria -----------------------------------
  const [repost] = await run<{ id: string }>(
    db,
    "insert into public.posts (actor_id, repost_of) values ($1, $2) returning id",
    [f.arthurActor, postId],
  );

  const repostWithMedia = await capture(() =>
    run(
      db,
      `insert into public.post_media (post_id, storage_path, media_type, position)
       values ($1, $2, 'image/png', 0)`,
      [repost.id, `${f.arthurActor}/capa.png`],
    ),
  );
  check(
    "repost não aceita imagem própria",
    repostWithMedia !== null && repostWithMedia.includes("repost"),
    firstLine(repostWithMedia) ?? "passou",
  );

  // O texto enviado junto é descartado em silêncio: um repost guarda só a
  // referência ao post original. A UI nunca oferece o campo, mas a regra mora no
  // banco.
  const [withText] = await run<{ content: string | null }>(
    db,
    "insert into public.posts (actor_id, content, repost_of) values ($1, 'texto', $2) returning content",
    [f.arthurActor, postId],
  );
  check("repost descarta texto próprio no insert", withText.content === null, String(withText.content));

  await run(db, "update public.posts set content = 'comentário' where id = $1", [repost.id]);
  const [afterEdit] = await run<{ content: string | null }>(
    db,
    "select content from public.posts where id = $1",
    [repost.id],
  );
  check("repost não aceita texto próprio no update", afterEdit.content === null, String(afterEdit.content));

  // --- notificações: descurtir não apaga o repost ----------------------------
  // Quem curte é o Mestre, usando o NPC que ele controla. Com Maria (que não tem
  // identidades) o RLS recusa, que também é o comportamento esperado.
  await db.asUser(FIXTURES.maria);
  const mariaLike = await capture(() =>
    run(db, "insert into public.likes (post_id, actor_id) values ($1, $2)", [postId, f.helenaActor]),
  );
  check(
    "quem não controla a identidade não curte como ela",
    mariaLike !== null && mariaLike.includes("row-level security"),
    firstLine(mariaLike) ?? "passou",
  );

  await db.asUser(FIXTURES.gm);
  await run(db, "insert into public.likes (post_id, actor_id) values ($1, $2)", [postId, f.helenaActor]);
  await run(db, "insert into public.posts (actor_id, repost_of) values ($1, $2)", [f.helenaActor, postId]);

  const before = await run<{ type: string }>(
    db,
    "select type from public.notifications where recipient_actor_id = $1 order by type",
    [f.arthurActor],
  );
  check(
    "curtida e repost geram duas notificações",
    before.length === 2,
    before.map((row) => row.type).join(", "),
  );

  await run(db, "delete from public.likes where post_id = $1 and actor_id = $2", [postId, f.helenaActor]);

  const after = await run<{ type: string }>(
    db,
    "select type from public.notifications where recipient_actor_id = $1 order by type",
    [f.arthurActor],
  );
  check(
    "descurtir remove só a notificação de curtida",
    after.length === 1 && after[0].type === "repost",
    after.map((row) => row.type).join(", "),
  );

  // --- a função de contagem respeita quem pode gerenciar o actor --------------
  const [gmUnread] = await run<{ n: number }>(db, "select public.count_unread_notifications() as n");
  check("Mestre enxerga a fila inteira", gmUnread.n === 1, String(gmUnread.n));

  await db.asUser(FIXTURES.joao);
  const [joaoUnread] = await run<{ n: number }>(db, "select public.count_unread_notifications() as n");
  check("jogador conta só a da sua identidade", joaoUnread.n === 1, String(joaoUnread.n));

  await db.asUser(FIXTURES.maria);
  const [mariaUnread] = await run<{ n: number }>(db, "select public.count_unread_notifications() as n");
  check(
    "quem não controla identidade não vê notificação alheia",
    mariaUnread.n === 0,
    String(mariaUnread.n),
  );

  // --- o Mestre tem alcance maior --------------------------------------------
  await db.asUser(FIXTURES.gm);
  const [edited] = await run<{ bio: string }>(
    db,
    "update public.characters set bio = 'revisada pelo Mestre' where id = $1 returning bio",
    [f.helena],
  );
  check("Mestre edita NPC", edited.bio === "revisada pelo Mestre", edited.bio);

  const [npcPost] = await run<{ id: string }>(
    db,
    "insert into public.posts (actor_id, content) values ($1, 'A cidade acordou cedo.') returning id",
    [f.helenaActor],
  );
  check("Mestre publica como NPC", Boolean(npcPost.id));

  const [deleted] = await run<{ id: string }>(db, "delete from public.posts where id = $1 returning id", [
    postId,
  ]);
  check("Mestre apaga qualquer publicação", deleted.id === postId);

  await db.flush();
  await db.close();

  console.table(results);
  const failed = results.filter((item) => !item.ok);
  if (failed.length > 0) {
    console.log(`\n${failed.length} verificação(ões) falharam.`);
    process.exitCode = 1;
  } else {
    console.log(`\n${results.length} verificações OK.`);
  }
} catch (error) {
  console.log(
    `FAIL smoke: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`,
  );
  process.exitCode = 1;
}

function firstLine(message: string | null): string | undefined {
  return message?.split("\n")[0];
}
