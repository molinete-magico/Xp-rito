"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireViewer } from "@/lib/session";
import { fieldErrors, profileUpdateSchema, characterSchema, type ActionState } from "@/lib/validation/schemas";
import { AVATARS_BUCKET, BANNERS_BUCKET, publicUrl } from "@/lib/media";

/**
 * Ajustes da conta.
 *
 * Duas coisas distintas: `profiles` é quem a pessoa é na mesa (login, nome de
 * exibição, @handle pessoal) e `characters` é o personagem que ela interpreta,
 * com @handle próprio na rede. O feed mostra sempre o personagem; o perfil
 * aparece só em "quem assina", não no meio das publicações.
 *
 * Imagens: o banco guarda a URL pública completa, e não só o caminho. Trocar a
 * URL do projeto Supabase significa uma sentença de UPDATE, não uma migração.
 */

export async function updateAccountAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await requireViewer();

  const parsed = profileUpdateSchema.safeParse({
    displayName: formData.get("displayName"),
    username: formData.get("username"),
  });

  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: parsed.data.displayName, username: parsed.data.username })
    .eq("id", viewer.userId);

  if (error) return { ok: false, message: describeProfileError(error.message) };

  revalidatePath("/settings");
  revalidatePath("/home");
  return { ok: true, message: "Conta atualizada." };
}

export async function updateCharacterAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await requireViewer();
  const characterId = String(formData.get("characterId") ?? "");

  if (!viewer.identities.some((actor) => actor.entity_id === characterId)) {
    // O RLS recusaria de qualquer jeito; a mensagem é o que importa.
    return { ok: false, message: "Essa identidade não é sua." };
  }

  const parsed = characterSchema.safeParse({
    name: formData.get("name"),
    username: formData.get("username"),
    bio: formData.get("bio") || null,
  });

  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase
    .from("characters")
    .update({
      name: parsed.data.name,
      username: parsed.data.username,
      bio: parsed.data.bio,
    })
    .eq("id", characterId);

  if (error) return { ok: false, message: describeProfileError(error.message) };

  revalidatePath("/settings");
  revalidatePath(`/profile/${parsed.data.username}`);
  revalidatePath("/home");
  return { ok: true, message: "Personagem atualizado." };
}

export async function createCharacterAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await requireViewer();
  if (viewer.isGm) {
    return { ok: false, message: "NPCs e veículos são criados no painel do Mestre." };
  }

  const parsed = characterSchema.safeParse({
    name: formData.get("name"),
    username: formData.get("username"),
    bio: formData.get("bio") || null,
  });

  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase
    .from("characters")
    .insert({
      owner_id: viewer.userId,
      name: parsed.data.name,
      username: parsed.data.username,
      bio: parsed.data.bio,
    });

  if (error) return { ok: false, message: describeProfileError(error.message) };

  revalidatePath("/settings");
  revalidatePath("/home");
  return { ok: true, message: "Personagem criado." };
}

/**
 * Grava a URL da imagem trocada no banco.
 *
 * O upload em si acontece no navegador, direto para o Storage: é lá que a
 * sessão do usuário vai junto, e a política do bucket decide se aquele
 * `actor_id` pode receber arquivo. Esta action só recebe o caminho já
 * armazenado e registra a URL pública na entidade, nunca no `actors`, que é
 * somente-leitura para o cliente por RLS; o trigger `sync_actor_*` espelha a
 * imagem no actor.
 */
export async function attachIdentityImageAction(formData: FormData): Promise<ActionState> {
  const viewer = await requireViewer();
  const actorId = String(formData.get("actorId") ?? "");
  const kind = formData.get("kind");
  const storagePath = String(formData.get("storagePath") ?? "");

  if (!viewer.identities.some((actor) => actor.id === actorId)) {
    return { ok: false, message: "Essa identidade não é sua." };
  }
  if (kind !== "avatar" && kind !== "banner") {
    return { ok: false, message: "Tipo de imagem desconhecido." };
  }
  if (!storagePath.startsWith(`${actorId}/`)) {
    return { ok: false, message: "Caminho de imagem inválido." };
  }

  const bucket = kind === "avatar" ? AVATARS_BUCKET : BANNERS_BUCKET;
  const url = publicUrl(bucket, storagePath);
  const patch = kind === "avatar" ? { avatar_url: url } : { banner_url: url };

  const supabase = await createClient();
  const { data: actor, error: actorError } = await supabase
    .from("actors")
    .select("character_id, organization_id")
    .eq("id", actorId)
    .maybeSingle();

  if (actorError || !actor) return { ok: false, message: "Essa identidade não é sua." };

  const { error } = actor.character_id
    ? await supabase.from("characters").update(patch).eq("id", actor.character_id)
    : await supabase.from("organizations").update(patch).eq("id", actor.organization_id ?? "");

  if (error) return { ok: false, message: "Não foi possível salvar a imagem." };

  revalidatePath("/settings");
  revalidatePath("/home");
  return { ok: true, message: "Imagem atualizada." };
}

/**
 * Ajusta de onde a foto/capa "corta" ao ser exibida.
 *
 * O foco é um par/valor de `object-position`, em % (0 a 100), gravado na
 * entidade; o trigger de espelho copia para o actor, fonte de exibição. A
 * autorização é a mesma do upload: só identidades do próprio viewer.
 */
export async function setImageFocusAction(formData: FormData): Promise<ActionState> {
  const viewer = await requireViewer();
  const actorId = String(formData.get("actorId") ?? "");
  const kind = formData.get("kind");
  const x = parseInt(String(formData.get("x") ?? ""), 10);
  const y = parseInt(String(formData.get("y") ?? ""), 10);

  if (!viewer.identities.some((actor) => actor.id === actorId)) {
    return { ok: false, message: "Essa identidade não é sua." };
  }
  if (kind !== "avatar" && kind !== "banner") {
    return { ok: false, message: "Tipo de imagem desconhecido." };
  }
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x > 100 || y < 0 || y > 100) {
    return { ok: false, message: "Posição inválida." };
  }

  const patch =
    kind === "avatar"
      ? { avatar_position_x: x, avatar_position_y: y }
      : { banner_position_y: y };

  const supabase = await createClient();
  const { data: actor, error: actorError } = await supabase
    .from("actors")
    .select("character_id, organization_id")
    .eq("id", actorId)
    .maybeSingle();

  if (actorError || !actor) return { ok: false, message: "Essa identidade não é sua." };

  const { error } = actor.character_id
    ? await supabase.from("characters").update(patch).eq("id", actor.character_id)
    : await supabase.from("organizations").update(patch).eq("id", actor.organization_id ?? "");

  if (error) return { ok: false, message: "Não foi possível ajustar a posição." };

  revalidatePath("/settings");
  revalidatePath("/home");
  revalidatePath("/admin");
  return { ok: true, message: "Posição salva." };
}

export async function deleteCharacterAction(formData: FormData): Promise<void> {
  const viewer = await requireViewer();
  const characterId = String(formData.get("characterId") ?? "");
  const supabase = await createClient();

  // Só o dono apaga o próprio personagem, e nem o Mestre faz isso por aqui:
  // personagem de outra pessoa é decisão do painel.
  const { data } = await supabase
    .from("characters")
    .select("owner_id")
    .eq("id", characterId)
    .maybeSingle();

  if (data?.owner_id === viewer.userId) {
    await supabase.from("characters").delete().eq("id", characterId);
  }

  revalidatePath("/settings");
  revalidatePath("/home");
  redirect("/settings");
}

function describeProfileError(message: string): string {
  if (message.includes("row-level security") || message.includes("permission denied")) {
    return "Você só edita as suas próprias identidades.";
  }
  if (message.includes("_username_key")) {
    return "Esse @handle já está em uso.";
  }
  if (message.includes("username_charset") || message.includes("username_no_")) {
    return "O @handle só aceita minúsculas, números, ponto e sublinhado, e não pode começar nem terminar em ponto.";
  }
  if (message.includes("bio_len")) return "A bio passa de 300 caracteres.";
  if (message.includes("display_name_len")) return "O nome passa de 80 caracteres.";
  if (message.includes("guard_profile_role") || message.includes("profiles_role")) {
    return "O papel na mesa não muda por aqui.";
  }
  return "Não foi possível salvar agora.";
}
